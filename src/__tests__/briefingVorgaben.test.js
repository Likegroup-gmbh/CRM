import { describe, it, expect } from 'vitest';
import {
  briefingFunnelStufe, briefingVideoLaenge
} from '../modules/skripte/briefingVorgaben.js';

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
  it('nimmt das gespeicherte Intervall', () => {
    expect(briefingVideoLaenge({
      bereich: 'paid_creator_ads',
      videolaenge_von: 8,
      videolaenge_bis: 17,
      pa_videolaengen: ['30s', '60s']
    })).toBe('8-17');
  });

  it('spannt alte Tokens und Freitext, ohne 15er-Eimer', () => {
    expect(briefingVideoLaenge({
      bereich: 'paid_creator_ads',
      pa_videolaengen: ['30s', '60s']
    })).toBe('30-60');
    expect(briefingVideoLaenge({
      bereich: 'influencer_marketing',
      im_formatvorgaben: { videolaenge: '30-60 Sek.' }
    })).toBe('30-60');
    expect(briefingVideoLaenge({
      bereich: 'owned_social',
      os_formatvorgaben: { videolaenge: 'max. 45' }
    })).toBe('45-45');
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
