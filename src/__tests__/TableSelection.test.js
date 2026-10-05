import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TableSelection } from '../core/list/TableSelection.js';
import { ListScope } from '../core/list/ListScope.js';

const CHECK = 'row-check';
const ALL = 'select-all-rows';

function checks() {
  return Array.from(document.querySelectorAll(`.${CHECK}`));
}

describe('TableSelection', () => {
  let selection;
  let config;

  beforeEach(() => {
    document.body.innerHTML = `
      <button id="btn-select-all"></button>
      <button id="btn-deselect-all" style="display:none"></button>
      <button id="btn-delete-selected" style="display:none"></button>
      <span id="selected-count" style="display:none"></span>
      <table><thead><tr><th><input type="checkbox" id="${ALL}"></th></tr></thead>
      <tbody>
        <tr><td><input type="checkbox" class="${CHECK}" data-id="a"></td></tr>
        <tr><td><input type="checkbox" class="${CHECK}" data-id="b"></td></tr>
        <tr><td><input type="checkbox" class="${CHECK}" data-id="c"></td></tr>
        <tr><td><input type="checkbox" class="${CHECK}"></td></tr>
      </tbody></table>
    `;
    config = { checkboxClass: CHECK, selectAllId: ALL };
    selection = new TableSelection({ scope: new ListScope(() => null), getConfig: () => config });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('startet mit leerem Set', () => {
    expect(selection.items).toBeInstanceOf(Set);
    expect(selection.items.size).toBe(0);
  });

  it('verwendet ein übergebenes Set (Identität bleibt)', () => {
    const items = new Set(['x']);
    const s = new TableSelection({ scope: new ListScope(() => null), getConfig: () => config, items });
    expect(s.items).toBe(items);
    s.clear();
    expect(s.items).toBe(items);
    expect(items.size).toBe(0);
  });

  describe('toggle', () => {
    it('fügt hinzu und entfernt', () => {
      selection.toggle('a', true);
      selection.toggle('b', true);
      selection.toggle('a', false);
      expect(Array.from(selection.items)).toEqual(['b']);
    });

    it('ignoriert fehlende IDs', () => {
      selection.toggle(undefined, true);
      selection.toggle('', true);
      expect(selection.items.size).toBe(0);
    });

    it('aktualisiert die UI nicht von selbst', () => {
      selection.toggle('a', true);
      expect(document.getElementById('selected-count').style.display).toBe('none');
    });
  });

  describe('setAllVisible', () => {
    it('setzt alle Checkboxen und wählt nur die mit ID', () => {
      selection.setAllVisible(true);
      expect(checks().every(cb => cb.checked)).toBe(true);
      expect(Array.from(selection.items).sort()).toEqual(['a', 'b', 'c']);

      selection.setAllVisible(false);
      expect(checks().every(cb => !cb.checked)).toBe(true);
      expect(selection.items.size).toBe(0);
    });

    it('lässt Auswahl nicht sichtbarer IDs unberührt beim Abwählen', () => {
      selection.items.add('versteckt');
      selection.setAllVisible(true);
      selection.setAllVisible(false);
      expect(Array.from(selection.items)).toEqual(['versteckt']);
    });
  });

  describe('selectAllVisible', () => {
    it('wählt alle und setzt den Header auf checked', () => {
      const header = document.getElementById(ALL);
      header.indeterminate = true;
      selection.selectAllVisible();

      expect(Array.from(selection.items).sort()).toEqual(['a', 'b', 'c']);
      expect(header.checked).toBe(true);
      expect(header.indeterminate).toBe(false);
    });

    it('funktioniert ohne Header', () => {
      document.getElementById(ALL).remove();
      expect(() => selection.selectAllVisible()).not.toThrow();
      expect(selection.items.size).toBe(3);
    });
  });

  describe('clear', () => {
    it('leert Set, Checkboxen und Header', () => {
      selection.selectAllVisible();
      selection.clear();

      expect(selection.items.size).toBe(0);
      expect(checks().every(cb => !cb.checked)).toBe(true);
      const header = document.getElementById(ALL);
      expect(header.checked).toBe(false);
      expect(header.indeterminate).toBe(false);
    });
  });

  describe('syncSelectAll', () => {
    it('keine Auswahl: weder checked noch indeterminate', () => {
      selection.syncSelectAll();
      const header = document.getElementById(ALL);
      expect(header.checked).toBe(false);
      expect(header.indeterminate).toBe(false);
    });

    it('teilweise Auswahl: indeterminate', () => {
      checks()[0].checked = true;
      selection.syncSelectAll();
      const header = document.getElementById(ALL);
      expect(header.checked).toBe(false);
      expect(header.indeterminate).toBe(true);
    });

    it('vollständige Auswahl: checked', () => {
      checks().forEach(cb => { cb.checked = true; });
      selection.syncSelectAll();
      const header = document.getElementById(ALL);
      expect(header.checked).toBe(true);
      expect(header.indeterminate).toBe(false);
    });

    it('ohne Checkboxen oder Header: no-op', () => {
      document.querySelector('tbody').innerHTML = '';
      const header = document.getElementById(ALL);
      header.checked = true;
      selection.syncSelectAll();
      expect(header.checked).toBe(true);

      document.getElementById(ALL).remove();
      expect(() => selection.syncSelectAll()).not.toThrow();
    });
  });

  describe('renderSummary', () => {
    it('leere Auswahl', () => {
      selection.renderSummary();
      expect(document.getElementById('selected-count').textContent).toBe('0 ausgewählt');
      expect(document.getElementById('selected-count').style.display).toBe('none');
      expect(document.getElementById('btn-select-all').style.display).toBe('inline-block');
      expect(document.getElementById('btn-deselect-all').style.display).toBe('none');
      expect(document.getElementById('btn-delete-selected').style.display).toBe('none');
    });

    it('mit Auswahl', () => {
      selection.toggle('a', true);
      selection.toggle('b', true);
      selection.renderSummary();
      expect(document.getElementById('selected-count').textContent).toBe('2 ausgewählt');
      expect(document.getElementById('selected-count').style.display).toBe('inline');
      expect(document.getElementById('btn-select-all').style.display).toBe('none');
      expect(document.getElementById('btn-deselect-all').style.display).toBe('inline-block');
      expect(document.getElementById('btn-delete-selected').style.display).toBe('inline-block');
    });

    it('fehlende Elemente sind kein Fehler', () => {
      document.body.innerHTML = '';
      expect(() => selection.renderSummary()).not.toThrow();
    });
  });

  it('liest die Selektoren lazy aus getConfig', () => {
    config.checkboxClass = 'andere-klasse';
    selection.selectAllVisible();
    expect(selection.items.size).toBe(0);
  });

  it('respektiert das Scope-Root', () => {
    document.body.insertAdjacentHTML('beforeend', `<div id="root"><input type="checkbox" class="${CHECK}" data-id="inner"></div>`);
    const root = document.getElementById('root');
    const scoped = new TableSelection({ scope: new ListScope(() => root), getConfig: () => config });
    scoped.selectAllVisible();
    expect(Array.from(scoped.items)).toEqual(['inner']);
  });
});
