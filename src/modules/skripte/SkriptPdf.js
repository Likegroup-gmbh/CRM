// SkriptPdf.js
// Anschreiben-PDF nach der LikeBase-Vorlage, schwarz/weiss:
// Lockup, Marke × Creator, Titel, Creator-Karte, dann Hook / Hauptteil / CTA.
// Mit Skript-Dokument (ADR 0062) stehen die sichtbaren Freien Bloecke davor
// und danach; item.dokument_bloecke kommt bereits ohne interne Bloecke.

import { konzeptCreatorFromSkript } from './editor/SkriptEditorDocRenderer.js';
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
import { inlineMdRuns } from '../../core/utils/inlineFormat.js';
import { highlightRgb } from '../../core/utils/highlightFarben.js';

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
const ZUSATZ_ROWS = [
  ['REZEPT', 'rezept'],
  ['CAPTION', 'caption'],
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
  const customerLabel = stripNonWinAnsi(customerName || '').trim();
  if (customerLabel) {
    if (typeof doc.setFontSize === 'function') doc.setFontSize(9 * LOCKUP_SCALE);
    doc.text(customerLabel, customerX, baseline);
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

// ---------- Skript-Dokument (ADR 0062): Freie Bloecke ----------

const BILD_ANTEIL = { klein: 0.33, mittel: 0.6, voll: 1 };
const TEXT_STIL = {
  absatz: { pt: 10, bold: false, vor: 0, nach: 2.2 },
  h1: { pt: 15, bold: true, vor: 4, nach: 2 },
  h2: { pt: 12, bold: true, vor: 3, nach: 1.6 },
};
const LISTE_PT = 10;
const LISTE_EINZUG = 6;
const TABELLE_PT = 8.5;
const UNTERSCHRIFT_PT = 8.5;

function zeilenHoehe(pt) {
  return pt * 0.352778 * 1.45;
}

function fontStil(run, basisBold) {
  const bold = basisBold || run.bold;
  if (bold && run.italic) return 'bolditalic';
  if (bold) return 'bold';
  return run.italic ? 'italic' : 'normal';
}

function setzeRunFont(doc, run, pt, basisBold) {
  doc.setFont(run.code ? 'courier' : 'helvetica', fontStil(run, basisBold));
  doc.setFontSize(pt);
}

function textBreite(doc, text, run, pt, basisBold) {
  setzeRunFont(doc, run, pt, basisBold);
  return typeof doc.getTextWidth === 'function' ? doc.getTextWidth(text) : text.length * pt * 0.18;
}

/**
 * Formatierte Laeufe (inlineMdRuns) in Zeilen umbrechen. Jede Zeile haelt
 * Segmente mit eigenem Lauf, damit Fett/Kursiv/Highlight/Link mitten im
 * Satz wechseln koennen.
 */
export function layoutRuns(doc, runs, width, { pt, bold = false }) {
  const zeilen = [];
  let zeile = { segs: [], w: 0 };
  const umbruch = () => {
    zeilen.push(zeile);
    zeile = { segs: [], w: 0 };
  };
  const anhaengen = (text, run, w) => {
    const letztes = zeile.segs[zeile.segs.length - 1];
    if (letztes && letztes.run === run) {
      letztes.text += text;
      letztes.w += w;
    } else {
      zeile.segs.push({ text, run, w });
    }
    zeile.w += w;
  };
  for (const run of runs || []) {
    const text = stripNonWinAnsi(String(run.text ?? ''));
    for (const teil of text.split(/(\n|[ \t]+)/)) {
      if (!teil) continue;
      if (teil === '\n') {
        umbruch();
        continue;
      }
      const leer = /^[ \t]+$/.test(teil);
      if (leer && !zeile.segs.length) continue;
      const w = textBreite(doc, teil, run, pt, bold);
      if (leer || zeile.w + w <= width) {
        anhaengen(teil, run, w);
        continue;
      }
      if (zeile.segs.length) umbruch();
      // Wort laenger als die Zeile: hart teilen
      let rest = teil;
      while (rest.length > 1 && textBreite(doc, rest, run, pt, bold) > width) {
        let n = rest.length - 1;
        while (n > 1 && textBreite(doc, rest.slice(0, n), run, pt, bold) > width) n -= 1;
        const stueck = rest.slice(0, n);
        anhaengen(stueck, run, textBreite(doc, stueck, run, pt, bold));
        umbruch();
        rest = rest.slice(n);
      }
      anhaengen(rest, run, textBreite(doc, rest, run, pt, bold));
    }
  }
  zeilen.push(zeile);
  return zeilen;
}

function drawZeilen(doc, zeilen, x, y, { pt, bold = false, newPage = null, width = TABLE_W, zentriert = false, farbe = [0, 0, 0] }) {
  const lh = zeilenHoehe(pt);
  for (const zeile of zeilen) {
    if (newPage && y + lh > MAX_CONTENT_Y) y = newPage();
    const baseline = y + ascentMm(pt) + (lh - ascentMm(pt) - descentMm(pt)) / 2;
    let cx = zentriert ? x + Math.max(0, (width - zeile.w) / 2) : x;
    for (const seg of zeile.segs) {
      const { run } = seg;
      if (run.highlight) {
        doc.setFillColor(...highlightRgb(run.highlight));
        doc.rect(cx, y + 0.3, seg.w, lh - 0.6, 'F');
      }
      setzeRunFont(doc, run, pt, bold);
      doc.setTextColor(...farbe);
      if (seg.text.trim()) doc.text(seg.text, cx, baseline);
      if (run.href) {
        doc.setDrawColor(...farbe);
        if (typeof doc.setLineWidth === 'function') doc.setLineWidth(0.15);
        if (typeof doc.line === 'function') doc.line(cx, baseline + 0.6, cx + seg.w, baseline + 0.6);
        if (typeof doc.link === 'function') doc.link(cx, y, seg.w, lh, { url: run.href });
      }
      cx += seg.w;
    }
    y += lh;
  }
  doc.setTextColor(0);
  return y;
}

function drawTextBlock(doc, block, y, newPage) {
  const stil = TEXT_STIL[block.typ] || TEXT_STIL.absatz;
  const runs = inlineMdRuns(block.md);
  // Leerer Absatz = Abstand, wie im Dokument
  if (!runs.length) return y + zeilenHoehe(stil.pt);
  y += stil.vor;
  // Ueberschrift nicht allein unten auf der Seite
  if (block.typ !== 'absatz' && y + zeilenHoehe(stil.pt) * 2.5 > MAX_CONTENT_Y) y = newPage();
  const zeilen = layoutRuns(doc, runs, TABLE_W, stil);
  return drawZeilen(doc, zeilen, MARGIN_X, y, { ...stil, newPage }) + stil.nach;
}

function drawListe(doc, block, y, newPage) {
  const lh = zeilenHoehe(LISTE_PT);
  let nr = 0;
  for (const punkt of block.punkte || []) {
    const runs = inlineMdRuns(punkt);
    if (!runs.length) continue;
    nr += 1;
    if (y + lh > MAX_CONTENT_Y) y = newPage();
    const marke = block.typ === 'nummerierung' ? `${nr}.` : '•';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(LISTE_PT);
    doc.setTextColor(0);
    doc.text(marke, MARGIN_X + 1, y + ascentMm(LISTE_PT) + (lh - ascentMm(LISTE_PT) - descentMm(LISTE_PT)) / 2);
    const zeilen = layoutRuns(doc, runs, TABLE_W - LISTE_EINZUG, { pt: LISTE_PT });
    y = drawZeilen(doc, zeilen, MARGIN_X + LISTE_EINZUG, y, { pt: LISTE_PT, newPage, width: TABLE_W - LISTE_EINZUG }) + 0.8;
  }
  return y + 1.6;
}

function drawTrennlinie(doc, y, newPage) {
  y += 2;
  if (y > MAX_CONTENT_Y) y = newPage();
  doc.setDrawColor(...RULE);
  if (typeof doc.setLineWidth === 'function') doc.setLineWidth(0.3);
  if (typeof doc.line === 'function') doc.line(MARGIN_X, y, MARGIN_X + TABLE_W, y);
  return y + 4;
}

async function drawBild(doc, block, y, ctx) {
  const raw = block.url ? await ctx.logo(block.url) : null;
  const bild = raw ? await toPdfImageDataUrl(raw, { maxEdge: 1600 }) : null;
  if (!bild?.dataUrl || !doc.addImage) return y;
  const maxW = TABLE_W * (BILD_ANTEIL[block.breite] || BILD_ANTEIL.mittel);
  const maxH = MAX_CONTENT_Y - 20 - 12;
  const fitted = containInBox(bild.width, bild.height, maxW, maxH);
  y += 2;
  if (y + fitted.h > MAX_CONTENT_Y) y = ctx.newPage();
  const x = MARGIN_X + (TABLE_W - fitted.w) / 2;
  try {
    doc.addImage(bild.dataUrl, 'JPEG', x, y, fitted.w, fitted.h, undefined, 'FAST');
  } catch (err) {
    console.warn('Dokument-Bild übersprungen:', err);
    return y;
  }
  y += fitted.h + 1.5;
  const unterschrift = inlineMdRuns(block.unterschrift);
  if (unterschrift.length) {
    const zeilen = layoutRuns(doc, unterschrift, TABLE_W, { pt: UNTERSCHRIFT_PT });
    y = drawZeilen(doc, zeilen, MARGIN_X, y, {
      pt: UNTERSCHRIFT_PT, newPage: ctx.newPage, zentriert: true, farbe: MUTED
    });
  }
  return y + 3;
}

function drawFreieTabelle(doc, block, y, newPage) {
  const zeilenListe = block.zeilen || [];
  const spalten = zeilenListe[0]?.length || 1;
  const w = TABLE_W / spalten;
  const lh = zeilenHoehe(TABELLE_PT);
  y += 1;
  zeilenListe.forEach((zeile, z) => {
    const kopf = Boolean(block.kopfzeile) && z === 0;
    const zellen = zeile.map((wert) => layoutRuns(doc, inlineMdRuns(wert), w - CELL_PAD * 2, { pt: TABELLE_PT, bold: kopf }));
    const n = Math.max(1, ...zellen.map((l) => l.length));
    const h = CELL_PAD * 2 + n * lh;
    if (y + h > MAX_CONTENT_Y) y = newPage();
    doc.setDrawColor(...RULE);
    if (typeof doc.setLineWidth === 'function') doc.setLineWidth(0.2);
    zellen.forEach((zeilen, s) => {
      const x = MARGIN_X + s * w;
      if (kopf) {
        doc.setFillColor(...HEADER_FILL);
        doc.rect(x, y, w, h, 'FD');
      } else {
        doc.rect(x, y, w, h);
      }
      drawZeilen(doc, zeilen, x + CELL_PAD, y + CELL_PAD, { pt: TABELLE_PT, bold: kopf, width: w - CELL_PAD * 2 });
    });
    y += h;
  });
  return y + 3;
}

async function drawFreierBlock(doc, block, y, ctx) {
  if (block.typ === 'absatz' || block.typ === 'h1' || block.typ === 'h2') return drawTextBlock(doc, block, y, ctx.newPage);
  if (block.typ === 'liste' || block.typ === 'nummerierung') return drawListe(doc, block, y, ctx.newPage);
  if (block.typ === 'trennlinie') return drawTrennlinie(doc, y, ctx.newPage);
  if (block.typ === 'bild') return drawBild(doc, block, y, ctx);
  if (block.typ === 'tabelle') return drawFreieTabelle(doc, block, y, ctx.newPage);
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
