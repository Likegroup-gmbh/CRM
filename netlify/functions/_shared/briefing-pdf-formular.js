// briefing-pdf-formular.js
// Ausgefülltes LikeGroup-Creator-Briefing (PDF mit Formularfeldern) direkt lesen.
// Die Zuordnung PDF-Feld -> Briefing-Feld steht als `pdf` in briefingFelder.json
// (einzige Feld-Quelle). Was so gelesen wird, ist ein Fakt; Liky füllt nur den Rest.

const FELDER = require('../../../src/modules/briefing/briefingFelder.json');

const QUELLE = 'PDF-Formular';

function alleFelder(felder = FELDER.schritte.flatMap((s) => s.felder)) {
  return felder.flatMap((f) => (f.type === 'fieldGroup' ? alleFelder(f.fields || []) : [f]));
}

function text(acro, key) {
  const v = key ? acro[key] : null;
  return typeof v === 'string' ? v.trim() : '';
}

function zahl(raw) {
  const m = String(raw ?? '').match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

/** "17.11.2026", "17.11.26", "2026-11-17" -> "2026-11-17". */
function datum(raw) {
  const s = String(raw || '').trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return s;
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (!de) return null;
  const jahr = de[3].length === 2 ? `20${de[3]}` : de[3];
  return `${jahr}-${de[2].padStart(2, '0')}-${de[1].padStart(2, '0')}`;
}

/** "17.11.2026 – 24.11.2026" oder "17.11.2026 bis 24.11.2026" -> { von, bis }. */
function datumsSpanne(raw) {
  const teile = String(raw || '')
    .split(/\s+[-–—]\s+|\s*[–—]\s*|\s+bis\s+|(?<=\.\d{2,4})-(?=\d{1,2}\.)/i)
    .map((t) => t.trim())
    .filter(Boolean);
  const von = datum(teile[0]);
  const bis = teile.length > 1 ? datum(teile[teile.length - 1]) : null;
  return { von, bis: von && bis && bis >= von ? bis : null };
}

function videolaenge(field, acro) {
  const pdf = field.pdf || {};
  const minimum = zahl(text(acro, pdf.mindestlaenge));
  const von = zahl(text(acro, pdf.von));
  const bis = zahl(text(acro, pdf.bis));
  const min = field.min ?? 1;
  const max = field.max ?? 180;
  const gueltig = (n) => n != null && n >= min && n <= max;
  if (acro[pdf.minimum] === true || (!acro[pdf.bereich] && gueltig(minimum) && !(von && bis))) {
    return gueltig(minimum) ? { von: minimum, bis: null } : null;
  }
  if (gueltig(von) && gueltig(bis) && bis >= von) return { von, bis };
  return null;
}

function ideen(raw) {
  return String(raw || '')
    .split(/\r?\n/)
    .map((z) => z.replace(/^\s*(?:[-•*–]|\d{1,2}[.)])\s+/, '').trim())
    .filter(Boolean)
    .map((t) => ({ text: t, verbindlich: false }));
}

/**
 * @param {Record<string, string|boolean>} acro PDF-Feldname -> Text oder Häkchen
 * @returns {Record<string, unknown>} Briefing-Feldname -> Wert in Formular-Shape
 */
function formularWerte(acro = {}) {
  const out = {};
  const felder = alleFelder();
  for (const field of felder) {
    switch (field.type) {
      case 'checkbox':
        if (acro[field.pdf] === true) out[field.name] = true;
        break;
      case 'checkboxes': {
        const werte = (field.options || []).filter((o) => o.pdf && acro[o.pdf] === true).map((o) => o.value);
        if (werte.length) out[field.name] = werte;
        break;
      }
      case 'videolaenge': {
        const wert = videolaenge(field, acro);
        if (wert) out[field.name] = wert;
        break;
      }
      case 'date': {
        const quelle = field.pdf || field.pdfBis;
        const spanne = datumsSpanne(text(acro, quelle));
        const wert = field.pdfBis ? spanne.bis : spanne.von;
        if (wert) out[field.name] = wert;
        break;
      }
      case 'produktListe': {
        const eintrag = {};
        for (const sub of field.fields || []) {
          const v = text(acro, sub.pdf);
          if (v) eintrag[sub.name] = v;
        }
        if (Object.keys(eintrag).length) out[field.name] = [eintrag];
        break;
      }
      case 'ideenListe': {
        const liste = ideen(text(acro, field.pdf));
        if (liste.length) out[field.name] = liste;
        break;
      }
      default: {
        const v = typeof field.pdf === 'string' ? text(acro, field.pdf) : '';
        if (v) out[field.name] = v;
      }
    }
  }
  return out;
}

/** Formularfelder aus den PDF-Bytes. Kein Formular oder kaputtes PDF: {}. */
async function leseAcroForm(bytes) {
  try {
    const { PDFDocument, PDFCheckBox, PDFTextField } = require('pdf-lib');
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    const acro = {};
    for (const feld of doc.getForm().getFields()) {
      if (feld instanceof PDFCheckBox) acro[feld.getName()] = feld.isChecked();
      else if (feld instanceof PDFTextField) acro[feld.getName()] = feld.getText() || '';
    }
    return acro;
  } catch (error) {
    console.warn('[briefing-pdf-formular] Formularfelder nicht lesbar:', error.message);
    return {};
  }
}

/** Briefing-Felder aus dem PDF-Formular als { name: { value, kind, from } }. */
async function formularFelder(bytes) {
  const werte = formularWerte(await leseAcroForm(bytes));
  return Object.fromEntries(Object.entries(werte).map(([name, value]) => [name, { value, kind: 'fact', from: QUELLE }]));
}

module.exports = { formularWerte, formularFelder, leseAcroForm, datumsSpanne };
