import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ActionBuilder mocken: liefert nur einen Marker-Container
vi.mock('../../core/actions/ActionBuilder.js', () => ({
  actionBuilder: {
    create: vi.fn((entityType, id) => `<div class="actions-dropdown-container" data-entity-type="${entityType}" data-id="${id}"></div>`)
  }
}));

// Media-Viewer mocken: der echte Player wuerde Stream-URLs aufloesen (Netz)
const playerSpies = vi.hoisted(() => ({ openVideo: vi.fn(), openStory: vi.fn() }));
vi.mock('../core/media/player/VideoPlayerLightbox.js', () => ({
  VideoPlayerLightbox: vi.fn(() => playerSpies)
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
    window.isInternal = () => true;
  });

  afterEach(() => {
    global.IntersectionObserver = originalIO;
    Element.prototype.getBoundingClientRect = originalRect;
    delete window.isInternal;
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

    it('oeffnet die Kachel ueber einen Button, nicht ueber die Profilseite', () => {
      const grid = new CreatorGridView(makeList());
      const card = parseCard(grid.renderCard({ id: 'c99', vorname: 'Max', nachname: 'Muster' }));
      const link = card.querySelector('.creator-card__link');

      expect(link.tagName).toBe('BUTTON');
      expect(link.classList.contains('table-link')).toBe(false);
      expect(link.dataset.id).toBe('c99');
      expect(card.querySelector('.creator-card__kontakt')).toBeNull();
    });

    it('zeigt Profilbild wenn vorhanden', () => {
      const grid = new CreatorGridView(makeList());
      const card = parseCard(grid.renderCard({ id: 'c1', vorname: 'A', profilbild_url: 'http://img/a.avif' }));
      const img = card.querySelector('img.creator-card__cover');
      expect(img).toBeTruthy();
      expect(img.getAttribute('src')).toBe('http://img/a.avif');
    });

    it('nimmt fuer das grosse Cover das Hauptbild, nicht das Thumbnail', () => {
      const grid = new CreatorGridView(makeList());
      const card = parseCard(grid.renderCard({
        id: 'c1',
        vorname: 'A',
        profilbild_url: 'http://img/a.avif',
        profilbild_thumb_url: 'http://img/a_thumb.avif'
      }));

      expect(card.querySelector('img.creator-card__cover').getAttribute('src')).toBe('http://img/a.avif');
    });
  });

  describe('kompakte Kachel', () => {
    it('zeigt den Rezensions-Schnitt mit einer Nachkommastelle', () => {
      const grid = new CreatorGridView(makeList());
      const card = parseCard(grid.renderCard({ id: 'c1', vorname: 'Lea', rezension_schnitt: 4.5 }));
      const stat = [...card.querySelectorAll('.creator-card__stat')]
        .find((el) => el.textContent.includes('Rezension'));
      expect(stat.querySelector('.creator-card__stat-value').textContent).toBe('4,5');
    });

    it('zeigt Stadt, Alter, Größe, Follower und Aktionen', () => {
      const grid = new CreatorGridView(makeList());
      const card = parseCard(grid.renderCard({
        id: 'c1',
        vorname: 'Tanja',
        nachname: 'Angst',
        lieferadresse_stadt: 'Berlin',
        geschlecht: 'weiblich',
        geburtsdatum: '1999-05-01',
        instagram_follower: 12400,
        tiktok_follower: 8000,
        creator_types: [{ name: 'UGC' }],
        branchen: [{ name: 'Beauty' }, { name: 'Food' }, { name: 'Travel' }]
      }));
      expect(card.querySelector('.creator-card__meta').textContent).toContain('Berlin');
      expect(card.querySelector('.creator-card__meta').textContent).toContain('Micro');
      expect(card.querySelector('.creator-card__stats').textContent).toContain('12,4K');
      expect(card.querySelector('.creator-card__stats').textContent).toContain('Rezension');
      expect(card.querySelector('.creator-card__stats').textContent).toContain('–');
      expect(card.querySelectorAll('.creator-card__tags .tag').length).toBe(3);
      expect(card.querySelector('.creator-card__tags').textContent).toContain('UGC');
      expect(card.querySelector('.creator-card__link')).toBeTruthy();
      expect(card.querySelector('.creator-card__casting')).toBeTruthy();
      expect(card.querySelector('.creator-card__bio')).toBeNull();
      expect(card.querySelector('.creator-card__posts')).toBeNull();
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

    it('behaelt Karten und blendet sie ab, bis die neue Auswahl da ist', async () => {
      let resolveNext;
      const next = new Promise((res) => { resolveNext = res; });
      const list = makeList();
      list.loadPageData = vi.fn()
        .mockResolvedValueOnce({ data: [{ id: 'old', vorname: 'Alt' }], total: 1 })
        .mockImplementationOnce(() => next);
      list.onResultTotal = vi.fn();
      const grid = new CreatorGridView(list);
      mountShell(grid);

      await grid.reload();
      expect(list.onResultTotal).toHaveBeenCalledWith(1);
      expect(grid.getContainer().textContent).toContain('Alt');

      const pending = grid.reload({ scrollTop: true });
      expect(grid.getContainer().classList.contains('is-pending')).toBe(true);
      expect(grid.getContainer().textContent).toContain('Alt');

      resolveNext({ data: [{ id: 'new', vorname: 'Neu' }], total: 4 });
      await pending;

      expect(grid.getContainer().classList.contains('is-pending')).toBe(false);
      expect(grid.getContainer().textContent).toContain('Neu');
      expect(grid.getContainer().textContent).not.toContain('Alt');
      expect(list.onResultTotal).toHaveBeenLastCalledWith(4);
    });

    it('zeigt Fehler-Status bei Ladefehler', async () => {
      const list = makeList({ loadPageData: vi.fn(async () => { throw new Error('boom'); }) });
      const grid = new CreatorGridView(list);
      mountShell(grid);

      await grid.reload();

      expect(grid.getStatus().innerHTML).toContain('Fehler');
      expect(grid._reachedEnd).toBe(true);
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
    it('oeffnet die Kontakt-Schublade der Kachel', async () => {
      const grid = new CreatorGridView(makeList());
      mountShell(grid);
      const container = grid.getContainer();
      const creator = {
        id: 'c1',
        vorname: 'Tanja',
        nachname: 'Angst',
        mail: 't@example.com',
        profilbild_url: 'https://img.test/tanja.jpg'
      };
      container.innerHTML = grid.renderCard(creator);
      grid._remember([creator]);

      // Thenable Query-Builder: deckt die Loader der Creator-Detailseite ab
      const qb = {
        select: () => qb,
        eq: () => qb,
        in: () => qb,
        not: () => qb,
        order: () => qb,
        limit: () => qb,
        range: () => qb,
        single: async () => ({ data: creator, error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve) => resolve({ data: [], error: null })
      };
      window.supabase = { from: () => qb };

      const controller = new AbortController();
      grid.bindEvents(controller.signal);
      container.querySelector('.creator-card__link').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
      await flush();

      const panel = document.querySelector('#creator-kontakt-drawer.drawer-panel');
      expect(panel).toBeTruthy();
      expect(panel.textContent).toContain('t@example.com');

      // Kleines Bild im Kopf, damit klar ist, um welchen Creator es geht
      const avatar = panel.querySelector('.drawer-header img.table-avatar-img');
      expect(avatar).toBeTruthy();
      expect(avatar.getAttribute('src')).toBe('https://img.test/tanja.jpg');

      const headers = [...panel.querySelectorAll('.settings-accordion-header')].map((h) => h.textContent.trim());
      expect(headers.some((h) => h.includes('Informationen'))).toBe(false);
      expect(panel.textContent).toContain('Follower');
      expect(panel.textContent).toContain('Favorit');
      expect(panel.textContent).toContain('Rezension');
      expect(headers.some((h) => h.includes('Adresse'))).toBe(true);
      // readOnly: keine Anlege-/Entfernen-Knoepfe aus der Detailseite
      expect(panel.querySelector('#btn-firma-anlegen')).toBeNull();
      expect(panel.querySelector('#btn-management-zuordnen')).toBeNull();

      controller.abort();
      document.querySelector('#creator-kontakt-drawer')?.remove();
      document.querySelector('#creator-kontakt-drawer-overlay')?.remove();
    });

    it('laesst die Schublade per Griff in der Breite ziehen und merkt sich die Breite', async () => {
      localStorage.removeItem('drawer-width:creator-kontakt-drawer');
      const grid = new CreatorGridView(makeList());
      mountShell(grid);
      const container = grid.getContainer();
      const creator = { id: 'c1', vorname: 'Tanja', nachname: 'Angst' };
      container.innerHTML = grid.renderCard(creator);
      grid._remember([creator]);

      const qb = {
        select: () => qb,
        eq: () => qb,
        in: () => qb,
        not: () => qb,
        order: () => qb,
        limit: () => qb,
        range: () => qb,
        single: async () => ({ data: creator, error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve) => resolve({ data: [], error: null })
      };
      window.supabase = { from: () => qb };

      const controller = new AbortController();
      grid.bindEvents(controller.signal);
      container.querySelector('.creator-card__link').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();

      const panel = document.querySelector('#creator-kontakt-drawer.drawer-panel');
      const handle = panel.querySelector('.drawer-resize-handle');
      expect(handle).toBeTruthy();

      // getBoundingClientRect ist im Test gemockt (right = 0) -> Ziehen nach
      // "links" (clientX negativ) verbreitert den Drawer auf 500px
      handle.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 0 }));
      document.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: -500 }));
      expect(panel.style.width).toBe('500px');
      expect(document.body.classList.contains('drawer-resizing')).toBe(true);

      document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      expect(document.body.classList.contains('drawer-resizing')).toBe(false);
      expect(localStorage.getItem('drawer-width:creator-kontakt-drawer')).toBe('500');

      controller.abort();
      document.querySelector('#creator-kontakt-drawer')?.remove();
      document.querySelector('#creator-kontakt-drawer-overlay')?.remove();
      localStorage.removeItem('drawer-width:creator-kontakt-drawer');
    });

    it('zeigt Videos mit Play-Button und oeffnet den Media-Viewer', async () => {
      const grid = new CreatorGridView(makeList());
      mountShell(grid);
      const container = grid.getContainer();
      const creator = { id: 'c1', vorname: 'Tanja', nachname: 'Angst' };
      container.innerHTML = grid.renderCard(creator);
      grid._remember([creator]);

      const koop = { id: 'k1', name: 'Koop A', created_at: '2026-01-01' };
      const video = {
        id: 'v1',
        kooperation_id: 'k1',
        video_name: 'Reel 1',
        position: 1,
        asset_url: 'https://dropbox.test/v.mp4',
        stats_views: 1200
      };
      const tableData = {
        creator: { single: creator },
        kooperationen: [koop],
        kooperation_videos: [video],
        kooperation_video_asset: []
      };
      // Thenable Query-Builder mit Daten pro Tabelle
      const makeQb = (table) => {
        const entry = tableData[table];
        const qb = {
          select: () => qb,
          eq: () => qb,
          in: () => qb,
          not: () => qb,
          order: () => qb,
          limit: () => qb,
          range: () => qb,
          single: async () => ({ data: entry?.single ?? null, error: null }),
          maybeSingle: async () => ({ data: null, error: null }),
          then: (resolve) => resolve({ data: Array.isArray(entry) ? entry : [], error: null })
        };
        return qb;
      };
      window.supabase = { from: (table) => makeQb(table) };

      const controller = new AbortController();
      grid.bindEvents(controller.signal);
      container.querySelector('.creator-card__link').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
      await flush();

      const panel = document.querySelector('#creator-kontakt-drawer.drawer-panel');
      expect(panel).toBeTruthy();

      // Videos-Abschnitt mit Zaehler direkt hinter den Kooperationen
      const headers = [...panel.querySelectorAll('.settings-accordion-header')].map((h) => h.textContent.trim());
      const videosHeader = headers.find((h) => h.includes('Videos'));
      expect(videosHeader).toBeTruthy();
      expect(videosHeader).toContain('1');

      // Gleicher Play-Button wie in der Kampagnenliste
      const playBtn = panel.querySelector('[data-action="play-video"]');
      expect(playBtn).toBeTruthy();
      expect(playBtn.dataset.videoId).toBe('v1');
      expect(playBtn.dataset.kooperationId).toBe('k1');
      expect(panel.textContent).toContain('Reel 1');

      playBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();
      expect(playerSpies.openVideo).toHaveBeenCalledWith('v1', 'k1');

      controller.abort();
      document.querySelector('#creator-kontakt-drawer')?.remove();
      document.querySelector('#creator-kontakt-drawer-overlay')?.remove();
    });
  });

  // ── Soft-Update (Connect/Refresh ohne Scroll-Jump) ──────────────────────────
  describe('refreshCard', () => {
    afterEach(() => {
      delete window.dataService;
    });

    it('ersetzt nur die betroffene Karte und laesst Nachbarn unangetastet', async () => {
      const grid = new CreatorGridView(makeList());
      mountShell(grid);
      const container = grid.getContainer();
      container.innerHTML = [
        grid.renderCard({ id: 'c1', vorname: 'Alt', ig_connected_at: null }),
        grid.renderCard({ id: 'c2', vorname: 'Nachbar' })
      ].join('');

      window.dataService = {
        loadEntitiesWithPagination: vi.fn(async () => ({
          data: [{
            id: 'c1',
            vorname: 'Neu',
            nachname: 'Connected',
            ig_connected_at: '2026-07-24',
            ig_biography: 'Frische Bio',
            ig_recent_posts: [{ thumbnail_path: 'https://img.test/1.jpg', permalink: 'https://ig.test/1', like_count: 1, comments_count: 0 }]
          }],
          total: 1
        }))
      };

      const ok = await grid.refreshCard('c1');
      expect(ok).toBe(true);
      expect(container.querySelectorAll('.creator-card')).toHaveLength(2);
      expect(container.querySelector('[data-id="c1"] .creator-card__name').textContent).toContain('Neu Connected');
      expect(container.querySelector('[data-id="c1"] .creator-card__link')).toBeTruthy();
      expect(container.querySelector('[data-id="c2"] .creator-card__name').textContent).toContain('Nachbar');
      expect(window.dataService.loadEntitiesWithPagination).toHaveBeenCalledWith(
        'creator',
        { _allowedIds: ['c1'] },
        1,
        1
      );
    });

    it('gibt false zurueck wenn Karte nicht im Grid ist', async () => {
      const grid = new CreatorGridView(makeList());
      mountShell(grid);
      grid.getContainer().innerHTML = grid.renderCard({ id: 'c1', vorname: 'A' });

      window.dataService = {
        loadEntitiesWithPagination: vi.fn(async () => ({ data: [{ id: 'missing', vorname: 'X' }], total: 1 }))
      };

      const ok = await grid.refreshCard('missing');
      expect(ok).toBe(false);
      expect(window.dataService.loadEntitiesWithPagination).not.toHaveBeenCalled();
    });
  });

  // ── Kooperationsvideos auf der Kachel ──────────────────────────────────────
  describe('Kooperationen', () => {
    it('zählt Kooperationsvideos auf der Kachel', async () => {
      const grid = new CreatorGridView(makeList());
      mountShell(grid);
      const container = grid.getContainer();
      container.innerHTML = grid.renderCard({ id: 'c1', vorname: 'A' });
      let call = 0;
      window.supabase = {
        from: () => ({
          select: () => ({
            in: async () => {
              call += 1;
              if (call === 1) return { data: [{ id: 'k1', creator_id: 'c1' }, { id: 'k2', creator_id: 'c1' }], error: null };
              return { data: [{ kooperation_id: 'k1' }, { kooperation_id: 'k2' }, { kooperation_id: 'k2' }], error: null };
            }
          })
        })
      };

      await grid._hydrateVideoCounts([{ id: 'c1' }], grid._requestId);
      expect(container.querySelector('[data-video-count="c1"]').textContent).toBe('3');
      expect(container.querySelector('.creator-card__coops')).toBeNull();
    });

    it('lässt die Zahl bei veraltetem Request stehen', async () => {
      const grid = new CreatorGridView(makeList());
      mountShell(grid);
      const container = grid.getContainer();
      container.innerHTML = grid.renderCard({ id: 'c1', vorname: 'A' });
      window.supabase = {
        from: () => ({ select: () => ({ in: async () => ({ data: [{ id: 'k1', creator_id: 'c1' }], error: null }) }) })
      };

      await grid._hydrateVideoCounts([{ id: 'c1' }], grid._requestId + 5);
      expect(container.querySelector('[data-video-count="c1"]').textContent).toBe('0');
    });
  });
});
