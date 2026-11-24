// reportPdfVorlage.js
// Vorlage des Report-PDF (ADR 0080): ein vollständiges HTML-Dokument aus dem View-Model
// (reportPdfModell). Läuft unverändert im Browser (Vorschau in PDF-Vorlagen) und in der Function
// report-pdf-background (Chromium page.pdf), deshalb nur reine Imports ohne DOM.
// Jede Seite ist ein fester Block A4 quer; umbrochen wird hier, nicht von Chrome.

import { escapeHtml as esc } from '../../core/format.js';
import { LIKEGROUP, LIKEGROUP_LOGO_SVG } from '../../core/pdf/PdfBrand.js';
import { MAX_JE_SEITE, seitenAus, spaltenFuer } from './reportPdfSeiten.js';
import { REPORT_PDF_CSS } from './reportPdfStil.js';

const SEITE_BREITE_MM = 297;
const RAND_X_MM = 14;
const LUECKE_MM = 5;
// Höher passt der Text der Kachel nicht mehr auf die Seite
const BILD_MAX_MM = 100;

const LOGO_SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(LIKEGROUP_LOGO_SVG)}`;
const ANSCHRIFT = `${LIKEGROUP.name} · ${LIKEGROUP.street} · ${LIKEGROUP.zip} ${LIKEGROUP.city}`;

// Chromium in der Function lädt nur, was hier durchkommt (dazu die Request-Sperre dort)
const SICHER = /^(https:\/\/|data:image\/)/i;
const bildUrl = (url) => (typeof url === 'string' && SICHER.test(url) ? url : '');

const mm = (v) => Math.round(v * 10) / 10;

/** Kachelbreite und Posterhöhe in mm: 9:16, höchstens BILD_MAX_MM hoch. */
export function kachelMasse(spalten) {
  const breite = (SEITE_BREITE_MM - 2 * RAND_X_MM - (spalten - 1) * LUECKE_MM) / spalten;
  return { breite: mm(breite), bild: mm(Math.min((breite * 16) / 9, BILD_MAX_MM)) };
}

function lockupHtml(kunde) {
  const lg = `<img class="rp-lockup__lg" src="${LOGO_SRC}" alt="LikeGroup">`;
  if (!kunde) return lg;
  const logo = bildUrl(kunde.logoUrl);
  const links = logo
    ? `<img class="rp-lockup__kunde" src="${esc(logo)}" alt="${esc(kunde.name)}">`
    : `<span class="rp-lockup__name">${esc(kunde.name)}</span>`;
  if (!logo && !kunde.name) return lg;
  return `${links}<span class="rp-lockup__x">×</span>${lg}`;
}

function kopfHtml(vm) {
  const meta = [vm.titel, vm.zeitraum].filter(Boolean).join(' · ');
  return `
    <header class="rp-kopf">
      <div class="rp-lockup">${lockupHtml(vm.kunde)}</div>
      <div class="rp-kopf__meta">${esc(meta)}</div>
    </header>`;
}

const fussHtml = (nr, gesamt) => `
    <footer class="rp-fuss"><span>${esc(ANSCHRIFT)}</span><span>Seite ${nr} von ${gesamt}</span></footer>`;

function kennzahlHtml(k) {
  return `
        <div class="rp-kennzahl">
          <div class="rp-kennzahl__label">${esc(k.label)}</div>
          <div class="rp-kennzahl__wert">${esc(k.wert)}</div>
          <div class="rp-kennzahl__sub">${esc(k.sub)}</div>
        </div>`;
}

function deckblattHtml(vm, gesamt) {
  return `
  <section class="rp-seite rp-deckblatt">
    ${kopfHtml(vm)}
    <div class="rp-deckblatt__inhalt">
      <div class="rp-deckblatt__text">
        <div class="rp-label">Auswertung</div>
        <h1 class="rp-titel">${esc(vm.titel)}<span class="rp-punkt">.</span></h1>
        ${vm.untertitel ? `<p class="rp-untertitel">${esc(vm.untertitel)}</p>` : ''}
        <p class="rp-intro">${esc(vm.intro)}</p>
      </div>
      <div class="rp-kennzahlen">${(vm.kennzahlen || []).map(kennzahlHtml).join('')}
      </div>
    </div>
    ${fussHtml(1, gesamt)}
  </section>`;
}

function kachelHtml(k) {
  const poster = bildUrl(k.posterUrl);
  const bild = poster
    ? `<img src="${esc(poster)}" alt="">`
    : '<span class="rp-kachel__ohne">Kein Poster</span>';
  const werte = (k.werte || []).map(w => `
            <div class="rp-wert"><span class="rp-wert__zahl">${esc(w.wert)}</span><span class="rp-wert__label">${esc(w.label)}</span></div>`).join('');
  return `
      <article class="rp-kachel">
        <div class="rp-kachel__bild">${bild}</div>
        <div class="rp-kachel__text">
          <div class="rp-kachel__plattform">${esc(k.plattform)}</div>
          <div class="rp-kachel__name">${esc(k.creator)}</div>
          <div class="rp-kachel__sub">${esc(k.unterzeile)}</div>
          <div class="rp-kachel__werte">${werte}
          </div>
        </div>
      </article>`;
}

function kachelSeiteHtml(vm, kacheln, { von, gesamtPosts, nr, gesamt }) {
  const bis = von + kacheln.length - 1;
  const bereich = von === bis ? `Post ${von}` : `Posts ${von}–${bis}`;
  return `
  <section class="rp-seite rp-kachelseite">
    ${kopfHtml(vm)}
    <div class="rp-label">${esc(`${bereich} von ${gesamtPosts}`)}</div>
    <div class="rp-reihe">${kacheln.map(kachelHtml).join('')}
    </div>
    ${fussHtml(nr, gesamt)}
  </section>`;
}

/**
 * @param {ReturnType<import('./reportPdfModell.js').reportPdfVm>} vm
 * @param {{ maxJeSeite?: number, fontCss?: string }} [opts] - fontCss aus schriftCss()
 * @returns {string} HTML-Dokument
 */
export function renderReportPdf(vm, { maxJeSeite = MAX_JE_SEITE, fontCss = '' } = {}) {
  const kacheln = vm?.kacheln || [];
  const seiten = seitenAus(kacheln, maxJeSeite);
  const gesamt = 1 + seiten.length;
  const { breite, bild } = kachelMasse(spaltenFuer(kacheln.length, maxJeSeite));
  let von = 1;
  const kachelSeiten = seiten.map((seite, i) => {
    const html = kachelSeiteHtml(vm, seite, { von, gesamtPosts: kacheln.length, nr: i + 2, gesamt });
    von += seite.length;
    return html;
  });
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>${esc(vm?.titel || 'Report')}</title>
<style>${fontCss}${REPORT_PDF_CSS}</style>
</head>
<body style="--kachel-breite: ${breite}mm; --bild-hoehe: ${bild}mm; --luecke: ${LUECKE_MM}mm">${deckblattHtml(vm || {}, gesamt)}${kachelSeiten.join('')}
</body>
</html>`;
}
