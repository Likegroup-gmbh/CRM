import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderCustomHeaders } from '../core/customColumns/EntityCustomColumnRenderer.js';
import {
  setColumnWidth,
  applySavedWidths,
  saveWidths,
  loadWidths,
  storageKey,
  bindColumnResize,
  normalizeStoredWidth
} from '../core/customColumns/EntityCustomColumnResize.js';

const COL_A = 'custom:aaa';
const COL_B = 'custom:bbb';

function memoryStorage() {
  const data = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    clear: () => { for (const key of Object.keys(data)) delete data[key]; }
  };
}

function installStorage() {
  const store = memoryStorage();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: store });
  return store;
}

function mouse(type, pageX, target) {
  const ev = new MouseEvent(type, { bubbles: true });
  Object.defineProperty(ev, 'pageX', { get: () => pageX });
  (target || document).dispatchEvent(ev);
  return ev;
}

function tableHtml() {
  return `
    <table class="creator-pool-table">
      <thead>
        <tr>
          <th class="cp-col-name">Name</th>
          <th class="entity-custom-col-header" data-custom-col-id="${COL_A}">
            Info
            <div class="resize-handle resize-handle-col" data-col="${COL_A}"></div>
          </th>
          <th class="entity-custom-col-header" data-custom-col-id="${COL_B}">
            Notiz
            <div class="resize-handle resize-handle-col" data-col="${COL_B}"></div>
          </th>
          <th class="cp-col-actions">Aktionen</th>
        </tr>
      </thead>
      <tbody>
        <tr class="kategorie-header-row">
          <td colspan="4">Kategorie</td>
        </tr>
        <tr class="item-row">
          <td class="cp-col-name">Max</td>
          <td class="entity-custom-cell" data-custom-col-id="${COL_A}">a</td>
          <td class="entity-custom-cell" data-custom-col-id="${COL_B}">b</td>
          <td class="cp-col-actions"></td>
        </tr>
      </tbody>
    </table>
  `;
}

describe('EntityCustomColumnRenderer Resize-Handle', () => {
  it('setzt den Resize-Griff nur in eigene Spalten-Header', () => {
    const html = renderCustomHeaders(
      [{ id: 'aaa', name: 'Info', field_type: 'text', visible_for_kunden: true }],
      [],
      false
    );
    const doc = new DOMParser().parseFromString(`<table><tr>${html}</tr></table>`, 'text/html');
    const th = doc.querySelector('th.entity-custom-col-header');
    const handle = th.querySelector('.resize-handle-col');

    expect(handle).not.toBeNull();
    expect(handle.dataset.col).toBe('custom:aaa');
    expect(th.dataset.customColId).toBe('custom:aaa');
  });

  it('laesst Standardspalten ohne Handle', () => {
    const html = renderCustomHeaders([], [], false);
    expect(html).toBe('');
  });
});

describe('EntityCustomColumnResize', () => {
  beforeEach(() => {
    document.body.innerHTML = tableHtml();
    installStorage();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('setzt Breite nur auf Zellen mit gleichem data-custom-col-id', () => {
    const table = document.querySelector('table');
    setColumnWidth(table, COL_A, 320);

    const headerA = document.querySelector(`th[data-custom-col-id="${COL_A}"]`);
    const cellA = document.querySelector(`td[data-custom-col-id="${COL_A}"]`);
    expect(parseFloat(headerA.style.width)).toBe(20);
    expect(parseFloat(headerA.style.minWidth)).toBe(20);
    expect(parseFloat(headerA.style.maxWidth)).toBe(20);
    expect(parseFloat(cellA.style.width)).toBe(20);

    const headerB = document.querySelector(`th[data-custom-col-id="${COL_B}"]`);
    const name = document.querySelector('th.cp-col-name');
    expect(headerB.style.width).toBe('');
    expect(name.style.width).toBe('');
  });

  it('laesst Kategorie-colspan-Zeilen unangetastet', () => {
    const table = document.querySelector('table');
    setColumnWidth(table, COL_A, 240);

    const span = document.querySelector('.kategorie-header-row td');
    expect(span.style.width).toBe('');
    expect(span.getAttribute('colspan')).toBe('4');
  });

  it('spielt gespeicherte rem-Breite nach apply wieder ein', () => {
    saveWidths('sourcing', 'liste-1', { [COL_A]: 12.5 });
    const table = document.querySelector('table');
    applySavedWidths(table, 'sourcing', 'liste-1');

    const headerA = document.querySelector(`th[data-custom-col-id="${COL_A}"]`);
    expect(parseFloat(headerA.style.width)).toBe(12.5);
    expect(loadWidths('sourcing', 'liste-1')[COL_A]).toBe(12.5);
  });

  it('normalisiert Legacy-Pixelwerte zu rem', () => {
    expect(normalizeStoredWidth(320)).toBe(20);
    expect(normalizeStoredWidth(12.5)).toBe(12.5);
    expect(normalizeStoredWidth('nope')).toBeNull();
  });

  it('speichert nach Drag-Ende in localStorage', () => {
    const table = document.querySelector('table');
    const handle = table.querySelector(`.resize-handle-col[data-col="${COL_A}"]`);
    const header = handle.closest('th');
    Object.defineProperty(header, 'offsetWidth', { configurable: true, value: 160 });

    const cleanup = bindColumnResize(table, { parentType: 'sourcing', parentId: 'liste-1' });

    mouse('mousedown', 100, handle);
    mouse('mousemove', 180);
    mouse('mouseup', 180);

    const stored = JSON.parse(window.localStorage.getItem(storageKey('sourcing', 'liste-1')));
    expect(stored[COL_A]).toBe((160 + 80) / 16);

    cleanup();
  });

  it('erzwingt eine Mindestbreite', () => {
    const table = document.querySelector('table');
    const handle = table.querySelector(`.resize-handle-col[data-col="${COL_A}"]`);
    const header = handle.closest('th');
    Object.defineProperty(header, 'offsetWidth', { configurable: true, value: 160 });

    const cleanup = bindColumnResize(table, { parentType: 'sourcing', parentId: 'liste-1', minPx: 80 });

    mouse('mousedown', 200, handle);
    mouse('mousemove', 0);
    mouse('mouseup', 0);

    const headerA = document.querySelector(`th[data-custom-col-id="${COL_A}"]`);
    expect(parseFloat(headerA.style.width)).toBe(5);

    cleanup();
  });
});
