/* ============================================================
   PONTE NOTION — envia o calendário do Painel direto pro Notion
   Roda com Node 18+ (você tem o 24). Sem instalar nada.
   Use o "ABRIR TUDO (painel + notion).bat" para iniciar.
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');

const CFG_PATH = path.join(__dirname, 'notion-config.json');
let cfg = { token: '', databaseId: '', port: 3333 };
function loadCfg(){
  try { cfg = Object.assign({ token:'', databaseId:'', port:3333 }, JSON.parse(fs.readFileSync(CFG_PATH,'utf8'))); }
  catch(e){ console.log('[aviso] notion-config.json não encontrado ou inválido — preencha token e databaseId.'); }
}
loadCfg();

function cleanId(id){ return String(id||'').trim().replace(/^https?:\/\/.*?([0-9a-f]{32}).*/i,'$1').replace(/-/g,''); }
function configured(){ return cfg.token && cfg.databaseId && !/COLE_AQUI/.test(cfg.token) && !/COLE_AQUI/.test(cfg.databaseId); }

function cors(res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
}
function sendJson(res, code, obj){ cors(res); res.writeHead(code, {'Content-Type':'application/json'}); res.end(JSON.stringify(obj)); }

let titlePropCache = null;
async function notion(url, method, body){
  const r = await fetch('https://api.notion.com/v1/'+url, {
    method,
    headers: { 'Authorization':'Bearer '+cfg.token, 'Content-Type':'application/json', 'Notion-Version':'2022-06-28' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch(e){ data = { raw:text }; }
  if(!r.ok) throw new Error('Notion ' + r.status + ': ' + (data.message || text).slice(0,300));
  return data;
}

async function getTitleProp(){
  if(titlePropCache) return titlePropCache;
  const db = await notion('databases/'+cleanId(cfg.databaseId), 'GET');
  for(const [name, prop] of Object.entries(db.properties||{})){
    if(prop.type === 'title'){ titlePropCache = name; break; }
  }
  if(!titlePropCache) titlePropCache = 'Name';
  return titlePropCache;
}

async function createPage(item){
  const titleProp = await getTitleProp();
  const title = (item['Tema/Gancho'] || item['Tema'] || item['Tema/Gancho '] || item['Data'] || 'Conteúdo').toString().slice(0,200) || 'Conteúdo';
  const children = Object.entries(item)
    .filter(([k,v]) => v && String(v).trim())
    .map(([k,v]) => ({ object:'block', type:'bulleted_list_item',
      bulleted_list_item:{ rich_text:[{ type:'text', text:{ content:(k+': '+v).slice(0,1900) } }] } }));
  const properties = {}; properties[titleProp] = { title:[{ text:{ content:title } }] };
  return notion('pages', 'POST', { parent:{ database_id: cleanId(cfg.databaseId) }, properties, children });
}

const server = http.createServer((req, res) => {
  if(req.method === 'OPTIONS'){ cors(res); res.writeHead(204); res.end(); return; }
  if(req.method === 'GET' && req.url === '/health'){
    loadCfg();
    return sendJson(res, 200, { ok:true, configured: configured() });
  }
  if(req.method === 'POST' && req.url === '/notion'){
    let data = '';
    req.on('data', c => data += c);
    req.on('end', async () => {
      loadCfg(); titlePropCache = null;
      try{
        if(!configured()) return sendJson(res, 400, { error:'Preencha o "token" e o "databaseId" no arquivo notion-config.json e salve. Veja NOTION-COMO-CONECTAR.md' });
        const body = JSON.parse(data || '{}');
        const items = body.items || [];
        if(!items.length) return sendJson(res, 400, { error:'Nenhuma linha de calendário recebida.' });
        let created = 0; const errors = [];
        for(const it of items){ try { await createPage(it); created++; } catch(e){ errors.push(String(e.message)); } }
        return sendJson(res, 200, { created, total: items.length, errors });
      }catch(e){ return sendJson(res, 500, { error:String(e.message) }); }
    });
    return;
  }
  if(req.method === 'POST' && req.url === '/config'){
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => {
      try{
        const b = JSON.parse(data || '{}');
        const newCfg = { token:String(b.token||'').trim(), databaseId:String(b.databaseId||'').trim(), port: cfg.port||3333 };
        fs.writeFileSync(CFG_PATH, JSON.stringify(newCfg, null, 2));
        loadCfg(); titlePropCache = null;
        return sendJson(res, 200, { saved:true, configured: configured() });
      }catch(e){ return sendJson(res, 500, { error:String(e.message) }); }
    });
    return;
  }
  if(req.method === 'POST' && req.url === '/test'){
    loadCfg(); titlePropCache = null;
    (async () => {
      try{
        if(!configured()) return sendJson(res, 400, { error:'Faltam o token e o link da database. Preencha e salve primeiro.' });
        const name = await getTitleProp();
        return sendJson(res, 200, { ok:true, titleProp:name });
      }catch(e){ return sendJson(res, 500, { error:String(e.message) }); }
    })();
    return;
  }
  sendJson(res, 404, { error:'rota não encontrada' });
});

server.listen(cfg.port, () => {
  console.log('========================================================');
  console.log('  PONTE NOTION rodando em http://localhost:' + cfg.port);
  console.log('  Token: ' + (cfg.token ? 'OK' : 'FALTANDO') + ' | Database: ' + (cfg.databaseId ? 'OK' : 'FALTANDO'));
  console.log('  (Deixe esta janela aberta enquanto usar o painel.)');
  console.log('========================================================');
});
