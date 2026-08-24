import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  revealLines,
  cancelLineReveal,
  isRevealing
} from '../core/animation/lineReveal.js';

function fakeAnim() {
  return { finished: Promise.resolve(), cancel: vi.fn() };
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  HTMLElement.prototype.animate = vi.fn(() => fakeAnim());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('revealLines', () => {
  it('splittet Text in Zeilen-Spans (display:block), Absätze bleiben erhalten', async () => {
    const el = document.createElement('div');
    el.textContent = 'a\n\nb';

    await revealLines(el, { stagger: 0 });

    expect(el.children).toHaveLength(3);
    expect(el.children[0].style.display).toBe('block');
    expect(el.children[0].textContent).toBe('a');
    expect(el.children[1].textContent).toBe('\u00A0');
    expect(el.children[2].textContent).toBe('b');
  });

  it('revealed progressiv: nach stagger genau eine Zeile mehr', async () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    el.textContent = 'a\nb\nc';
    document.body.append(el);

    const done = revealLines(el, { stagger: 90, duration: 220 });
    expect(el.children.length).toBe(1);
    expect(el.children[0].textContent).toBe('a');
    expect(isRevealing(el)).toBe(true);

    await vi.advanceTimersByTimeAsync(89);
    expect(el.children.length).toBe(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(el.children.length).toBe(2);
    expect(el.children[1].textContent).toBe('b');

    await vi.advanceTimersByTimeAsync(90);
    expect(el.children.length).toBe(3);
    await done;
    expect(isRevealing(el)).toBe(false);
    el.remove();
  });

  it('deckelt stagger bei vielen Zeilen auf maxTotal', async () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    el.textContent = Array.from({ length: 10 }, (_, i) => `z${i}`).join('\n');
    document.body.append(el);

    revealLines(el, { stagger: 90, maxTotal: 500 });
    // delay = min(90, 500/10) = 50
    expect(el.children.length).toBe(1);

    await vi.advanceTimersByTimeAsync(49);
    expect(el.children.length).toBe(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(el.children.length).toBe(2);
    el.remove();
  });

  it('prefers-reduced-motion: sofort Volltext, kein animate()', async () => {
    window.matchMedia = vi.fn(() => ({ matches: true }));
    const el = document.createElement('div');
    el.textContent = 'a\nb';
    document.body.append(el);

    await revealLines(el, { stagger: 90 });

    expect(el.children.length).toBe(2);
    expect(HTMLElement.prototype.animate).not.toHaveBeenCalled();
    el.remove();
  });

  it('cancelLineReveal zeigt sofort alles, Timer gestoppt', async () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    el.textContent = 'a\nb\nc';
    document.body.append(el);
    const onDone = vi.fn();

    const done = revealLines(el, { stagger: 90, onDone });
    expect(el.children.length).toBe(1);

    cancelLineReveal(el);

    expect(el.children.length).toBe(3);
    expect(el.children[2].textContent).toBe('c');
    expect(isRevealing(el)).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
    await done;

    await vi.advanceTimersByTimeAsync(200);
    expect(el.children.length).toBe(3);
    el.remove();
  });

  it('onLine und onDone feuern in Reihenfolge', async () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    el.textContent = 'a\nb\nc';
    document.body.append(el);
    const onLine = vi.fn();
    const onDone = vi.fn();

    const done = revealLines(el, { stagger: 90, onLine, onDone });
    expect(onLine).toHaveBeenNthCalledWith(1, 0, 'a');
    expect(onDone).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(90);
    expect(onLine).toHaveBeenNthCalledWith(2, 1, 'b');

    await vi.advanceTimersByTimeAsync(90);
    await done;
    expect(onLine).toHaveBeenNthCalledWith(3, 2, 'c');
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onLine.mock.invocationCallOrder[2]).toBeLessThan(onDone.mock.invocationCallOrder[0]);
    el.remove();
  });

  it('Detach (el.remove) bricht still ab', async () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    el.textContent = 'a\nb\nc';
    document.body.append(el);
    const onDone = vi.fn();

    const done = revealLines(el, { stagger: 90, onDone });
    expect(el.children.length).toBe(1);

    el.remove();
    await vi.advanceTimersByTimeAsync(90);
    await done;

    expect(el.children.length).toBe(1);
    expect(isRevealing(el)).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('nimmt options.text wenn das Element leer ist', async () => {
    const el = document.createElement('div');
    el.textContent = '';

    await revealLines(el, { stagger: 0, text: 'a\nb' });

    expect(el.children).toHaveLength(2);
    expect(el.children[0].textContent).toBe('a');
    expect(el.children[1].textContent).toBe('b');
  });

  it('animiert neue Zeilen mit opacity und translateY', async () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    el.textContent = 'a\nb';
    document.body.append(el);

    revealLines(el, { stagger: 90, duration: 220 });

    expect(HTMLElement.prototype.animate).toHaveBeenCalled();
    const [keyframes, opts] = HTMLElement.prototype.animate.mock.calls[0];
    expect(keyframes[0]).toEqual({ opacity: 0, transform: 'translateY(4px)' });
    expect(keyframes[1]).toEqual({ opacity: 1, transform: 'translateY(0)' });
    expect(opts.duration).toBe(220);
    el.remove();
  });
});
