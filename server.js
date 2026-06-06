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
if (!cfg.inviteCode) { cfg.inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase(); try { fs.writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2)); } catch (e) {} }

/* ---------- usuários ---------- */
function loadUsers() { try { const u = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8')); return Array.isArray(u) ? u : [u]; } catch (e) { return []; } }
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

/* ---------- IA na nuvem (Google Gemini) ---------- */
function geminiConfigured() { return cfg.geminiKey && String(cfg.geminiKey).trim().length > 15 && !/COLE_AQUI/.test(cfg.geminiKey); }
function endNdjson(res, text) { try { res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8' }); res.write(JSON.stringify({ message: { role: 'assistant', content: text }, done: false }) + '\n'); res.write(JSON.stringify({ done: true }) + '\n'); res.end(); } catch (e) {} }
// Gera texto no Gemini e devolve via cb(errTexto|null, texto). Reaproveitado pelo chat e pela análise de perfil.
function geminiGenerate(messages, options, cb) {
  let systemText = ''; const contents = [];
  for (const m of (messages || [])) {
    if (m.role === 'system') { systemText += (systemText ? '\n' : '') + (m.content || ''); continue; }
    const parts = []; if (m.content) parts.push({ text: m.content });
    if (m.images && m.images.length) for (const img of m.images) parts.push({ inlineData: { mimeType: 'image/jpeg', data: img } });
    contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts });
  }
  const gReq = { contents, generationConfig: { temperature: (options && options.temperature) || 0.7, thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: (options && options.maxOutputTokens) || 8000 } };
  if (systemText) gReq.systemInstruction = { parts: [{ text: systemText }] };
  const data = JSON.stringify(gReq);
  const r = https.request({ hostname: 'generativelanguage.googleapis.com', path: '/v1beta/models/' + (cfg.geminiModel || 'gemini-2.5-flash') + ':generateContent?key=' + encodeURIComponent(cfg.geminiKey), method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
    gres => {
      let body = ''; gres.on('data', c => body += c); gres.on('end', () => {
        try {
          const j = JSON.parse(body);
          if (gres.statusCode !== 200 || j.error) return cb('⚠️ IA na nuvem recusou: ' + ((j.error && j.error.message) || ('HTTP ' + gres.statusCode)) + ' — confira sua chave do Gemini em ⚙️.', '');
          const c0 = j.candidates && j.candidates[0];
          let text = (c0 && c0.content && c0.content.parts && c0.content.parts.map(p => p.text || '').join('')) || '';
          if (!text && c0 && c0.finishReason === 'SAFETY') text = '(a IA na nuvem bloqueou esta resposta por política de segurança — tente reformular)';
          cb(null, text || '(sem resposta da IA na nuvem)');
        } catch (e) { cb('⚠️ erro lendo a resposta da IA na nuvem.', ''); }
      });
    });
  r.on('error', e => cb('⚠️ não consegui falar com a IA na nuvem: ' + e.message, ''));
  r.write(data); r.end();
}
function geminiChat(reqBody, res) {
  let payload; try { payload = JSON.parse(reqBody || '{}'); } catch (e) { return endNdjson(res, '⚠️ erro interno (json).'); }
  geminiGenerate(payload.messages, payload.options, (err, text) => endNdjson(res, err || text));
}

/* ---------- FASE 2: Análise de Perfil (só com o @) ---------- */
function igConfigured() { return cfg.igApiKey && String(cfg.igApiKey).trim().length > 10; }
function cleanHandle(h) { return String(h || '').trim().replace(/.*instagram\.com\//i, '').replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, '').slice(0, 60); }
function num(v) { if (v == null) return null; const n = Number(String(v).replace(/[^\d.]/g, '')); return isFinite(n) ? n : null; }
// Busca defensiva: acha o 1º valor cuja chave esteja em `keys` (lida com {count:N}). Funciona mesmo se a API mudar o formato.
function dig(obj, keys, depth) {
  depth = depth || 0; if (!obj || typeof obj !== 'object' || depth > 7) return undefined;
  for (const k of keys) if (obj[k] != null) { const v = obj[k]; if (v && typeof v === 'object') { if (typeof v.count === 'number') return v.count; } else { return v; } }
  for (const k in obj) { const v = obj[k]; if (v && typeof v === 'object') { const r = dig(v, keys, depth + 1); if (r !== undefined) return r; } }
  return undefined;
}
function normalizeProfile(raw, handle) {
  const root = (raw && (raw.data || raw.user || raw.result || raw.graphql)) || raw || {};
  return {
    username: dig(root, ['username', 'user_name', 'handle']) || handle,
    fullName: dig(root, ['full_name', 'fullname', 'name']) || '',
    followers: num(dig(root, ['follower_count', 'followers_count', 'followers', 'edge_followed_by'])),
    following: num(dig(root, ['following_count', 'follows_count', 'following', 'edge_follow'])),
    posts: num(dig(root, ['media_count', 'post_count', 'posts_count', 'edge_owner_to_timeline_media'])),
    bio: dig(root, ['biography', 'bio', 'description']) || '',
    verified: !!dig(root, ['is_verified', 'verified']),
    isPrivate: !!dig(root, ['is_private', 'private']),
    category: dig(root, ['category', 'category_name', 'business_category_name']) || '',
    externalUrl: dig(root, ['external_url', 'external_link', 'website']) || '',
    profilePic: dig(root, ['profile_pic_url_hd', 'profile_pic_url', 'profile_picture', 'avatar']) || ''
  };
}
function extractPosts(raw) {
  let arr = null;
  (function find(o, d) {
    if (!o || typeof o !== 'object' || d > 7 || arr) return;
    if (Array.isArray(o)) { if (o.length && o.some(x => x && typeof x === 'object' && dig(x, ['like_count', 'likes', 'edge_liked_by']) != null)) { arr = o; return; } }
    for (const k in o) find(o[k], d + 1);
  })(raw, 0);
  if (!arr) return [];
  return arr.slice(0, 12).map(x => ({ likes: num(dig(x, ['like_count', 'likes', 'edge_liked_by'])), comments: num(dig(x, ['comment_count', 'comments', 'edge_media_to_comment'])) })).filter(p => p.likes != null);
}
function igGet(pathTpl, handle, cb) {
  // Padrão = Instagram120 (POST {"username":"..."} em /api/instagram/profile).
  const host = cfg.igApiHost || 'instagram120.p.rapidapi.com';
  const method = (cfg.igApiMethod || 'POST').toUpperCase();
  const p = String(pathTpl).replace('{handle}', encodeURIComponent(handle));
  const headers = { 'x-rapidapi-key': cfg.igApiKey, 'x-rapidapi-host': host };
  let data = null;
  if (method === 'POST') { data = String(cfg.igApiBody || '{"username":"{handle}"}').replace('{handle}', handle); headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(data); }
  const r = https.request({ hostname: host, path: p, method, headers },
    gres => { let body = ''; gres.on('data', c => body += c); gres.on('end', () => { let j = null; try { j = JSON.parse(body); } catch (e) {} cb(gres.statusCode, j); }); });
  r.on('error', () => cb(0, null));
  if (data) r.write(data);
  r.end();
}
function profileAnalysis(reqBody, res) {
  let d; try { d = JSON.parse(reqBody || '{}'); } catch (e) { return json(res, 400, { error: 'dados inválidos' }); }
  if (!geminiConfigured()) return json(res, 400, { error: 'Ligue a IA na nuvem (Gemini) primeiro em ⚙️.' });
  if (!igConfigured()) return json(res, 400, { error: 'Conecte a API de dados do Instagram em ⚙️ (cole sua chave do RapidAPI). Veja o guia COMO-LIGAR-ANALISE-PERFIL.md.' });
  const handle = cleanHandle(d.handle);
  if (!handle) return json(res, 400, { error: 'Digite um @ válido.' });
  igGet(cfg.igApiPath || '/api/instagram/profile', handle, (status, j) => {
    if (status === 401 || status === 403) return json(res, 502, { error: 'A API de dados recusou sua chave (HTTP ' + status + '). Confira/assine o plano grátis no RapidAPI e cole a chave de novo em ⚙️.' });
    if (status === 429) return json(res, 502, { error: 'Você atingiu o limite grátis da API de dados. Aguarde a renovação ou suba o plano no RapidAPI.' });
    if (!j) return json(res, 502, { error: 'A API de dados não respondeu (HTTP ' + status + '). Tente de novo em instantes.' });
    const prof = normalizeProfile(j, handle);
    if (prof.followers == null && prof.posts == null && !prof.fullName) return json(res, 502, { error: 'Não consegui ler os dados de @' + handle + ' (talvez não exista, ou a API mudou o formato). Tente outro @ — se persistir, me avise que eu ajusto a leitura.' });
    const posts = extractPosts(j);
    let engagement = null;
    if (posts.length && prof.followers) { const avg = posts.reduce((s, p) => s + (p.likes || 0) + (p.comments || 0), 0) / posts.length; engagement = +(avg / prof.followers * 100).toFixed(2); }
    const facts = [
      'Perfil: @' + prof.username + (prof.fullName ? ' (' + prof.fullName + ')' : ''),
      'Seguidores: ' + (prof.followers != null ? prof.followers : '?'),
      'Seguindo: ' + (prof.following != null ? prof.following : '?'),
      'Publicações: ' + (prof.posts != null ? prof.posts : '?'),
      prof.verified ? 'Conta verificada (selo azul)' : null,
      prof.isPrivate ? 'Conta privada' : null,
      prof.category ? 'Categoria/nicho: ' + prof.category : null,
      prof.externalUrl ? 'Link na bio: ' + prof.externalUrl : null,
      prof.bio ? 'Bio atual: "' + prof.bio + '"' : null,
      engagement != null ? 'Taxa de engajamento (média dos últimos posts): ' + engagement + '%' : 'Taxa de engajamento: não veio nesta consulta',
      posts.length ? 'Últimos posts (curtidas/comentários): ' + posts.map(p => p.likes + '/' + (p.comments != null ? p.comments : '?')).join(', ') : null
    ].filter(Boolean).join('\n');
    const sys = 'Você é a Diretora Sênior de Marketing e Growth de Instagram — auditora de perfis mais específica e acionável que o Not Just Analytics. Responda em PT-BR, direta, sem encheção, com números e ações concretas (nada genérico). Use markdown com seções e tabelas quando útil.';
    const user = 'Faça uma AUDITORIA ESTRATÉGICA COMPLETA deste perfil do Instagram, com base nos dados REAIS abaixo:\n\n' + facts + '\n\nEstruture assim:\n1) 📊 **Diagnóstico** — leia os números sem rodeios: o engajamento é bom ou ruim para esse tamanho? A proporção seguindo/seguidores diz o quê? Compare com benchmarks reais do nicho.\n2) ✅ **O que já está bom** (específico).\n3) ⚠️ **O que está travando o crescimento** (específico, com o porquê).\n4) ✍️ **Bio otimizada** — reescreva a bio com proposta de valor clara + CTA (dê 2 opções).\n5) 📅 **Plano de conteúdo de 30 dias** — em TABELA (Semana | Foco | Formatos | Meta).\n6) 🔑 **Hashtags e melhores horários** para o nicho.\n7) 🚀 **3 ações para ESTA SEMANA** que destravam engajamento.\nSe faltar algum dado, estime pelo nicho e marque como estimativa.';
    geminiGenerate([{ role: 'system', content: sys }, { role: 'user', content: user }], { maxOutputTokens: 8000 }, (err, text) => {
      if (err) return json(res, 502, { error: err });
      const fmt = n => n == null ? '?' : Number(n).toLocaleString('pt-BR');
      let header = '## 🔍 Análise de @' + prof.username + (prof.verified ? ' ✔️' : '') + '\n';
      if (prof.fullName) header += '**' + prof.fullName + '**' + (prof.category ? (' · ' + prof.category) : '') + '\n\n';
      header += '👥 **' + fmt(prof.followers) + '** seguidores · ➡️ ' + fmt(prof.following) + ' seguindo · 🖼️ ' + fmt(prof.posts) + ' posts';
      if (engagement != null) header += ' · 💛 **' + engagement + '%** engajamento';
      if (prof.bio) header += '\n\n> ' + prof.bio.replace(/\s*\n\s*/g, ' ');
      if (prof.externalUrl) header += '\n\n🔗 ' + prof.externalUrl;
      const result = header + '\n\n---\n\n' + text;
      json(res, 200, { ok: true, result, profile: prof, engagement });
    });
  });
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
  const protectedApi = url.startsWith('/api/') || ['/notion', '/config', '/test', '/notion-health', '/data', '/gemini-config', '/ig-config', '/ig-status'].includes(url);
  if (protectedApi && !user) return json(res, 401, { error: 'Faça login para usar.' });

  // ---- IA na nuvem (Gemini): salvar chave + checar ----
  if (url === '/gemini-config' && req.method === 'POST') return readBody(req, b => { try { const d = JSON.parse(b || '{}'); cfg.geminiKey = String(d.key || '').trim(); if (d.model) cfg.geminiModel = String(d.model).trim(); fs.writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2)); json(res, 200, { saved: true, on: geminiConfigured() }); } catch (e) { json(res, 500, { error: String(e.message) }); } });

  // ---- FASE 2: salvar chave da API de dados do Instagram (RapidAPI) ----
  if (url === '/ig-config' && req.method === 'POST') return readBody(req, b => { try { const d = JSON.parse(b || '{}'); cfg.igApiKey = String(d.key || '').trim(); if (d.host) cfg.igApiHost = String(d.host).trim(); if (d.path) cfg.igApiPath = String(d.path).trim(); fs.writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2)); json(res, 200, { saved: true, on: igConfigured() }); } catch (e) { json(res, 500, { error: String(e.message) }); } });
  if (url === '/ig-status') return json(res, 200, { on: igConfigured(), gemini: geminiConfigured() });

  // ---- sincronização de dados por usuário (acessível de qualquer aparelho) ----
  if (url === '/data') {
    const f = path.join(DIR, 'data', userFile(user.username));
    if (req.method === 'GET') { try { return json(res, 200, JSON.parse(fs.readFileSync(f, 'utf8'))); } catch (e) { return json(res, 200, {}); } }
    if (req.method === 'POST') return readBody(req, b => { try { fs.mkdirSync(path.join(DIR, 'data'), { recursive: true }); fs.writeFileSync(f, b || '{}'); json(res, 200, { saved: true }); } catch (e) { json(res, 500, { error: String(e.message) }); } });
  }

  if (url.startsWith('/api/')) {
    if (url === '/api/profile-analysis' && req.method === 'POST') return readBody(req, b => profileAnalysis(b, res));
    if (geminiConfigured()) {
      if (url === '/api/tags') return json(res, 200, { models: [{ name: (cfg.geminiModel || 'gemini-2.5-flash') + ' (nuvem)' }] });
      if (url === '/api/chat') return readBody(req, b => geminiChat(b, res));
    }
    return proxyOllama(req, res); // Ollama local (se Gemini não configurado)
  }

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
