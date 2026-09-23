// StrategieService.js
// Service für Strategie-Datenbank-Operationen

import { assertBriefingForCreate, assertBriefingLinkLock } from '../briefing/BriefingLinkGuard.js';
import { loadBriefingProdukte } from '../briefing/BriefingProdukte.js';
import { VIDEOIDEE_VORSCHLAG_ERROR, VORSCHLAG_EDIT_FIELDS } from './videoideeVorschlag.js';
import {
  castingUmsetzungGate,
  CASTING_UMSETZUNG_GATE_ERROR,
  CASTING_CREATOR_PFLICHT_ERROR
} from '../creator-auswahl/sourcingStatusOptions.js';

export class StrategieService {
  /**
   * Jeder Lauf startet ein eigenes Chromium. Mehr als zwei parallel treiben die
   * Netlify-Function-Last unnoetig hoch, ohne dass es spuerbar schneller wird.
   */
  static MAX_PARALLELE_VERARBEITUNGEN = 2;

  constructor() {
    // Supabase Client wird bei jedem Aufruf direkt verwendet
  }

  /**
   * Alle Strategien abrufen (mit Verknüpfungen)
   * Filtert basierend auf Benutzerrolle und Kampagnen-Zuordnung
   */
  async getAllStrategien() {
    const user = window.currentUser;

    // Admin und Investor sehen alle Strategien
    if (window.isAdmin() || window.isInvestor?.()) {
      return this._fetchAllStrategien();
    }

    if (window.isKunde()) {
      const customerScope = await this._getCustomerAccessScope(user?.id);
      console.log('🔐 Kundenscope Strategie:', customerScope);

      const allStrategien = await this._fetchAllStrategien();
      const filtered = allStrategien.filter((strategie) => this._isInCustomerScope(strategie, customerScope));

      console.log(`🔐 Strategien (Kunde) gefiltert: ${filtered.length} von ${allStrategien.length}`);
      return filtered;
    }

    // Für Mitarbeiter: erlaubte Kampagnen ermitteln
    const allowedKampagneIds = await this._getAllowedKampagneIds(user);
    console.log('🔐 Erlaubte Kampagnen für Benutzer:', allowedKampagneIds);

    const allStrategien = await this._fetchAllStrategien();
    const filtered = allStrategien.filter(
      (s) => s.kampagne_id && allowedKampagneIds.includes(s.kampagne_id)
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
        unternehmen:unternehmen_id(id, firmenname, internes_kuerzel, logo_url),
        marke:marke_id(id, markenname, logo_url, unternehmen:unternehmen_id(internes_kuerzel)),
        kampagne:kampagne_id(id, kampagnenname, eigener_name),
        auftrag:auftrag_id(id, auftragsname),
        created_by_user:created_by(id, name, profile_image_url),
        briefing:briefing_id(id, aktivierung_name),
        creator_auswahl:creator_auswahl_id(id, name),
        strategie_items(skripte(id, titel))
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fehler beim Abrufen der Strategien:', error);
      throw error;
    }

    return data;
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
   * - Mitarbeiter: via kampagne_mitarbeiter, mitarbeiter_unternehmen, marke_mitarbeiter
   * - Kunden: via kunde_unternehmen, kunde_marke
   */
  async _getAllowedKampagneIds(user) {
    const userId = user?.id;
    if (!userId) return [];
    
    const kampagneIds = new Set();
    
    if (window.isMitarbeiter()) {
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
      
    } else if (window.isKunde()) {
      const customerScope = await this._getCustomerAccessScope(userId);
      customerScope.kampagneIds.forEach((id) => kampagneIds.add(id));
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
        unternehmen:unternehmen_id(id, firmenname, internes_kuerzel, logo_url),
        marke:marke_id(id, markenname, logo_url, unternehmen:unternehmen_id(internes_kuerzel)),
        kampagne:kampagne_id(id, kampagnenname, eigener_name),
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
    // Gäste (Share-Link): Zugriff wird serverseitig via RLS auf die geteilte Liste beschränkt
    const user = window.currentUser;
    
    if (!window.isAdmin() && !window.isInvestor?.() && !window.isGast?.() && data?.kampagne_id) {
      const allowedKampagneIds = await this._getAllowedKampagneIds(user);
      
      if (!allowedKampagneIds.includes(data.kampagne_id)) {
        console.warn('🔐 Zugriff verweigert: Benutzer hat keinen Zugriff auf diese Strategie');
        throw new Error('Keine Berechtigung für dieses Konzept');
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
    if (window.isKunde()) {
      console.warn('🔐 Kunden dürfen keine Strategien erstellen');
      throw new Error('Keine Berechtigung zum Erstellen von Konzepten');
    }

    // Leere Strings in UUID-Feldern zu null konvertieren
    const uuidFields = ['unternehmen_id', 'marke_id', 'kampagne_id', 'produktion_id', 'auftrag_id', 'briefing_id'];
    for (const field of uuidFields) {
      if (strategieData[field] === '') {
        strategieData[field] = null;
      }
    }

    await assertBriefingForCreate(strategieData, 'Konzept');

    // Optionale Casting-Verknuepfung (ADR 0010): laeuft nie direkt in den
    // Insert, sondern wird danach ueber linkCasting beidseitig gesetzt -
    // sonst entstuende ein halbes Paar (nur eine Seite geschrieben).
    const { creator_auswahl_id: castingId, ...insertData } = strategieData;

    const { data, error } = await window.supabase
      .from('strategie')
      .insert({
        ...insertData,
        created_by: window.currentUser?.id
      })
      .select()
      .single();

    if (error) {
      console.error('Fehler beim Erstellen der Strategie:', error);
      throw error;
    }

    if (castingId && data?.id) {
      try {
        await this.linkCasting(data.id, castingId);
      } catch (linkError) {
        // Konzept bleibt angelegt; manueller Link im Detail bleibt moeglich.
        console.error('Fehler beim Verknüpfen des Castings:', linkError);
        window.toastSystem?.show('Konzept angelegt, Verknüpfung mit dem Casting fehlgeschlagen – bitte im Detail manuell verknüpfen', 'warning');
      }
    }

    return data;
  }

  /**
   * Strategie aktualisieren
   * Nur für Admins und Mitarbeiter - Kunden dürfen Strategien nicht bearbeiten
   */
  async updateStrategie(id, updates) {
    // Berechtigungsprüfung: Kunden dürfen Strategien nicht bearbeiten
    if (window.isKunde()) {
      console.warn('🔐 Kunden dürfen Strategien nicht bearbeiten');
      throw new Error('Keine Berechtigung zum Bearbeiten von Konzepten');
    }

    // Leere Strings in UUID-Feldern zu null konvertieren
    const uuidFields = ['unternehmen_id', 'marke_id', 'kampagne_id', 'produktion_id', 'auftrag_id', 'briefing_id'];
    for (const field of uuidFields) {
      if (updates[field] === '') {
        updates[field] = null;
      }
    }

    await assertBriefingLinkLock('strategie', id, updates);

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
   * Berechtigungsprüfung über Permission-System
   */
  async deleteStrategie(id) {
    // Berechtigungsprüfung über Permission-System
    const canDelete = window.currentUser?.permissions?.strategie?.can_delete || false;
    if (!canDelete) {
      console.warn('🔐 Keine Berechtigung zum Löschen von Konzepten');
      throw new Error('Keine Berechtigung zum Löschen von Konzepten');
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
   * Screenshot aus dem Bucket entfernen. Storage-Fehler blockieren den Caller nicht.
   */
  async deleteScreenshot(screenshotUrl) {
    if (!screenshotUrl) return;

    const storagePath = this.extractStoragePath(screenshotUrl);
    if (!storagePath) return;

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

  /**
   * Items einer Strategie abrufen (inkl. Verknüpfungs-Status)
   */
  async getStrategieItems(strategieId) {
    let q = window.supabase
      .from('strategie_items')
      .select(`
        *,
        creator:creator_id(id, vorname, nachname, instagram, tiktok),
        produkt:produkt_id(id, name),
        casting_eintrag:creator_auswahl_item_id(id, name, creator_id, link_instagram, link_tiktok, zusage, gebucht, creator:creator_id(id, vorname, nachname))
      `)
      .eq('strategie_id', strategieId)
      .order('sortierung', { ascending: true });

    // Kunde inkl. Gast: keine Videoidee-Vorschlaege (ADR 0015)
    if (window.isKunde?.()) q = q.eq('ist_vorschlag', false);

    const { data, error } = await q;

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
    const gated = Object.keys(updates || {}).some((k) => !VORSCHLAG_EDIT_FIELDS.includes(k));
    if (gated) await this.assertKeinVorschlag(id);

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

    if (item?.screenshot_url) {
      await this.deleteScreenshot(item.screenshot_url);
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
   * Verarbeitung eines Items anstossen: Screenshot + Transkription laufen in
   * einer Netlify Background Function, die sofort 202 antwortet. Fortschritt und
   * Ergebnis kommen ueber Realtime auf strategie_items zurueck.
   */
  async triggerItemProcessing(itemId) {
    const session = await window.supabase.auth.getSession();
    const token = session?.data?.session?.access_token || '';

    const response = await fetch('/.netlify/functions/strategie-item-background', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ itemId })
    });

    // 202 = Background Function angenommen, 409 = laeuft bereits (kein Fehler)
    if (response.status !== 202 && response.status !== 409 && !response.ok) {
      throw new Error(`Verarbeitung konnte nicht gestartet werden: HTTP ${response.status}`);
    }
  }

  /**
   * Item zur Verarbeitung einreihen. Es laufen hoechstens
   * MAX_PARALLELE_VERARBEITUNGEN Chromium-Instanzen gleichzeitig; alles weitere
   * bleibt auf 'pending' und wird vom jeweils fertigen Lauf nachgezogen.
   */
  async enqueueItemProcessing(strategieId, itemId) {
    const { count } = await window.supabase
      .from('strategie_items')
      .select('id', { count: 'exact', head: true })
      .eq('strategie_id', strategieId)
      .eq('verarbeitung_status', 'processing');

    if ((count || 0) >= StrategieService.MAX_PARALLELE_VERARBEITUNGEN) return false;

    await this.triggerItemProcessing(itemId);
    return true;
  }

  /**
   * Item erneut verarbeiten (Screenshot und Transkript neu holen).
   */
  async reprocessItem(itemId) {
    await this.updateStrategieItem(itemId, {
      verarbeitung_status: 'pending',
      verarbeitung_step: null,
      verarbeitung_fehler: null
    });
    await this.triggerItemProcessing(itemId);
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

  // ------------------------------------------------------------------
  // Casting ↔ Konzept (1:1-Paar) und Casting-Eintrag an der Videoidee
  // ------------------------------------------------------------------

  /**
   * Skript-Freeze: existiert mindestens ein Skript mit dieser Videoidee als
   * Vorlage, ist die Creator-Zuordnung eingefroren. Escape ist die Vorlage
   * am Skript loesen (strategie_item_id auf NULL), nicht die Zuordnung.
   */
  async hasSkriptForItem(itemId) {
    if (!itemId) return false;
    const { count, error } = await window.supabase
      .from('skripte')
      .select('id', { count: 'exact', head: true })
      .eq('strategie_item_id', itemId);
    if (error) throw error;
    return (count || 0) > 0;
  }

  /**
   * Verknuepft ein Konzept mit einem Casting (1:1). Beide muessen dieselbe
   * Kampagne und dasselbe briefing_id tragen (inkl. beide NULL). Das
   * Gegenstueck muss unverknuepft sein. Schreibt beide Seiten.
   */
  async linkCasting(strategieId, creatorAuswahlId) {
    const { data: strategie, error: sErr } = await window.supabase
      .from('strategie')
      .select('id, kampagne_id, briefing_id, creator_auswahl_id')
      .eq('id', strategieId)
      .single();
    if (sErr || !strategie) throw new Error('Konzept nicht gefunden');

    const { data: casting, error: cErr } = await window.supabase
      .from('creator_auswahl')
      .select('id, kampagne_id, briefing_id, strategie_id')
      .eq('id', creatorAuswahlId)
      .single();
    if (cErr || !casting) throw new Error('Casting nicht gefunden');

    if (strategie.creator_auswahl_id) {
      throw new Error('Dieses Konzept ist bereits mit einem Casting verknüpft.');
    }
    if (casting.strategie_id) {
      throw new Error('Dieses Casting ist bereits mit einem Konzept verknüpft.');
    }
    if ((strategie.kampagne_id || null) !== (casting.kampagne_id || null)) {
      throw new Error('Konzept und Casting gehören zu unterschiedlichen Kampagnen.');
    }
    if ((strategie.briefing_id || null) !== (casting.briefing_id || null)) {
      throw new Error('Konzept und Casting haben unterschiedliche Briefings.');
    }

    const { error: upErr } = await window.supabase
      .from('strategie')
      .update({ creator_auswahl_id: creatorAuswahlId })
      .eq('id', strategieId);
    if (upErr) throw upErr;

    const { error: upErr2 } = await window.supabase
      .from('creator_auswahl')
      .update({ strategie_id: strategieId })
      .eq('id', creatorAuswahlId);
    if (upErr2) {
      // Rueckgaengig, damit kein halbes Paar stehen bleibt
      await window.supabase.from('strategie').update({ creator_auswahl_id: null }).eq('id', strategieId);
      throw upErr2;
    }
  }

  /**
   * Loesung des Paars. Nur moeglich, solange keine Videoidee einen
   * Casting-Eintrag aus diesem Casting traegt - sonst wuerden Zuordnungen
   * ihre Quelle verlieren.
   */
  async unlinkCasting(strategieId) {
    const { data: strategie, error: sErr } = await window.supabase
      .from('strategie')
      .select('id, creator_auswahl_id')
      .eq('id', strategieId)
      .single();
    if (sErr || !strategie) throw new Error('Konzept nicht gefunden');
    if (!strategie.creator_auswahl_id) return;

    const { count, error: cntErr } = await window.supabase
      .from('strategie_items')
      .select('id', { count: 'exact', head: true })
      .eq('strategie_id', strategieId)
      .not('creator_auswahl_item_id', 'is', null);
    if (cntErr) throw cntErr;
    if ((count || 0) > 0) {
      throw new Error('Es sind noch Videoideen mit einem Casting-Eintrag verknüpft. Zuerst dort lösen.');
    }

    const castingId = strategie.creator_auswahl_id;
    const { error: upErr } = await window.supabase
      .from('strategie')
      .update({ creator_auswahl_id: null })
      .eq('id', strategieId);
    if (upErr) throw upErr;

    await window.supabase
      .from('creator_auswahl')
      .update({ strategie_id: null })
      .eq('id', castingId);
  }

  /**
   * Ordnet einer Videoidee einen Casting-Eintrag zu. Gates:
   * - Konzept muss mit dem Casting des Eintrags verknuepft sein
   * - Eintrag: Kunden-Prio plus Zusage oder Gebucht plus creator_id
   * - Zuordnung ist eingefroren, sobald ein Skript aus der Idee existiert
   */
  async assignCastingItem(itemId, auswahlItemId) {
    const { data: item, error: iErr } = await window.supabase
      .from('strategie_items')
      .select('id, strategie_id, creator_auswahl_item_id, ist_vorschlag')
      .eq('id', itemId)
      .single();
    if (iErr || !item) throw new Error('Videoidee nicht gefunden');
    if (item.ist_vorschlag) throw new Error(VIDEOIDEE_VORSCHLAG_ERROR);

    const { data: strategie, error: sErr } = await window.supabase
      .from('strategie')
      .select('id, creator_auswahl_id')
      .eq('id', item.strategie_id)
      .single();
    if (sErr || !strategie) throw new Error('Konzept nicht gefunden');
    if (!strategie.creator_auswahl_id) {
      throw new Error('Dieses Konzept ist mit keinem Casting verknüpft.');
    }

    const { data: eintrag, error: eErr } = await window.supabase
      .from('creator_auswahl_items')
      .select('id, creator_auswahl_id, zusage, gebucht, prio_1, prio_2, name, creator_id')
      .eq('id', auswahlItemId)
      .single();
    if (eErr || !eintrag) throw new Error('Casting-Eintrag nicht gefunden');

    if (eintrag.creator_auswahl_id !== strategie.creator_auswahl_id) {
      throw new Error('Der Eintrag gehört nicht zum verknüpften Casting.');
    }
    if (!castingUmsetzungGate(eintrag)) {
      throw new Error(CASTING_UMSETZUNG_GATE_ERROR);
    }
    if (!eintrag.creator_id) {
      throw new Error(CASTING_CREATOR_PFLICHT_ERROR);
    }

    if (item.creator_auswahl_item_id && item.creator_auswahl_item_id !== auswahlItemId) {
      if (await this.hasSkriptForItem(itemId)) {
        throw new Error('Die Zuordnung ist eingefroren, weil bereits ein Skript aus dieser Idee existiert.');
      }
    }

    await this.updateStrategieItem(itemId, { creator_auswahl_item_id: auswahlItemId });
  }

  /**
   * Loesung der Zuordnung. Blockt, sobald ein Skript aus der Idee existiert.
   */
  async unassignCastingItem(itemId) {
    await this.assertKeinVorschlag(itemId);
    if (await this.hasSkriptForItem(itemId)) {
      throw new Error('Die Zuordnung ist eingefroren, weil bereits ein Skript aus dieser Idee existiert.');
    }
    await this.updateStrategieItem(itemId, {
      creator_auswahl_item_id: null,
      ...skriptFreigabeClearPatch()
    });
  }

  /**
   * Produkte des Briefings an diesem Konzept. Ohne Briefing leer.
   */
  async getBriefingProdukte(strategieId) {
    if (!strategieId) return [];
    const { data: strategie, error } = await window.supabase
      .from('strategie')
      .select('id, briefing_id')
      .eq('id', strategieId)
      .single();
    if (error || !strategie?.briefing_id) return [];
    return loadBriefingProdukte(strategie.briefing_id);
  }

  /**
   * Ordnet einer Videoidee ein Produkt aus dem Briefing des Konzepts zu.
   * Eingefroren, sobald ein Skript aus der Idee existiert.
   */
  async assignProdukt(itemId, produktId) {
    const { data: item, error: iErr } = await window.supabase
      .from('strategie_items')
      .select('id, strategie_id, produkt_id, ist_vorschlag')
      .eq('id', itemId)
      .single();
    if (iErr || !item) throw new Error('Videoidee nicht gefunden');
    if (item.ist_vorschlag) throw new Error(VIDEOIDEE_VORSCHLAG_ERROR);
    if (!produktId) throw new Error('Kein Produkt gewählt.');

    if (item.produkt_id && item.produkt_id !== produktId) {
      if (await this.hasSkriptForItem(itemId)) {
        throw new Error('Die Zuordnung ist eingefroren, weil bereits ein Skript aus dieser Idee existiert.');
      }
    }

    const produkte = await this.getBriefingProdukte(item.strategie_id);
    const produkt = produkte.find(p => p.id === produktId);
    if (!produkt) throw new Error('Das Produkt gehört nicht zum Briefing dieses Konzepts.');

    await this.updateStrategieItem(itemId, { produkt_id: produktId });
    return produkt;
  }

  /**
   * Loest die Produkt-Zuordnung. Blockt, sobald ein Skript aus der Idee
   * existiert. Nimmt die Skript-Freigabe mit, sonst bliebe eine Freigabe
   * ohne Produkt stehen.
   */
  async unassignProdukt(itemId) {
    await this.assertKeinVorschlag(itemId);
    if (await this.hasSkriptForItem(itemId)) {
      throw new Error('Die Zuordnung ist eingefroren, weil bereits ein Skript aus dieser Idee existiert.');
    }
    await this.updateStrategieItem(itemId, {
      produkt_id: null,
      ...skriptFreigabeClearPatch()
    });
  }

  /**
   * Skript-Freigabe setzen oder zuruecknehmen. Gate nur fuer Neuanlage.
   * Freigeben nur mit Casting-Eintrag und ohne „Nicht umsetzen“.
   * Ohne Produkt und mit genau einem Briefing-Produkt wird das gesetzt.
   * Bei mehreren Produkten ohne Zuordnung bleibt die Freigabe zu.
   * Gibt das automatisch gesetzte Produkt zurueck, sonst null.
   */
  async setSkriptFreigabe(itemId, flag) {
    const { data: item, error } = await window.supabase
      .from('strategie_items')
      .select('id, strategie_id, creator_auswahl_item_id, nicht_umsetzen, ist_vorschlag, produkt_id')
      .eq('id', itemId)
      .single();
    if (error || !item) throw new Error('Videoidee nicht gefunden');
    if (item.ist_vorschlag) throw new Error(VIDEOIDEE_VORSCHLAG_ERROR);

    if (flag) {
      if (!item.creator_auswahl_item_id) {
        throw new Error('Zuerst einen Casting-Eintrag zuordnen.');
      }
      if (item.nicht_umsetzen) {
        throw new Error('Ideen mit „Nicht umsetzen“ können nicht freigegeben werden.');
      }

      let produkt = null;
      if (!item.produkt_id) {
        const produkte = await this.getBriefingProdukte(item.strategie_id);
        if (produkte.length > 1) {
          throw new Error('Zuerst ein Produkt zuordnen.');
        }
        if (produkte.length === 1) produkt = produkte[0];
      }

      const patch = {
        skript_freigabe: true,
        skript_freigabe_am: new Date().toISOString(),
        skript_freigabe_von: window.currentUser?.id || null
      };
      if (produkt) patch.produkt_id = produkt.id;
      await this.updateStrategieItem(itemId, patch);
      return produkt;
    }

    await this.updateStrategieItem(itemId, skriptFreigabeClearPatch());
    return null;
  }

  /**
   * Eintraege des mit einem Konzept verknuepften Castings, die einer
   * Videoidee zugeordnet werden duerfen (Prio plus Zusage/Gebucht).
   * Ohne creator_id bleiben sie waehlbar — der Drawer legt den Creator zuerst an.
   */
  async getZuordbareCastingItems(strategieId) {
    const { data: strategie, error: sErr } = await window.supabase
      .from('strategie')
      .select('id, creator_auswahl_id')
      .eq('id', strategieId)
      .single();
    if (sErr || !strategie || !strategie.creator_auswahl_id) return { castingId: null, items: [] };

    const { data, error } = await window.supabase
      .from('creator_auswahl_items')
      .select('id, name, creator_id, link_instagram, link_tiktok, zusage, gebucht, prio_1, prio_2')
      .eq('creator_auswahl_id', strategie.creator_auswahl_id)
      .order('sortierung', { ascending: true });
    if (error) throw error;

    return {
      castingId: strategie.creator_auswahl_id,
      items: (data || []).filter(i => castingUmsetzungGate(i))
    };
  }

  /**
   * Videoideen des mit einem Casting gepaarten Konzepts, die diesem
   * Casting-Eintrag zugeordnet werden duerfen. Frei oder bereits dieser
   * Eintrag: waehlbar. Anderer Eintrag oder Skript-Freeze: disabled.
   */
  async getZuordbareVideoideen(strategieId, auswahlItemId) {
    const { data: strategie, error: sErr } = await window.supabase
      .from('strategie')
      .select('id, creator_auswahl_id')
      .eq('id', strategieId)
      .single();
    if (sErr || !strategie) throw new Error('Konzept nicht gefunden');
    if (!strategie.creator_auswahl_id) return { strategieId: null, items: [] };

    const { data, error } = await window.supabase
      .from('strategie_items')
      .select(`
        id, beschreibung, video_link, creator_auswahl_item_id, ist_vorschlag,
        casting_eintrag:creator_auswahl_item_id(id, name)
      `)
      .eq('strategie_id', strategieId)
      .order('sortierung', { ascending: true });
    if (error) throw error;

    const items = (data || []).filter(i => !i.ist_vorschlag);
    const ids = items.map(i => i.id);
    const frozenIds = new Set();
    if (ids.length) {
      const { data: skripte, error: skErr } = await window.supabase
        .from('skripte')
        .select('strategie_item_id')
        .in('strategie_item_id', ids);
      if (skErr) throw skErr;
      (skripte || []).forEach(s => {
        if (s.strategie_item_id) frozenIds.add(s.strategie_item_id);
      });
    }

    return {
      strategieId: strategie.id,
      items: items.map(item => {
        const eigen = item.creator_auswahl_item_id === auswahlItemId;
        const fremd = !!item.creator_auswahl_item_id && !eigen;
        const frozen = frozenIds.has(item.id);
        const disabled = fremd || (frozen && !eigen);
        let disabledReason = '';
        if (fremd) {
          const name = item.casting_eintrag?.name;
          disabledReason = name
            ? `Hängt schon an ${name}`
            : 'Bereits einem anderen Eintrag zugeordnet';
        } else if (frozen && !eigen) {
          disabledReason = 'Zuordnung eingefroren (Skript existiert)';
        }
        return { ...item, eigen, fremd, frozen, disabled, disabledReason };
      })
    };
  }

  async assertKeinVorschlag(itemId) {
    const { data, error } = await window.supabase
      .from('strategie_items')
      .select('ist_vorschlag')
      .eq('id', itemId)
      .single();
    if (error || !data) throw new Error('Videoidee nicht gefunden');
    if (data.ist_vorschlag) throw new Error(VIDEOIDEE_VORSCHLAG_ERROR);
  }

  /**
   * Videoidee-Vorschlag zur normalen Videoidee machen (ADR 0015).
   * Flag weg, landet in Ohne Kategorie.
   */
  async uebernehmenVideoideeVorschlag(itemId) {
    const { data, error } = await window.supabase
      .from('strategie_items')
      .update({ ist_vorschlag: false, teilbereich: null })
      .eq('id', itemId)
      .eq('ist_vorschlag', true)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new Error('Kein Videoidee-Vorschlag');
    return data;
  }

  async uebernehmenAlleVideoideeVorschlaege(strategieId) {
    const { data, error } = await window.supabase
      .from('strategie_items')
      .update({ ist_vorschlag: false, teilbereich: null })
      .eq('strategie_id', strategieId)
      .eq('ist_vorschlag', true)
      .select('id');
    if (error) throw error;
    return data || [];
  }

  async verwerfenVideoideeVorschlag(itemId) {
    const { data, error } = await window.supabase
      .from('strategie_items')
      .select('id, ist_vorschlag')
      .eq('id', itemId)
      .single();
    if (error || !data) throw new Error('Videoidee nicht gefunden');
    if (!data.ist_vorschlag) throw new Error('Nur Videoidee-Vorschläge können so verworfen werden.');
    await this.deleteStrategieItem(itemId);
  }

  async verwerfenAlleVideoideeVorschlaege(strategieId) {
    const { data, error } = await window.supabase
      .from('strategie_items')
      .select('id')
      .eq('strategie_id', strategieId)
      .eq('ist_vorschlag', true);
    if (error) throw error;
    for (const row of data || []) {
      await this.deleteStrategieItem(row.id);
    }
    return data || [];
  }
}

function skriptFreigabeClearPatch() {
  return {
    skript_freigabe: false,
    skript_freigabe_am: null,
    skript_freigabe_von: null
  };
}

// Singleton-Instanz exportieren
export const strategieService = new StrategieService();
export { skriptFreigabeClearPatch };

