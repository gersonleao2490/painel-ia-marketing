/* ============================================================================
   PAINEL IA — SERVIDOR SEGURO (login + acesso remoto)
   Node puro (sem instalar nada). Senhas com hash scrypt + sessão por cookie.
   - Serve o painel
   - Login / cadastro (cadastro exige CÓDIGO DE CONVITE)
   - Faz proxy autenticado para o Ollama (a IA não fica exposta)
   - Endpoints do Notion (autenticados)
   Rode com:  node server.js   (ou use o atalho "ABRIR-PAINEL-ONLINE")
   ============================================================================ */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = __dirname;
const CFG_PATH = path.join(DIR, 'server-config.json');
const USERS_PATH = path.join(DIR, 'users.json');
const SESS_PATH = path.join(DIR, 'sessions.json');
const NOTION_CFG = path.join(DIR, 'notion-config.json');
const OLLAMA = { host: '127.0.0.1', port: 11434 };

/* ---------- config ---------- */
let cfg = { port: 8800, inviteCode: '' };
try { cfg = Object.assign(cfg, JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'))); } catch (e) {}
if (!cfg.inviteCode) { cfg.inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase(); fs.writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2)); }

/* ---------- usuários ---------- */
function loadUsers() { try { return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8')); } catch (e) { return []; } }
function saveUsers(u) { fs.writeFileSync(USERS_PATH, JSON.stringify(u, null, 2)); }
function hashPw(pw, salt) { return crypto.scryptSync(pw, salt, 64).toString('hex'); }
function makeUser(username, password, role) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { username, salt, hash: hashPw(password, salt), role: role || 'user', created: Date.now() };
}
function verifyPw(user, pw) {
  const h = Buffer.from(hashPw(pw, user.salt), 'hex');
  const stored = Buffer.from(user.hash, 'hex');
  return h.length === stored.length && crypto.timingSafeEqual(h, stored);
}

/* ---------- sessões ---------- */
let sessions = {};
try { sessions = JSON.parse(fs.readFileSync(SESS_PATH, 'utf8')); } catch (e) {}
function saveSessions() { try { fs.writeFileSync(SESS_PATH, JSON.stringify(sessions)); } catch (e) {} }
const SESS_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias
function newSession(username) {
  const t = crypto.randomBytes(32).toString('hex');
  sessions[t] = { username, exp: Date.now() + SESS_MS };
  saveSessions(); return t;
}
function userFromReq(req) {
  const c = req.headers.cookie || '';
  const m = c.match(/(?:^|;\s*)sid=([a-f0-9]+)/);
  if (!m) return null;
  const s = sessions[m[1]];
  if (!s || s.exp < Date.now()) { if (s) { delete sessions[m[1]]; saveSessions(); } return null; }
  return loadUsers().find(u => u.username === s.username) || null;
}
function sidFromReq(req) { const m = (req.headers.cookie || '').match(/(?:^|;\s*)sid=([a-f0-9]+)/); return m ? m[1] : null; }
function userFile(u) { return crypto.createHash('sha256').update(String(u).toLowerCase()).digest('hex').slice(0, 16) + '.json'; }

/* ---------- anti força-bruta (simples) ---------- */
const fails = {};
function tooMany(key) { const f = fails[key]; return f && f.n >= 8 && (Date.now() - f.t) < 1000 * 60 * 10; }
function bumpFail(key) { const f = fails[key] || { n: 0, t: Date.now() }; f.n++; f.t = Date.now(); fails[key] = f; }
function clearFail(key) { delete fails[key]; }

/* ---------- helpers HTTP ---------- */
function json(res, code, obj, cookie) {
  const h = { 'Content-Type': 'application/json; charset=utf-8' };
  if (cookie) h['Set-Cookie'] = cookie;
  res.writeHead(code, h); res.end(JSON.stringify(obj));
}
function readBody(req, cb) { let d = ''; req.on('data', c => { d += c; if (d.length > 2e7) req.destroy(); }); req.on('end', () => cb(d)); }
const cookieFor = t => `sid=${t}; HttpOnly; Path=/; Max-Age=${Math.floor(SESS_MS/1000)}; SameSite=Lax`;
const cookieClear = 'sid=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax';

/* ---------- Notion (igual ao bridge, autenticado) ---------- */
let notionCfg = { token: '', databaseId: '' }, titleProp = null;
function loadNotion() { try { notionCfg = Object.assign({ token:'', databaseId:'' }, JSON.parse(fs.readFileSync(NOTION_CFG, 'utf8'))); } catch (e) {} }
loadNotion();
function notionReady() { return notionCfg.token && notionCfg.databaseId && !/COLE_AQUI/.test(notionCfg.token) && !/COLE_AQUI/.test(notionCfg.databaseId); }
function cleanId(id) { return String(id || '').trim().replace(/^https?:\/\/.*?([0-9a-f]{32}).*/i, '$1').replace(/-/g, ''); }
function notionApi(urlPath, method, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({ hostname: 'api.notion.com', path: '/v1/' + urlPath, method,
      headers: { 'Authorization': 'Bearer ' + notionCfg.token, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' } },
      pr => { let t = ''; pr.on('data', c => t += c); pr.on('end', () => { let j; try { j = JSON.parse(t); } catch (e) { j = { raw: t }; } pr.statusCode < 300 ? resolve(j) : reject(new Error('Notion ' + pr.statusCode + ': ' + (j.message || t).slice(0, 250))); }); });
    r.on('error', reject); if (data) r.write(data); r.end();
  });
}
async function notionTitleProp() { if (titleProp) return titleProp; const db = await notionApi('databases/' + cleanId(notionCfg.databaseId), 'GET'); for (const [n, p] of Object.entries(db.properties || {})) if (p.type === 'title') { titleProp = n; break; } return titleProp || (titleProp = 'Name'); }
async function notionCreate(item) {
  const tp = await notionTitleProp();
  const title = (item['Tema/Gancho'] || item['Tema'] || item['Data'] || 'Conteúdo').toString().slice(0, 200) || 'Conteúdo';
  const children = Object.entries(item).filter(([k, v]) => v && String(v).trim()).map(([k, v]) => ({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: (k + ': ' + v).slice(0, 1900) } }] } }));
  const props = {}; props[tp] = { title: [{ text: { content: title } }] };
  return notionApi('pages', 'POST', { parent: { database_id: cleanId(notionCfg.databaseId) }, properties: props, children });
}

/* ---------- proxy Ollama ---------- */
function proxyOllama(req, res) {
  const pr = http.request({ host: OLLAMA.host, port: OLLAMA.port, path: req.url, method: req.method, headers: { 'Content-Type': 'application/json' } },
    pres => { res.writeHead(pres.statusCode, { 'Content-Type': pres.headers['content-type'] || 'application/json' }); pres.pipe(res); });
  pr.on('error', e => { json(res, 502, { error: 'Ollama offline no PC servidor: ' + e.message }); });
  req.pipe(pr);
}

/* ---------- static ---------- */
function serveIndex(res) {
  fs.readFile(path.join(DIR, 'index.html'), (e, buf) => { if (e) { res.writeHead(500); res.end('index.html não encontrado'); } else { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache, no-store, must-revalidate' }); res.end(buf); } });
}

/* ---------- servidor ---------- */
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const user = userFromReq(req);

  // ---- auth ----
  if (url === '/auth/me') return user ? json(res, 200, { user: user.username, role: user.role }) : json(res, 401, { error: 'nao logado' });
  if (url === '/auth/logout' && req.method === 'POST') { const sid = sidFromReq(req); if (sid) { delete sessions[sid]; saveSessions(); } return json(res, 200, { ok: true }, cookieClear); }
  if (url === '/auth/login' && req.method === 'POST') return readBody(req, b => {
    let d; try { d = JSON.parse(b); } catch (e) { return json(res, 400, { error: 'dados inválidos' }); }
    const key = 'login:' + (d.username || '').toLowerCase();
    if (tooMany(key)) return json(res, 429, { error: 'Muitas tentativas. Espere 10 minutos.' });
    const u = loadUsers().find(x => x.username.toLowerCase() === String(d.username || '').toLowerCase());
    if (!u || !verifyPw(u, String(d.password || ''))) { bumpFail(key); return json(res, 401, { error: 'Usuário ou senha incorretos.' }); }
    clearFail(key); return json(res, 200, { ok: true, user: u.username }, cookieFor(newSession(u.username)));
  });
  if (url === '/auth/register' && req.method === 'POST') return readBody(req, b => {
    let d; try { d = JSON.parse(b); } catch (e) { return json(res, 400, { error: 'dados inválidos' }); }
    const username = String(d.username || '').trim(), password = String(d.password || ''), code = String(d.code || '').trim();
    if (username.length < 3) return json(res, 400, { error: 'Usuário muito curto (mín. 3).' });
    if (password.length < 6) return json(res, 400, { error: 'Senha muito curta (mín. 6).' });
    if (code.toUpperCase() !== cfg.inviteCode.toUpperCase()) return json(res, 403, { error: 'Código de convite inválido.' });
    const users = loadUsers();
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) return json(res, 409, { error: 'Esse usuário já existe.' });
    const u = makeUser(username, password, users.length === 0 ? 'admin' : 'user'); users.push(u); saveUsers(users);
    return json(res, 200, { ok: true, user: u.username }, cookieFor(newSession(u.username)));
  });

  // ---- daqui pra baixo exige login ----
  const protectedApi = url.startsWith('/api/') || ['/notion', '/config', '/test', '/notion-health', '/data'].includes(url);
  if (protectedApi && !user) return json(res, 401, { error: 'Faça login para usar.' });

  // ---- sincronização de dados por usuário (acessível de qualquer aparelho) ----
  if (url === '/data') {
    const f = path.join(DIR, 'data', userFile(user.username));
    if (req.method === 'GET') { try { return json(res, 200, JSON.parse(fs.readFileSync(f, 'utf8'))); } catch (e) { return json(res, 200, {}); } }
    if (req.method === 'POST') return readBody(req, b => { try { fs.mkdirSync(path.join(DIR, 'data'), { recursive: true }); fs.writeFileSync(f, b || '{}'); json(res, 200, { saved: true }); } catch (e) { json(res, 500, { error: String(e.message) }); } });
  }

  if (url.startsWith('/api/')) return proxyOllama(req, res); // Ollama (login ok)

  if (url === '/notion-health') return json(res, 200, { ok: true, configured: (loadNotion(), notionReady()) });
  if (url === '/config' && req.method === 'POST') return readBody(req, b => {
    try { const d = JSON.parse(b || '{}'); fs.writeFileSync(NOTION_CFG, JSON.stringify({ token: String(d.token||'').trim(), databaseId: String(d.databaseId||'').trim(), port: 3333 }, null, 2)); loadNotion(); titleProp = null; return json(res, 200, { saved: true, configured: notionReady() }); }
    catch (e) { return json(res, 500, { error: String(e.message) }); }
  });
  if (url === '/test' && req.method === 'POST') { loadNotion(); titleProp = null; return (async () => { try { if (!notionReady()) return json(res, 400, { error: 'Preencha o token e a database primeiro.' }); const n = await notionTitleProp(); json(res, 200, { ok: true, titleProp: n }); } catch (e) { json(res, 500, { error: String(e.message) }); } })(); }
  if (url === '/notion' && req.method === 'POST') return readBody(req, b => (async () => {
    loadNotion(); titleProp = null;
    try { if (!notionReady()) return json(res, 400, { error: 'Notion não configurado. Vá em ⚙️ → Conectar o Notion.' }); const items = (JSON.parse(b || '{}').items) || []; if (!items.length) return json(res, 400, { error: 'Nenhuma linha recebida.' }); let created = 0; const errors = []; for (const it of items) { try { await notionCreate(it); created++; } catch (e) { errors.push(String(e.message)); } } json(res, 200, { created, total: items.length, errors }); }
    catch (e) { json(res, 500, { error: String(e.message) }); }
  })());

  // ---- static (painel) ----
  if (url === '/' || url === '/index.html') return serveIndex(res);
  res.writeHead(404); res.end('not found');
});

server.listen(cfg.port, () => {
  const users = loadUsers();
  console.log('============================================================');
  console.log('  PAINEL IA — SERVIDOR SEGURO  →  http://localhost:' + cfg.port);
  console.log('  Usuários cadastrados: ' + users.length);
  if (users.length === 0) console.log('  CÓDIGO DE CONVITE (para o 1º cadastro): ' + cfg.inviteCode);
  console.log('  (Compartilhe o código só com quem você autorizar.)');
  console.log('============================================================');
});
