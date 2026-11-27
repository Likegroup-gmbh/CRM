// skriptPdfTabelle.js
// Skript-Tabelle im PDF: Hook, Hauptteil, CTA, Visuell, Rezept, Caption,
// Text-Hook und Hook-Varianten. Fett, Kursiv und Hervorhebung aus dem Editor
// bleiben erhalten (dieselbe Mini-Markdown-Grammatik wie GRID_MD).

import { stripNonWinAnsi } from '../../../core/pdf/pdfWinAnsi.js';
import { inlineMdRuns } from '../../../core/utils/inlineFormat.js';
import { highlightRgb } from '../../../core/utils/highlightFarben.js';
import {
  MARGIN_X,
  MAX_CONTENT_Y,
  CELL_PAD,
  RULE,
  HEADER_FILL,
  ascentMm,
  descentMm,
} from './skriptPdfLayout.js';
import { layoutRuns } from './skriptPdfBloecke.js';

const COLS = [{ w: 33 }, { w: 74.5 }, { w: 74.5 }];
const LINE = 4.2;
const ZELLE_PT = 9;
const LABEL_PT = 8;
const HEADER_TEXT = [92, 87, 98];
// Hervorhebung ja, Links bleiben Literal, wie die Skript-Tabelle im Editor.
const ZELLEN_MD = { hervorheben: true };
const ROWS = [
  ['HOOK', 'hook', 'hook_visuell'],
  ['HAUPTTEIL', 'hauptteil', 'hauptteil_visuell'],
  ['CTA', 'cta', 'cta_visuell'],
];
const ZUSATZ_ROWS = [
  ['REZEPT', 'rezept'],
  ['CAPTION', 'caption'],
];
const HOOK_VARIANTEN = [
  ['HOOK 1', 'hook_variante_1'],
  ['HOOK 2', 'hook_variante_2'],
  ['HOOK 3', 'hook_variante_3'],
];

function fontStil(run) {
  const bold = Boolean(run?.bold);
  if (bold && run.italic) return 'bolditalic';
  if (bold) return 'bold';
  return run?.italic ? 'italic' : 'normal';
}

function setzeRunFont(doc, run, pt) {
  doc.setFont(run?.code ? 'courier' : 'helvetica', fontStil(run));
  doc.setFontSize(pt);
}

function trimRuns(runs) {
  const copy = runs.map((run) => ({ ...run }));
  while (copy.length && !copy[0].text.trim()) copy.shift();
  while (copy.length && !copy[copy.length - 1].text.trim()) copy.pop();
  if (!copy.length) return [];
  if (copy.length === 1) {
    copy[0].text = copy[0].text.trim();
    return copy[0].text ? copy : [];
  }
  copy[0].text = copy[0].text.trimStart();
  copy[copy.length - 1].text = copy[copy.length - 1].text.trimEnd();
  return copy.filter((run) => run.text);
}

function vorbereiten(raw) {
  const runs = inlineMdRuns(raw, ZELLEN_MD).map((run) => ({
    ...run,
    text: stripNonWinAnsi(String(run.text ?? '')),
  }));
  return trimRuns(runs);
}

function hatText(raw) {
  return vorbereiten(raw).some((run) => run.text.trim());
}

function layoutZelle(doc, text, width) {
  const runs = vorbereiten(text);
  if (!runs.length) return [{ segs: [], w: 0 }];
  return layoutRuns(doc, runs, Math.max(8, width), { pt: ZELLE_PT });
}

function istLayout(lines) {
  return Boolean(lines?.[0]) && typeof lines[0] === 'object';
}

function zeichneLayout(doc, zeilen, x, y) {
  const baseline0 = y + CELL_PAD + ascentMm(ZELLE_PT);
  const highlightH = LINE - 0.6;
  zeilen.forEach((zeile, li) => {
    const baseline = baseline0 + li * LINE;
    let cx = x + CELL_PAD;
    for (const seg of zeile.segs || []) {
      const run = seg.run || {};
      if (run.highlight) {
        doc.setFillColor(...highlightRgb(run.highlight));
        doc.rect(cx, baseline - ascentMm(ZELLE_PT) - 0.15, seg.w, highlightH, 'F');
      }
      setzeRunFont(doc, run, ZELLE_PT);
      doc.setTextColor(0);
      if (String(seg.text || '').trim()) doc.text(seg.text, cx, baseline);
      cx += seg.w;
    }
  });
}

function drawHeader(doc, y, newPage) {
  const pt = 8;
  const h = CELL_PAD + ascentMm(pt) + descentMm(pt) + CELL_PAD;
  if (y + h > MAX_CONTENT_Y) y = newPage();
  doc.setFillColor(...HEADER_FILL);
  doc.setDrawColor(...RULE);
  if (typeof doc.setLineWidth === 'function') doc.setLineWidth(0.2);
  let x = MARGIN_X;
  COLS.forEach((col) => {
    doc.rect(x, y, col.w, h, 'FD');
    x += col.w;
  });
  const headers = ['WAS GESAGT WIRD', 'WAS ZU SEHEN IST'];
  const baseline = y + CELL_PAD + ascentMm(pt);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(pt);
  doc.setTextColor(...HEADER_TEXT);
  doc.text(headers[0], MARGIN_X + COLS[0].w + CELL_PAD, baseline);
  doc.text(headers[1], MARGIN_X + COLS[0].w + COLS[1].w + CELL_PAD, baseline);
  doc.setTextColor(0);
  return y + h;
}

function drawRow(doc, y, h, cells, widths = COLS.map((col) => col.w)) {
  doc.setDrawColor(...RULE);
  if (typeof doc.setLineWidth === 'function') doc.setLineWidth(0.2);
  let x = MARGIN_X;
  cells.forEach((lines, i) => {
    const breite = widths[i];
    doc.rect(x, y, breite, h);
    if (istLayout(lines)) {
      zeichneLayout(doc, lines, x, y);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(LABEL_PT);
      doc.setTextColor(0);
      const baseline = y + CELL_PAD + ascentMm(ZELLE_PT);
      lines.forEach((line, li) => {
        if (line) doc.text(line, x + CELL_PAD, baseline + li * LINE);
      });
    }
    x += breite;
  });
}

function rowHeight(lineCount) {
  return CELL_PAD + ascentMm(ZELLE_PT) + (Math.max(lineCount, 1) - 1) * LINE + descentMm(ZELLE_PT) + CELL_PAD;
}

/** Text-Hook steht oben in der Hook-Zelle "Was zu sehen ist", Formatierung bleibt. */
function gesehenRoh(item, gesehenKey) {
  if (gesehenKey !== 'hook_visuell' || !hatText(item.text_hook)) return item[gesehenKey] || '';
  const hook = String(item.text_hook ?? '').trim();
  const vis = String(item[gesehenKey] ?? '').trim();
  return vis ? `TEXT-HOOK: ${hook}\n\n${vis}` : `TEXT-HOOK: ${hook}`;
}

/** Rezept/Caption: eine Zelle ueber beide Inhaltsspalten, bricht ueber Seiten um. */
function drawZusatzRow(doc, y, label, text, newPage) {
  const widths = [COLS[0].w, COLS[1].w + COLS[2].w];
  const lines = layoutZelle(doc, text, widths[1] - CELL_PAD * 2);
  let rest = lines;
  let first = true;
  let cursor = y;
  while (rest.length) {
    const maxLines = Math.floor((MAX_CONTENT_Y - cursor - rowHeight(1)) / LINE) + 1;
    if (maxLines < 2 && rest.length > 1) {
      cursor = newPage();
      continue;
    }
    const chunk = rest.slice(0, Math.max(maxLines, 1));
    rest = rest.slice(chunk.length);
    const h = rowHeight(chunk.length);
    drawRow(doc, cursor, h, [first ? [label] : [''], chunk], widths);
    cursor += h;
    first = false;
    if (rest.length) cursor = newPage();
  }
  return cursor;
}

/** Zweite Tabelle, nur gesprochen. Leere Slots fallen weg. */
function drawHookVarianten(doc, item, y, newPage) {
  const rows = HOOK_VARIANTEN.filter(([, key]) => hatText(item[key]));
  if (!rows.length) return y;
  const titlePt = 11;
  const titleH = ascentMm(titlePt) + descentMm(titlePt);
  y += 5;
  if (y + titleH + rowHeight(2) > MAX_CONTENT_Y) y = newPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(titlePt);
  doc.setTextColor(0);
  doc.text('Hook-Varianten', MARGIN_X, y + ascentMm(titlePt));
  y += titleH + 2;

  const pt = 8;
  const headerH = CELL_PAD + ascentMm(pt) + descentMm(pt) + CELL_PAD;
  if (y + headerH > MAX_CONTENT_Y) y = newPage();
  const widths = [COLS[0].w, COLS[1].w + COLS[2].w];
  doc.setFillColor(...HEADER_FILL);
  doc.setDrawColor(...RULE);
  if (typeof doc.setLineWidth === 'function') doc.setLineWidth(0.2);
  let x = MARGIN_X;
  widths.forEach((w) => {
    doc.rect(x, y, w, headerH, 'FD');
    x += w;
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(pt);
  doc.setTextColor(...HEADER_TEXT);
  doc.text('WAS GESAGT WIRD', MARGIN_X + widths[0] + CELL_PAD, y + CELL_PAD + ascentMm(pt));
  doc.setTextColor(0);
  y += headerH;

  for (const [label, key] of rows) {
    y = drawZusatzRow(doc, y, label, item[key], newPage);
  }
  return y;
}

export function drawTable(doc, item, startY, newPage) {
  let y = drawHeader(doc, startY, newPage);
  for (const [label, gesagtKey, gesehenKey] of ROWS) {
    const inner = (col) => col.w - CELL_PAD * 2;
    const gesagt = layoutZelle(doc, item[gesagtKey], inner(COLS[1]));
    const gesehen = layoutZelle(doc, gesehenRoh(item, gesehenKey), inner(COLS[2]));
    const cells = [[label], gesagt, gesehen];
    const lines = Math.max(gesagt.length, gesehen.length, 1);
    const h = rowHeight(lines);
    if (y + h > MAX_CONTENT_Y) {
      y = newPage();
      y = drawHeader(doc, y, newPage);
    }
    drawRow(doc, y, h, cells);
    y += h;
  }
  for (const [label, key] of ZUSATZ_ROWS) {
    if (!hatText(item[key])) continue;
    y = drawZusatzRow(doc, y, label, item[key], newPage);
  }
  return drawHookVarianten(doc, item, y, newPage);
}
