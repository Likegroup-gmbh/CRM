import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VideoTableUIHelpers } from '../modules/kampagne/VideoTableUIHelpers.js';
import { VideoTableRenderer } from '../modules/kampagne/VideoTableRenderer.js';
import { ColumnDragHandler } from '../modules/kampagne/columns/ColumnDragHandler.js';
import { getOrderedColumns, getDefaultColumnIds } from '../modules/kampagne/columns/ColumnRegistry.js';

describe('VideoTableUIHelpers Spalten-Resize', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="grid-wrapper">
        <table class="kooperation-video-grid">
          <thead>
            <tr>
              <th class="col-header col-nr" data-col="0">Nr<div class="resize-handle resize-handle-col" data-col="0"></div></th>
              <th class="col-header col-caption" data-col="27">Caption<div class="resize-handle resize-handle-col" data-col="27"></div></th>
              <th class="col-header col-finale-version" data-col="28">Finale Version<div class="resize-handle resize-handle-col" data-col="28"></div></th>
              <th class="col-header col-posting-datum" data-col="29">Posting Datum<div class="resize-handle resize-handle-col" data-col="29"></div></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="grid-cell"></td>
              <td class="grid-cell"></td>
              <td class="grid-cell col-finale-version"></td>
              <td class="grid-cell"></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('setzt Finale-Version-Breite per data-col, nicht per nth-child(dataCol+1)', () => {
    const helpers = new VideoTableUIHelpers({ columnWidths: new Map() });
    helpers.setColumnWidth('28', 320);

    const finaleHeader = document.querySelector('th.col-finale-version');
    const finaleCell = document.querySelector('td.col-finale-version');
    expect(parseFloat(finaleHeader.style.width)).toBe(20);
    expect(parseFloat(finaleHeader.style.minWidth)).toBe(20);
    expect(parseFloat(finaleCell.style.width)).toBe(20);
    expect(parseFloat(finaleCell.style.minWidth)).toBe(20);

    const caption = document.querySelector('th.col-caption');
    const posting = document.querySelector('th.col-posting-datum');
    expect(caption.style.width).toBe('');
    expect(posting.style.width).toBe('');
  });
});

/* ========================================================================
   Spalten-Reihenfolge: Body folgt getOrderedColumns (Header + Body gleich)
   ======================================================================== */

const CUSTOM_COL = {
  id: 'uuid-1',
  name: 'Notiz intern',
  field_type: 'text',
  entity_type: 'kooperation',
  visible_for_kunden: true,
  position: 0,
  _dropdownOptions: []
};

function makeOrderStore(columnOrder, customColumns = [CUSTOM_COL]) {
  return {
    columnOrder,
    customColumns,
    getCustomColumnValue: () => null
  };
}

function makeVideoTable({ store, isKunde = false } = {}) {
  return {
    store,
    kampagneId: 'kamp-1',
    videos: { 'koop-1': [{ id: 'vid-1', freigabe: false }] },
    videoComments: {},
    hiddenColumns: [],
    statusOptions: [],
    kampagneInfo: null,
    creatorAdressen: {},
    isKundeRole: () => isKunde,
    isFieldEditableForUser: () => !isKunde,
    canDeleteKooperation: () => false,
    getVersandForVideo: () => null,
    isColumnVisibleForCustomer(colId) {
      if (colId === 'col-nr' || colId === 'col-creator' || colId === 'col-status') return true;
      if ((colId === 'col-actions' || colId === 'col-vertrag') && isKunde) return false;
      if (colId === 'col-actions') return true;
      return !this.hiddenColumns.includes(colId);
    }
  };
}

function makeKoop() {
  return {
    id: 'koop-1',
    creator_id: 'cr-1',
    creator: { id: 'cr-1', vorname: 'Max', nachname: 'Muster' },
    videoanzahl: 1,
    status_id: null,
    status_name: '',
    _tags: []
  };
}

function renderTableHost(table) {
  const renderer = new VideoTableRenderer(table);
  const host = document.createElement('div');
  host.innerHTML = `<table class="kooperation-video-grid"><thead><tr>${renderer.renderHeaderRow()}</tr></thead><tbody>${renderer.renderKooperationWithVideos(makeKoop(), 1)}</tbody></table>`;
  return host;
}

describe('Kooperationstabelle: Body folgt der Spaltenreihenfolge', () => {
  it('Body-data-col-id-Sequenz == getOrderedColumns, Custom zwischen Builtins', () => {
    const store = makeOrderStore([
      'col-nr', 'col-creator', 'col-status', 'custom:uuid-1', 'col-tags', 'col-actions'
    ]);
    const host = renderTableHost(makeVideoTable({ store }));

    const headerIds = [...host.querySelectorAll('thead th')].map(th => th.dataset.colId);
    const bodyIds = [...host.querySelectorAll('tbody tr td')].map(td => td.dataset.colId);
    const expected = getOrderedColumns(store).map(c => c.id);

    expect(headerIds).toEqual(expected);
    expect(bodyIds).toEqual(expected);

    // Custom Column steht mitten drin, nicht als Block vor den Aktionen
    const customIdx = bodyIds.indexOf('custom:uuid-1');
    expect(bodyIds[customIdx - 1]).toBe('col-status');
    expect(bodyIds[customIdx + 1]).toBe('col-tags');
  });

  it('haelt Nr/Creator vorne und Aktionen hinten, jede Zelle traegt data-col-id + col.id-Klasse', () => {
    const store = makeOrderStore(null, []);
    const host = renderTableHost(makeVideoTable({ store }));

    const bodyIds = [...host.querySelectorAll('tbody tr td')].map(td => td.dataset.colId);
    expect(bodyIds[0]).toBe('col-nr');
    expect(bodyIds[1]).toBe('col-creator');
    expect(bodyIds[bodyIds.length - 1]).toBe('col-actions');

    for (const td of host.querySelectorAll('tbody tr td')) {
      const id = td.dataset.colId;
      expect(id).toBeTruthy();
      // "custom:uuid" ist als Klassenselektor unbrauchbar -> nur data-col-id
      if (!id.startsWith('custom:')) {
        expect(td.classList.contains(id)).toBe(true);
      }
    }
  });
});

/* ========================================================================
   Spalten-Drag: Excel-Feedback, Locks, Staff-only, Auto-Scroll
   ======================================================================== */

function buildDragDom() {
  document.body.innerHTML = `
    <div class="grid-wrapper">
      <table class="kooperation-video-grid">
        <thead>
          <tr>
            <th class="col-header col-nr" data-col-id="col-nr">Nr</th>
            <th class="col-header col-creator" data-col-id="col-creator">Creator</th>
            <th class="col-header col-status" data-col-id="col-status" draggable="true">Status</th>
            <th class="col-header col-tags" data-col-id="col-tags" draggable="true">Tags</th>
            <th class="col-header col-actions" data-col-id="col-actions">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="grid-cell col-nr" data-col-id="col-nr">1</td>
            <td class="grid-cell col-creator" data-col-id="col-creator">Max</td>
            <td class="grid-cell col-status" data-col-id="col-status">Offen</td>
            <td class="grid-cell col-tags" data-col-id="col-tags">-</td>
            <td class="grid-cell col-actions" data-col-id="col-actions">…</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
  const table = document.querySelector('table');
  table.getBoundingClientRect = () => ({ top: 100, height: 640, left: 0, right: 980, bottom: 740, width: 980 });
  const rectFor = (left, right) => () => ({ top: 100, height: 32, left, right, width: right - left, bottom: 132 });
  document.querySelector('th.col-creator').getBoundingClientRect = rectFor(40, 200);
  document.querySelector('th.col-status').getBoundingClientRect = rectFor(200, 360);
  document.querySelector('th.col-tags').getBoundingClientRect = rectFor(360, 520);
  document.querySelector('th.col-actions').getBoundingClientRect = rectFor(900, 980);
  return table;
}

function makeDragEvent(target) {
  return {
    target,
    preventDefault: vi.fn(),
    dataTransfer: {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
      setDragImage: vi.fn()
    }
  };
}

describe('ColumnDragHandler', () => {
  beforeEach(() => {
    buildDragDom();
    window.supabase = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null }))
        }))
      }))
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.supabase;
  });

  it('zeigt die Drop-Linie in voller Tabellenhoehe, nicht nur Header-Hoehe', () => {
    const handler = new ColumnDragHandler({ isKundeRole: () => false });
    handler._dragCol = 'col-status';

    handler._showIndicator(document.querySelector('th.col-tags'), { clientX: 370 });

    const indicator = document.querySelector('.column-drop-indicator');
    expect(indicator.style.top).toBe('100px');
    expect(indicator.style.height).toBe('640px');
    expect(indicator.style.left).toBe('359px');
    expect(indicator.dataset.side).toBe('left');
  });

  it('dimmt beim Dragstart die ganze Spalte (Header + Body) und killt die native Ghost', () => {
    const handler = new ColumnDragHandler({ isKundeRole: () => false });
    handler.bind(document.querySelector('table'), new AbortController().signal);

    handler._onDragStart(makeDragEvent(document.querySelector('th.col-status')));

    const highlighted = document.querySelectorAll('.column-dragging');
    expect(highlighted.length).toBe(2);
    expect(document.querySelector('th.col-status').classList.contains('column-dragging')).toBe(true);
    expect(document.querySelector('td.col-status').classList.contains('column-dragging')).toBe(true);

    handler._onDragEnd();
    expect(document.querySelectorAll('.column-dragging').length).toBe(0);
  });

  it('blockt Dragstart auf fixierten Spalten (Nr/Creator/Aktionen)', () => {
    const handler = new ColumnDragHandler({ isKundeRole: () => false });
    handler.bind(document.querySelector('table'), new AbortController().signal);

    for (const sel of ['th.col-nr', 'th.col-creator', 'th.col-actions']) {
      const e = makeDragEvent(document.querySelector(sel));
      handler._onDragStart(e);
      expect(e.preventDefault).toHaveBeenCalled();
      expect(handler._dragCol).toBeNull();
    }
  });

  it('blockt Dragstart fuer Kunden komplett', () => {
    const handler = new ColumnDragHandler({ isKundeRole: () => true });
    handler.bind(document.querySelector('table'), new AbortController().signal);

    const e = makeDragEvent(document.querySelector('th.col-status'));
    handler._onDragStart(e);

    expect(e.preventDefault).toHaveBeenCalled();
    expect(handler._dragCol).toBeNull();
    expect(e.dataTransfer.setData).not.toHaveBeenCalled();
  });

  it('scrollt .grid-wrapper automatisch am Rand', () => {
    const wrapper = document.querySelector('.grid-wrapper');
    wrapper.getBoundingClientRect = () => ({ left: 0, right: 1000, width: 1000, top: 0, bottom: 700, height: 700 });
    wrapper.scrollLeft = 100;

    const handler = new ColumnDragHandler({ isKundeRole: () => false });
    handler.bind(document.querySelector('table'), new AbortController().signal);
    handler._dragCol = 'col-status';

    const thTags = document.querySelector('th.col-tags');
    handler._onDragOver({ ...makeDragEvent(thTags), clientX: 30 });
    expect(wrapper.scrollLeft).toBe(78);

    handler._onDragOver({ ...makeDragEvent(thTags), clientX: 980 });
    expect(wrapper.scrollLeft).toBe(100);
  });

  it('Drop auf Creator setzt die Spalte auf die erste bewegliche Position', async () => {
    const store = {
      columnOrder: getDefaultColumnIds(),
      customColumns: [],
      setColumnOrder(o) { this.columnOrder = o; }
    };
    const handler = new ColumnDragHandler({ store, refilter: vi.fn(), isKundeRole: () => false, kampagneId: 'k1' });

    await handler._reorderColumns('col-status', 'col-creator', { clientX: 60 }, document.querySelector('th.col-creator'));

    const order = store.columnOrder;
    expect(order[0]).toBe('col-nr');
    expect(order[1]).toBe('col-creator');
    expect(order[2]).toBe('col-status');
    expect(order[order.length - 1]).toBe('col-actions');
  });

  it('Drop auf Aktionen setzt die Spalte auf die letzte Position davor', async () => {
    const store = {
      columnOrder: getDefaultColumnIds(),
      customColumns: [],
      setColumnOrder(o) { this.columnOrder = o; }
    };
    const handler = new ColumnDragHandler({ store, refilter: vi.fn(), isKundeRole: () => false, kampagneId: 'k1' });

    await handler._reorderColumns('col-status', 'col-actions', { clientX: 970 }, document.querySelector('th.col-actions'));

    const order = store.columnOrder;
    const actionsIdx = order.indexOf('col-actions');
    expect(order[actionsIdx - 1]).toBe('col-status');
    expect(order[0]).toBe('col-nr');
    expect(order[1]).toBe('col-creator');
  });

  it('normaler Drop hinter einer beweglichen Spalte sortiert korrekt um', async () => {
    const store = {
      columnOrder: getDefaultColumnIds(),
      customColumns: [],
      setColumnOrder(o) { this.columnOrder = o; }
    };
    const handler = new ColumnDragHandler({ store, refilter: vi.fn(), isKundeRole: () => false, kampagneId: 'k1' });

    await handler._reorderColumns('col-status', 'col-tags', { clientX: 500 }, document.querySelector('th.col-tags'));

    const order = store.columnOrder;
    expect(order.indexOf('col-status')).toBe(order.indexOf('col-tags') + 1);
  });
});

describe('Header: draggable nur fuer Staff und nur auf beweglichen Spalten', () => {
  it('setzt draggable bei internen Nutzern nicht auf Nr/Creator/Aktionen', () => {
    const store = makeOrderStore(null);
    const host = renderTableHost(makeVideoTable({ store, isKunde: false }));

    expect(host.querySelector('th.col-nr').hasAttribute('draggable')).toBe(false);
    expect(host.querySelector('th.col-creator').hasAttribute('draggable')).toBe(false);
    expect(host.querySelector('th.col-actions').hasAttribute('draggable')).toBe(false);
    expect(host.querySelector('th.col-status').getAttribute('draggable')).toBe('true');
    expect(host.querySelector('th[data-col-id="custom:uuid-1"]').getAttribute('draggable')).toBe('true');
  });

  it('setzt fuer Kunden gar kein draggable', () => {
    const store = makeOrderStore(null);
    const host = renderTableHost(makeVideoTable({ store, isKunde: true }));

    expect(host.querySelector('th[draggable="true"]')).toBeNull();
  });
});
