// CreatorGridView.js (ES6-Modul)
// Grid-Ansicht fuer Creator: kompakte Profilkarten mit Bild, Stammdaten,
// Kennzahlen und den beiden Aktionen Kontakt und Ins Casting.
// Laedt weitere Karten per Infinite Scroll (IntersectionObserver).
//
// Die Komponente kapselt Rendering und Grid-spezifischen Zustand, damit die
// bereits grosse CreatorList nicht mit Karten-Markup ueberladen wird. Datenladen,
// Filter und Berechtigungen kommen von der uebergebenen CreatorList-Instanz.

import { renderEmptyState } from '../../core/components/EmptyState.js';
import { rankByName } from './creatorProfil.js';
import { renderCreatorCard, renderCreatorZeile } from './creatorCardRender.js';
import { openCreatorSheet } from './creatorSheet.js';
import { bindGridEvents } from './creatorGridEvents.js';
import { ladeKooperationsVideos } from './creatorBuchung.js';
import { passeTagZeilen } from './creatorTags.js';
import { haengeMerkmaleAn } from './creatorMerkmale.js';
import { getScrollContainer } from '../../core/NavigationScroll.js';

const GRID_CHUNK_SIZE = 25;

export class CreatorGridView {
  constructor(list) {
    this.list = list; // CreatorList-Instanz
    this.mode = list.mode || 'all';

    this.gridId = `creator-grid-${this.mode}`;
    this.statusId = `creator-grid-status-${this.mode}`;
    this.sentinelId = `creator-grid-sentinel-${this.mode}`;
    this.wrapperId = `creator-grid-wrapper-${this.mode}`;

    this._page = 0;
    this._loading = false;
    this._reachedEnd = false;
    this._total = 0;
    this._loadedCount = 0;
    this._requestId = 0;
    this._observer = null;
    this._signature = null; // Kriterien-Signatur des letzten Syncs
  }

  // ── Shell ──────────────────────────────────────────────────────────────────
  renderShell() {
    return `
      <div class="creator-grid-wrapper" id="${this.wrapperId}">
        <div class="creator-grid${this.list.ansicht === 'liste' ? ' is-liste' : ''}" id="${this.gridId}" role="list"></div>
        <div class="creator-grid-status" id="${this.statusId}" aria-live="polite"></div>
        <div class="creator-grid-sentinel" id="${this.sentinelId}" aria-hidden="true"></div>
      </div>
    `;
  }

  getContainer() { return document.getElementById(this.gridId); }
  getStatus() { return document.getElementById(this.statusId); }
  getSentinel() { return document.getElementById(this.sentinelId); }

  // ── Laden ────────────────────────────────────────────────────────────────
  async reload({ scrollTop = false } = {}) {
    this._requestId++;
    const reqId = this._requestId;

    this._page = 0;
    this._reachedEnd = false;
    this._loadedCount = 0;
    this._loading = false;
    this._signature = this._currentSignature();

    const container = this.getContainer();
    const hasCards = Boolean(container && container.children.length > 0);
    if (hasCards) {
      container.classList.add('is-pending');
      this._setStatus('idle');
    } else {
      this._setStatus('loading');
    }
    if (scrollTop) {
      const scroller = getScrollContainer();
      if (scroller) scroller.scrollTop = 0;
    }
    this._teardownObserver();

    await this._loadChunk(reqId, true);

    if (reqId !== this._requestId || this.list._destroyed) return;
    container?.classList.remove('is-pending');
    if (!this._reachedEnd) {
      this._setupObserver();
      this._maybeLoadMore(reqId);
    }
  }

  isStale() {
    return this._signature !== this._currentSignature();
  }

  _currentSignature() {
    try {
      return JSON.stringify(this.list.buildFilters());
    } catch {
      return String(Date.now());
    }
  }

  async _loadChunk(reqId, initial = false) {
    if (this._loading || this._reachedEnd || this.list._destroyed) return;
    this._loading = true;
    if (!initial) this._setStatus('loading-more');

    try {
      const filters = this.list.buildFilters();
      const searching = Boolean(filters.name);
      const nextPage = searching ? 1 : this._page + 1;
      const result = await this.list.loadPageData(nextPage, searching ? 200 : GRID_CHUNK_SIZE, filters);

      // Veralteten Request verwerfen
      if (reqId !== this._requestId || this.list._destroyed) return;

      let items = result.data || [];
      if (searching && (!filters._sort || filters._sort === 'name')) items = rankByName(items, filters.name);
      try {
        await haengeMerkmaleAn(items);
      } catch (error) {
        console.warn('Merkmale konnten nicht geladen werden', error?.message || error);
      }
      if (reqId !== this._requestId || this.list._destroyed) return;
      if (initial) {
        this._total = result.total || 0;
        this.list.onResultTotal?.(this._total);
        const fresh = this.getContainer();
        if (fresh) {
          fresh.innerHTML = '';
          fresh.classList.remove('is-pending');
        }
      }
      this._page = nextPage;
      this._loadedCount += items.length;
      this._remember(items);
      this._appendCards(items);
      this._hydrateVideoCounts(items, reqId);

      if (searching || items.length < GRID_CHUNK_SIZE || (this._total > 0 && this._loadedCount >= this._total)) {
        this._reachedEnd = true;
        this._teardownObserver();
      }

      if (this._loadedCount === 0) this._setStatus('empty');
      else if (this._reachedEnd) this._setStatus('end');
      else this._setStatus('idle');
    } catch (err) {
      if (reqId !== this._requestId) return;
      console.error('❌ CREATORGRID: Fehler beim Laden', err);
      this._reachedEnd = true;
      this._teardownObserver();
      this.getContainer()?.classList.remove('is-pending');
      this._setStatus('error');
    } finally {
      if (reqId === this._requestId) this._loading = false;
    }
  }

  async loadMoreForScroll() {
    if (this._reachedEnd || this._loading || this.list._destroyed) return false;
    const before = this._loadedCount;
    await this._loadChunk(this._requestId);
    return this._loadedCount > before;
  }

  _appendCards(items) {
    const container = this.getContainer();
    if (!container || !items.length) return;
    container.insertAdjacentHTML('beforeend', items.map(c => this.renderCard(c)).join(''));
    requestAnimationFrame(() => passeTagZeilen(container));
  }

  /**
   * Soft-Update einer einzelnen Karte (z.B. nach Instagram Connect/Refresh).
   * Ersetzt nur das betroffene DOM-Element – Scroll-Position bleibt erhalten.
   * @returns {Promise<boolean>} true wenn die Karte gefunden und ersetzt wurde
   */
  _findCard(container, id) {
    const sid = String(id);
    return Array.from(container.querySelectorAll('.creator-card'))
      .find((el) => el.dataset.id === sid) || null;
  }

  async refreshCard(id) {
    if (!id) return false;
    const container = this.getContainer();
    if (!container) return false;

    const existing = this._findCard(container, id);
    if (!existing) return false;

    const creator = await this._loadCreatorById(id);
    if (!creator || this.list._destroyed) return false;
    try { await haengeMerkmaleAn([creator]); } catch { /* Karte bleibt ohne Merkmale */ }
    if (this.list.videoTage && this.list._countOrder) {
      const row = this.list._countOrder.find((entry) => entry.id === creator.id);
      if (row) creator.videos = row.anzahl;
    }

    // Karte könnte während des Fetches entfernt worden sein
    const stillThere = this._findCard(container, id);
    if (!stillThere) return false;

    const wrap = document.createElement('div');
    wrap.innerHTML = this.renderCard(creator).trim();
    const next = wrap.firstElementChild;
    if (!next) return false;

    stillThere.replaceWith(next);
    this._remember([creator]);
    this._hydrateVideoCounts([creator], this._requestId);
    requestAnimationFrame(() => passeTagZeilen(this.getContainer()));
    return true;
  }

  async _loadCreatorById(id) {
    if (!window.dataService?.loadEntitiesWithPagination) return null;
    try {
      const result = await window.dataService.loadEntitiesWithPagination(
        'creator',
        { _allowedIds: [String(id)] },
        1,
        1
      );
      return result?.data?.[0] || null;
    } catch (err) {
      console.error('❌ CREATORGRID: Einzelkarte laden fehlgeschlagen', err);
      return null;
    }
  }

  // Grosse Viewports: Sentinel evtl. weiterhin sichtbar -> naechsten Chunk nachladen
  _maybeLoadMore(reqId) {
    if (reqId !== this._requestId || this._reachedEnd || this._loading || this.list._destroyed) return;
    const sentinel = this.getSentinel();
    if (!sentinel) return;
    const rect = sentinel.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top <= viewportH + 300) {
      setTimeout(async () => {
        if (reqId !== this._requestId) return;
        await this._loadChunk(reqId);
        this._maybeLoadMore(reqId);
      }, 60);
    }
  }

  // ── Observer ───────────────────────────────────────────────────────────────
  _setupObserver() {
    const sentinel = this.getSentinel();
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;
    this._teardownObserver();
    this._observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const reqId = this._requestId;
          this._loadChunk(reqId).then(() => this._maybeLoadMore(reqId));
        }
      }
    }, { root: null, rootMargin: '300px 0px' });
    this._observer.observe(sentinel);
  }

  _teardownObserver() {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
  }

  // ── Status ───────────────────────────────────────────────────────────────
  _setStatus(state) {
    const el = this.getStatus();
    if (!el) return;

    const spinner = (text) => `
      <div class="creator-grid-loading">
        <div class="table-loading-spinner"></div>
        <span>${text}</span>
      </div>`;

    switch (state) {
      case 'loading':
        el.innerHTML = spinner('Lade Creator...');
        break;
      case 'loading-more':
        el.innerHTML = spinner('Lade weitere Creator...');
        break;
      case 'empty':
        el.innerHTML = renderEmptyState({ icon: 'creator', title: 'Keine Creator gefunden' });
        break;
      case 'error':
        el.innerHTML = '<div class="creator-grid-error">Fehler beim Laden der Creator. <button type="button" class="mdc-btn mdc-btn--secondary creator-grid-retry">Erneut versuchen</button></div>';
        break;
      case 'end':
      case 'idle':
      default:
        el.innerHTML = '';
        break;
    }
  }

  // ── Karten-Rendering ─────────────────────────────────────────────────────
  renderCard(c) {
    return this.list.ansicht === 'liste' ? renderCreatorZeile(c) : renderCreatorCard(c, this.list);
  }

  setAnsicht(ansicht) {
    const container = this.getContainer();
    if (!container) return;
    container.classList.toggle('is-liste', ansicht === 'liste');
    const ids = [...container.querySelectorAll('.creator-card')].map((el) => el.dataset.id);
    container.innerHTML = ids.map((id) => {
      const creator = this._byId?.get(id);
      return creator ? this.renderCard(creator) : '';
    }).join('');
    requestAnimationFrame(() => passeTagZeilen(container));
  }

  _remember(items) {
    if (!this._byId) this._byId = new Map();
    for (const creator of items || []) {
      if (creator?.id) this._byId.set(creator.id, creator);
    }
  }

  async _hydrateVideoCounts(items, reqId) {
    if (!Array.isArray(items) || !items.length || !window.supabase) return;
    const ids = items.map((c) => c.id).filter(Boolean);
    if (!ids.length) return;
    try {
      const counts = await ladeKooperationsVideos(window.supabase, ids);
      if (reqId !== this._requestId || this.list._destroyed) return;
      const root = this.getContainer();
      for (const id of ids) {
        const node = root?.querySelector(`[data-video-count="${id}"]`);
        if (node) node.textContent = String(counts.get(id) || 0);
      }
    } catch (err) {
      console.warn('⚠️ CREATORGRID: Videoanzahl fehlgeschlagen', err?.message || err);
    }
  }

  async openKontakt(id) {
    const creator = this._byId?.get(id);
    if (!creator) return;
    await openCreatorSheet(creator);
  }

  // ── Events ───────────────────────────────────────────────────────────────
  bindEvents(signal) {
    bindGridEvents(this, signal);
  }




  _replaceCard(creator) {
    const container = this.getContainer();
    const existing = container ? this._findCard(container, creator.id) : null;
    if (!existing) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = this.renderCard(creator).trim();
    const next = wrap.firstElementChild;
    if (!next) return;
    existing.replaceWith(next);
    requestAnimationFrame(() => passeTagZeilen(container));
  }

  _ownsNode(node) {
    return !!node.closest(`#${this.gridId}`);
  }

  destroy() {
    this._teardownObserver();
    this._requestId++; // laufende Loads verwerfen
    this._loading = false;
  }
}
