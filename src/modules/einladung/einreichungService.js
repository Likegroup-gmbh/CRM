// einreichungService.js
// Mitarbeiter-Seite der Einreichungen (ADR 0055): lesen, verwerfen, als angelegt markieren.
// Statuswechsel gehen nur von `offen` aus (der Trigger in der DB erzwingt das ebenfalls).

const BUCKET = 'einreichung';

const SELECT = `
  id, status, absender_name, payload, dateien, created_at, produkt_id, briefing_id,
  einladung:einladung_id!inner(
    id, art, label, briefing_typ, produktion_id, marke_id, unternehmen_id,
    unternehmen:unternehmen_id(firmenname), marke:marke_id(markenname)
  )
`;

/** Offene Einreichungen, gefiltert über die Einladung (Produktion oder Marke/Unternehmen). */
export async function listOffeneEinreichungen({ art, produktionId = null, markeId = null, unternehmenId = null } = {}) {
  if (!window.supabase) return [];
  let query = window.supabase
    .from('einreichung')
    .select(SELECT)
    .eq('status', 'offen')
    .order('created_at', { ascending: true });
  if (art) query = query.eq('einladung.art', art);
  if (produktionId) query = query.eq('einladung.produktion_id', produktionId);
  if (markeId) query = query.eq('einladung.marke_id', markeId);
  else if (unternehmenId) query = query.eq('einladung.unternehmen_id', unternehmenId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function ladeEinreichung(id) {
  const { data, error } = await window.supabase
    .from('einreichung')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function setzeStatus(id, felder) {
  const { data, error } = await window.supabase
    .from('einreichung')
    .update({
      ...felder,
      erledigt_am: new Date().toISOString(),
      erledigt_von: window.currentUser?.id || null
    })
    .eq('id', id)
    .eq('status', 'offen')
    .select('id');
  if (error) throw error;
  return (data || []).length > 0;
}

/** Verworfen: Dateien werden aufgeräumt, der Payload bleibt als Nachweis. */
export async function verwirfEinreichung(einreichung) {
  const ok = await setzeStatus(einreichung.id, { status: 'verworfen' });
  if (!ok) return false;
  const pfade = (einreichung.dateien || []).map((d) => d.pfad).filter(Boolean);
  if (pfade.length) {
    const { error } = await window.supabase.storage.from(BUCKET).remove(pfade);
    if (error) console.warn('Dateien der Einreichung nicht entfernt:', error);
  }
  return true;
}

export function markiereBriefingAngelegt(id, briefingId) {
  return setzeStatus(id, { status: 'angelegt', briefing_id: briefingId });
}

export function markiereProduktAngelegt(id, produktId) {
  return setzeStatus(id, { status: 'angelegt', produkt_id: produktId });
}

export async function ladeDatei(pfad) {
  const { data, error } = await window.supabase.storage.from(BUCKET).download(pfad);
  if (error) throw error;
  return data;
}

/** Link zum Review: Briefing öffnet das Briefing-Formular, Produkt das Produkt-Formular. */
export function reviewUrl(einreichung, kontext = {}) {
  const einladung = einreichung.einladung || {};
  if (einladung.art === 'produkt') {
    const params = new URLSearchParams({ einreichung: einreichung.id });
    if (einladung.unternehmen_id) params.set('unternehmen', einladung.unternehmen_id);
    if (einladung.marke_id) params.set('marke', einladung.marke_id);
    return `/produkt/new?${params.toString()}`;
  }
  const params = new URLSearchParams({
    einreichung: einreichung.id,
    unternehmen: einladung.unternehmen_id || '',
    marke: einladung.marke_id || '',
    produktion: einladung.produktion_id || ''
  });
  if (kontext.kampagneId) params.set('kampagne', kontext.kampagneId);
  return `/briefing/new?${params.toString()}`;
}

/** Datum für Listen. */
export function einreichungDatum(einreichung) {
  return new Date(einreichung.created_at).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}
