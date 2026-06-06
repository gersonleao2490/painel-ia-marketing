/* ============================================================================
   NÚCLEO COMPARTILHADO (puro, sem arquivos/sem estado global)
   Usado pela versão na NUVEM (api/index.js → Vercel + Neon).
   Funções puras: senha, token de sessão (sem estado), Gemini, análise de @.
   ============================================================================ */
const crypto = require('crypto');
const https = require('https');

/* ---------- senhas (scrypt) ---------- */
function hashPw(pw, salt) { return crypto.scryptSync(pw, salt, 64).toString('hex'); }
function makeUser(username, password, role) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { username, salt, hash: hashPw(password, salt), role: role || 'user', created: Date.now() };
}
function verifyPw(user, pw) {
  if (!user || !user.salt || !user.hash) return false;
  const h = Buffer.from(hashPw(pw, user.salt), 'hex');
  const stored = Buffer.from(user.hash, 'hex');
  return h.length === stored.length && crypto.timingSafeEqual(h, stored);
}

/* ---------- sessão SEM ESTADO (token assinado por HMAC) ----------
   Não precisa de banco para validar a sessão (ideal pra serverless). */
function signToken(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return body + '.' + sig;
}
function verifyToken(tok, secret) {
  if (!tok) return null;
  const i = tok.lastIndexOf('.'); if (i < 1) return null;
  const body = tok.slice(0, i), sig = tok.slice(i + 1);
  const expSig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  let a, b; try { a = Buffer.from(sig); b = Buffer.from(expSig); } catch (e) { return null; }
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p; try { p = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch (e) { return null; }
  if (!p || !p.exp || p.exp < Date.now()) return null;
  return p;
}

/* ---------- Gemini (Promise: resolve {text} ou {error}) ---------- */
function _geminiOnce(key, model, messages, options) {
  return new Promise(resolve => {
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
    const r = https.request({ hostname: 'generativelanguage.googleapis.com', path: '/v1beta/models/' + (model || 'gemini-2.5-flash') + ':generateContent?key=' + encodeURIComponent(key), method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      gres => {
        let body = ''; gres.on('data', c => body += c); gres.on('end', () => {
          try {
            const j = JSON.parse(body);
            if (gres.statusCode !== 200 || j.error) {
              const msg = (j.error && j.error.message) || ('HTTP ' + gres.statusCode);
              return resolve({ error: '⚠️ IA na nuvem recusou: ' + msg + ' — confira a chave do Gemini.', retryable: gres.statusCode === 503 || gres.statusCode === 429 || /high demand|overloaded|unavailable|try again|temporar/i.test(msg) });
            }
            const c0 = j.candidates && j.candidates[0];
            let text = (c0 && c0.content && c0.content.parts && c0.content.parts.map(p => p.text || '').join('')) || '';
            if (!text && c0 && c0.finishReason === 'SAFETY') text = '(a IA na nuvem bloqueou esta resposta por política de segurança — tente reformular)';
            resolve({ text: text || '(sem resposta da IA na nuvem)' });
          } catch (e) { resolve({ error: '⚠️ erro lendo a resposta da IA na nuvem.', retryable: true }); }
        });
      });
    r.on('error', e => resolve({ error: '⚠️ não consegui falar com a IA na nuvem: ' + e.message, retryable: true }));
    r.write(data); r.end();
  });
}
// Tenta de novo automaticamente quando o Gemini está sobrecarregado (pico de uso).
async function geminiGenerate(key, model, messages, options) {
  let last;
  for (let i = 0; i < 3; i++) {
    last = await _geminiOnce(key, model, messages, options);
    if (last.text || !last.retryable) return last;
    await new Promise(z => setTimeout(z, 1200 * (i + 1)));
  }
  return { error: '⚠️ A IA na nuvem está sobrecarregada agora (pico de uso do Google). Tente de novo em alguns segundos.' };
}

/* ---------- Análise de Perfil (Instagram via API de dados) ---------- */
function cleanHandle(h) { return String(h || '').trim().replace(/.*instagram\.com\//i, '').replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, '').slice(0, 60); }
function num(v) { if (v == null) return null; const n = Number(String(v).replace(/[^\d.]/g, '')); return isFinite(n) ? n : null; }
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
function igFetchProfile(igCfg, handle) {
  return new Promise(resolve => {
    // Padrão = Instagram120 (POST com {"username":"..."} em /api/instagram/profile).
    // Suporta também provedores GET (ex: instagram-scraper-api2) via igCfg.method='GET'.
    const host = igCfg.host || 'instagram120.p.rapidapi.com';
    const method = (igCfg.method || 'POST').toUpperCase();
    const p = String(igCfg.path || '/api/instagram/profile').replace('{handle}', encodeURIComponent(handle));
    const headers = { 'x-rapidapi-key': igCfg.key, 'x-rapidapi-host': host };
    let data = null;
    if (method === 'POST') { data = String(igCfg.body || '{"username":"{handle}"}').replace('{handle}', handle); headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(data); }
    const r = https.request({ hostname: host, path: p, method, headers },
      gres => { let body = ''; gres.on('data', c => body += c); gres.on('end', () => { let j = null; try { j = JSON.parse(body); } catch (e) {} resolve({ status: gres.statusCode, json: j }); }); });
    r.on('error', () => resolve({ status: 0, json: null }));
    if (data) r.write(data);
    r.end();
  });
}
function buildAuditMessages(prof, posts, engagement) {
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
    posts && posts.length ? 'Últimos posts (curtidas/comentários): ' + posts.map(p => p.likes + '/' + (p.comments != null ? p.comments : '?')).join(', ') : null
  ].filter(Boolean).join('\n');
  const sys = 'Você é a Diretora Sênior de Marketing e Growth de Instagram — auditora de perfis mais específica e acionável que o Not Just Analytics. Responda em PT-BR, direta, sem encheção, com números e ações concretas (nada genérico). Use markdown com seções e tabelas quando útil.';
  const user = 'Faça uma AUDITORIA ESTRATÉGICA COMPLETA deste perfil do Instagram, com base nos dados REAIS abaixo:\n\n' + facts + '\n\nEstruture assim:\n1) 📊 **Diagnóstico** — leia os números sem rodeios: o engajamento é bom ou ruim para esse tamanho? A proporção seguindo/seguidores diz o quê? Compare com benchmarks reais do nicho.\n2) ✅ **O que já está bom** (específico).\n3) ⚠️ **O que está travando o crescimento** (específico, com o porquê).\n4) ✍️ **Bio otimizada** — reescreva a bio com proposta de valor clara + CTA (dê 2 opções).\n5) 📅 **Plano de conteúdo de 30 dias** — em TABELA (Semana | Foco | Formatos | Meta).\n6) 🔑 **Hashtags e melhores horários** para o nicho.\n7) 🚀 **3 ações para ESTA SEMANA** que destravam engajamento.\nSe faltar algum dado, estime pelo nicho e marque como estimativa.';
  return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}
function profileHeader(prof, engagement) {
  const fmt = n => n == null ? '?' : Number(n).toLocaleString('pt-BR');
  let h = '## 🔍 Análise de @' + prof.username + (prof.verified ? ' ✔️' : '') + '\n';
  if (prof.fullName) h += '**' + prof.fullName + '**' + (prof.category ? (' · ' + prof.category) : '') + '\n\n';
  h += '👥 **' + fmt(prof.followers) + '** seguidores · ➡️ ' + fmt(prof.following) + ' seguindo · 🖼️ ' + fmt(prof.posts) + ' posts';
  if (engagement != null) h += ' · 💛 **' + engagement + '%** engajamento';
  if (prof.bio) h += '\n\n> ' + prof.bio.replace(/\s*\n\s*/g, ' ');
  if (prof.externalUrl) h += '\n\n🔗 ' + prof.externalUrl;
  return h;
}

module.exports = { hashPw, makeUser, verifyPw, signToken, verifyToken, geminiGenerate, cleanHandle, num, dig, normalizeProfile, extractPosts, igFetchProfile, buildAuditMessages, profileHeader };
