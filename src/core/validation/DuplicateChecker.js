// DuplicateChecker.js (ES6-Modul)
// Zentrale Duplikat- und Ähnlichkeitserkennung für Creator, Marke und Unternehmen
// Kombiniert DB-basierte Exakt-Checks mit Frontend Fuzzy-Matching

import Fuse from 'fuse.js';

export class DuplicateChecker {
  constructor() {
    this.cache = new Map(); // Cache für Performance
    this.debounceTimers = new Map(); // Debounce Timer
    
    // Fuse.js Konfiguration für Ähnlichkeitserkennung
    this.fuseOptions = {
      threshold: 0.3, // 30% Unterschied erlaubt
      distance: 100,
      minMatchCharLength: 2,
      ignoreLocation: true,
      keys: [] // Wird pro Entity-Typ gesetzt
    };
  }

  /**
   * Hauptmethode: Check Duplikate für eine Entity
   * @param {string} entity - 'creator' | 'marke' | 'unternehmen'
   * @param {object} fieldValues - Feld-Werte zum Prüfen
   * @param {string|null} excludeId - ID zum Ausschließen (bei Edit)
   * @returns {Promise<{exact: boolean, similar: Array}>}
   */
  async checkDuplicate(entity, fieldValues, excludeId = null) {
    try {
      switch (entity) {
        case 'unternehmen':
          return await this.checkUnternehmen(fieldValues.firmenname, excludeId);
        case 'marke':
          return await this.checkMarke(fieldValues.markenname, excludeId);
        case 'creator':
          return await this.checkCreator(fieldValues.vorname, fieldValues.nachname, excludeId);
        default:
          console.warn('⚠️ DUPLICATECHECKER: Unbekannte Entity:', entity);
          return { exact: false, similar: [] };
      }
    } catch (error) {
      console.error('❌ DUPLICATECHECKER: Fehler beim Check:', error);
      return { exact: false, similar: [] };
    }
  }

  /**
   * Check Unternehmen Duplikate
   * @param {string} firmenname - Firmenname zum Prüfen
   * @param {string|null} excludeId - ID zum Ausschließen
   * @returns {Promise<{exact: boolean, similar: Array}>}
   */
  async checkUnternehmen(firmenname, excludeId = null) {
    if (!firmenname || firmenname.trim().length < 2) {
      return { exact: false, similar: [] };
    }

    try {
      console.log('🔍 DUPLICATECHECKER: Prüfe Unternehmen:', firmenname);

      // 1. DB-Check (exakt)
      const { data: dbResult, error } = await window.supabase.rpc(
        'check_unternehmen_duplicate',
        { p_firmenname: firmenname, p_exclude_id: excludeId }
      );

      if (error) {
        console.error('❌ DUPLICATECHECKER: DB-Fehler:', error);
        return { exact: false, similar: [] };
      }

      const exactMatch = dbResult?.[0]?.is_duplicate || false;
      const exactEntries = dbResult?.[0]?.similar_entries || [];

      // 2. Lade alle Unternehmen für Fuzzy-Matching
      const allUnternehmen = await this.loadAllUnternehmen();
      
      // 3. Fuzzy-Matching (nur wenn nicht exakt gefunden)
      let fuzzyResults = [];
      if (!exactMatch && allUnternehmen.length > 0) {
        fuzzyResults = this.findSimilarLocal(
          firmenname,
          allUnternehmen,
          ['firmenname'],
          excludeId
        );
      }

      // 4. Kombiniere Ergebnisse (Duplikate entfernen)
      const allSimilar = this.deduplicateSimilarEntries(
        [...exactEntries, ...fuzzyResults],
        'id'
      );

      console.log('✅ DUPLICATECHECKER: Unternehmen Check -', {
        exact: exactMatch,
        similarCount: allSimilar.length
      });

      return {
        exact: exactMatch,
        similar: allSimilar
      };
    } catch (error) {
      console.error('❌ DUPLICATECHECKER: Exception bei Unternehmen:', error);
      return { exact: false, similar: [] };
    }
  }

  /**
   * Check Marke Duplikate
   * @param {string} markenname - Markenname zum Prüfen
   * @param {string|null} excludeId - ID zum Ausschließen
   * @returns {Promise<{exact: boolean, similar: Array}>}
   */
  async checkMarke(markenname, excludeId = null) {
    if (!markenname || markenname.trim().length < 2) {
      return { exact: false, similar: [] };
    }

    try {
      console.log('🔍 DUPLICATECHECKER: Prüfe Marke:', markenname);

      // 1. DB-Check (exakt)
      const { data: dbResult, error } = await window.supabase.rpc(
        'check_marke_duplicate',
        { p_markenname: markenname, p_exclude_id: excludeId }
      );

      if (error) {
        console.error('❌ DUPLICATECHECKER: DB-Fehler:', error);
        return { exact: false, similar: [] };
      }

      const exactMatch = dbResult?.[0]?.is_duplicate || false;
      const exactEntries = dbResult?.[0]?.similar_entries || [];

      // 2. Lade alle Marken für Fuzzy-Matching
      const allMarken = await this.loadAllMarken();
      
      // 3. Fuzzy-Matching
      let fuzzyResults = [];
      if (!exactMatch && allMarken.length > 0) {
        fuzzyResults = this.findSimilarLocal(
          markenname,
          allMarken,
          ['markenname'],
          excludeId
        );
      }

      // 4. Kombiniere Ergebnisse
      const allSimilar = this.deduplicateSimilarEntries(
        [...exactEntries, ...fuzzyResults],
        'id'
      );

      console.log('✅ DUPLICATECHECKER: Marke Check -', {
        exact: exactMatch,
        similarCount: allSimilar.length
      });

      return {
        exact: exactMatch,
        similar: allSimilar
      };
    } catch (error) {
      console.error('❌ DUPLICATECHECKER: Exception bei Marke:', error);
      return { exact: false, similar: [] };
    }
  }

  /**
   * Check Creator Duplikate
   * @param {string} vorname - Vorname zum Prüfen
   * @param {string} nachname - Nachname zum Prüfen
   * @param {string|null} excludeId - ID zum Ausschließen
   * @returns {Promise<{exact: boolean, similar: Array}>}
   */
  async checkCreator(vorname, nachname, excludeId = null) {
    if (!vorname || !nachname || vorname.trim().length < 1 || nachname.trim().length < 1) {
      return { exact: false, similar: [] };
    }

    try {
      console.log('🔍 DUPLICATECHECKER: Prüfe Creator:', vorname, nachname);

      // 1. DB-Check (exakt + vertauscht)
      const { data: dbResult, error } = await window.supabase.rpc(
        'check_creator_duplicate',
        { 
          p_vorname: vorname, 
          p_nachname: nachname, 
          p_exclude_id: excludeId 
        }
      );

      if (error) {
        console.error('❌ DUPLICATECHECKER: DB-Fehler:', error);
        return { exact: false, similar: [] };
      }

      const exactMatch = dbResult?.[0]?.is_duplicate || false;
      const exactEntries = dbResult?.[0]?.similar_entries || [];

      // 2. Lade alle Creator für Fuzzy-Matching
      const allCreators = await this.loadAllCreators();
      
      // 3. Fuzzy-Matching auf kombiniertem Namen
      let fuzzyResults = [];
      if (!exactMatch && allCreators.length > 0) {
        const searchName = `${vorname} ${nachname}`;
        fuzzyResults = this.findSimilarLocal(
          searchName,
          allCreators.map(c => ({
            ...c,
            fullname: `${c.vorname || ''} ${c.nachname || ''}`.trim()
          })),
          ['fullname', 'vorname', 'nachname'],
          excludeId
        );
      }

      // 4. Kombiniere Ergebnisse
      const allSimilar = this.deduplicateSimilarEntries(
        [...exactEntries, ...fuzzyResults],
        'id'
      );

      console.log('✅ DUPLICATECHECKER: Creator Check -', {
        exact: exactMatch,
        similarCount: allSimilar.length
      });

      return {
        exact: exactMatch,
        similar: allSimilar
      };
    } catch (error) {
      console.error('❌ DUPLICATECHECKER: Exception bei Creator:', error);
      return { exact: false, similar: [] };
    }
  }

  /**
   * Fuzzy-Matching mit fuse.js
   * @param {string} searchText - Text zum Suchen
   * @param {Array} allEntries - Alle Einträge zum Durchsuchen
   * @param {Array} keys - Felder zum Durchsuchen
   * @param {string|null} excludeId - ID zum Ausschließen
   * @returns {Array} - Top 5 ähnliche Einträge
   */
  findSimilarLocal(searchText, allEntries, keys, excludeId = null) {
    if (!searchText || !allEntries || allEntries.length === 0) {
      return [];
    }

    try {
      // Filtere excludeId
      const filteredEntries = excludeId
        ? allEntries.filter(entry => entry.id !== excludeId)
        : allEntries;

      if (filteredEntries.length === 0) {
        return [];
      }

      // Fuse.js konfigurieren
      const fuse = new Fuse(filteredEntries, {
        ...this.fuseOptions,
        keys
      });

      // Suche durchführen
      const results = fuse.search(searchText);

      // Top 5 zurückgeben
      return results.slice(0, 5).map(result => result.item);
    } catch (error) {
      console.error('❌ DUPLICATECHECKER: Fehler bei Fuzzy-Matching:', error);
      return [];
    }
  }

  /**
   * Entferne Duplikate aus Similar-Entries
   * @param {Array} entries - Einträge
   * @param {string} keyField - Eindeutiges Feld (z.B. 'id')
   * @returns {Array} - Bereinigte Einträge
   */
  deduplicateSimilarEntries(entries, keyField = 'id') {
    const seen = new Set();
    return entries.filter(entry => {
      const key = entry[keyField];
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Lade alle Unternehmen (mit Cache)
   * @returns {Promise<Array>}
   */
  async loadAllUnternehmen() {
    const cacheKey = 'all_unternehmen';
    const cacheDuration = 60000; // 1 Minute

    // Cache prüfen
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < cacheDuration) {
        return cached.data;
      }
    }

    try {
      const { data, error } = await window.supabase
        .from('unternehmen')
        .select('id, firmenname, webseite, logo_url')
        .order('firmenname');

      if (error) throw error;

      // Cache speichern
      this.cache.set(cacheKey, {
        data: data || [],
        timestamp: Date.now()
      });

      return data || [];
    } catch (error) {
      console.error('❌ DUPLICATECHECKER: Fehler beim Laden von Unternehmen:', error);
      return [];
    }
  }

  /**
   * Lade alle Marken (mit Cache)
   * @returns {Promise<Array>}
   */
  async loadAllMarken() {
    const cacheKey = 'all_marken';
    const cacheDuration = 60000; // 1 Minute

    // Cache prüfen
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < cacheDuration) {
        return cached.data;
      }
    }

    try {
      const { data, error } = await window.supabase
        .from('marke')
        .select(`
          id, 
          markenname,
          unternehmen_id,
          logo_url,
          unternehmen:unternehmen_id(firmenname)
        `)
        .order('markenname');

      if (error) throw error;

      // Flache Struktur für Fuzzy-Matching
      const flatData = (data || []).map(m => ({
        id: m.id,
        markenname: m.markenname,
        unternehmen_id: m.unternehmen_id,
        unternehmen_name: m.unternehmen?.firmenname || null,
        logo_url: m.logo_url
      }));

      // Cache speichern
      this.cache.set(cacheKey, {
        data: flatData,
        timestamp: Date.now()
      });

      return flatData;
    } catch (error) {
      console.error('❌ DUPLICATECHECKER: Fehler beim Laden von Marken:', error);
      return [];
    }
  }

  /**
   * Lade alle Creator (mit Cache)
   * @returns {Promise<Array>}
   */
  async loadAllCreators() {
    const cacheKey = 'all_creators';
    const cacheDuration = 60000; // 1 Minute

    // Cache prüfen
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < cacheDuration) {
        return cached.data;
      }
    }

    try {
      const { data, error } = await window.supabase
        .from('creator')
        .select('id, vorname, nachname, instagram, mail, profilbild_url')
        .order('vorname');

      if (error) throw error;

      // Cache speichern
      this.cache.set(cacheKey, {
        data: data || [],
        timestamp: Date.now()
      });

      return data || [];
    } catch (error) {
      console.error('❌ DUPLICATECHECKER: Fehler beim Laden von Creators:', error);
      return [];
    }
  }

  /**
   * Cache leeren (z.B. nach Create/Update)
   * @param {string|null} entity - Bestimmte Entity oder null für alle
   */
  clearCache(entity = null) {
    if (entity) {
      this.cache.delete(`all_${entity}`);
    } else {
      this.cache.clear();
    }
    console.log('🗑️ DUPLICATECHECKER: Cache geleert', entity || 'alle');
  }
}

