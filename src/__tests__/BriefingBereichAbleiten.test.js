import { describe, it, expect } from 'vitest';
import { leiteBereichAb, hatNutzung, nutzungAusBereich } from '../modules/briefing/create/bereichAbleiten.js';

describe('leiteBereichAb', () => {
  it('ein Häkchen bestimmt den Typ', () => {
    expect(leiteBereichAb({ nutzung_markenkanal: true })).toBe('owned_social');
    expect(leiteBereichAb({ nutzung_paid_media: true })).toBe('paid_creator_ads');
    expect(leiteBereichAb({ nutzung_creator_kanal: true })).toBe('influencer_marketing');
  });

  it('mehrere Häkchen: Paid vor Influencer vor Owned', () => {
    expect(leiteBereichAb({ nutzung_markenkanal: true, nutzung_creator_kanal: true })).toBe('influencer_marketing');
    expect(leiteBereichAb({ nutzung_markenkanal: true, nutzung_paid_media: true, nutzung_creator_kanal: true })).toBe('paid_creator_ads');
  });

  it('der bisherige Typ bleibt, solange sein Häkchen gesetzt ist', () => {
    const alle = { nutzung_markenkanal: true, nutzung_paid_media: true, nutzung_creator_kanal: true };
    expect(leiteBereichAb(alle, 'owned_social')).toBe('owned_social');
    expect(leiteBereichAb({ nutzung_paid_media: true }, 'owned_social')).toBe('paid_creator_ads');
  });

  it('ohne Häkchen gilt der bisherige Typ, sonst Owned Media', () => {
    expect(leiteBereichAb({}, 'influencer_marketing')).toBe('influencer_marketing');
    expect(leiteBereichAb({})).toBe('owned_social');
    expect(leiteBereichAb({}, 'unbekannt')).toBe('owned_social');
  });
});

describe('hatNutzung / nutzungAusBereich', () => {
  it('erkennt gesetzte Häkchen', () => {
    expect(hatNutzung({})).toBe(false);
    expect(hatNutzung({ nutzung_paid_media: false })).toBe(false);
    expect(hatNutzung({ nutzung_paid_media: true })).toBe(true);
  });

  it('ältere Briefings bekommen das Häkchen ihres Typs, gesetzte bleiben unberührt', () => {
    expect(nutzungAusBereich({}, 'paid_creator_ads')).toEqual({ nutzung_paid_media: true });
    expect(nutzungAusBereich({ nutzung_markenkanal: true }, 'paid_creator_ads')).toEqual({});
    expect(nutzungAusBereich({}, 'x')).toEqual({});
  });
});
