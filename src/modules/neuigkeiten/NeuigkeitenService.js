// NeuigkeitenService.js
// Datenzugriff fuer die "Was ist neu"-Cards auf dem Dashboard. Geschrieben
// wird nur per Service Role aus der GitHub Action (scripts/neuigkeiten/
// run.cjs), hier ist alles read-only. RLS laesst ohnehin nur
// Admin/Mitarbeiter lesen.

const SPALTEN = 'titel, kurztext, published_at';

export class NeuigkeitenService {
  /** Die neuesten Meldungen fuer die Dashboard-Cards. */
  static async loadLatest(limit = 3) {
    const { data, error } = await window.supabase
      .from('neuigkeit')
      .select(SPALTEN)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /** Alle Meldungen fuer "Alle anzeigen" im Dashboard. */
  static async loadAll() {
    const { data, error } = await window.supabase
      .from('neuigkeit')
      .select(SPALTEN)
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
}
