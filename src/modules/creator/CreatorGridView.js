// CreatorGridView.js (ES6-Modul)
// Grid-Ansicht fuer Creator: responsive Profilkarten mit Instagram-Bio,
// Kennzahlen, Links und bis zu drei Post-/Reel-Thumbnails.
// Laedt weitere Karten per Infinite Scroll (IntersectionObserver).
//
// Die Komponente kapselt Rendering und Grid-spezifischen Zustand, damit die
// bereits grosse CreatorList nicht mit Karten-Markup ueberladen wird. Datenladen,
// Filter und Berechtigungen kommen von der uebergebenen CreatorList-Instanz.

import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { creatorUtils } from './CreatorUtils.js';

const GRID_CHUNK_SIZE = 25;
const MAX_MEDIA = 3;
const BIO_TOGGLE_THRESHOLD = 140;
const MAX_COOPS_PER_CARD = 6; // Marken pro Kooperations-Reihe (Plattform + Instagram)

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
        <div class="creator-grid" id="${this.gridId}" role="list"></div>
        <div class="creator-grid-status" id="${this.statusId}" aria-live="polite"></div>
        <div class="creator-grid-sentinel" id="${this.sentinelId}" aria-hidden="true"></div>
      </div>
    `;
  }

  getContainer() { return document.getElementById(this.gridId); }
  getStatus() { return document.getElementById(this.statusId); }
  getSentinel() { return document.getElementById(this.sentinelId); }

  // ── Laden ────────────────────────────────────────────────────────────────
  async reload() {
    this._requestId++;
    const reqId = this._requestId;

    this._page = 0;
    this._reachedEnd = false;
    this._loadedCount = 0;
    this._loading = false;
    this._signature = this._currentSignature();

    const container = this.getContainer();
    if (container) container.innerHTML = '';
    this._teardownObserver();
    this._setStatus('loading');

    await this._loadChunk(reqId, true);

    if (reqId === this._requestId && !this._reachedEnd && !this.list._destroyed) {
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
      const nextPage = this._page + 1;
      const filters = this.list.buildFilters();
      const result = await this.list.loadPageData(nextPage, GRID_CHUNK_SIZE, filters);

      // Veralteten Request verwerfen
      if (reqId !== this._requestId || this.list._destroyed) return;

      const items = result.data || [];
      this._total = result.total || 0;
      this._page = nextPage;
      this._loadedCount += items.length;
      this._appendCards(items);
      // Plattform-Kooperationen (Marken-Logos) asynchron nachladen
      this._hydrateKooperationen(items, reqId);

      if (items.length < GRID_CHUNK_SIZE || (this._total > 0 && this._loadedCount >= this._total)) {
        this._reachedEnd = true;
        this._teardownObserver();
      }

      if (this._loadedCount === 0) this._setStatus('empty');
      else if (this._reachedEnd) this._setStatus('end');
      else this._setStatus('idle');
    } catch (err) {
      if (reqId !== this._requestId) return;
      console.error('❌ CREATORGRID: Fehler beim Laden', err);
      this._setStatus('error');
    } finally {
      if (reqId === this._requestId) this._loading = false;
    }
  }

  _appendCards(items) {
    const container = this.getContainer();
    if (!container || !items.length) return;
    container.insertAdjacentHTML('beforeend', items.map(c => this.renderCard(c)).join(''));
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

    // Karte könnte während des Fetches entfernt worden sein
    const stillThere = this._findCard(container, id);
    if (!stillThere) return false;

    const wrap = document.createElement('div');
    wrap.innerHTML = this.renderCard(creator).trim();
    const next = wrap.firstElementChild;
    if (!next) return false;

    stillThere.replaceWith(next);
    // Kooperations-Reihe der neu gerenderten Karte wieder befuellen
    this._hydrateKooperationen([creator], this._requestId);
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
        el.innerHTML = '<div class="creator-grid-empty">Keine Creator gefunden.</div>';
        break;
      case 'error':
        el.innerHTML = '<div class="creator-grid-error">Fehler beim Laden der Creator. <button type="button" class="secondary-btn creator-grid-retry">Erneut versuchen</button></div>';
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
    const esc = (v) => window.validatorSystem?.sanitizeHtml?.(String(v ?? '')) ?? String(v ?? '');
    const num = (v) => (v != null && !isNaN(v)) ? Number(v).toLocaleString('de-DE') : '-';

    const name = `${c.vorname || ''} ${c.nachname || ''}`.trim() || 'Unbekannt';
    const id = c.id;
    const connected = !!c.ig_connected_at;

    return `
      <article class="creator-card" role="listitem" data-id="${id}">
        <a class="creator-card__link table-link" data-table="creator" data-id="${id}" href="#" aria-label="Profil von ${esc(name)} oeffnen"></a>
        ${this._renderMedia(c)}
        <div class="creator-card__body">
          <div class="creator-card__header">
            <h3 class="creator-card__name">${esc(name)}${connected ? '<span class="ig-connected-badge" title="Instagram verbunden"></span>' : ''}</h3>
            <div class="creator-card__actions">
              ${this._renderActions(c)}
            </div>
          </div>
          ${this._renderMeta(c)}
          ${this._renderTagRow(c)}
          ${this._renderInstagramBlock(c)}
          ${this._renderStats(c, num)}
          ${this._renderLinks(c)}
          <div class="creator-card__coops" data-creator-id="${id}"></div>
          ${this._renderPosts(c, num)}
        </div>
      </article>
    `;
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
    const safeAvatar = c.profilbild_url ? window.validatorSystem?.sanitizeUrl?.(c.profilbild_url) : null;

    const inner = safeAvatar
      ? `<img src="${safeAvatar}" alt="${esc(name)}" class="creator-card__cover" loading="lazy" />`
      : `<div class="creator-card__cover creator-card__cover--placeholder"><span>${esc((c.vorname || '?')[0].toUpperCase())}</span></div>`;

    return `<div class="creator-card__media">${inner}</div>`;
  }

  _renderMeta(c) {
    const stadt = c.lieferadresse_stadt ? this.list.renderLocationTag(c.lieferadresse_stadt, 'stadt') : '';
    const land = c.lieferadresse_land ? this.list.renderLocationTag(c.lieferadresse_land, 'land') : '';
    const age = this.list.formatAgeRange(c.alter_min, c.alter_max, c.alter_jahre);
    const ageHtml = age && age !== '-' ? `<span class="creator-card__age">${this.list.sanitize(age)} Jahre</span>` : '';

    if (!stadt && !land && !ageHtml) return '';
    return `<div class="creator-card__meta">${stadt}${land}${ageHtml}</div>`;
  }

  _renderTagRow(c) {
    const types = this.list.renderCreatorTypeTags(c.creator_types);
    const branchen = this.list.renderBrancheTags(c.branchen);
    const sprachen = this.list.renderSprachenTags(c.sprachen);

    const parts = [];
    if (types && types !== '-') parts.push(types);
    if (branchen && branchen !== '-') parts.push(branchen);
    if (sprachen && sprachen !== '-') parts.push(sprachen);
    if (!parts.length) return '';
    return `<div class="creator-card__tags">${parts.join('')}</div>`;
  }

  _renderInstagramBlock(c) {
    const esc = (v) => window.validatorSystem?.sanitizeHtml?.(String(v ?? '')) ?? String(v ?? '');

    if (c.ig_connected_at) {
      if (!c.ig_biography) return '';
      const bio = String(c.ig_biography);
      const needsToggle = bio.length > BIO_TOGGLE_THRESHOLD;
      return `
        <div class="creator-card__bio-block">
          <p class="creator-card__bio">${esc(bio)}</p>
          ${needsToggle ? '<button type="button" class="creator-card__bio-toggle" data-expanded="false">Mehr anzeigen</button>' : ''}
        </div>
      `;
    }

    // Nicht verbunden: Status; fuer Admins zusaetzlich CTA
    const cta = this.list.isAdmin && c.instagram
      ? `<button type="button" class="secondary-btn btn-sm creator-card__connect" data-id="${c.id}">Instagram verbinden</button>`
      : '';
    return `
      <div class="creator-card__ig-empty">
        <span class="ig-muted">Instagram nicht verbunden</span>
        ${cta}
      </div>
    `;
  }

  _renderStats(c, num) {
    const stats = [];
    const ig = creatorUtils.formatFollowerRange(c.instagram_follower);
    const tt = creatorUtils.formatFollowerRange(c.tiktok_follower);

    if (ig && ig !== '-') {
      stats.push(`<div class="creator-card__stat"><span class="creator-card__stat-value">${ig}</span><span class="creator-card__stat-label">Instagram</span></div>`);
    }
    if (tt && tt !== '-') {
      stats.push(`<div class="creator-card__stat"><span class="creator-card__stat-value">${tt}</span><span class="creator-card__stat-label">TikTok</span></div>`);
    }
    if (c.ig_connected_at && c.ig_engagement_rate != null && !isNaN(c.ig_engagement_rate)) {
      const er = `${Number(c.ig_engagement_rate).toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`;
      stats.push(`<div class="creator-card__stat"><span class="creator-card__stat-value">${er}</span><span class="creator-card__stat-label">Instagram Engagement</span></div>`);
    }

    if (!stats.length) return '';
    return `<div class="creator-card__stats">${stats.join('')}</div>`;
  }

  _renderLinks(c) {
    const esc = (v) => window.validatorSystem?.sanitizeHtml?.(String(v ?? '')) ?? String(v ?? '');
    const safeUrl = (u) => window.validatorSystem?.sanitizeUrl?.(u) || '';
    const links = [];

    if (c.instagram) {
      const raw = c.instagram.startsWith('http') ? c.instagram : `https://instagram.com/${String(c.instagram).replace('@', '')}`;
      const url = safeUrl(raw);
      if (url) links.push(`<a class="creator-card__link-chip" href="${url}" target="_blank" rel="noopener noreferrer" title="Instagram">Instagram</a>`);
    }
    if (c.tiktok) {
      const raw = c.tiktok.startsWith('http') ? c.tiktok : `https://tiktok.com/@${String(c.tiktok).replace('@', '')}`;
      const url = safeUrl(raw);
      if (url) links.push(`<a class="creator-card__link-chip" href="${url}" target="_blank" rel="noopener noreferrer" title="TikTok">TikTok</a>`);
    }
    if (c.portfolio_link) {
      const url = safeUrl(c.portfolio_link);
      if (url) links.push(`<a class="creator-card__link-chip" href="${url}" target="_blank" rel="noopener noreferrer" title="${esc(c.portfolio_link)}">Portfolio</a>`);
    }

    if (!links.length) return '';
    return `<div class="creator-card__links">${links.join('')}</div>`;
  }

  _renderPosts(c, num) {
    if (!c.ig_connected_at) return '';
    const posts = Array.isArray(c.ig_recent_posts) ? c.ig_recent_posts : [];
    const safeUrl = (u) => window.validatorSystem?.sanitizeUrl?.(u) || '';

    const usable = posts
      .filter(p => p && p.thumbnail_path && safeUrl(p.thumbnail_path))
      .slice(0, MAX_MEDIA);

    if (!usable.length) return '';

    const likeIcon = '<svg class="creator-card__post-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M178,40c-20.65,0-38.73,8.88-50,23.89C116.73,48.88,98.65,40,78,40a62.07,62.07,0,0,0-62,62c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,228.66,240,172,240,102A62.07,62.07,0,0,0,178,40ZM128,214.8C109.74,204.16,32,155.69,32,102A46.06,46.06,0,0,1,78,56c19.45,0,35.78,10.36,42.6,27a8,8,0,0,0,14.8,0c6.82-16.67,23.15-27,42.6-27a46.06,46.06,0,0,1,46,46C224,155.61,146.24,204.15,128,214.8Z"></path></svg>';
    const commentIcon = '<svg class="creator-card__post-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128ZM84,116a12,12,0,1,0,12,12A12,12,0,0,0,84,116Zm88,0a12,12,0,1,0,12,12A12,12,0,0,0,172,116Zm60,12A104,104,0,0,1,79.12,219.82L45.07,231.17a16,16,0,0,1-20.24-20.24l11.35-34.05A104,104,0,1,1,232,128Zm-16,0A88,88,0,1,0,51.81,172.06a8,8,0,0,1,.66,6.54L40,216,77.4,203.53a7.85,7.85,0,0,1,2.53-.42,8,8,0,0,1,4,1.08A88,88,0,0,0,216,128Z"></path></svg>';

    const cards = usable.map(p => {
      const thumb = safeUrl(p.thumbnail_path);
      const link = safeUrl(p.permalink);
      const isVideo = p.media_type === 'VIDEO';
      const meta = `<span class="creator-card__post-meta"><span class="creator-card__post-stat">${likeIcon}${num(p.like_count)}</span><span class="creator-card__post-stat">${commentIcon}${num(p.comments_count)}</span></span>`;
      const body = `
        <span class="creator-card__post-thumb">
          <img src="${thumb}" alt="Instagram Beitrag" loading="lazy" />
          ${isVideo ? '<span class="creator-card__post-badge">Reel</span>' : ''}
        </span>
        ${meta}
      `;
      return link
        ? `<a class="creator-card__post" href="${link}" target="_blank" rel="noopener noreferrer">${body}</a>`
        : `<span class="creator-card__post">${body}</span>`;
    }).join('');

    return `<div class="creator-card__posts">${cards}</div>`;
  }

  // ── Kooperationen (Plattform-Marken + Instagram-Werbepartner) ──────────────

  /**
   * Normalisiert ig_brand_mentions: Eintrag kann String (alt) oder
   * Objekt {handle,name,profile_pic} (neu) sein.
   * @returns {Array<{handle:string,name:string|null,profile_pic:string|null}>}
   */
  _normalizeBrandMentions(c) {
    const raw = Array.isArray(c.ig_brand_mentions) ? c.ig_brand_mentions : [];
    return raw
      .map((entry) => {
        if (!entry) return null;
        if (typeof entry === 'string') {
          return { handle: entry, name: null, profile_pic: null };
        }
        if (typeof entry === 'object' && entry.handle) {
          return {
            handle: String(entry.handle),
            name: entry.name || null,
            profile_pic: entry.profile_pic || null
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  /**
   * Laedt die Plattform-Kooperationen (Marke+Logo) fuer den geladenen Chunk in
   * einem Batch-Query und rendert pro Karte die gemischte Bubble-Reihe
   * (Plattform-Marken zuerst, dann Instagram-Werbepartner).
   */
  async _hydrateKooperationen(items, reqId) {
    if (!Array.isArray(items) || items.length === 0) return;
    const ids = items.map((c) => c.id).filter(Boolean);
    if (!ids.length || !window.supabase) return;

    let byCreator = new Map();
    try {
      const { data, error } = await window.supabase
        .from('kooperationen')
        .select('creator_id, created_at, kampagne:kampagne_id(marke:marke_id(id,markenname,logo_url,logo_thumb_url))')
        .in('creator_id', ids)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Pro Creator die Marken dedupen (nach marke.id), Reihenfolge = neueste zuerst
      for (const row of data || []) {
        const marke = row.kampagne?.marke;
        if (!marke?.id) continue;
        if (!byCreator.has(row.creator_id)) byCreator.set(row.creator_id, new Map());
        const marks = byCreator.get(row.creator_id);
        if (!marks.has(marke.id)) marks.set(marke.id, marke);
      }
    } catch (err) {
      // Batch-Load-Fehler still ignorieren – Karte bleibt ohne Coop-Reihe
      console.warn('⚠️ CREATORGRID: Kooperationen-Batch fehlgeschlagen', err?.message || err);
    }

    // Veralteten/abgebrochenen Request verwerfen
    if (reqId !== this._requestId || this.list._destroyed) return;
    const container = this.getContainer();
    if (!container) return;

    for (const c of items) {
      const el = container.querySelector(`.creator-card__coops[data-creator-id="${c.id}"]`);
      if (!el) continue;
      const platformMarks = Array.from((byCreator.get(c.id) || new Map()).values());
      const igBrands = this._normalizeBrandMentions(c);
      el.innerHTML = this._renderCoopsRow(platformMarks, igBrands);
    }
  }

  /**
   * Baut die gemischte Avatar-Bubble-Reihe. Plattform-Marken (intern klickbar)
   * zuerst, dann Instagram-Werbepartner (externer Link, sonst Initialen).
   * Dedupe Plattform vs. Instagram ueber den Namen (case-insensitive).
   */
  _renderCoopsRow(platformMarks, igBrands) {
    const items = [];
    const seenNames = new Set();

    for (const m of platformMarks) {
      const name = m.markenname || 'Marke';
      seenNames.add(name.trim().toLowerCase());
      items.push({
        name,
        type: 'org',
        id: m.id,
        entityType: 'marke',
        logo_url: m.logo_url || null,
        thumb_url: m.logo_thumb_url || null
      });
    }

    for (const b of igBrands) {
      const displayName = b.name || `@${b.handle}`;
      if (seenNames.has(displayName.trim().toLowerCase())) continue; // Dedupe vs. Plattform
      seenNames.add(displayName.trim().toLowerCase());
      items.push({
        name: displayName,
        type: 'org',
        logo_url: b.profile_pic || null,
        href: `https://instagram.com/${String(b.handle).replace('@', '')}`
      });
    }

    if (!items.length) return '';

    const bubbles = avatarBubbles.renderBubbles(items, { maxVisible: MAX_COOPS_PER_CARD });
    return `<div class="creator-card__coops-label">Letzte Kooperationen</div><div class="creator-card__coops-bubbles">${bubbles}</div>`;
  }

  // ── Events ───────────────────────────────────────────────────────────────
  bindEvents(signal) {
    document.addEventListener('click', (e) => {
      // Bio-Toggle (nur einzelne Karte)
      const toggle = e.target.closest('.creator-card__bio-toggle');
      if (toggle && this._ownsNode(toggle)) {
        e.preventDefault();
        e.stopPropagation();
        const block = toggle.closest('.creator-card__bio-block');
        const bio = block?.querySelector('.creator-card__bio');
        const expanded = toggle.dataset.expanded === 'true';
        if (bio) bio.classList.toggle('creator-card__bio--expanded', !expanded);
        toggle.dataset.expanded = String(!expanded);
        toggle.textContent = expanded ? 'Mehr anzeigen' : 'Weniger anzeigen';
        return;
      }

      // Instagram Connect CTA
      const connectBtn = e.target.closest('.creator-card__connect');
      if (connectBtn && this._ownsNode(connectBtn)) {
        e.preventDefault();
        e.stopPropagation();
        const id = connectBtn.dataset.id;
        if (id && window.ActionsDropdown?.handleAction) {
          window.ActionsDropdown.handleAction('connect', id, 'creator');
        }
        return;
      }

      // Retry nach Fehler
      const retry = e.target.closest('.creator-grid-retry');
      if (retry && retry.closest(`#${this.statusId}`)) {
        e.preventDefault();
        this.reload();
      }
    }, { signal });
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
