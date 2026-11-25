import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KampagneDetailStore } from '../modules/kampagne/KampagneDetailStore.js';
import {
  POST_ZELLE_TITEL,
  postsDesVideos,
  renderLivePostsInner,
  summePostZahl,
  renderPostZahlInner,
  patchPostZellen,
  bindPostZellen
} from '../modules/kampagne/videoTablePostCells.js';

const REEL = { id: 'p1', video_id: 'v1', plattform: 'ig_reel', account_handle: 'lena', link: 'https://www.instagram.com/reel/ABC123/', measured_at: '2026-11-20', metrics: { views: 1200, likes: 40 } };
const TIKTOK = { id: 'p2', video_id: 'v1', plattform: 'tiktok', account_handle: 'lena', link: 'https://www.tiktok.com/@lena/video/123456', measured_at: '2026-11-22', metrics: { views: 800, likes: null } };
const FREMD = { id: 'p3', video_id: 'v2', link: 'https://www.instagram.com/reel/XYZ/', metrics: { views: 5 } };

function html(markup) {
  const el = document.createElement('div');
  el.innerHTML = markup;
  return el;
}

describe('Post-Zellen der Kooperationstabelle', () => {
  it('nimmt nur die Posts des Videos', () => {
    const store = { livePosts: [REEL, TIKTOK, FREMD] };
    expect(postsDesVideos(store, 'v1').map(p => p.id)).toEqual(['p1', 'p2']);
    expect(postsDesVideos(store, 'v9')).toEqual([]);
    expect(postsDesVideos(null, 'v1')).toEqual([]);
  });

  it('zeigt je Post einen Link und überspringt Posts ohne Link', () => {
    const el = html(renderLivePostsInner([REEL, TIKTOK, { id: 'p4', video_id: 'v1', link: null }], {}));
    const links = [...el.querySelectorAll('a.chip-cell__chip--static')];
    expect(links.map(a => a.getAttribute('href'))).toEqual([REEL.link, TIKTOK.link]);
    expect(links.every(a => a.target === '_blank')).toBe(true);
  });

  it('zeigt ohne Post einen Strich mit Hinweis auf die Auswertung', () => {
    const el = html(renderLivePostsInner([], {}));
    expect(el.textContent.trim()).toBe('-');
    expect(el.querySelector('[title]').getAttribute('title')).toBe(POST_ZELLE_TITEL);
  });

  it('summiert Reel und TikTok, ein leeres Feld zählt nicht als 0', () => {
    expect(summePostZahl([REEL, TIKTOK], 'views')).toBe(2000);
    expect(summePostZahl([REEL, TIKTOK], 'likes')).toBe(40);
    expect(summePostZahl([TIKTOK], 'likes')).toBeNull();
    expect(summePostZahl([], 'views')).toBeNull();
  });

  it('zeigt die Summe kompakt, im Titel exakt mit Postzahl und Messtag', () => {
    const el = html(renderPostZahlInner([REEL, TIKTOK], 'views'));
    const zelle = el.querySelector('.video-stats-text');
    expect(zelle.textContent).toBe('2,0K');
    expect(zelle.title).toContain('2.000');
    expect(zelle.title).toContain('aus 2 Posts');
    expect(zelle.title).toContain('22.11.2026');
  });

  it('zeigt ohne Wert „—“ statt 0', () => {
    expect(html(renderPostZahlInner([TIKTOK], 'likes')).textContent.trim()).toBe('—');
    expect(html(renderPostZahlInner([], 'views')).textContent.trim()).toBe('—');
  });
});

describe('patchPostZellen', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="koop-table">
        <table><tbody>
          <tr data-kooperation-id="k1">
            <td data-col-id="col-link-live"><div class="video-field-wrapper" data-video-id="v1">-</div></td>
            <td data-col-id="col-stats-views"><div class="video-field-wrapper" data-video-id="v1">—</div></td>
            <td data-col-id="col-stats-likes"><div class="video-field-wrapper" data-video-id="v1">—</div></td>
          </tr>
        </tbody></table>
      </div>`;
  });

  it('zieht Live Link und Zahlen nach, wenn ein Post dazukommt', () => {
    const store = { kooperationen: [{ id: 'k1' }], livePosts: [REEL] };
    patchPostZellen(document.getElementById('koop-table'), store);

    expect(document.querySelector('[data-col-id="col-link-live"] a').getAttribute('href')).toBe(REEL.link);
    expect(document.querySelector('[data-col-id="col-stats-views"]').textContent.trim()).toBe('1,2K');
    expect(document.querySelector('[data-col-id="col-stats-likes"]').textContent.trim()).toBe('40');
  });

  it('leert die Zellen, wenn der Post wegfällt', () => {
    const container = document.getElementById('koop-table');
    patchPostZellen(container, { kooperationen: [], livePosts: [REEL] });
    patchPostZellen(container, { kooperationen: [], livePosts: [] });

    expect(document.querySelector('[data-col-id="col-link-live"] a')).toBeNull();
    expect(document.querySelector('[data-col-id="col-stats-views"]').textContent.trim()).toBe('—');
  });

  it('macht ohne Container nichts', () => {
    expect(() => patchPostZellen(null, { livePosts: [REEL] })).not.toThrow();
  });

  it('hängt am Store-Event posts-changed und lässt sich abmelden', () => {
    const store = new KampagneDetailStore('kamp-1');
    store.setKooperationen([{ id: 'k1' }]);
    const table = { store, containerId: 'koop-table', _rowHeightSync: { schedule: vi.fn() } };
    const abmelden = bindPostZellen(table);

    store.setLivePosts([REEL]);
    expect(document.querySelector('[data-col-id="col-stats-views"]').textContent.trim()).toBe('1,2K');
    expect(table._rowHeightSync.schedule).toHaveBeenCalledTimes(1);

    abmelden();
    store.setLivePosts([]);
    expect(document.querySelector('[data-col-id="col-stats-views"]').textContent.trim()).toBe('1,2K');
    expect(bindPostZellen({ store: null })).toBeNull();
  });
});
