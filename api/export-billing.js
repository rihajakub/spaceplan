const XLSX = require("xlsx-js-style");
const { neon } = require("@neondatabase/serverless");
const { requireAccess } = require("../lib/auth");

const months = [
  "leden",
  "únor",
  "březen",
  "duben",
  "květen",
  "červen",
  "červenec",
  "srpen",
  "září",
  "říjen",
  "listopad",
  "prosinec",
];

const sum = (values) =>
  values.reduce((total, value) => total + Number(value || 0), 0);

module.exports = async (req, res) => {
  try {
    if (!requireAccess(req, res)) return;
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!url) throw new Error("Databáze není nakonfigurovaná.");
    const year = String(req.query?.year || "2026");
    if (!/^\d{4}$/.test(year)) throw new Error("Neplatný rok.");

    const sql = neon(url);
    const rows = await sql.query(
      "SELECT payload FROM hub_records WHERE type = $1 AND id = $2",
      ["billing", year],
    );
    if (!rows.length) {
      return res
        .status(404)
        .json({ error: "Vyúčtování pro tento rok neexistuje." });
    }

    const item = rows[0].payload;
    const invested = months.map((_, monthIndex) =>
      sum(item.channels.map((channel) => channel.values[monthIndex])),
    );
    const difference = item.plan.map(
      (value, index) => Number(value || 0) - invested[index],
    );
    const withTotal = (label, values) => [label, ...values, sum(values)];
    const data = [
      [Number(year), ...months, "Celkem"],
      ["Kampaně", ...Array(13).fill(null)],
      withTotal("Plán dle podepsaného mediaplánu", item.plan),
      withTotal("Ponížení", item.reductions),
      withTotal("Fakturace realita", item.invoices),
      withTotal("Investovaný kredit", invested),
      ...item.channels.map((channel) =>
        withTotal(channel.name, channel.values),
      ),
      withTotal("Rozdíl", difference),
    ];

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(data);
    sheet["!merges"] = [XLSX.utils.decode_range("A2:N2")];
    sheet["!cols"] = [
      { wch: 34 },
      ...months.map(() => ({ wch: 13 })),
      { wch: 17 },
    ];
    sheet["!rows"] = [
      { hpt: 24 },
      { hpt: 23 },
      ...Array(data.length - 2).fill({ hpt: 22 }),
    ];

    const border = {
      top: { style: "thin", color: { rgb: "B9C0CB" } },
      bottom: { style: "thin", color: { rgb: "B9C0CB" } },
      left: { style: "thin", color: { rgb: "B9C0CB" } },
      right: { style: "thin", color: { rgb: "B9C0CB" } },
    };
    const fills = {
      header: { patternType: "solid", fgColor: { rgb: "F0F2F5" } },
      group: { patternType: "solid", fgColor: { rgb: "1D222B" } },
      plan: { patternType: "solid", fgColor: { rgb: "DFE9F7" } },
      total: { patternType: "solid", fgColor: { rgb: "DBE9BC" } },
      white: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
    };
    const lastRow = data.length - 1;
    for (let row = 0; row < data.length; row += 1) {
      for (let col = 0; col < 14; col += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: col });
        if (!sheet[address]) sheet[address] = { t: "s", v: "" };
        const isNumber = col > 0 && row > 1;
        sheet[address].s = {
          font: {
            name: "Arial",
            sz: 10,
            bold:
              row === 0 ||
              row === 1 ||
              row === 5 ||
              row === lastRow ||
              col === 0,
            color: {
              rgb: row === 1 ? "FFFFFF" : row === lastRow ? "008F57" : "171B22",
            },
          },
          fill:
            row === 0
              ? fills.header
              : row === 1
                ? fills.group
                : row >= 2 && row <= 4
                  ? fills.plan
                  : row === 5
                    ? fills.total
                    : fills.white,
          border,
          alignment: {
            horizontal: col === 0 ? "left" : "right",
            vertical: "center",
          },
          numFmt: isNumber ? '#,##0.00 "Kč"' : "General",
        };
      }
    }
    sheet["!autofilter"] = { ref: "A1:N1" };
    XLSX.utils.book_append_sheet(workbook, sheet, `Vyúčtování ${year}`);

    const output = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="spaceplan-vyuctovani-${year}.xlsx"`,
    );
    return res.status(200).send(output);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: error.message || "Export se nepodařil." });
  }
};
