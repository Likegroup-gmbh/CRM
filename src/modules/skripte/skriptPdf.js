// Skript-PDF für Gast und internen Editor.
// Inhalt: Titel, gesagt/visual, Rezept, Caption, zusätzliche Infos.
// Sammeldatei: Kampagnenname auf der ersten Seite, jedes Skript auf einer neuen Seite.

import { hatGridInhalt, gridFelderFuerSkript, hatZusatzInfos, zusatzInfosMarkdown } from './master/skriptCreatorFacing.js';
import { drawLikeGroupFooter } from '../../core/pdf/PdfBrand.js';

const JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
const MARGIN = 14;
const WIDTH = 182;
const MAX_Y = 270;

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

/** Abschnitte eines Skripts, leer ausgelassene Felder fehlen. */
export function skriptPdfAbschnitte(skript) {
  const grid = hatGridInhalt(skript) ? gridFelderFuerSkript(skript) : {
    hook: skript?.hook, hauptteil: skript?.hauptteil, cta: skript?.cta,
    hook_visuell: skript?.hook_visuell, hauptteil_visuell: skript?.hauptteil_visuell,
    cta_visuell: skript?.cta_visuell
  };
  const paare = [
    ['Hook', grid.hook, grid.hook_visuell],
    ['Hauptteil', grid.hauptteil, grid.hauptteil_visuell],
    ['CTA', grid.cta, grid.cta_visuell]
  ];
  const abschnitte = [];
  for (const [label, gesagt, visual] of paare) {
    const links = plain(gesagt);
    const rechts = plain(visual);
    if (!links && !rechts) continue;
    const text = [
      links ? `Gesagt: ${links}` : '',
      rechts ? `Visual: ${rechts}` : ''
    ].filter(Boolean).join('\n');
    abschnitte.push({ label, text });
  }
  if (plain(skript?.rezept)) abschnitte.push({ label: 'Rezept', text: plain(skript.rezept) });
  if (plain(skript?.caption)) abschnitte.push({ label: 'Caption', text: plain(skript.caption) });
  if (hatZusatzInfos(skript?.inhalt_md)) {
    const extra = plain(zusatzInfosMarkdown(skript.inhalt_md));
    if (extra) abschnitte.push({ label: 'Zusätzliche Infos', text: extra });
  }
  return abschnitte;
}

function schreibe(doc, y, label, text) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(13);
  if (y > MAX_Y) {
    doc.addPage();
    y = 20;
  }
  doc.text(label, MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(text, WIDTH);
  for (const line of lines) {
    if (y > MAX_Y) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, MARGIN, y);
    y += 5;
  }
  return y + 4;
}

function zeichneSkript(doc, skript, { nr, ersteSeite }) {
  let y = ersteSeite ? 36 : 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(13);
  const kopf = nr ? `${nr}. ${skript.titel || 'Skript'}` : (skript.titel || 'Skript');
  const titelZeilen = doc.splitTextToSize(kopf, WIDTH);
  for (const line of titelZeilen) {
    doc.text(line, MARGIN, y);
    y += 7;
  }
  y += 4;
  const abschnitte = skriptPdfAbschnitte(skript);
  if (!abschnitte.length) {
    return schreibe(doc, y, 'Skript', 'Kein Inhalt.');
  }
  for (const abschnitt of abschnitte) {
    y = schreibe(doc, y, abschnitt.label, abschnitt.text);
  }
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
  zeichneSkript(doc, skript, { nr, ersteSeite: false });
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
    zeichneSkript(doc, skript, { nr: skript.nr || index + 1, ersteSeite: false });
  });
  fusszeilen(doc);
  doc.save(dateiname(name, 'Skripte'));
}
