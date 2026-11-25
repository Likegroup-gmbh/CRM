import { describe, it, expect } from 'vitest';
import { computeInstagramCpm, toCpm } from '../../netlify/functions/_shared/instagram-cpm.js';
import { NOW, video, videoSeries, videosAus, bimodal, carodaur } from './instagramCpmTestKit.js';

describe('computeInstagramCpm – Trial-Lücke (View-Gap)', () => {
  it('erkennt den Boden-Cluster und rechnet dual: A mit Trials, B ohne', () => {
    const stats = computeInstagramCpm(bimodal(), { now: NOW });

    expect(stats.trial_gate.aktiv).toBe(true);
    expect(stats.trial_gate.cluster_size).toBe(5);
    expect(stats.trial_gate.reg_median).toBe(502500);
    // Schwelle = 5 % des regulaeren Medians
    expect(stats.trial_gate.schwelle).toBe(25125);
    expect(stats.trial_gate.gap_ratio).toBe(150);
    expect(stats.skipped_trial_views).toBe(5);

    // A bleibt das bisherige Verhalten: die Trials stecken im 12er-Fenster
    // (5 Trials mit 15K + 7 regulaere mit 3,5M = 3515000 / 12)
    expect(stats.views_12).toBe(292917);
    // B rechnet nur ueber die 12 regulären Reels
    expect(stats.ohne_trials).not.toBeNull();
    expect(stats.ohne_trials.views_12).toBe(501000);
    expect(stats.ohne_trials.sample_12).toBe(12);
    expect(stats.ohne_trials.cpm_12).toBe(toCpm(501000));
  });

  it('führt markierte Trials in skipped_videos, behält sie aber in videos', () => {
    const stats = computeInstagramCpm(bimodal(), { now: NOW });

    const markiert = stats.skipped_videos.filter((v) => v.reason === 'trial_views');
    expect(markiert).toHaveLength(5);
    expect(markiert[0].trial_detail.schwelle).toBe(25125);
    expect(markiert[0].trial_detail.reg_median).toBe(502500);
    // Variante A nutzt sie weiterhin
    expect(stats.videos_available).toBe(17);
  });

  it('bleibt bei einem unimodalen kleinen Account inaktiv (B = A)', () => {
    const stats = computeInstagramCpm(videoSeries(10, 3000), { now: NOW });

    expect(stats.trial_gate.aktiv).toBe(false);
    expect(stats.ohne_trials).toBeNull();
    expect(stats.skipped_trial_views).toBe(0);
  });

  it('lässt den echten 50K-Flop bei 600K-Median regulär (nur 3K-Cluster fällt)', () => {
    const media = videosAus([
      3000, 4000, 5000,   // Trial-Cluster
      50000,              // echter Flop, ueber der 5%-Schwelle von 30000
      ...Array(8).fill(600000)
    ], 5);
    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.trial_gate.aktiv).toBe(true);
    expect(stats.trial_gate.schwelle).toBe(30000);
    const trialViews = stats.skipped_videos
      .filter((v) => v.reason === 'trial_views')
      .map((v) => v.views);
    expect(trialViews.sort((a, b) => a - b)).toEqual([3000, 4000, 5000]);
    expect(trialViews).not.toContain(50000);
  });

  it('aktiviert das Gate nicht unter 3 Videos im Boden-Cluster', () => {
    const media = videosAus([3000, 4000, ...Array(8).fill(600000)], 5);
    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.trial_gate.aktiv).toBe(false);
    expect(stats.ohne_trials).toBeNull();
  });

  it('aktiviert das Gate nicht, wenn der reguläre Median unter 50K liegt', () => {
    // Luecke vorhanden (300 -> 4000 = 13x), aber der Account ist zu klein:
    // niedrige Views sind dort normaler Content
    const media = videosAus([200, 250, 300, ...Array(8).fill(4000)], 5);
    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.trial_gate.aktiv).toBe(false);
    expect(stats.trial_gate.grund).toContain('reg_median');
    expect(stats.ohne_trials).toBeNull();
  });

  it('bleibt inaktiv, wenn oben Viral-Hits statt Trials abweichen (Boden-Check)', () => {
    // 20 normale Reels (200K-1M) + 5 Viral-Hits (5M+): die 5x-Luecke nach
    // oben darf die normalen Reels nicht zu "Trials" machen - der Boden
    // (Median 535K) liegt weit ueber 5 % des Hit-Medians (300K)
    const media = videosAus([
      200000, 250000, 300000, 350000, 400000, 450000, 500000, 550000, 600000,
      650000, 700000, 750000, 800000, 850000, 900000, 950000, 1000000, 320000,
      420000, 520000,
      5000000, 5500000, 6000000, 7000000, 8000000
    ], 5);
    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.trial_gate.aktiv).toBe(false);
    expect(stats.trial_gate.grund).toContain('Boden');
    expect(stats.ohne_trials).toBeNull();
    expect(stats.skipped_trial_views).toBe(0);
  });

  it('markiert frische Videos nie als Trial (Altersregel läuft vorher)', () => {
    const media = [
      video(1, 3000), video(2, 3200), video(3, 2800),
      ...videoSeries(8, 500000, 5)
    ];
    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.skipped_too_recent).toBe(3);
    expect(stats.skipped_trial_views).toBe(0);
    expect(stats.trial_gate.aktiv).toBe(false);
    expect(stats.ohne_trials).toBeNull();
  });

  it('liefert ohne Gate kein B und unveränderte A-Werte', () => {
    const stats = computeInstagramCpm(videoSeries(30, 20000), { now: NOW });

    expect(stats.ohne_trials).toBeNull();
    expect(stats.views_12).toBe(20000);
    expect(stats.views_30).toBe(20000);
  });
});

describe('computeInstagramCpm – Trial-Lücke mit Zwischenstufen (carodaur)', () => {
  it('aktiviert das Gate trotz zerlegter Lücke und markiert nur den Boden', () => {
    const stats = computeInstagramCpm(carodaur(), { now: NOW });

    expect(stats.trial_gate.aktiv).toBe(true);
    // Split 11067 -> 90000 (8,13x): reg_median ueber die 38 Reels dahinter,
    // Boden-Median 3041 liegt weit unter 5 % davon
    expect(stats.trial_gate.cluster_size).toBe(26);
    expect(stats.trial_gate.boden_median).toBe(3041);
    expect(stats.trial_gate.reg_median).toBe(865000);
    expect(stats.trial_gate.schwelle).toBe(43250);
    expect(stats.trial_gate.gap_ratio).toBeCloseTo(8.13, 2);
    expect(stats.skipped_trial_views).toBe(26);

    // Die Mittelfeld-Stufen bleiben regulär - nur der Boden faellt
    const trialViews = stats.skipped_videos
      .filter((v) => v.reason === 'trial_views')
      .map((v) => v.views);
    expect(Math.max(...trialViews)).toBe(11067);
    expect(trialViews).not.toContain(90000);
    expect(trialViews).not.toContain(150000);
    expect(trialViews).not.toContain(300000);
  });

  it('lässt A unverändert und rechnet B über die 38 regulären Reels', () => {
    const stats = computeInstagramCpm(carodaur(), { now: NOW });

    // A (bisheriges Verhalten): die 12 neuesten sind alles Trials
    // (11067+9933+9716+9551+6932+6810+5813+5417+4131+3692+3669+3505) / 12
    expect(stats.views_12).toBe(6686);
    // 30er: 26 Trials + 90K/150K/300K/400K = 1049002 / 30
    expect(stats.views_30).toBe(34967);

    // B: 12er-Fenster = 90K bis 850K, die ersten 12 regulären Reels
    expect(stats.ohne_trials).not.toBeNull();
    expect(stats.ohne_trials.views_12).toBe(523379);
    expect(stats.ohne_trials.sample_30).toBe(30);
    expect(stats.ohne_trials.views_30).toBeGreaterThan(700000);
  });
});
