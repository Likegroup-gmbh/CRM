// ProduktPdfModel.js
// Aus dem Formular-Snapshot wird das Produktblatt als Abschnitte. Rein:
// kein DOM, kein jsPDF - ProduktPdf.js zeichnet nur noch, was hier steht.
//
// Snapshot (siehe ProduktPdfSnapshot.js):
//   { name, url, kurzbeschreibung, usp, pain_points, loesung,
//     preis_von, preis_bis, preis_uvp, inhaltsstoffe, erlaubte_claims,
//     verbotene_claims, rechtliche_hinweise,
//     unternehmen: { firmenname, logo_url } | null,
//     marken: [{ markenname, logo_url }],
//     varianten: [{ name, farbe, modell_kompatibilitaet, preis, uvp, merkmal, bildUrl }],
//     useCases: [{ name, beschreibung, deleted }],
//     bilder: [{ url, name, primary }] }
//
// Block-Typen: 'text' (Fliesstext), 'spec' (Label + Text),
// 'list' (Label + Eintraege), 'table' (Spalten + Zeilen; eine Zelle ist
// { lines: [{ text, bold }] } oder { image: { url, maxH } }).

const KEIN_NAME = 'Produkt';

function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatEuro(value) {
  const n = toNumber(value);
  if (n == null) return '';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

/** Eine Zeile pro Eintrag; fuehrende Aufzaehlungszeichen fallen weg. */
export function splitLines(value) {
  return str(value)
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*[-*\u2022]\s*/, '').trim())
    .filter(Boolean);
}

function preisZeile(snapshot) {
  const von = formatEuro(snapshot.preis_von);
  const bis = formatEuro(snapshot.preis_bis);
  if (von && bis && toNumber(snapshot.preis_von) !== toNumber(snapshot.preis_bis)) return `${von} – ${bis}`;
  if (von) return von;
  if (bis) return `bis ${bis}`;
  return '';
}

const BILD_ZEILE_H = 24;
const VARIANTE_BILD_H = 22;

function cell(...lines) {
  return { lines: lines.filter(Boolean) };
}

function bilderTabelle(bilder) {
  const rows = bilder.filter(b => b?.url).map((b, i) => [
    { image: { url: b.url, maxH: BILD_ZEILE_H } },
    cell(
      { text: str(b.name) || `Produktbild ${i + 1}`, bold: true },
      b.primary && { text: 'Hauptbild' }
    ),
  ]);
  if (!rows.length) return null;
  return { type: 'table', columns: [{ label: 'Bild', w: 40 }, { label: 'Bezeichnung', w: 142 }], rows };
}

function variantenTabelle(varianten) {
  const list = varianten.filter(v => str(v?.name));
  if (!list.length) return null;
  const mitBild = list.some(v => str(v.bildUrl));
  const columns = [
    ...(mitBild ? [{ label: 'Bild', w: 28 }] : []),
    { label: 'Variante', w: mitBild ? 64 : 92 },
    { label: 'Preis', w: 40 },
    { label: 'Merkmal', w: 50 },
  ];
  const rows = list.map((v) => {
    const preis = formatEuro(v.preis);
    const uvp = formatEuro(v.uvp);
    const farbe = str(v.farbe);
    const modell = str(v.modell_kompatibilitaet);
    return [
      ...(mitBild ? [str(v.bildUrl) ? { image: { url: v.bildUrl, maxH: VARIANTE_BILD_H } } : cell()] : []),
      cell(
        { text: str(v.name), bold: true },
        farbe && { text: `Farbe: ${farbe}` },
        modell && { text: `Modell: ${modell}` }
      ),
      cell(preis && { text: `Preis ${preis}` }, uvp && { text: `UVP ${uvp}` }),
      cell(str(v.merkmal) && { text: str(v.merkmal) }),
    ];
  });
  return { type: 'table', columns, rows };
}

function section(title, blocks) {
  const filled = blocks.filter(Boolean);
  return filled.length ? { title, blocks: filled } : null;
}

function textBlock(value) {
  const text = str(value);
  return text ? { type: 'text', text } : null;
}

function specBlock(label, value) {
  const text = str(value);
  return text ? { type: 'spec', label, text } : null;
}

function listBlock(label, value) {
  const items = splitLines(value);
  return items.length ? { type: 'list', label, items } : null;
}

export function sanitizeProduktFilename(name) {
  const base = String(name || KEIN_NAME)
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `${base || KEIN_NAME}.pdf`;
}

/** Lockup: genau eine Marke -> Marke, sonst das Unternehmen. */
function kundenKopf(snapshot, markenNamen, firma) {
  const einzeln = markenNamen.length === 1 && (snapshot.marken || []).length === 1;
  const marke = einzeln ? snapshot.marken[0] : null;
  return {
    customerName: einzeln ? markenNamen[0] : firma,
    customerLogoUrl: str(marke?.logo_url) || str(snapshot.unternehmen?.logo_url),
  };
}

function formatDatum(date) {
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * @param {Object} snapshot
 * @param {{ now?: Date }} [opts] - now nur fuer Tests
 * @returns {{ title: string, subtitle: string, meta: string, sections: Array,
 *             customerName: string, customerLogoUrl: string,
 *             dateiname: string }}
 */
export function buildProduktPdfModel(snapshot = {}, { now = new Date() } = {}) {
  const title = str(snapshot.name) || KEIN_NAME;
  const firma = str(snapshot.unternehmen?.firmenname);
  const marken = (snapshot.marken || []).map(m => str(m?.markenname)).filter(Boolean);
  const subtitle = [firma, marken.join(', ')].filter(Boolean).join(' · ');
  const url = str(snapshot.url);
  const meta = [url && `Produktseite: ${url}`, `Stand ${formatDatum(now)}`].filter(Boolean).join('\n');

  const useCases = (snapshot.useCases || [])
    .filter(uc => !uc.deleted && str(uc.name))
    .map(uc => specBlock(str(uc.name), uc.beschreibung) || { type: 'spec', label: str(uc.name), text: '' });

  const preis = preisZeile(snapshot);
  const uvp = formatEuro(snapshot.preis_uvp);

  const sections = [
    section('Beschreibung', [textBlock(snapshot.kurzbeschreibung)]),
    section('Warum kauft man es?', [
      listBlock('USP', snapshot.usp),
      listBlock('Pain Points', snapshot.pain_points),
      specBlock('Lösung', snapshot.loesung),
    ]),
    section('Einsatzsituationen', useCases),
    section('Preis', [specBlock('Preis', preis), specBlock('UVP / regulärer Preis', uvp)]),
    section('Produktbilder', [bilderTabelle(snapshot.bilder || [])]),
    section('Varianten', [variantenTabelle(snapshot.varianten || [])]),
    section('Rechtliches und Compliance', [
      listBlock('Inhaltsstoffe', snapshot.inhaltsstoffe),
      listBlock('Erlaubte Claims', snapshot.erlaubte_claims),
      listBlock('Verbotene Claims', snapshot.verbotene_claims),
      specBlock('Rechtliche Hinweise', snapshot.rechtliche_hinweise),
    ]),
  ].filter(Boolean);

  return {
    title,
    subtitle,
    meta,
    sections,
    ...kundenKopf(snapshot, marken, firma),
    dateiname: sanitizeProduktFilename(title),
  };
}
