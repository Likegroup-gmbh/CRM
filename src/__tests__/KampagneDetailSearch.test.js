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

  it('matcht über Tags', () => {
    store.setSearchQuery('ugc');
    expect(store.getFiltered('alle').map(k => k.id)).toEqual(['k1']);
  });

  it('matcht über den Status', () => {
    store.setSearchQuery('angefragt');
    expect(store.getFiltered('alle').map(k => k.id)).toEqual(['k1']);
  });

  it('matcht über Thema, Video-Name und Caption der Videos', () => {
    store.setVideos({
      k1: [{ id: 'v1', freigabe: true, thema: 'Unboxing Herbst', video_name: 'Hook A', caption: 'Jetzt shoppen' }],
      k2: [{ id: 'v2', freigabe: false, thema: 'Review', caption: 'Werbung' }],
    });

    store.setSearchQuery('unboxing');
    expect(store.getFiltered('alle').map(k => k.id)).toEqual(['k1']);

    store.setSearchQuery('hook a');
    expect(store.getFiltered('alle').map(k => k.id)).toEqual(['k1']);

    store.setSearchQuery('werbung');
    expect(store.getFiltered('alle').map(k => k.id)).toEqual(['k2']);
  });

  it('matcht über die Konzept-Beschreibung (strategie_item)', () => {
    store.setVideos({
      k2: [{ id: 'v2', freigabe: false, strategie_item: { beschreibung: 'POV: Morgenroutine' } }],
    });
    store.setSearchQuery('morgenroutine');
    expect(store.getFiltered('alle').map(k => k.id)).toEqual(['k2']);
  });

  it('matcht über Custom-Text- und Dropdown-Spalten (Koop- und Video-Ebene)', () => {
    store.customColumns = [
      { id: 'c1', field_type: 'text', entity_type: 'kooperation' },
      { id: 'c2', field_type: 'dropdown', entity_type: 'video' },
      { id: 'c3', field_type: 'number', entity_type: 'kooperation' },
    ];
    store.setCustomColumnValue('k2', 'c1', 'Notiz Sommerschluss');
    store.setCustomColumnValue('v2', 'c2', 'Variante B');
    store.setCustomColumnValue('k2', 'c3', 42);
    store.setVideos({ k2: [{ id: 'v2', freigabe: false }] });

    store.setSearchQuery('sommerschluss');
    expect(store.getFiltered('alle').map(k => k.id)).toEqual(['k2']);

    store.setSearchQuery('variante b');
    expect(store.getFiltered('alle').map(k => k.id)).toEqual(['k2']);

    // Zahlen-Spalten werden nicht durchsucht
    store.setSearchQuery('42');
    expect(store.getFiltered('alle')).toHaveLength(0);
  });
});

describe('KampagneDetailStore – getVisibleVideos (Zeilen-Filterung)', () => {
  let store;
  const videos = [
    { id: 'v1', position: 1, thema: 'Apfelringe', caption: 'Snack' },
    { id: 'v2', position: 2, thema: 'Grilled Cheese', caption: 'Käse' },
    { id: 'v3', position: 3, thema: 'Halloween Cookie', caption: 'Kürbis' },
  ];

  beforeEach(() => {
    store = new KampagneDetailStore('kampagne-1');
    store.setKooperationen([
      makeKoop({ id: 'k1', creator: { vorname: 'Nina', nachname: 'Test' } }),
    ]);
    store.setVideos({ k1: videos });
  });

  it('ohne Suche: alle Videos', () => {
    expect(store.getVisibleVideos(store.kooperationen[0])).toHaveLength(3);
  });

  it('Video-Match: nur die passende Zeile bleibt sichtbar', () => {
    store.setSearchQuery('apfelringe');
    const visible = store.getVisibleVideos(store.kooperationen[0]);
    expect(visible.map(v => v.id)).toEqual(['v1']);
  });

  it('Video-Match über Caption filtert ebenfalls auf die Zeile', () => {
    store.setSearchQuery('kürbis');
    expect(store.getVisibleVideos(store.kooperationen[0]).map(v => v.id)).toEqual(['v3']);
  });

  it('Koop-Level-Match (Creator-Name): alle Videos bleiben sichtbar', () => {
    store.setSearchQuery('nina');
    expect(store.getVisibleVideos(store.kooperationen[0])).toHaveLength(3);
  });

  it('Koop-Level-Match über Tag: alle Videos bleiben sichtbar', () => {
    store.kooperationen[0]._tags = ['UGC'];
    store.setSearchQuery('ugc');
    expect(store.getVisibleVideos(store.kooperationen[0])).toHaveLength(3);
  });

  it('mehrere Video-Treffer: alle Treffer-Zeilen, nicht mehr', () => {
    store.setVideos({
      k1: [
        { id: 'v1', position: 1, caption: 'Toller Kürbis' },
        { id: 'v2', position: 2, thema: 'Kürbis-Suppe' },
        { id: 'v3', position: 3, thema: 'Apfelringe' },
      ],
    });
    store.setSearchQuery('kürbis');
    expect(store.getVisibleVideos(store.kooperationen[0]).map(v => v.id)).toEqual(['v1', 'v2']);
  });

  it('Video-Custom-Spalte matcht auf Zeilen-Ebene', () => {
    store.customColumns = [{ id: 'c1', field_type: 'text', entity_type: 'video' }];
    store.setCustomColumnValue('v2', 'c1', 'Spezialnotiz');
    store.setSearchQuery('spezialnotiz');
    expect(store.getVisibleVideos(store.kooperationen[0]).map(v => v.id)).toEqual(['v2']);
  });
});
