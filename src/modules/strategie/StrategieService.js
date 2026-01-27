// StrategieService.js
// Service für Strategie-Datenbank-Operationen

export class StrategieService {
  constructor() {
    // Supabase Client wird bei jedem Aufruf direkt verwendet
  }

  /**
   * Alle Strategien abrufen (mit Verknüpfungen)
   * Filtert basierend auf Benutzerrolle und Kampagnen-Zuordnung
   */
  async getAllStrategien() {
    const user = window.currentUser;
    const rolle = user?.rolle?.toLowerCase();
    
    // Admin sieht alle Strategien
    if (rolle === 'admin') {
      return this._fetchAllStrategien();
    }
    
    // Für Mitarbeiter und Kunden: erlaubte Kampagnen ermitteln
    const allowedKampagneIds = await this._getAllowedKampagneIds(user, rolle);
    
    console.log('🔐 Erlaubte Kampagnen für Benutzer:', allowedKampagneIds);
    
    // Alle Strategien laden
    const allStrategien = await this._fetchAllStrategien();
    
    // Filtern: Strategie muss einer erlaubten Kampagne zugeordnet sein
    const filtered = allStrategien.filter(s => 
      s.kampagne_id && allowedKampagneIds.includes(s.kampagne_id)
    );
    
    console.log(`🔐 Strategien gefiltert: ${filtered.length} von ${allStrategien.length}`);
    
    return filtered;
  }

  /**
   * Interne Methode: Alle Strategien ohne Filter laden
   */
  async _fetchAllStrategien() {
    const { data, error } = await window.supabase
      .from('strategie')
      .select(`
        *,
        unternehmen:unternehmen_id(id, firmenname, logo_url),
        marke:marke_id(id, markenname, logo_url),
        kampagne:kampagne_id(id, kampagnenname),
        auftrag:auftrag_id(id, auftragsname),
        created_by_user:created_by(id, name, profile_image_url)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fehler beim Abrufen der Strategien:', error);
      throw error;
    }

    return data;
  }

  /**
   * Ermittelt alle Kampagnen-IDs, auf die der Benutzer Zugriff hat
   * - Mitarbeiter: via kampagne_mitarbeiter, mitarbeiter_unternehmen, marke_mitarbeiter
   * - Kunden: via kunde_unternehmen, kunde_marke
   */
  async _getAllowedKampagneIds(user, rolle) {
    const userId = user?.id;
    if (!userId) return [];
    
    const kampagneIds = new Set();
    
    if (rolle === 'mitarbeiter') {
      // 1. Direkt zugeordnete Kampagnen (kampagne_mitarbeiter)
      const { data: directKampagnen } = await window.supabase
        .from('kampagne_mitarbeiter')
        .select('kampagne_id')
        .eq('mitarbeiter_id', userId);
      (directKampagnen || []).forEach(k => kampagneIds.add(k.kampagne_id));
      
      // 2. Zugeordnete Marken laden
      const { data: userMarken } = await window.supabase
        .from('marke_mitarbeiter')
        .select('marke_id')
        .eq('mitarbeiter_id', userId);
      const markenIds = (userMarken || []).map(m => m.marke_id).filter(Boolean);
      
      // 3. Marken-Daten mit Unternehmen-IDs laden
      let markenMitUnternehmen = [];
      if (markenIds.length > 0) {
        const { data: markenData } = await window.supabase
          .from('marke')
          .select('id, unternehmen_id')
          .in('id', markenIds);
        markenMitUnternehmen = (markenData || []).map(m => ({
          marke_id: m.id,
          unternehmen_id: m.unternehmen_id
        }));
      }
      
      // 4. Zugeordnete Unternehmen laden
      const { data: userUnternehmen } = await window.supabase
        .from('mitarbeiter_unternehmen')
        .select('unternehmen_id')
        .eq('mitarbeiter_id', userId);
      const unternehmenIds = (userUnternehmen || []).map(u => u.unternehmen_id).filter(Boolean);
      
      // 5. Erlaubte Marken ermitteln (mit Marke-als-Zwischenfilter Logik)
      const unternehmenMarkenMap = new Map();
      markenMitUnternehmen.forEach(r => {
        if (r.unternehmen_id) {
          if (!unternehmenMarkenMap.has(r.unternehmen_id)) {
            unternehmenMarkenMap.set(r.unternehmen_id, []);
          }
          unternehmenMarkenMap.get(r.unternehmen_id).push(r.marke_id);
        }
      });
      
      let allowedMarkenIds = [];
      for (const unternehmenId of unternehmenIds) {
        const explicitMarkenIds = unternehmenMarkenMap.get(unternehmenId);
        if (explicitMarkenIds && explicitMarkenIds.length > 0) {
          // Mitarbeiter hat explizite Marken-Zuordnung → nur diese Marken
          allowedMarkenIds.push(...explicitMarkenIds);
        } else {
          // Keine Marken-Zuordnung → alle Marken des Unternehmens
          const { data: alleMarken } = await window.supabase
            .from('marke')
            .select('id')
            .eq('unternehmen_id', unternehmenId);
          allowedMarkenIds.push(...(alleMarken || []).map(m => m.id));
        }
      }
      
      // Direkt zugeordnete Marken hinzufügen
      allowedMarkenIds.push(...markenIds);
      allowedMarkenIds = [...new Set(allowedMarkenIds)];
      
      // 6. Kampagnen für erlaubte Marken laden
      if (allowedMarkenIds.length > 0) {
        const { data: markenKampagnen } = await window.supabase
          .from('kampagne')
          .select('id')
          .in('marke_id', allowedMarkenIds);
        (markenKampagnen || []).forEach(k => kampagneIds.add(k.id));
      }
      
      // 7. Kampagnen die DIREKT mit erlaubten Unternehmen verknüpft sind (ohne Marke)
      if (unternehmenIds.length > 0) {
        const { data: direkteUnternehmenKampagnen } = await window.supabase
          .from('kampagne')
          .select('id')
          .in('unternehmen_id', unternehmenIds);
        (direkteUnternehmenKampagnen || []).forEach(k => kampagneIds.add(k.id));
      }
      
    } else if (rolle === 'kunde' || rolle === 'kunde_editor') {
      // 1. Kampagnen über Unternehmen-Zuordnung (kunde_unternehmen)
      const { data: userUnternehmen } = await window.supabase
        .from('kunde_unternehmen')
        .select('unternehmen_id')
        .eq('kunde_id', userId);
      const unternehmenIds = (userUnternehmen || []).map(u => u.unternehmen_id);
      
      if (unternehmenIds.length > 0) {
        const { data: unternehmensKampagnen } = await window.supabase
          .from('kampagne')
          .select('id')
          .in('unternehmen_id', unternehmenIds);
        (unternehmensKampagnen || []).forEach(k => kampagneIds.add(k.id));
      }
      
      // 2. Kampagnen über Marken-Zuordnung (kunde_marke)
      const { data: userMarken } = await window.supabase
        .from('kunde_marke')
        .select('marke_id')
        .eq('kunde_id', userId);
      const markeIds = (userMarken || []).map(m => m.marke_id);
      
      if (markeIds.length > 0) {
        const { data: markenKampagnen } = await window.supabase
          .from('kampagne')
          .select('id')
          .in('marke_id', markeIds);
        (markenKampagnen || []).forEach(k => kampagneIds.add(k.id));
      }
    }
    
    return Array.from(kampagneIds);
  }

  /**
   * Strategie nach ID abrufen
   * Prüft Zugriffsberechtigungen basierend auf Kampagnen-Zuordnung
   */
  async getStrategieById(id) {
    const { data, error } = await window.supabase
      .from('strategie')
      .select(`
        *,
        unternehmen:unternehmen_id(id, firmenname, logo_url),
        marke:marke_id(id, markenname, logo_url),
        kampagne:kampagne_id(id, kampagnenname),
        auftrag:auftrag_id(id, auftragsname),
        created_by_user:created_by(id, name, profile_image_url)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Fehler beim Abrufen der Strategie:', error);
      throw error;
    }

    // Berechtigungsprüfung für Nicht-Admins
    const user = window.currentUser;
    const rolle = user?.rolle?.toLowerCase();
    
    if (rolle !== 'admin' && data?.kampagne_id) {
      const allowedKampagneIds = await this._getAllowedKampagneIds(user, rolle);
      
      if (!allowedKampagneIds.includes(data.kampagne_id)) {
        console.warn('🔐 Zugriff verweigert: Benutzer hat keinen Zugriff auf diese Strategie');
        throw new Error('Keine Berechtigung für diese Strategie');
      }
    }

    return data;
  }

  /**
   * Strategie erstellen
   * Nur für Admins und Mitarbeiter - Kunden dürfen keine Strategien erstellen
   */
  async createStrategie(strategieData) {
    // Berechtigungsprüfung: Kunden dürfen keine Strategien erstellen
    const rolle = window.currentUser?.rolle?.toLowerCase();
    if (rolle === 'kunde' || rolle === 'kunde_editor') {
      console.warn('🔐 Kunden dürfen keine Strategien erstellen');
      throw new Error('Keine Berechtigung zum Erstellen von Strategien');
    }
    
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
   * Nur für Admins und Mitarbeiter - Kunden dürfen Strategien nicht bearbeiten
   */
  async updateStrategie(id, updates) {
    // Berechtigungsprüfung: Kunden dürfen Strategien nicht bearbeiten
    const rolle = window.currentUser?.rolle?.toLowerCase();
    if (rolle === 'kunde' || rolle === 'kunde_editor') {
      console.warn('🔐 Kunden dürfen Strategien nicht bearbeiten');
      throw new Error('Keine Berechtigung zum Bearbeiten von Strategien');
    }
    
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
   * Strategie löschen (inkl. aller Items und Screenshots)
   * Nur für Admins - Kunden und normale Mitarbeiter dürfen Strategien nicht löschen
   */
  async deleteStrategie(id) {
    // Berechtigungsprüfung: Nur Admins dürfen Strategien löschen
    const rolle = window.currentUser?.rolle?.toLowerCase();
    if (rolle !== 'admin') {
      console.warn('🔐 Nur Admins dürfen Strategien löschen');
      throw new Error('Keine Berechtigung zum Löschen von Strategien');
    }
    
    console.log('🗑️ Lösche Strategie:', id);
    
    // Zuerst alle Items dieser Strategie abrufen um Screenshots zu löschen
    const { data: items, error: fetchError } = await window.supabase
      .from('strategie_items')
      .select('id, screenshot_url')
      .eq('strategie_id', id);

    if (fetchError) {
      console.warn('Fehler beim Abrufen der Items:', fetchError);
    }

    console.log('📸 Gefundene Items:', items?.length || 0);

    // Screenshots aus dem Storage löschen
    if (items && items.length > 0) {
      const screenshotPaths = items
        .filter(item => item.screenshot_url)
        .map(item => this.extractStoragePath(item.screenshot_url))
        .filter(path => path);

      console.log('📸 Screenshot-Pfade zum Löschen:', screenshotPaths);

      if (screenshotPaths.length > 0) {
        const { error: storageError, data: storageData } = await window.supabase.storage
          .from('strategie-screenshots')
          .remove(screenshotPaths);

        if (storageError) {
          console.warn('❌ Fehler beim Löschen der Screenshots:', storageError);
        } else {
          console.log('✅ Screenshots gelöscht:', storageData);
        }
      }
    }

    // Items werden durch CASCADE automatisch gelöscht, aber zur Sicherheit:
    const { error: itemsError } = await window.supabase
      .from('strategie_items')
      .delete()
      .eq('strategie_id', id);

    if (itemsError) {
      console.warn('Fehler beim Löschen der Items:', itemsError);
    }

    // Strategie löschen
    const { error } = await window.supabase
      .from('strategie')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Fehler beim Löschen der Strategie:', error);
      throw error;
    }
    
    console.log('✅ Strategie erfolgreich gelöscht');
  }

  /**
   * Extrahiert den Storage-Pfad aus einer Screenshot-URL
   */
  extractStoragePath(url) {
    if (!url) return null;
    // URL-Format: https://xxx.supabase.co/storage/v1/object/public/strategie-screenshots/screenshots/filename.jpg
    const match = url.match(/strategie-screenshots\/(.+)$/);
    const path = match ? match[1] : null;
    console.log('📸 Screenshot-URL:', url);
    console.log('📸 Extrahierter Pfad:', path);
    return path;
  }

  /**
   * Items einer Strategie abrufen (inkl. Verknüpfungs-Status)
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

    // Prüfen welche Items bereits mit Videos verknüpft sind
    if (data && data.length > 0) {
      const itemIds = data.map(item => item.id);
      const { data: linkedVideos } = await window.supabase
        .from('kooperation_videos')
        .select('id, strategie_item_id, titel, kooperation_id')
        .in('strategie_item_id', itemIds);

      // Verknüpfungs-Info an Items anhängen
      const linkedMap = new Map();
      (linkedVideos || []).forEach(video => {
        linkedMap.set(video.strategie_item_id, video);
      });

      data.forEach(item => {
        item.linked_video = linkedMap.get(item.id) || null;
      });
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
   * Strategie-Item löschen (inkl. Screenshot)
   */
  async deleteStrategieItem(id) {
    console.log('🗑️ Lösche Strategie-Item:', id);
    
    // Zuerst das Item abrufen um Screenshot-URL zu bekommen
    const { data: item, error: fetchError } = await window.supabase
      .from('strategie_items')
      .select('screenshot_url')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.warn('Fehler beim Abrufen des Items:', fetchError);
    }

    console.log('📸 Item-Daten:', item);

    // Screenshot aus dem Storage löschen
    if (item?.screenshot_url) {
      const storagePath = this.extractStoragePath(item.screenshot_url);
      if (storagePath) {
        console.log('🗑️ Lösche Screenshot aus Bucket:', storagePath);
        const { error: storageError, data: storageData } = await window.supabase.storage
          .from('strategie-screenshots')
          .remove([storagePath]);

        if (storageError) {
          console.warn('❌ Fehler beim Löschen des Screenshots:', storageError);
        } else {
          console.log('✅ Screenshot gelöscht:', storageData);
        }
      }
    } else {
      console.log('ℹ️ Kein Screenshot vorhanden');
    }

    // Item löschen
    const { error } = await window.supabase
      .from('strategie_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Fehler beim Löschen des Strategie-Items:', error);
      throw error;
    }
    
    console.log('✅ Item erfolgreich gelöscht');
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
   * Sortierung und Teilbereich mehrerer Items aktualisieren
   */
  async updateItemsSortierungWithTeilbereich(items) {
    const promises = items.map((item, index) =>
      window.supabase
        .from('strategie_items')
        .update({ 
          sortierung: index,
          teilbereich: item.teilbereich 
        })
        .eq('id', item.id)
    );

    const results = await Promise.all(promises);
    
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('Fehler beim Aktualisieren der Sortierung/Teilbereich:', errors);
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

