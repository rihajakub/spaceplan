const { neon } = require('@neondatabase/serverless');
const { requireAccess } = require('../lib/auth');

function send(res, status, data) {
  res.status(status).json(data);
}

function database() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Databáze není nakonfigurovaná.');
  return neon(url);
}

async function prepare(sql) {
  await sql.query(`CREATE TABLE IF NOT EXISTS hub_records (
    type TEXT NOT NULL,
    id TEXT NOT NULL,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (type, id)
  )`);
}

module.exports = async (req, res) => {
  try {
    if (!requireAccess(req, res)) return;
    const sql = database();
    await prepare(sql);
    if (req.method === 'GET') {
      const type = String(req.query?.type || '');
      if (!type) return send(res, 400, { error: 'Chybí typ záznamu.' });
      const rows = await sql.query(
        'SELECT payload FROM hub_records WHERE type = $1 ORDER BY updated_at DESC',
        [type],
      );
      return send(res, 200, { records: rows.map((row) => row.payload) });
    }
    if (req.method === 'POST') {
      const { action, type, record, id } = req.body || {};
      if (!type || typeof type !== 'string') return send(res, 400, { error: 'Chybí typ záznamu.' });
      if (action === 'upsert') {
        if (!record || typeof record.id !== 'string' || !record.id) return send(res, 400, { error: 'Chybí platný záznam.' });
        await sql.query(
          'INSERT INTO hub_records (type, id, payload, updated_at) VALUES ($1, $2, $3::jsonb, NOW()) ON CONFLICT (type, id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()',
          [type, record.id, JSON.stringify(record)],
        );
        return send(res, 200, { record });
      }
      if (action === 'delete') {
        if (!id || typeof id !== 'string') return send(res, 400, { error: 'Chybí ID záznamu.' });
        await sql.query('DELETE FROM hub_records WHERE type = $1 AND id = $2', [type, id]);
        return send(res, 200, { id });
      }
      return send(res, 400, { error: 'Neznámá akce.' });
    }
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Nepodporovaná metoda.' });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: error.message || 'Záznam se nepodařilo uložit.' });
  }
};
