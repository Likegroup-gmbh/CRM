import { describe, it, expect } from 'vitest';
import {
  typischeRange, rangeFuer, vorschlag, fenster, berechne, regelnAus, quantil, REGELN_STANDARD,
} from '../core/instagram/reelAuswahl.js';
import { rechenweg } from '../modules/admin/instagramCpmRender.js';

// Reels neueste zuerst, IDs r1, r2, ...
const reels = (views) => views.map((v, i) => ({ id: `r${i + 1}`, views: v, datum: null }));
// n Werte gleichmaessig zwischen von und bis
const spanne = (n, von, bis) => Array.from({ length: n }, (_, i) => Math.round(von + ((bis - von) * i) / (n - 1)));
const ohneNbsp = (s) => s.replace(/\u00a0/g, ' ');

describe('Instagram-CPM: typische Range und Ausreißer', () => {
  it('enge Creatorin 200K-300K: 700K und 1,2M fallen nach oben', () => {
    const liste = reels([700000, ...spanne(14, 200000, 300000), 1200000, ...spanne(14, 210000, 290000)]);
    const range = rangeFuer(liste);
    expect(range.median).toBeGreaterThan(230000);
    expect(range.median).toBeLessThan(270000);
    expect(range.oben).toBeLessThan(700000);
    const v = vorschlag(liste, range);
    expect([...v.entries()]).toEqual([['r1', 'hoch'], ['r16', 'hoch']]);
  });

  it('nach unten fällt nur der Extremfall, ein schwächeres Reel bleibt', () => {
    const liste = reels([...spanne(28, 250000, 350000), 120000, 5]);
    const v = vorschlag(liste, rangeFuer(liste));
    expect(v.get('r30')).toBe('flop');
    expect(v.has('r29')).toBe(false);
    expect(v.size).toBe(1);
  });

  it('breite Streuung: 700K bleibt, erst über Median × 5 fällt es', () => {
    const liste = reels([700000, 1500000, ...spanne(28, 100000, 400000)]);
    const range = rangeFuer(liste);
    const v = vorschlag(liste, range);
    expect(v.has('r1')).toBe(false);
    expect(v.get('r2')).toBe('hoch');
    expect(range.oben).toBeLessThanOrEqual(range.median * 5);
    expect(range.oben).toBeGreaterThan(700000);
  });

  it('Mindestfaktor: bei sehr gleichmäßigen Views fällt nichts unter Median × 2', () => {
    const liste = reels([...Array(29).fill(250000), 450000]);
    const range = rangeFuer(liste);
    expect(range.oben).toBe(500000);
    expect(vorschlag(liste, range).size).toBe(0);
  });

  it('Basis sind die 30 neuesten, ältere Nachrücker werden trotzdem geprüft', () => {
    const liste = reels([...spanne(30, 200000, 300000), 2000000, 260000]);
    const range = rangeFuer(liste);
    expect(range.n).toBe(30);
    expect(vorschlag(liste, range).get('r31')).toBe('hoch');
  });

  it('unter 5 Reels oder bei Median 0 keine Range', () => {
    expect(typischeRange([1, 2, 3, 4])).toBeNull();
    expect(typischeRange([0, 0, 0, 0, 0, 10])).toBeNull();
    expect(vorschlag(reels([1, 2]), null).size).toBe(0);
  });

  it('Regeln: kaputte Werte fallen auf den Standard zurück', () => {
    expect(regelnAus({ mindestFaktor: 3, tukeyK: 'x', floorProzent: -1 })).toEqual({ ...REGELN_STANDARD, mindestFaktor: 3 });
    expect(quantil([10, 20, 30, 40], 0.5)).toBe(25);
  });
});

describe('Instagram-CPM: Nachrücken und Rechnung', () => {
  it('abgewählte Reels ziehen das nächstältere nach', () => {
    const liste = reels(Array(35).fill(1000));
    const { kurz, lang } = fenster(liste, new Set(['r3']));
    expect(lang).toHaveLength(30);
    expect(lang).not.toContain('r3');
    expect(lang.at(-1)).toBe('r31');
    expect(kurz).toHaveLength(12);
    expect(kurz.at(-1)).toBe('r13');
  });

  it('rechnet nur mit der Auswahl und zeigt den Rechenweg', () => {
    const liste = reels([...Array(30).fill(250410), 9000000]);
    const { kurz, lang } = berechne(liste, new Set(), 25);
    expect(lang).toMatchObject({ anzahl: 30, vollstaendig: true, summe: 7512300, schnitt: 250410, preis: 6260.25 });
    expect(kurz).toMatchObject({ anzahl: 12, schnitt: 250410 });
    expect(ohneNbsp(rechenweg(lang))).toBe('7.512.300 / 30 = 250.410 Views → 250,41 × 25,00 € = 6.260,25 €');
  });

  it('zu wenige Reels: kleineres Fenster mit Hinweis statt Lücke', () => {
    const r = berechne(reels([100000, 200000, 300001]), new Set(), 25);
    expect(r.lang).toMatchObject({ anzahl: 3, vollstaendig: false, summe: 600001, schnitt: 200000, preis: 5000 });
    const leer = berechne(reels([100]), new Set(['r1']), 25);
    expect(leer.lang).toMatchObject({ anzahl: 0, schnitt: null, preis: null });
    expect(rechenweg(leer.lang)).toBe('Keine Reels ausgewählt.');
  });

  it('ohne gültigen TKP gilt der Standard von 25 €', () => {
    expect(berechne(reels([1000]), new Set(), 0).lang.tkp).toBe(25);
  });
});
