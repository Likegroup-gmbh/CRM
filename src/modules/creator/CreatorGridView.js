// CreatorGridView.js (ES6-Modul)
// Grid-Ansicht fuer Creator: kompakte Profilkarten mit Bild, Stammdaten,
// Kennzahlen und den beiden Aktionen Kontakt und Ins Casting.
// Laedt weitere Karten per Infinite Scroll (IntersectionObserver).
//
// Die Komponente kapselt Rendering und Grid-spezifischen Zustand, damit die
// bereits grosse CreatorList nicht mit Karten-Markup ueberladen wird. Datenladen,
// Filter und Berechtigungen kommen von der uebergebenen CreatorList-Instanz.

import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';
import { ageLabel, cardChips, formatFollowerShort, groesseOf, rankByName } from './creatorProfil.js';
import { openCastingPicker } from './creatorCasting.js';
import { openCreatorSheet } from './creatorSheet.js';
import { darfRezensionSehen, formatRezension } from './rezension.js';
import { renderFavorit, renderFavoritNamen, toggleFavorit } from './creatorFavorit.js';
import { renderTagZeile, passeTagZeilen } from './creatorTags.js';
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
    if (this.list.videoTage && this.list._videoOrder) {
      const row = this.list._videoOrder.find((entry) => entry.id === creator.id);
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
    if (this.list.ansicht === 'liste') return this.renderZeile(c);
    const esc = (v) => window.validatorSystem?.sanitizeHtml?.(String(v ?? '')) ?? String(v ?? '');
    const name = `${c.vorname || ''} ${c.nachname || ''}`.trim() || 'Unbekannt';
    const id = c.id;

    return `
      <article class="creator-card" role="listitem" data-id="${id}">
        <button type="button" class="creator-card__link" data-id="${id}" aria-label="Akte von ${esc(name)} öffnen"></button>
        ${this._renderMedia(c)}
        <div class="creator-card__body">
          <div class="creator-card__header">
            <h3 class="creator-card__name">${esc(name)}</h3>
            <div class="creator-card__actions">
              ${renderFavorit(c)}
              ${this._renderActions(c)}
            </div>
          </div>
          ${this._renderMeta(c)}
          ${this._renderTagRow(c)}
          ${renderTagZeile(c.tags)}
          ${this._renderStats(c)}
          <div class="creator-card__links">
            <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm creator-card__casting" data-id="${id}">Ins Casting</button>
          </div>
        </div>
      </article>
    `;
  }

  renderZeile(c) {
    const esc = (v) => window.validatorSystem?.sanitizeHtml?.(String(v ?? '')) ?? String(v ?? '');
    const name = `${c.vorname || ''} ${c.nachname || ''}`.trim() || 'Unbekannt';
    const id = c.id;
    const stadt = c.lieferadresse_stadt ? esc(c.lieferadresse_stadt) : '';
    const groesse = groesseOf(c);
    const ig = c.instagram_follower ? formatFollowerShort(c.instagram_follower) : '';
    const rezension = darfRezensionSehen() && c.rezension_schnitt != null
      ? formatRezension(c.rezension_schnitt)
      : '';
    const videos = typeof c.videos === 'number' ? String(c.videos) : '';
    const bits = [
      stadt,
      groesse,
      ig ? `${ig} Instagram` : '',
      rezension ? `${rezension} Rezension` : '',
      videos !== '' ? `${videos} Videos` : ''
    ].filter(Boolean);
    return `
      <article class="creator-card creator-card--zeile" role="listitem" data-id="${id}">
        <button type="button" class="creator-card__link" data-id="${id}" aria-label="Akte von ${esc(name)} öffnen"></button>
        ${this._renderMedia(c)}
        <div class="creator-card__body">
          <div class="creator-card__header">
            <h3 class="creator-card__name">${esc(name)}</h3>
            ${renderFavorit(c)}
          </div>
          <div class="creator-card__meta">${bits.map((bit) => `<span>${bit}</span>`).join('')}</div>
          ${renderTagZeile(c.tags)}
        </div>
      </article>
    `;
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

  _renderActions(c) {
    const actionOptions = {};
    if (!c.instagram) actionOptions.disabledActions = ['connect'];
    if (c.ig_connected_at) actionOptions.igConnected = true;
    return actionBuilder.create('creator', c.id, null, actionOptions);
  }

  _renderMedia(c) {
    const esc = (v) => window.validatorSystem?.sanitizeHtml?.(String(v ?? '')) ?? String(v ?? '');
    const name = `${c.vorname || ''} ${c.nachname || ''}`.trim() || 'Unbekannt';
    // Cover fuellt die Kartenbreite im Quadrat - hier das Hauptbild, kein Thumb
    const safeAvatar = c.profilbild_url ? window.validatorSystem?.sanitizeUrl?.(c.profilbild_url) : null;

    const inner = safeAvatar
      ? `<img src="${safeAvatar}" alt="${esc(name)}" class="creator-card__cover" loading="lazy" />`
      : `<div class="creator-card__cover creator-card__cover--placeholder"><span>${esc((c.vorname || '?')[0].toUpperCase())}</span></div>`;

    return `<div class="creator-card__media">${inner}</div>`;
  }

  _renderMeta(c) {
    const stadt = c.lieferadresse_stadt ? this.list.renderLocationTag(c.lieferadresse_stadt, 'stadt') : '';
    const age = ageLabel(c);
    const ageHtml = age ? `<span class="creator-card__age">${this.list.sanitize(age)}</span>` : '';
    const groesse = groesseOf(c);
    const groesseHtml = groesse ? `<span class="creator-card__age">${this.list.sanitize(groesse)}</span>` : '';

    if (!stadt && !ageHtml && !groesseHtml) return '';
    return `<div class="creator-card__meta">${stadt}${ageHtml}${groesseHtml}</div>`;
  }

  _renderTagRow(c) {
    const chips = cardChips(c.creator_types, c.branchen)
      .map(({ label, art }) => `<span class="tag tag--${art}">${this.list.sanitize(label)}</span>`)
      .join('');
    if (!chips) return '';
    return `<div class="creator-card__tags tags tags-compact">${chips}</div>`;
  }

  _renderStats(c) {
    const stats = [];
    if (darfRezensionSehen()) {
      stats.push(`<div class="creator-card__stat"><span class="creator-card__stat-value">${formatRezension(c.rezension_schnitt)}</span><span class="creator-card__stat-label">Rezension</span></div>`);
    }
    if (typeof c.videos === 'number') {
      stats.push(`<div class="creator-card__stat"><span class="creator-card__stat-value">${c.videos}</span><span class="creator-card__stat-label">Videos</span></div>`);
    }
    const ig = formatFollowerShort(c.instagram_follower);
    const tt = formatFollowerShort(c.tiktok_follower);

    if (ig != null) {
      stats.push(`<div class="creator-card__stat"><span class="creator-card__stat-value">${ig}</span><span class="creator-card__stat-label">Instagram</span></div>`);
    }
    if (tt != null) {
      stats.push(`<div class="creator-card__stat"><span class="creator-card__stat-value">${tt}</span><span class="creator-card__stat-label">TikTok</span></div>`);
    }
    stats.push(`<div class="creator-card__stat"><span class="creator-card__stat-value" data-video-count="${c.id}">0</span><span class="creator-card__stat-label">Kooperationsvideos</span></div>`);

    return `<div class="creator-card__stats">${stats.join('')}</div>`;
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
      const { data: koops, error } = await window.supabase
        .from('kooperationen')
        .select('id, creator_id')
        .in('creator_id', ids);
      if (error) throw error;
      const koopIds = (koops || []).map((row) => row.id);
      let videoRows = [];
      if (koopIds.length) {
        const { data, error: videoError } = await window.supabase
          .from('kooperation_videos')
          .select('kooperation_id')
          .in('kooperation_id', koopIds);
        if (videoError) throw videoError;
        videoRows = data || [];
      }
      if (reqId !== this._requestId || this.list._destroyed) return;
      const koopToCreator = new Map((koops || []).map((row) => [row.id, row.creator_id]));
      const counts = new Map();
      for (const row of videoRows) {
        const creatorId = koopToCreator.get(row.kooperation_id);
        if (!creatorId) continue;
        counts.set(creatorId, (counts.get(creatorId) || 0) + 1);
      }
      const root = this.getContainer();
      for (const id of ids) {
        const node = root?.querySelector(`[data-video-count="${id}"]`);
        if (!node) continue;
        node.textContent = String(counts.get(id) || 0);
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
    document.addEventListener('click', async (e) => {
      const favorit = e.target.closest('[data-action="toggle-favorit"]');
      if (favorit && this._ownsNode(favorit)) {
        e.preventDefault();
        e.stopPropagation();
        await this._toggleFavorit(favorit.dataset.id);
        return;
      }
      const show = e.target.closest('[data-action="show-favoriten"]');
      if (show && this._ownsNode(show)) {
        e.preventDefault();
        e.stopPropagation();
        this._toggleNamen(show.dataset.id);
        return;
      }
      const person = e.target.closest('[data-action="filter-favorit"]');
      if (person && this._ownsNode(person)) {
        e.preventDefault();
        e.stopPropagation();
        this.list.setFavoritVon?.(person.dataset.userId);
        return;
      }
      const open = e.target.closest('.creator-card__link');
      if (open && this._ownsNode(open)) {
        e.preventDefault();
        e.stopPropagation();
        this.openKontakt(open.dataset.id);
        return;
      }
      // Auch aus der Kontakt-Schublade heraus
      const casting = e.target.closest('.creator-card__casting');
      if (casting && (this._ownsNode(casting) || casting.closest('.drawer-panel'))) {
        e.preventDefault();
        e.stopPropagation();
        const creator = this._byId?.get(casting.dataset.id);
        if (creator) openCastingPicker(creator);
        return;
      }

      // Retry nach Fehler
      const retry = e.target.closest('.creator-grid-retry');
      if (retry && retry.closest(`#${this.statusId}`)) {
        e.preventDefault();
        this.reload();
      }
    }, { signal });

    window.addEventListener('creator-merkmale-changed', (event) => {
      const detail = event.detail || {};
      const creator = this._byId?.get(detail.id);
      if (!creator) {
        if (detail.favoritVon) this.list.setFavoritVon?.(detail.favoritVon);
        return;
      }
      if (detail.favoriten) creator.favoriten = detail.favoriten;
      if (detail.tags) creator.tags = detail.tags;
      if (detail.favoritVon) this.list.setFavoritVon?.(detail.favoritVon);
      else this._replaceCard(creator);
    }, { signal });
  }

  async _toggleFavorit(id) {
    const creator = this._byId?.get(id);
    if (!creator || !window.supabase) return;
    try {
      creator.favoriten = await toggleFavorit(window.supabase, id, creator.favoriten || []);
      this._replaceCard(creator);
    } catch (error) {
      console.error('Favorit konnte nicht gesetzt werden', error);
      window.toastSystem?.show('Favorit konnte nicht gesetzt werden', 'error');
    }
  }

  _toggleNamen(id) {
    const card = this._findCard(this.getContainer(), id);
    const creator = this._byId?.get(id);
    if (!card || !creator) return;
    const host = card.querySelector('.creator-favorit');
    const open = host?.querySelector('.creator-favorit__namen');
    document.querySelectorAll('.creator-favorit__namen').forEach((node) => node.remove());
    if (!open && host) host.insertAdjacentHTML('beforeend', renderFavoritNamen(creator.favoriten));
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
