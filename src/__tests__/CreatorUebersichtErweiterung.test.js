import { describe, it, expect, vi, afterEach } from 'vitest';
import { istWerbePost } from '../../netlify/functions/_shared/instagram-cpm.js';
import { anzeigePosts, durchschnittlicheViews, kennzeichnetWerbung, renderReelsBlock, waehleAnzeigeReels, REEL_ANZEIGE_LIMIT } from '../modules/creator/creatorReels.js';
import { CREATOR_SORTS, sortiereNachAnzahl, vergleicheName, videoSeit } from '../modules/creator/creatorBuchung.js';
import { ladeFavoritenAnzahl } from '../modules/creator/creatorFavorit.js';
import { CreatorList } from '../modules/creator/CreatorListCore.js';
import { renderTagZeile } from '../modules/creator/creatorTags.js';
import { queryToSelection, selectionToQuery } from '../modules/creator/creatorFilterQuery.js';
import { overviewColumnGroups } from '../modules/creator/creatorFilterColumn.js';
import { CREATOR_FILTER_GROUPS } from '../modules/creator/filters/CreatorFilterConfig.js';

describe('Anzeige-Reels', () => {
  const reel = (id, extra = {}) => ({ id, media_type: 'VIDEO', caption: 'organisch', ...extra });

  it('erkennt dieselbe Werbung wie der CPM-Rechner', () => {
    const captions = [
      'Neue Kollektion #werbung',
      'In Kooperation mit dem Laden',
      '#ad',
      'paid partnership',
      'ganz normaler Reel',
      '',
      null
    ];
    for (const caption of captions) {
      expect(Boolean(kennzeichnetWerbung(caption))).toBe(Boolean(istWerbePost(caption)));
    }
  });

  it('lässt Posts und Werbe-Reels weg und nimmt höchstens 15', () => {
    const posts = [
      { id: 'bild', media_type: 'IMAGE', caption: 'foto' },
      reel('werbung', { caption: 'Neue Kollektion #werbung' }),
      reel('koop', { caption: 'In Kooperation mit dem Laden' }),
      ...Array.from({ length: 16 }, (_, i) => reel(`r${i}`))
    ];
    const reels = waehleAnzeigeReels(posts);
    expect(reels).toHaveLength(REEL_ANZEIGE_LIMIT);
    expect(reels.map((entry) => entry.id)).toEqual(Array.from({ length: 15 }, (_, i) => `r${i}`));
  });

  it('mittelt die Views der angezeigten Reels', () => {
    const creator = {
      ig_recent_posts: [
        { media_type: 'IMAGE', view_count: 9 },
        { media_type: 'VIDEO', caption: '#werbung', view_count: 1000 },
        { media_type: 'VIDEO', caption: 'organisch', view_count: 100 },
        { media_type: 'VIDEO', caption: 'organisch', view_count: 300 },
        { media_type: 'VIDEO', caption: 'ohne zahl', view_count: null }
      ]
    };
    expect(anzeigePosts(creator)).toHaveLength(3);
    expect(durchschnittlicheViews(creator)).toBe(200);
    expect(durchschnittlicheViews({})).toBeNull();
  });
});

describe('Videozahl', () => {
  it('zählt 30 und 90 Tage ab jetzt', () => {
    const jetzt = Date.parse('2026-10-09T12:00:00.000Z');
    expect(videoSeit(30, jetzt)).toBe('2026-09-09T12:00:00.000Z');
    expect(videoSeit(90, jetzt)).toBe('2026-07-11T12:00:00.000Z');
  });

  it('sortiert nach Anzahl, Gleichstand nach Name, Null bleibt unten', () => {
    const counts = new Map([['a', 2], ['b', 5], ['c', 0]]);
    const ordered = sortiereNachAnzahl([
      { id: 'c', nachname: 'Adler', vorname: 'Ann' },
      { id: 'a', nachname: 'Zimmer', vorname: 'Bea' },
      { id: 'd', nachname: 'Adler', vorname: 'Ben' },
      { id: 'b', nachname: 'Müller', vorname: 'Cem' }
    ], counts);
    expect(ordered.map((row) => row.id)).toEqual(['b', 'a', 'c', 'd']);
    expect(ordered.map((row) => row.anzahl)).toEqual([5, 2, 0, 0]);
  });

  it('sortiert den Namen wie auf der Kachel, leere Namen nach hinten', () => {
    const ordered = [
      { id: 'leer', vorname: '', nachname: '' },
      { id: 'luis', vorname: 'Luis Lindemann & Valentin Bölsing', nachname: '' },
      { id: 'aaron', vorname: '', nachname: 'Aaron' },
      { id: 'anna', vorname: 'Anna', nachname: 'Zimmer' },
      { id: 'millane', vorname: 'Millane', nachname: 'Al-Masoud' }
    ].sort(vergleicheName);
    expect(ordered.map((row) => row.id)).toEqual(['aaron', 'anna', 'luis', 'millane', 'leer']);
  });

  it('steht in der Adresse', () => {
    const params = selectionToQuery({ sort: 'video30', search: 'Anna' });
    expect(params.get('sort')).toBe('video30');
    expect(params.has('video')).toBe(false);
    expect(queryToSelection(params).sort).toBe('video30');
    expect(queryToSelection('?video=30').sort).toBe('video30');
    expect(queryToSelection('?video=12').sort).toBe('name');
    expect(queryToSelection('?sort=follower').sort).toBe('follower');
    expect(selectionToQuery({ sort: 'name' }).has('sort')).toBe(false);
  });
});

describe('Creator-Tags in der Zeile', () => {
  it('setzt alle Tags in eine Zeile', () => {
    const html = renderTagZeile([{ name: 'Allrounder' }, { name: 'UGC' }]);
    expect(html).toContain('Allrounder');
    expect(html).toContain('UGC');
    expect(html).toContain('data-creator-tag-more');
  });
});

describe('Filterspalte Grundlagen', () => {
  it('stellt Größe und Generation an den Anfang', () => {
    const groups = overviewColumnGroups(CREATOR_FILTER_GROUPS);
    const basic = groups.find((group) => group.id === 'basic');
    expect(basic.filters.slice(0, 4)).toEqual(['groesse', 'generation', 'favorit_von', 'creator_tag_id']);
  });
});

function favoritenSupabase(seiten, fehler = null) {
  const ranges = [];
  return {
    ranges,
    from: () => {
      const query = {
        select: () => query,
        order: () => query,
        range: async (from, to) => {
          ranges.push([from, to]);
          if (fehler) return { data: null, error: fehler };
          return { data: seiten[ranges.length - 1] || [], error: null };
        }
      };
      return query;
    }
  };
}

describe('Sortierung nach Favoriten', () => {
  afterEach(() => {
    delete window.supabase;
    delete window.toastSystem;
  });

  it('steht direkt nach Name und in der Adresse', () => {
    expect(CREATOR_SORTS.slice(0, 2).map((entry) => entry.id)).toEqual(['name', 'favoriten']);
    expect(CREATOR_SORTS[1].label).toBe('Favoriten');
    const params = selectionToQuery({ sort: 'favoriten' });
    expect(params.get('sort')).toBe('favoriten');
    expect(queryToSelection(params).sort).toBe('favoriten');
  });

  it('zählt alle Markierungen über mehrere Seiten', async () => {
    const voll = Array.from({ length: 1000 }, (_, i) => ({ creator_id: i < 600 ? 'a' : 'b' }));
    const supabase = favoritenSupabase([voll, [{ creator_id: 'c' }, { creator_id: 'a' }]]);
    const counts = await ladeFavoritenAnzahl(supabase);
    expect(supabase.ranges).toEqual([[0, 999], [1000, 1999]]);
    expect(counts.get('a')).toBe(601);
    expect(counts.get('b')).toBe(400);
    expect(counts.get('c')).toBe(1);
  });

  it('meiste Favoriten oben, Gleichstand A–Z, ohne Favorit danach, ohne Kennzahl auf der Karte', async () => {
    window.supabase = favoritenSupabase([[{ creator_id: 'z' }, { creator_id: 'z' }, { creator_id: 'b' }, { creator_id: 'a' }]]);
    const list = new CreatorList({ mode: 'all' });
    list.loadAllMatchingIds = async () => [
      { id: 'n', vorname: 'Nina', nachname: 'Ohne' },
      { id: 'b', vorname: 'Berta', nachname: 'Eins' },
      { id: 'z', vorname: 'Zoe', nachname: 'Zwei' },
      { id: 'a', vorname: 'Anna', nachname: 'Eins' }
    ];
    list.loadCreatorPage = async (_page, _limit, { _allowedIds }) => ({
      data: _allowedIds.map((id) => ({ id })),
      total: _allowedIds.length
    });
    const result = await list.loadPageData(1, 10, { _sort: 'favoriten' });
    expect(result.data.map((creator) => creator.id)).toEqual(['z', 'a', 'b', 'n']);
    expect(result.total).toBe(4);
    expect(result.data.some((creator) => 'videos' in creator)).toBe(false);
  });

  it('fällt bei einem Fehler auf A–Z zurück und meldet es', async () => {
    window.supabase = favoritenSupabase([], new Error('weg'));
    const show = vi.fn();
    window.toastSystem = { show };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const list = new CreatorList({ mode: 'all' });
    list.sort = 'favoriten';
    list.loadAllMatchingIds = async () => [];
    list.loadNamePage = vi.fn(async () => ({ data: [], total: 0 }));
    await list.loadPageData(1, 10, { _sort: 'favoriten' });
    expect(show).toHaveBeenCalledWith('Favoriten konnten nicht geladen werden', 'error');
    expect(list.sort).toBe('name');
    expect(list.loadNamePage).toHaveBeenCalled();
  });
});

describe('Reels-Block', () => {
  afterEach(() => { delete window.validatorSystem; });

  it('zeigt bis zu 15 Reels ohne Werbung, jedes verlinkt auf Instagram', () => {
    const posts = Array.from({ length: 20 }, (_, i) => ({
      media_type: 'VIDEO',
      caption: i === 0 ? 'Neu #werbung' : `Reel ${i}`,
      permalink: `https://www.instagram.com/reel/${i}/`
    }));
    window.validatorSystem = { sanitizeUrl: (url) => url, sanitizeHtml: (text) => text };
    const root = document.createElement('div');
    root.innerHTML = renderReelsBlock({ ig_username: 'anna', ig_recent_posts: posts });
    const links = [...root.querySelectorAll('a.ig-post-card')].map((a) => a.getAttribute('href'));
    expect(links).toHaveLength(15);
    expect(links[0]).toBe('https://www.instagram.com/reel/1/');
    expect(root.querySelector('label').textContent).toBe('Letzte Reels (15)');
  });

  it('erklärt, wenn kein Reel übrig bleibt', () => {
    const root = document.createElement('div');
    root.innerHTML = renderReelsBlock({ ig_recent_posts: [{ media_type: 'IMAGE' }] });
    expect(root.querySelector('.ig-post-card')).toBeNull();
    expect(root.textContent).toContain('Keine Reels ohne Werbe-Kennzeichnung.');
  });
});
