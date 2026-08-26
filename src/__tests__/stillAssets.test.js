import { describe, it, expect } from 'vitest';
import {
  loopStills, finalStills, stillsForVideoCell, stillVersions, defaultStillSelection
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
});
