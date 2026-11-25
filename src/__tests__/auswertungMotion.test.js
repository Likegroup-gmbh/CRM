// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gsap } from '../core/animation/gsap.js';
import { wechsleZeilen } from '../modules/auswertung/auswertungMotion.js';

/** Spult alle laufenden Timelines ans Ende (inkl. onComplete). */
const finish = () => gsap.globalTimeline.getChildren(false).forEach((t) => t.progress(1));
const animating = (el) => gsap.getTweensOf(el).some((t) => t.duration() > 0);

const zeilen = (...ids) => ids.map(id => `<tr data-flip-id="${id}"><td>${id}</td></tr>`).join('');
const ids = (tbody) => [...tbody.children].map(el => el.dataset.flipId);
const zeile = (tbody, id) => tbody.querySelector(`[data-flip-id="${id}"]`);

function mountTabelle(...start) {
  document.body.innerHTML = `<div class="auswertung-tabelle"><table><tbody>${zeilen(...start)}</tbody></table></div>`;
  const huelle = document.querySelector('.auswertung-tabelle');
  const tbody = document.querySelector('tbody');
  // jsdom kennt kein Layout: 40 px je Zeile
  Object.defineProperty(huelle, 'offsetHeight', { configurable: true, get: () => tbody.children.length * 40 });
  return { huelle, tbody };
}

beforeEach(() => {
  window.matchMedia = () => ({ matches: false });
  gsap.ticker.remove(gsap.updateRoot);
});

afterEach(() => {
  gsap.globalTimeline.clear();
  gsap.ticker.add(gsap.updateRoot);
  document.body.innerHTML = '';
  delete window.matchMedia;
});

describe('Zeilen wechseln', () => {
  it('wegfallende Zeilen blenden erst aus, danach steht der neue Inhalt', () => {
    const { tbody } = mountTabelle('a', 'b', 'c');
    const danach = vi.fn();
    wechsleZeilen(tbody, zeilen('a', 'c'), { danach });

    expect(ids(tbody)).toEqual(['a', 'b', 'c']);
    expect(animating(zeile(tbody, 'b'))).toBe(true);
    expect(zeile(tbody, 'b').style.pointerEvents).toBe('none');
    expect(danach).not.toHaveBeenCalled();

    finish();
    expect(ids(tbody)).toEqual(['a', 'c']);
    expect(danach).toHaveBeenCalledTimes(1);
    finish();
    expect(zeile(tbody, 'a').style.transform).toBe('');
    expect(zeile(tbody, 'a').style.opacity).toBe('');
  });

  it('ohne wegfallende Zeilen tauscht er sofort, neue blenden ein', () => {
    const { tbody } = mountTabelle('a');
    const danach = vi.fn();
    wechsleZeilen(tbody, zeilen('a', 'b'), { danach });

    expect(ids(tbody)).toEqual(['a', 'b']);
    expect(danach).toHaveBeenCalledTimes(1);
    expect(animating(zeile(tbody, 'b'))).toBe(true);
    finish();
    expect(zeile(tbody, 'b').style.opacity).toBe('');
  });

  it('ein zweiter Wechsel während des Ausblendens gewinnt', () => {
    const { tbody } = mountTabelle('a', 'b', 'c');
    const erster = vi.fn();
    const zweiter = vi.fn();
    wechsleZeilen(tbody, zeilen('a'), { danach: erster });
    wechsleZeilen(tbody, zeilen('a', 'b'), { danach: zweiter });

    finish();
    finish();
    expect(ids(tbody)).toEqual(['a', 'b']);
    expect(erster).not.toHaveBeenCalled();
    expect(zweiter).toHaveBeenCalledTimes(1);
  });

  it('die Hülle gleitet von der alten auf die neue Höhe und ist danach wieder frei', () => {
    const { huelle, tbody } = mountTabelle('a', 'b', 'c');
    wechsleZeilen(tbody, zeilen('a'), { huelle });
    finish();

    expect(huelle.style.height).toBe('120px');
    expect(huelle.style.overflowY).toBe('hidden');
    finish();
    expect(huelle.style.height).toBe('');
    expect(huelle.style.overflowY).toBe('');
  });

  it('reduzierte Bewegung: sofort getauscht, ohne Tween', () => {
    window.matchMedia = () => ({ matches: true });
    const { huelle, tbody } = mountTabelle('a', 'b');
    const danach = vi.fn();
    wechsleZeilen(tbody, zeilen('b'), { huelle, danach });

    expect(ids(tbody)).toEqual(['b']);
    expect(danach).toHaveBeenCalledTimes(1);
    expect(animating(zeile(tbody, 'b'))).toBe(false);
    expect(huelle.style.height).toBe('');
  });

  it('tauscht die Gruppen einer table, das thead bleibt samt Fokus stehen', () => {
    const gruppen = (...ids) => ids.map(id => `<tbody data-flip-id="${id}"><tr><td>${id}</td></tr></tbody>`).join('');
    document.body.innerHTML = `<table><thead><tr><th tabindex="0">Aufrufe</th></tr></thead>${gruppen('a', 'b', 'c')}</table>`;
    const table = document.querySelector('table');
    const thead = table.querySelector('thead');
    const kopf = thead.querySelector('th');
    kopf.focus();

    wechsleZeilen(table, gruppen('c', 'a'));
    finish();
    finish();

    expect(table.firstElementChild).toBe(thead);
    expect([...table.querySelectorAll('tbody')].map(el => el.dataset.flipId)).toEqual(['c', 'a']);
    expect(document.activeElement).toBe(kopf);
  });

  it('eine abgehängte Tabelle tauscht nach dem Ausblenden nicht mehr', () => {
    const { tbody } = mountTabelle('a', 'b');
    const danach = vi.fn();
    wechsleZeilen(tbody, zeilen('a'), { danach });
    document.body.innerHTML = '';

    finish();
    expect(ids(tbody)).toEqual(['a', 'b']);
    expect(danach).not.toHaveBeenCalled();
  });
});
