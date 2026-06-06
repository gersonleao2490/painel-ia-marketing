/* ============================================================================
   PAINEL IA — FUNÇÃO NA NUVEM (Vercel serverless + Neon + Gemini)
   Mesma API do server.js local, mas:
   - sessão por TOKEN assinado (sem estado) em vez de arquivo
   - usuários/dados/config no Neon (Postgres) em vez de arquivos
   - segredos nas variáveis de ambiente do Vercel
   Roteado por vercel.json (todas as rotas caem aqui via ?__p=/caminho).
   ============================================================================ */
const fs = require('fs');
const pathmod = require('path');
const core = require('../lib/core');
const store = require('../lib/store');

const SECRET = process.env.SESSION_SECRET || 'troque-este-segredo-no-vercel';
const SESS_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias

function send(res, code, obj, cookie) {
  const h = { 'Content-Type': 'application/json; charset=utf-8' };
  if (cookie) h['Set-Cookie'] = cookie;
  res.writeHead(code, h); res.end(JSON.stringify(obj));
}
function endNdjson(res, text) {
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8' });
  res.write(JSON.stringify({ message: { role: 'assistant', content: text }, done: false }) + '\n');
  res.write(JSON.stringify({ done: true }) + '\n');
  res.end();
}
function getBody(req) {
  return new Promise(r => {
    if (req.body !== undefined && req.body !== null) return r(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    let d = ''; req.on('data', c => { d += c; if (d.length > 2e7) req.destroy(); }); req.on('end', () => r(d)); req.on('error', () => r(''));
  });
}
const cookieFor = t => `sid=${t}; HttpOnly; Path=/; Max-Age=${Math.floor(SESS_MS / 1000)}; SameSite=Lax; Secure`;
const cookieClear = 'sid=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure';
function tokenFromReq(req) { const m = (req.headers.cookie || '').match(/(?:^|;\s*)sid=([^;]+)/); return m ? decodeURIComponent(m[1]) : null; }
function userFromReq(req) { return core.verifyToken(tokenFromReq(req), SECRET); } // {u, r} | null

async function effConfig() {
  let c = {}; try { c = await store.getConfig(); } catch (e) {}
  return {
    geminiKey: c.geminiKey || process.env.GEMINI_KEY || '',
    geminiModel: c.geminiModel || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    igKey: c.igApiKey || process.env.RAPIDAPI_KEY || '',
    igHost: c.igApiHost || process.env.RAPIDAPI_HOST || 'instagram120.p.rapidapi.com',
    igPath: c.igApiPath || process.env.RAPIDAPI_PATH || '/api/instagram/profile',
    igMethod: c.igApiMethod || process.env.RAPIDAPI_METHOD || 'POST',
    igBody: c.igApiBody || process.env.RAPIDAPI_BODY || '{"username":"{handle}"}',
    inviteCode: process.env.INVITE_CODE || c.inviteCode || 'CONVITE'
  };
}
const geminiOn = cfg => !!(cfg.geminiKey && cfg.geminiKey.length > 15);
const igOn = cfg => !!(cfg.igKey && cfg.igKey.length > 10);

let INDEX_HTML = null;
function serveIndex(res) {
  if (INDEX_HTML == null) {
    for (const f of [pathmod.join(process.cwd(), 'index.html'), pathmod.join(__dirname, '..', 'index.html'), pathmod.join(__dirname, 'index.html')]) {
      try { INDEX_HTML = fs.readFileSync(f); break; } catch (e) {}
    }
  }
  if (INDEX_HTML == null) { res.writeHead(500); return res.end('index.html não encontrado'); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache, no-store, must-revalidate' });
  res.end(INDEX_HTML);
}

module.exports = async (req, res) => {
  try {
    // Caminho real vem do vercel.json como ?__p=/caminho (rewrite preserva a rota).
    const q = (req.url || '').indexOf('?'); const qs = q >= 0 ? req.url.slice(q + 1) : '';
    const params = new URLSearchParams(qs);
    let raw = params.get('__p'); if (raw == null) raw = (req.url || '/').split('?')[0];
    const url = ('/' + String(raw).replace(/^\/+/, '')).split('?')[0];

    const cfg = await effConfig();
    const user = userFromReq(req); // {u, r} | null

    /* ---- auth ---- */
    if (url === '/auth/me') return user ? send(res, 200, { user: user.u, role: user.r }) : send(res, 401, { error: 'nao logado' });
    if (url === '/auth/logout' && req.method === 'POST') return send(res, 200, { ok: true }, cookieClear);
    if (url === '/auth/login' && req.method === 'POST') {
      let d; try { d = JSON.parse(await getBody(req)); } catch (e) { return send(res, 400, { error: 'dados inválidos' }); }
      const u = await store.getUserByName(String(d.username || ''));
      if (!u || !core.verifyPw(u, String(d.password || ''))) return send(res, 401, { error: 'Usuário ou senha incorretos.' });
      const tok = core.signToken({ u: u.username, r: u.role, exp: Date.now() + SESS_MS }, SECRET);
      return send(res, 200, { ok: true, user: u.username }, cookieFor(tok));
    }
    if (url === '/auth/register' && req.method === 'POST') {
      let d; try { d = JSON.parse(await getBody(req)); } catch (e) { return send(res, 400, { error: 'dados inválidos' }); }
      const username = String(d.username || '').trim(), password = String(d.password || ''), code = String(d.code || '').trim();
      if (username.length < 3) return send(res, 400, { error: 'Usuário muito curto (mín. 3).' });
      if (password.length < 6) return send(res, 400, { error: 'Senha muito curta (mín. 6).' });
      if (code.toUpperCase() !== String(cfg.inviteCode).toUpperCase()) return send(res, 403, { error: 'Código de convite inválido.' });
      if (await store.getUserByName(username)) return send(res, 409, { error: 'Esse usuário já existe.' });
      const n = await store.countUsers();
      const u = core.makeUser(username, password, n === 0 ? 'admin' : 'user');
      await store.createUser(u);
      const tok = core.signToken({ u: u.username, r: u.role, exp: Date.now() + SESS_MS }, SECRET);
      return send(res, 200, { ok: true, user: u.username }, cookieFor(tok));
    }

    /* ---- daqui pra baixo exige login ---- */
    const protectedApi = url.startsWith('/api/') || ['/data', '/gemini-config', '/ig-config', '/ig-status'].includes(url);
    if (protectedApi && !user) return send(res, 401, { error: 'Faça login para usar.' });

    if (url === '/gemini-config' && req.method === 'POST') {
      try { const d = JSON.parse(await getBody(req) || '{}'); await store.setConfig({ geminiKey: String(d.key || '').trim(), geminiModel: d.model ? String(d.model).trim() : cfg.geminiModel }); const nc = await effConfig(); return send(res, 200, { saved: true, on: geminiOn(nc) }); }
      catch (e) { return send(res, 500, { error: String(e.message) }); }
    }
    if (url === '/ig-config' && req.method === 'POST') {
      try { const d = JSON.parse(await getBody(req) || '{}'); const patch = { igApiKey: String(d.key || '').trim() }; if (d.host) patch.igApiHost = String(d.host).trim(); if (d.path) patch.igApiPath = String(d.path).trim(); await store.setConfig(patch); const nc = await effConfig(); return send(res, 200, { saved: true, on: igOn(nc) }); }
      catch (e) { return send(res, 500, { error: String(e.message) }); }
    }
    if (url === '/ig-status') return send(res, 200, { on: igOn(cfg), gemini: geminiOn(cfg) });

    /* ---- sincronização de dados por usuário ---- */
    if (url === '/data') {
      if (req.method === 'GET') { let blob = {}; try { blob = await store.getData(user.u); } catch (e) {} return send(res, 200, blob || {}); }
      if (req.method === 'POST') { let blob; try { blob = JSON.parse(await getBody(req) || '{}'); } catch (e) { blob = {}; } try { await store.setData(user.u, blob); } catch (e) { return send(res, 500, { error: String(e.message) }); } return send(res, 200, { saved: true }); }
    }

    /* ---- IA / análise ---- */
    if (url.startsWith('/api/')) {
      if (url === '/api/profile-analysis' && req.method === 'POST') {
        let d; try { d = JSON.parse(await getBody(req) || '{}'); } catch (e) { return send(res, 400, { error: 'dados inválidos' }); }
        if (!geminiOn(cfg)) return send(res, 400, { error: 'Ligue a IA na nuvem (Gemini) primeiro.' });
        if (!igOn(cfg)) return send(res, 400, { error: 'Conecte a API de dados do Instagram (cole sua chave do RapidAPI em ⚙️).' });
        const handle = core.cleanHandle(d.handle); if (!handle) return send(res, 400, { error: 'Digite um @ válido.' });
        const r = await core.igFetchProfile({ key: cfg.igKey, host: cfg.igHost, path: cfg.igPath, method: cfg.igMethod, body: cfg.igBody }, handle);
        if (r.status === 401 || r.status === 403) return send(res, 502, { error: 'A API de dados recusou sua chave (HTTP ' + r.status + '). Confira/assine o plano grátis no RapidAPI.' });
        if (r.status === 429) return send(res, 502, { error: 'Você atingiu o limite grátis da API de dados. Aguarde renovar ou suba o plano.' });
        if (!r.json) return send(res, 502, { error: 'A API de dados não respondeu (HTTP ' + r.status + '). Tente de novo.' });
        const prof = core.normalizeProfile(r.json, handle);
        if (prof.followers == null && prof.posts == null && !prof.fullName) return send(res, 502, { error: 'Não consegui ler os dados de @' + handle + ' (talvez não exista, ou a API mudou o formato).' });
        const posts = core.extractPosts(r.json);
        let engagement = null; if (posts.length && prof.followers) { const avg = posts.reduce((s, p) => s + (p.likes || 0) + (p.comments || 0), 0) / posts.length; engagement = +(avg / prof.followers * 100).toFixed(2); }
        const out = await core.geminiGenerate(cfg.geminiKey, cfg.geminiModel, core.buildAuditMessages(prof, posts, engagement), { maxOutputTokens: 8000 });
        if (out.error) return send(res, 502, { error: out.error });
        return send(res, 200, { ok: true, result: core.profileHeader(prof, engagement) + '\n\n---\n\n' + out.text, profile: prof, engagement });
      }
      if (geminiOn(cfg)) {
        if (url === '/api/tags') return send(res, 200, { models: [{ name: cfg.geminiModel + ' (nuvem)' }] });
        if (url === '/api/chat' && req.method === 'POST') {
          let p; try { p = JSON.parse(await getBody(req) || '{}'); } catch (e) { return endNdjson(res, '⚠️ erro interno (json).'); }
          const out = await core.geminiGenerate(cfg.geminiKey, cfg.geminiModel, p.messages, p.options);
          return endNdjson(res, out.error || out.text);
        }
      }
      return send(res, 502, { error: 'IA na nuvem não configurada. Defina GEMINI_KEY nas variáveis do Vercel (ou ligue em ⚙️).' });
    }

    /* ---- painel (estático) ---- */
    if (url === '/' || url === '/index.html') return serveIndex(res);
    if (req.method === 'GET') return serveIndex(res); // SPA: qualquer GET serve o painel
    res.writeHead(404); res.end('not found');
  } catch (e) {
    try { send(res, 500, { error: 'erro no servidor: ' + (e && e.message) }); } catch (_) {}
  }
};
