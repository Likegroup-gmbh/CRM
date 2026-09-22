// CreatorAuswahlService.js
// Listen, Zugriff und Dropdowns. Eintraege liegen in CreatorAuswahlItems.

import { CREATOR_TYP_OPTIONS, canonicalizeCreatorTyp, isAllowedCreatorTyp } from './creatorTypeOptions.js';
import { assertBriefingForCreate, assertBriefingLinkLock } from '../briefing/BriefingLinkGuard.js';
import { strategieService } from '../strategie/StrategieService.js';
import { creatorAuswahlItemsMethods } from './CreatorAuswahlItems.js';

export class CreatorAuswahlService {
  constructor() {
    // Supabase Client wird bei jedem Aufruf direkt verwendet
  }

  _assertValidCreatorTyp(typValue) {
    const canonical = canonicalizeCreatorTyp(typValue);
    if (!isAllowedCreatorTyp(canonical)) {
      throw new Error(`Ungültige Creator Art: "${typValue}". Erlaubte Werte: ${CREATOR_TYP_OPTIONS.join(', ')}`);
    }
    return canonical;
  }

  /**
   * Alle Creator-Auswahl-Listen abrufen (mit Verknüpfungen)
   * Filtert basierend auf Benutzerrolle und Kampagnen-Zuordnung
   */
  async getAllListen() {
    const user = window.currentUser;
    
    if (window.isAdmin() || window.isInvestor?.()) {
      return this._fetchAllListen();
    }

    if (window.isKunde()) {
      const customerScope = await this._getCustomerAccessScope(user?.id);
      console.log('🔐 Kundenscope Sourcing:', customerScope);

      const allListen = await this._fetchAllListen();
      const filtered = allListen.filter((liste) => this._isInCustomerScope(liste, customerScope));

      console.log(`🔐 Listen (Kunde) gefiltert: ${filtered.length} von ${allListen.length}`);
      return filtered;
    }

    const allowedKampagneIds = await this._getAllowedKampagneIds(user);
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
        kampagne:kampagne_id(id, kampagnenname, eigener_name),
        created_by_user:created_by(id, name, profile_image_url),
        creator_auswahl_items(count),
        briefing:briefing_id(id, aktivierung_name),
        strategie:strategie_id(id, name, strategie_items(skripte(id, titel)))
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

  /**
   * Casting-Listen einer Kampagne (id + name für Switcher / Empty-Check).
   */
  async getListenByKampagneId(kampagneId) {
    if (!kampagneId) return [];
    const { data, error } = await window.supabase
      .from('creator_auswahl')
      .select('id, name, created_at')
      .eq('kampagne_id', kampagneId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Fehler beim Abrufen der Casting-Listen:', error);
      throw error;
    }
    return data || [];
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
  async _getAllowedKampagneIds(user) {
    const userId = user?.id;
    if (!userId) return [];
    
    const kampagneIds = new Set();
    
    if (window.isMitarbeiter()) {
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
      
    } else if (window.isKunde()) {
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
    if (window.isKunde()) {
      throw new Error('Keine Berechtigung zum Erstellen von Listen');
    }

    await assertBriefingForCreate(listeData, 'Casting-Liste');

    // Optionale Konzept-Verknuepfung (ADR 0010): laeuft nie direkt in den
    // Insert, sondern wird danach ueber linkCasting beidseitig gesetzt -
    // sonst entstuende ein halbes Paar (nur eine Seite geschrieben).
    const { strategie_id: konzeptId, teilbereich: _teilbereich, ...insertData } = listeData;

    const { data, error } = await window.supabase
      .from('creator_auswahl')
      .insert({
        ...insertData,
        created_by: window.currentUser?.id
      })
      .select()
      .single();

    if (error) {
      console.error('Fehler beim Erstellen der Liste:', error);
      throw error;
    }

    if (konzeptId && data?.id) {
      try {
        await strategieService.linkCasting(konzeptId, data.id);
      } catch (linkError) {
        // Liste bleibt angelegt; manueller Link im Detail bleibt moeglich.
        console.error('Fehler beim Verknüpfen des Konzepts:', linkError);
        window.toastSystem?.show('Casting-Liste angelegt, Verknüpfung mit dem Konzept fehlgeschlagen – bitte im Detail manuell verknüpfen', 'warning');
      }
    }

    return data;
  }

  /**
   * Liste aktualisieren
   */
  async updateListe(id, updates) {
    if (window.isKunde()) {
      throw new Error('Keine Berechtigung zum Bearbeiten von Listen');
    }

    await assertBriefingLinkLock('creator_auswahl', id, updates);

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
   * Prüft ob der aktuelle Benutzer die Liste löschen darf (Permission + Kampagnen-Scope).
   */
  async _assertCanDeleteListe(id) {
    if (window.isKunde()) {
      throw new Error('Keine Berechtigung zum Löschen von Listen');
    }
    if (!window.checkUserPermission('sourcing', 'delete')) {
      throw new Error('Keine Berechtigung zum Löschen von Listen');
    }
    if (window.isAdmin()) return;

    const liste = await this.getListeById(id);
    if (!liste) throw new Error('Liste nicht gefunden');
    if (!liste.kampagne_id) {
      throw new Error('Keine Berechtigung: Liste ohne Kampagnen-Zuordnung');
    }
    const allowedIds = await this._getAllowedKampagneIds(window.currentUser);
    if (!allowedIds.includes(liste.kampagne_id)) {
      throw new Error('Keine Berechtigung: Liste außerhalb des zugewiesenen Bereichs');
    }
  }

  /**
   * Liste löschen (inkl. aller Items)
   */
  async deleteListe(id) {
    await this._assertCanDeleteListe(id);
    
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

Object.assign(CreatorAuswahlService.prototype, creatorAuswahlItemsMethods);

/**
 * Handle aus einem Profil-Link ziehen: aus "https://tiktok.com/@name/" oder
 * "https://www.instagram.com/name" wird "name". Funktioniert auch, wenn
 * statt einer URL direkt ein Handle eingetragen wurde.
 */
export function handleAusLink(url) {
  if (!url) return null;
  const clean = String(url).trim().replace(/[?#].*$/, '').replace(/\/+$/, '');
  if (!clean) return null;
  const segments = clean.split('/').filter(Boolean);
  const handle = (segments.pop() || '').replace(/^@/, '').trim();
  if (!handle) return null;
  // Nackte Domain ohne Pfad ("https://www.instagram.com") ist kein Handle
  if (segments.length > 0 && segments.every(s => s.endsWith(':'))) return null;
  return handle;
}

// Singleton-Instanz exportieren
export const creatorAuswahlService = new CreatorAuswahlService();
