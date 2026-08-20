import { describe, it, expect } from 'vitest';
import { KampagneDetailStore } from '../modules/kampagne/KampagneDetailStore.js';

function buildStore() {
  const store = new KampagneDetailStore('kamp-1');
  store.setKooperationen([
    { id: 'k1', _tags: ['Juli'], creator_id: 'c1', videoanzahl: 2, verkaufspreis_zusatzkosten: 100, ksk_selbstzahler: true, ksk_betrag: 49 },
    { id: 'k2', _tags: ['August'], creator_id: 'c2', videoanzahl: 3, verkaufspreis_zusatzkosten: 200 },
    { id: 'k3', _tags: ['August', 'September'], creator_id: null, videoanzahl: 1, verkaufspreis_zusatzkosten: 50 },
  ]);
  store.setVideos({
    k1: [{ id: 'v1', verkaufspreis_netto: 1000, stats_views: 100, stats_likes: 10, stats_comments: 5 }],
    k2: [{ id: 'v2', verkaufspreis_netto: 2000, stats_views: 200, stats_likes: 20, stats_comments: 10 }],
    k3: [
      { id: 'v3', verkaufspreis_netto: 500, stats_views: 50, stats_likes: 5, stats_comments: 1 },
      { id: 'v4', verkaufspreis_netto: 250, stats_views: null, stats_likes: null, stats_comments: null },
    ],
  });
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
    store.setSelectedTags(['August']);
    const s = store.calculateFilteredSummary();

    // k2 + k3: Videos 2000 + 500 + 250
    expect(s.koopBudgetSum).toBe(2750);
    // videoanzahl 3 + 1
    expect(s.koopVideosUsed).toBe(4);
    // nur k2 hat creator_id
    expect(s.koopCreatorsUsed).toBe(1);
    // Zusatzkosten 200 + 50
    expect(s.extraKostenVkSum).toBe(250);
    // Stats nur aus k2/k3-Videos
    expect(s.videoStats.views).toBe(250);
    expect(s.videoStats.likes).toBe(25);
    expect(s.videoStats.comments).toBe(11);
    expect(s.videoStats.videosMitDaten).toBe(2);
  });

  it('haelt kskUmgebucht global (Budget-Basis bleibt Auftragsebene)', () => {
    const store = buildStore();
    store.setSelectedTags(['August']);
    const s = store.calculateFilteredSummary();
    // k1 (Juli) ist Selbstzahler mit 49 -> bleibt in der Basis enthalten
    expect(s.kskUmgebucht).toBe(49);
  });

  it('liefert Nullsummen bei Tags ohne Treffer', () => {
    const store = buildStore();
    store.setSelectedTags(['Dezember']);
    const s = store.calculateFilteredSummary();

    expect(s.koopBudgetSum).toBe(0);
    expect(s.koopVideosUsed).toBe(0);
    expect(s.koopCreatorsUsed).toBe(0);
    expect(s.extraKostenVkSum).toBe(0);
    expect(s.videoStats.views).toBe(0);
  });

  it('OR-Logik: mehrere Tags vereinigen die Mengen', () => {
    const store = buildStore();
    store.setSelectedTags(['Juli', 'September']);
    const s = store.calculateFilteredSummary();

    // k1 (Juli) + k3 (September)
    expect(s.koopBudgetSum).toBe(1750);
    expect(s.koopVideosUsed).toBe(3);
    expect(s.extraKostenVkSum).toBe(150);
  });
});

describe('KampagneDetailStore.calculateVideoStats(videosList)', () => {
  it('akzeptiert eine eingeschraenkte Video-Menge', () => {
    const store = buildStore();
    const stats = store.calculateVideoStats([
      { stats_views: 5, stats_likes: 1, stats_comments: 0 },
    ]);
    expect(stats.views).toBe(5);
    expect(stats.videosMitDaten).toBe(1);
  });

  it('faellt ohne Parameter auf alle Videos zurueck', () => {
    const store = buildStore();
    const stats = store.calculateVideoStats();
    expect(stats.views).toBe(350);
    expect(stats.videosMitDaten).toBe(3);
  });
});
