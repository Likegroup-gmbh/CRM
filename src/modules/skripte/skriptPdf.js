// Skript-PDF für Gast und internen Editor.
// Tabelle wie auf dem Bildschirm: links „Was gesagt wird“, rechts „Was zu sehen ist“.
// Rezept und Caption über beide Spalten, zusätzliche Infos darunter.
// Sammeldatei: Kampagnenname auf der ersten Seite, jedes Skript auf einer neuen Seite.

import { hatGridInhalt, gridFelderFuerSkript, hatZusatzInfos, zusatzInfosMarkdown } from './master/skriptCreatorFacing.js';
import { drawLikeGroupFooter } from '../../core/pdf/PdfBrand.js';

const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
const MARGIN = 14;
const WIDTH = 182;
const MAX_Y = 270;
const LABEL_W = 28;
const SPALTEN_ABSTAND = 4;
const COL_W = (WIDTH - LABEL_W - SPALTEN_ABSTAND) / 2;
const X_GESAGT = MARGIN + LABEL_W;
const X_VISUAL = X_GESAGT + COL_W + SPALTEN_ABSTAND;
const TEXT_EINZUG = 1.6;
const LINE = 4.5;
const BASIS = 5;
const UNTEN = 3;

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

function plain(value) {
  return String(value || '')
    .replace(/[#*_`>]/g, '')
    .replace(/\|/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function dateiname(name, fallback) {
  const base = String(name || fallback)
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `${base || fallback}.pdf`;
}

function alsListe(wert) {
  if (Array.isArray(wert)) return wert;
  if (wert == null || wert === '') return [];
  return [String(wert)];
}

/** Zeilen wie die Bildschirm-Tabelle. Leere Felder fehlen. */
export function skriptPdfAbschnitte(skript) {
  const grid = hatGridInhalt(skript) ? gridFelderFuerSkript(skript) : {
    hook: skript?.hook, hauptteil: skript?.hauptteil, cta: skript?.cta,
    hook_visuell: skript?.hook_visuell, hauptteil_visuell: skript?.hauptteil_visuell,
    cta_visuell: skript?.cta_visuell
  };
  const paare = [
    ['Hook', grid.hook, grid.hook_visuell, skript?.text_hook],
    ['Hauptteil', grid.hauptteil, grid.hauptteil_visuell, ''],
    ['CTA', grid.cta, grid.cta_visuell, '']
  ];
  const abschnitte = [];
  for (const [label, gesagt, visual, textHook] of paare) {
    const links = plain(gesagt);
    const rechts = plain(visual);
    const overlay = plain(textHook);
    if (!links && !rechts && !overlay) continue;
    abschnitte.push({ art: 'spalten', label, gesagt: links, visual: rechts, textHook: overlay });
  }
  if (plain(skript?.rezept)) abschnitte.push({ art: 'breit', label: 'Rezept', text: plain(skript.rezept) });
  if (plain(skript?.caption)) abschnitte.push({ art: 'breit', label: 'Caption', text: plain(skript.caption) });
  if (hatZusatzInfos(skript?.inhalt_md)) {
    const extra = plain(zusatzInfosMarkdown(skript.inhalt_md));
    if (extra) abschnitte.push({ art: 'zusatz', text: extra });
  }
  return abschnitte;
}

function zeilenVon(doc, text, breite) {
  const wert = plain(text);
  if (!wert) return [];
  return alsListe(doc.splitTextToSize(wert, breite)).map((zeile) => ({
    text: String(zeile),
    style: 'normal'
  }));
}

function visualZeilen(doc, zeile, breite) {
  const overlay = zeilenVon(doc, zeile.textHook, breite);
  const visual = zeilenVon(doc, zeile.visual, breite);
  const zeilen = [];
  if (overlay.length) {
    zeilen.push({ text: 'Text-Hook', style: 'bold' });
    zeilen.push(...overlay);
    if (visual.length) zeilen.push({ text: '', style: 'normal' });
  }
  zeilen.push(...visual);
  return zeilen;
}

function passtNicht(y, mindest) {
  return y + mindest > MAX_Y;
}

function zeichneSpaltenkopf(doc, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(13);
  const baseline = y + 4;
  doc.text('Was gesagt wird', X_GESAGT + TEXT_EINZUG, baseline);
  doc.text('Was zu sehen ist', X_VISUAL + TEXT_EINZUG, baseline);
  const linie = baseline + 2.2;
  doc.setDrawColor(210);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, linie, MARGIN + WIDTH, linie);
  return linie + 1;
}

function naechsteSeite(doc, hatSpalten) {
  doc.addPage();
  return hatSpalten ? zeichneSpaltenkopf(doc, 20) : 20;
}

function zellenlinien(doc, top, bottom, art) {
  doc.setDrawColor(210);
  doc.setLineWidth(0.2);
  doc.line(X_GESAGT, top, X_GESAGT, bottom);
  if (art === 'spalten') doc.line(X_VISUAL, top, X_VISUAL, bottom);
  doc.line(MARGIN, bottom, MARGIN + WIDTH, bottom);
}

function schreibeZelle(doc, zeilen, von, anzahl, x, baseline) {
  for (let i = 0; i < anzahl; i += 1) {
    const line = zeilen[von + i];
    if (!line?.text) continue;
    doc.setFont('helvetica', line.style === 'bold' ? 'bold' : 'normal');
    doc.setTextColor(line.style === 'bold' ? 90 : 13);
    doc.text(line.text, x, baseline + i * LINE);
  }
  doc.setTextColor(13);
}

function zeichneSpaltenzeile(doc, y, zeile, weiter) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const breite = COL_W - 3;
  const links = zeilenVon(doc, zeile.gesagt, breite);
  const rechts = visualZeilen(doc, zeile, breite);
  let iL = 0;
  let iR = 0;
  let anfang = true;
  while (anfang || iL < links.length || iR < rechts.length) {
    if (passtNicht(y, BASIS + UNTEN)) y = weiter();
    const passen = Math.max(1, Math.floor((MAX_Y - y - BASIS - UNTEN) / LINE));
    const nL = Math.min(passen, links.length - iL);
    const nR = Math.min(passen, rechts.length - iR);
    const n = Math.max(nL, nR, 1);
    const top = y;
    const baseline = top + BASIS;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(13);
    doc.text(zeile.label, MARGIN, baseline);
    schreibeZelle(doc, links, iL, nL, X_GESAGT + TEXT_EINZUG, baseline);
    schreibeZelle(doc, rechts, iR, nR, X_VISUAL + TEXT_EINZUG, baseline);
    iL += nL;
    iR += nR;
    y = top + BASIS + (n - 1) * LINE + UNTEN;
    zellenlinien(doc, top, y, 'spalten');
    anfang = false;
    if (iL < links.length || iR < rechts.length) y = weiter();
  }
  return y;
}

function zeichneBreit(doc, y, zeile, weiter) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const zeilen = zeilenVon(doc, zeile.text, WIDTH - LABEL_W - 3);
  let index = 0;
  let anfang = true;
  while (anfang || index < zeilen.length) {
    if (passtNicht(y, BASIS + UNTEN)) y = weiter();
    const passen = Math.max(1, Math.floor((MAX_Y - y - BASIS - UNTEN) / LINE));
    const n = Math.min(passen, Math.max(zeilen.length - index, 1));
    const top = y;
    const baseline = top + BASIS;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(13);
    doc.text(zeile.label, MARGIN, baseline);
    doc.setFont('helvetica', 'normal');
    for (let i = 0; i < n; i += 1) {
      const line = zeilen[index + i];
      if (line?.text) doc.text(line.text, X_GESAGT + TEXT_EINZUG, baseline + i * LINE);
    }
    index += n;
    y = top + BASIS + (n - 1) * LINE + UNTEN;
    zellenlinien(doc, top, y, 'breit');
    anfang = false;
    if (index < zeilen.length) y = weiter();
  }
  return y;
}

function zeichneZusatz(doc, y, text) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const zeilen = zeilenVon(doc, text, WIDTH);
  if (!zeilen.length) return y;
  if (passtNicht(y, 16)) {
    doc.addPage();
    y = 20;
  } else {
    y += 6;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(13);
  doc.text('Zusätzliche Infos', MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const line of zeilen) {
    if (y > MAX_Y) {
      doc.addPage();
      y = 20;
    }
    if (line.text) doc.text(line.text, MARGIN, y);
    y += 5;
  }
  return y;
}

function schreibeLeer(doc, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(13);
  doc.text('Skript', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Kein Inhalt.', MARGIN, y + 6);
  return y + 10;
}

/** Zeichnet ein Skript. Hook, Hauptteil und CTA stehen in zwei Spalten. */
export function zeichneSkriptPdf(doc, skript, { nr } = {}) {
  let y = 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(13);
  const kopf = nr ? `${nr}. ${skript?.titel || 'Skript'}` : (skript?.titel || 'Skript');
  const titelZeilen = alsListe(doc.splitTextToSize(kopf, WIDTH));
  for (const line of titelZeilen) {
    if (y > MAX_Y) {
      doc.addPage();
      y = 20;
    }
    doc.text(String(line), MARGIN, y);
    y += 7;
  }
  y += 2;
  const abschnitte = skriptPdfAbschnitte(skript);
  const tabelle = abschnitte.filter((z) => z.art !== 'zusatz');
  const zusatz = abschnitte.find((z) => z.art === 'zusatz');
  if (!tabelle.length && !zusatz) return schreibeLeer(doc, y);
  if (tabelle.length) {
    const hatSpalten = tabelle.some((z) => z.art === 'spalten');
    const weiter = () => naechsteSeite(doc, hatSpalten);
    if (passtNicht(y, 18)) y = weiter();
    else if (hatSpalten) y = zeichneSpaltenkopf(doc, y);
    for (const zeile of tabelle) {
      y = zeile.art === 'breit'
        ? zeichneBreit(doc, y, zeile, weiter)
        : zeichneSpaltenzeile(doc, y, zeile, weiter);
    }
  }
  if (zusatz) y = zeichneZusatz(doc, y, zusatz.text);
  return y;
}

function fusszeilen(doc) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    drawLikeGroupFooter(doc, { page: i });
  }
}

export async function downloadSkriptPdf(skript, { nr } = {}) {
  const JsPDF = await ensureJsPdf();
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  zeichneSkriptPdf(doc, skript, { nr });
  fusszeilen(doc);
  doc.save(dateiname(skript?.titel, 'Skript'));
}

export async function downloadSkriptPaketPdf(skripte, kampagneName) {
  const JsPDF = await ensureJsPdf();
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(13);
  const name = kampagneName || 'Kampagne';
  doc.text(doc.splitTextToSize(name, WIDTH), MARGIN, 22);
  skripte.forEach((skript, index) => {
    doc.addPage();
    zeichneSkriptPdf(doc, skript, { nr: skript.nr || index + 1 });
  });
  fusszeilen(doc);
  doc.save(dateiname(name, 'Skripte'));
}
