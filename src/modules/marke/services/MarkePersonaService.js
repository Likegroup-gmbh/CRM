// MarkePersonaService.js
// Datenzugriff fuer Personas einer Marke. Die Tabelle "personas" ist global,
// marke_id ordnet eine Persona einer Marke zu. Personas ohne marke_id bleiben
// als globale Zielgruppen fuer die Skript-DNA bestehen und tauchen hier nicht auf.

export class MarkePersonaService {
  static async loadForMarke(markeId) {
    const { data, error } = await window.supabase
      .from('personas')
      .select('*')
      .eq('marke_id', markeId)
      .order('oberbegriff', { nullsFirst: false })
      .order('name');

    if (error) throw error;
    return data || [];
  }

  /** Laedt eine einzelne Persona. markeId schuetzt gegen Deeplinks auf fremde Marken. */
  static async loadOne(personaId, markeId) {
    const { data, error } = await window.supabase
      .from('personas')
      .select('*')
      .eq('id', personaId)
      .eq('marke_id', markeId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async create(data, markeId) {
    const result = await window.dataService.createEntity('persona', { ...data, marke_id: markeId });
    if (!result.success) throw new Error(result.error || 'Persona konnte nicht angelegt werden');
    return result;
  }

  static async update(id, data) {
    const result = await window.dataService.updateEntity('persona', id, data);
    if (!result.success) throw new Error(result.error || 'Persona konnte nicht gespeichert werden');
    return result;
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
}
