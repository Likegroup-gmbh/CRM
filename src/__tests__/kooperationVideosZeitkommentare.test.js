import { afterEach, describe, expect, it, vi } from 'vitest';
import { escapeHtml } from '../core/format.js';
import { renderKooperationVideos } from '../modules/kooperation/kooperationVideosTab.js';
import { ladeKooperationVideos } from '../modules/kooperation/kooperationVideosLaden.js';

function zeit(overrides = {}) {
  return {
    id: 'z1', video_id: 'v1', runde: 2, feedback_typ: 'kunde', text: 'Logo früher',
    timecode_sec: 12.4, asset_id: 'a1', author_name: 'Angelika', created_at: '2026-11-06T09:00:00Z',
    deleted_at: null, ...overrides
  };
}

function render({ zeitkommentare = [], feedback, kampagne = { id: 'kamp1' } } = {}) {
  const video = { id: 'v1', kooperation_id: 'k1', position: 1, titel: 'Video 1', zeitkommentare, feedback };
  document.body.innerHTML = renderKooperationVideos({ videos: [video], kooperationId: 'k1', kampagne, sanitize: escapeHtml });
  // Reihenfolge wie VIDEO_FEEDBACK_FIELDS: LG 1, Kunde 1, LG 2, Kunde 2, LG 3, Kunde 3
  return [...document.querySelectorAll('td.feedback-cell')];
}

afterEach(() => {
  document.body.innerHTML = '';
  delete window.supabase;
  vi.restoreAllMocks();
});

describe('Kooperations-Detailseite – Kommentare aus dem Videos-Tab', () => {
  it('stehen nur in der Spalte ihrer Runde und Rolle, mit Label und Timecode', () => {
    const cells = render({ zeitkommentare: [zeit()] });
    expect(cells[3].querySelector('.fb-quelle').textContent).toBe('Videos-Tab');
    expect(cells[3].querySelector('.fb-text').textContent).toBe('Logo früher');
    expect(cells[3].querySelector('.fb-meta').textContent).toBe('Angelika • 0:12');
    cells.filter((_, i) => i !== 3).forEach(cell => expect(cell.textContent.trim()).toBe('-'));
  });

  it('verlinken auf die Datei im Videos-Tab der Kampagne', () => {
    const cells = render({ zeitkommentare: [zeit()] });
    const href = cells[3].querySelector('a.fb-zeit-link').getAttribute('href');
    const [pfad, query] = href.split('?');
    expect(pfad).toBe('/kampagne/kamp1');
    expect(Object.fromEntries(new URLSearchParams(query))).toEqual({ tab: 'videos', k: 'k1', v: 'v1', f: 's2', i: 'a1' });
  });

  it('stehen unter der Slot-Notiz derselben Spalte', () => {
    const feedback = { kundeR2: [{ id: 'n1', text: 'Notiz', author_name: 'Kunde', created_at: '2026-11-01' }] };
    const cells = render({ zeitkommentare: [zeit()], feedback });
    const texte = [...cells[3].querySelectorAll('.fb-text')].map(el => el.textContent);
    expect(texte).toEqual(['Notiz', 'Logo früher']);
  });

  it('zeigen die drei neuesten, der Rest verlinkt als "+N weitere" auf die Schleife', () => {
    const list = [1, 2, 3, 4].map(n => zeit({ id: `z${n}`, text: `K${n}`, created_at: `2026-11-0${n}T10:00:00Z` }));
    const cells = render({ zeitkommentare: list });
    expect([...cells[3].querySelectorAll('.fb-text')].map(el => el.textContent)).toEqual(['K2', 'K3', 'K4']);
    const mehr = cells[3].querySelector('.fb-zeit-mehr');
    expect(mehr.textContent).toBe('+1 weitere');
    const params = new URLSearchParams(mehr.getAttribute('href').split('?')[1]);
    expect(params.get('f')).toBe('s2');
    expect(params.get('i')).toBeNull();
  });

  it('escapen Autor und Text', () => {
    const cells = render({ zeitkommentare: [zeit({ author_name: '<img src=x>', text: '<b>fett</b>' })] });
    expect(cells[3].querySelector('img')).toBeNull();
    expect(cells[3].querySelector('b')).toBeNull();
    expect(cells[3].querySelector('.fb-text').textContent).toBe('<b>fett</b>');
  });

  it('escapen auch den Autor der Slot-Notiz', () => {
    const feedback = { cjR1: [{ id: 'n1', text: 'x', author_name: '<img src=x>', created_at: null }] };
    const cells = render({ feedback });
    expect(cells[0].querySelector('img')).toBeNull();
  });

  it('ohne Kampagne Text ohne Link, ohne Kommentare "-"', () => {
    let cells = render({ zeitkommentare: [zeit()], kampagne: null });
    expect(cells[3].querySelector('a')).toBeNull();
    expect(cells[3].querySelector('.fb-text').textContent).toBe('Logo früher');
    cells = render();
    cells.forEach(cell => expect(cell.textContent.trim()).toBe('-'));
  });
});

function fakeSupabase(tables) {
  return {
    from(table) {
      const q = {
        select: () => q, in: () => q, eq: () => q, order: () => q, is: () => q,
        then: (res, rej) => Promise.resolve(tables[table] ?? { data: [], error: null }).then(res, rej)
      };
      return q;
    }
  };
}

describe('Kooperations-Detailseite – Laden der Videos', () => {
  const detail = () => ({ kooperationId: 'k1', kooperation: { kampagne_id: 'kamp1', kampagne: { id: 'kamp1', videoanzahl: 4 } } });
  const tables = (extra = {}) => ({
    kooperation_videos: { data: [{ id: 'v1' }, { id: 'v2' }], error: null },
    kooperation_video_asset: { data: [{ id: 'a1', video_id: 'v1' }], error: null },
    kooperationen: { data: [{ videoanzahl: 2 }, { videoanzahl: 1 }], error: null },
    kooperation_video_comment: { data: [{ id: 'n1', video_id: 'v1', runde: 2, feedback_typ: 'kunde', text: 'Notiz' }], error: null },
    kooperation_video_zeitkommentar: { data: [zeit({ id: 'z1', video_id: 'v2', runde: 1 })], error: null },
    ...extra
  });

  it('hängt Asset, Notizen und Videokommentare an das jeweilige Video', async () => {
    window.supabase = fakeSupabase(tables());
    const d = detail();
    await ladeKooperationVideos(d);
    const [v1, v2] = d.videos;
    expect(v1.currentAsset.id).toBe('a1');
    expect(v1.feedback.kundeR2.map(c => c.text)).toEqual(['Notiz']);
    expect(v1.zeitkommentare).toEqual([]);
    expect(v2.zeitkommentare.map(c => c.id)).toEqual(['z1']);
    expect(d.campaignVideoTotals).toEqual({ total: 4, used: 3, remaining: 1 });
  });

  it('ohne lesbare Videokommentare bleiben Videos und Notizen stehen', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.supabase = fakeSupabase(tables({ kooperation_video_zeitkommentar: { data: null, error: { message: 'RLS' } } }));
    const d = detail();
    await ladeKooperationVideos(d);
    expect(d.videos).toHaveLength(2);
    expect(d.videos[0].feedback.kundeR2).toHaveLength(1);
    expect(d.videos.every(v => Array.isArray(v.zeitkommentare) && v.zeitkommentare.length === 0)).toBe(true);
  });
});
