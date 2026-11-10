// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { CreatorList } from '../modules/creator/CreatorListCore.js';
import '../modules/creator/CreatorListView.js';
import '../modules/creator/CreatorListBulk.js';

function shell({ filterColumn, canEdit = true, canBulkDelete = true, isAdmin = true }) {
  const list = Object.create(CreatorList.prototype);
  Object.defineProperty(list, 'canEdit', { value: canEdit });
  Object.defineProperty(list, 'canBulkDelete', { value: canBulkDelete });
  Object.defineProperty(list, 'isAdmin', { value: isAdmin });
  list.mode = 'standard';
  list.groesseFilter = [];
  list.generationFilter = '';
  list.searchQuery = '';
  list.ansicht = 'grid';
  list.usesFilterColumn = () => filterColumn;
  list.gridView = { renderShell: () => '<div id="grid"></div>' };
  const el = document.createElement('div');
  el.innerHTML = list.renderShellContent();
  return el;
}

beforeEach(() => {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
});

describe('Creator-Toolbar', () => {
  it('legt Auswahl und Anlegen rechts in die Filterleiste', () => {
    const el = shell({ filterColumn: true });
    const right = el.querySelector('.filter-bar .filter-right');
    expect(right.querySelector('#btn-select-all')).toBeTruthy();
    expect(right.querySelector('#btn-deselect-all')).toBeTruthy();
    expect(right.querySelector('#btn-delete-selected')).toBeTruthy();
    expect(right.querySelector('#btn-creator-new')).toBeTruthy();
    expect(right.querySelector('#creator-result-count')).toBeTruthy();
    expect(el.querySelector('.creator-toolbar-meta #creator-result-count')).toBeNull();
    expect(el.querySelector('.creator-toolbar-meta button')).toBeNull();
    expect(el.querySelectorAll('#btn-select-all')).toHaveLength(1);
  });

  it('hat keinen Connect-Button mehr', () => {
    expect(shell({ filterColumn: true }).querySelector('#btn-connect-all')).toBeNull();
    expect(shell({ filterColumn: false }).querySelector('#btn-connect-all')).toBeNull();
    expect(CreatorList.prototype.runBulkConnect).toBeUndefined();
  });

  it('Legacy-Modus ohne Filterspalte behaelt die alte Anordnung', () => {
    const el = shell({ filterColumn: false });
    expect(el.querySelector('.filter-right #btn-creator-new')).toBeTruthy();
    expect(el.querySelector('.table-actions #btn-select-all')).toBeTruthy();
  });
});
