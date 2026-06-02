// VideoRowHeightSync
// Gleicht in der Kooperations-Video-Tabelle die Hoehe der gestapelten
// Video-Felder pro Video-Index ueber alle Spalten an. Da jede Spalte
// (.video-stack-cell) pro Video genau einen .video-field-wrapper[data-video-id]
// rendert, bekommt jede "Video-Reihe" innerhalb einer Kooperation in jeder
// Spalte dieselbe Hoehe (= hoechster Wrapper der Gruppe). So entsteht kein
// Weissraum unter kurzen Feldern (Videonummer, Kosten, ...), wenn das Feedback
// in derselben Reihe lang ist.
//
// Mess-/Schreibphasen sind getrennt (reset -> measure -> apply) und per
// requestAnimationFrame gebuendelt, um Reflow-Stuerme zu vermeiden.

export class VideoRowHeightSync {
  /** @param {HTMLElement} container - Element, das die .kooperation-row Zeilen enthaelt */
  constructor(container) {
    this.container = container || null;
    this._rafId = null;
    this._resizeObserver = null;
    this._onInput = null;
    this._onResize = null;
  }

  /** Gebuendelter Re-Sync im naechsten Frame (mehrfach-aufruf-sicher). */
  schedule() {
    if (this._rafId != null) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this.sync();
    });
  }

  /**
   * Hoehen angleichen. Optional auf eine einzelne Zeile begrenzen (z. B. nach
   * Realtime-Update einer Kooperation).
   * @param {HTMLElement} [scope] - eine .kooperation-row oder ein Subtree
   */
  sync(scope) {
    if (!this.container) return;
    const root = scope || this.container;
    const rows = root.classList?.contains('kooperation-row')
      ? [root]
      : Array.from(root.querySelectorAll('.kooperation-row'));
    if (rows.length === 0) return;

    const rowWrappers = rows.map(row => Array.from(row.querySelectorAll('.video-field-wrapper')));

    // Phase 1 (write): alle min-height zuruecksetzen, damit Schrumpfen moeglich ist.
    for (const wrappers of rowWrappers) {
      for (const w of wrappers) w.style.minHeight = '';
    }

    // Phase 2 (read): pro Zeile je data-video-id die groesste Hoehe ermitteln.
    const plans = rowWrappers.map(wrappers => {
      const maxByVideo = new Map();
      for (const w of wrappers) {
        if (!this._isVisible(w)) continue;
        const id = w.dataset.videoId || '';
        const h = w.getBoundingClientRect().height;
        if (h > (maxByVideo.get(id) || 0)) maxByVideo.set(id, h);
      }
      return maxByVideo;
    });

    // Phase 3 (write): allen Wrappern einer Gruppe die Gruppenhoehe als min-height geben.
    rowWrappers.forEach((wrappers, i) => {
      const maxByVideo = plans[i];
      for (const w of wrappers) {
        if (!this._isVisible(w)) continue;
        const max = maxByVideo.get(w.dataset.videoId || '');
        if (max && max > 0) w.style.minHeight = `${Math.ceil(max)}px`;
      }
    });
  }

  // Versteckte Spalten (display:none) -> offsetParent null -> nicht messen/setzen.
  _isVisible(el) {
    return el.offsetParent !== null;
  }

  /** Live-Trigger: ResizeObserver (Containerbreite), Tippen im Feedback, Window-Resize. */
  observe() {
    if (!this.container) return;

    this._onInput = (e) => {
      if (e.target?.closest?.('.stacked-video-textarea')) this.schedule();
    };
    this.container.addEventListener('input', this._onInput);

    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => this.schedule());
      this._resizeObserver.observe(this.container);
    }

    this._onResize = () => this.schedule();
    window.addEventListener('resize', this._onResize);
  }

  disconnect() {
    if (this._rafId != null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this._onInput && this.container) {
      this.container.removeEventListener('input', this._onInput);
    }
    this._resizeObserver?.disconnect();
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
    }
    this._onInput = null;
    this._onResize = null;
    this._resizeObserver = null;
  }
}
