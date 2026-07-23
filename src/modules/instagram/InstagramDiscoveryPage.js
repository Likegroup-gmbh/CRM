// InstagramDiscoveryPage.js
// Instagram Creator Discovery (Test-Seite, Admin-only, Deep-Link /instagram).
// Step 1: Username-Pool laden (Meta Business Discovery via Netlify Function),
// dann lokal filtern (Follower, Posts, Freitext) -> Grid mit Creator-Karten
// inkl. der letzten 3 Posts. Filter-Aenderungen re-filtern OHNE API-Call.

import { InstagramDiscoveryService } from './InstagramDiscoveryService.js';

const FILTER_DEBOUNCE_MS = 200;

/** HTML-Escaping fuer alle API-Strings (Namen, Bios etc.) */
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCount(n) {
  if (n === null || n === undefined) return '–';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')} Mio.`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}k`;
  return String(n);
}

export class InstagramDiscoveryPage {
  constructor() {
    this.service = new InstagramDiscoveryService();
    this.rawResults = [];   // ok-Profile aus der API
    this.failed = [];       // Usernames mit Fehler
    this.filters = { followersMin: 2000000, followersMax: null, postsMin: null, postsMax: null, search: '' };
    this._filterTimer = null;
  }

  async init() {
    if (!window.isAdmin?.()) {
      window.setContentSafely(window.content, `
        <div class="empty-state">
          <p>Kein Zugriff – diese Test-Seite ist nur für Admins.</p>
        </div>
      `);
      return;
    }
    window.setHeadline('Instagram Discovery (Test)');
    this.render();
    this.bindEvents();
    this.checkStatus();
  }

  render() {
    const html = `
      <div class="ig-discovery">

        <div id="ig-status" class="ig-status">Verbindung wird geprüft…</div>

        <div class="ig-panel">
          <label class="form-label">Instagram Usernames (max. 20 – ein Name pro Zeile oder komma-getrennt)</label>
          <textarea id="ig-usernames" class="form-input" rows="3"
            placeholder="cristiano&#10;nike&#10;natgeo"></textarea>
          <div class="ig-panel-actions">
            <button id="ig-load-btn" class="primary-btn">Creator laden</button>
            <span id="ig-load-info" class="ig-muted"></span>
          </div>
        </div>

        <div class="ig-panel ig-filters">
          <div class="ig-filter-field">
            <label class="form-label">Follower min</label>
            <input type="number" id="ig-f-followers-min" class="form-input" min="0" step="100000" value="2000000" />
          </div>
          <div class="ig-filter-field">
            <label class="form-label">Follower max</label>
            <input type="number" id="ig-f-followers-max" class="form-input" min="0" step="100000" placeholder="∞" />
          </div>
          <div class="ig-filter-field">
            <label class="form-label">Posts min</label>
            <input type="number" id="ig-f-posts-min" class="form-input" min="0" placeholder="0" />
          </div>
          <div class="ig-filter-field">
            <label class="form-label">Posts max</label>
            <input type="number" id="ig-f-posts-max" class="form-input" min="0" placeholder="∞" />
          </div>
          <div class="ig-filter-field ig-filter-search">
            <label class="form-label">Suche (Name / Username / Bio)</label>
            <input type="text" id="ig-f-search" class="form-input" placeholder="z.B. fitness" />
          </div>
        </div>

        <div id="ig-result-info" class="ig-muted"></div>
        <div id="ig-grid" class="ig-grid"></div>

      </div>
    `;
    window.setContentSafely(window.content, html);
  }

  bindEvents() {
    document.getElementById('ig-load-btn')?.addEventListener('click', () => this.loadCreators());

    const filterInputs = [
      'ig-f-followers-min', 'ig-f-followers-max',
      'ig-f-posts-min', 'ig-f-posts-max', 'ig-f-search'
    ];
    for (const id of filterInputs) {
      document.getElementById(id)?.addEventListener('input', () => {
        clearTimeout(this._filterTimer);
        this._filterTimer = setTimeout(() => {
          this.readFilters();
          this.renderGrid();
        }, FILTER_DEBOUNCE_MS);
      });
    }
  }

  async checkStatus() {
    const el = document.getElementById('ig-status');
    if (!el) return;
    try {
      const { account } = await this.service.status();
      el.className = 'ig-status ig-status-ok';
      el.textContent = `Verbunden als @${account.username}${account.name ? ` (${account.name})` : ''}`;
    } catch (err) {
      el.className = 'ig-status ig-status-error';
      el.textContent = `Verbindung fehlgeschlagen: ${err.message}`;
    }
  }

  parseUsernames() {
    const raw = document.getElementById('ig-usernames')?.value || '';
    return raw.split(/[\n,;]+/).map((u) => u.trim()).filter(Boolean);
  }

  async loadCreators() {
    const btn = document.getElementById('ig-load-btn');
    const info = document.getElementById('ig-load-info');
    const usernames = this.parseUsernames();

    if (usernames.length === 0) {
      window.toastSystem?.show('Bitte mindestens einen Username eingeben.', 'warning');
      return;
    }
    if (usernames.length > 20) {
      window.toastSystem?.show('Maximal 20 Usernames pro Abruf – es werden die ersten 20 geladen.', 'warning');
    }

    btn.disabled = true;
    btn.textContent = 'Lade…';
    if (info) info.textContent = `${Math.min(usernames.length, 20)} Profile werden abgefragt…`;

    try {
      const { results } = await this.service.lookup(usernames.slice(0, 20));
      this.rawResults = results.filter((r) => r.ok).map((r) => r.profile);
      this.failed = results.filter((r) => !r.ok);
      if (info) {
        info.textContent = this.failed.length
          ? `${this.rawResults.length} geladen, ${this.failed.length} fehlgeschlagen: ${this.failed.map((f) => `@${f.username}`).join(', ')}`
          : `${this.rawResults.length} Profile geladen.`;
      }
      this.readFilters();
      this.renderGrid();
    } catch (err) {
      if (info) info.textContent = '';
      window.toastSystem?.show(`Abruf fehlgeschlagen: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Creator laden';
    }
  }

  readFilters() {
    const num = (id) => {
      const v = document.getElementById(id)?.value;
      return v === '' || v === undefined || v === null ? null : Number(v);
    };
    this.filters = {
      followersMin: num('ig-f-followers-min'),
      followersMax: num('ig-f-followers-max'),
      postsMin: num('ig-f-posts-min'),
      postsMax: num('ig-f-posts-max'),
      search: (document.getElementById('ig-f-search')?.value || '').trim().toLowerCase()
    };
  }

  applyFilters() {
    const f = this.filters;
    return this.rawResults.filter((p) => {
      if (f.followersMin !== null && (p.followers_count ?? 0) < f.followersMin) return false;
      if (f.followersMax !== null && (p.followers_count ?? 0) > f.followersMax) return false;
      if (f.postsMin !== null && (p.media_count ?? 0) < f.postsMin) return false;
      if (f.postsMax !== null && (p.media_count ?? 0) > f.postsMax) return false;
      if (f.search) {
        const haystack = `${p.name || ''} ${p.username || ''} ${p.biography || ''}`.toLowerCase();
        if (!haystack.includes(f.search)) return false;
      }
      return true;
    });
  }

  renderGrid() {
    const grid = document.getElementById('ig-grid');
    const resultInfo = document.getElementById('ig-result-info');
    if (!grid) return;

    const visible = this.applyFilters();
    if (resultInfo) {
      resultInfo.textContent = this.rawResults.length
        ? `${visible.length} von ${this.rawResults.length} Creatorn sichtbar`
        : '';
    }

    if (this.rawResults.length === 0) {
      grid.innerHTML = '<div class="empty-state"><p>Noch keine Creator geladen.</p></div>';
      return;
    }
    if (visible.length === 0) {
      grid.innerHTML = '<div class="empty-state"><p>Keine Creator entsprechen den Filtern.</p></div>';
      return;
    }

    grid.innerHTML = visible.map((p) => this.renderCard(p)).join('');
  }

  renderCard(p) {
    const avatar = p.profile_picture_url
      ? `<img class="ig-card-avatar" src="${esc(p.profile_picture_url)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
      : '<div class="ig-card-avatar ig-card-avatar-placeholder">?</div>';

    const posts = (p.recent_media || []).map((m) => {
      const src = m.thumbnail_url || (m.media_type === 'VIDEO' ? null : m.media_url);
      const inner = src
        ? `<img src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
        : `<span class="ig-post-placeholder">${esc(m.media_type || 'POST')}</span>`;
      return m.permalink
        ? `<a class="ig-post" href="${esc(m.permalink)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
        : `<div class="ig-post">${inner}</div>`;
    }).join('');

    const bio = p.biography
      ? `<p class="ig-card-bio">${esc(p.biography.length > 120 ? `${p.biography.slice(0, 120)}…` : p.biography)}</p>`
      : '';

    return `
      <div class="ig-card">
        <div class="ig-card-head">
          ${avatar}
          <div class="ig-card-title">
            <strong>${esc(p.name || p.username)}</strong>
            <a href="https://www.instagram.com/${esc(p.username)}" target="_blank" rel="noopener noreferrer">@${esc(p.username)}</a>
          </div>
        </div>
        <div class="ig-card-stats">
          <span><strong>${formatCount(p.followers_count)}</strong> Follower</span>
          <span><strong>${formatCount(p.media_count)}</strong> Posts</span>
        </div>
        ${bio}
        ${posts ? `<div class="ig-card-posts">${posts}</div>` : ''}
      </div>
    `;
  }
}

export const instagramDiscoveryPage = new InstagramDiscoveryPage();
