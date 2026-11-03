import { describe, it, expect } from 'vitest';
import { leistungsbereichForAuftrag } from '../core/budget/leistungsbereich.js';
import {
  spanGruppeForBereich,
  verkaufsstand,
  offenesCreatorBudget,
  agenturPrognose,
} from '../core/budget/agenturPrognose.js';

function gruppe(blocks, auftrag = {}) {
  return spanGruppeForBereich(leistungsbereichForAuftrag(auftrag, blocks));
}

describe('spanGruppeForBereich', () => {
  it('folgt dem exklusiven Leistungsbereich der Seite', () => {
    expect(gruppe([{ campaign_type: 'influencer' }])).toBe('influencer');
    expect(gruppe([{ campaign_type: 'story' }])).toBe('influencer');
    expect(gruppe([{ campaign_type: 'ugc_paid' }])).toBe('ugc');
    expect(gruppe([{ campaign_type: 'ugc_organic' }])).toBe('ugc');
    expect(gruppe([
      { campaign_type: 'ugc_paid' },
      { campaign_type: 'ugc_organic' },
    ])).toBe('gemischt');
    expect(gruppe([
      { campaign_type: 'influencer' },
      { campaign_type: 'vorort_produktion' },
    ])).toBe('gemischt');
    expect(gruppe([{ campaign_type: 'vorort_produktion' }])).toBe('sonst');
    expect(gruppe([{ campaign_type: 'whitelisting' }])).toBe('sonst');
    expect(gruppe([])).toBe('sonst');
    expect(gruppe([], { auftragtype: 'Contracting' })).toBe('sonst');
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
  it('rechnet jede Gruppe mit ihrer eigenen Spanne und summiert die drei Teile', () => {
    const prognose = agenturPrognose({
      erkannt: 70,
      feeBisEnde: 30,
      beitraege: [
        { gruppe: 'influencer', offen: 1000, vkVoll: 100, marge: 4 },
        { gruppe: 'ugc', offen: 1000, vkVoll: 100, marge: 59 },
        { gruppe: 'gemischt', offen: 1000, vkVoll: 100, marge: 32 },
      ],
    });
    expect(prognose.ausOffenemBudget).toBeCloseTo(40 + 590 + 320, 5);
    expect(prognose.summe).toBeCloseTo(70 + 30 + 950, 5);
  });

  it('nimmt bei einer Gruppe ohne Preise die Spanne des ganzen Filters', () => {
    const prognose = agenturPrognose({
      erkannt: 0,
      feeBisEnde: 0,
      beitraege: [
        { gruppe: 'influencer', offen: 200, vkVoll: 0, marge: 0 },
        { gruppe: 'ugc', offen: 0, vkVoll: 100, marge: 50 },
      ],
    });
    expect(prognose.ausOffenemBudget).toBeCloseTo(100, 5);
  });

  it('lässt die dritte Zeile auf 0, wenn nirgends beide Preise stehen', () => {
    const prognose = agenturPrognose({
      erkannt: 10,
      feeBisEnde: 5,
      beitraege: [
        { gruppe: 'influencer', offen: 200, vkVoll: 0, marge: 0 },
      ],
    });
    expect(prognose.ausOffenemBudget).toBe(0);
    expect(prognose.summe).toBe(15);
  });

  it('übernimmt eine negative Spanne', () => {
    const prognose = agenturPrognose({
      erkannt: 100,
      feeBisEnde: 0,
      beitraege: [
        { gruppe: 'sonst', offen: 100, vkVoll: 100, marge: -10 },
      ],
    });
    expect(prognose.ausOffenemBudget).toBeCloseTo(-10, 5);
    expect(prognose.summe).toBeCloseTo(90, 5);
  });
});
