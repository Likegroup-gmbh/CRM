// CreatorAuswahlService.js
// Service für Creator-Auswahl Datenbank-Operationen

import { CREATOR_TYP_OPTIONS, isAllowedCreatorTyp, normalizeCreatorTyp } from './creatorTypeOptions.js';

export class CreatorAuswahlService {
  constructor() {
    // Supabase Client wird bei jedem Aufruf direkt verwendet
  }

  _assertValidCreatorTyp(typValue) {
    const normalized = normalizeCreatorTyp(typValue);
    if (!isAllowedCreatorTyp(normalized)) {
      throw new Error(`Ungültige Creator Art: "${typValue}". Erlaubte Werte: ${CREATOR_TYP_OPTIONS.join(', ')}`);
    }
    return normalized;
  }

  /**
   * Alle Creator-Auswahl-Listen abrufen (mit Verknüpfungen)
   * Filtert basierend auf Benutzerrolle und Kampagnen-Zuordnung
   */
  async getAllListen() {
    const user = window.currentUser;
    const rolle = user?.rolle?.toLowerCase();
    
    // Admin sieht alle Listen
    if (rolle === 'admin') {
      return this._fetchAllListen();
    }

    if (rolle === 'kunde' || rolle === 'kunde_editor') {
      const customerScope = await this._getCustomerAccessScope(user?.id);
      console.log('🔐 Kundenscope Sourcing:', customerScope);

      const allListen = await this._fetchAllListen();
      const filtered = allListen.filter((liste) => this._isInCustomerScope(liste, customerScope));

      console.log(`🔐 Listen (Kunde) gefiltert: ${filtered.length} von ${allListen.length}`);
      return filtered;
    }

    // Für Mitarbeiter: erlaubte Kampagnen ermitteln
    const allowedKampagneIds = await this._getAllowedKampagneIds(user, rolle);
    console.log('🔐 Erlaubte Kampagnen für Benutzer:', allowedKampagneIds);

    const allListen = await this._fetchAllListen();
    const filtered = allListen.filter(
      (l) => l.kampagne_id && allowedKampagneIds.includes(l.kampagne_id)
    );

    console.log(`🔐 Listen gefiltert: ${filtered.length} von ${allListen.length}`);
    return filtered;
  }

  /**
   * Interne Methode: Alle Listen ohne Filter laden
   */
  async _fetchAllListen() {
    const { data, error } = await window.supabase
      .from('creator_auswahl')
      .select(`
        *,
        unternehmen:unternehmen_id(id, firmenname, internes_kuerzel, logo_url),
        marke:marke_id(id, markenname, logo_url),
        kampagne:kampagne_id(id, kampagnenname),
        created_by_user:created_by(id, name, profile_image_url),
        creator_auswahl_items(count)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fehler beim Abrufen der Creator-Auswahl-Listen:', error);
      throw error;
    }

    return (data || []).map(liste => ({
      ...liste,
      item_count: liste.creator_auswahl_items?.[0]?.count ?? 0
    }));
  }

  async _getCustomerAccessScope(userId) {
    if (!userId) {
      return { unternehmenIds: [], markeIds: [], kampagneIds: [] };
    }

    const { data: userUnternehmen } = await window.supabase
      .from('kunde_unternehmen')
      .select('unternehmen_id')
      .eq('kunde_id', userId);

    const unternehmenIds = [...new Set((userUnternehmen || []).map((u) => u.unternehmen_id).filter(Boolean))];

    const { data: userMarken } = await window.supabase
      .from('kunde_marke')
      .select('marke_id')
      .eq('kunde_id', userId);

    const directMarkeIds = (userMarken || []).map((m) => m.marke_id).filter(Boolean);

    let unternehmenMarkeIds = [];
    if (unternehmenIds.length > 0) {
      const { data: markenByUnternehmen } = await window.supabase
        .from('marke')
        .select('id')
        .in('unternehmen_id', unternehmenIds);
      unternehmenMarkeIds = (markenByUnternehmen || []).map((m) => m.id).filter(Boolean);
    }

    const markeIds = [...new Set([...directMarkeIds, ...unternehmenMarkeIds])];
    const kampagneIds = new Set();

    if (unternehmenIds.length > 0) {
      const { data: unternehmensKampagnen } = await window.supabase
        .from('kampagne')
        .select('id')
        .in('unternehmen_id', unternehmenIds);
      (unternehmensKampagnen || []).forEach((k) => kampagneIds.add(k.id));
    }

    if (markeIds.length > 0) {
      const { data: markenKampagnen } = await window.supabase
        .from('kampagne')
        .select('id')
        .in('marke_id', markeIds);
      (markenKampagnen || []).forEach((k) => kampagneIds.add(k.id));
    }

    return {
      unternehmenIds,
      markeIds,
      kampagneIds: Array.from(kampagneIds)
    };
  }

  _isInCustomerScope(entry, scope) {
    if (!entry || !scope) return false;

    if (entry.kampagne_id && scope.kampagneIds.includes(entry.kampagne_id)) return true;
    if (entry.marke_id && scope.markeIds.includes(entry.marke_id)) return true;
    if (entry.unternehmen_id && scope.unternehmenIds.includes(entry.unternehmen_id)) return true;
    return false;
  }

  /**
   * Ermittelt alle Kampagnen-IDs, auf die der Benutzer Zugriff hat
   */
  async _getAllowedKampagneIds(user, rolle) {
    const userId = user?.id;
    if (!userId) return [];
    
    const kampagneIds = new Set();
    
    if (rolle === 'mitarbeiter') {
      // 1. Direkt zugeordnete Kampagnen
      const { data: directKampagnen } = await window.supabase
        .from('kampagne_mitarbeiter')
        .select('kampagne_id')
        .eq('mitarbeiter_id', userId);
      (directKampagnen || []).forEach(k => kampagneIds.add(k.kampagne_id));
      
      // 2. Kampagnen über Unternehmen-Zuordnung
      const { data: userUnternehmen } = await window.supabase
        .from('mitarbeiter_unternehmen')
        .select('unternehmen_id')
        .eq('mitarbeiter_id', userId);
      const unternehmenIds = (userUnternehmen || []).map(u => u.unternehmen_id);
      
      if (unternehmenIds.length > 0) {
        const { data: unternehmensKampagnen } = await window.supabase
          .from('kampagne')
          .select('id')
          .in('unternehmen_id', unternehmenIds);
        (unternehmensKampagnen || []).forEach(k => kampagneIds.add(k.id));
      }
      
      // 3. Kampagnen über Marken-Zuordnung
      const { data: userMarken } = await window.supabase
        .from('marke_mitarbeiter')
        .select('marke_id')
        .eq('mitarbeiter_id', userId);
      const markeIds = (userMarken || []).map(m => m.marke_id);
      
      if (markeIds.length > 0) {
        const { data: markenKampagnen } = await window.supabase
          .from('kampagne')
          .select('id')
          .in('marke_id', markeIds);
        (markenKampagnen || []).forEach(k => kampagneIds.add(k.id));
      }
      
    } else if (rolle === 'kunde' || rolle === 'kunde_editor') {
      const customerScope = await this._getCustomerAccessScope(userId);
      customerScope.kampagneIds.forEach((id) => kampagneIds.add(id));
    }
    
    return Array.from(kampagneIds);
  }

  /**
   * Liste nach ID abrufen
   */
  async getListeById(id) {
    const { data, error } = await window.supabase
      .from('creator_auswahl')
      .select(`
        *,
        unternehmen:unternehmen_id(id, firmenname, internes_kuerzel, logo_url),
        marke:marke_id(id, markenname, logo_url),
        kampagne:kampagne_id(id, kampagnenname),
        created_by_user:created_by(id, name, profile_image_url)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Fehler beim Abrufen der Liste:', error);
      throw error;
    }

    return data;
  }

  /**
   * Liste erstellen
   */
  async createListe(listeData) {
    const rolle = window.currentUser?.rolle?.toLowerCase();
    if (rolle === 'kunde' || rolle === 'kunde_editor') {
      throw new Error('Keine Berechtigung zum Erstellen von Listen');
    }
    
    const { data, error } = await window.supabase
      .from('creator_auswahl')
      .insert({
        ...listeData,
        created_by: window.currentUser?.id
      })
      .select()
      .single();

    if (error) {
      console.error('Fehler beim Erstellen der Liste:', error);
      throw error;
    }

    return data;
  }

  /**
   * Liste aktualisieren
   */
  async updateListe(id, updates) {
    const rolle = window.currentUser?.rolle?.toLowerCase();
    if (rolle === 'kunde' || rolle === 'kunde_editor') {
      throw new Error('Keine Berechtigung zum Bearbeiten von Listen');
    }
    
    const { data, error } = await window.supabase
      .from('creator_auswahl')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Fehler beim Aktualisieren der Liste:', error);
      throw error;
    }

    return data;
  }

  /**
   * Liste löschen (inkl. aller Items)
   */
  async deleteListe(id) {
    const rolle = window.currentUser?.rolle?.toLowerCase();
    if (rolle !== 'admin') {
      throw new Error('Nur Admins dürfen Listen löschen');
    }
    
    // Items werden durch CASCADE automatisch gelöscht
    const { error } = await window.supabase
      .from('creator_auswahl')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Fehler beim Löschen der Liste:', error);
      throw error;
    }
  }

  // =====================================================
  // ITEMS
  // =====================================================

  /**
   * Items einer Liste abrufen
   */
  async getItems(listeId) {
    const { data, error } = await window.supabase
      .from('creator_auswahl_items')
      .select(`
        *,
        creator:creator_id(id, vorname, nachname, instagram, tiktok)
      `)
      .eq('creator_auswahl_id', listeId)
      .order('sortierung', { ascending: true });

    if (error) {
      console.error('Fehler beim Abrufen der Items:', error);
      throw error;
    }

    return data;
  }

  /**
   * Item erstellen
   */
  async createItem(itemData) {
    const payload = {
      ...itemData,
      created_by: window.currentUser?.id
    };

    if (Object.prototype.hasOwnProperty.call(payload, 'typ')) {
      payload.typ = this._assertValidCreatorTyp(payload.typ);
    }

    const { data, error } = await window.supabase
      .from('creator_auswahl_items')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Fehler beim Erstellen des Items:', error);
      throw error;
    }

    return data;
  }

  /**
   * Item aktualisieren
   */
  async updateItem(id, updates) {
    const payload = { ...updates };
    if (Object.prototype.hasOwnProperty.call(payload, 'typ')) {
      payload.typ = this._assertValidCreatorTyp(payload.typ);
    }

    const { data, error } = await window.supabase
      .from('creator_auswahl_items')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Fehler beim Aktualisieren des Items:', error);
      throw error;
    }

    return data;
  }

  /**
   * Item löschen
   */
  async deleteItem(id) {
    const { error } = await window.supabase
      .from('creator_auswahl_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Fehler beim Löschen des Items:', error);
      throw error;
    }
  }

  /**
   * Sortierung mehrerer Items aktualisieren
   */
  async updateItemsSortierung(items) {
    const promises = items.map((item, index) =>
      window.supabase
        .from('creator_auswahl_items')
        .update({ sortierung: index })
        .eq('id', item.id)
    );

    const results = await Promise.all(promises);
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      throw new Error('Sortierung konnte nicht aktualisiert werden');
    }
  }

  /**
   * Sortierung und Kategorie mehrerer Items aktualisieren
   */
  async updateItemsSortierungWithKategorie(items) {
    const promises = items.map((item, index) =>
      window.supabase
        .from('creator_auswahl_items')
        .update({ 
          sortierung: index,
          kategorie: item.kategorie 
        })
        .eq('id', item.id)
    );

    const results = await Promise.all(promises);
    
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('Fehler beim Aktualisieren der Sortierung/Kategorie:', errors);
      throw new Error('Sortierung konnte nicht aktualisiert werden');
    }
  }

  // =====================================================
  // SCRAPING
  // =====================================================

  /**
   * Creator-Daten über Netlify Function scrapen
   */
  async scrapeCreator(url) {
    try {
      const session = await window.supabase.auth.getSession();
      const token = session?.data?.session?.access_token || '';
      const response = await fetch('/.netlify/functions/creator-scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ url })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Scraping fehlgeschlagen');
      }

      return result.data;
    } catch (error) {
      console.error('Fehler beim Scraping:', error);
      throw error;
    }
  }

  // =====================================================
  // CRM-ÜBERNAHME
  // =====================================================

  /**
   * Creator ins CRM übernehmen
   */
  async transferToCRM(itemId) {
    // Item laden
    const { data: item, error: fetchError } = await window.supabase
      .from('creator_auswahl_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (fetchError) throw fetchError;
    if (!item) throw new Error('Item nicht gefunden');

    // Namen splitten
    const nameParts = (item.name || '').split(' ');
    const vorname = nameParts[0] || '';
    const nachname = nameParts.slice(1).join(' ') || '';

    // Handle bereinigen
    let tiktokHandle = null;
    let instagramHandle = null;
    
    if (item.plattform === 'tiktok' || item.plattform === 'both') {
      tiktokHandle = (item.creator_handle || '').replace('@', '');
    }
    if (item.plattform === 'instagram' || item.plattform === 'both') {
      instagramHandle = (item.creator_handle || '').replace('@', '');
    }

    // Creator erstellen
    const { data: creator, error: createError } = await window.supabase
      .from('creator')
      .insert({
        vorname,
        nachname,
        email: item.email,
        tiktok: tiktokHandle,
        instagram: instagramHandle,
        notizen: item.beschreibung,
        created_by: window.currentUser?.id
      })
      .select()
      .single();

    if (createError) throw createError;

    // Item mit Creator verknüpfen
    await this.updateItem(itemId, { creator_id: creator.id });

    return creator;
  }

  // =====================================================
  // DROPDOWN-DATEN
  // =====================================================

  async getAllUnternehmen() {
    const { data, error } = await window.supabase
      .from('unternehmen')
      .select('id, firmenname')
      .order('firmenname');
    if (error) throw error;
    return data;
  }

  async getAllMarken(unternehmenId = null) {
    let query = window.supabase
      .from('marke')
      .select('id, markenname, unternehmen_id')
      .order('markenname');
    if (unternehmenId) query = query.eq('unternehmen_id', unternehmenId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getAllKampagnen(markeId = null) {
    let query = window.supabase
      .from('kampagne')
      .select('id, kampagnenname, marke_id')
      .order('kampagnenname');
    if (markeId) query = query.eq('marke_id', markeId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
}

// Singleton-Instanz exportieren
export const creatorAuswahlService = new CreatorAuswahlService();

