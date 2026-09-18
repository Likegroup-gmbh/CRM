// CastingMatch.test.js
// Deterministischer Kern der Casting-Vorschlaege (ADR 0013/0014):
//   - Bedarf aus dem aktiven Briefing-Bereich, Fingerprint
//   - Gates: hart nur bei gesetztem Feld, Unbekannt ist kein Rauswurf
//   - Scores: Fit/Track/Fresh, Wilson statt 1/1 = 100
//   - Matching: ein finaler Score (80/15/5), Renorm bei Cold-Start
//   - Ranking: Top-N nach Matching, kein Slot-Portfolio mehr

import { describe, it, expect } from 'vitest';

import castingMatch from '../../netlify/functions/_shared/casting-match.js';

const {
  buildBedarf,
  bedarfFingerprint,
  zielAnzahl,
  normiereKandidat,
  applyGates,
  scoreFit,
  scoreTrack,
  scoreFresh,
  matchingScore,
  wilson,
  topNNachMatching,
  orderPersonasByIds,
  validateVorschlaege,
  PROFILES
} = castingMatch;

// ---------------------------------------------------------------------------
// Helfer
// ---------------------------------------------------------------------------

function kandidat(overrides = {}) {
  return normiereKandidat({
    id: 'c1',
    vorname: 'Anna',
    nachname: 'Muster',
    mail: 'anna@example.de',
    geschlecht: 'weiblich',
    alter_min: 25,
    alter_max: 34,
    lieferadresse_land: 'Deutschland',
    lieferadresse_stadt: 'Berlin',
    instagram: 'anna.muster',
    instagram_follower: 30000,
    creator_creator_type: [{ creator_type_id: { id: 't1', name: 'UGC Creator' } }],
    creator_branchen: [{ branche_id: { id: 'b1', name: 'Beauty' } }],
    creator_sprachen: [{ sprachen: { id: 's1', name: 'Deutsch' } }],
    hat_haustier: true,
    hat_kinder: false,
    spielt_instrument: null,
    ...overrides
  });
}

function bedarf(overrides = {}) {
  return {
    bereich: 'paid_creator_ads',
    typ: 'UGC Paid',
    nischen: ['beauty'],
    groessen: ['micro'],
    voraussetzungen: [],
    alter: [25, 34],
    geschlechter: ['weiblich'],
    standort: null,
    expertise: null,
    umsetzung: null,
    situationen: null,
    learningsText: null,
    maerkte: ['deutschland'],
    sprachen: ['deutsch'],
    kanaele: ['instagram'],
    ansatz: 'kampagne',
    alwaysOnBestehend: null,
    kampagnentypen: [],
    produktIds: [],
    personas: [],
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Bedarf
// ---------------------------------------------------------------------------

describe('buildBedarf', () => {
  it('liest nur den aktiven bereich (pa_ bei paid_creator_ads)', () => {
    const b = buildBedarf({
      bereich: 'paid_creator_ads',
      ansatz: 'kampagne',
      im_nischen: ['gaming'],
      pa_nischen: ['beauty'],
      pa_creator_groessen: ['micro'],
      pa_creator_merkmale: { alter: '25-34', geschlecht: 'weiblich' },
      pa_voraussetzungen: ['haustier']
    });
    expect(b.typ).toBe('UGC Paid');
    expect(b.nischen).toEqual(['beauty']);
    expect(b.groessen).toEqual(['micro']);
    expect(b.alter).toEqual([25, 34]);
    expect(b.voraussetzungen).toEqual(['haustier']);
  });

  it('mappt bereich auf Typ (im -> Influencer)', () => {
    const b = buildBedarf({ bereich: 'influencer_marketing', im_nischen: ['fashion'] });
    expect(b.typ).toBe('Influencer');
    expect(b.nischen).toEqual(['fashion']);
  });

  it('fingerprint ist stabil gegen Umordnung und unterscheidet Jobs', () => {
    const a = bedarf({ nischen: ['beauty', 'health'] });
    const b = bedarf({ nischen: ['health', 'beauty'] });
    const c = bedarf({ nischen: ['beauty'] });
    expect(bedarfFingerprint(a)).toBe(bedarfFingerprint(b));
    expect(bedarfFingerprint(a)).not.toBe(bedarfFingerprint(c));
  });
});

describe('zielAnzahl', () => {
  it('2.5x offen, gedeckelt 6-20, Fallback 12', () => {
    expect(zielAnzahl(4)).toBe(10);
    expect(zielAnzahl(1)).toBe(6);
    expect(zielAnzahl(40)).toBe(20);
    expect(zielAnzahl(null)).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

describe('applyGates', () => {
  it('lässt passende Kandidaten durch', () => {
    const { pass, raus } = applyGates([kandidat()], bedarf(), {});
    expect(pass).toHaveLength(1);
    expect(raus).toHaveLength(0);
  });

  it('Briefing ohne Feld gatet nicht (Unbekannt ist kein Rauswurf)', () => {
    const k = kandidat({ lieferadresse_land: null, alter_min: null, alter_max: null, alter_jahre: null });
    const { pass } = applyGates([k], bedarf({ maerkte: [], alter: null, sprachen: [], nischen: [] }), {});
    expect(pass).toHaveLength(1);
  });

  it('wirft bereits gelistete und marken-abgelehnte raus', () => {
    const ks = [kandidat({ id: 'a' }), kandidat({ id: 'b' })];
    const { pass, raus } = applyGates(ks, bedarf(), {
      aufDieserListe: new Set(['a']),
      abgelehntMarke: new Set(['b'])
    });
    expect(pass).toHaveLength(0);
    expect(raus.map(r => r.grund).sort()).toEqual(['bereits_auf_dieser_liste', 'von_marke_abgelehnt']);
  });

  it('Sprache und Land gaten nur bei beidseitig gesetztem Feld', () => {
    const englisch = kandidat({ creator_sprachen: [{ sprachen: { id: 's2', name: 'Englisch' } }] });
    expect(applyGates([englisch], bedarf(), {}).raus[0].grund).toBe('sprache_fehlt');

    const oesterreich = kandidat({ lieferadresse_land: 'Österreich' });
    expect(applyGates([oesterreich], bedarf(), {}).raus[0].grund).toBe('land_fehlt');

    // Kandidat ohne Land-Angabe bleibt drin
    const ohneLand = kandidat({ lieferadresse_land: null });
    expect(applyGates([ohneLand], bedarf(), {}).pass).toHaveLength(1);
  });

  it('Voraussetzung: false fliegt, null bleibt mit unverified-Flag', () => {
    const b = bedarf({ voraussetzungen: ['haustier'] });
    const nein = kandidat({ hat_haustier: false });
    expect(applyGates([nein], b, {}).raus[0].grund).toBe('voraussetzung_fehlt');
    const unbekannt = kandidat({ hat_haustier: null });
    const { pass } = applyGates([unbekannt], b, {});
    expect(pass).toHaveLength(1);
    const fit = scoreFit(pass[0], b, PROFILES.ugc.fit);
    expect(fit.coverage.voraussetzung).toBe('unverified');
  });

  it('Kontakt: Mail oder Management, sonst raus', () => {
    const ohneMail = kandidat({ mail: '' });
    expect(applyGates([ohneMail], bedarf(), {}).raus[0].grund).toBe('nicht_anschreibbar');
    const mitManagement = applyGates([ohneMail], bedarf(), { managementIds: new Set(['c1']) });
    expect(mitManagement.pass).toHaveLength(1);
  });

  it('Alter ohne Schnitt fliegt', () => {
    const alt = kandidat({ alter_min: 50, alter_max: 60 });
    expect(applyGates([alt], bedarf(), {}).raus[0].grund).toBe('alter_ausserhalb');
  });
});

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

describe('scoreFit', () => {
  it('Nischen-Treffer gibt volle Punkte, Lifestyle-Fallback nicht', () => {
    const voll = scoreFit(kandidat(), bedarf(), PROFILES.ugc.fit);
    expect(voll.coverage.nische).toBe('treffer');
    const lifestyle = kandidat({ creator_branchen: [{ branche_id: { id: 'b2', name: 'Lifestyle' } }] });
    const ohne = scoreFit(lifestyle, bedarf(), PROFILES.ugc.fit);
    expect(ohne.coverage.nische).toBe('kein_treffer');
    expect(ohne.wert).toBeLessThan(voll.wert);
  });

  it('Persona-Demo zaehlt (Alter + Geschlecht)', () => {
    const b = bedarf({
      nischen: [],
      personas: [{ id: 'p1', name: 'Lena', alter_von: 25, alter_bis: 34, geschlecht: 'weiblich' }]
    });
    const passt = scoreFit(kandidat(), b, PROFILES.ugc.fit);
    expect(passt.coverage.persona).toBe('treffer');
    const passtNicht = scoreFit(kandidat({ geschlecht: 'männlich', alter_min: 50, alter_max: 55 }), b, PROFILES.ugc.fit);
    expect(passtNicht.wert).toBeLessThan(passt.wert);
  });

  it('Standort: Laender-Bedarf matcht das Creator-Land (Regression ADR 0014)', () => {
    // SharkNinja-Befund: Bedarf "Deutschland" vs. lieferadresse_land
    // "Deutschland" gab faelschlich kein_treffer, weil nur Stadt/PLZ
    // geprueft wurden.
    const b = bedarf({ standort: 'Deutschland' });
    const fit = scoreFit(kandidat(), b, PROFILES.ugc.fit);
    expect(fit.coverage.standort).toBe('treffer');
  });

  it('Standort: Stadt-Bedarf matcht die Stadt, fremde Stadt nicht', () => {
    const b = bedarf({ standort: 'Berlin' });
    expect(scoreFit(kandidat(), b, PROFILES.ugc.fit).coverage.standort).toBe('treffer');
    const fremd = kandidat({ lieferadresse_stadt: 'Hamburg', lieferadresse_land: 'Deutschland' });
    const bMuenchen = bedarf({ standort: 'München' });
    expect(scoreFit(fremd, bMuenchen, PROFILES.ugc.fit).coverage.standort).toBe('kein_treffer');
  });
});

describe('wilson / scoreTrack', () => {
  it('1/1 ist keine 100 %', () => {
    expect(wilson(1, 1)).toBeLessThan(1);
    expect(wilson(0, 0)).toBe(0);
    expect(wilson(8, 10)).toBeGreaterThan(wilson(1, 1));
  });

  it('Absagen ziehen ab, Videos und Kontakt zählen', () => {
    const gut = scoreTrack(kandidat(), { castings: 5, prio1: 4, angefragt: 4, gebucht: 3, videos: 2, er: 4, hatMail: true, hatTelefonOderManagement: true }, PROFILES.ugc.track);
    const mitAbsagen = scoreTrack(kandidat(), { castings: 5, prio1: 4, angefragt: 4, gebucht: 3, absagen: 5, videos: 2, er: 4, hatMail: true, hatTelefonOderManagement: true }, PROFILES.ugc.track);
    expect(mitAbsagen).toBeLessThan(gut);
    expect(gut).toBeGreaterThan(50);
  });
});

describe('scoreFresh', () => {
  it('fortfuehren schaltet Fresh aus, leer bleibt 100', () => {
    expect(scoreFresh({ alwaysOnFortfuehren: true, markeBuchungen90d: 3 }, PROFILES.influencer.fresh)).toBe(100);
    expect(scoreFresh({}, PROFILES.influencer.fresh)).toBe(100);
  });

  it('Marken-Wiederholung staffelt: 1x frei, danach progressiv', () => {
    const fresh = PROFILES.ugc.fresh;
    expect(scoreFresh({ markeBuchungen90d: 0 }, fresh)).toBe(100);
    expect(scoreFresh({ markeBuchungen90d: 1 }, fresh)).toBe(100);
    expect(scoreFresh({ markeBuchungen90d: 2 }, fresh)).toBe(90);
    expect(scoreFresh({ markeBuchungen90d: 3 }, fresh)).toBe(75);
    // geclamppt auf die letzte Stufe
    expect(scoreFresh({ markeBuchungen90d: 9 }, fresh)).toBe(60);
  });

  it('Fingerprint und Vorschlags-Abzuege bleiben (halbiert)', () => {
    const fresh = PROFILES.ugc.fresh;
    expect(scoreFresh({ fingerprintDabei: true }, fresh)).toBe(75);
    expect(scoreFresh({ vorgeschlagen3: true }, fresh)).toBe(88);
  });
});

describe('matchingScore', () => {
  it('gewichtet 80/15/5 (finaler Score)', () => {
    // 0.8*62 + 0.15*26 + 0.05*100 = 49.6 + 3.9 + 5 = 58.5 -> 59
    expect(matchingScore({ fit: 62, track: 26, fresh: 100, castings: 3 })).toBe(59);
  });

  it('Cold-Start: ohne Historie geht das Track-Gewicht auf Fit (Renorm)', () => {
    // (0.8*62 + 0.05*48) / 0.85 = 52 / 0.85 = 61.2 -> 61
    const kalt = matchingScore({ fit: 62, track: 0, fresh: 48, castings: 0 });
    expect(kalt).toBe(61);
    // Neuling wird nicht mehr pauschal unter den Wiederholer gereiht
    const wiederholer = matchingScore({ fit: 62, track: 10, fresh: 48, castings: 4 });
    expect(kalt).toBeGreaterThan(wiederholer);
  });

  it('deckelt bei 100 und fehlende Werte zaehlen als 0', () => {
    expect(matchingScore({ fit: 100, track: 100, fresh: 100, castings: 5 })).toBe(100);
    expect(matchingScore({})).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Ranking (Top-N nach Matching, ADR 0014)
// ---------------------------------------------------------------------------

function scored(id, overrides = {}) {
  const { k: kOverrides, ...rest } = overrides;
  const k = kandidat({ id, ...kOverrides });
  return {
    k,
    fit: 60,
    track: 60,
    fresh: 80,
    matching: 60,
    hist: {},
    coverage: {},
    profileName: 'ugc',
    ...rest
  };
}

describe('topNNachMatching', () => {
  it('sortiert streng nach Matching absteigend - hoechster Match oben', () => {
    const liste = [
      scored('mitte', { matching: 50, fit: 60 }),
      scored('beste', { matching: 59, fit: 62 }),
      scored('schlecht', { matching: 28, fit: 40 })
    ];
    const top = topNNachMatching(liste, { anzahl: 3 });
    expect(top.map(s => s.k.id)).toEqual(['beste', 'mitte', 'schlecht']);
  });

  it('Tiebreak: bei Gleichstand entscheidet Fit, dann Fresh', () => {
    const liste = [
      scored('a', { matching: 50, fit: 60, fresh: 40 }),
      scored('b', { matching: 50, fit: 70, fresh: 30 }),
      scored('c', { matching: 50, fit: 70, fresh: 90 })
    ];
    const top = topNNachMatching(liste, { anzahl: 3 });
    expect(top.map(s => s.k.id)).toEqual(['c', 'b', 'a']);
  });

  it('schneidet auf anzahl ab', () => {
    const liste = Array.from({ length: 20 }, (_, i) => scored(`c${i}`, { matching: 100 - i }));
    const top = topNNachMatching(liste, { anzahl: 12 });
    expect(top).toHaveLength(12);
    expect(top[0].k.id).toBe('c0');
    expect(top[11].k.id).toBe('c11');
  });
});

// ---------------------------------------------------------------------------
// Kategorie + Validate (Covered-Set)
// ---------------------------------------------------------------------------

describe('orderPersonasByIds', () => {
  it('haelt die Briefing-Reihenfolge', () => {
    const rows = [{ id: 'p2', name: 'B' }, { id: 'p1', name: 'A' }];
    expect(orderPersonasByIds(rows, ['p1', 'p2']).map(p => p.id)).toEqual(['p1', 'p2']);
  });
});

describe('validateVorschlaege', () => {
  const ctx = { shortlistIds: ['c1', 'c2'], personaIds: ['p1'] };

  it('nimmt nur Shortlist-IDs mit belegtem fit_grund', () => {
    const { vorschlaege, verworfen } = validateVorschlaege({
      vorschlaege: [
        { creator_id: 'c1', fit_grund: 'Beauty-Branche, 30k Follower', persona_ids: ['p1'] },
        { creator_id: 'fremd', fit_grund: 'Halluziniert' },
        { creator_id: 'c2', fit_grund: '   ' }
      ]
    }, ctx);
    expect(vorschlaege).toHaveLength(1);
    expect(vorschlaege[0].creator_id).toBe('c1');
    expect(verworfen).toHaveLength(2);
  });

  it('Covered-Set: Doppelte fliegen, fremde persona_ids werden gefiltert', () => {
    const { vorschlaege, verworfen } = validateVorschlaege({
      vorschlaege: [
        { creator_id: 'c1', fit_grund: 'Passt', persona_ids: ['p1', 'fremd'] },
        { creator_id: 'c1', fit_grund: 'Doppelt' },
        { creator_id: 'c2', fit_grund: 'Passt auch' }
      ]
    }, ctx);
    expect(vorschlaege).toHaveLength(2);
    expect(vorschlaege[0].persona_ids).toEqual(['p1']);
    expect(verworfen.some(v => v.grund === 'doppelter Vorschlag')).toBe(true);
  });
});
