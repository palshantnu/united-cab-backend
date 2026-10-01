const { Op } = require('sequelize');

// Reads ?from=YYYY-MM-DD&to=YYYY-MM-DD. Defaults to the last 30 days.
function getDateRange(query, defaultDays = 30) {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - (defaultDays - 1) * 86400000);
  if (isNaN(from) || isNaN(to)) return getDateRange({}, defaultDays);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return {
    from,
    to,
    where: { [Op.between]: [from, to] },
    fromStr: toYmd(from),
    toStr: toYmd(to),
  };
}

function toYmd(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Every day between from and to, as YYYY-MM-DD (used as chart x-axis)
function dayList(from, to) {
  const days = [];
  const cur = new Date(from);
  while (cur <= to) {
    days.push(toYmd(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function money(n) {
  return Number((parseFloat(n) || 0).toFixed(2));
}

// rows: array of plain objects; columns: [{ key, label }]
function sendCsv(res, filename, columns, rows) {
  const esc = v => {
    if (v === null || v === undefined) return '';
    const s = v instanceof Date ? v.toISOString() : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map(c => esc(c.label)).join(',')];
  rows.forEach(r => lines.push(columns.map(c => esc(r[c.key])).join(',')));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('﻿' + lines.join('\n'));
}

module.exports = { getDateRange, dayList, toYmd, money, sendCsv };
