/**
 * TabDataCache
 * 
 * In-Session Memory Cache für Tab-spezifische Daten in Detail-Seiten.
 * Verhindert unnötiges mehrfaches Laden derselben Daten während einer User-Session.
 * Cache wird automatisch invalidiert bei entityUpdated Events.
 */

export class TabDataCache {
  constructor() {
    // Speichert geladene Daten: key -> data
    this.cache = new Map();
    
    // Speichert laufende Load-Promises: key -> Promise
    // Verhindert Race Conditions bei schnellen Tab-Switches
    this.loading = new Map();
  }
  
  /**
   * Lädt Tab-Daten nur einmal pro Session
   * 
   * @param {string} entityType - Der Entity-Typ (z.B. 'kampagne', 'kooperation')
   * @param {string|number} entityId - Die Entity-ID
   * @param {string} tabName - Der Tab-Name
   * @param {Function} loadFunction - Async Funktion zum Laden der Daten
   * @returns {Promise<any>} Die geladenen Daten (aus Cache oder frisch geladen)
   * 
   * @example
   * const videos = await tabDataCache.load('kooperation', 123, 'videos', async () => {
   *   const { data } = await window.supabase.from('kooperation_videos').select('*').eq('kooperation_id', 123);
   *   return data;
   * });
   */
  async load(entityType, entityId, tabName, loadFunction) {
    const key = `${entityType}-${entityId}-${tabName}`;
    
    // Bereits geladen? Nutze Cache
    if (this.cache.has(key)) {
      console.log(`✅ Cache HIT für ${tabName}`);
      return this.cache.get(key);
    }
    
    // Gerade am Laden? Warte auf bestehendes Promise
    // Verhindert doppelte Requests bei schnellen Tab-Switches
    if (this.loading.has(key)) {
      console.log(`⏳ Warte auf laufenden Load für ${tabName}`);
      return await this.loading.get(key);
    }
    
    // Neu laden
    console.log(`📥 Cache MISS für ${tabName} - lade von Server`);
    const loadPromise = loadFunction();
    this.loading.set(key, loadPromise);
    
    try {
      const data = await loadPromise;
      this.cache.set(key, data);
      return data;
    } finally {
      // Entferne aus loading Map, egal ob erfolgreich oder Fehler
      this.loading.delete(key);
    }
  }
  
  /**
   * Invalidiert Cache-Einträge für eine bestimmte Entity
   * Wird aufgerufen bei entityUpdated Events
   * 
   * @param {string} entityType - Der Entity-Typ
   * @param {string|number} entityId - Die Entity-ID (optional)
   * 
   * @example
   * // Invalidiert alle Kooperation-123 Tabs
   * tabDataCache.invalidate('kooperation', 123);
   * 
   * // Invalidiert alle Kooperationen
   * tabDataCache.invalidate('kooperation');
   */
  invalidate(entityType, entityId = null) {
    const prefix = entityId ? `${entityType}-${entityId}` : entityType;
    
    for (const [key] of this.cache) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        console.log(`🗑️ Cache invalidiert: ${key}`);
      }
    }
  }
  
  /**
   * Löscht den gesamten Cache
   * Wird aufgerufen bei destroy() von Detail-Seiten oder Page-Reload
   */
  clear() {
    const cacheSize = this.cache.size;
    this.cache.clear();
    this.loading.clear();
    
    if (cacheSize > 0) {
      console.log(`🗑️ Cache komplett geleert (${cacheSize} Einträge)`);
    }
  }
  
  /**
   * Gibt Cache-Statistiken zurück (für Debugging)
   * 
   * @returns {Object} Statistiken über Cache-Nutzung
   */
  getStats() {
    return {
      cachedItems: this.cache.size,
      loadingItems: this.loading.size,
      cacheKeys: Array.from(this.cache.keys())
    };
  }
}

// Globale Instanz für alle Detail-Seiten
export const tabDataCache = new TabDataCache();

