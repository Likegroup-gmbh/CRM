// SkriptPdf.js
// Anschreiben-PDF: Lockup wie das Briefing, darunter ein Creator (Bild + Name),
// dann die Editor-Tabelle Hook / Hauptteil / CTA. Keine Hook-Varianten, kein Zusatz.

import { konzeptCreatorFromSkript } from './editor/SkriptEditorDocRenderer.js';
import { drawBriefingLockup, loadCustomerLogoPng, toPdfImageDataUrl } from '../briefing/BriefingPdf.js';
import {
  loadLikeGroupLogoPng,
  drawLikeGroupFooter,
} from '../../core/pdf/PdfBrand.js';

export const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';

const MARGIN_X = 14;
const COLS = [{ w: 28 }, { w: 77 }, { w: 77 }];
const TABLE_W = 182;
const MAX_CONTENT_Y = 272;
const CREATOR_SIZE = 18;
const LINE = 4.2;
const ROWS = [
  ['Hook', 'hook', 'hook_visuell'],
  ['Hauptteil', 'hauptteil', 'hauptteil_visuell'],
  ['CTA', 'cta', 'cta_visuell'],
];

let jsPdfPromise = null;

function loadCdnScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('PDF-Bibliothek konnte nicht geladen werden'));
    document.head.appendChild(script);
  });
}

function ensureJsPdf() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (!jsPdfPromise) {
    jsPdfPromise = loadCdnScript(JSPDF_URL).then(() => {
      const ctor = window.jspdf?.jsPDF;
      if (!ctor) throw new Error('jsPDF ohne jsPDF-Export geladen');
      return ctor;
    }).catch((err) => {
      jsPdfPromise = null;
      throw err;
    });
  }
  return jsPdfPromise;
}

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
  return String(text ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_]{1,3}/g, '')
    .trim();
}

function linesOf(doc, text, width) {
  const value = plain(text);
  if (!value) return [''];
  const lines = doc.splitTextToSize(value, Math.max(8, width - 3));
  return lines?.length ? lines : [''];
}

function creatorAusVerknuepfungen(rows) {
  const sorted = [...(rows || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  for (const row of sorted) {
    const creator = row.kooperation?.creator;
    if (!creator) continue;
    const name = [creator.vorname, creator.nachname].filter(Boolean).join(' ').trim();
    const bildUrl = creator.profilbild_url || creator.profilbild_thumb_url || '';
    if (!name && !bildUrl) continue;
    return { name: name || 'Creator', bildUrl };
  }
  return null;
}

/** Genau ein Creator: Kooperation, sonst der der Videoidee. */
export function creatorFuerAnschreiben(skript, verknuepfungen) {
  const ausKooperation = creatorAusVerknuepfungen(verknuepfungen);
  if (ausKooperation) return ausKooperation;
  const konzept = konzeptCreatorFromSkript(skript);
  if (!konzept?.name) return null;
  return {
    name: konzept.name,
    bildUrl: konzept.profilbild_url || konzept.profilbild_thumb_url || '',
  };
}

function drawHeader(doc, y, newPage) {
  const h = 8;
  if (y + h > MAX_CONTENT_Y) y = newPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.setDrawColor(210);
  const headers = ['', 'Was gesagt wird', 'Was zu sehen ist'];
  let x = MARGIN_X;
  headers.forEach((text, i) => {
    doc.rect(x, y, COLS[i].w, h);
    if (text) doc.text(text, x + 1.5, y + 5.2);
    x += COLS[i].w;
  });
  doc.setTextColor(0);
  return y + h;
}

function drawRow(doc, y, h, cells) {
  doc.setFontSize(9);
  doc.setDrawColor(210);
  let x = MARGIN_X;
  cells.forEach((lines, i) => {
    doc.rect(x, y, COLS[i].w, h);
    doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
    lines.forEach((line, li) => {
      if (line) doc.text(line, x + 1.5, y + 4 + li * LINE);
    });
    x += COLS[i].w;
  });
}

function drawTable(doc, item, startY, newPage) {
  let y = drawHeader(doc, startY, newPage);
  for (const [label, gesagtKey, gesehenKey] of ROWS) {
    const cells = [
      linesOf(doc, label, COLS[0].w),
      linesOf(doc, item[gesagtKey], COLS[1].w),
      linesOf(doc, item[gesehenKey], COLS[2].w),
    ];
    const h = Math.max(...cells.map((ls) => ls.length)) * LINE + 3;
    if (y + h > MAX_CONTENT_Y) {
      y = newPage();
      y = drawHeader(doc, y, newPage);
    }
    drawRow(doc, y, h, cells);
    y += h;
  }
  return y;
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

async function drawItem(doc, item, ctx) {
  const customerRaw = await ctx.logo(item.customerLogoUrl);
  const customerImage = customerRaw ? await toPdfImageDataUrl(customerRaw) : null;
  const creatorRaw = item.creator?.bildUrl ? await ctx.logo(item.creator.bildUrl) : null;
  const creatorImage = creatorRaw ? await toPdfImageDataUrl(creatorRaw) : null;
  drawBriefingLockup(doc, ctx.logoPng, customerImage, { customerName: item.customerName || '' });

  let y = 28;
  if (item.creator?.name) {
    const placed = placeImage(doc, creatorImage, MARGIN_X, y, CREATOR_SIZE, CREATOR_SIZE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0);
    const nameX = placed ? MARGIN_X + CREATOR_SIZE + 3 : MARGIN_X;
    doc.text(item.creator.name, nameX, y + (placed ? CREATOR_SIZE * 0.62 : 5));
    y += (placed ? CREATOR_SIZE : 8) + 4;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  for (const line of linesOf(doc, item.titel || 'Skript', TABLE_W)) {
    if (y > MAX_CONTENT_Y) y = ctx.newPage();
    if (line) doc.text(line, MARGIN_X, y);
    y += 6;
  }
  y += 2;
  drawTable(doc, item, y, ctx.newPage);
}

async function renderPdf(items, dateiname) {
  const jsPDF = await ensureJsPdf();
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
