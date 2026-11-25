// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getAriaSort,
  nextSort,
  renderSortHeaderCell,
  bindSortableHeaders,
  syncSortHeaders
} from '../core/list/sortableHeader.js';
import { ICON_DEFS } from '../core/icons/iconDefs.js';

const SORT = { field: 'name', ascending: true };

function mountThead(sort = SORT) {
  document.body.innerHTML = `<table><thead><tr>
    ${renderSortHeaderCell({ label: 'Name', field: 'name' }, sort)}
    ${renderSortHeaderCell({ label: 'Anzahl', field: 'anzahl', className: 'table-cell-center' }, sort)}
    ${renderSortHeaderCell({ label: 'Stadt' }, sort)}
  </tr></thead></table>`;
  return document.querySelector('thead');
}

describe('sortableHeader', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  describe('Icons', () => {
    it('legt beide runden Chevrons ohne eigene Stroke-Breite an', () => {
      ['arrow-chevron-down', 'arrow-chevron-up'].forEach(key => {
        expect(ICON_DEFS[key].viewBox).toBe('0 0 24 24');
        expect(ICON_DEFS[key].body).not.toContain('stroke-width');
      });
    });
  });

  describe('nextSort', () => {
    it('startet eine neue Spalte mit der Standardrichtung', () => {
      expect(nextSort(SORT, 'anzahl', () => false)).toEqual({ field: 'anzahl', ascending: false });
      expect(nextSort(SORT, 'anzahl', () => true)).toEqual({ field: 'anzahl', ascending: true });
    });

    it('kehrt die Richtung bei erneutem Klick um', () => {
      expect(nextSort(SORT, 'name')).toEqual({ field: 'name', ascending: false });
      expect(nextSort({ field: 'name', ascending: false }, 'name')).toEqual({ field: 'name', ascending: true });
    });
  });

  describe('getAriaSort', () => {
    it('liefert none, ascending oder descending', () => {
      expect(getAriaSort(SORT, 'anzahl')).toBe('none');
      expect(getAriaSort(SORT, 'name')).toBe('ascending');
      expect(getAriaSort({ field: 'name', ascending: false }, 'name')).toBe('descending');
    });
  });

  describe('renderSortHeaderCell', () => {
    it('zeigt auch ohne aktive Sortierung beide Chevrons', () => {
      const thead = mountThead();
      const th = thead.querySelector('th[data-sort="anzahl"]');
      expect(th.getAttribute('aria-sort')).toBe('none');
      expect(th.classList.contains('th-sortable')).toBe(true);
      expect(th.classList.contains('table-cell-center')).toBe(true);
      expect(th.querySelectorAll('.th-sort-icons svg')).toHaveLength(2);
      expect(th.querySelector('.th-sort-up use').getAttribute('href')).toBe('#crm-icon-arrow-chevron-up');
      expect(th.querySelector('.th-sort-down use').getAttribute('href')).toBe('#crm-icon-arrow-chevron-down');
    });

    it('rendert Spalten ohne field als normalen Kopf', () => {
      const th = mountThead().querySelectorAll('th')[2];
      expect(th.textContent.trim()).toBe('Stadt');
      expect(th.hasAttribute('data-sort')).toBe(false);
      expect(th.querySelector('svg')).toBeNull();
    });

    it('escaped das Label', () => {
      document.body.innerHTML = `<table><tr>${renderSortHeaderCell({ label: '<b>x</b>', field: 'a' }, SORT)}</tr></table>`;
      expect(document.querySelector('th b')).toBeNull();
    });
  });

  describe('bindSortableHeaders', () => {
    it('meldet Klick und Enter mit der naechsten Sortierung und ignoriert unsortierbare Koepfe', () => {
      const thead = mountThead();
      const controller = new AbortController();
      const onChange = vi.fn();
      bindSortableHeaders(thead, {
        signal: controller.signal,
        getSort: () => SORT,
        defaultAscending: () => false,
        onChange
      });

      thead.querySelector('th[data-sort="anzahl"]').click();
      expect(onChange).toHaveBeenLastCalledWith({ field: 'anzahl', ascending: false });

      thead.querySelector('th[data-sort="name"] .th-sort-label').click();
      expect(onChange).toHaveBeenLastCalledWith({ field: 'name', ascending: false });

      thead.querySelector('th[data-sort="anzahl"]')
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(onChange).toHaveBeenCalledTimes(3);

      thead.querySelectorAll('th')[2].click();
      expect(onChange).toHaveBeenCalledTimes(3);

      controller.abort();
      thead.querySelector('th[data-sort="anzahl"]').click();
      expect(onChange).toHaveBeenCalledTimes(3);
    });
  });

  describe('syncSortHeaders', () => {
    it('setzt aria-sort ohne die Koepfe neu zu rendern', () => {
      const thead = mountThead();
      const th = thead.querySelector('th[data-sort="anzahl"]');
      syncSortHeaders(thead, { field: 'anzahl', ascending: false });
      expect(thead.querySelector('th[data-sort="anzahl"]')).toBe(th);
      expect(th.getAttribute('aria-sort')).toBe('descending');
      expect(thead.querySelector('th[data-sort="name"]').getAttribute('aria-sort')).toBe('none');
    });
  });
});
