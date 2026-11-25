// LegacyLinienPlanner.test.js
// Reine Planlogik der Altbestand-Linien-Migration (scripts/legacy-linien/planner.cjs).

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  istZeitTag,
  enthaeltBegriff,
  altTitel,
  bereichAusListeTyp,
  planKampagne,
} = require('../../scripts/legacy-linien/planner.cjs');

function ctx(overrides = {}) {
  return {
    kampagne: { id: 'k1', kampagnenname: 'EDEKA SW Jahreskooperation', eigener_name: null, art_der_kampagne: ['UGC'] },
    produktionen: [{ id: 'p1', name: 'EDEKA SW Jahreskooperation', budget: null, created_at: '2026-01-01' }],
    briefings: [],
    castings: [],
    konzepte: [],
    castingItems: [],
    strategieItems: [],
    koops: [],
    videos: [],
    skripte: [],
    vertraege: [],
    vertragKoops: [],
    ...overrides,
  };
}

const koop = (id, tags, extra = {}) => ({
  id, creator_id: `c-${id}`, briefing_id: null, produktion_id: 'p1', tags, created_at: `2026-02-0${id.length}`, ...extra,
});

describe('Hilfsfunktionen', () => {
  it('erkennt Zeit-Tags', () => {
    for (const tag of ['2026', 'Oktober', 'oktober 2026', '30.10.', '30.10.2026', 'Q3', 'q4 2026', 'März']) {
      expect(istZeitTag(tag)).toBe(true);
    }
    for (const tag of ['Kampagne 9', 'Sommer Sale', 'H2', 'EDEKA']) expect(istZeitTag(tag)).toBe(false);
  });

  it('matcht Begriffe nur als eigenes Wort', () => {
    expect(enthaeltBegriff('EDEKA SW Kampagne 9 Casting', 'Kampagne 9')).toBe(true);
    expect(enthaeltBegriff('EDEKA SW Kampagne 10', 'Kampagne 1')).toBe(false);
    expect(enthaeltBegriff('Käse-Aktion', 'kaese-aktion')).toBe(true);
  });

  it('entfernt Projekt-Praefix und Casting/Konzept-Suffix aus dem Titel', () => {
    expect(altTitel('EDEKA SW Jahreskooperation Kampagne 9', 'EDEKA SW Jahreskooperation')).toBe('Kampagne 9');
    expect(altTitel('Kampagne 9 Konzept', 'EDEKA SW')).toBe('Kampagne 9');
    expect(altTitel('Casting', 'EDEKA SW')).toBe('Casting');
  });

  it('leitet bereich aus liste_typ ab', () => {
    expect(bereichAusListeTyp('influencer')).toBe('influencer_marketing');
    expect(bereichAusListeTyp('ugc')).toBe('paid_creator_ads');
    expect(bereichAusListeTyp(null, ['Influencer'])).toBe('influencer_marketing');
    expect(bereichAusListeTyp(null, ['UGC'])).toBe('paid_creator_ads');
  });
});

describe('planKampagne', () => {
  it('tut nichts, wenn alles schon an einer Linie haengt', () => {
    const plan = planKampagne(ctx({ koops: [koop('a', [], { briefing_id: 'b1' })] }));
    expect(plan.status).toBe('noop');
  });

  it('Kampagne ohne Tag-Gruppe behaelt die Huelle und bekommt eine Altbestand-Linie', () => {
    const plan = planKampagne(ctx({
      koops: [koop('a', ['2026']), koop('bb', ['Oktober'])],
      castings: [{ id: 'ca', name: 'EDEKA SW Jahreskooperation Casting', briefing_id: null, strategie_id: null, liste_typ: 'ugc', created_at: '1' }],
    }));
    expect(plan.status).toBe('auto');
    expect(plan.produktionen).toHaveLength(1);
    expect(plan.produktionen[0]).toMatchObject({ id: 'p1', neu: false, umbenennen: false, name: 'EDEKA SW Jahreskooperation' });
    expect(plan.linien).toHaveLength(1);
    expect(plan.linien[0]).toMatchObject({ castingIds: ['ca'], neuKonzept: true, neuCasting: false, bereich: 'paid_creator_ads' });
    expect(plan.koopZuordnung.map(z => z.linieKey)).toEqual([plan.linien[0].key, plan.linien[0].key]);
  });

  it('Zeit-Tags bilden nie eine Produktion', () => {
    const plan = planKampagne(ctx({ koops: [koop('a', ['Q3', '30.10.']), koop('bb', ['2026'])] }));
    expect(plan.stats.gruppen).toBe(0);
    expect(plan.produktionen).toHaveLength(1);
  });

  it('Tag-Gruppen werden Produktionen, die Huelle bekommt die groesste, Rest kommt in Sammel-Produktion', () => {
    const plan = planKampagne(ctx({
      koops: [
        koop('a', ['Kampagne 9']), koop('bb', ['Kampagne 9']), koop('ccc', ['Kampagne 8']), koop('dddd', []),
      ],
      castings: [
        { id: 'c9', name: 'EDEKA SW Kampagne 9 Casting', briefing_id: null, liste_typ: 'influencer', created_at: '1' },
        { id: 'c8', name: 'EDEKA SW Kampagne 8 Casting', briefing_id: null, liste_typ: 'ugc', created_at: '2' },
      ],
      konzepte: [
        { id: 'k9', name: 'EDEKA SW Kampagne 9 Konzept', briefing_id: null, creator_auswahl_id: null, created_at: '1' },
        { id: 'k8', name: 'EDEKA SW Kampagne 8 Konzept', briefing_id: null, creator_auswahl_id: null, created_at: '2' },
      ],
    }));
    expect(plan.status).toBe('review');
    expect(plan.gruende).toContain('mehrere_gruppen');
    const namen = plan.produktionen.map(p => p.name);
    expect(namen).toEqual([
      'EDEKA SW Jahreskooperation – Kampagne 9',
      'EDEKA SW Jahreskooperation – Kampagne 8',
      'EDEKA SW Jahreskooperation – Altbestand',
    ]);
    const k9 = plan.produktionen[0];
    expect(k9).toMatchObject({ id: 'p1', umbenennen: true, altName: 'EDEKA SW Jahreskooperation' });
    expect(plan.produktionen[1].neu).toBe(true);

    const linie9 = plan.linien.find(l => l.konzeptId === 'k9');
    expect(linie9).toMatchObject({ titel: 'Kampagne 9', castingIds: ['c9'], neuCasting: false, neuKonzept: false, verknuepfen: true, bereich: 'influencer_marketing' });
    const linie8 = plan.linien.find(l => l.konzeptId === 'k8');
    expect(linie8.castingIds).toEqual(['c8']);
    // Rest-Produktion hat nur eine Koop und bekommt eine leere Linie
    const restLinie = plan.linien.find(l => l.zielKey === 'rest');
    expect(restLinie).toMatchObject({ titel: 'Altbestand', neuCasting: true, neuKonzept: true });
  });

  it('mehrere Tags: der Tag aus dem Casting-Namen gewinnt', () => {
    const plan = planKampagne(ctx({
      koops: [koop('a', ['Kampagne 9', 'Sommer']), koop('bb', ['Sommer']), koop('ccc', ['Sommer'])],
      castings: [{ id: 'c9', name: 'Kampagne 9 Casting', briefing_id: null, created_at: '1' }],
    }));
    const zuordnung = plan.koopZuordnung.find(z => z.koopId === 'a');
    expect(zuordnung.zielKey).toBe('kampagne 9');
    expect(zuordnung.regel).toContain('tag_im_namen');
  });

  it('verteilt Kooperationen: Video-Konzept vor Creator im Casting vor erster Linie', () => {
    const plan = planKampagne(ctx({
      koops: [
        koop('a', ['Alpha'], { creator_id: 'creator-1' }),
        koop('bb', ['Alpha'], { creator_id: 'creator-2' }),
        koop('ccc', ['Alpha'], { creator_id: 'creator-x' }),
      ],
      konzepte: [
        { id: 'k1', name: 'Alpha 1', briefing_id: null, created_at: '1' },
        { id: 'k2', name: 'Alpha 2', briefing_id: null, created_at: '2' },
      ],
      castings: [
        { id: 'c1', name: 'Alpha 1', briefing_id: null, created_at: '1' },
        { id: 'c2', name: 'Alpha 2', briefing_id: null, created_at: '2' },
      ],
      castingItems: [{ creator_auswahl_id: 'c2', creator_id: 'creator-2' }],
      strategieItems: [{ id: 'si1', strategie_id: 'k1' }],
      videos: [{ kooperation_id: 'a', strategie_item_id: 'si1', skript_id: null }],
    }));
    const linie = id => plan.koopZuordnung.find(z => z.koopId === id);
    const l1 = plan.linien.find(l => l.konzeptId === 'k1').key;
    const l2 = plan.linien.find(l => l.konzeptId === 'k2').key;
    expect(linie('a')).toMatchObject({ linieKey: l1 });
    expect(linie('a').regel).toContain('video_konzept');
    expect(linie('bb')).toMatchObject({ linieKey: l2 });
    expect(linie('bb').regel).toContain('creator_im_casting');
    expect(linie('ccc')).toMatchObject({ linieKey: l1 });
    expect(linie('ccc').regel).toContain('erste_linie');
  });

  it('Widerspruch zwischen Video und Creator geht ins Review', () => {
    const plan = planKampagne(ctx({
      koops: [koop('a', ['Alpha'], { creator_id: 'creator-2' })],
      konzepte: [
        { id: 'k1', name: 'Alpha 1', briefing_id: null, created_at: '1' },
        { id: 'k2', name: 'Alpha 2', briefing_id: null, created_at: '2' },
      ],
      castings: [
        { id: 'c1', name: 'Alpha 1', briefing_id: null, created_at: '1' },
        { id: 'c2', name: 'Alpha 2', briefing_id: null, created_at: '2' },
      ],
      castingItems: [{ creator_auswahl_id: 'c2', creator_id: 'creator-2' }],
      strategieItems: [{ id: 'si1', strategie_id: 'k1' }],
      videos: [{ kooperation_id: 'a', strategie_item_id: 'si1' }],
    }));
    expect(plan.gruende).toContain('video_vs_creator');
    expect(plan.status).toBe('review');
  });

  it('legt pro Konzept eine Linie an und ergaenzt fehlende Casting leer', () => {
    const plan = planKampagne(ctx({
      koops: [koop('a', [])],
      konzepte: [
        { id: 'k1', name: 'Konzept A', briefing_id: null, created_at: '1' },
        { id: 'k2', name: 'Konzept B', briefing_id: null, created_at: '2' },
      ],
    }));
    expect(plan.linien).toHaveLength(2);
    expect(plan.linien.every(l => l.neuCasting && !l.neuKonzept)).toBe(true);
  });

  it('bestehende Verknuepfung Casting-Konzept bleibt ein Paar', () => {
    const plan = planKampagne(ctx({
      koops: [koop('a', [])],
      castings: [{ id: 'c1', name: 'Anderer Name', briefing_id: null, strategie_id: 'k1', created_at: '1' }],
      konzepte: [{ id: 'k1', name: 'Konzept 1', briefing_id: null, creator_auswahl_id: 'c1', created_at: '1' }],
    }));
    expect(plan.linien).toHaveLength(1);
    expect(plan.linien[0]).toMatchObject({ castingIds: ['c1'], konzeptId: 'k1', verknuepfen: false, neuCasting: false, neuKonzept: false });
  });

  it('Kampagnen mit Produktionsbudget: keine neue Produktion, Koops bleiben, Review', () => {
    const plan = planKampagne(ctx({
      produktionen: [
        { id: 'p1', name: 'Ninja Q4 A', budget: 1000, created_at: '1' },
        { id: 'p2', name: 'Ninja Q4 B', budget: 2000, created_at: '2' },
      ],
      koops: [
        koop('a', ['X'], { produktion_id: 'p1' }),
        koop('bb', ['Y'], { produktion_id: 'p2' }),
        koop('ccc', [], { produktion_id: null }),
      ],
      castings: [{ id: 'c1', name: 'Ninja Q4 B Casting', briefing_id: null, created_at: '1' }],
    }));
    expect(plan.status).toBe('review');
    expect(plan.gruende).toContain('budgetiert');
    expect(plan.produktionen.every(p => !p.neu && !p.umbenennen)).toBe(true);
    expect(plan.koopZuordnung.map(z => z.produktionRef).sort()).toEqual(['p1', 'p2']);
    expect(plan.koopsOhneProduktion).toEqual(['ccc']);
    expect(plan.linien.find(l => l.castingIds.includes('c1')).produktionRef).toBe('p2');
  });

  it('echte V2-Linien bleiben, Altbestand kommt in eine eigene Produktion', () => {
    const plan = planKampagne(ctx({
      produktionen: [{ id: 'p1', name: 'Echte Produktion', budget: null, created_at: '1' }],
      briefings: [{ id: 'b-echt', produktion_id: 'p1', ist_altbestand: false, is_draft: false }],
      koops: [koop('a', []), koop('v2', [], { briefing_id: 'b-echt' })],
    }));
    expect(plan.produktionen).toHaveLength(1);
    expect(plan.produktionen[0]).toMatchObject({ neu: true, name: 'EDEKA SW Jahreskooperation – Altbestand' });
    expect(plan.koopZuordnung.map(z => z.koopId)).toEqual(['a']);
  });

  it('Delta-Lauf: neue Koops landen in der vorhandenen Altbestand-Linie', () => {
    const plan = planKampagne(ctx({
      briefings: [{ id: 'b-alt', produktion_id: 'p1', ist_altbestand: true, is_draft: false, aktivierung_name: 'Kampagne 9', bereich: 'paid_creator_ads' }],
      koops: [koop('neu', [])],
    }));
    expect(plan.produktionen[0]).toMatchObject({ id: 'p1', neu: false });
    expect(plan.linien).toHaveLength(1);
    expect(plan.linien[0]).toMatchObject({ briefingId: 'b-alt', bestehend: true });
    expect(plan.koopZuordnung[0].linieKey).toBe(plan.linien[0].key);
  });

  it('Vertraege folgen der Erzeuger-Kooperation, Contracting bleibt liegen', () => {
    const plan = planKampagne(ctx({
      koops: [koop('a', ['Alpha']), koop('bb', ['Beta']), koop('cc', ['Beta'])],
      vertraege: [
        { id: 'v1', typ: 'Creator', kooperation_id: 'cc', kampagne_id: 'k1', produktion_id: 'p1' },
        { id: 'v2', typ: 'Contracting', kooperation_id: 'a', kampagne_id: 'k1', produktion_id: 'p1' },
        { id: 'v3', typ: 'Creator', kooperation_id: null, kampagne_id: 'k1', produktion_id: null },
      ],
      vertragKoops: [{ vertrag_id: 'v1', kooperation_id: 'cc', created_at: '1' }],
    }));
    expect(plan.vertragZuordnung).toHaveLength(1);
    const ziel = plan.koopZuordnung.find(z => z.koopId === 'cc').produktionRef;
    expect(plan.vertragZuordnung[0]).toMatchObject({ vertragId: 'v1', produktionRef: ziel, erzeugerKoopId: 'cc' });
  });

  it('Vertrag mit fremder Kampagne wird nicht angefasst und geht ins Review', () => {
    const plan = planKampagne(ctx({
      koops: [koop('a', [])],
      vertraege: [{ id: 'v1', typ: 'Creator', kooperation_id: 'a', kampagne_id: 'andere', produktion_id: null }],
    }));
    expect(plan.vertragZuordnung).toHaveLength(0);
    expect(plan.gruende).toContain('vertrag_andere_kampagne');
  });

  it('Skripte folgen Videoidee, sonst Kooperation, sonst erster Linie', () => {
    const plan = planKampagne(ctx({
      koops: [koop('a', [])],
      konzepte: [
        { id: 'k1', name: 'K1', briefing_id: null, created_at: '1' },
        { id: 'k2', name: 'K2', briefing_id: null, created_at: '2' },
      ],
      strategieItems: [{ id: 'si2', strategie_id: 'k2' }],
      videos: [{ kooperation_id: 'a', strategie_item_id: null, skript_id: 's2' }],
      skripte: [
        { id: 's1', briefing_id: null, strategie_item_id: 'si2' },
        { id: 's2', briefing_id: null, strategie_item_id: null },
        { id: 's3', briefing_id: null, strategie_item_id: null },
      ],
    }));
    const l1 = plan.linien.find(l => l.konzeptId === 'k1').key;
    const l2 = plan.linien.find(l => l.konzeptId === 'k2').key;
    const z = id => plan.skriptZuordnung.find(s => s.skriptId === id);
    expect(z('s1')).toMatchObject({ linieKey: l2, regel: 'videoidee_konzept' });
    expect(z('s2')).toMatchObject({ linieKey: l1, regel: 'kooperation' });
    expect(z('s3').regel).toBe('erste_linie');
  });

  it('warnt, wenn der Rest durch neu sichtbaren Verbrauch negativ wird', () => {
    const plan = planKampagne(ctx({
      kampagne: { id: 'k1', kampagnenname: 'Catrice', creator_budget: 1000, art_der_kampagne: [] },
      koops: [koop('a', [], { produktion_id: null })],
      videos: [{ kooperation_id: 'a', verkaufspreis_netto: 1500 }],
    }));
    expect(plan.negativerRest).toBe(-500);
    expect(plan.warnungen.join(' ')).toContain('negativ');
  });
});
