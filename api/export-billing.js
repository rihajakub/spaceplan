const XLSX = require('xlsx');
const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  try {
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!url) throw new Error('Databáze není nakonfigurovaná.');
    const month = String(req.query?.month || '');
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Neplatný měsíc.');
    const sql = neon(url);
    const rows = await sql.query('SELECT payload FROM hub_records WHERE type = $1 AND id = $2', ['billing', month]);
    if (!rows.length) return res.status(404).json({ error: 'Vyúčtování pro tento měsíc neexistuje.' });
    const item = rows[0].payload;
    const data = [
      ['Vyúčtování SPACE PLAN', item.month],
      [],
      ['Médium', 'Plán (Kč)', 'Realita (Kč)', 'Rozdíl (Kč)'],
      ...item.media.map((row) => [row.name, row.plan || 0, row.actual || 0, (row.plan || 0) - (row.actual || 0)]),
      ['Celkem', item.planTotal || 0, item.actualTotal || 0, (item.planTotal || 0) - (item.actualTotal || 0)],
    ];
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(data);
    sheet['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(workbook, sheet, 'Vyúčtování');
    const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="spaceplan-vyuctovani-${month}.xlsx"`);
    return res.status(200).send(output);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Export se nepodařil.' });
  }
};
