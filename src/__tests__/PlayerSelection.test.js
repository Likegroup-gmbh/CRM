import { describe, it, expect } from 'vitest';
import {
  storyVersions, storyFinalVariants, storyAssetFor, defaultStorySelection
} from '../core/media/player/selection/story.js';
import { prefersFinal } from '../core/media/player/selection/intent.js';
import { resolveItemMedia } from '../core/media/player/resolveItemMedia.js';
import { VideoAssetLoader } from '../core/media/player/VideoAssetLoader.js';

describe('selection/story – reine Funktionen', () => {
  const loopA = { id: 'a', version_number: 1, created_at: '2026-01-01' };
  const loopB = { id: 'b', version_number: 2, created_at: '2026-01-02' };
  const fin1 = { id: 'f1', is_final: true, created_at: '2026-01-03' };
  const fin2 = { id: 'f2', is_final: true, created_at: '2026-01-04' };

  it('storyVersions: existingVersions > versions > aus Assets (ohne finale)', () => {
    expect(storyVersions({ existingVersions: [3], versions: [1], assets: [] })).toEqual([3]);
    expect(storyVersions({ versions: [1, 2], assets: [] })).toEqual([1, 2]);
    expect(storyVersions({ assets: [loopB, loopA, fin1] })).toEqual([1, 2]);
  });

  it('storyFinalVariants filtert is_final', () => {
    expect(storyFinalVariants({ assets: [loopA, fin1, fin2] }).map(a => a.id)).toEqual(['f1', 'f2']);
  });

  it('storyAssetFor: Version -> Loop-Asset, final -> gewaehlte bzw. erste Variante', () => {
    const slot = { assets: [loopA, loopB, fin1, fin2] };
    expect(storyAssetFor(slot, 2)?.id).toBe('b');
    expect(storyAssetFor(slot, 'final')?.id).toBe('f1');
    expect(storyAssetFor(slot, 'final', 'f2')?.id).toBe('f2');
    expect(storyAssetFor({ assets: [loopA] }, 'final')).toBeNull();
  });

  it('defaultStorySelection: hoechste Version, sonst Finale, sonst 1', () => {
    expect(defaultStorySelection({ assets: [loopA, loopB, fin1] })).toEqual({ version: 2, finalAssetId: null });
    expect(defaultStorySelection({ assets: [fin1, fin2] })).toEqual({ version: 'final', finalAssetId: 'f1' });
    expect(defaultStorySelection({ assets: [] })).toEqual({ version: 1, finalAssetId: null });
  });
});

describe('selection/intent.prefersFinal', () => {
  it('nur fuer Kunden-Rolle', () => {
    expect(prefersFinal({ isKundeRole: () => true })).toBe(true);
    expect(prefersFinal({ isKundeRole: () => false })).toBe(false);
    expect(prefersFinal({})).toBe(false);
    expect(prefersFinal(null)).toBe(false);
  });
});

describe('resolveItemMedia', () => {
  it('Video ohne gewaehltes Asset: Legacy-Felder fuer Lookup, currentAsset fuer Key', () => {
    const item = { type: 'video', video: { id: 'v', link_content: 'L', currentAsset: { id: 'c', created_at: 't', file_path: '/p' } } };
    const m = resolveItemMedia(item, {});
    expect(m.asset).toBeNull();
    expect(m.lookup).toEqual({ file_path: '/p', file_url: 'L' });
    expect(m.key).toBe('video:c:t');
  });

  it('Video mit Asset: Lookup/Key aus dem Asset', () => {
    const asset = { id: 'a', created_at: 't', file_path: '/a.mp4', file_url: 'U' };
    const m = resolveItemMedia({ type: 'video', video: { id: 'v' } }, { videoAsset: asset });
    expect(m.lookup).toEqual({ file_path: '/a.mp4', file_url: 'U' });
    expect(m.key).toBe('video:a:t');
    expect(m.asset).toBe(asset);
  });

  it('Story ohne Asset: leerer Lookup, kein Key', () => {
    const m = resolveItemMedia({ type: 'story', slot: { slot_name: 'S' } }, { storyAsset: null });
    expect(m.lookup).toEqual({ file_path: null, file_url: null });
    expect(m.key).toBeNull();
    expect(m.label).toBe('S');
  });

  it('Bild: gewaehltes Still hat Vorrang, sonst item.image', () => {
    const image = { id: 'i', created_at: 'c', file_url: 'IU' };
    const still = { id: 's', created_at: 'd', file_url: 'SU' };
    expect(resolveItemMedia({ type: 'bild', image }, { stillAsset: still }).key).toBe('bild:s:d');
    expect(resolveItemMedia({ type: 'bild', image }, {}).key).toBe('bild:i:c');
  });
});

describe('VideoAssetLoader.invalidate', () => {
  it('verwirft den Cache-Eintrag eines Videos', () => {
    const loader = new VideoAssetLoader();
    loader._cache.set('v1', [{ id: 'a' }]);
    expect(loader.has('v1')).toBe(true);
    loader.invalidate('v1');
    expect(loader.has('v1')).toBe(false);
  });
});
