import { describe, it, expect, afterEach, vi } from 'vitest';
import { countTo, cancelCountTo, liveCountValue } from '../core/animation/countTo.js';

function mockReducedMotion(matches) {
  window.matchMedia = () => ({ matches });
}

function el(text = '') {
  const node = document.createElement('div');
  node.textContent = text;
  return node;
}

afterEach(() => {
  delete window.matchMedia;
});

describe('countTo', () => {
  it('setzt den Endwert am Ende des Tweens und ruft onComplete', () => {
    mockReducedMotion(false);
    const node = el('0');
    const onComplete = vi.fn();
    const tween = countTo(node, 100, { format: (v) => v.toFixed(2), onComplete });
    expect(tween).not.toBeNull();
    expect(node.textContent).toBe('0.00');
    tween.progress(1);
    expect(node.textContent).toBe('100.00');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(liveCountValue(node)).toBeUndefined();
  });

  it('startet beim angezeigten Wert (deutsches Format)', () => {
    mockReducedMotion(false);
    const node = el('1.234,50 €');
    const tween = countTo(node, 2000, { format: (v) => v.toFixed(2) });
    expect(node.textContent).toBe('1234.50');
    tween.progress(0.5);
    const mitte = liveCountValue(node);
    expect(mitte).toBeGreaterThan(1234.5);
    expect(mitte).toBeLessThan(2000);
  });

  it('startet ein neuer Aufruf beim laufenden Zwischenwert und bricht den alten ab', () => {
    mockReducedMotion(false);
    const node = el('0');
    const first = countTo(node, 100, { format: (v) => v.toFixed(2) });
    first.progress(0.5);
    const zwischen = liveCountValue(node);
    const second = countTo(node, 200, { format: (v) => v.toFixed(2) });
    // Gekillte Tweens haengen nicht mehr an der globalen Timeline, der Ticker treibt sie nicht weiter.
    expect(first.parent).toBeFalsy();
    expect(second.parent).toBeTruthy();
    expect(node.textContent).toBe(zwischen.toFixed(2));
    second.progress(1);
    expect(node.textContent).toBe('200.00');
  });

  it('nimmt einen expliziten Startwert', () => {
    mockReducedMotion(false);
    const node = el('999');
    countTo(node, 50, { from: 10 });
    expect(node.textContent).toBe('10');
  });

  it('setzt bei reduzierter Bewegung sofort ohne Tween', () => {
    mockReducedMotion(true);
    const node = el('0');
    const onComplete = vi.fn();
    expect(countTo(node, 42, { onComplete })).toBeNull();
    expect(node.textContent).toBe('42');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('setzt direkt, wenn Start und Ziel gleich sind', () => {
    mockReducedMotion(false);
    const node = el('42');
    expect(countTo(node, 42)).toBeNull();
    expect(node.textContent).toBe('42');
  });

  it('cancelCountTo stoppt den Tween ohne Endwert', () => {
    mockReducedMotion(false);
    const node = el('0');
    const tween = countTo(node, 100);
    cancelCountTo(node);
    expect(tween.parent).toBeFalsy();
    expect(liveCountValue(node)).toBeUndefined();
    expect(node.textContent).toBe('0');
  });
});
