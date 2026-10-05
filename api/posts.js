const { neon } = require('@neondatabase/serverless');

function send(res, status, data) {
  res.status(status).json(data);
}

function database() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Databáze není nakonfigurovaná. Přidej POSTGRES_URL ve Vercelu.');
  return neon(url);
}

async function prepare(sql) {
  await sql.query(`CREATE TABLE IF NOT EXISTS content_posts (
    id TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}

function validPost(post) {
  return post && typeof post.id === 'string' && typeof post.title === 'string' &&
    post.title.trim() && /^\d{4}-\d{2}-\d{2}$/.test(post.date || '') &&
    /^\d{2}:\d{2}$/.test(post.time || '') && Array.isArray(post.channels) && post.channels.length;
}

module.exports = async (req, res) => {
  try {
    const sql = database();
    await prepare(sql);

    if (req.method === 'GET') {
      const rows = await sql.query('SELECT payload FROM content_posts ORDER BY payload->>\'date\', payload->>\'time\', payload->>\'title\'');
      return send(res, 200, { posts: rows.map(row => row.payload) });
    }

    if (req.method === 'POST') {
      const { action, post, id } = req.body || {};
      if (action === 'upsert') {
        if (!validPost(post)) return send(res, 400, { error: 'Neplatná data příspěvku.' });
        await sql.query(
          'INSERT INTO content_posts (id, payload, updated_at) VALUES ($1, $2::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()',
          [post.id, JSON.stringify(post)]
        );
        return send(res, 200, { post });
      }
      if (action === 'delete') {
        if (typeof id !== 'string' || !id) return send(res, 400, { error: 'Chybí ID příspěvku.' });
        await sql.query('DELETE FROM content_posts WHERE id = $1', [id]);
        return send(res, 200, { id });
      }
      return send(res, 400, { error: 'Neznámá akce.' });
    }

    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Nepodporovaná metoda.' });
  } catch (error) {
    console.error(error);
    return send(res, 500, { error: error.message || 'Data se nepodařilo načíst nebo uložit.' });
  }
};
