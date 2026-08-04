import { describe, it, expect } from 'vitest';
import { parseSocialLink, formatLinkLabel } from '../core/format/socialLink.js';

describe('parseSocialLink', () => {
  it('liest Reel-Links inklusive Query-Parametern', () => {
    expect(parseSocialLink('https://www.instagram.com/reel/DABC123/?igsh=xyz')).toEqual({
      platform: 'instagram',
      type: 'reel',
      shortcode: 'DABC123',
      host: 'instagram.com'
    });
  });

  it('versteht die Plural-Variante /reels/', () => {
    const result = parseSocialLink('https://instagram.com/reels/DEF-456_x');
    expect(result.type).toBe('reel');
    expect(result.shortcode).toBe('DEF-456_x');
  });

  it('erkennt Posts und IGTV', () => {
    expect(parseSocialLink('https://www.instagram.com/p/CXY789/').type).toBe('post');
    expect(parseSocialLink('https://www.instagram.com/tv/CTV111/').type).toBe('tv');
  });

  it('kommt mit Profil-Permalinks klar (Segment vor der Beitragsart)', () => {
    const result = parseSocialLink('https://www.instagram.com/paulinemary/reel/DGHI999/');
    expect(result.type).toBe('reel');
    expect(result.shortcode).toBe('DGHI999');
  });

  it('liest TikTok-Videos', () => {
    expect(parseSocialLink('https://www.tiktok.com/@creator/video/7412345678901234567')).toEqual({
      platform: 'tiktok',
      type: 'video',
      shortcode: '7412345678901234567',
      host: 'tiktok.com'
    });
  });

  it('liefert bei Instagram-Links ohne Beitragspfad wenigstens die Plattform', () => {
    const result = parseSocialLink('https://www.instagram.com/paulinemary/');
    expect(result.platform).toBe('instagram');
    expect(result.type).toBeNull();
    expect(result.shortcode).toBeNull();
  });

  it('gibt bei Fremd-URLs nur den Host zurueck', () => {
    expect(parseSocialLink('https://youtube.com/watch?v=abc')).toEqual({
      platform: null,
      type: null,
      shortcode: null,
      host: 'youtube.com'
    });
  });

  it('liefert fuer leere und ungueltige Eingaben leere Felder', () => {
    const empty = { platform: null, type: null, shortcode: null, host: null };
    expect(parseSocialLink('')).toEqual(empty);
    expect(parseSocialLink(null)).toEqual(empty);
    expect(parseSocialLink(undefined)).toEqual(empty);
    expect(parseSocialLink('kein Link')).toEqual(empty);
  });
});

describe('formatLinkLabel', () => {
  it('kombiniert Beitragsart und Handle', () => {
    const url = 'https://www.instagram.com/reel/DABC123/';
    expect(formatLinkLabel(url, 'paulinemary')).toBe('Reel · @paulinemary');
  });

  it('ignoriert ein fuehrendes @ im Handle', () => {
    const url = 'https://www.instagram.com/reel/DABC123/';
    expect(formatLinkLabel(url, '@paulinemary')).toBe('Reel · @paulinemary');
  });

  it('faellt ohne Handle auf den Shortcode zurueck', () => {
    expect(formatLinkLabel('https://www.instagram.com/p/CXY789/', '')).toBe('Post · CXY789');
  });

  it('nutzt bei unbekanntem Pfad den Host', () => {
    expect(formatLinkLabel('https://www.instagram.com/paulinemary/', '')).toBe('instagram.com');
    expect(formatLinkLabel('https://youtube.com/watch?v=abc', 'x')).toBe('youtube.com · @x');
  });

  it('liefert fuer leere Links einen leeren String', () => {
    expect(formatLinkLabel('', 'paulinemary')).toBe('');
    expect(formatLinkLabel(null, null)).toBe('');
  });

  it('gibt nicht parsebare Eingaben unveraendert zurueck', () => {
    expect(formatLinkLabel('nur text', '')).toBe('nur text');
  });
});
