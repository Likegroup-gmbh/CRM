import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  animateNumber,
  cancelAnimateNumber,
  parseDisplayedValue,
  easeOutExpo
} from '../core/animation/animateNumber.js';

// rAF-Stepper: Callbacks werden gesammelt und manuell mit Zeitstempel ausgefuehrt.
let rafCallbacks;
let rafIdCounter;
let currentTime;

function flushFrame() {
  const cbs = rafCallbacks;
  rafCallbacks = [];
  for (const { cb } of cbs) cb(currentTime);
}

beforeEach(() => {
  rafCallbacks = [];
  rafIdCounter = 1;
  currentTime = 0;
  vi.stubGlobal('requestAnimationFrame', (cb) => {
    const id = rafIdCounter++;
    rafCallbacks.push({ id, cb });
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id) => {
    rafCallbacks = rafCallbacks.filter(r => r.id !== id);
  });
  vi.spyOn(performance, 'now').mockImplementation(() => currentTime);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('parseDisplayedValue', () => {
  it('parst deutsches Waehrungsformat', () => {
    const el = document.createElement('div');
    el.textContent = '1.234,56 €';
    expect(parseDisplayedValue(el)).toBeCloseTo(1234.56);
  });

  it('parst Compact-Suffixe', () => {
    const el = document.createElement('div');
    el.textContent = '21,6K';
    expect(parseDisplayedValue(el)).toBeCloseTo(21600);
    el.textContent = '1,2M';
    expect(parseDisplayedValue(el)).toBeCloseTo(1200000);
  });

  it('parst zusammengesetzte Strings ("5 von 20" -> erste Zahl)', () => {
    const el = document.createElement('div');
    el.textContent = '5 von 20';
    expect(parseDisplayedValue(el)).toBe(5);
  });

  it('liefert NaN bei leerem/nicht parsbarem Inhalt', () => {
    const el = document.createElement('div');
    expect(parseDisplayedValue(el)).toBeNaN();
    el.textContent = 'keine Zahl';
    expect(parseDisplayedValue(el)).toBeNaN();
  });
});

describe('animateNumber', () => {
  it('setzt den Endwert nach Animationsende', () => {
    const el = document.createElement('div');
    el.textContent = '0';
    animateNumber(el, 100, { duration: 800 });
    currentTime = 800;
    flushFrame();
    expect(el.textContent).toBe('100');
  });

  it('schreibt Zwischenwerte waehrend der Animation', () => {
    const el = document.createElement('div');
    el.textContent = '0';
    animateNumber(el, 100, { duration: 800, format: (v) => v.toFixed(2) });
    currentTime = 400;
    flushFrame();
    const midway = parseFloat(el.textContent);
    // easeOutExpo(0.5) ~ 0.97 -> deutlich ueber der Haelfte
    expect(midway).toBeGreaterThan(50);
    expect(midway).toBeLessThan(100);
    currentTime = 800;
    flushFrame();
    expect(el.textContent).toBe('100.00');
  });

  it('ist no-op wenn Start- und Zielwert gleich sind (kein rAF)', () => {
    const el = document.createElement('div');
    el.textContent = '5';
    animateNumber(el, 5);
    expect(el.textContent).toBe('5');
    expect(rafCallbacks).toHaveLength(0);
  });

  it('startet bei erneutem Aufruf vom Zwischenwert (kein Sprung)', () => {
    const el = document.createElement('div');
    el.textContent = '0';
    animateNumber(el, 100, { duration: 800, format: (v) => v.toFixed(2) });
    currentTime = 400;
    flushFrame();
    const midway = parseFloat(el.textContent);

    animateNumber(el, 200, { duration: 800, format: (v) => v.toFixed(2) });
    currentTime = 800; // t=0.5 der zweiten Animation
    flushFrame();
    const secondMidway = parseFloat(el.textContent);
    expect(secondMidway).toBeGreaterThan(midway);
    expect(secondMidway).toBeLessThan(200);

    currentTime = 1600;
    flushFrame();
    expect(el.textContent).toBe('200.00');
  });

  it('cancelAnimateNumber stoppt eine laufende Animation', () => {
    const el = document.createElement('div');
    el.textContent = '0';
    animateNumber(el, 100, { duration: 800 });
    cancelAnimateNumber(el);
    currentTime = 800;
    flushFrame();
    expect(el.textContent).toBe('0');
  });

  it('respektiert prefers-reduced-motion (sofort setzen, kein rAF)', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    const el = document.createElement('div');
    el.textContent = '0';
    animateNumber(el, 42);
    expect(el.textContent).toBe('42');
    expect(rafCallbacks).toHaveLength(0);
    delete window.matchMedia;
  });

  it('ruft onComplete am Ende auf', () => {
    const el = document.createElement('div');
    el.textContent = '0';
    const onComplete = vi.fn();
    animateNumber(el, 10, { duration: 800, onComplete });
    expect(onComplete).not.toHaveBeenCalled();
    currentTime = 800;
    flushFrame();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('nutzt Custom-Format pro Frame', () => {
    const el = document.createElement('div');
    el.textContent = '0';
    animateNumber(el, 1234.5, {
      duration: 800,
      format: (v) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v)
    });
    currentTime = 800;
    flushFrame();
    // Intl de-DE nutzt ein geschuetztes Leerzeichen (U+00A0) vor dem €
    expect(el.textContent).toBe('1.234,50\u00A0€');
  });
});

describe('easeOutExpo', () => {
  it('hat korrekte Randwerte', () => {
    expect(easeOutExpo(0)).toBeCloseTo(0);
    expect(easeOutExpo(1)).toBe(1);
  });
});
