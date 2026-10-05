import { describe, it, expect } from 'vitest';
import {
  isRiskyFormat, videoFallbackUrl, lookupFor, lookupPath, cacheKeyFor, itemLabel
} from '../core/media/player/mediaIdentity.js';

describe('mediaIdentity.isRiskyFormat', () => {
  it('erkennt riskante Container (auch mit Query/Hash)', () => {
    expect(isRiskyFormat('/x/clip.mov')).toBe(true);
    expect(isRiskyFormat('https://d.com/a.MKV?dl=1')).toBe(true);
    expect(isRiskyFormat('https://d.com/a.avi#t=1')).toBe(true);
    expect(isRiskyFormat('/x/clip.m4v')).toBe(true);
  });

  it('laesst mp4/webm und leere Werte durch', () => {
    expect(isRiskyFormat('/x/clip.mp4')).toBe(false);
    expect(isRiskyFormat('/x/clip.webm')).toBe(false);
    expect(isRiskyFormat('')).toBe(false);
    expect(isRiskyFormat(null)).toBe(false);
    expect(isRiskyFormat(undefined)).toBe(false);
  });
});

describe('mediaIdentity.videoFallbackUrl / lookupFor / lookupPath', () => {
  it('nimmt file_url vor link_content vor asset_url', () => {
    expect(videoFallbackUrl({ file_url: 'a', link_content: 'b', asset_url: 'c' })).toBe('a');
    expect(videoFallbackUrl({ link_content: 'b', asset_url: 'c' })).toBe('b');
    expect(videoFallbackUrl({ asset_url: 'c' })).toBe('c');
    expect(videoFallbackUrl({})).toBeNull();
    expect(videoFallbackUrl(null)).toBeNull();
  });

  it('lookupFor normalisiert auf null und nutzt Fallback nur ohne file_url', () => {
    expect(lookupFor(null)).toEqual({ file_path: null, file_url: null });
    expect(lookupFor({ file_path: '/p' })).toEqual({ file_path: '/p', file_url: null });
    expect(lookupFor({ file_url: 'u' }, 'fb')).toEqual({ file_path: null, file_url: 'u' });
    expect(lookupFor({ file_path: '/p' }, 'fb')).toEqual({ file_path: '/p', file_url: 'fb' });
  });

  it('lookupPath bevorzugt file_path, sonst file_url, sonst leer', () => {
    expect(lookupPath({ file_path: '/p', file_url: 'u' })).toBe('/p');
    expect(lookupPath({ file_path: null, file_url: 'u' })).toBe('u');
    expect(lookupPath({ file_path: null, file_url: null })).toBe('');
    expect(lookupPath(null)).toBe('');
  });
});

describe('mediaIdentity.cacheKeyFor', () => {
  it('baut {typ}:{id}:{created_at}', () => {
    expect(cacheKeyFor('video', { id: 'a1', created_at: 't1' })).toBe('video:a1:t1');
    expect(cacheKeyFor('bild', { id: 'i1', created_at: 'c1' })).toBe('bild:i1:c1');
    expect(cacheKeyFor('video', { id: 'a1' })).toBe('video:a1:');
  });

  it('Story faellt auf file_size zurueck', () => {
    expect(cacheKeyFor('story', { id: 's1', created_at: 't' })).toBe('story:s1:t');
    expect(cacheKeyFor('story', { id: 's1', file_size: 42 })).toBe('story:s1:42');
  });

  it('liefert null ohne Asset-ID', () => {
    expect(cacheKeyFor('video', null)).toBeNull();
    expect(cacheKeyFor('video', {})).toBeNull();
    expect(cacheKeyFor('bild', { created_at: 'x' })).toBeNull();
  });
});

describe('mediaIdentity.itemLabel', () => {
  it('Video: video_name, dann thema, dann Fallback', () => {
    expect(itemLabel({ type: 'video', video: { video_name: 'N', thema: 'T' } })).toBe('N');
    expect(itemLabel({ type: 'video', video: { thema: 'T' } })).toBe('T');
    expect(itemLabel({ type: 'video', video: {} })).toBe('Video');
  });

  it('Story: slot_name, sonst "Story N", sonst "Story"', () => {
    expect(itemLabel({ type: 'story', slot: { slot_name: 'Intro' } })).toBe('Intro');
    expect(itemLabel({ type: 'story', slot: { slot_index: 2 } })).toBe('Story 2');
    expect(itemLabel({ type: 'story', slot: {} })).toBe('Story');
  });

  it('Bild: Label des gewaehlten Stills (Vorrang) bzw. des Item-Bilds', () => {
    const item = { type: 'bild', image: { variant_name: 'Item-Bild' } };
    expect(itemLabel(item)).toBe('Item-Bild');
    expect(itemLabel(item, { variant_name: 'Gewaehlt' })).toBe('Gewaehlt');
  });

  it('leeres Item -> "Medium"', () => {
    expect(itemLabel(null)).toBe('Medium');
  });
});
