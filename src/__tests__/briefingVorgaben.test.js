import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  briefingVideoLaenge, briefingVorgaben
} from '../modules/skripte/briefingVorgaben.js';

describe('briefingVorgaben', () => {
  it('liefert keine Funnel-Stufe mehr: die kommt aus dem Konzept', () => {
    const vorgaben = briefingVorgaben({
      bereich: 'paid_creator_ads',
      pa_funnel_stufen: ['upper'],
      videolaenge_von: 8,
      videolaenge_bis: 17
    });
    expect(vorgaben).toEqual({ video_laenge: '8-17' });
    expect('funnel_stufe' in vorgaben).toBe(false);
  });
});

describe('SkripteService Briefing-Selects', () => {
  // Fehlt videolaenge_funnel in einem Select, greift still der allgemeine Wert.
  it('laden beide videolaenge_funnel mit', () => {
    const quelle = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../modules/skripte/SkripteService.js'),
      'utf8'
    );
    const selects = quelle.split('\n').filter(zeile => zeile.includes('videolaenge_von, videolaenge_bis'));
    expect(selects.length).toBe(2);
    for (const zeile of selects) expect(zeile).toContain('videolaenge_funnel');
  });
});

describe('briefingVideoLaenge je Funnel-Stufe', () => {
  const paid = {
    bereich: 'paid_creator_ads',
    videolaenge_von: 15,
    videolaenge_bis: 20,
    videolaenge_funnel: { upper: { von: 6, bis: 10 }, lower: { von: 30, bis: 45 } }
  };

  it('liefert den Schlüssel der Stufe', () => {
    expect(briefingVideoLaenge(paid, 'upper')).toBe('6-10');
    expect(briefingVideoLaenge(paid, 'lower')).toBe('30-45');
    expect(briefingVorgaben(paid, 'upper')).toEqual({ video_laenge: '6-10' });
  });

  it('fällt ohne Stufe oder ohne Intervall der Stufe auf das allgemeine zurück', () => {
    expect(briefingVideoLaenge(paid)).toBe('15-20');
    expect(briefingVideoLaenge(paid, 'mid')).toBe('15-20');
  });

  it('Organic ignoriert die Map', () => {
    expect(briefingVideoLaenge({ ...paid, bereich: 'owned_social' }, 'upper')).toBe('15-20');
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
