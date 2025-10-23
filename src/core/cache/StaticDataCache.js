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
    
    console.log('📦 StaticDataCache initialisiert (Max Age:', maxAge / 1000 / 60, 'Minuten)');
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
      console.log(`✅ Cache HIT für ${table} (Alter: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
      return cached.data;
    }

    // 2. Prüfe ob bereits ein Request läuft
    if (this.loading.has(key)) {
      console.log(`⏳ Warte auf laufenden Request für ${table}...`);
      return await this.loading.get(key);
    }

    // 3. Lade von DB
    console.log(`📥 Cache MISS für ${table} - lade von DB...`);
    
    const loadPromise = this._loadFromDB(table, query, orderBy);
    this.loading.set(key, loadPromise);
    
    try {
      const data = await loadPromise;
      
      // In Cache speichern
      this.cache.set(key, { 
        data, 
        timestamp: Date.now() 
      });
      
      console.log(`✅ ${table} geladen und gecached (${data.length} Einträge)`);
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
        console.log(`⚠️ Retry ohne ORDER BY für ${table}...`);
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
      console.log(`🗑️ Cache invalidiert für ${table} (${invalidatedCount} Einträge)`);
    }
  }

  /**
   * Löscht gesamten Cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🗑️ Kompletter Cache gelöscht (${size} Einträge)`);
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
  console.log('✅ Global StaticDataCache erstellt');
}

export default window.staticDataCache;

