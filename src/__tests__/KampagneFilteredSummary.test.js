import { describe, it, expect } from 'vitest';
import { KampagneDetailStore } from '../modules/kampagne/KampagneDetailStore.js';
import { mitLivePost, summiereLivePerformance } from '../modules/kampagne/kampagneLivePerformance.js';

function buildStore() {
  const store = new KampagneDetailStore('kamp-1');
  store.setKooperationen([
    { id: 'k1', _tags: ['Juli'], creator_id: 'c1', videoanzahl: 2, verkaufspreis_zusatzkosten: 100, ksk_selbstzahler: true, ksk_betrag: 49 },
    { id: 'k2', _tags: ['August'], creator_id: 'c2', videoanzahl: 3, verkaufspreis_zusatzkosten: 200 },
    { id: 'k3', _tags: ['August', 'September'], creator_id: null, videoanzahl: 1, verkaufspreis_zusatzkosten: 50 },
  ]);
  store.setVideos({
    k1: [{ id: 'v1', verkaufspreis_netto: 1000 }],
    k2: [{ id: 'v2', verkaufspreis_netto: 2000 }],
    k3: [
      { id: 'v3', verkaufspreis_netto: 500 },
      { id: 'v4', verkaufspreis_netto: 250 },
    ],
  });
  store.setLivePosts([
    { id: 'p1', kooperation_id: 'k1', metrics: { views: 100, likes: 10, comments: 5 } },
    { id: 'p2', kooperation_id: 'k2', metrics: { views: 200, likes: 20, comments: 10 } },
    { id: 'p3', kooperation_id: 'k3', metrics: { views: 50, likes: 5, comments: 1 } },
  ]);
  return store;
}

describe('KampagneDetailStore.calculateFilteredSummary', () => {
  it('ist ohne Tag-Filter identisch zur globalen Summary', () => {
    const store = buildStore();
    const global = store.calculateSummary();
    const filtered = store.calculateFilteredSummary();

    expect(filtered.koopBudgetSum).toBe(global.koopBudgetSum);
    expect(filtered.koopVideosUsed).toBe(global.koopVideosUsed);
    expect(filtered.koopCreatorsUsed).toBe(global.koopCreatorsUsed);
    expect(filtered.extraKostenVkSum).toBe(global.extraKostenVkSum);
    expect(filtered.videoStats.views).toBe(global.videoStats.views);
  });

  it('rechnet bei Tag-Filter nur ueber getaggte Kooperationen', () => {
    const store = buildStore();
    store.setColumnFilters({ tag: ['August'] });
    const s = store.calculateFilteredSummary();

    // k3 ist Platzhalter und zählt nicht. Übrig bleibt k2.
    expect(s.koopBudgetSum).toBe(2000);
    expect(s.koopVideosUsed).toBe(3);
    expect(s.koopCreatorsUsed).toBe(1);
    // Zusatzkosten nur von k2. k3 ist Platzhalter.
    expect(s.extraKostenVkSum).toBe(200);
    expect(s.videoStats.views).toBe(200);
    expect(s.videoStats.likes).toBe(20);
    expect(s.videoStats.comments).toBe(10);
    expect(s.videoStats.posts).toBe(1);
  });

  it('haelt kskUmgebucht global (Budget-Basis bleibt Auftragsebene)', () => {
    const store = buildStore();
    store.setColumnFilters({ tag: ['August'] });
    const s = store.calculateFilteredSummary();
    // k1 (Juli) ist Selbstzahler mit 49 -> bleibt in der Basis enthalten
    expect(s.kskUmgebucht).toBe(49);
  });

  it('liefert Nullsummen bei Tags ohne Treffer', () => {
    const store = buildStore();
    store.setColumnFilters({ tag: ['Dezember'] });
    const s = store.calculateFilteredSummary();

    expect(s.koopBudgetSum).toBe(0);
    expect(s.koopVideosUsed).toBe(0);
    expect(s.koopCreatorsUsed).toBe(0);
    expect(s.extraKostenVkSum).toBe(0);
    expect(s.videoStats.views).toBe(0);
  });

  it('OR-Logik: mehrere Tags vereinigen die Mengen', () => {
    const store = buildStore();
    store.setColumnFilters({ tag: ['Juli', 'September'] });
    const s = store.calculateFilteredSummary();

    // k1 (Juli). k3 (September) ist Platzhalter und zählt nicht.
    expect(s.koopBudgetSum).toBe(1000);
    expect(s.koopVideosUsed).toBe(2);
    expect(s.extraKostenVkSum).toBe(100);
  });
});

describe('KampagneDetailStore.calculateVideoStats(koopIds)', () => {
  it('akzeptiert eine eingeschraenkte Kooperations-Menge', () => {
    const store = buildStore();
    const stats = store.calculateVideoStats(['k1']);
    expect(stats).toEqual({ views: 100, likes: 10, comments: 5, posts: 1 });
  });

  it('faellt ohne Parameter auf die geladenen Kooperationen zurueck', () => {
    const store = buildStore();
    store.setLivePosts([...store.livePosts, { id: 'px', kooperation_id: 'fremd', metrics: { views: 999 } }]);
    const stats = store.calculateVideoStats();
    expect(stats.views).toBe(350);
    expect(stats.posts).toBe(3);
  });
});

describe('Live-Performance aus der Auswertung', () => {
  it('bestätigt zählt, Entwurf und Gelöschtes fallen raus', () => {
    const store = buildStore();
    const post = { id: 'p4', kooperationId: 'k1', status: 'confirmed', metrics: { views: 40, likes: 2 } };
    store.setLivePosts(mitLivePost(store.livePosts, post));
    expect(store.calculateVideoStats().views).toBe(390);
    store.setLivePosts(mitLivePost(store.livePosts, { ...post, status: 'draft' }));
    expect(store.calculateVideoStats().views).toBe(350);
    store.setLivePosts(mitLivePost(store.livePosts, { id: 'p1' }, { weg: true }));
    expect(store.calculateVideoStats()).toMatchObject({ views: 250, posts: 2 });
  });

  it('ignoriert fehlende oder kaputte Werte', () => {
    expect(summiereLivePerformance([{ kooperation_id: 'k1', metrics: { views: '12', likes: null } }, { kooperation_id: 'k1' }]))
      .toEqual({ views: 0, likes: 0, comments: 0, posts: 2 });
  });
});
