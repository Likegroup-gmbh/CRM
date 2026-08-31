// PersonaService.js
// Datenzugriff fuer Personas. Besitzer ist das Unternehmen (unternehmen_id),
// die Marken-Zuordnung liegt in der Junction persona_marke - eine Persona kann
// mehreren Marken desselben Unternehmens gehoeren oder gar keiner.
//
// Der Kontext entscheidet ueber den Filter:
//   { markeId }        -> nur Personas dieser Marke (Marke-Detailseite)
//   { unternehmenId }  -> alle Personas des Unternehmens, auch die einer Marke
//
// Personas ohne unternehmen_id bleiben als globale Zielgruppen fuer die
// Skript-DNA bestehen und tauchen in beiden Ansichten nicht auf.

const MARKEN_SELECT = 'marken:persona_marke(marke_id, marke:marke_id(id, markenname))';
const BUDGETRAHMEN = ['niedrig', 'mittel', 'hoch'];

/**
 * Postgres: CHECK (budgetrahmen IN ('niedrig','mittel','hoch')), NULL ok.
 * Exakt (case-insensitive), sonst genau ein erlaubtes Wort im String.
 * Ranges wie "mittel bis hoch" → null.
 */
function clampBudgetrahmen(value) {
  if (value === null || value === undefined) return null;
  const n = String(value).trim().toLowerCase();
  if (!n) return null;
  if (BUDGETRAHMEN.includes(n)) return n;
  const hits = BUDGETRAHMEN.filter(v => n.includes(v));
  return hits.length === 1 ? hits[0] : null;
}

export function personaFormRoute(ownerTyp, ownerId, personaId = null) {
  const base = `/${ownerTyp}/${ownerId}/persona`;
  return personaId ? `${base}?persona=${personaId}` : base;
}

export class PersonaService {
  static async loadForContext({ unternehmenId = null, markeId = null } = {}) {
    let query = window.supabase.from('personas');

    if (markeId) {
      query = query
        .select(`*, treffer:persona_marke!inner(marke_id), ${MARKEN_SELECT}`)
        .eq('treffer.marke_id', markeId);
    } else {
      query = query
        .select(`*, ${MARKEN_SELECT}`)
        .eq('unternehmen_id', unternehmenId);
    }

    const { data, error } = await query
      .order('oberbegriff', { nullsFirst: false })
      .order('name');

    if (error) throw error;
    return data || [];
  }

  /** Laedt eine einzelne Persona. Der Kontext schuetzt gegen fremde Deeplinks. */
  static async loadOne(personaId, { unternehmenId = null, markeId = null } = {}) {
    let query = window.supabase.from('personas');

    if (markeId) {
      query = query
        .select('*, treffer:persona_marke!inner(marke_id)')
        .eq('treffer.marke_id', markeId);
    } else {
      query = query.select('*').eq('unternehmen_id', unternehmenId);
    }

    const { data, error } = await query.eq('id', personaId).maybeSingle();

    if (error) throw error;
    return data;
  }

  /** Marken-IDs einer Persona, fuer die Vorbelegung des Multiselects. */
  static async loadMarkenIds(personaId) {
    const { data, error } = await window.supabase
      .from('persona_marke')
      .select('marke_id')
      .eq('persona_id', personaId);

    if (error) throw error;
    return (data || []).map(row => row.marke_id);
  }

  static async create(data, { unternehmenId = null } = {}) {
    const payload = { ...data, unternehmen_id: unternehmenId };
    delete payload.marke_ids;
    if ('budgetrahmen' in payload) payload.budgetrahmen = clampBudgetrahmen(payload.budgetrahmen);

    const result = await window.dataService.createEntity('persona', payload);
    if (!result.success) throw new Error(result.error || 'Persona konnte nicht angelegt werden');
    return result;
  }

  static async update(id, data) {
    const payload = { ...data };
    delete payload.marke_ids;
    // unternehmen_id steht als Hidden-Feld im Formular und darf nicht wandern
    delete payload.unternehmen_id;
    if ('budgetrahmen' in payload) payload.budgetrahmen = clampBudgetrahmen(payload.budgetrahmen);

    const result = await window.dataService.updateEntity('persona', id, payload);
    if (!result.success) throw new Error(result.error || 'Persona konnte nicht gespeichert werden');
    return result;
  }

  /** Setzt die Marken-Zuordnung auf genau diese Liste. */
  static async saveMarken(personaId, markeIds = []) {
    const { error: deleteError } = await window.supabase
      .from('persona_marke')
      .delete()
      .eq('persona_id', personaId);
    if (deleteError) throw deleteError;

    const eindeutige = [...new Set(markeIds.filter(Boolean))];
    if (!eindeutige.length) return;

    const { error } = await window.supabase
      .from('persona_marke')
      .insert(eindeutige.map(marke_id => ({ persona_id: personaId, marke_id })));
    if (error) throw error;
  }

  static async remove(id) {
    const { error } = await window.supabase.from('personas').delete().eq('id', id);
    if (error) throw error;
  }

  /** Anzeige-Titel: "Sparsame Studentin · Sarah", faellt auf den Namen zurueck. */
  static label(persona) {
    return [persona?.oberbegriff, persona?.name].filter(Boolean).join(' · ') || 'Persona';
  }

  static alterLabel(persona) {
    const { alter_von: von, alter_bis: bis } = persona || {};
    if (von && bis) return `${von}–${bis}`;
    if (von) return `ab ${von}`;
    if (bis) return `bis ${bis}`;
    return '-';
  }

  /** Markennamen aus dem eingebetteten Junction-Select, fuer die Tabelle. */
  static markenNamen(persona) {
    return (persona?.marken || [])
      .map(eintrag => eintrag?.marke?.markenname)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'de'));
  }
}
