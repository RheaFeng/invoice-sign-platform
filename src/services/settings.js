const { knex } = require('../db');

async function getAll() {
  const rows = await knex('settings').select('key', 'value');
  const map = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

async function get(key, def) {
  const row = await knex('settings').where('key', key).first();
  return row ? row.value : (def ?? '');
}

async function set(key, value) {
  await knex('settings')
    .insert({ key, value, updated_at: knex.fn.now() })
    .onConflict('key')
    .merge({ value, updated_at: knex.fn.now() });
}

async function setMany(obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) await set(k, v);
  }
}

module.exports = { getAll, get, set, setMany };
