import { describe, it, expect, beforeEach } from 'vitest';
import { zuordnenKonzeptInhalte } from '../modules/kampagne/konzeptInhalte.js';
import { renderIdeeStrategieInner, renderSkriptCell } from '../modules/kampagne/videoTableMediaCells.js';

function idee(overrides) {
  return {
    video_umgesetzt: true,
    ist_vorschlag: false,
    sortierung: 0,
    konzeptIndex: 0,
    ...overrides
  };
}

function video(id, position, extra = {}) {
  return { id, position, kooperation_id: 'koop-1', ...extra };
}

const KOOP = { id: 'koop-1', creator_id: 'c1' };

beforeEach(() => {
  window.permissionSystem = { canEditField: () => true };
  window.isGast = () => false;
});

describe('zuordnenKonzeptInhalte', () => {
  it('paart umgesetzte Ideen in Konzept-Reihenfolge auf die Videos', () => {
    const videos = {
      'koop-1': [video('v1', 1), video('v2', 2), video('v3', 3)]
    };
    const ideen = [
      idee({ id: 'i2', sortierung: 2, beschreibung: 'Zwei', creator_id: 'c1', strategie_id: 's1' }),
      idee({ id: 'i1', sortierung: 1, beschreibung: 'Eins', creator_id: 'c1', strategie_id: 's1' }),
      idee({ id: 'i3', sortierung: 3, beschreibung: 'Drei', creator_id: 'c1', strategie_id: 's1' })
    ];
    const skripte = [
      { id: 'sk1', titel: 'Skript Eins', strategie_item_id: 'i1', created_at: '2026-01-01T00:00:00Z' },
      { id: 'sk2', titel: 'Skript Zwei', strategie_item_id: 'i2', created_at: '2026-01-01T00:00:00Z' },
      { id: 'sk3', titel: 'Skript Drei', strategie_item_id: 'i3', created_at: '2026-01-01T00:00:00Z' }
    ];

    const result = zuordnenKonzeptInhalte([KOOP], videos, ideen, skripte);

    expect(result['koop-1'].map(v => v.strategie_item.id)).toEqual(['i1', 'i2', 'i3']);
    expect(result['koop-1'].map(v => v.skript.titel)).toEqual(['Skript Eins', 'Skript Zwei', 'Skript Drei']);
    expect(result['koop-1'].every(v => v.strategie_item_id == null && v.skript_id == null)).toBe(true);
    expect(videos['koop-1'][0].strategie_item).toBeUndefined();
  });

  it('lässt eine gespeicherte Idee gewinnen und vergibt sie nicht nochmal', () => {
    const videos = {
      'koop-1': [
        video('v1', 1),
        video('v2', 2, {
          strategie_item_id: 'i2',
          strategie_item: { id: 'i2', beschreibung: 'Gespeichert', strategie_id: 's1' }
        })
      ]
    };
    const ideen = [
      idee({ id: 'i1', sortierung: 1, beschreibung: 'Eins', creator_id: 'c1' }),
      idee({ id: 'i2', sortierung: 2, beschreibung: 'Zwei', creator_id: 'c1' })
    ];

    const result = zuordnenKonzeptInhalte([KOOP], videos, ideen, [
      { id: 'sk2', titel: 'Zum gespeicherten', strategie_item_id: 'i2', created_at: '2026-01-01T00:00:00Z' }
    ]);

    expect(result['koop-1'][0].strategie_item.id).toBe('i1');
    expect(result['koop-1'][0]._ideeAusKonzept).toBe(true);
    expect(result['koop-1'][1].strategie_item.beschreibung).toBe('Gespeichert');
    expect(result['koop-1'][1]._ideeAusKonzept).toBeUndefined();
    expect(result['koop-1'][1].skript.titel).toBe('Zum gespeicherten');
  });

  it('ignoriert fremde Creator, Vorschläge und nicht umgesetzte Ideen', () => {
    const videos = { 'koop-1': [video('v1', 1), video('v2', 2)] };
    const ideen = [
      idee({ id: 'fremd', sortierung: 1, creator_id: 'c2', beschreibung: 'Fremd' }),
      idee({ id: 'vor', sortierung: 1, creator_id: 'c1', ist_vorschlag: true, beschreibung: 'Vorschlag' }),
      idee({ id: 'aus', sortierung: 1, creator_id: 'c1', video_umgesetzt: false, beschreibung: 'Aus' }),
      idee({
        id: 'ok',
        sortierung: 4,
        beschreibung: 'Passt',
        casting_eintrag: { creator_id: 'c1' }
      })
    ];

    const result = zuordnenKonzeptInhalte([KOOP], videos, ideen, []);

    expect(result['koop-1'][0].strategie_item.id).toBe('ok');
    expect(result['koop-1'][1].strategie_item).toBeUndefined();
  });

  it('nimmt das neueste Skript der Idee und lässt eine gespeicherte skript_id stehen', () => {
    const videos = {
      'koop-1': [
        video('v1', 1),
        video('v2', 2, {
          strategie_item_id: 'i2',
          skript_id: 'alt',
          skript: { id: 'alt', titel: 'Fest' }
        })
      ]
    };
    const ideen = [
      idee({ id: 'i1', sortierung: 1, creator_id: 'c1' }),
      idee({ id: 'i2', sortierung: 2, creator_id: 'c1' })
    ];
    const skripte = [
      { id: 'alt-konzept', titel: 'Älter', strategie_item_id: 'i1', created_at: '2026-01-01T00:00:00Z' },
      { id: 'neu', titel: 'Neuer', strategie_item_id: 'i1', created_at: '2026-06-01T00:00:00Z' },
      { id: 'anderes', titel: 'Nicht das gespeicherte', strategie_item_id: 'i2', created_at: '2026-07-01T00:00:00Z' }
    ];

    const result = zuordnenKonzeptInhalte([KOOP], videos, ideen, skripte);

    expect(result['koop-1'][0].skript).toEqual({ id: 'neu', titel: 'Neuer', status: undefined });
    expect(result['koop-1'][1].skript.titel).toBe('Fest');
    expect(result['koop-1'][1]._skriptAusKonzept).toBeUndefined();
  });

  it('lässt übrige Videos leer und vergibt nicht mehr Ideen als Videos da sind', () => {
    const videos = { 'koop-1': [video('v1', 1)] };
    const ideen = [
      idee({ id: 'i1', sortierung: 1, creator_id: 'c1', beschreibung: 'Eins' }),
      idee({ id: 'i2', sortierung: 2, creator_id: 'c1', beschreibung: 'Zwei' })
    ];
    const extra = {
      'koop-1': [video('v1', 1), video('v2', 2), video('v3', 3)]
    };

    const nurEins = zuordnenKonzeptInhalte([KOOP], videos, ideen, []);
    expect(nurEins['koop-1']).toHaveLength(1);
    expect(nurEins['koop-1'][0].strategie_item.id).toBe('i1');

    const mitLeer = zuordnenKonzeptInhalte([KOOP], extra, [ideen[0]], []);
    expect(mitLeer['koop-1'][0].strategie_item.id).toBe('i1');
    expect(mitLeer['koop-1'][1].strategie_item).toBeUndefined();
    expect(mitLeer['koop-1'][2].strategie_item).toBeUndefined();
  });

  it('mischt Ideen einer anderen Produktion nicht in die Kooperation', () => {
    const koop = { id: 'koop-1', creator_id: 'c1', produktion_id: 'p1' };
    const videos = { 'koop-1': [video('v1', 1)] };
    const ideen = [
      idee({ id: 'andere', sortierung: 1, creator_id: 'c1', produktion_id: 'p2', beschreibung: 'Andere' }),
      idee({ id: 'hier', sortierung: 2, creator_id: 'c1', produktion_id: 'p1', beschreibung: 'Hier' })
    ];

    const result = zuordnenKonzeptInhalte([koop], videos, ideen, []);
    expect(result['koop-1'][0].strategie_item.id).toBe('hier');
  });
});

describe('Idee- und Skript-Zelle', () => {
  const ctx = { koop: { id: 'koop-1' }, t: { produktionId: null } };

  it('zeigt die Beschreibung statt Idee verknüpfen', () => {
    const html = renderIdeeStrategieInner(ctx, {
      id: 'v1',
      strategie_item: { id: 'i1', beschreibung: 'Hook mit Produkt', strategie_id: 's1' }
    });
    expect(html).toContain('Hook mit Produkt');
    expect(html).toContain('/konzepte/s1');
    expect(html).not.toContain('Idee verknüpfen');
    expect(html).not.toContain('Verknüpfung ändern');
    expect(html).not.toContain('link-strategie-item');
  });

  it('zeigt den Namen auch bei Screenshot und Referenzvideo', () => {
    const html = renderIdeeStrategieInner(ctx, {
      id: 'v1',
      strategie_item: {
        id: 'i1',
        beschreibung: 'Hook mit Produkt',
        strategie_id: 's1',
        screenshot_url: 'https://cdn.example/shot.jpg',
        video_link: 'https://tiktok.com/v/1'
      }
    });
    expect(html).toContain('Hook mit Produkt');
    expect(html).toContain('/konzepte/s1');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('target="_blank"');
    expect(html).not.toContain('https://tiktok.com/v/1');
    expect(html).not.toContain('https://cdn.example/shot.jpg');
  });

  it('zeigt den Skript-Titel und öffnet den Editor', () => {
    const html = renderSkriptCell({ id: 'koop-1' }, {
      id: 'v1',
      skript: { id: 'sk1', titel: 'Opener Final' }
    }, { produktionId: null });
    expect(html).toContain('Opener Final');
    expect(html).toContain('data-skript-id="sk1"');
    expect(html).not.toContain('Skript verknüpfen');
    expect(html).not.toContain('Verknüpfung ändern');
  });

  it('zeigt bei Idee ohne Skript den Leerhinweis', () => {
    const html = renderSkriptCell({ id: 'koop-1' }, {
      id: 'v1',
      strategie_item: { id: 'i1', beschreibung: 'Nur Idee' }
    });
    expect(html).toContain('Noch kein Skript verknüpft');
    expect(html).not.toContain('Skript verknüpfen');
  });

  it('behält den Verknüpfen-Button, wenn nichts auflöst', () => {
    const ideeHtml = renderIdeeStrategieInner(ctx, { id: 'v1' });
    const skriptHtml = renderSkriptCell({ id: 'koop-1' }, { id: 'v1' });
    expect(ideeHtml).toContain('Idee verknüpfen');
    expect(skriptHtml).toContain('Skript verknüpfen');
  });
});
