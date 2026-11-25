// KampagneUtils.js (ES6-Modul)
// Hilfsfunktionen für das Kampagnen-System

// Debug-Flag für Logging (Production: false)
const DEBUG_PERMISSIONS = false;

const _permissionCache = { userId: null, data: null, timestamp: 0, TTL: 30000 };

export class KampagneUtils {
  
  // ========================================
  // ZENTRALISIERTE PERMISSION-LOGIK
  // Wird von KampagneList und KampagneCalendarView verwendet
  // ========================================

  /**
   * Prüft ob der aktuelle User Admin ist
   * @returns {boolean}
   */
  static isUserAdmin() {
    return window.isAdmin();
  }

  /**
   * Prüft ob der aktuelle User ein Kunde ist
   * @returns {boolean}
   */
  static isUserKunde() {
    return window.isKunde();
  }

  /**
   * Lädt alle Kampagnen-IDs auf die der aktuelle User Zugriff hat.
   * Zentralisierte Logik für Permission-basierte Filterung.
   * 
   * Logik:
   * - Admin: Zugriff auf alle (returns null = keine Filterung nötig)
   * - Kunde: RLS filtert automatisch (returns null)
   * - Mitarbeiter: Basierend auf:
   *   1. Direkte Kampagnen-Zuordnung (kampagne_mitarbeiter)
   *   2. Marken-Zuordnung (marke_mitarbeiter)
   *   3. Unternehmen-Zuordnung (mitarbeiter_unternehmen)
   * 
   * @returns {Promise<string[]|null>} Array von Kampagnen-IDs oder null (= keine Filterung)
   */
  static invalidatePermissionCache() {
    _permissionCache.userId = null;
    _permissionCache.data = null;
    _permissionCache.timestamp = 0;
  }

  static async loadAllowedKampagneIds() {
    try {
      const userId = window.currentUser?.id;
      if (!userId) return [];
      
      // Unscoped (Admin, Kunde, Investor, Finanzen-Klasse): keine Client-Filterung
      if (this.isUserAdmin() || this.isUserKunde() || window.isUnscoped?.()) {
        if (DEBUG_PERMISSIONS) console.log('🔓 PERMISSIONS: unscoped - keine Filterung');
        return null;
      }

      // Memoized: Ergebnis 30s lang cachen pro User
      const now = Date.now();
      if (_permissionCache.userId === userId && _permissionCache.data !== null && (now - _permissionCache.timestamp) < _permissionCache.TTL) {
        if (DEBUG_PERMISSIONS) console.log('🔓 PERMISSIONS: Cache-Hit');
        return _permissionCache.data;
      }
      
      // STUFE 1: Alle Basis-Permission-Queries PARALLEL ausführen
      const [directResult, markenResult, unternehmenResult] = await Promise.all([
        // 1. Direkt zugeordnete Kampagnen
        window.supabase
          .from('kampagne_mitarbeiter')
          .select('kampagne_id')
          .eq('mitarbeiter_id', userId),
        
        // 2. Kampagnen über zugeordnete Marken
        window.supabase
          .from('marke_mitarbeiter')
          .select('marke_id')
          .eq('mitarbeiter_id', userId),
        
        // 3. Zugeordnete Unternehmen
        window.supabase
          .from('mitarbeiter_unternehmen')
          .select('unternehmen_id')
          .eq('mitarbeiter_id', userId)
      ]);
      
      // Direkte Kampagnen-IDs
      const directKampagnenIds = (directResult.data || []).map(r => r.kampagne_id).filter(Boolean);
      
      // Zugeordnete Unternehmen-IDs
      const unternehmenIds = (unternehmenResult.data || []).map(r => r.unternehmen_id).filter(Boolean);
      
      // Marken-IDs aus marke_mitarbeiter
      const markenIds = (markenResult.data || []).map(r => r.marke_id).filter(Boolean);
      
      // Zugeordnete Marken mit ihren Unternehmen laden
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
      
      // Map: Unternehmen-ID → zugeordnete Marken-IDs (für diesen User)
      const unternehmenMarkenMap = new Map();
      markenMitUnternehmen.forEach(r => {
        if (r.unternehmen_id) {
          if (!unternehmenMarkenMap.has(r.unternehmen_id)) {
            unternehmenMarkenMap.set(r.unternehmen_id, []);
          }
          unternehmenMarkenMap.get(r.unternehmen_id).push(r.marke_id);
        }
      });
      
      // STUFE 2: Erlaubte Marken ermitteln (mit Batch-Query statt N+1)
      let allowedMarkenIds = [];
      
      // Unternehmen OHNE explizite Marken-Zuordnung
      const unternehmenOhneExpliziteMarken = unternehmenIds.filter(uid => !unternehmenMarkenMap.has(uid));
      
      // Für diese alle Marken in EINER Query laden
      let markenByUnternehmen = {};
      if (unternehmenOhneExpliziteMarken.length > 0) {
        const { data: alleMarken } = await window.supabase
          .from('marke')
          .select('id, unternehmen_id')
          .in('unternehmen_id', unternehmenOhneExpliziteMarken);
        
        markenByUnternehmen = (alleMarken || []).reduce((acc, m) => {
          if (!acc[m.unternehmen_id]) acc[m.unternehmen_id] = [];
          acc[m.unternehmen_id].push(m.id);
          return acc;
        }, {});
      }
      
      // Erlaubte Marken zusammenstellen
      for (const unternehmenId of unternehmenIds) {
        const explicitMarkenIds = unternehmenMarkenMap.get(unternehmenId);
        
        if (explicitMarkenIds && explicitMarkenIds.length > 0) {
          allowedMarkenIds.push(...explicitMarkenIds);
        } else {
          const alleMarkenIds = markenByUnternehmen[unternehmenId] || [];
          allowedMarkenIds.push(...alleMarkenIds);
        }
      }
      
      // Direkt zugeordnete Marken hinzufügen
      const direktZugeordneteMarkenIds = markenMitUnternehmen.map(r => r.marke_id);
      allowedMarkenIds.push(...direktZugeordneteMarkenIds);
      
      // Duplikate entfernen
      allowedMarkenIds = [...new Set(allowedMarkenIds)];
      
      // STUFE 3: Kampagnen für erlaubte Marken laden
      let markenKampagnenIds = [];
      if (allowedMarkenIds.length > 0) {
        const { data: kampagnen } = await window.supabase
          .from('kampagne')
          .select('id')
          .in('marke_id', allowedMarkenIds);
        
        markenKampagnenIds = (kampagnen || []).map(k => k.id).filter(Boolean);
      }
      
      // STUFE 4: Kampagnen direkt über Unternehmen
      let unternehmenKampagnenIds = [];
      if (unternehmenIds.length > 0) {
        const { data: kampagnen } = await window.supabase
          .from('kampagne')
          .select('id')
          .in('unternehmen_id', unternehmenIds);
        
        unternehmenKampagnenIds = (kampagnen || []).map(k => k.id).filter(Boolean);
      }
      
      // Alle zusammenführen und Duplikate entfernen
      const allKampagnenIds = [...new Set([
        ...directKampagnenIds,
        ...markenKampagnenIds,
        ...unternehmenKampagnenIds
      ])];
      
      if (DEBUG_PERMISSIONS) {
        console.log(`🔍 PERMISSIONS: Mitarbeiter ${userId}:`, {
          direkteKampagnen: directKampagnenIds.length,
          erlaubteMarken: allowedMarkenIds.length,
          markenKampagnen: markenKampagnenIds.length,
          unternehmenKampagnen: unternehmenKampagnenIds.length,
          gesamt: allKampagnenIds.length
        });
      }
      
      _permissionCache.userId = userId;
      _permissionCache.data = allKampagnenIds;
      _permissionCache.timestamp = Date.now();

      return allKampagnenIds;
      
    } catch (error) {
      console.error('❌ KampagneUtils.loadAllowedKampagneIds Fehler:', error);
      return [];
    }
  }

  static isValidUUID(str) {
    if (!str || typeof str !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  /**
   * Filtert ein Array und behält nur gültige UUIDs
   * @param {Array} arr - Array mit potentiellen UUIDs
   * @returns {string[]} Nur gültige UUIDs
   */
  static filterValidUUIDs(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.filter(item => this.isValidUUID(item));
  }

  // ========================================
  // DISPLAY & FORMATIERUNG
  // ========================================

  // Hole Anzeigename: eigener_name hat Priorität, sonst kampagnenname
  static getDisplayName(kampagne) {
    return kampagne?.eigener_name || kampagne?.kampagnenname || 'Unbenannte Kampagne';
  }

  static formatCurrency(value) {
    if (value === null || value === undefined || value === '') return '-';
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
  }

  static formatBudget(budget) {
    return this.formatCurrency(budget);
  }

  static num(value) {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('de-DE').format(value);
  }

  static formatDate(date) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('de-DE');
  }

  static formatDateTime(date) {
    if (!date) return '-';
    return new Date(date).toLocaleString('de-DE');
  }

  static formatArray(array) {
    if (!array) return '-';
    if (Array.isArray(array)) return array.map(item => item.name || item).join(', ');
    return String(array);
  }

  static getProgressPercentage(current, total) {
    if (!total || total <= 0) return 0;
    return Math.min(100, Math.round((current / total) * 100));
  }

  static getKampagneTotalVideosSimple(k) {
    const subfieldsSum =
      (parseInt(k.ugc_paid_video_anzahl, 10) || 0) +
      (parseInt(k.ugc_organic_video_anzahl, 10) || 0) +
      (parseInt(k.influencer_video_anzahl, 10) || 0) +
      (parseInt(k.story_video_anzahl, 10) || 0) +
      (parseInt(k.vor_ort_video_anzahl, 10) || 0);
    return subfieldsSum || (k.videoanzahl ?? 0);
  }

  // Berechne Gesamt-Videoanzahl einer Kampagne (mit Legacy-Spalten-Fallback)
  static getKampagneTotalVideosFull(k) {
    const newSum =
      (parseInt(k.ugc_paid_video_anzahl, 10) || 0) +
      (parseInt(k.ugc_organic_video_anzahl, 10) || 0) +
      (parseInt(k.influencer_video_anzahl, 10) || 0) +
      (parseInt(k.story_video_anzahl, 10) || 0) +
      (parseInt(k.vor_ort_video_anzahl, 10) || 0);
    const legacySum =
      (parseInt(k.ugc_video_anzahl, 10) || 0) +
      (parseInt(k.igc_video_anzahl, 10) || 0) +
      (parseInt(k.influencer_video_anzahl, 10) || 0) +
      (parseInt(k.vor_ort_video_anzahl, 10) || 0);
    return newSum || legacySum || (k.videoanzahl ?? 0);
  }

}

// Exportiere Instanz für globale Nutzung
export const kampagneUtils = new KampagneUtils(); 