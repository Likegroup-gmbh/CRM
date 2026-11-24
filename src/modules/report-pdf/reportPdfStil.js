// reportPdfStil.js
// Stylesheet des Report-PDF als String: dieselbe Datei für die Vorschau in PDF-Vorlagen und für
// Chromium in report-pdf-background. Maße in mm und pt, weil sie 1:1 aufs Papier gehen.
// Kachelbreite und Posterhöhe setzt die Vorlage als Variablen am body (reportPdfVorlage.js).

const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

/**
 * Geist als Variable Font wie in assets/styles/fonts.css. Der Browser gibt Asset-URLs, die
 * Function data-URLs (Lambda-Chromium hat keine Schriften).
 * @param {{ latin?: string, latinExt?: string }} quellen
 */
export function schriftCss({ latin = '', latinExt = '' } = {}) {
  const face = (src, range) => (src ? `
@font-face {
  font-family: 'Geist';
  font-style: normal;
  font-weight: 100 900;
  src: url('${src}') format('woff2-variations');
  unicode-range: ${range};
}` : '');
  return `${face(latinExt, LATIN_EXT)}${face(latin, LATIN)}`;
}

export const REPORT_PDF_CSS = `
@page { size: 297mm 210mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --akzent: rgb(243 11 97);
  --text: #111827;
  --leise: #6b7280;
  --linie: #e5e7eb;
  --grund: #f6f6f7;
  --rahmen: #ececee;
}
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  font-family: 'Geist', 'Helvetica Neue', Arial, sans-serif;
  font-size: 9pt;
  line-height: 1.3;
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}

.rp-seite {
  width: 297mm;
  height: 210mm;
  padding: 12mm 14mm 9mm;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--grund);
  break-after: page;
  page-break-after: always;
}
.rp-seite:last-child { break-after: auto; page-break-after: auto; }

.rp-kopf {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 4mm;
  margin-bottom: 7mm;
  border-bottom: 0.3mm solid var(--linie);
}
.rp-lockup { display: flex; align-items: center; gap: 2.5mm; height: 9mm; }
.rp-lockup__kunde { display: block; max-height: 9mm; max-width: 32mm; object-fit: contain; }
.rp-lockup__name { font-size: 10pt; font-weight: 600; }
.rp-lockup__x { font-size: 9pt; color: var(--leise); }
.rp-lockup__lg { display: block; height: 7mm; width: auto; }
.rp-kopf__meta {
  font-size: 8pt;
  font-weight: 500;
  text-transform: uppercase;
  color: var(--leise);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150mm;
}

.rp-label {
  display: flex;
  align-items: center;
  gap: 3mm;
  font-size: 7.5pt;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--akzent);
}
.rp-label::before { content: ''; width: 7mm; height: 0.35mm; background: var(--akzent); }

.rp-fuss {
  flex: none;
  margin-top: auto;
  padding-top: 4mm;
  display: flex;
  justify-content: space-between;
  font-size: 6.5pt;
  color: var(--leise);
}

/* Deckblatt */
.rp-deckblatt__inhalt {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 95mm 1fr;
  gap: 12mm;
  align-items: center;
}
.rp-titel {
  margin: 5mm 0 4mm;
  font-size: 30pt;
  line-height: 1.08;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.rp-punkt { color: var(--akzent); }
.rp-untertitel { margin-bottom: 3mm; font-size: 11pt; font-weight: 500; }
.rp-intro { font-size: 10pt; line-height: 1.45; color: var(--leise); }
.rp-kennzahlen { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
.rp-kennzahl {
  padding: 5mm 5mm 4.5mm;
  background: #fff;
  border-top: 0.6mm solid var(--akzent);
  border-radius: 0 0 1.5mm 1.5mm;
}
.rp-kennzahl__label {
  font-size: 7pt;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--akzent);
}
.rp-kennzahl__wert { margin: 2mm 0 1mm; font-size: 20pt; font-weight: 700; }
.rp-kennzahl__sub { font-size: 7.5pt; color: var(--leise); }

/* Kachelseiten */
.rp-kachelseite .rp-label { flex: none; margin-bottom: 5mm; }
.rp-reihe {
  flex: 1;
  min-height: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--luecke);
}
.rp-kachel {
  flex: none;
  width: var(--kachel-breite);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  border-radius: 1.5mm;
}
.rp-kachel__bild {
  height: var(--bild-hoehe);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--rahmen);
  border-bottom: 0.6mm solid var(--akzent);
}
.rp-kachel__bild img { display: block; width: 100%; height: 100%; object-fit: cover; }
.rp-kachel__ohne {
  font-size: 6.5pt;
  text-transform: uppercase;
  color: var(--leise);
}
.rp-kachel__text { padding: 3.5mm 3.5mm 4mm; }
.rp-kachel__plattform {
  font-size: 6.5pt;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--akzent);
}
.rp-kachel__name,
.rp-kachel__sub,
.rp-wert__label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rp-kachel__name { margin-top: 1mm; font-size: 10pt; font-weight: 700; }
.rp-kachel__sub { min-height: 1.3em; margin-top: 0.6mm; font-size: 7pt; color: var(--leise); }
.rp-kachel__werte {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2.2mm 2.5mm;
  margin-top: 3mm;
  padding-top: 2.8mm;
  border-top: 0.3mm solid var(--linie);
}
.rp-wert { display: flex; flex-direction: column; min-width: 0; }
.rp-wert__zahl { font-size: 10.5pt; font-weight: 700; }
.rp-wert__label { font-size: 6.5pt; color: var(--leise); }

/* Vorschau im Browser: Seiten untereinander, die PDF (print) bleibt unberührt */
@media screen {
  html { background: transparent; }
  body { padding: 8mm; }
  .rp-seite { margin: 0 auto 8mm; box-shadow: 0 1mm 4mm rgb(0 0 0 / 0.12); }
  .rp-seite:last-child { margin-bottom: 0; }
}
`;
