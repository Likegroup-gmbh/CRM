// SkriptPdf.js
// Anschreiben-PDF nach der LikeBase-Vorlage, schwarz/weiss:
// Lockup, Marke × Creator, Titel, Creator-Karte, dann Hook / Hauptteil / CTA.

import { konzeptCreatorFromSkript } from './editor/SkriptEditorDocRenderer.js';
import { loadCustomerLogoPng, toPdfImageDataUrl } from '../briefing/BriefingPdf.js';
import {
  loadLikeGroupLogoPng,
  drawLikeGroupFooter,
  containInBox,
  LIKEGROUP_LOGO_PX,
  PDF_BRAND,
} from '../../core/pdf/PdfBrand.js';

export const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';

const MARGIN_X = 14;
const COLS = [{ w: 33 }, { w: 74.5 }, { w: 74.5 }];
const TABLE_W = 182;
const MAX_CONTENT_Y = 272;
const CREATOR_SIZE = 12;
const CARD_H = 16;
const LINE = 4.2;
const CELL_PAD = 3;
const LOCKUP_SCALE = 0.85;
const LOCKUP_GAP = 6;
const LOCKUP_GAP_AFTER_X = 8;
const RULE = [227, 224, 230];
const HEADER_FILL = [246, 244, 247];
const HEADER_TEXT = [92, 87, 98];
const MUTED = [122, 117, 128];
const ROWS = [
  ['HOOK', 'hook', 'hook_visuell'],
  ['HAUPTTEIL', 'hauptteil', 'hauptteil_visuell'],
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
  const lines = doc.splitTextToSize(value, Math.max(8, width));
  return lines?.length ? lines : [''];
}

function ascentMm(pt) {
  return pt * 0.352778 * 0.73;
}

function descentMm(pt) {
  return pt * 0.352778 * 0.21;
}

function creatorAusVerknuepfungen(rows) {
  const sorted = [...(rows || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  for (const row of sorted) {
    const creator = row.kooperation?.creator;
    if (!creator) continue;
    const name = [creator.vorname, creator.nachname].filter(Boolean).join(' ').trim();
    const bildUrl = creator.profilbild_url || creator.profilbild_thumb_url || '';
    if (!name && !bildUrl) continue;
    return { name: name || 'Creator', bildUrl, instagram: String(creator.instagram || '').trim() };
  }
  return null;
}

function instagramAusCasting(skript) {
  return String(skript?.strategie_item?.casting_eintrag?.link_instagram || '').trim();
}

/** Genau ein Creator: Kooperation, sonst der der Videoidee. Instagram aus der Casting-Liste. */
export function creatorFuerAnschreiben(skript, verknuepfungen) {
  const ausKooperation = creatorAusVerknuepfungen(verknuepfungen);
  const konzept = konzeptCreatorFromSkript(skript);
  const base = ausKooperation || (konzept?.name ? {
    name: konzept.name,
    bildUrl: konzept.profilbild_url || konzept.profilbild_thumb_url || '',
    instagram: '',
  } : null);
  if (!base) return null;
  const vomCreator = String(
    base.instagram
    || skript?.strategie_item?.casting_eintrag?.creator?.instagram
    || ''
  ).trim();
  return { ...base, instagram: instagramAusCasting(skript) || vomCreator };
}

function tiktokUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/tiktok\.com/i.test(value)) return httpUrl(value);
  const handle = value.replace(/^@/, '').split(/[/?#]/)[0].trim();
  if (!handle) return '';
  return `https://www.tiktok.com/@${encodeURIComponent(handle)}`;
}

function socialZiel(raw, feld) {
  const value = String(raw || '').trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes('tiktok.com')) {
    const url = tiktokUrl(value);
    return url ? { label: 'TikTok', url } : null;
  }
  if (lower.includes('instagram.com') || lower.includes('instagr.am')) {
    const url = instagramUrl(value);
    return url ? { label: 'Instagram', url } : null;
  }
  if (!/^https?:\/\//i.test(value) && !value.includes('.')) {
    const url = feld === 'tiktok' ? tiktokUrl(value) : instagramUrl(value);
    const label = feld === 'tiktok' ? 'TikTok' : 'Instagram';
    return url ? { label, url } : null;
  }
  const url = httpUrl(value);
  return url ? { label: 'Social Media', url } : null;
}

function socialKarteLinks(item) {
  const kandidaten = [
    socialZiel(item.instagram || item.creator?.instagram, 'instagram'),
    socialZiel(item.tiktok || item.creator?.tiktok, 'tiktok'),
  ];
  const links = [];
  const gesehen = new Set();
  for (const ziel of kandidaten) {
    if (!ziel || gesehen.has(ziel.url)) continue;
    gesehen.add(ziel.url);
    links.push(ziel);
  }
  return links;
}

/** Anzeige rechts in der Creator-Karte: instagram.com/{handle}. */
export function instagramZeile(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const fromUrl = value.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)/i);
  const handle = (fromUrl?.[1] || value).replace(/^@/, '').replace(/\/$/, '').trim();
  if (!handle) return '';
  return `instagram.com/${handle}`;
}

function instagramUrl(raw) {
  const zeile = instagramZeile(raw);
  if (!zeile) return '';
  const handle = zeile.slice('instagram.com/'.length);
  return `https://instagram.com/${encodeURIComponent(handle)}`;
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

function drawRow(doc, y, h, cells) {
  doc.setDrawColor(...RULE);
  if (typeof doc.setLineWidth === 'function') doc.setLineWidth(0.2);
  let x = MARGIN_X;
  cells.forEach((lines, i) => {
    doc.rect(x, y, COLS[i].w, h);
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
    x += COLS[i].w;
  });
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
    const gesehen = linesOf(doc, item[gesehenKey], inner(COLS[2]));
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
  if (customerName) {
    if (typeof doc.setFontSize === 'function') doc.setFontSize(9 * LOCKUP_SCALE);
    doc.text(customerName, customerX, baseline);
  }
}

function httpUrl(raw) {
  const value = String(raw || '').trim();
  if (!value || /\s/.test(value)) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return '';
  return `https://${value.replace(/^\/\//, '')}`;
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
  const name = item.creator?.name || '';
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
