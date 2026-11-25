// ProduktPdfSnapshot.js
// Sammelt den Stand der Produktseite fuer das PDF - den Live-Stand, nicht die
// Datenbank: wer gerade getippt hat, will seine Aenderung im PDF sehen.
// Unternehmen und Marken stehen nicht im Formular-Kontext (Standalone) und
// werden einmal nachgeladen. Ein Fehler dort kostet nur Name und Logo.

const TEXT_FELDER = [
  'name', 'url', 'kurzbeschreibung', 'usp', 'pain_points', 'loesung',
  'preis_von', 'preis_bis', 'preis_uvp',
  'inhaltsstoffe', 'erlaubte_claims', 'verbotene_claims', 'rechtliche_hinweise',
];

/**
 * Gespeicherte und aus dem Auslesen uebernommene Bilder in der Reihenfolge der
 * Seite, mit dem Namen aus der Bilder-Tabelle und der Hauptbild-Markierung.
 */
export function bilderAusUploader(uploader) {
  if (!uploader?.getKeptExistingFiles) return [];
  const primary = uploader.effectivePrimaryKey?.();
  return uploader.getKeptExistingFiles()
    .filter(f => f?.url)
    .map(f => ({ url: f.url, name: f.name || '', primary: `existing:${f.id}` === primary }));
}

/** Firmenname/Logo und Markennamen/Logos zu den gewaehlten IDs. */
export async function ladeKundenstamm({ unternehmenId, markeIds = [] }, client = window.supabase) {
  const [firma, marken] = await Promise.all([
    unternehmenId
      ? client.from('unternehmen').select('firmenname, logo_url').eq('id', unternehmenId).maybeSingle()
      : { data: null },
    markeIds.length
      ? client.from('marke').select('markenname, logo_url').in('id', markeIds).order('markenname')
      : { data: [] },
  ]);
  return { unternehmen: firma?.data || null, marken: marken?.data || [] };
}

/**
 * @param {Object} source
 * @param {Object} source.data - collectSubmitData(form)
 * @param {Array} source.varianten - ProduktVariantenPanel.getVariantenMitBild() (mit bildUrl)
 * @param {Array} source.useCases - ProduktPersonaPanel.getState().useCases
 * @param {Object|null} source.uploader - UploaderField der Produktbilder
 * @param {string|null} source.unternehmenId
 * @param {string[]} source.markeIds
 * @param {Function} [lade] - Lookup, nur fuer Tests austauschbar
 */
export async function collectProduktPdfSnapshot(source, lade = ladeKundenstamm) {
  const { data = {}, varianten = [], useCases = [], uploader = null, markeIds = [] } = source;
  // Im Kontext der Firma steht sie im Context, im Standalone im Formularfeld.
  const unternehmenId = source.unternehmenId || data.unternehmen_id || null;

  const kunde = await lade({ unternehmenId, markeIds }).catch((err) => {
    console.warn('Produkt-PDF: Unternehmen/Marken nicht geladen:', err);
    return { unternehmen: null, marken: [] };
  });

  const snapshot = { ...kunde, varianten, useCases, bilder: bilderAusUploader(uploader) };
  for (const feld of TEXT_FELDER) snapshot[feld] = data[feld] ?? '';
  return snapshot;
}
