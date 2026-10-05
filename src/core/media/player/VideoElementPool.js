// VideoElementPool
// Haelt zuletzt gesehene Video-Stage-Subtrees (<video> + Controls) offscreen
// vor, damit Zurueckblaettern den bereits geladenen Puffer (Position, gepufferte
// Bytes, gebundene Listener) wiederverwendet statt das Medium neu zu laden.
//
// Geparkt wird ein detached Wrapper-Node pro Content-Key (currentCacheKey()).
// Verdraengung erfolgt LRU; verdraengte/geloeschte Videos geben ihren Decoder
// via removeAttribute('src') + load() frei.

const DEFAULT_MAX = 4;

export class VideoElementPool {
  /** @param {number} [max] maximale Anzahl geparkter Videos */
  constructor(max = DEFAULT_MAX) {
    this._max = Math.max(1, max | 0 || DEFAULT_MAX);
    /** @type {Map<string, HTMLElement>} key -> detached Wrapper (Insertion-Order = LRU) */
    this._pool = new Map();
  }

  /** Parkt einen detached Wrapper-Node unter dem Key (verdraengt LRU bei Ueberlauf). */
  park(key, node) {
    if (!key || !node) return;
    // Bereits vorhandenen Eintrag erst freigeben (kein Leak bei Re-Park).
    if (this._pool.has(key)) {
      this._release(this._pool.get(key));
      this._pool.delete(key);
    }
    this._pool.set(key, node);
    this._evictIfNeeded();
  }

  /** Entnimmt den geparkten Node fuer den Key (oder null). Entfernt ihn aus dem Pool. */
  take(key) {
    if (!key || !this._pool.has(key)) return null;
    const node = this._pool.get(key);
    this._pool.delete(key);
    return node;
  }

  /** Gibt alle geparkten Videos frei und leert den Pool. */
  clear() {
    this._pool.forEach(node => this._release(node));
    this._pool.clear();
  }

  get size() {
    return this._pool.size;
  }

  _evictIfNeeded() {
    while (this._pool.size > this._max) {
      const oldestKey = this._pool.keys().next().value;
      this._release(this._pool.get(oldestKey));
      this._pool.delete(oldestKey);
    }
  }

  /** Loest den src des enthaltenen Videos -> gibt Decoder/RAM frei. */
  _release(node) {
    if (!node) return;
    const video = node.querySelector ? node.querySelector('video') : null;
    if (video) {
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch (_) { /* still */ }
    }
  }
}
