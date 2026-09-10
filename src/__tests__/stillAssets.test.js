import { describe, it, expect } from 'vitest';
import {
  loopStills, finalStills, stillsForVideoCell, stillVersions, defaultStillSelection,
  pickLatestAsset, pickStillAsset
} from '../core/stills/stillAssets.js';

describe('stillAssets', () => {
  const images = [
    { id: 'a', video_id: 'v1', version_number: 1, is_final: false, is_current: false },
    { id: 'b', video_id: 'v1', version_number: 2, is_final: false, is_current: true },
    { id: 'c', video_id: 'v1', version_number: 1, is_final: true, variant_name: 'Still' },
    { id: 'd', video_id: null, version_number: 1, is_final: false },
  ];

  it('trennt Loop und Final', () => {
    expect(loopStills(images).map(a => a.id)).toEqual(['a', 'b', 'd']);
    expect(finalStills(images).map(a => a.id)).toEqual(['c']);
  });

  it('nimmt zugewiesene Stills fuer die Zelle, sonst Altbilder', () => {
    expect(stillsForVideoCell({ _bilder: images }, { id: 'v1' }).map(a => a.id)).toEqual(['a', 'b', 'c']);
    expect(stillsForVideoCell({ _bilder: images }, { id: 'v2' }).map(a => a.id)).toEqual(['d']);
  });

  it('wählt die höchste Feedbackschleife als Default', () => {
    const sel = defaultStillSelection(images);
    expect(sel.selectedVersion).toBe(2);
    expect(sel.selectedAssetId).toBe('b');
  });

  it('listet Loop-Versionen aufsteigend', () => {
    expect(stillVersions(images)).toEqual([1, 2]);
  });

  it('pickLatestAsset nimmt hoechste Version, dann neuestes created_at, is_current nur Tiebreak', () => {
    const allCurrent = [
      { id: 's1', version_number: 1, is_current: true, created_at: '2026-01-01' },
      { id: 's2', version_number: 1, is_current: true, created_at: '2026-01-03' },
      { id: 's3', version_number: 1, is_current: true, created_at: '2026-01-02' },
    ];
    expect(pickLatestAsset(allCurrent).id).toBe('s2');

    const noneCurrent = [
      { id: 'a', version_number: 1, is_current: false, created_at: '2026-02-01' },
      { id: 'b', version_number: 2, is_current: false, created_at: '2026-01-01' },
    ];
    expect(pickLatestAsset(noneCurrent).id).toBe('b');

    const tie = [
      { id: 'x', version_number: 2, is_current: false, created_at: '2026-01-01' },
      { id: 'y', version_number: 2, is_current: true, created_at: '2026-01-01' },
    ];
    expect(pickLatestAsset(tie).id).toBe('y');
    expect(pickLatestAsset([])).toBeNull();
  });

  it('pickStillAsset / defaultStillSelection ignorieren is_current-Drift', () => {
    const drifted = [
      { id: 'old', video_id: 'v1', version_number: 1, is_final: false, is_current: true, created_at: '2026-01-01' },
      { id: 'new', video_id: 'v1', version_number: 2, is_final: false, is_current: false, created_at: '2026-02-01' },
    ];
    expect(pickStillAsset(drifted, 2, null).id).toBe('new');
    expect(defaultStillSelection(drifted)).toEqual({ selectedVersion: 2, selectedAssetId: 'new' });
  });

  it('defaultStillSelection mit preferFinal nimmt das neueste Final', () => {
    const images = [
      { id: 'loop', video_id: 'v1', version_number: 2, is_final: false, created_at: '2026-03-01' },
      { id: 'f1', video_id: 'v1', version_number: 1, is_final: true, created_at: '2026-01-01' },
      { id: 'f2', video_id: 'v1', version_number: 1, is_final: true, created_at: '2026-02-01' },
    ];
    expect(defaultStillSelection(images, { preferFinal: true }))
      .toEqual({ selectedVersion: 'final', selectedAssetId: 'f2' });
  });
});
