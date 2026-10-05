const { put } = require('@vercel/blob');

const types = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Nepodporovaná metoda.' });
  }
  try {
    const { dataUrl, name } = req.body || {};
    const match = typeof dataUrl === 'string' && dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Vyber JPG, PNG nebo WebP.' });
    const body = Buffer.from(match[2], 'base64');
    if (!body.length || body.length > 4 * 1024 * 1024) return res.status(400).json({ error: 'Obrázek může mít nejvýše 4 MB.' });
    const ext = types[match[1]];
    const safeName = String(name || 'nahled').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/\.[^.]+$/, '');
    const blob = await put(`content-plan/${crypto.randomUUID()}-${safeName}.${ext}`, body, {
      access: 'public',
      contentType: match[1],
      addRandomSuffix: false
    });
    return res.status(200).json({ url: blob.url });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Obrázek se nepodařilo uložit.' });
  }
};

module.exports.config = { api: { bodyParser: { sizeLimit: '6mb' } } };
