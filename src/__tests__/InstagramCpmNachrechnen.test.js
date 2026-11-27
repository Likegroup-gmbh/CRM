import { describe, it, expect } from 'vitest';
import { computeInstagramCpm } from '../../netlify/functions/_shared/instagram-cpm.js';
import {
  fensterAusStats,
  aufKurzesFenster
} from '../../netlify/functions/_shared/instagram-cpm-nachrechnen.js';
import {
  NOW, AUSREISSER_12, NACHRUECKER, video, videoSeries, videosAus, bimodal, carodaur
} from './instagramCpmTestKit.js';

const KURZ = ['views_12', 'cpm_12', 'sample_12', 'used_12', 'outliers_12'];
const ACHTER = ['views_8', 'cpm_8', 'sample_8', 'used_8', 'outliers_8'];

const ohneAchter = (obj) => obj && Object.fromEntries(
  Object.entries(obj).filter(([key]) => !ACHTER.includes(key))
);

/** Stand vor ADR 0084: 12er-Schluessel fehlen, 8er stehen noch drin (wie aus jsonb gelesen) */
function alterStand(stats) {
  const alt = JSON.parse(JSON.stringify(stats));
  for (const key of KURZ) delete alt[key];
  Object.assign(alt, { sample_8: 8, used_8: [0, 1], outliers_8: [] });
  if (alt.ohne_trials) {
    for (const key of KURZ) delete alt.ohne_trials[key];
    Object.assign(alt.ohne_trials, { views_8: 1, cpm_8: 0.03, sample_8: 8, used_8: [], outliers_8: [] });
  }
  return alt;
}

const FAELLE = {
  'Ausreisser mit Nachruecker': () => videosAus([...AUSREISSER_12, 2000, NACHRUECKER]),
  'Ausreisser im 30er-Fenster': () => [video(5, 1000000), ...videoSeries(30, 50000, 6)],
  'Trials (bimodal)': bimodal,
  'Trials mit Zwischenstufen (carodaur)': carodaur,
  'zu wenige Reels': () => videoSeries(11, 50000)
};

describe('Nachrechnen des 12er-Fensters aus gespeicherten Videos', () => {
  for (const [name, media] of Object.entries(FAELLE)) {
    it(`trifft den frischen Abruf: ${name}`, () => {
      const frisch = JSON.parse(JSON.stringify(computeInstagramCpm(media(), { now: NOW })));
      const ergebnis = aufKurzesFenster(alterStand(frisch));

      expect(ergebnis.views).toBe(frisch.views_12);
      expect(ergebnis.cpm).toBe(frisch.cpm_12);
      for (const key of ['sample_12', 'used_12', 'outliers_12']) {
        expect(ergebnis.stats[key], key).toEqual(frisch[key]);
      }
      expect(ohneAchter(ergebnis.stats.ohne_trials)).toEqual(frisch.ohne_trials);
    });
  }

  it('laesst 8er-Schluessel, 30er-Werte und Version stehen', () => {
    const frisch = computeInstagramCpm(bimodal(), { now: NOW });
    const alt = { ...alterStand(frisch), calc_version: 9 };

    const { stats } = aufKurzesFenster(alt);

    expect(stats).toMatchObject({ sample_8: 8, used_8: [0, 1], outliers_8: [] });
    expect(stats.ohne_trials).toMatchObject({ views_8: 1, cpm_8: 0.03, sample_8: 8 });
    expect(stats.calc_version).toBe(9);
    expect(stats.used_30).toEqual(frisch.used_30);
    expect(stats.ohne_trials.views_30).toBe(frisch.ohne_trials.views_30);
    expect(stats.videos).toEqual(alt.videos);
  });

  it('rechnet ohne aktives Gate keine Variante B dazu', () => {
    const stats = alterStand(computeInstagramCpm(videoSeries(12, 40000), { now: NOW }));

    expect(fensterAusStats(stats, 12).ohne_trials).toBeNull();
    expect(aufKurzesFenster(stats).stats.ohne_trials).toBeNull();
  });

  it('liefert null fuer Statistiken ohne gespeicherte Videos', () => {
    expect(aufKurzesFenster({ calc_version: 2 })).toBeNull();
    expect(aufKurzesFenster(null)).toBeNull();
    expect(fensterAusStats({}, 12)).toBeNull();
  });
});
