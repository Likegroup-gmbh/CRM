import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseMs,
  readMotion,
  slideHeight,
  cancelSlideHeight,
  isSliding
} from '../core/animation/slideHeight.js';

function fakeAnim(overrides = {}) {
  return {
    finished: Promise.resolve(),
    cancel: vi.fn(),
    ...overrides
  };
}

function mockBox(el, { offset = 80, scroll = 240 } = {}) {
  Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => offset });
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => scroll });
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('parseMs', () => {
  it('liest ms, s und nackte Zahlen', () => {
    expect(parseMs('320ms')).toBe(320);
    expect(parseMs('0.32s')).toBeCloseTo(320);
    expect(parseMs('480')).toBe(480);
    expect(parseMs('')).toBeNaN();
  });
});

describe('readMotion', () => {
  it('nimmt Dauer und Easing aus CSS-Tokens', () => {
    const el = document.createElement('div');
    el.style.setProperty('--motion-duration', '480ms');
    el.style.setProperty('--motion-ease-in-out', 'cubic-bezier(0.4, 0, 0.2, 1)');
    document.body.append(el);

    expect(readMotion(el)).toEqual({
      duration: 480,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    });
    el.remove();
  });
});

describe('slideHeight', () => {
  it('animiert height mit ease-in-out aus den Tokens', async () => {
    const el = document.createElement('div');
    el.style.setProperty('--motion-duration', '320ms');
    el.style.setProperty('--motion-ease-in-out', 'cubic-bezier(0.4, 0, 0.2, 1)');
    mockBox(el);
    const anim = fakeAnim();
    el.animate = vi.fn(() => anim);
    document.body.append(el);

    await slideHeight(el, { open: true });

    expect(el.animate).toHaveBeenCalledTimes(1);
    const [keyframes, opts] = el.animate.mock.calls[0];
    expect(keyframes[0].height).toBe('80px');
    expect(keyframes[1].height).toBe('240px');
    expect(opts.duration).toBe(320);
    expect(opts.easing).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
    expect(el.style.height).toBe('auto');
    el.remove();
  });

  it('snappt bei prefers-reduced-motion ohne animate()', async () => {
    window.matchMedia = vi.fn(() => ({ matches: true }));
    const el = document.createElement('div');
    mockBox(el);
    el.animate = vi.fn(() => fakeAnim());

    await slideHeight(el, { open: true });

    expect(el.animate).not.toHaveBeenCalled();
    expect(el.style.height).toBe('auto');
  });

  it('bricht die laufende Animation ab und startet neu', () => {
    const el = document.createElement('div');
    mockBox(el);
    const firstCancel = vi.fn();
    const first = fakeAnim({
      finished: new Promise(() => {}),
      cancel: firstCancel
    });
    const second = fakeAnim();
    el.animate = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);

    slideHeight(el, { open: true });
    expect(isSliding(el)).toBe(true);

    slideHeight(el, { open: false, collapsedPx: 50 });
    expect(firstCancel).toHaveBeenCalled();
  });

  it('cancelSlideHeight committet die aktuelle Hoehe', () => {
    const el = document.createElement('div');
    mockBox(el, { offset: 120, scroll: 240 });
    const cancel = vi.fn();
    el.animate = vi.fn(() => fakeAnim({
      finished: new Promise(() => {}),
      cancel
    }));

    slideHeight(el, { open: true });
    cancelSlideHeight(el);

    expect(cancel).toHaveBeenCalled();
    expect(isSliding(el)).toBe(false);
    expect(el.style.height).toBe('120px');
  });
});
