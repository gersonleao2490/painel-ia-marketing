/* ============================================================================
   ARMAZENAMENTO NA NUVEM — Neon (Postgres serverless)
   Cria as tabelas sozinho na 1ª vez. Guarda: usuários, dados sincronizados
   por usuário e a config (chaves do Gemini / API de dados).
   Precisa da variável de ambiente DATABASE_URL (string de conexão do Neon).
   ============================================================================ */
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

let inited = null;
function init() {
  if (inited) return inited;
  inited = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS users (
      username text PRIMARY KEY,
      lower_username text UNIQUE,
      salt text, hash text, role text, created bigint)`;
    await sql`CREATE TABLE IF NOT EXISTS user_data (
      username text PRIMARY KEY,
      blob jsonb)`;
    await sql`CREATE TABLE IF NOT EXISTS config (
      id int PRIMARY KEY,
      data jsonb)`;
  })();
  return inited;
}

async function getUserByName(name) {
  await init();
  const rows = await sql`SELECT username, salt, hash, role, created FROM users WHERE lower_username = ${String(name).toLowerCase()} LIMIT 1`;
  return rows[0] || null;
}
async function countUsers() {
  await init();
  const rows = await sql`SELECT count(*)::int AS n FROM users`;
  return rows[0] ? rows[0].n : 0;
}
async function createUser(u) {
  await init();
  await sql`INSERT INTO users (username, lower_username, salt, hash, role, created)
            VALUES (${u.username}, ${u.username.toLowerCase()}, ${u.salt}, ${u.hash}, ${u.role}, ${u.created})`;
  return u;
}
async function getData(username) {
  await init();
  const rows = await sql`SELECT blob FROM user_data WHERE username = ${username} LIMIT 1`;
  return rows[0] ? rows[0].blob : {};
}
async function setData(username, blob) {
  await init();
  const j = JSON.stringify(blob || {});
  await sql`INSERT INTO user_data (username, blob) VALUES (${username}, ${j}::jsonb)
            ON CONFLICT (username) DO UPDATE SET blob = ${j}::jsonb`;
}
async function getConfig() {
  await init();
  const rows = await sql`SELECT data FROM config WHERE id = 1 LIMIT 1`;
  return (rows[0] && rows[0].data) || {};
}
async function setConfig(partial) {
  await init();
  const cur = await getConfig();
  const merged = Object.assign({}, cur, partial);
  const j = JSON.stringify(merged);
  await sql`INSERT INTO config (id, data) VALUES (1, ${j}::jsonb)
            ON CONFLICT (id) DO UPDATE SET data = ${j}::jsonb`;
  return merged;
}

module.exports = { getUserByName, countUsers, createUser, getData, setData, getConfig, setConfig };
