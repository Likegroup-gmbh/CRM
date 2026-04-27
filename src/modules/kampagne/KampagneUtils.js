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
    const rolle = window.currentUser?.rolle;
    return rolle === 'admin' || rolle?.toLowerCase() === 'admin';
  }

  /**
   * Prüft ob der aktuelle User ein Kunde ist
   * @returns {boolean}
   */
  static isUserKunde() {
    const rolle = window.currentUser?.rolle;
    return rolle === 'kunde' || rolle === 'kunde_editor';
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
      
      // Admins sehen alles
      if (this.isUserAdmin()) {
        if (DEBUG_PERMISSIONS) console.log('🔓 PERMISSIONS: Admin - keine Filterung');
        return null;
      }
      
      // Kunden: RLS filtert automatisch
      if (this.isUserKunde()) {
        if (DEBUG_PERMISSIONS) console.log('🔓 PERMISSIONS: Kunde - RLS filtert');
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

  /**
   * Lädt Kampagnen mit Permission-Filterung
   * @param {object} options - Query-Optionen
   * @param {string} options.selectFields - Felder für SELECT (default: *)
   * @param {string} options.orderBy - Sortierfeld (default: created_at)
   * @param {boolean} options.ascending - Sortierrichtung (default: false)
   * @returns {Promise<{data: Array, error: Error|null}>}
   */
  static async loadKampagnenWithPermissions(options = {}) {
    const { 
      selectFields = '*', 
      orderBy = 'created_at', 
      ascending = false 
    } = options;
    
    try {
      const allowedIds = await this.loadAllowedKampagneIds();
      
      let query = window.supabase
        .from('kampagne')
        .select(selectFields)
        .order(orderBy, { ascending });
      
      // Nur filtern wenn allowedIds ein Array ist (nicht null)
      if (allowedIds !== null) {
        if (allowedIds.length === 0) {
          return { data: [], error: null };
        }
        query = query.in('id', allowedIds);
      }
      
      return await query;
      
    } catch (error) {
      console.error('❌ KampagneUtils.loadKampagnenWithPermissions Fehler:', error);
      return { data: [], error };
    }
  }

  // ========================================
  // UUID VALIDIERUNG
  // ========================================

  /**
   * Validiert ob ein String eine gültige UUID ist
   * @param {string} str - Zu validierende Zeichenkette
   * @returns {boolean}
   */
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

  // Formatiere Kampagnen-Art
  static formatKampagnenArt(art) {
    if (!art) return '-';
    
    if (Array.isArray(art)) {
      return art.join(', ');
    }
    
    const artMap = {
      'ugc_paid': 'UGC Paid',
      'ugc_organic': 'UGC Organic',
      'influencer': 'Influencer Kampagne',
      'vor_ort_produktion': 'Vor-Ort-Produktion',
      'story': 'Story',
      'ugc_pro_paid': 'UGC Pro Paid',
      'ugc_pro_organic': 'UGC Pro Organic',
      'ugc_video_paid': 'UGC Video Paid',
      'ugc_video_organic': 'UGC Video Organic',
      // Legacy-Werte
      'ugc': 'UGC Video Organic',
      'igc': 'UGC Pro Organic',
      'ai': 'AI'
    };
    
    return artMap[art] || art || 'Unbekannt';
  }

  // Berechne Kampagnen-Fortschritt
  static calculateProgress(kampagne) {
    if (!kampagne.start || !kampagne.deadline) {
      return 0;
    }

    const start = new Date(kampagne.start);
    const deadline = new Date(kampagne.deadline);
    const now = new Date();

    if (now < start) {
      return 0;
    }

    if (now > deadline) {
      return 100;
    }

    const totalDuration = deadline - start;
    const elapsed = now - start;
    
    return Math.round((elapsed / totalDuration) * 100);
  }

  // Prüfe ob Kampagne aktiv ist
  static isKampagneActive(kampagne) {
    if (!kampagne.start || !kampagne.deadline) {
      return false;
    }

    const now = new Date();
    const start = new Date(kampagne.start);
    const deadline = new Date(kampagne.deadline);

    return now >= start && now <= deadline;
  }

  // Prüfe ob Kampagne abgelaufen ist
  static isKampagneExpired(kampagne) {
    if (!kampagne.deadline) {
      return false;
    }

    const now = new Date();
    const deadline = new Date(kampagne.deadline);

    return now > deadline;
  }

  // Berechne verbleibende Tage
  static getRemainingDays(kampagne) {
    if (!kampagne.deadline) {
      return null;
    }

    const now = new Date();
    const deadline = new Date(kampagne.deadline);
    const diffTime = deadline - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
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

  static formatDateFull(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

  // Validiere Kampagnen-Daten
  static validateKampagneData(data) {
    const errors = {};

    // Pflichtfelder prüfen
    if (!data.kampagnenname || data.kampagnenname.trim() === '') {
      errors.kampagnenname = 'Kampagnenname ist erforderlich';
    }

    if (!data.unternehmen_id) {
      errors.unternehmen_id = 'Unternehmen ist erforderlich';
    }

    if (!data.start) {
      errors.start = 'Startdatum ist erforderlich';
    }

    if (!data.deadline) {
      errors.deadline = 'Deadline ist erforderlich';
    }

    // Datum-Logik prüfen
    if (data.start && data.deadline) {
      const start = new Date(data.start);
      const deadline = new Date(data.deadline);

      if (start >= deadline) {
        errors.deadline = 'Deadline muss nach dem Startdatum liegen';
      }
    }

    // Zahlen validieren
    if (data.creatoranzahl && (isNaN(data.creatoranzahl) || data.creatoranzahl < 0)) {
      errors.creatoranzahl = 'Creator Anzahl muss eine positive Zahl sein';
    }

    if (data.videoanzahl && (isNaN(data.videoanzahl) || data.videoanzahl < 0)) {
      errors.videoanzahl = 'Video Anzahl muss eine positive Zahl sein';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  // Berechne Gesamt-Videoanzahl einer Kampagne (nur neue Subfield-Spalten)
  static getKampagneTotalVideosSimple(k) {
    const subfieldsSum =
      (parseInt(k.ugc_paid_video_anzahl, 10) || 0) +
      (parseInt(k.ugc_organic_video_anzahl, 10) || 0) +
      (parseInt(k.ugc_pro_paid_video_anzahl, 10) || 0) +
      (parseInt(k.ugc_pro_organic_video_anzahl, 10) || 0) +
      (parseInt(k.ugc_video_paid_video_anzahl, 10) || 0) +
      (parseInt(k.ugc_video_organic_video_anzahl, 10) || 0) +
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
      (parseInt(k.ugc_pro_paid_video_anzahl, 10) || 0) +
      (parseInt(k.ugc_pro_organic_video_anzahl, 10) || 0) +
      (parseInt(k.ugc_video_paid_video_anzahl, 10) || 0) +
      (parseInt(k.ugc_video_organic_video_anzahl, 10) || 0) +
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

  // Erstelle Kampagnen-Summary
  static createKampagneSummary(kampagne) {
    const progress = this.calculateProgress(kampagne);
    const isActive = this.isKampagneActive(kampagne);
    const remainingDays = this.getRemainingDays(kampagne);

    return {
      id: kampagne.id,
      name: kampagne.kampagnenname,
      status: kampagne.status,
      progress,
      isActive,
      remainingDays,
      creatorCount: kampagne.creatoranzahl || 0,
      videoCount: kampagne.videoanzahl || 0,
      start: this.formatDate(kampagne.start),
      deadline: this.formatDate(kampagne.deadline)
    };
  }

  // Erstelle Kampagnen-Filter-Optionen
  static getFilterOptions() {
    return {
      status: [
        { value: 'active', label: 'Aktiv' },
        { value: 'inactive', label: 'Inaktiv' },
        { value: 'completed', label: 'Abgeschlossen' },
        { value: 'cancelled', label: 'Storniert' },
        { value: 'draft', label: 'Entwurf' },
        { value: 'pending', label: 'Ausstehend' }
      ],
      art_der_kampagne: [
        { value: 'UGC Pro Paid', label: 'UGC Pro Paid' },
        { value: 'UGC Pro Organic', label: 'UGC Pro Organic' },
        { value: 'UGC Video Paid', label: 'UGC Video Paid' },
        { value: 'UGC Video Organic', label: 'UGC Video Organic' },
        { value: 'Influencer Kampagne', label: 'Influencer Kampagne' },
        { value: 'Vor Ort Produktionen', label: 'Vor Ort Produktionen' }
      ]
    };
  }

  // Erstelle Kampagnen-Export-Daten
  static createExportData(kampagnen) {
    return kampagnen.map(kampagne => ({
      'Kampagnenname': this.getDisplayName(kampagne),
      'Status': kampagne.status || '-',
      'Art der Kampagne': this.formatKampagnenArt(kampagne.art_der_kampagne),
      'Start': this.formatDate(kampagne.start),
      'Deadline': this.formatDate(kampagne.deadline),
      'Creator Anzahl': kampagne.creatoranzahl || 0,
      'Video Anzahl': kampagne.videoanzahl || 0,
      'Drehort': kampagne.drehort || '-',
      'Ziele': kampagne.ziele || '-',
      'Budget Info': kampagne.budget_info || '-',
      'Unternehmen': kampagne.unternehmen?.firmenname || 'Unbekannt',
      'Marke': kampagne.marke?.markenname || 'Unbekannt',
      'Auftrag': kampagne.auftrag?.auftragsname || 'Unbekannt',
      'Erstellt am': this.formatDateTime(kampagne.created_at),
      'Aktualisiert am': this.formatDateTime(kampagne.updated_at)
    }));
  }

  // Erstelle Kampagnen-Statistiken
  static createKampagneStats(kampagnen) {
    const stats = {
      total: kampagnen.length,
      active: 0,
      completed: 0,
      cancelled: 0,
      draft: 0,
      totalCreators: 0,
      totalVideos: 0,
      totalBudget: 0
    };

    kampagnen.forEach(kampagne => {
      // Status zählen
      switch (kampagne.status) {
        case 'active':
          stats.active++;
          break;
        case 'completed':
          stats.completed++;
          break;
        case 'cancelled':
          stats.cancelled++;
          break;
        case 'draft':
          stats.draft++;
          break;
      }

      // Summen berechnen
      stats.totalCreators += kampagne.creatoranzahl || 0;
      stats.totalVideos += kampagne.videoanzahl || 0;
      
      // Budget summieren (falls verfügbar)
      if (kampagne.budget_info) {
        // Hier könnte eine Logik zur Extraktion des Budgets implementiert werden
        // stats.totalBudget += extractedBudget;
      }
    });

    return stats;
  }
}

// Exportiere Instanz für globale Nutzung
export const kampagneUtils = new KampagneUtils(); 