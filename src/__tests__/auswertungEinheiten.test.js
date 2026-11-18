import { describe, expect, it } from 'vitest';
import { einheitenAusBaum, einheitInLinie, verbrauchFuer } from '../modules/auswertung/auswertungEinheiten.js';
import { plattformAusLink } from '../modules/auswertung/auswertungKonfig.js';

const finalOrdner = (items) => ({ id: 'final', kind: 'final', items });
const item = (id, type, extra = {}) => ({ id, type, ratio: '9:16', name: `${type} ${id}`, tagIds: [], ...extra });

const tree = {
  kooperationen: [{
    id: 'k1', creatorId: 'c1', name: 'Lea Berg', handle: '@lea', avatarUrl: null,
    linie: { id: 'l1', name: 'Organic', bereich: 'influencer_marketing' },
    rows: [
      {
        id: 'v1', number: 1, title: 'Morgenroutine',
        folders: [{ id: 'roh', kind: 'roh', items: [] }, finalOrdner([
          item('a1', 'video', { tagIds: ['t-persona'] }),
          item('a2', 'video', { ratio: '4:5', tagIds: ['t-ansatz', 't-persona'] }),
          item('s1', 'story', { storyId: 'st1' }),
          item('s2', 'story', { storyId: 'st1', ratio: '4:5' }),
          item('b1', 'still')
        ])]
      },
      { id: 'v2', number: 2, title: 'Ohne Final', folders: [{ id: 's1', kind: 'schleife', items: [item('x', 'video')] }] }
    ]
  }, {
    id: 'k2', creatorId: 'c2', name: 'Max', handle: '@max', avatarUrl: null,
    linie: { id: 'l2', name: 'Paid', bereich: 'paid_creator_ads' },
    rows: [{ id: 'v3', number: 1, title: '', folders: [finalOrdner([item('a3', 'video')])] }]
  }]
};

const tagTypen = [
  { id: 't-persona', label: 'Junge Mütter', gruppe: 'Persona' },
  { id: 't-ansatz', label: 'Problem-Lösung', gruppe: 'Ansatz' }
];

describe('Einheiten aus dem Baum', () => {
  const einheiten = einheitenAusBaum(tree, {
    produktion: { id: 'p1', name: 'Produktion 1' },
    tagTypen,
    stories: [{ id: 'st1', video_id: 'v1', slot_index: 1 }, { id: 'st2', video_id: 'v2', slot_index: 0 }],
    videos: [{
      id: 'v1', posting_datum: '2026-11-01', link_live: 'https://www.tiktok.com/@lea/video/1',
      stats_views: 1200, stats_likes: 80, stats_comments: 7
    }]
  });

  it('eine Einheit je Video und Story, auch ohne Finale Version; Stills nur final', () => {
    expect(einheiten.map(e => e.id)).toEqual(['video:v1', 'story:st1', 'still:b1', 'video:v2', 'story:st2', 'video:v3']);
    expect(einheiten.find(e => e.id === 'video:v1').dateien.map(d => d.ratio)).toEqual(['9:16', '4:5']);
    expect(einheiten.find(e => e.id === 'story:st1').label).toBe('Story 2');
    expect(einheiten.find(e => e.id === 'video:v2')).toMatchObject({ titel: 'Ohne Final', dateien: [] });
    expect(einheiten.find(e => e.id === 'story:st2')).toMatchObject({ label: 'Story 1', bezug: 'Video 2', dateien: [] });
  });

  it('übernimmt nur das Posting-Datum; Link und Zahlen der Altfelder stehen am Post', () => {
    const v1 = einheiten.find(e => e.id === 'video:v1');
    expect(v1.gepostetAm).toBe('2026-11-01');
    ['link', 'plattform', 'views', 'likes', 'comments'].forEach(key => expect(v1).not.toHaveProperty(key));
    expect(einheiten.find(e => e.id === 'video:v2').gepostetAm).toBeNull();
  });

  it('Tags sind die Vereinigung über die finalen Dateien', () => {
    const video = einheiten.find(e => e.id === 'video:v1');
    expect(video.tags).toEqual({ persona: ['Junge Mütter'], ansatz: ['Problem-Lösung'], plattform: [] });
  });

  it('Paid-Linie erwartet keinen Post', () => {
    expect(einheiten.find(e => e.id === 'video:v3').erwartet).toBe(false);
    expect(einheiten.find(e => e.id === 'video:v1').erwartet).toBe(true);
  });

  it('ohne Linie gehört die Einheit zu jeder Linie', () => {
    expect(einheitInLinie({ linie: null }, 'l1')).toBe(true);
    expect(einheitInLinie({ linie: { id: 'l2' } }, 'l1')).toBe(false);
    expect(einheitInLinie({ linie: { id: 'l2' } }, null)).toBe(true);
  });
});

describe('Plattform aus dem Link', () => {
  it('erkennt TikTok, Reel, Post und Story', () => {
    expect(plattformAusLink('https://www.tiktok.com/@lea/video/1')).toBe('tiktok');
    expect(plattformAusLink('https://www.instagram.com/reel/ABC/')).toBe('ig_reel');
    expect(plattformAusLink('https://instagram.com/p/XYZ')).toBe('ig_post');
    expect(plattformAusLink('https://instagram.com/stories/lea/123')).toBe('ig_story');
  });

  it('/p/ an einem Video ist ein Reel', () => {
    expect(plattformAusLink('https://instagram.com/p/XYZ', 'video')).toBe('ig_reel');
    expect(plattformAusLink('https://instagram.com/p/XYZ', 'still')).toBe('ig_post');
  });

  it('ohne erkennbaren Link keine Plattform', () => {
    expect(plattformAusLink('')).toBeNull();
    expect(plattformAusLink(null)).toBeNull();
    expect(plattformAusLink('https://youtube.com/watch?v=1')).toBeNull();
  });
});

describe('Verbrauch je Ebene', () => {
  const verbrauch = [
    { produktionId: 'p1', briefingId: 'l1', betrag: 1000 },
    { produktionId: 'p1', briefingId: null, betrag: 200 },
    { produktionId: 'p2', briefingId: 'l9', betrag: 500 }
  ];

  it('summiert Produktion, Linie und Kampagne', () => {
    expect(verbrauchFuer(verbrauch, { produktionIds: ['p1'] })).toBe(1200);
    expect(verbrauchFuer(verbrauch, { produktionIds: ['p1'], linieId: 'l1' })).toBe(1200);
    expect(verbrauchFuer(verbrauch)).toBe(1700);
    expect(verbrauchFuer([], {})).toBeNull();
  });
});
