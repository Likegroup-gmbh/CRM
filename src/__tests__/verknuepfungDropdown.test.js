import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderVerknuepfungen } from '../core/ui/tableVerknuepfungen.js';
import { schliesseVerknuepfungDropdown, verknuepfungChipLabel } from '../core/ui/verknuepfungDropdown.js';

const produkte = [
  { id: 'p1', label: 'GaN 2x USB-C', kind: 'produkt' },
  { id: 'p2', label: 'GaN Mini', kind: 'produkt' },
  { id: 'p3', label: 'Qi2 <25W>', kind: 'produkt' }
];

function zelle(html) {
  document.body.innerHTML = `<table><tbody><tr><td>${html}</td></tr></tbody></table>`;
  return document.querySelector('td');
}

const chip = () => document.querySelector('.verknuepfung-chip');
const popover = () => document.querySelector('.verknuepfung-popover');

beforeEach(() => {
  window.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {} });
  window.navigateTo = vi.fn();
});

afterEach(() => {
  schliesseVerknuepfungDropdown({ sofort: true });
  document.body.innerHTML = '';
});

describe('Chip ab zwei Verknüpfungen', () => {
  it('eine Verknüpfung bleibt die Pill ohne Chip', () => {
    const html = renderVerknuepfungen(produkte.slice(0, 1));
    expect(html).toContain('href="/produkt/p1"');
    expect(html).not.toContain('verknuepfung-chip');
  });

  it('ab zwei zeigt der Chip Anzahl und Plural, die Pills liegen versteckt', () => {
    const td = zelle(renderVerknuepfungen(produkte));
    expect(chip().textContent).toBe('3 Produkte');
    expect(chip().getAttribute('aria-expanded')).toBe('false');
    expect(chip().dataset.table).toBeUndefined();
    const menu = td.querySelector('.verknuepfung-menu');
    expect(menu.hidden).toBe(true);
    expect(menu.querySelectorAll('a.table-link--rel')).toHaveLength(3);
  });

  it('ungültige Items zählen nicht mit', () => {
    const html = renderVerknuepfungen([produkte[0], { id: 'x' }, { label: 'ohne id' }]);
    expect(html).not.toContain('verknuepfung-chip');
  });

  it('gemischte Kinds heißen Verknüpfungen, label ersetzt den Plural', () => {
    expect(verknuepfungChipLabel(['produkt', 'briefing'], 2)).toBe('2 Verknüpfungen');
    expect(verknuepfungChipLabel(['unbekannt', 'unbekannt'], 2)).toBe('2 Verknüpfungen');
    expect(verknuepfungChipLabel(['vertrag'], 4)).toBe('4 Verträge');
    zelle(renderVerknuepfungen(produkte.slice(0, 2), { label: 'Linien' }));
    expect(chip().textContent).toBe('2 Linien');
  });
});

describe('Popover', () => {
  it('Klick öffnet am body mit allen Links, zweiter Klick schließt', () => {
    zelle(renderVerknuepfungen(produkte));
    chip().click();
    expect(popover().parentElement).toBe(document.body);
    expect([...popover().querySelectorAll('a')].map((a) => a.getAttribute('href')))
      .toEqual(['/produkt/p1', '/produkt/p2', '/produkt/p3']);
    expect(chip().getAttribute('aria-expanded')).toBe('true');

    chip().click();
    expect(popover()).toBeNull();
    expect(chip().getAttribute('aria-expanded')).toBe('false');
  });

  it('Esc und Außenklick schließen, Klick im Popover nicht', () => {
    zelle(renderVerknuepfungen(produkte));
    chip().click();
    popover().click();
    expect(popover()).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(popover()).toBeNull();
    expect(document.activeElement).toBe(chip());

    chip().click();
    document.querySelector('table').click();
    expect(popover()).toBeNull();
  });

  it('nur ein Popover gleichzeitig', () => {
    document.body.innerHTML = renderVerknuepfungen(produkte) + renderVerknuepfungen(produkte);
    const [erster, zweiter] = document.querySelectorAll('.verknuepfung-chip');
    erster.click();
    zweiter.click();
    expect(document.querySelectorAll('.verknuepfung-popover')).toHaveLength(1);
    expect(erster.getAttribute('aria-expanded')).toBe('false');
    expect(zweiter.getAttribute('aria-expanded')).toBe('true');
  });

  it('Pill im Popover navigiert, schließt und bleibt escaped', () => {
    zelle(renderVerknuepfungen(produkte));
    chip().click();
    expect(popover().innerHTML).toContain('Qi2 &lt;25W&gt;');
    popover().querySelector('a[href="/produkt/p2"]').click();
    expect(window.navigateTo).toHaveBeenCalledWith('/produkt/p2');
    expect(popover()).toBeNull();
  });

  it('Scroll außerhalb schließt, Scroll im Popover nicht', () => {
    zelle(renderVerknuepfungen(produkte));
    chip().click();
    popover().dispatchEvent(new Event('scroll'));
    expect(popover()).not.toBeNull();
    document.querySelector('table').dispatchEvent(new Event('scroll'));
    expect(popover()).toBeNull();
  });
});
