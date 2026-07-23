// InstagramDiscoveryPage.js
// Instagram Creator Discovery (Admin, Deep-Link /instagram).
// Layout wie der Skripte-Editor: LINKS Filterleiste + Ergebnis-Grid,
// RECHTS Chat-Panel. Der Chat uebersetzt natuerliche Sprache via Claude in
// Filter (Function instagram-query) und queryt den instagram_creators-Pool.
// Manuelle Filteraenderungen queryn den Pool direkt (ohne KI-Call).
// Admin-Bereich: Hashtag-Seeds pflegen, Backfill/Harvest triggern, Lauf-Historie.

import { InstagramDiscoveryService } from './InstagramDiscoveryService.js';
import { AvatarBubbles } from '../../core/components/AvatarBubbles.js';

const LIMIT_OPTIONS = [25, 50, 100];
const FILTER_DEBOUNCE_MS = 350;

// Lesbare Labels fuer stats.phase aus den Background-Functions
const PHASE_LABELS = {
  starting: 'Start',
  seeds: 'Seeds laden',
  hashtags: 'Hashtag-Suche',
  scrape: 'Posts scrapen',
  enrich: 'Profile anreichern',
  crm_load: 'CRM-Handles laden',
  brands: 'Brand-Logos laden',
  done: 'Fertig'
};

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatCount(n) {
  if (n === null || n === undefined) return '–';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')} Mio.`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}k`;
  return String(n);
}

const EMPTY_FILTERS = {
  topics: [], followers_min: null, followers_max: null,
  posts_min: null, posts_max: null, engagement_min: null,
  brands: [], min_brand_count: null, age_range: null, search_text: null
};

export class InstagramDiscoveryPage {
  constructor() {
    this.service = new InstagramDiscoveryService();
    this.filters = { ...EMPTY_FILTERS };
    this.limit = 25;
    this.results = [];
    this.brands = {}; // handle -> { name, profile_picture_url } aus instagram_brands
    this.messages = []; // {role, text}
    this.loading = false;
    this._filterTimer = null;
    this._runPollTimer = null;
  }

  async init() {
    if (!window.isAdmin?.()) {
      window.setContentSafely(window.content, `
        <div class="empty-state"><p>Kein Zugriff – diese Seite ist nur für Admins.</p></div>
      `);
      return;
    }
    window.setHeadline('Instagram Discovery');
    this.render();
    this.bindEvents();
    this.checkStatus();
    this.runQuery(); // initialer Pool-Load (leere Filter -> Top nach Followern)
  }

  render() {
    const html = `
      <div class="ig-disco">
        <div class="ig-disco-shell">

          <main class="ig-disco-main">
            <div class="ig-disco-toolbar">
              <div id="ig-status" class="ig-status">Verbindung wird geprüft…</div>
              <div class="ig-disco-filters">
                <label>Follower<input type="number" id="f-fol-min" class="form-input" placeholder="min" min="0" step="100000"></label>
                <label><input type="number" id="f-fol-max" class="form-input" placeholder="max" min="0" step="100000"></label>
                <label>Posts<input type="number" id="f-post-min" class="form-input" placeholder="min" min="0"></label>
                <label><input type="number" id="f-post-max" class="form-input" placeholder="max" min="0"></label>
                <label>ER %<input type="number" id="f-er-min" class="form-input" placeholder="min" min="0" step="0.5"></label>
                <label>Marken min<input type="number" id="f-brand-min" class="form-input" placeholder="0" min="0"></label>
                <label>Suche<input type="text" id="f-search" class="form-input" placeholder="Thema / Name"></label>
                <label>Anzahl
                  <select id="f-limit" class="form-input">
                    ${LIMIT_OPTIONS.map((n) => `<option value="${n}">${n}</option>`).join('')}
                  </select>
                </label>
                <button id="f-reset" class="ghost-btn">Zurücksetzen</button>
              </div>
              <div id="ig-active-filters" class="ig-active-filters"></div>
            </div>

            <div id="ig-result-info" class="ig-muted"></div>
            <div id="ig-grid" class="ig-grid"></div>

            <details class="ig-admin">
              <summary>Pool-Verwaltung (Admin)</summary>
              <div class="ig-admin-body">
                <div class="ig-admin-actions">
                  <button id="ig-backfill" class="ghost-btn">CRM-Backfill starten</button>
                  <button id="ig-harvest" class="ghost-btn">Harvest jetzt starten</button>
                  <button id="ig-refresh" class="ghost-btn" title="Alle Pool-Creator neu anreichern: aktuelle Posts, Engagement Rate und Kooperationen">Pool aktualisieren</button>
                  <span id="ig-admin-info" class="ig-muted"></span>
                </div>
                <div class="ig-admin-seeds">
                  <div class="ig-admin-seedadd">
                    <input type="text" id="ig-seed-input" class="form-input" placeholder="Hashtag ohne # (z.B. hundeliebe)">
                    <button id="ig-seed-add" class="ghost-btn">Seed hinzufügen</button>
                  </div>
                  <div id="ig-seed-list" class="ig-seed-list"></div>
                </div>
                <div id="ig-runs" class="ig-runs"></div>
              </div>
            </details>
          </main>

          <aside class="ig-disco-chat">
            <div id="ig-chat-log" class="ig-chat-log"></div>
            <div class="ig-chat-input">
              <textarea id="ig-chat-text" rows="2" placeholder="z.B. Hunde-Creator mit 2M+ Followern und ER über 3%"></textarea>
              <button id="ig-chat-send" class="primary-btn">Suchen</button>
            </div>
          </aside>

        </div>
      </div>
    `;
    window.setContentSafely(window.content, html);
    this.renderChat();
  }

  bindEvents() {
    document.getElementById('ig-chat-send')?.addEventListener('click', () => this.sendChat());
    document.getElementById('ig-chat-text')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendChat(); }
    });

    const filterIds = ['f-fol-min', 'f-fol-max', 'f-post-min', 'f-post-max', 'f-er-min', 'f-brand-min', 'f-search'];
    for (const id of filterIds) {
      document.getElementById(id)?.addEventListener('input', () => {
        clearTimeout(this._filterTimer);
        this._filterTimer = setTimeout(() => { this.readFilters(); this.runQuery(); }, FILTER_DEBOUNCE_MS);
      });
    }
    document.getElementById('f-limit')?.addEventListener('change', () => {
      this.limit = Number(document.getElementById('f-limit').value) || 25;
      this.runQuery();
    });
    document.getElementById('f-reset')?.addEventListener('click', () => {
      this.filters = { ...EMPTY_FILTERS };
      this.writeFilterInputs();
      this.runQuery();
    });

    document.getElementById('ig-backfill')?.addEventListener('click', () => this.triggerBackfill());
    document.getElementById('ig-harvest')?.addEventListener('click', () => this.triggerHarvest());
    document.getElementById('ig-refresh')?.addEventListener('click', () => this.triggerRefresh());
    document.getElementById('ig-seed-add')?.addEventListener('click', () => this.addSeed());

    this.loadSeeds();
    // Falls beim Seitenaufruf schon ein Lauf aktiv ist, direkt live mitverfolgen
    this.stopRunPolling();
    this.loadRuns().then((running) => { if (running) this.startRunPolling(); });
  }

  async checkStatus() {
    const el = document.getElementById('ig-status');
    if (!el) return;
    try {
      const { account } = await this.service.status();
      el.className = 'ig-status ig-status-ok';
      el.textContent = `Verbunden: @${account.username}`;
    } catch (err) {
      el.className = 'ig-status ig-status-error';
      el.textContent = `Verbindung: ${err.message}`;
    }
  }

  readFilters() {
    const num = (id) => {
      const v = document.getElementById(id)?.value;
      return v === '' || v == null ? null : Number(v);
    };
    this.filters = {
      ...this.filters,
      followers_min: num('f-fol-min'),
      followers_max: num('f-fol-max'),
      posts_min: num('f-post-min'),
      posts_max: num('f-post-max'),
      engagement_min: num('f-er-min'),
      min_brand_count: num('f-brand-min'),
      search_text: (document.getElementById('f-search')?.value || '').trim() || null
    };
  }

  writeFilterInputs() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    set('f-fol-min', this.filters.followers_min);
    set('f-fol-max', this.filters.followers_max);
    set('f-post-min', this.filters.posts_min);
    set('f-post-max', this.filters.posts_max);
    set('f-er-min', this.filters.engagement_min);
    set('f-brand-min', this.filters.min_brand_count);
    set('f-search', this.filters.search_text);
    this.renderActiveFilters();
  }

  renderActiveFilters() {
    const el = document.getElementById('ig-active-filters');
    if (!el) return;
    const chips = [];
    if (this.filters.topics?.length) chips.push(...this.filters.topics.map((t) => `Thema: ${t}`));
    if (this.filters.brands?.length) chips.push(...this.filters.brands.map((b) => `Marke: ${b}`));
    if (this.filters.age_range) chips.push(`Alter: ${this.filters.age_range}`);
    el.innerHTML = chips.map((c) => `<span class="ig-chip">${esc(c)}</span>`).join('');
  }

  async runQuery(message = '') {
    const grid = document.getElementById('ig-grid');
    const info = document.getElementById('ig-result-info');
    if (info) info.textContent = 'Lädt…';
    try {
      const res = await this.service.query({
        message,
        currentFilters: this.filters,
        limit: this.limit
      });
      this.filters = { ...EMPTY_FILTERS, ...res.filters };
      this.results = res.results || [];
      this.brands = res.brands || {};
      this.writeFilterInputs();
      this.renderGrid();
      if (info) info.textContent = `${this.results.length} Creator`;
      return res.reply;
    } catch (err) {
      if (info) info.textContent = '';
      if (grid) grid.innerHTML = `<div class="empty-state"><p>Fehler: ${esc(err.message)}</p></div>`;
      throw err;
    }
  }

  renderGrid() {
    const grid = document.getElementById('ig-grid');
    if (!grid) return;
    if (this.results.length === 0) {
      grid.innerHTML = '<div class="empty-state"><p>Keine Creator im Pool entsprechen den Filtern. Backfill/Harvest starten oder Filter lockern.</p></div>';
      return;
    }
    grid.innerHTML = this.results.map((p) => this.renderCard(p)).join('');
  }

  renderCard(p) {
    const avatar = p.profile_picture_url
      ? `<img class="ig-card-avatar" src="${esc(p.profile_picture_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
      : '<div class="ig-card-avatar ig-card-avatar-placeholder">?</div>';

    const posts = (p.recent_media || []).slice(0, 3).map((m) => {
      const src = m.thumbnail_url || (m.media_type === 'VIDEO' ? null : m.media_url);
      const inner = src
        ? `<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
        : `<span class="ig-post-placeholder">${esc(m.media_type || 'POST')}</span>`;
      return m.permalink
        ? `<a class="ig-post" href="${esc(m.permalink)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
        : `<div class="ig-post">${inner}</div>`;
    }).join('');

    const topics = (p.topics || []).slice(0, 6).map((t) => `<span class="ig-tag">${esc(t)}</span>`).join('');

    // Kooperations-Bubbles: Logo + Firmenname (Tooltip) aus dem Brand-Cache,
    // Fallback @handle als Initialen-Bubble
    const brandItems = (p.brand_mentions || []).map((handle) => {
      const brand = this.brands[handle] || {};
      return {
        name: brand.name || `@${handle}`,
        logo_url: brand.profile_picture_url || null,
        type: 'org'
      };
    });
    const brandBubbles = brandItems.length
      ? `<div class="ig-card-brands">
          <span class="ig-card-brands-label">Kooperationen</span>
          ${AvatarBubbles.renderBubbles(brandItems, { maxVisible: 4 })}
        </div>`
      : '';
    const bio = p.biography
      ? `<p class="ig-card-bio">${esc(p.biography.length > 110 ? `${p.biography.slice(0, 110)}…` : p.biography)}</p>`
      : '';
    const er = p.engagement_rate != null ? `${p.engagement_rate}%` : '–';
    const age = p.estimated_age_range ? `<span class="ig-card-age" title="LLM-Schätzung">~${esc(p.estimated_age_range)}</span>` : '';
    const sourceBadge = `<span class="ig-source ig-source-${esc(p.source)}">${p.source === 'harvest' ? 'Harvest' : 'CRM'}</span>`;

    return `
      <div class="ig-card">
        <div class="ig-card-head">
          ${avatar}
          <div class="ig-card-title">
            <strong>${esc(p.name || p.username)}</strong>
            <a href="https://www.instagram.com/${esc(p.username)}" target="_blank" rel="noopener noreferrer">@${esc(p.username)}</a>
          </div>
          ${sourceBadge}
        </div>
        <div class="ig-card-stats">
          <span><strong>${formatCount(p.followers_count)}</strong> Follower</span>
          <span><strong>${formatCount(p.media_count)}</strong> Posts</span>
          <span><strong>${er}</strong> ER</span>
          ${age}
        </div>
        ${topics ? `<div class="ig-card-tags">${topics}</div>` : ''}
        ${brandBubbles}
        ${bio}
        ${posts ? `<div class="ig-card-posts">${posts}</div>` : ''}
      </div>
    `;
  }

  // --- Chat ---

  renderChat() {
    const log = document.getElementById('ig-chat-log');
    if (!log) return;
    if (this.messages.length === 0 && !this.loading) {
      log.innerHTML = `<div class="ig-chat-empty">
        <strong>Creator-Suche per Chat</strong>
        <span>Beschreibe, wen du suchst – z.B. „Hunde-Creator, 2M+ Follower, schon mit 3 Marken gearbeitet".</span>
      </div>`;
      return;
    }
    const msgs = this.messages.map((m) => `
      <div class="ig-msg ig-msg--${m.role}">
        <div class="ig-msg-text">${esc(m.text)}</div>
      </div>
    `).join('');
    const working = this.loading ? '<div class="ig-msg ig-msg--assistant"><div class="ig-working">Suche läuft…</div></div>' : '';
    log.innerHTML = msgs + working;
    log.scrollTop = log.scrollHeight;
  }

  async sendChat() {
    const input = document.getElementById('ig-chat-text');
    const text = (input?.value || '').trim();
    if (!text || this.loading) return;
    input.value = '';
    this.messages.push({ role: 'user', text });
    this.loading = true;
    this.renderChat();
    try {
      const reply = await this.runQuery(text);
      this.messages.push({ role: 'assistant', text: reply || 'Fertig.' });
    } catch (err) {
      this.messages.push({ role: 'assistant', text: `Fehler: ${err.message}` });
    } finally {
      this.loading = false;
      this.renderChat();
    }
  }

  // --- Admin: Seeds ---

  async loadSeeds() {
    const el = document.getElementById('ig-seed-list');
    if (!el) return;
    const { data, error } = await window.supabase
      .from('instagram_hashtag_seeds')
      .select('id, hashtag, aktiv, last_run_at')
      .order('hashtag');
    if (error) { el.innerHTML = `<span class="ig-muted">Seeds-Fehler: ${esc(error.message)}</span>`; return; }
    if (!data?.length) { el.innerHTML = '<span class="ig-muted">Noch keine Hashtag-Seeds.</span>'; return; }
    el.innerHTML = data.map((s) => `
      <span class="ig-seed ${s.aktiv ? '' : 'ig-seed-off'}">
        #${esc(s.hashtag)}
        <button data-id="${s.id}" data-aktiv="${s.aktiv}" class="ig-seed-toggle">${s.aktiv ? 'aus' : 'an'}</button>
      </span>
    `).join('');
    el.querySelectorAll('.ig-seed-toggle').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await window.supabase.from('instagram_hashtag_seeds')
          .update({ aktiv: btn.dataset.aktiv !== 'true' }).eq('id', btn.dataset.id);
        this.loadSeeds();
      });
    });
  }

  async addSeed() {
    const input = document.getElementById('ig-seed-input');
    const raw = (input?.value || '').trim().replace(/^#/, '').toLowerCase();
    if (!raw) return;
    const { error } = await window.supabase
      .from('instagram_hashtag_seeds')
      .insert({ hashtag: raw });
    if (error) { window.toastSystem?.show(`Seed-Fehler: ${error.message}`, 'error'); return; }
    input.value = '';
    this.loadSeeds();
  }

  // --- Admin: Runs + Trigger ---

  /**
   * Letzte Läufe rendern (inkl. Phase, Stats, vollem Fehlertext).
   * @returns {boolean} true wenn mindestens ein Lauf noch running ist
   */
  async loadRuns() {
    const el = document.getElementById('ig-runs');
    if (!el) return false;
    const { data } = await window.supabase
      .from('instagram_harvest_runs')
      .select('trigger_type, status, stats, error, started_at, finished_at')
      .order('started_at', { ascending: false })
      .limit(8);
    if (!data?.length) { el.innerHTML = ''; return false; }

    el.innerHTML = '<div class="ig-runs-title">Letzte Läufe</div>'
      + data.map((r) => this.renderRun(r)).join('');
    return data.some((r) => r.status === 'running');
  }

  renderRun(r) {
    const s = r.stats || {};
    const when = new Date(r.started_at).toLocaleString('de-DE');
    const typeLabel = r.trigger_type === 'backfill' ? 'Backfill'
      : r.trigger_type === 'refresh' ? 'Pool-Refresh'
        : r.trigger_type === 'schedule' ? 'Harvest (Cron)' : 'Harvest';

    const statParts = (r.trigger_type === 'backfill' || r.trigger_type === 'refresh')
      ? [
        s.crm_handles != null ? `${s.crm_handles} CRM-Handles` : null,
        s.candidates != null ? `${s.candidates} Kandidaten` : null,
        `${s.enriched ?? 0} angereichert`,
        s.failed ? `${s.failed} fehlgeschlagen` : null,
        s.skipped_existing ? `${s.skipped_existing} übersprungen (frisch)` : null,
        s.brands_cached ? `${s.brands_cached} Brand-Logos` : null
      ]
      : [
        s.seeds_used?.length ? `Seeds: ${s.seeds_used.map((h) => `#${h}`).join(' ')}` : null,
        s.permalinks != null ? `${s.permalinks} Permalinks` : null,
        s.usernames_found != null ? `${s.usernames_found} Usernames` : null,
        `${s.new_profiles ?? 0} neue Profile`,
        `${s.enriched ?? 0} angereichert`,
        s.failed ? `${s.failed} fehlgeschlagen` : null
      ];
    const statsLine = statParts.filter(Boolean).join(' · ');

    const phase = r.status === 'running' && s.phase
      ? `<span class="ig-run-phase">${esc(PHASE_LABELS[s.phase] || s.phase)}…</span>`
      : '';
    const errorHtml = r.error
      ? `<div class="ig-run-error-text">${esc(r.error)}</div>`
      : '';
    const seedErrorsHtml = s.seed_errors?.length
      ? `<div class="ig-run-error-text">${s.seed_errors.map((e) => `#${esc(e.hashtag)}: ${esc(e.error)}`).join('<br>')}</div>`
      : '';

    return `<div class="ig-run ig-run-${esc(r.status)}">
      <div class="ig-run-head">
        <span class="ig-run-badge ig-run-badge-${esc(r.status)}">${esc(r.status)}</span>
        <strong>${esc(typeLabel)}</strong>
        ${phase}
        <span class="ig-muted">${esc(when)}</span>
      </div>
      ${statsLine ? `<div class="ig-run-stats">${esc(statsLine)}</div>` : ''}
      ${errorHtml}
      ${seedErrorsHtml}
    </div>`;
  }

  /** Alle 2s Läufe neu laden, bis nichts mehr running ist (max. ~15 Min) */
  startRunPolling() {
    this.stopRunPolling();
    const startedAt = Date.now();
    const info = document.getElementById('ig-admin-info');
    this.setAdminButtonsDisabled(true);

    this._runPollTimer = setInterval(async () => {
      const stillRunning = await this.loadRuns();
      if (info) info.textContent = stillRunning ? 'Lauf aktiv – Anzeige aktualisiert sich automatisch…' : '';
      const timedOut = Date.now() - startedAt > 15 * 60 * 1000;
      if (!stillRunning || timedOut) {
        this.stopRunPolling();
        this.setAdminButtonsDisabled(false);
        if (info && timedOut) info.textContent = 'Lauf dauert ungewöhnlich lange – siehe Läufe unten.';
      }
    }, 2000);
  }

  stopRunPolling() {
    if (this._runPollTimer) {
      clearInterval(this._runPollTimer);
      this._runPollTimer = null;
    }
  }

  setAdminButtonsDisabled(disabled) {
    for (const id of ['ig-backfill', 'ig-harvest', 'ig-refresh']) {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = disabled;
    }
  }

  async triggerBackfill() {
    try {
      await this.service.startBackfill();
      window.toastSystem?.show('CRM-Backfill gestartet.', 'success');
      this.startRunPolling();
    } catch (err) {
      window.toastSystem?.show(`Backfill-Fehler: ${err.message}`, 'error');
      this.loadRuns();
    }
  }

  async triggerHarvest() {
    try {
      await this.service.startHarvest();
      window.toastSystem?.show('Harvest gestartet.', 'success');
      this.startRunPolling();
    } catch (err) {
      window.toastSystem?.show(`Harvest-Fehler: ${err.message}`, 'error');
      this.loadRuns();
    }
  }

  async triggerRefresh() {
    try {
      await this.service.startRefresh();
      window.toastSystem?.show('Pool-Refresh gestartet – alle Creator werden neu angereichert.', 'success');
      this.startRunPolling();
    } catch (err) {
      window.toastSystem?.show(`Refresh-Fehler: ${err.message}`, 'error');
      this.loadRuns();
    }
  }
}

export const instagramDiscoveryPage = new InstagramDiscoveryPage();
