import { describe, it, expect } from 'vitest';
import {
  istBeendet,
  verkaufsstand,
  offenesCreatorBudget,
  agenturPrognose,
} from '../core/budget/agenturPrognose.js';

describe('istBeendet', () => {
  const heute = new Date(2026, 10, 4, 12);

  it('ist beendet erst nach dem Endtag', () => {
    expect(istBeendet('2026-11-03', heute)).toBe(true);
    expect(istBeendet('2026-11-04', heute)).toBe(false);
    expect(istBeendet('2026-12-31', heute)).toBe(false);
  });

  it('läuft ohne Ende weiter', () => {
    expect(istBeendet(null, heute)).toBe(false);
    expect(istBeendet('', heute)).toBe(false);
  });
});

describe('verkaufsstand', () => {
  it('zählt nur Zeilen mit EK und VK in die Spanne, jeden VK ins offene Budget', () => {
    const stand = verkaufsstand(
      [{ id: 'k1' }, { id: 'k2' }],
      [
        { kooperation_id: 'k1', einkaufspreis_netto: 40, verkaufspreis_netto: 100 },
        { kooperation_id: 'k2', einkaufspreis_netto: 0, verkaufspreis_netto: 25 },
      ]
    );
    expect(stand.vkAlle).toBe(125);
    expect(stand.vkVoll).toBe(100);
    expect(stand.marge).toBe(60);
  });
});

describe('offenesCreatorBudget', () => {
  it('bleibt 0, wenn der Verkauf das Budget überschreitet', () => {
    expect(offenesCreatorBudget(50, 80)).toBe(0);
    expect(offenesCreatorBudget(null, 0)).toBe(0);
    expect(offenesCreatorBudget(1000, 100)).toBe(900);
  });
});

describe('agenturPrognose', () => {
  it('rechnet jeden Auftrag mit seiner eigenen Spanne und summiert die drei Teile', () => {
    const prognose = agenturPrognose({
      erkannt: 70,
      feeBisEnde: 30,
      beitraege: [
        { offen: 1000, vkVoll: 100, marge: 58, beendet: false },
        { offen: 1000, vkVoll: 100, marge: 0, beendet: false },
      ],
    });
    expect(prognose.ausOffenemBudget).toBeCloseTo(580, 5);
    expect(prognose.summe).toBeCloseTo(70 + 30 + 580, 5);
  });

  it('trägt für einen Auftrag ohne bepreiste Zeilen nichts bei', () => {
    const prognose = agenturPrognose({
      erkannt: 10,
      feeBisEnde: 5,
      beitraege: [
        { offen: 120000, vkVoll: 0, marge: 0, beendet: false },
        { offen: 100, vkVoll: 100, marge: 50, beendet: false },
      ],
    });
    expect(prognose.ausOffenemBudget).toBeCloseTo(50, 5);
    expect(prognose.summe).toBeCloseTo(65, 5);
  });

  it('trägt für eine beendete Kampagne nichts bei, auch mit Spanne', () => {
    const prognose = agenturPrognose({
      beitraege: [{ offen: 1000, vkVoll: 100, marge: 40, beendet: true }],
    });
    expect(prognose.ausOffenemBudget).toBe(0);
  });

  it('übernimmt eine negative Spanne', () => {
    const prognose = agenturPrognose({
      erkannt: 100,
      feeBisEnde: 0,
      beitraege: [
        { offen: 100, vkVoll: 100, marge: -10, beendet: false },
      ],
    });
    expect(prognose.ausOffenemBudget).toBeCloseTo(-10, 5);
    expect(prognose.summe).toBeCloseTo(90, 5);
  });
});
