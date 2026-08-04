import { describe, it, expect } from 'vitest';
import { parseSocialLink, formatLinkLabel } from '../core/format/socialLink.js';

describe('parseSocialLink', () => {
  it('liest Reel-Links inklusive Query-Parametern', () => {
    expect(parseSocialLink('https://www.instagram.com/reel/DABC123/?igsh=xyz')).toEqual({
      platform: 'instagram',
      type: 'reel',
      shortcode: 'DABC123',
      handle: null,
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
      handle: null,
      host: 'tiktok.com'
    });
  });

  it('erkennt Instagram-Profile samt Handle', () => {
    expect(parseSocialLink('https://www.instagram.com/paulinemary/')).toEqual({
      platform: 'instagram',
      type: 'profile',
      shortcode: null,
      handle: 'paulinemary',
      host: 'instagram.com'
    });
  });

  it('erkennt Profile ohne Schraegstrich und mit Query', () => {
    expect(parseSocialLink('https://instagram.com/pauline.mary').handle).toBe('pauline.mary');
    expect(parseSocialLink('https://www.instagram.com/paulinemary?hl=de').handle).toBe('paulinemary');
    expect(parseSocialLink('https://www.instagram.com/paulinemary/?igsh=abc').handle).toBe('paulinemary');
  });

  it('erkennt TikTok-Profile', () => {
    const result = parseSocialLink('https://www.tiktok.com/@creator');
    expect(result.type).toBe('profile');
    expect(result.handle).toBe('creator');
  });

  it('haelt Beitrags-Muster vor dem Profil-Muster', () => {
    // /paulinemary/reel/CODE erfuellt beide Muster - das Reel muss gewinnen
    const result = parseSocialLink('https://www.instagram.com/paulinemary/reel/DGHI999/');
    expect(result.type).toBe('reel');
    expect(result.handle).toBeNull();
  });

  it('haelt Instagram-eigene Pfade fuer keine Profile', () => {
    ['explore', 'stories', 'direct', 'accounts', 'reels'].forEach((pfad) => {
      const result = parseSocialLink(`https://www.instagram.com/${pfad}/`);
      expect(result.type, pfad).toBeNull();
      expect(result.handle, pfad).toBeNull();
      expect(result.platform, pfad).toBe('instagram');
    });
  });

  it('behandelt Unterseiten eines Profils nicht als Profil', () => {
    const result = parseSocialLink('https://www.instagram.com/paulinemary/tagged/');
    expect(result.type).toBeNull();
    expect(result.handle).toBeNull();
    expect(result.platform).toBe('instagram');
  });

  it('gibt bei Fremd-URLs nur den Host zurueck', () => {
    expect(parseSocialLink('https://youtube.com/watch?v=abc')).toEqual({
      platform: null,
      type: null,
      shortcode: null,
      handle: null,
      host: 'youtube.com'
    });
  });

  it('liefert fuer leere und ungueltige Eingaben leere Felder', () => {
    const empty = { platform: null, type: null, shortcode: null, handle: null, host: null };
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

  it('zeigt Profil-Links als reinen Handle', () => {
    expect(formatLinkLabel('https://www.instagram.com/paulinemary/', '')).toBe('@paulinemary');
    expect(formatLinkLabel('https://www.tiktok.com/@creator', '')).toBe('@creator');
  });

  it('laesst den uebergebenen Handle vor dem aus der URL gehen', () => {
    expect(formatLinkLabel('https://www.instagram.com/altername/', 'neuname')).toBe('@neuname');
  });

  it('nutzt bei unbekanntem Pfad den Host', () => {
    expect(formatLinkLabel('https://www.instagram.com/explore/', '')).toBe('instagram.com');
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
