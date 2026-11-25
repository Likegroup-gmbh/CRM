// Export: SharkNinja Creator-Engagements YTD -> XLSX (Tab je Marke) + CSVs
// Eingabe: exports/_raw.json (SQL-Abfrage, eine Zeile pro Kooperation)
// Aufruf:  node scripts/export-sharkninja.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'exports');
const STAND = '2026-11-11';
const MARKEN = ['Ninja', 'Shark Beauty', 'Shark Clean'];

const raw = JSON.parse(fs.readFileSync(path.join(OUT, '_raw.json'), 'utf8'));

const clean = (s) => (s ?? '').toString().replace(/\s+/g, ' ').trim();

// Handle aus URL oder Rohwert: instagram.com/<handle>/..., tiktok.com/@<handle>
function handleFrom(value) {
  let v = clean(value);
  if (!v) return '';
  v = v.replace(/^https?:\/\/(www\.)?/i, '').replace(/[?#].*$/, '');
  const m = v.match(/^(?:instagram\.com|tiktok\.com)\/(@?[^/]+)/i);
  if (m) v = m[1];
  v = v.replace(/^@/, '').replace(/\/+$/, '');
  return v ? '@' + v : '';
}

const VERTRAG = {
  entwurf: 'Draft',
  erstellt: 'Created',
  gesendet: 'Sent',
  unterschrieben: 'Signed',
  verzoegert: 'Delayed',
  verzögert: 'Delayed',
  abgelehnt: 'Rejected',
};
const vertrag = (s) =>
  clean(s)
    .split(',')
    .map((x) => clean(x))
    .filter(Boolean)
    .map((x) => VERTRAG[x.toLowerCase()] ?? x)
    .join(', ');

const toDate = (iso) => (iso ? new Date(iso + 'T00:00:00Z') : null);

const yearToDate = raw.filter((r) => r.start && r.start <= STAND);
const excluded = raw.length - yearToDate.length;

const rows = yearToDate.map((r) => {
  const ig = handleFrom(r.ig_username) || handleFrom(r.instagram);
  const tt = handleFrom(r.tiktok);
  const handle = ig || tt;
  const platform = ig ? 'Instagram' : tt ? 'TikTok' : '';
  const followers = ig ? r.instagram_follower : tt ? r.tiktok_follower : null;
  const name = clean(`${r.vorname ?? ''} ${r.nachname ?? ''}`) || clean(r.koop_name);
  const fee = r.fee === null || r.fee === undefined || r.fee === '' ? null : Number(r.fee);
  const zusatz = r.zusatz === null || r.zusatz === undefined || r.zusatz === '' ? null : Number(r.zusatz);
  const notes = [];
  if (fee === null) notes.push('Fee missing');
  if (!handle) notes.push('Handle missing');
  if (!r.creator_id) notes.push('No creator record');
  return {
    marke: r.marke,
    creatorId: r.creator_id,
    fee,
    row: {
      'Campaign Name': clean(r.kampagne),
      'Creator Name': name,
      'Creator Handle': handle,
      'Campaign Start Date': toDate(r.start),
      'Campaign End Date': toDate(r.deadline),
      Currency: 'EUR',
      'Fee/Rate': fee,
      Platform: platform,
      Brand: r.marke,
      Production: clean(r.produktion),
      'Campaign Type': Array.isArray(r.kampagnenart) ? r.kampagnenart.join(', ') : clean(r.kampagnenart),
      'Cooperation Status': clean(r.koop_status),
      Followers: followers ?? null,
      'Additional Costs': zusatz,
      'Contract Status': vertrag(r.vertrag_status),
      Note: notes.join('; '),
    },
  };
});

const COLS = Object.keys(rows[0].row);
const WIDTHS = [44, 28, 26, 14, 14, 9, 12, 11, 14, 44, 24, 18, 12, 14, 16, 28];

function sheetFor(list) {
  const ws = XLSX.utils.json_to_sheet(
    list.map((x) => x.row),
    { header: COLS, cellDates: true },
  );
  ws['!cols'] = WIDTHS.map((wch) => ({ wch }));
  ws['!autofilter'] = { ref: ws['!ref'] };
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = 1; R <= range.e.r; R++) {
    for (const [c, fmt] of [
      [3, 'yyyy-mm-dd'],
      [4, 'yyyy-mm-dd'],
      [6, '#,##0.00'],
      [12, '#,##0'],
      [13, '#,##0.00'],
    ]) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c })];
      if (cell) cell.z = fmt;
    }
  }
  return ws;
}

function csvFor(list) {
  const ws = XLSX.utils.json_to_sheet(
    list.map((x) => ({
      ...x.row,
      'Campaign Start Date': x.row['Campaign Start Date']?.toISOString().slice(0, 10) ?? '',
      'Campaign End Date': x.row['Campaign End Date']?.toISOString().slice(0, 10) ?? '',
    })),
    { header: COLS },
  );
  return '\uFEFF' + XLSX.utils.sheet_to_csv(ws);
}

const sum = (list) => list.reduce((s, x) => s + (x.fee ?? 0), 0);
const slug = (s) => s.toLowerCase().replace(/\s+/g, '-');

// Übersicht
const overviewHeader = ['Brand', 'Campaigns', 'Cooperations', 'Creators (distinct)', 'Total Fee (EUR, net)', 'Missing Fee', 'Missing Handle'];
const overview = [overviewHeader];
for (const m of MARKEN) {
  const l = rows.filter((x) => x.marke === m);
  overview.push([
    m,
    new Set(l.map((x) => x.row['Campaign Name'])).size,
    l.length,
    new Set(l.map((x) => x.creatorId).filter(Boolean)).size,
    sum(l),
    l.filter((x) => x.fee === null).length,
    l.filter((x) => !x.row['Creator Handle']).length,
  ]);
}
overview.push([
  'Total',
  new Set(rows.map((x) => x.row['Campaign Name'])).size,
  rows.length,
  new Set(rows.map((x) => x.creatorId).filter(Boolean)).size,
  sum(rows),
  rows.filter((x) => x.fee === null).length,
  rows.filter((x) => !x.row['Creator Handle']).length,
]);
overview.push(
  [],
  ['Notes'],
  ['Company: SharkNinja Germany GmbH'],
  [`Status: ${STAND}. YTD = campaign start between 2026-01-01 and ${STAND}.`],
  ['One row per cooperation (creator booking). A creator booked in several campaigns appears several times.'],
  ['Fee/Rate = agreed creator fee, net (purchase price). Currency is EUR (company is German, no currency field in the system).'],
  ['Additional Costs = creator-side extra costs (e.g. travel), not included in Fee/Rate.'],
);
const wsOv = XLSX.utils.aoa_to_sheet(overview);
wsOv['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 13 }, { wch: 15 }];
for (let R = 1; R <= MARKEN.length + 1; R++) {
  const cell = wsOv[XLSX.utils.encode_cell({ r: R, c: 4 })];
  if (cell) cell.z = '#,##0.00';
}

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, wsOv, 'Overview');
for (const m of MARKEN) {
  const l = rows.filter((x) => x.marke === m);
  XLSX.utils.book_append_sheet(wb, sheetFor(l), m);
  fs.writeFileSync(path.join(OUT, `${slug(m)}.csv`), csvFor(l));
}
fs.writeFileSync(path.join(OUT, 'alle.csv'), csvFor(rows));
XLSX.writeFile(wb, path.join(OUT, 'sharkninja-creator-engagements-ytd-2026.xlsx'), { cellDates: true });

console.log(JSON.stringify({ rowsTotal: raw.length, ytd: rows.length, excluded, overview: overview.slice(0, MARKEN.length + 2) }, null, 1));
