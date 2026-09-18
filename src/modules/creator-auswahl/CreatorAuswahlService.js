// CreatorAuswahlService.js
// Service für Creator-Auswahl Datenbank-Operationen

import { CREATOR_TYP_OPTIONS, canonicalizeCreatorTyp, isAllowedCreatorTyp, normalizeCreatorTyp } from './creatorTypeOptions.js';
import { authorizedFetch } from '../../core/auth/getAccessToken.js';
import { assertBriefingForCreate, assertBriefingLinkLock } from '../briefing/BriefingLinkGuard.js';
import { strategieService } from '../strategie/StrategieService.js';

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
        creator:creator_id(id, vorname, nachname, instagram, tiktok),
        persona:persona_id(id, name)
      `)
      .eq('creator_auswahl_id', listeId)
      .order('sortierung', { ascending: true });

    if (error) {
      console.error('Fehler beim Abrufen der Items:', error);
      throw error;
    }

    return data;
  }

  async getListeIdsForCreator(creatorId) {
    if (!creatorId) return [];
    const { data, error } = await window.supabase
      .from('creator_auswahl_items')
      .select('creator_auswahl_id')
      .eq('creator_id', creatorId);

    if (error) {
      console.error('Fehler beim Abrufen der Casting-Zuordnungen:', error);
      throw error;
    }

    return [...new Set((data || []).map((row) => row.creator_auswahl_id).filter(Boolean))];
  }

  /**
   * Briefing-Personas der Liste in Array-Reihenfolge.
   */
  async loadBriefingPersonas(liste) {
    const briefingId = liste?.briefing_id;
    if (!briefingId) return [];

    const { data: briefing, error: briefingError } = await window.supabase
      .from('campaign_briefings')
      .select('persona_ids')
      .eq('id', briefingId)
      .maybeSingle();
    if (briefingError) throw briefingError;

    const ids = Array.isArray(briefing?.persona_ids)
      ? briefing.persona_ids.filter(Boolean)
      : [];
    if (!ids.length) return [];

    const { data, error } = await window.supabase
      .from('personas')
      .select('id, name, oberbegriff')
      .in('id', ids);
    if (error) throw error;

    const byId = new Map((data || []).map(p => [p.id, p]));
    return ids.map(id => byId.get(id)).filter(Boolean);
  }

  /**
   * CRM-Creator als Casting-Eintrag anlegen. Wirft, wenn der Creator
   * auf dieser Liste schon mit creator_id haengt.
   */
  async addCreatorFromStammdaten(listeId, creatorId, personaId) {
    if (!listeId || !creatorId) {
      throw new Error('Casting und Creator sind erforderlich');
    }
    if (!personaId) {
      throw new Error('Bitte eine Persona wählen');
    }

    const { data: existing, error: existingError } = await window.supabase
      .from('creator_auswahl_items')
      .select('id')
      .eq('creator_auswahl_id', listeId)
      .eq('creator_id', creatorId)
      .limit(1);

    if (existingError) throw existingError;
    if (existing?.length) {
      throw new Error('Creator ist bereits auf diesem Casting');
    }

    const { data: creator, error: creatorError } = await window.supabase
      .from('creator')
      .select('id, vorname, nachname, instagram, instagram_follower, tiktok, tiktok_follower, lieferadresse_stadt, mail, telefonnummer')
      .eq('id', creatorId)
      .single();

    if (creatorError) throw creatorError;
    if (!creator) throw new Error('Creator nicht gefunden');

    const { data: lastRows, error: sortError } = await window.supabase
      .from('creator_auswahl_items')
      .select('sortierung')
      .eq('creator_auswahl_id', listeId)
      .order('sortierung', { ascending: false, nullsFirst: false })
      .limit(1);

    if (sortError) throw sortError;
    const sortierung = (lastRows?.[0]?.sortierung ?? -1) + 1;

    return this.createItem({
      ...buildCastingEintragFromCreator(creator, listeId, sortierung),
      persona_id: personaId
    });
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
   * Item löschen (Defense-in-Depth: Client-seitiger Scope-Check, RLS sichert zusätzlich ab)
   *
   * Haengt der Eintrag an Videoideen, werden deren Zuordnungen vorher geloest
   * (creator_auswahl_item_id -> NULL). Ideen mit Skript sind eingefroren:
   * dort blockt das Loeschen, weil sonst die Skript-Vorlage ihren Creator
   * verliert.
   */
  async deleteItem(id) {
    if (window.isKunde()) {
      throw new Error('Keine Berechtigung zum Löschen von Creator-Einträgen');
    }
    if (!window.checkUserPermission('sourcing', 'delete')) {
      throw new Error('Keine Berechtigung zum Löschen von Creator-Einträgen');
    }

    await this._loeseVideoideeZuordnungen(id, 'gelöscht');

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
   * Loesung der Zuordnung an allen Videoideen, die diesen Casting-Eintrag
   * tragen. Wirft, wenn eine davon eingefroren ist (Skript existiert).
   * @param {string} auswahlItemId
   * @param {string} aktion - 'gelöscht' | 'abgesagt' (nur fuer Fehlertext)
   */
  async _loeseVideoideeZuordnungen(auswahlItemId, aktion) {
    const { data: ideen, error } = await window.supabase
      .from('strategie_items')
      .select('id')
      .eq('creator_auswahl_item_id', auswahlItemId);
    if (error) throw error;
    if (!ideen || ideen.length === 0) return;

    const ids = ideen.map(i => i.id);
    const { data: skripte, error: sErr } = await window.supabase
      .from('skripte')
      .select('strategie_item_id')
      .in('strategie_item_id', ids);
    if (sErr) throw sErr;

    if (skripte && skripte.length > 0) {
      throw new Error(
        `Der Eintrag kann nicht ${aktion} werden: mindestens eine verknüpfte Videoidee hat bereits ein Skript. ` +
        'Bitte zuerst die Vorlage am Skript lösen.'
      );
    }

    const { error: upErr } = await window.supabase
      .from('strategie_items')
      .update({
        creator_auswahl_item_id: null,
        skript_freigabe: false,
        skript_freigabe_am: null,
        skript_freigabe_von: null
      })
      .in('id', ids);
    if (upErr) throw upErr;
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
   * Sortierung und Persona-Gruppe mehrerer Items aktualisieren
   */
  async updateItemsSortierungWithKategorie(items) {
    const promises = items.map((item, index) =>
      window.supabase
        .from('creator_auswahl_items')
        .update({
          sortierung: index,
          persona_id: item.persona_id ?? null,
          kategorie: item.kategorie ?? null
        })
        .eq('id', item.id)
    );

    const results = await Promise.all(promises);

    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('Fehler beim Aktualisieren der Sortierung/Persona:', errors);
      throw new Error('Sortierung konnte nicht aktualisiert werden');
    }
  }

  async updateItemsGroup(itemIds, updates) {
    const { data, error } = await window.supabase
      .from('creator_auswahl_items')
      .update(updates)
      .in('id', itemIds)
      .select();

    if (error) {
      console.error('Fehler beim Batch-Update der Persona-Gruppe:', error);
      throw error;
    }

    return data;
  }

  // =====================================================
  // SCRAPING
  // =====================================================

  /**
   * Creator-Daten über Netlify Function scrapen
   */
  async scrapeCreator(url) {
    try {
      const response = await authorizedFetch('/.netlify/functions/creator-scrape', {
        method: 'POST',
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

  /**
   * Instagram-Profil, Follower und CPM-Werte fuer eine Zeile abrufen.
   * Die Netlify Function schreibt direkt in creator_auswahl_items und
   * liefert das aktualisierte Item zurueck.
   *
   * Ohne force wird der Creator-Pool (sourcing_creator) bevorzugt: kennt er
   * den Handle schon, kommen die Werte von dort und Meta bleibt verschont.
   * @returns {Promise<{ item: object, source: 'pool'|'meta', poolFetchedAt: string|null, debug: object|null }>}
   */
  async fetchInstagramStats(itemId, { force = false } = {}) {
    const response = await authorizedFetch('/.netlify/functions/sourcing-instagram-stats', {
      method: 'POST',
      body: JSON.stringify({ item_id: itemId, force })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      const error = new Error(result.error || 'Instagram-Abruf fehlgeschlagen');
      error.retryable = response.status === 429;
      error.hint = result.hint || null;
      throw error;
    }

    return {
      item: result.item,
      source: result.source || 'meta',
      poolFetchedAt: result.pool_fetched_at || null,
      debug: result.debug || null
    };
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

function parseFollowerCount(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const str = String(value).trim();
  if (!str) return null;
  if (str.includes('+')) return parseInt(str.replace('+', ''), 10) || null;
  const parts = str.split('-');
  if (parts.length === 2) {
    const min = parseInt(parts[0], 10);
    const max = parseInt(parts[1], 10);
    if (!Number.isNaN(min) && !Number.isNaN(max)) return Math.round((min + max) / 2);
  }
  const parsed = parseInt(str, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function socialProfileUrl(handleOrUrl, kind) {
  if (!handleOrUrl) return null;
  const raw = String(handleOrUrl).trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, '');
  return kind === 'tiktok'
    ? `https://tiktok.com/@${handle}`
    : `https://instagram.com/${handle}`;
}

export function buildCastingEintragFromCreator(creator, listeId, sortierung) {
  const name = `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim() || null;
  return {
    creator_auswahl_id: listeId,
    creator_id: creator?.id || null,
    typ: 'Influencer',
    name,
    link_instagram: socialProfileUrl(creator?.instagram, 'instagram'),
    follower_instagram: parseFollowerCount(creator?.instagram_follower),
    link_tiktok: socialProfileUrl(creator?.tiktok, 'tiktok'),
    follower_tiktok: parseFollowerCount(creator?.tiktok_follower),
    wohnort: creator?.lieferadresse_stadt || null,
    email: creator?.mail || null,
    telefon: creator?.telefonnummer || null,
    sortierung
  };
}

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

