// NeuigkeitenService.js
// Datenzugriff fuer den "Was ist neu"-Feed. Geschrieben wird nur per
// Service Role aus der GitHub Action (scripts/neuigkeiten/run.cjs), hier
// ist alles read-only. RLS laesst ohnehin nur Admin/Mitarbeiter lesen.

export class NeuigkeitenService {
  /** Die neuesten Posts fuer den Dashboard-Block (schlanke Spalten). */
  static async loadLatest(limit = 3) {
    const { data, error } = await window.supabase
      .from('neuigkeit')
      .select('slug, titel, teaser, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /** Alle Posts fuer die Archiv-Liste /neuigkeiten. */
  static async loadAll() {
    const { data, error } = await window.supabase
      .from('neuigkeit')
      .select('slug, titel, teaser, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /** Ein Post inkl. inhalt und schritte fuer die Detailseite. */
  static async loadBySlug(slug) {
    const { data, error } = await window.supabase
      .from('neuigkeit')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /** Oeffentliche URL eines Screenshots aus dem Bucket neuigkeiten. */
  static screenshotUrl(pfad) {
    if (!pfad) return null;
    const { data } = window.supabase.storage.from('neuigkeiten').getPublicUrl(pfad);
    return data?.publicUrl || null;
  }
}
