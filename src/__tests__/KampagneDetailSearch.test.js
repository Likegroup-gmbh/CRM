import { describe, it, expect, beforeEach } from 'vitest';
import { KampagneDetailStore } from '../modules/kampagne/KampagneDetailStore.js';

function makeKoop(overrides = {}) {
  return {
    id: overrides.id || Math.random().toString(36).slice(2),
    creator_id: null,
    creator: null,
    status_name: '',
    _tags: [],
    ...overrides
  };
}

describe('KampagneDetailStore – Kooperationen-Namenssuche', () => {
  let store;

  beforeEach(() => {
    store = new KampagneDetailStore('kampagne-1');
    store.setKooperationen([
      makeKoop({ id: 'k1', creator: { vorname: 'Anna', nachname: 'Müller' }, status_name: 'Angefragt', _tags: ['UGC'] }),
      makeKoop({ id: 'k2', creator: { vorname: 'Ben', nachname: 'Schulz' }, status_name: 'Gebucht' }),
      makeKoop({ id: 'k3', creator: { vorname: 'Annalena', nachname: 'Krause' }, status_name: 'Gebucht' }),
      makeKoop({ id: 'k4', creator: null }),
      makeKoop({ id: 'k5', creator: { vorname: '', nachname: 'Anders' } })
    ]);
    // k1 abgeschlossen (alle Videos freigegeben), Rest offen
    store.setVideos({
      k1: [{ id: 'v1', freigabe: true }],
      k2: [{ id: 'v2', freigabe: false }]
    });
  });

  it('filtert case-insensitiv und mit Teiltreffern über den Creator-Namen', () => {
    store.setSearchQuery('anna');
    const result = store.getFiltered('alle');
    expect(result.map(k => k.id)).toEqual(['k1', 'k3']);
  });

  it('matcht auch über den Nachnamen und den kombinierten Namen', () => {
    store.setSearchQuery('schulz');
    expect(store.getFiltered('alle').map(k => k.id)).toEqual(['k2']);

    store.setSearchQuery('ben schulz');
    expect(store.getFiltered('alle').map(k => k.id)).toEqual(['k2']);
  });

  it('ignoriert führende/nachgestellte Leerzeichen im Suchbegriff', () => {
    store.setSearchQuery('  Anders  ');
    expect(store.getFiltered('alle').map(k => k.id)).toEqual(['k5']);
  });

  it('liefert bei leerer Suche alle Kooperationen', () => {
    store.setSearchQuery('');
    expect(store.getFiltered('alle')).toHaveLength(5);
  });

  it('behandelt Kooperationen ohne Creator robust (kein Treffer, kein Fehler)', () => {
    store.setSearchQuery('irgendwas');
    expect(() => store.getFiltered('alle')).not.toThrow();
    expect(store.getFiltered('alle')).toHaveLength(0);
  });

  it('kombiniert Suche mit den Tabs offen/abgeschlossen', () => {
    store.setSearchQuery('anna');
    // k1 ist abgeschlossen (alle Videos freigegeben), k3 offen (keine Videos)
    expect(store.getFiltered('offen').map(k => k.id)).toEqual(['k3']);
    expect(store.getFiltered('abgeschlossen').map(k => k.id)).toEqual(['k1']);
  });

  it('kombiniert Suche mit Status- und Tag-Filter', () => {
    store.setSearchQuery('anna');
    store.setSelectedStatuses(['Gebucht']);
    expect(store.getFiltered('alle').map(k => k.id)).toEqual(['k3']);

    store.setSelectedStatuses([]);
    store.setSelectedTags(['UGC']);
    expect(store.getFiltered('alle').map(k => k.id)).toEqual(['k1']);
  });

  it('wirkt auch in getFilteredAndSorted (Tabelle und Kanban)', () => {
    store.setSearchQuery('anna');
    const result = store.getFilteredAndSorted('alle');
    expect(result.map(k => k.id).sort()).toEqual(['k1', 'k3']);
  });

  it('hasActiveFilters berücksichtigt die Suche', () => {
    expect(store.hasActiveFilters()).toBe(false);

    store.setSearchQuery('anna');
    expect(store.hasActiveFilters()).toBe(true);

    store.setSearchQuery('   ');
    expect(store.hasActiveFilters()).toBe(false);
  });

  it('destroy setzt die Suche zurück', () => {
    store.setSearchQuery('anna');
    store.destroy();
    expect(store.searchQuery).toBe('');
  });
});
