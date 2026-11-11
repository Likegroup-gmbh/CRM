// SkriptPdf.js
// Anschreiben-PDF nach der LikeBase-Vorlage, schwarz/weiss:
// Lockup, Marke × Creator, Titel, Creator-Karte, dann Hook / Hauptteil / CTA.
// Hook-Varianten folgen der Tabelle, wenn das Item sie mitbringt.
// Mit Skript-Dokument (ADR 0062) stehen die sichtbaren Freien Bloecke davor
// und danach; item.dokument_bloecke kommt bereits ohne interne Bloecke.
// Teile in ./pdf: Layout (Masse, Farben), Social (Creator, Links), Bloecke.

import { loadCustomerLogoPng, toPdfImageDataUrl } from '../../core/pdf/pdfImage.js';
import { loadJsPdf } from '../../core/pdf/loadJsPdf.js';
import {
  loadLikeGroupLogoPng,
  drawLikeGroupFooter,
  containInBox,
  LIKEGROUP_LOGO_PX,
  PDF_BRAND,
} from '../../core/pdf/PdfBrand.js';
import { stripNonWinAnsi } from '../../core/pdf/pdfWinAnsi.js';
import {
  MARGIN_X,
  TABLE_W,
  MAX_CONTENT_Y,
  CELL_PAD,
  RULE,
  HEADER_FILL,
  MUTED,
  ascentMm,
  descentMm,
  httpUrl,
} from './pdf/skriptPdfLayout.js';
import { socialKarteLinks } from './pdf/skriptPdfSocial.js';
import { drawFreierBlock } from './pdf/skriptPdfBloecke.js';

export { creatorFuerAnschreiben, instagramZeile } from './pdf/skriptPdfSocial.js';
export { layoutRuns } from './pdf/skriptPdfBloecke.js';

const COLS = [{ w: 33 }, { w: 74.5 }, { w: 74.5 }];
const CREATOR_SIZE = 12;
const CARD_H = 16;
const LINE = 4.2;
const LOCKUP_SCALE = 0.85;
const LOCKUP_GAP = 6;
const LOCKUP_GAP_AFTER_X = 8;
const HEADER_TEXT = [92, 87, 98];
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

export function sanitizeSkriptFilename(name) {
  const base = String(name || 'Skript')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `${base || 'Skript'}.pdf`;
}

function uniquePdfName(titel, used) {
  const base = sanitizeSkriptFilename(titel);
  const n = used.get(base) || 0;
  used.set(base, n + 1);
  if (!n) return base;
  return base.replace(/\.pdf$/i, `-${n + 1}.pdf`);
}

function plain(text) {
  return stripNonWinAnsi(String(text ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]*)\]\((?:https?:\/\/|mailto:)[^)\s]*\)/gi, '$1')
    .replace(/==\{[a-z]{1,16}\}/g, '')
    .replace(/==/g, '')
    .replace(/[*_]{1,3}/g, ''))
    .trim();
}

function linesOf(doc, text, width) {
  const value = plain(text);
  if (!value) return [''];
  const lines = doc.splitTextToSize(value, Math.max(8, width));
  return lines?.length ? lines : [''];
}

function headlineOf(item) {
  const brand = [item.customerName, item.produktName].map((part) => plain(part)).filter(Boolean).join(' ');
  const creator = plain(item.creator?.name);
  if (brand && creator) return `${brand} × ${creator} –`;
  return brand;
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
    doc.rect(x, y, widths[i], h);
    if (i === 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(0);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(0);
    }
    const baseline = y + CELL_PAD + ascentMm(9);
    lines.forEach((line, li) => {
      if (line) doc.text(line, x + CELL_PAD, baseline + li * LINE);
    });
    x += widths[i];
  });
}

function rowHeight(lineCount) {
  return CELL_PAD + ascentMm(9) + (Math.max(lineCount, 1) - 1) * LINE + descentMm(9) + CELL_PAD;
}

/** Text-Hook steht im Dokument oben in der Hook-Zelle "Was zu sehen ist". */
function gesehenText(item, gesehenKey) {
  const textHook = plain(item.text_hook);
  if (gesehenKey !== 'hook_visuell' || !textHook) return item[gesehenKey];
  return `TEXT-HOOK: ${textHook}\n\n${item[gesehenKey] || ''}`.trim();
}

/** Rezept/Caption: eine Zelle ueber beide Inhaltsspalten, bricht ueber Seiten um. */
function drawZusatzRow(doc, y, label, text, newPage) {
  const widths = [COLS[0].w, COLS[1].w + COLS[2].w];
  const lines = linesOf(doc, text, widths[1] - CELL_PAD * 2);
  let rest = lines;
  let first = true;
  let cursor = y;
  while (rest.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
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
  const rows = HOOK_VARIANTEN.filter(([, key]) => plain(item[key]));
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

function drawTable(doc, item, startY, newPage) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let y = drawHeader(doc, startY, newPage);
  for (const [label, gesagtKey, gesehenKey] of ROWS) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const inner = (col) => col.w - CELL_PAD * 2;
    const gesagt = linesOf(doc, item[gesagtKey], inner(COLS[1]));
    const gesehen = linesOf(doc, gesehenText(item, gesehenKey), inner(COLS[2]));
    const cells = [[label], gesagt, gesehen];
    const lines = Math.max(gesagt.length, gesehen.length, 1);
    const h = CELL_PAD + ascentMm(9) + (lines - 1) * LINE + descentMm(9) + CELL_PAD;
    if (y + h > MAX_CONTENT_Y) {
      y = newPage();
      y = drawHeader(doc, y, newPage);
    }
    drawRow(doc, y, h, cells);
    y += h;
  }
  for (const [label, key] of ZUSATZ_ROWS) {
    if (!plain(item[key])) continue;
    y = drawZusatzRow(doc, y, label, item[key], newPage);
  }
  return drawHookVarianten(doc, item, y, newPage);
}

function placeImage(doc, dataUrl, x, y, w, h) {
  if (!dataUrl || !doc.addImage) return false;
  try {
    doc.addImage(dataUrl, 'JPEG', x, y, w, h, undefined, 'FAST');
    return true;
  } catch (err) {
    console.warn('Creator-Bild übersprungen:', err);
    return false;
  }
}

function drawSkriptLockup(doc, likeGroupPng, customerImage, customerName) {
  const box = PDF_BRAND.logoLeft;
  const slotW = box.w * LOCKUP_SCALE;
  const slotH = box.h * LOCKUP_SCALE;
  if (likeGroupPng && doc.addImage) {
    const fitted = containInBox(LIKEGROUP_LOGO_PX.w, LIKEGROUP_LOGO_PX.h, slotW, slotH);
    const imageY = box.y + (slotH - fitted.h) / 2;
    doc.addImage(likeGroupPng, 'PNG', box.x, imageY, fitted.w, fitted.h);
  }
  const markX = box.x + slotW + LOCKUP_GAP;
  const baseline = box.y + slotH * 0.72;
  if (typeof doc.setFont === 'function') doc.setFont('helvetica', 'normal');
  if (typeof doc.setFontSize === 'function') doc.setFontSize(11 * LOCKUP_SCALE);
  if (typeof doc.setTextColor === 'function') doc.setTextColor(120);
  doc.text('×', markX, baseline);
  if (typeof doc.setTextColor === 'function') doc.setTextColor(0);
  const xWidth = typeof doc.getTextWidth === 'function' ? doc.getTextWidth('×') : 2;
  const customerX = markX + xWidth + LOCKUP_GAP_AFTER_X;
  const customerSrc = customerImage?.dataUrl || '';
  if (customerSrc && doc.addImage) {
    const fitted = containInBox(customerImage.width, customerImage.height, slotW, slotH);
    const imageY = box.y + (slotH - fitted.h) / 2;
    doc.addImage(customerSrc, 'JPEG', customerX, imageY, fitted.w, fitted.h, undefined, 'FAST');
    return;
  }
  const customerLabel = stripNonWinAnsi(customerName || '').trim();
  if (customerLabel) {
    if (typeof doc.setFontSize === 'function') doc.setFontSize(9 * LOCKUP_SCALE);
    doc.text(customerLabel, customerX, baseline);
  }
}

function drawRightLink(doc, label, url, rightX, baseline) {
  const href = httpUrl(url);
  if (!label || !href) return 0;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const width = typeof doc.getTextWidth === 'function' ? doc.getTextWidth(label) : label.length * 1.6;
  const x = rightX - width;
  doc.text(label, x, baseline);
  doc.setDrawColor(...MUTED);
  if (typeof doc.setLineWidth === 'function') doc.setLineWidth(0.15);
  if (typeof doc.line === 'function') doc.line(x, baseline + 0.6, x + width, baseline + 0.6);
  if (typeof doc.link === 'function') doc.link(x, baseline - 3.2, width, 3.8, { url: href });
  doc.setTextColor(0);
  return width;
}

function drawCreatorCard(doc, item, image, y) {
  doc.setDrawColor(...RULE);
  if (typeof doc.setLineWidth === 'function') doc.setLineWidth(0.25);
  doc.rect(MARGIN_X, y, TABLE_W, CARD_H);
  const name = stripNonWinAnsi(item.creator?.name || '').trim();
  if (name) {
    const placed = placeImage(doc, image?.dataUrl || image, MARGIN_X + 3, y + 2, CREATOR_SIZE, CREATOR_SIZE);
    const textX = placed ? MARGIN_X + CREATOR_SIZE + 6 : MARGIN_X + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0);
    doc.text('CREATOR', textX, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(name, textX, y + 11.5);
  }
  let right = MARGIN_X + TABLE_W - 4;
  for (const link of socialKarteLinks(item).slice().reverse()) {
    const width = drawRightLink(doc, link.label, link.url, right, y + 11.5);
    if (width) right -= width + 5;
  }
  drawRightLink(doc, 'Beispiel-Video', item.videoUrl, right, y + 11.5);
  return y + CARD_H;
}

function drawBlock(doc, y, text, newPage) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13.5);
  doc.setTextColor(0);
  for (const line of linesOf(doc, text, TABLE_W)) {
    if (y > MAX_CONTENT_Y) y = newPage();
    if (line) doc.text(line, MARGIN_X, y);
    y += 6.5;
  }
  return y;
}

async function drawItem(doc, item, ctx) {
  const customerRaw = await ctx.logo(item.customerLogoUrl);
  const customerImage = customerRaw ? await toPdfImageDataUrl(customerRaw) : null;
  const creatorRaw = item.creator?.bildUrl ? await ctx.logo(item.creator.bildUrl) : null;
  const creatorImage = creatorRaw ? await toPdfImageDataUrl(creatorRaw) : null;
  drawSkriptLockup(doc, ctx.logoPng, customerImage, item.customerName || '');

  doc.setDrawColor(...RULE);
  if (typeof doc.setLineWidth === 'function') doc.setLineWidth(0.2);
  if (typeof doc.line === 'function') doc.line(MARGIN_X, 26, MARGIN_X + TABLE_W, 26);

  let y = 34;

  const headline = headlineOf(item);
  if (headline) y = drawBlock(doc, y, headline, ctx.newPage);
  y = drawBlock(doc, y, `„${plain(item.titel) || 'Skript'}“`, ctx.newPage);
  y += 3;

  if (item.creator?.name || httpUrl(item.videoUrl)) {
    if (y + CARD_H > MAX_CONTENT_Y) y = ctx.newPage();
    y = drawCreatorCard(doc, item, creatorImage, y) + 4;
  }

  // Skript-Dokument: sichtbare Bloecke in Reihenfolge, die Skript-Tabelle an ihrem Platz
  const bloecke = Array.isArray(item.dokument_bloecke) ? item.dokument_bloecke : null;
  if (!bloecke) {
    drawTable(doc, item, y, ctx.newPage);
    return;
  }
  for (const block of bloecke) {
    if (block.typ === 'skript_tabelle') y = drawTable(doc, item, y, ctx.newPage) + 5;
    else y = await drawFreierBlock(doc, block, y, ctx);
  }
}

async function renderPdf(items, dateiname) {
  const jsPDF = await loadJsPdf();
  const logoPng = await loadLikeGroupLogoPng();
  const logoCache = new Map();
  const logo = async (url) => {
    if (!url) return null;
    if (logoCache.has(url)) return logoCache.get(url);
    const png = await loadCustomerLogoPng(url);
    logoCache.set(url, png);
    return png;
  };

  const doc = new jsPDF();
  let pageNumber = 1;
  const addFooter = () => {
    drawLikeGroupFooter(doc, { page: pageNumber });
    pageNumber += 1;
  };
  const newPage = () => {
    addFooter();
    doc.addPage();
    return 20;
  };

  for (let i = 0; i < items.length; i += 1) {
    if (i > 0) newPage();
    await drawItem(doc, items[i], { logoPng, logo, newPage });
  }
  addFooter();
  return { blob: doc.output('blob'), dateiname: dateiname || 'Skript.pdf' };
}

/**
 * Eine PDF oder eine PDF pro Skript.
 * @param {Array} items
 * @param {{ dateiname?: string, proSkript?: boolean }} [opts]
 */
export async function createSkriptAnhang(items, { dateiname, proSkript = false } = {}) {
  const list = items?.length ? items : [{ titel: 'Skript' }];
  if (proSkript) {
    const used = new Map();
    const pdfs = [];
    for (const item of list) {
      pdfs.push(await renderPdf([item], uniquePdfName(item.titel, used)));
    }
    return { pdfs };
  }
  return renderPdf(list, dateiname || sanitizeSkriptFilename(list[0]?.titel));
}
