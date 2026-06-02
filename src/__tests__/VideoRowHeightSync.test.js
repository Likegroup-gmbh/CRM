import { describe, it, expect, beforeEach } from 'vitest';
import { VideoRowHeightSync } from '../modules/kampagne/VideoRowHeightSync.js';

// jsdom hat kein echtes Layout -> Hoehe/Sichtbarkeit pro Element stubben.
function makeWrapper(videoId, height, { visible = true } = {}) {
  const el = document.createElement('div');
  el.className = 'video-field-wrapper';
  el.dataset.videoId = videoId;
  el.getBoundingClientRect = () => ({ height, width: 100, top: 0, left: 0, right: 100, bottom: height });
  Object.defineProperty(el, 'offsetParent', { configurable: true, get: () => (visible ? el.parentNode : null) });
  return el;
}

function makeContainer(rows) {
  const container = document.createElement('div');
  rows.forEach(wrappers => {
    const row = document.createElement('div');
    row.className = 'kooperation-row';
    wrappers.forEach(w => row.appendChild(w));
    container.appendChild(row);
  });
  return container;
}

describe('VideoRowHeightSync – Hoehenangleich pro data-video-id', () => {
  let container;

  beforeEach(() => {
    container = null;
  });

  it('setzt min-height aller Wrapper einer Video-Gruppe auf die Gruppen-Maxhoehe', () => {
    // Spalte 1: v1=20, v2=20 | Spalte 2 (Feedback): v1=100, v2=30
    const c1v1 = makeWrapper('v1', 20);
    const c1v2 = makeWrapper('v2', 20);
    const c2v1 = makeWrapper('v1', 100);
    const c2v2 = makeWrapper('v2', 30);
    container = makeContainer([[c1v1, c1v2, c2v1, c2v2]]);

    new VideoRowHeightSync(container).sync();

    expect(c1v1.style.minHeight).toBe('100px');
    expect(c2v1.style.minHeight).toBe('100px');
    expect(c1v2.style.minHeight).toBe('30px');
    expect(c2v2.style.minHeight).toBe('30px');
  });

  it('ignoriert versteckte Wrapper (display:none -> offsetParent null)', () => {
    const visible = makeWrapper('v1', 40);
    const hidden = makeWrapper('v1', 999, { visible: false });
    container = makeContainer([[visible, hidden]]);

    new VideoRowHeightSync(container).sync();

    expect(visible.style.minHeight).toBe('40px');
    expect(hidden.style.minHeight).toBe('');
  });

  it('haelt Zeilen unabhaengig (keine Vermischung ueber Kooperationen hinweg)', () => {
    const r1 = makeWrapper('v1', 50);
    const r2 = makeWrapper('v1', 80);
    container = makeContainer([[r1], [r2]]);

    new VideoRowHeightSync(container).sync();

    expect(r1.style.minHeight).toBe('50px');
    expect(r2.style.minHeight).toBe('80px');
  });

  it('rundet Hoehen auf (Math.ceil) gegen Sub-Pixel-Luecken', () => {
    const a = makeWrapper('v1', 60.3);
    const b = makeWrapper('v1', 12);
    container = makeContainer([[a, b]]);

    new VideoRowHeightSync(container).sync();

    expect(a.style.minHeight).toBe('61px');
    expect(b.style.minHeight).toBe('61px');
  });

  it('sync ohne Zeilen wirft nicht', () => {
    container = makeContainer([]);
    expect(() => new VideoRowHeightSync(container).sync()).not.toThrow();
  });
});
