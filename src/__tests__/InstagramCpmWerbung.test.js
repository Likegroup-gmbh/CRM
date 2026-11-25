import { describe, it, expect } from 'vitest';
import { computeInstagramCpm, istWerbePost } from '../../netlify/functions/_shared/instagram-cpm.js';
import { NOW, video, videoSeries } from './instagramCpmTestKit.js';

describe('istWerbePost', () => {
  it('erkennt die gängigen Werbe-Hashtags und gibt den Treffer zurück', () => {
    const faelle = [
      ['Neues Video #werbung', '#werbung'],
      ['#anzeige – mein Alltag', '#anzeige'],
      ['Schaut mal #ad', '#ad'],
      ['#sponsored by someone', '#sponsored'],
      ['#paidpartnership mit XY', '#paidpartnership'],
      ['#bezahltepartnerschaft', '#bezahltepartnerschaft'],
      ['Danke fürs #kooperation', '#kooperation'],
      ['#collab mit @marke', '#collab'],
      ['Link in Bio #affiliate', '#affiliate']
    ];
    for (const [caption, marker] of faelle) {
      expect(istWerbePost(caption), caption).toBe(marker);
    }
  });

  it('erkennt Werbe-Phrasen im Freitext und gibt die Phrase zurück', () => {
    const faelle = [
      ['Paid partnership with Nike', 'paid partnership'],
      ['Bezahlte Partnerschaft mit XY', 'bezahlte partnerschaft'],
      ['In Kooperation mit meinem Lieblingsladen', 'in kooperation mit'],
      ['Anzeige | Meine Routine', 'anzeige |'],
      ['Werbung | Neues Produkt', 'werbung |']
    ];
    for (const [caption, marker] of faelle) {
      expect(istWerbePost(caption), caption).toBe(marker);
    }
  });

  it('löst bei Hashtags nicht aus, die nur mit einem Marker anfangen', () => {
    for (const caption of [
      'Neue Schuhe #adidas', 'Tag 3 #adventskalender', '#adventure time',
      '#kooperationsanfrage bitte per Mail', '#advent'
    ]) {
      expect(istWerbePost(caption), caption).toBeNull();
    }
  });

  it('lässt organische Captions und leere Werte durch', () => {
    for (const caption of ['Schöner Tag am See', '', null, undefined]) {
      expect(istWerbePost(caption)).toBeNull();
    }
  });

  it('ignoriert Groß- und Kleinschreibung, gibt den Marker normalisiert zurück', () => {
    expect(istWerbePost('#WERBUNG')).toBe('#werbung');
    expect(istWerbePost('#Anzeige')).toBe('#anzeige');
  });
});

describe('computeInstagramCpm – Werbe-Reels', () => {
  it('sortiert Werbe-Reels als ad_post aus und zählt sie', () => {
    const media = [
      video(5, 900000, { caption: 'Neue Kollektion #werbung' }),
      ...videoSeries(12, 50000, 6)
    ];

    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.skipped_ads).toBe(1);
    const werbe = stats.skipped_videos.filter(v => v.reason === 'ad_post');
    expect(werbe).toHaveLength(1);
    expect(werbe[0].ad_marker).toBe('#werbung');
    expect(stats.videos_available).toBe(12);
    expect(stats.views_12).toBe(50000);
  });

  it('speichert den Werbe-Marker auch für Phrasen', () => {
    const stats = computeInstagramCpm([
      video(5, 800000, { caption: 'In Kooperation mit @marke' }),
      ...videoSeries(12, 30000, 6)
    ], { now: NOW });

    const werbe = stats.skipped_videos.find(v => v.reason === 'ad_post');
    expect(werbe.ad_marker).toBe('in kooperation mit');
  });

  it('setzt ad_marker bei zu frischen Reels auf null', () => {
    const stats = computeInstagramCpm([
      video(1, 700000),
      ...videoSeries(12, 30000, 6)
    ], { now: NOW });

    const frisch = stats.skipped_videos.find(v => v.reason === 'too_recent');
    expect(frisch.ad_marker).toBeNull();
  });

  it('lässt ein älteres Reel nachrücken, wenn ein Werbe-Reel wegfällt', () => {
    // Ohne den Filter waere das Fenster [900000, 11x 50000], mit ihm rueckt das
    // aelteste Reel mit 10000 Views nach
    const media = [
      video(5, 900000, { caption: 'Anzeige | Neue Kollektion' }),
      ...videoSeries(11, 50000, 6),
      video(40, 10000)
    ];

    const stats = computeInstagramCpm(media, { now: NOW });

    // Das 10000er-Reel ist nach dem Werbe-Filter im Fenster, faellt dort aber
    // als Ausreisser unten durch (50000 / 10000 = 5). Ersatz gibt es nicht mehr,
    // also bleibt das Fenster bei 11 Reels.
    expect(stats.outliers_12.map(o => o.views)).toEqual([10000]);
    expect(stats.sample_12).toBe(11);
    expect(stats.views_12).toBe(50000);
  });

  it('zählt Werbe-Reels getrennt von zu frischen Reels', () => {
    const media = [
      video(1, 700000),
      video(5, 800000, { caption: '#sponsored' }),
      ...videoSeries(12, 50000, 6)
    ];

    const stats = computeInstagramCpm(media, { now: NOW });

    expect(stats.skipped_too_recent).toBe(1);
    expect(stats.skipped_ads).toBe(1);
  });

  it('führt ein zu frisches Werbe-Reel als Werbung, nicht als zu frisch', () => {
    const stats = computeInstagramCpm(
      [video(1, 700000, { caption: '#werbung' })],
      { now: NOW }
    );

    expect(stats.skipped_ads).toBe(1);
    expect(stats.skipped_too_recent).toBe(0);
  });

  it('rechnet Reels ohne caption normal mit', () => {
    const stats = computeInstagramCpm(videoSeries(12, 50000), { now: NOW });

    expect(stats.skipped_ads).toBe(0);
    expect(stats.views_12).toBe(50000);
  });
});
