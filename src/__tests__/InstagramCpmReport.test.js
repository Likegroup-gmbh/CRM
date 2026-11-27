import { describe, it, expect } from 'vitest';
import {
  computeInstagramCpm,
  CPM_RATE,
  MIN_AGE_HOURS,
  OUTLIER_RATIO,
  CALC_VERSION
} from '../../netlify/functions/_shared/instagram-cpm.js';
import { formatCpmDebug, formatCpmReport } from '../../netlify/functions/_shared/instagram-cpm-report.js';
import {
  NOW, AUSREISSER_12, NACHRUECKER, video, videoSeries, videosAus, bimodal
} from './instagramCpmTestKit.js';

describe('formatCpmDebug', () => {
  it('baut skipped/included/summary fuer die Konsole', () => {
    const stats = computeInstagramCpm([
      video(1, 500000),
      ...videoSeries(12, 10000, 5)
    ], { now: NOW });

    const debug = formatCpmDebug('demo_user', stats, { source: 'meta' });

    expect(debug.username).toBe('demo_user');
    expect(debug.source).toBe('meta');
    expect(debug.rules.MIN_AGE_HOURS).toBe(MIN_AGE_HOURS);
    expect(debug.rules.CALC_VERSION).toBe(CALC_VERSION);
    expect(debug.rules.OUTLIER_RATIO).toBe(OUTLIER_RATIO);
    expect(debug.rules.AD_HASHTAGS).toContain('werbung');
    expect(debug.skipped).toHaveLength(1);
    expect(debug.skipped[0].views).toBe(500000);
    expect(debug.included_12).toHaveLength(12);
    // Nur 12 organische Reels -> kein 30er-Fenster
    expect(debug.included_30).toEqual([]);
    expect(debug.summary.views_12).toBe(10000);
    expect(debug.summary.formula).toContain(String(CPM_RATE));
  });

  it('weist die aussortierten Werbe-Reels in summary aus und zeigt den Marker', () => {
    const stats = computeInstagramCpm([
      video(5, 900000, { caption: '#werbung' }),
      ...videoSeries(12, 50000, 6)
    ], { now: NOW });

    const debug = formatCpmDebug('demo_user', stats, { source: 'meta' });

    expect(debug.summary.skipped_ads).toBe(1);
    expect(debug.skipped[0].reason).toBe('ad_post');
    expect(debug.skipped[0].ad_marker).toBe('#werbung');
  });

  it('führt die erkannten Ausreißer je Fenster auf', () => {
    const stats = computeInstagramCpm(videosAus(AUSREISSER_12), { now: NOW });

    const debug = formatCpmDebug('demo_user', stats, { source: 'meta' });

    expect(debug.outliers.window_12).toHaveLength(1);
    expect(debug.outliers.window_30).toEqual([]);
  });

  it('zeigt in included_12 das aufgefüllte Fenster ohne den Ausreißer', () => {
    const stats = computeInstagramCpm(videosAus([...AUSREISSER_12, NACHRUECKER]), { now: NOW });

    const debug = formatCpmDebug('demo_user', stats, { source: 'meta' });
    const ausreisserPermalink = debug.outliers.window_12[0].permalink;

    expect(debug.included_12).toHaveLength(12);
    expect(debug.included_12.map((v) => v.permalink)).not.toContain(ausreisserPermalink);
    // Der Nachruecker ist stattdessen dabei
    expect(debug.included_12.map((v) => v.views)).toContain(NACHRUECKER);
  });

  it('laesst included_30 leer, wenn kein 30er-Fenster zustande kommt', () => {
    const stats = computeInstagramCpm(videoSeries(12, 50000), { now: NOW });

    const debug = formatCpmDebug('demo_user', stats, { source: 'meta' });

    expect(debug.included_12).toHaveLength(12);
    expect(debug.included_30).toEqual([]);
  });

  it('loest Nachruecker jenseits von Index 30 in included_30 auf', () => {
    const stats = computeInstagramCpm(
      [video(5, 1000000), ...videoSeries(30, 50000, 6)],
      { now: NOW }
    );

    const debug = formatCpmDebug('demo_user', stats, { source: 'meta' });

    expect(debug.included_30).toHaveLength(30);
    expect(debug.included_30.every((v) => v.views === 50000)).toBe(true);
  });

  it('faellt fuer alte Pool-Eintraege ohne used_* auf die permalink-Logik zurueck', () => {
    const stats = computeInstagramCpm(videosAus([...AUSREISSER_12, NACHRUECKER]), { now: NOW });
    // Pool-Spiegel aus einer Zeit vor used_12 / used_30
    delete stats.used_12;
    delete stats.used_30;

    const debug = formatCpmDebug('demo_user', stats, { source: 'pool' });
    const ausreisserPermalink = debug.outliers.window_12[0].permalink;

    // Ohne used_12 kein Nachruecker, aber der Ausreisser bleibt draussen
    expect(debug.included_12).toHaveLength(11);
    expect(debug.included_12.map((v) => v.permalink)).not.toContain(ausreisserPermalink);
  });
});

describe('formatCpmReport', () => {
  it('zeigt Gate, Verdicts und duale Summary bei aktivem Filter', () => {
    const stats = computeInstagramCpm(bimodal(), { now: NOW });
    const report = formatCpmReport('demo_user', stats, {
      source: 'test', follower: 2100000, media_total: 17, now: NOW
    });

    expect(report).toContain('@demo_user');
    expect(report).toContain(`calc_v${CALC_VERSION}`);
    expect(report).toContain('GATE   reg_median=502,5K >= 50.000');
    expect(report).toContain('boden_median=3,0K < 5% reg_median');
    expect(report).toContain('AKTIV, Schwelle=25,1K');
    expect(report).toContain('TRIAL_VIEWS (3,0K < 25,1K = 5% von 502,5K)');
    expect(report).toContain('SUMMARY  A mit Trials:   views_12=292,9K');
    expect(report).toContain('B ohne Trials:  views_12=501,0K');
  });

  it('zeigt bei inaktivem Gate nur Variante A', () => {
    const stats = computeInstagramCpm(videoSeries(10, 3000), { now: NOW });
    const report = formatCpmReport('kleiner_account', stats, { now: NOW });

    expect(report).toContain('GATE   INAKTIV');
    expect(report).toContain('B = A');
    expect(report).not.toContain('B ohne Trials:');
  });
});
