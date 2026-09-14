// CastingMatch.test.js
// Deterministischer Kern der Casting-Vorschlaege (ADR 0013):
//   - Bedarf aus dem aktiven Briefing-Bereich, Fingerprint, Explore-Default
//   - Gates: hart nur bei gesetztem Feld, Unbekannt ist kein Rauswurf
//   - Scores: Fit/Track/Fresh, Wilson statt 1/1 = 100
//   - Slots: Quote statt Top-N, Covered-Set beim Regen via Validate

import { describe, it, expect } from 'vitest';

import castingMatch from '../../netlify/functions/_shared/casting-match.js';

const {
  buildBedarf,
  bedarfFingerprint,
  exploreDefaultForBriefing,
  zielAnzahl,
  normiereKandidat,
  applyGates,
  scoreFit,
  scoreTrack,
  scoreFresh,
  wilson,
  fillSlots,
  matchKategorie,
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

describe('exploreDefaultForBriefing', () => {
  it('fortfuehren bekommt wenig Explore, Launch viel', () => {
    expect(exploreDefaultForBriefing({ ansatz: 'always_on', alwaysOnBestehend: 'fortfuehren' })).toBe(0.25);
    expect(exploreDefaultForBriefing({ ansatz: 'kampagne', kampagnentypen: ['produktlaunch'] })).toBe(0.55);
    expect(exploreDefaultForBriefing({ ansatz: 'kampagne' })).toBe(0.45);
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
  it('fortfuehren schaltet Fresh aus, Repeat straft', () => {
    expect(scoreFresh({ markeGebucht90d: true }, PROFILES.influencer.fresh)).toBeLessThan(100);
    expect(scoreFresh({ markeGebucht90d: true, alwaysOnFortfuehren: true }, PROFILES.influencer.fresh)).toBe(100);
    expect(scoreFresh({}, PROFILES.influencer.fresh)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

function scored(id, overrides = {}) {
  const { k: kOverrides, ...rest } = overrides;
  const k = kandidat({ id, ...kOverrides });
  return {
    k,
    fit: 60,
    track: 60,
    fresh: 80,
    hist: {},
    coverage: {},
    adjacent: false,
    profileName: 'ugc',
    ...rest
  };
}

describe('fillSlots', () => {
  it('füllt die Quote (proven/tight/explore) statt Top-N', () => {
    const branchen = ['Beauty', 'Health', 'Fashion', 'Fitness'];
    const liste = Array.from({ length: 20 }, (_, i) => scored(`c${i}`, {
      fit: 90 - i,
      hist: i < 3 ? { markeGebucht: true, prioQuote: 0.8 } : {},
      k: {
        geschlecht: i % 2 ? 'weiblich' : 'männlich',
        alter_min: 20 + (i % 4) * 10,
        alter_max: 29 + (i % 4) * 10,
        creator_branchen: [{ branche_id: { id: `b${i}`, name: branchen[i % branchen.length] } }]
      }
    }));
    const slots = fillSlots(liste, { anzahl: 12, exploreBias: 0.45 });
    expect(slots).toHaveLength(12);
    const nachSlot = slots.reduce((acc, s) => { acc[s.slot] = (acc[s.slot] || 0) + 1; return acc; }, {});
    expect(nachSlot.proven).toBeGreaterThan(0);
    expect(nachSlot.explore).toBeGreaterThan(0);
    // Proven braucht Fit >= 55 und Marken-Historie
    expect(slots.filter(s => s.slot === 'proven').every(s => s.fit >= 55)).toBe(true);
  });

  it('Explore braucht Fresh und nimmt auch Unbekannte', () => {
    const liste = [
      scored('neu', { fit: 50, track: 10, fresh: 95, hist: { castings: 0 } }),
      ...Array.from({ length: 10 }, (_, i) => scored(`alt${i}`, { fit: 80 - i, fresh: 10 }))
    ];
    const slots = fillSlots(liste, { anzahl: 6, exploreBias: 0.8 });
    expect(slots.some(s => s.k.id === 'neu' && s.slot === 'explore')).toBe(true);
  });

  it('Tight ist paarweise divers (max 2 je Demo-Schlüssel, lieber weniger)', () => {
    const liste = Array.from({ length: 10 }, (_, i) => scored(`c${i}`, { fit: 90 - i, fresh: 90 }));
    const slots = fillSlots(liste, { anzahl: 8, exploreBias: 0 });
    expect(slots.length).toBeLessThanOrEqual(8);
    const tight = slots.filter(s => s.slot === 'tight');
    const keys = tight.map(s => `${s.k.geschlecht}|${s.k.alter?.[0]}`);
    const counts = keys.reduce((acc, k) => { acc[k] = (acc[k] || 0) + 1; return acc; }, {});
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Kategorie + Validate (Covered-Set)
// ---------------------------------------------------------------------------

describe('matchKategorie', () => {
  it('Persona-Name schlägt, "Nicht umsetzen" nie', () => {
    const k = kandidat();
    expect(matchKategorie(k, ['Lenas Welt', 'Reels'], [{ name: 'Lena' }])).toBe('Lenas Welt');
    expect(matchKategorie(k, ['Nicht umsetzen', 'Ohne Kategorie'], [{ name: 'Lena' }])).toBeNull();
  });

  it('Typ matcht UGC-Kategorien', () => {
    const k = kandidat();
    expect(matchKategorie(k, ['UGC Creator', 'Reels'], [])).toBe('UGC Creator');
    expect(matchKategorie(k, ['Reels', 'Stories'], [])).toBeNull();
  });
});

describe('validateVorschlaege', () => {
  const ctx = { shortlistIds: ['c1', 'c2'], slots: { c1: 'tight', c2: 'explore' }, personaIds: ['p1'] };

  it('nimmt nur Shortlist-IDs mit belegtem fit_grund', () => {
    const { vorschlaege, verworfen } = validateVorschlaege({
      vorschlaege: [
        { creator_id: 'c1', slot: 'tight', fit_grund: 'Beauty-Branche, 30k Follower', persona_ids: ['p1'] },
        { creator_id: 'fremd', slot: 'tight', fit_grund: 'Halluziniert' },
        { creator_id: 'c2', slot: 'explore', fit_grund: '   ' }
      ]
    }, ctx);
    expect(vorschlaege).toHaveLength(1);
    expect(vorschlaege[0].creator_id).toBe('c1');
    expect(verworfen).toHaveLength(2);
  });

  it('Covered-Set: Doppelte fliegen, fremde persona_ids werden gefiltert', () => {
    const { vorschlaege, verworfen } = validateVorschlaege({
      vorschlaege: [
        { creator_id: 'c1', slot: 'tight', fit_grund: 'Passt', persona_ids: ['p1', 'fremd'] },
        { creator_id: 'c1', slot: 'tight', fit_grund: 'Doppelt' },
        { creator_id: 'c2', slot: 'quatsch', fit_grund: 'Passt auch' }
      ]
    }, ctx);
    expect(vorschlaege).toHaveLength(2);
    expect(vorschlaege[0].persona_ids).toEqual(['p1']);
    expect(verworfen.some(v => v.grund === 'doppelter Vorschlag')).toBe(true);
    // Ungültiger Slot fällt auf den zugewiesenen zurück
    expect(vorschlaege.find(v => v.creator_id === 'c2').slot).toBe('explore');
  });
});
