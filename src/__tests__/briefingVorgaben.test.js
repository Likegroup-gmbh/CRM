import { describe, it, expect } from 'vitest';
import {
  sekundenZuLaenge, briefingFunnelStufe, briefingVideoLaenge, parseVideolaengeText
} from '../modules/skripte/briefingVorgaben.js';

describe('sekundenZuLaenge', () => {
  it('mappt Grenzwerte in die 15er-Spannen', () => {
    expect(sekundenZuLaenge(1)).toBe('0-15');
    expect(sekundenZuLaenge(15)).toBe('0-15');
    expect(sekundenZuLaenge(16)).toBe('15-30');
    expect(sekundenZuLaenge(30)).toBe('15-30');
    expect(sekundenZuLaenge(60)).toBe('45-60');
    expect(sekundenZuLaenge(180)).toBe('165-180');
    expect(sekundenZuLaenge(200)).toBe('165-180');
  });

  it('liefert null bei ungueltigen Werten', () => {
    expect(sekundenZuLaenge(0)).toBe(null);
    expect(sekundenZuLaenge(-5)).toBe(null);
    expect(sekundenZuLaenge(NaN)).toBe(null);
  });
});

describe('parseVideolaengeText', () => {
  it('mappt Paid-Tokens', () => {
    expect(parseVideolaengeText('6s')).toBe('0-15');
    expect(parseVideolaengeText('15s')).toBe('0-15');
    expect(parseVideolaengeText('20s')).toBe('15-30');
    expect(parseVideolaengeText('30s')).toBe('15-30');
    expect(parseVideolaengeText('60s')).toBe('45-60');
  });

  it('nimmt bei Spannen die Obergrenze', () => {
    expect(parseVideolaengeText('30-60 Sek.')).toBe('45-60');
    expect(parseVideolaengeText('max. 45')).toBe('30-45');
  });

  it('liefert null bei individuell / agenturempfehlung / unparsebar', () => {
    expect(parseVideolaengeText('individuell')).toBe(null);
    expect(parseVideolaengeText('agenturempfehlung')).toBe(null);
    expect(parseVideolaengeText('so lang wie noetig')).toBe(null);
    expect(parseVideolaengeText('')).toBe(null);
    expect(parseVideolaengeText(null)).toBe(null);
  });
});

describe('briefingFunnelStufe', () => {
  it('nimmt den ersten Wert und mappt upper/mid/lower', () => {
    expect(briefingFunnelStufe({
      bereich: 'paid_creator_ads',
      pa_funnel_stufen: ['upper', 'mid']
    })).toBe('top');
    expect(briefingFunnelStufe({
      bereich: 'influencer_marketing',
      im_funnel_stufen: ['mid']
    })).toBe('mid');
    expect(briefingFunnelStufe({
      bereich: 'influencer_marketing',
      im_funnel_stufen: ['lower']
    })).toBe('bottom');
  });

  it('liefert null bei Owned Social oder leerem Feld', () => {
    expect(briefingFunnelStufe({ bereich: 'owned_social' })).toBe(null);
    expect(briefingFunnelStufe({
      bereich: 'paid_creator_ads',
      pa_funnel_stufen: []
    })).toBe(null);
    expect(briefingFunnelStufe(null)).toBe(null);
  });
});

describe('briefingVideoLaenge', () => {
  it('nimmt pa_videolaengen[0]', () => {
    expect(briefingVideoLaenge({
      bereich: 'paid_creator_ads',
      pa_videolaengen: ['30s', '60s']
    })).toBe('15-30');
  });

  it('parst IM/Owned-Freitext aus formatvorgaben', () => {
    expect(briefingVideoLaenge({
      bereich: 'influencer_marketing',
      im_formatvorgaben: { videolaenge: '30-60 Sek.' }
    })).toBe('45-60');
    expect(briefingVideoLaenge({
      bereich: 'owned_social',
      os_formatvorgaben: { videolaenge: 'max. 45' }
    })).toBe('30-45');
  });

  it('liefert null bei individuell / fehlendem Text', () => {
    expect(briefingVideoLaenge({
      bereich: 'paid_creator_ads',
      pa_videolaengen: ['individuell']
    })).toBe(null);
    expect(briefingVideoLaenge({
      bereich: 'influencer_marketing',
      im_formatvorgaben: { videolaenge: 'offen' }
    })).toBe(null);
  });
});
