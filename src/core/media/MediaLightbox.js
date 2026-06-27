const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
const PREV_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`;
const NEXT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;

/**
 * Wiederverwendbare Lightbox-Shell fuer Medien-Viewer (Video, Storys, Bilder).
 * Folgt dem overlay-modal Muster (siehe ConfirmationModal): Overlay + Dialog,
 * Schliessen via Backdrop/Escape/Button, optionale Prev/Next-Navigation.
 *
 * Der Body wird ueber renderBody()/onMount vom jeweiligen Viewer geliefert und
 * kann via update() neu gerendert werden (z.B. bei Navigation).
 */
export class MediaLightbox {
  constructor() {
    this.overlay = null;
    this.contentEl = null;
    this._opts = null;
    this._onKey = null;
  }

  isOpen() {
    return !!this.overlay;
  }

  /**
   * @param {object} opts
   * @param {string} [opts.className]
   * @param {() => string} opts.renderBody - liefert das Body-HTML
   * @param {(root: HTMLElement) => void} [opts.onMount] - nach jedem Render aufgerufen
   * @param {() => void} [opts.onBeforeRerender] - vor jedem Re-Render (innerHTML-Reset)
   * @param {() => void} [opts.onPrev]
   * @param {() => void} [opts.onNext]
   * @param {() => boolean} [opts.hasPrev]
   * @param {() => boolean} [opts.hasNext]
   * @param {() => void} [opts.onClose]
   */
  open(opts) {
    this.close();
    this._opts = opts || {};

    const action = this._opts.headerAction;
    const overlay = document.createElement('div');
    overlay.className = `media-lightbox-overlay ${this._opts.className || ''}`.trim();
    overlay.innerHTML = `
      <div class="media-lightbox" role="dialog" aria-modal="true">
        <button type="button" class="media-lightbox-close" aria-label="Schliessen">${CLOSE_ICON}</button>
        ${action ? `<a class="media-lightbox-action" target="_blank" rel="noopener" aria-label="${action.ariaLabel || ''}" hidden>${action.icon || ''}</a>` : ''}
        ${this._opts.onPrev ? `<button type="button" class="media-lightbox-nav media-lightbox-prev" aria-label="Zurueck">${PREV_ICON}</button>` : ''}
        ${this._opts.onNext ? `<button type="button" class="media-lightbox-nav media-lightbox-next" aria-label="Weiter">${NEXT_ICON}</button>` : ''}
        <div class="media-lightbox-content"></div>
      </div>`;

    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.contentEl = overlay.querySelector('.media-lightbox-content');

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
    overlay.querySelector('.media-lightbox-close').addEventListener('click', () => this.close());

    const prevBtn = overlay.querySelector('.media-lightbox-prev');
    const nextBtn = overlay.querySelector('.media-lightbox-next');
    if (prevBtn) prevBtn.addEventListener('click', () => this._opts?.onPrev?.());
    if (nextBtn) nextBtn.addEventListener('click', () => this._opts?.onNext?.());

    this._onKey = (e) => {
      if (e.key === 'Escape') { this.close(); return; }
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === 'ArrowLeft' && this._opts?.onPrev) this._opts.onPrev();
      else if (e.key === 'ArrowRight' && this._opts?.onNext) this._opts.onNext();
    };
    document.addEventListener('keydown', this._onKey);

    this.update();
    requestAnimationFrame(() => overlay.classList.add('show'));
  }

  /**
   * Body neu rendern (ohne Overlay neu zu erzeugen).
   * Async: onBeforeRerender darf offene Saves awaiten, BEVOR die Textarea aus
   * dem DOM ersetzt wird -> kein verlorener Text bei Prev/Next/Variantenwechsel.
   */
  async update() {
    if (!this.overlay || !this._opts) return;
    // Hook VOR dem innerHTML-Reset: erlaubt dem Viewer, das aktuelle
    // Stage-Video zu retten (offscreen parken) statt es zu zerstoeren, und
    // offenes Feedback verlustsicher zu speichern.
    await this._opts.onBeforeRerender?.();
    if (!this.overlay || !this._opts) return; // zwischenzeitlich geschlossen
    this.contentEl.innerHTML = this._opts.renderBody ? this._opts.renderBody() : '';
    this._opts.onMount?.(this.contentEl);
    this._updateNavState();
  }

  _updateNavState() {
    const prevBtn = this.overlay.querySelector('.media-lightbox-prev');
    const nextBtn = this.overlay.querySelector('.media-lightbox-next');
    if (prevBtn && this._opts.hasPrev) prevBtn.disabled = !this._opts.hasPrev();
    if (nextBtn && this._opts.hasNext) nextBtn.disabled = !this._opts.hasNext();

    const actionEl = this.overlay.querySelector('.media-lightbox-action');
    if (actionEl && this._opts.headerAction?.getHref) {
      const href = this._opts.headerAction.getHref();
      if (href) {
        actionEl.href = href;
        actionEl.hidden = false;
      } else {
        actionEl.removeAttribute('href');
        actionEl.hidden = true;
      }
    }
  }

  async close() {
    if (this._onKey) {
      document.removeEventListener('keydown', this._onKey);
      this._onKey = null;
    }
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      this.contentEl = null;
    }
    const onClose = this._opts?.onClose;
    this._opts = null;
    // onClose darf offene Saves awaiten (Persistenz vor Teardown).
    await onClose?.();
  }
}
