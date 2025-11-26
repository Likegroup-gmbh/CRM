// StrategieService.js
// Service für Strategie-Datenbank-Operationen

export class StrategieService {
  constructor() {
    // Supabase Client wird bei jedem Aufruf direkt verwendet
  }

  /**
   * Alle Strategien abrufen (mit Verknüpfungen)
   */
  async getAllStrategien() {
    const { data, error } = await window.supabase
      .from('strategie')
      .select(`
        *,
        unternehmen:unternehmen_id(id, firmenname),
        marke:marke_id(id, markenname),
        kampagne:kampagne_id(id, kampagnenname),
        auftrag:auftrag_id(id, auftragsname),
        created_by_user:created_by(id, name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fehler beim Abrufen der Strategien:', error);
      throw error;
    }

    return data;
  }

  /**
   * Strategie nach ID abrufen
   */
  async getStrategieById(id) {
    const { data, error } = await window.supabase
      .from('strategie')
      .select(`
        *,
        unternehmen:unternehmen_id(id, firmenname),
        marke:marke_id(id, markenname),
        kampagne:kampagne_id(id, kampagnenname),
        auftrag:auftrag_id(id, auftragsname),
        created_by_user:created_by(id, name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Fehler beim Abrufen der Strategie:', error);
      throw error;
    }

    return data;
  }

  /**
   * Strategie erstellen
   */
  async createStrategie(strategieData) {
    const { data, error } = await window.supabase
      .from('strategie')
      .insert({
        ...strategieData,
        created_by: window.currentUser?.id
      })
      .select()
      .single();

    if (error) {
      console.error('Fehler beim Erstellen der Strategie:', error);
      throw error;
    }

    return data;
  }

  /**
   * Strategie aktualisieren
   */
  async updateStrategie(id, updates) {
    const { data, error } = await window.supabase
      .from('strategie')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Fehler beim Aktualisieren der Strategie:', error);
      throw error;
    }

    return data;
  }

  /**
   * Strategie löschen
   */
  async deleteStrategie(id) {
    const { error } = await window.supabase
      .from('strategie')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Fehler beim Löschen der Strategie:', error);
      throw error;
    }
  }

  /**
   * Items einer Strategie abrufen
   */
  async getStrategieItems(strategieId) {
    const { data, error } = await window.supabase
      .from('strategie_items')
      .select(`
        *,
        creator:creator_id(id, vorname, nachname, instagram, tiktok)
      `)
      .eq('strategie_id', strategieId)
      .order('sortierung', { ascending: true });

    if (error) {
      console.error('Fehler beim Abrufen der Strategie-Items:', error);
      throw error;
    }

    return data;
  }

  /**
   * Strategie-Item erstellen
   */
  async createStrategieItem(itemData) {
    const { data, error } = await window.supabase
      .from('strategie_items')
      .insert({
        ...itemData,
        created_by: window.currentUser?.id
      })
      .select()
      .single();

    if (error) {
      console.error('Fehler beim Erstellen des Strategie-Items:', error);
      throw error;
    }

    return data;
  }

  /**
   * Strategie-Item aktualisieren
   */
  async updateStrategieItem(id, updates) {
    const { data, error } = await window.supabase
      .from('strategie_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Fehler beim Aktualisieren des Strategie-Items:', error);
      throw error;
    }

    return data;
  }

  /**
   * Strategie-Item löschen
   */
  async deleteStrategieItem(id) {
    const { error } = await window.supabase
      .from('strategie_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Fehler beim Löschen des Strategie-Items:', error);
      throw error;
    }
  }

  /**
   * Sortierung mehrerer Items aktualisieren
   */
  async updateItemsSortierung(items) {
    const updates = items.map((item, index) => ({
      id: item.id,
      sortierung: index
    }));

    const promises = updates.map(update =>
      window.supabase
        .from('strategie_items')
        .update({ sortierung: update.sortierung })
        .eq('id', update.id)
    );

    const results = await Promise.all(promises);
    
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('Fehler beim Aktualisieren der Sortierung:', errors);
      throw new Error('Sortierung konnte nicht aktualisiert werden');
    }
  }

  /**
   * Screenshot über Netlify Function generieren
   */
  async generateScreenshot(videoUrl) {
    try {
      const response = await fetch('/.netlify/functions/screenshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: videoUrl })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Screenshot-Generierung fehlgeschlagen');
      }

      return result;
    } catch (error) {
      console.error('Fehler bei Screenshot-Generierung:', error);
      throw error;
    }
  }

  /**
   * Alle Unternehmen für Dropdown abrufen
   */
  async getAllUnternehmen() {
    const { data, error } = await window.supabase
      .from('unternehmen')
      .select('id, firmenname')
      .order('firmenname');

    if (error) throw error;
    return data;
  }

  /**
   * Alle Marken für Dropdown abrufen
   */
  async getAllMarken(unternehmenId = null) {
    let query = window.supabase
      .from('marke')
      .select('id, markenname, unternehmen_id')
      .order('markenname');

    if (unternehmenId) {
      query = query.eq('unternehmen_id', unternehmenId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  /**
   * Alle Kampagnen für Dropdown abrufen
   */
  async getAllKampagnen(markeId = null) {
    let query = window.supabase
      .from('kampagne')
      .select('id, kampagnenname, marke_id')
      .order('kampagnenname');

    if (markeId) {
      query = query.eq('marke_id', markeId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  /**
   * Alle Aufträge für Dropdown abrufen
   */
  async getAllAuftraege(unternehmenId = null) {
    let query = window.supabase
      .from('auftrag')
      .select('id, auftragsname, unternehmen_id')
      .order('auftragsname');

    if (unternehmenId) {
      query = query.eq('unternehmen_id', unternehmenId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  /**
   * Creator suchen (für Autocomplete)
   */
  async searchCreators(searchTerm) {
    const { data, error } = await window.supabase
      .from('creator')
      .select('id, vorname, nachname, instagram, tiktok')
      .or(`vorname.ilike.%${searchTerm}%,nachname.ilike.%${searchTerm}%,instagram.ilike.%${searchTerm}%,tiktok.ilike.%${searchTerm}%`)
      .limit(10);

    if (error) throw error;
    // Füge einen kombinierten Namen hinzu für die Anzeige
    return (data || []).map(c => ({
      ...c,
      name: `${c.vorname || ''} ${c.nachname || ''}`.trim()
    }));
  }
}

// Singleton-Instanz exportieren
export const strategieService = new StrategieService();

