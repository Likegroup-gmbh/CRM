import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ActionBuilder mocken: liefert nur einen Marker-Container
vi.mock('../../core/actions/ActionBuilder.js', () => ({
  actionBuilder: {
    create: vi.fn((entityType, id) => `<div class="actions-dropdown-container" data-entity-type="${entityType}" data-id="${id}"></div>`)
  }
}));

import { CreatorGridView } from '../modules/creator/CreatorGridView.js';

// ── IntersectionObserver Mock ───────────────────────────────────────────────
let ioInstances = [];
class IOMock {
  constructor(cb) {
    this.cb = cb;
    this.elements = [];
    this.disconnected = false;
    ioInstances.push(this);
  }
  observe(el) { this.elements.push(el); }
  disconnect() { this.disconnected = true; }
  trigger() { this.cb([{ isIntersecting: true }]); }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function makeList(overrides = {}) {
  return {
    mode: 'all',
    _destroyed: false,
    isAdmin: false,
    buildFilters: vi.fn(() => ({ q: 'x' })),
    loadPageData: vi.fn(async () => ({ data: [], total: 0 })),
    sanitize: (v) => String(v ?? ''),
    renderLocationTag: (v, t) => (v ? `<span class="tag tag--${t}">${v}</span>` : '-'),
    formatAgeRange: (min, max, legacy) => {
      if (!min && !max && legacy) return String(legacy);
      if (!min && !max) return '-';
      if (min && max && min !== max) return `${min}-${max}`;
      return String(min || max);
    },
    renderCreatorTypeTags: (x) => (x && x.length ? `<span class="tag tag--type">${x.join(',')}</span>` : '-'),
    renderBrancheTags: (x) => (x && x.length ? `<span class="tag tag--branche">${x.join(',')}</span>` : '-'),
    renderSprachenTags: (x) => (x && x.length ? `<span class="tag tag--lang">${x.join(',')}</span>` : '-'),
    ...overrides
  };
}

function mountShell(grid) {
  document.body.innerHTML = grid.renderShell();
}

function parseCard(html) {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

describe('CreatorGridView', () => {
  let originalIO;
  let originalRect;

  beforeEach(() => {
    ioInstances = [];
    originalIO = global.IntersectionObserver;
    global.IntersectionObserver = IOMock;

    // Sentinel weit ausserhalb -> _maybeLoadMore feuert nicht automatisch
    originalRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = () => ({
      top: 99999, bottom: 99999, left: 0, right: 0, width: 0, height: 0
    });

    window.validatorSystem = {
      sanitizeHtml: (s) => String(s ?? ''),
      sanitizeUrl: (u) => u || ''
    };
  });

  afterEach(() => {
    global.IntersectionObserver = originalIO;
    Element.prototype.getBoundingClientRect = originalRect;
    vi.clearAllMocks();
  });

  // ── Karten-Rendering / Sanitizing / Fallbacks ─────────────────────────────
  describe('renderCard', () => {
    it('nutzt Namens-Fallback und Initialen-Platzhalter ohne Profilbild', () => {
      const grid = new CreatorGridView(makeList());
      const card = parseCard(grid.renderCard({ id: 'c1' }));

      expect(card.querySelector('.creator-card__name').textContent).toContain('Unbekannt');
      const placeholder = card.querySelector('.creator-card__cover--placeholder');
      expect(placeholder).toBeTruthy();
      expect(placeholder.textContent.trim()).toBe('?');
      expect(card.querySelector('.creator-card__cover')).toBe(placeholder);
    });

    it('rendert stretched Profil-Link mit table-link + data-id', () => {
      const grid = new CreatorGridView(makeList());
      const card = parseCard(grid.renderCard({ id: 'c99', vorname: 'Max', nachname: 'Muster' }));
      const link = card.querySelector('.creator-card__link');

      expect(link.classList.contains('table-link')).toBe(true);
      expect(link.dataset.table).toBe('creator');
      expect(link.dataset.id).toBe('c99');
    });

    it('zeigt Profilbild wenn vorhanden', () => {
      const grid = new CreatorGridView(makeList());
      const card = parseCard(grid.renderCard({ id: 'c1', vorname: 'A', profilbild_url: 'http://img/a.webp' }));
      const img = card.querySelector('img.creator-card__cover');
      expect(img).toBeTruthy();
      expect(img.getAttribute('src')).toBe('http://img/a.webp');
    });
  });

  // ── Links / Priorität ──────────────────────────────────────────────────────
  describe('Links', () => {
    it('rendert alle vorhandenen Links (Instagram, TikTok, Portfolio)', () => {
      const grid = new CreatorGridView(makeList());
      const card = parseCard(grid.renderCard({
        id: 'c1', vorname: 'A',
        instagram: 'maxmuster', tiktok: 'maxtok', portfolio_link: 'https://portfolio.test'
      }));
      const chips = card.querySelectorAll('.creator-card__link-chip');
      expect(chips.length).toBe(3);
      const labels = Array.from(chips).map((c) => c.textContent.trim());
      expect(labels).toEqual(['Instagram', 'TikTok', 'Portfolio']);
    });

    it('baut Instagram-URL aus Handle', () => {
      const grid = new CreatorGridView(makeList());
      const card = parseCard(grid.renderCard({ id: 'c1', vorname: 'A', instagram: 'maxmuster' }));
      const ig = card.querySelector('.creator-card__link-chip');
      expect(ig.getAttribute('href')).toBe('https://instagram.com/maxmuster');
    });

    it('zeigt keine Link-Zeile ohne Links', () => {
      const grid = new CreatorGridView(makeList());
      const card = parseCard(grid.renderCard({ id: 'c1', vorname: 'A' }));
      expect(card.querySelector('.creator-card__links')).toBeNull();
    });
  });

  // ── Instagram-Bio / Connect ────────────────────────────────────────────────
  describe('Instagram-Block', () => {
    it('zeigt Bio-Toggle bei langer Bio (verbunden)', () => {
      const grid = new CreatorGridView(makeList());
      const longBio = 'x'.repeat(200);
      const card = parseCard(grid.renderCard({ id: 'c1', vorname: 'A', ig_connected_at: '2026-01-01', ig_biography: longBio }));
      expect(card.querySelector('.creator-card__bio')).toBeTruthy();
      expect(card.querySelector('.creator-card__bio-toggle')).toBeTruthy();
    });

    it('zeigt keinen Bio-Toggle bei kurzer Bio', () => {
      const grid = new CreatorGridView(makeList());
      const card = parseCard(grid.renderCard({ id: 'c1', vorname: 'A', ig_connected_at: '2026-01-01', ig_biography: 'Kurz' }));
      expect(card.querySelector('.creator-card__bio')).toBeTruthy();
      expect(card.querySelector('.creator-card__bio-toggle')).toBeNull();
    });

    it('zeigt Connect-CTA nur fuer Admins mit Instagram-Link', () => {
      const gridAdmin = new CreatorGridView(makeList({ isAdmin: true }));
      const cardAdmin = parseCard(gridAdmin.renderCard({ id: 'c1', vorname: 'A', instagram: 'maxmuster' }));
      expect(cardAdmin.querySelector('.creator-card__connect')).toBeTruthy();
      expect(cardAdmin.querySelector('.creator-card__ig-empty')).toBeTruthy();

      const gridUser = new CreatorGridView(makeList({ isAdmin: false }));
      const cardUser = parseCard(gridUser.renderCard({ id: 'c1', vorname: 'A', instagram: 'maxmuster' }));
      expect(cardUser.querySelector('.creator-card__connect')).toBeNull();
      expect(cardUser.querySelector('.creator-card__ig-empty')).toBeTruthy();
    });

    it('zeigt keinen Connect-CTA fuer Admins ohne Instagram-Link', () => {
      const gridAdmin = new CreatorGridView(makeList({ isAdmin: true }));
      const card = parseCard(gridAdmin.renderCard({ id: 'c1', vorname: 'A' }));
      expect(card.querySelector('.creator-card__connect')).toBeNull();
    });
  });

  // ── Medien-Filterung ────────────────────────────────────────────────────────
  describe('Post-/Reel-Medien', () => {
    const connectedWithPosts = {
      id: 'c1', vorname: 'A', ig_connected_at: '2026-01-01',
      ig_recent_posts: [
        { thumbnail_path: 'http://x/1.webp', permalink: 'http://p/1', media_type: 'VIDEO', like_count: 10, comments_count: 2 },
        { thumbnail_path: null, permalink: 'http://p/2', media_type: 'IMAGE' },
        { thumbnail_path: 'http://x/3.webp', permalink: 'http://p/3', media_type: 'IMAGE', like_count: 5, comments_count: 1 },
        { thumbnail_path: 'http://x/4.webp', permalink: 'http://p/4', media_type: 'IMAGE' },
        { thumbnail_path: 'http://x/5.webp', permalink: 'http://p/5', media_type: 'IMAGE' }
      ]
    };

    it('filtert Posts ohne Thumbnail und zeigt maximal drei', () => {
      const grid = new CreatorGridView(makeList());
      const card = parseCard(grid.renderCard(connectedWithPosts));
      const posts = card.querySelectorAll('.creator-card__post');
      expect(posts.length).toBe(3);
      // Reel-Badge beim VIDEO-Post
      expect(card.querySelector('.creator-card__post-badge').textContent).toBe('Reel');
    });

    it('zeigt keine Medien ohne Instagram-Connect', () => {
      const grid = new CreatorGridView(makeList());
      const card = parseCard(grid.renderCard({ ...connectedWithPosts, ig_connected_at: null }));
      expect(card.querySelector('.creator-card__posts')).toBeNull();
    });
  });

  // ── Kennzahlen ──────────────────────────────────────────────────────────────
  describe('Kennzahlen', () => {
    it('zeigt Instagram-Engagement nur bei Connect', () => {
      const grid = new CreatorGridView(makeList());
      const connected = parseCard(grid.renderCard({ id: 'c1', vorname: 'A', ig_connected_at: '2026', ig_engagement_rate: 3.5 }));
      const labels = Array.from(connected.querySelectorAll('.creator-card__stat-label')).map((n) => n.textContent);
      expect(labels).toContain('Instagram Engagement');

      const notConnected = parseCard(grid.renderCard({ id: 'c2', vorname: 'B', ig_engagement_rate: 3.5 }));
      const labels2 = Array.from(notConnected.querySelectorAll('.creator-card__stat-label')).map((n) => n.textContent);
      expect(labels2).not.toContain('Instagram Engagement');
    });
  });

  // ── Infinite Scroll / Grid-State ─────────────────────────────────────────────
  describe('Infinite Scroll', () => {
    it('laedt ersten Chunk und markiert Ende bei Teil-Ergebnis', async () => {
      const list = makeList({
        loadPageData: vi.fn(async () => ({ data: [{ id: '1', vorname: 'A' }], total: 1 }))
      });
      const grid = new CreatorGridView(list);
      mountShell(grid);

      await grid.reload();

      expect(grid.getContainer().querySelectorAll('.creator-card').length).toBe(1);
      expect(grid._reachedEnd).toBe(true);
    });

    it('zeigt Empty-State ohne Ergebnisse', async () => {
      const list = makeList({ loadPageData: vi.fn(async () => ({ data: [], total: 0 })) });
      const grid = new CreatorGridView(list);
      mountShell(grid);

      await grid.reload();

      expect(grid.getStatus().innerHTML).toContain('Keine Creator');
    });

    it('haengt weitere Karten bei Observer-Trigger an und beendet dann', async () => {
      let call = 0;
      const list = makeList({
        loadPageData: vi.fn(async () => {
          call++;
          if (call === 1) {
            return { data: Array.from({ length: 25 }, (_, i) => ({ id: `a${i}`, vorname: 'C' })), total: 30 };
          }
          return { data: Array.from({ length: 5 }, (_, i) => ({ id: `b${i}`, vorname: 'D' })), total: 30 };
        })
      });
      const grid = new CreatorGridView(list);
      mountShell(grid);

      await grid.reload();
      expect(grid.getContainer().querySelectorAll('.creator-card').length).toBe(25);
      expect(grid._reachedEnd).toBe(false);
      expect(ioInstances.length).toBeGreaterThan(0);

      ioInstances[ioInstances.length - 1].trigger();
      await flush();

      expect(grid.getContainer().querySelectorAll('.creator-card').length).toBe(30);
      expect(grid._reachedEnd).toBe(true);
    });

    it('verwirft veraltete Requests (reload waehrend Laden)', async () => {
      let resolveFirst;
      const first = new Promise((res) => { resolveFirst = res; });
      const list = makeList();
      list.loadPageData = vi.fn()
        .mockImplementationOnce(() => first)
        .mockImplementationOnce(async () => ({ data: [{ id: 'new', vorname: 'Neu' }], total: 1 }));

      const grid = new CreatorGridView(list);
      mountShell(grid);

      const p1 = grid.reload();       // haengt beim ersten loadPageData
      const p2 = grid.reload();       // neuer Request, bumpt requestId
      resolveFirst({ data: [{ id: 'old', vorname: 'Alt' }], total: 1 });
      await Promise.all([p1, p2]);
      await flush();

      const cards = grid.getContainer().querySelectorAll('.creator-card');
      expect(cards.length).toBe(1);
      expect(grid.getContainer().textContent).toContain('Neu');
      expect(grid.getContainer().textContent).not.toContain('Alt');
    });

    it('zeigt Fehler-Status bei Ladefehler', async () => {
      const list = makeList({ loadPageData: vi.fn(async () => { throw new Error('boom'); }) });
      const grid = new CreatorGridView(list);
      mountShell(grid);

      await grid.reload();

      expect(grid.getStatus().innerHTML).toContain('Fehler');
    });

    it('erkennt veraltete Kriterien via isStale', async () => {
      const list = makeList();
      list.buildFilters = vi.fn(() => ({ q: 'a' }));
      const grid = new CreatorGridView(list);
      mountShell(grid);

      await grid.reload();
      expect(grid.isStale()).toBe(false);

      list.buildFilters.mockReturnValue({ q: 'b' });
      expect(grid.isStale()).toBe(true);
    });

    it('baut Observer bei destroy ab', async () => {
      const list = makeList({
        loadPageData: vi.fn(async () => ({ data: Array.from({ length: 25 }, (_, i) => ({ id: `a${i}`, vorname: 'C' })), total: 100 }))
      });
      const grid = new CreatorGridView(list);
      mountShell(grid);

      await grid.reload();
      const io = ioInstances[ioInstances.length - 1];
      expect(io.disconnected).toBe(false);

      grid.destroy();
      expect(io.disconnected).toBe(true);
    });
  });

  // ── Events ──────────────────────────────────────────────────────────────────
  describe('Events', () => {
    it('klappt Bio nur der angeklickten Karte auf', () => {
      const grid = new CreatorGridView(makeList());
      mountShell(grid);
      const container = grid.getContainer();
      const longBio = 'x'.repeat(200);
      container.innerHTML = grid.renderCard({ id: 'c1', vorname: 'A', ig_connected_at: '2026', ig_biography: longBio });

      const controller = new AbortController();
      grid.bindEvents(controller.signal);

      const toggle = container.querySelector('.creator-card__bio-toggle');
      const bio = container.querySelector('.creator-card__bio');
      expect(bio.classList.contains('creator-card__bio--expanded')).toBe(false);

      toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(bio.classList.contains('creator-card__bio--expanded')).toBe(true);
      expect(toggle.textContent).toBe('Weniger anzeigen');

      toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(bio.classList.contains('creator-card__bio--expanded')).toBe(false);

      controller.abort();
    });

    it('loest Instagram-Connect ueber ActionsDropdown aus', () => {
      const handleAction = vi.fn();
      window.ActionsDropdown = { handleAction };

      const grid = new CreatorGridView(makeList({ isAdmin: true }));
      mountShell(grid);
      const container = grid.getContainer();
      container.innerHTML = grid.renderCard({ id: 'c1', vorname: 'A', instagram: 'maxmuster' });

      const controller = new AbortController();
      grid.bindEvents(controller.signal);

      container.querySelector('.creator-card__connect').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(handleAction).toHaveBeenCalledWith('connect', 'c1', 'creator');

      controller.abort();
    });
  });
});
