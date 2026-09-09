// berichtsstandStore.js
// Datenschicht der Berichtsstände (PRD Schritt 7, ADR 0006). Die
// Monatsauswertung rechnet immer live; hier wird nur der eingefrorene
// Stand gesichert und wieder geladen, damit ein verschicktes Update
// später belegt werden kann. Kein Update/Delete — Belegcharakter.

export const BERICHTSSTAND_VERSION = 1;

// JSON-Rundlauf stellt sicher, dass der Stand serialisierbar ist
// (keine Funktionen/undefined) und sich nicht mehr verändert, wenn
// die live gerechneten Objekte später mutiert würden.
export function buildBerichtsstandPayload({ monatsauswertung, zahlungsstand } = {}) {
  return JSON.parse(JSON.stringify({
    version: BERICHTSSTAND_VERSION,
    monatsauswertung: monatsauswertung ?? null,
    zahlungsstand: zahlungsstand ?? null,
  }));
}

export async function saveBerichtsstand(supabase, { label, daten, createdBy = null } = {}) {
  const { data, error } = await supabase
    .from('berichtsstand')
    .insert({ label, daten, created_by: createdBy })
    .select('id, created_at, label')
    .single();
  if (error) throw error;
  return data;
}

// Liste ohne den grossen daten-Blob — der wird erst beim Ansehen geladen.
export async function fetchBerichtsstaende(supabase) {
  const { data, error } = await supabase
    .from('berichtsstand')
    .select('id, created_at, label, created_by')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchBerichtsstand(supabase, id) {
  const { data, error } = await supabase
    .from('berichtsstand')
    .select('id, created_at, label, daten')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}
