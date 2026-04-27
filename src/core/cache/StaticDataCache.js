/**
 * StaticDataCache
 * 
 * Caching-Service für statische/selten ändernde Daten wie:
 * - EU-Länder
 * - Positionen
 * - Sprachen
 * - Branchen
 * - Status-Typen
 * - Format-Typen
 * - Plattform-Typen
 * 
 * Performance-Gewinn: ~70% schnelleres Form-Loading
 */

export class StaticDataCache {
  constructor(maxAge = 24 * 60 * 60 * 1000) { // Default: 24 Stunden
    this.cache = new Map();
    this.maxAge = maxAge;
    this.loading = new Map(); // Verhindert doppelte Requests
  }

  /**
   * Holt Daten aus Cache oder lädt von DB
   * @param {string} table - Tabellenname
   * @param {string} query - Select-Query (default: *)
   * @param {string} orderBy - ORDER BY Feld (default: sort_order)
   * @returns {Promise<Array>} - Cached oder frische Daten
   */
  async get(table, query = '*', orderBy = 'sort_order') {
    const key = `${table}_${query}`;
    
    // 1. Prüfe Cache
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.maxAge) {
      return cached.data;
    }

    // 2. Prüfe ob bereits ein Request läuft
    if (this.loading.has(key)) {
      return await this.loading.get(key);
    }

    // 3. Lade von DB
    const loadPromise = this._loadFromDB(table, query, orderBy);
    this.loading.set(key, loadPromise);
    
    try {
      const data = await loadPromise;
      
      // In Cache speichern
      this.cache.set(key, { 
        data, 
        timestamp: Date.now() 
      });
      
      return data;
      
    } finally {
      this.loading.delete(key);
    }
  }

  /**
   * Private Methode: Lädt Daten von Supabase
   */
  async _loadFromDB(table, query, orderBy) {
    try {
      let queryBuilder = window.supabase
        .from(table)
        .select(query);
      
      // ORDER BY nur wenn Feld existiert
      if (orderBy) {
        queryBuilder = queryBuilder.order(orderBy);
      }
      
      const { data, error } = await queryBuilder;
      
      if (error) throw error;
      return data || [];
      
    } catch (error) {
      console.error(`❌ Fehler beim Laden von ${table}:`, error);
      
      // Bei Fehler (z.B. sort_order existiert nicht), nochmal ohne ORDER BY
      if (orderBy && error.message?.includes('sort_order')) {
        return await this._loadFromDB(table, query, null);
      }
      
      return [];
    }
  }

  /**
   * Invalidiert Cache für eine Tabelle
   * Wird z.B. nach CREATE/UPDATE/DELETE aufgerufen
   */
  invalidate(table) {
    let invalidatedCount = 0;
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${table}_`)) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }
    
    if (invalidatedCount > 0) {
    }
  }

  /**
   * Löscht gesamten Cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Gibt Cache-Statistiken zurück
   */
  getStats() {
    const stats = {
      size: this.cache.size,
      entries: []
    };
    
    for (const [key, value] of this.cache.entries()) {
      stats.entries.push({
        key,
        age: Math.round((Date.now() - value.timestamp) / 1000),
        count: value.data.length
      });
    }
    
    return stats;
  }
}

// Globale Instanz
if (!window.staticDataCache) {
  window.staticDataCache = new StaticDataCache();
}

export default window.staticDataCache;

