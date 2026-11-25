// skriptPdfBloecke.js
// Skript-Dokument (ADR 0062): Freie Bloecke im PDF mit formatierten Laeufen.

import { toPdfImageDataUrl } from '../../../core/pdf/pdfImage.js';
import { containInBox } from '../../../core/pdf/PdfBrand.js';
import { stripNonWinAnsi } from '../../../core/pdf/pdfWinAnsi.js';
import { inlineMdRuns } from '../../../core/utils/inlineFormat.js';
import { highlightRgb } from '../../../core/utils/highlightFarben.js';
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
} from './skriptPdfLayout.js';

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

export async function drawFreierBlock(doc, block, y, ctx) {
  if (block.typ === 'absatz' || block.typ === 'h1' || block.typ === 'h2') return drawTextBlock(doc, block, y, ctx.newPage);
  if (block.typ === 'liste' || block.typ === 'nummerierung') return drawListe(doc, block, y, ctx.newPage);
  if (block.typ === 'trennlinie') return drawTrennlinie(doc, y, ctx.newPage);
  if (block.typ === 'bild') return drawBild(doc, block, y, ctx);
  if (block.typ === 'tabelle') return drawFreieTabelle(doc, block, y, ctx.newPage);
  return y;
}
