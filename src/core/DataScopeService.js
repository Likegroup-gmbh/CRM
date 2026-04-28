// DataScopeService.js (ES6-Modul)
// Ermittelt Unternehmen-/Marken-Zuordnungen fuer den aktuellen Benutzer.
// Ergebnisse werden gecacht und bei Permission-Aenderungen invalidiert.

class DataScopeService {
  constructor() {
    this._unternehmenCache = null;
    this._markenCache = null;
    this._unternehmenPromise = null;
    this._markenPromise = null;

    if (typeof window !== 'undefined') {
      window.addEventListener('permissionsChanged', () => this.invalidateCache());
    }
  }

  invalidateCache() {
    this._unternehmenCache = null;
    this._markenCache = null;
    this._unternehmenPromise = null;
    this._markenPromise = null;
    console.debug('🔐 DataScopeService: Cache invalidiert');
  }

  /**
   * @returns {Promise<string[]|null>} Array von IDs oder null (= alle erlaubt)
   */
  async getAllowedUnternehmenIds() {
    if (this._unternehmenCache !== null) return this._unternehmenCache;
    if (this._unternehmenPromise) return this._unternehmenPromise;

    this._unternehmenPromise = this._fetchUnternehmenIds();
    try {
      this._unternehmenCache = await this._unternehmenPromise;
      return this._unternehmenCache;
    } finally {
      this._unternehmenPromise = null;
    }
  }

  async _fetchUnternehmenIds() {
    const rolle = window.currentUser?.rolle?.toLowerCase();
    const userId = window.currentUser?.id;

    if (rolle === 'admin') return null;
    if (rolle === 'kunde' || rolle === 'kunde_editor') return null;
    if (!userId) {
      console.warn('⚠️ getAllowedUnternehmenIds: Kein User-ID gefunden');
      return [];
    }

    try {
      const [direktResult, markenResult] = await Promise.all([
        window.supabase.from('mitarbeiter_unternehmen').select('unternehmen_id').eq('mitarbeiter_id', userId),
        window.supabase.from('marke_mitarbeiter').select('marke:marke_id(unternehmen_id)').eq('mitarbeiter_id', userId),
      ]);

      if (direktResult.error) console.error('❌ Fehler beim Laden direkter Unternehmen-Zuordnungen:', direktResult.error);
      if (markenResult.error) console.error('❌ Fehler beim Laden Marken-basierter Unternehmen-Zuordnungen:', markenResult.error);

      const alleIds = [
        ...(direktResult.data || []).map(r => r.unternehmen_id),
        ...(markenResult.data || []).map(r => r.marke?.unternehmen_id).filter(Boolean),
      ];
      return [...new Set(alleIds)];
    } catch (error) {
      console.error('❌ getAllowedUnternehmenIds Fehler:', error);
      return [];
    }
  }

  /**
   * @returns {Promise<string[]|null>} Array von IDs oder null (= alle erlaubt)
   */
  async getAllowedMarkenIds() {
    if (this._markenCache !== null) return this._markenCache;
    if (this._markenPromise) return this._markenPromise;

    this._markenPromise = this._fetchMarkenIds();
    try {
      this._markenCache = await this._markenPromise;
      return this._markenCache;
    } finally {
      this._markenPromise = null;
    }
  }

  async _fetchMarkenIds() {
    const rolle = window.currentUser?.rolle?.toLowerCase();
    const userId = window.currentUser?.id;

    if (rolle === 'admin') return null;
    if (rolle === 'kunde' || rolle === 'kunde_editor') return null;
    if (!userId) {
      console.warn('⚠️ getAllowedMarkenIds: Kein User-ID gefunden');
      return [];
    }

    try {
      const [markenResult, unternehmenResult] = await Promise.all([
        window.supabase.from('marke_mitarbeiter').select('marke_id').eq('mitarbeiter_id', userId),
        window.supabase.from('mitarbeiter_unternehmen').select('unternehmen_id').eq('mitarbeiter_id', userId),
      ]);

      if (markenResult.error) console.error('❌ Fehler beim Laden direkter Marken-Zuordnungen:', markenResult.error);
      if (unternehmenResult.error) console.error('❌ Fehler beim Laden Unternehmen-Zuordnungen:', unternehmenResult.error);

      const directMarkeIds = (markenResult.data || []).map(r => r.marke_id).filter(Boolean);
      const unternehmenIds = (unternehmenResult.data || []).map(r => r.unternehmen_id).filter(Boolean);

      // Bestimme welche Unternehmen explizite Marken-Zuordnungen haben
      const unternehmenMarkenMap = new Map();
      if (directMarkeIds.length > 0) {
        const { data: markenData } = await window.supabase
          .from('marke')
          .select('id, unternehmen_id')
          .in('id', directMarkeIds);
        (markenData || []).forEach(m => {
          if (m.unternehmen_id) {
            if (!unternehmenMarkenMap.has(m.unternehmen_id)) unternehmenMarkenMap.set(m.unternehmen_id, []);
            unternehmenMarkenMap.get(m.unternehmen_id).push(m.id);
          }
        });
      }

      // Pro Unternehmen: explizite Marken oder alle Marken (batched statt N+1)
      const unternehmenOhneExplizit = unternehmenIds.filter(id => !unternehmenMarkenMap.has(id));
      let impliziteMarkenIds = [];
      if (unternehmenOhneExplizit.length > 0) {
        const { data: markenData } = await window.supabase
          .from('marke')
          .select('id')
          .in('unternehmen_id', unternehmenOhneExplizit);
        impliziteMarkenIds = (markenData || []).map(m => m.id);
      }

      const expliziteIds = [];
      for (const uid of unternehmenIds) {
        const explicit = unternehmenMarkenMap.get(uid);
        if (explicit) expliziteIds.push(...explicit);
      }

      const allIds = [...directMarkeIds, ...expliziteIds, ...impliziteMarkenIds];
      return [...new Set(allIds)];
    } catch (error) {
      console.error('❌ getAllowedMarkenIds Fehler:', error);
      return [];
    }
  }
}

export const dataScopeService = new DataScopeService();

if (typeof window !== 'undefined') {
  window.getAllowedUnternehmenIds = () => dataScopeService.getAllowedUnternehmenIds();
  window.getAllowedMarkenIds = () => dataScopeService.getAllowedMarkenIds();
  window.dataScopeService = dataScopeService;
}
