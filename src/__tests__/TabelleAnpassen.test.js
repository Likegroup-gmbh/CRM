import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoTableColumnVisibilityDrawer } from '../modules/kampagne/VideoTableColumnVisibilityDrawer.js';
import { StrategieDetailColumnVisibilityDrawer } from '../modules/strategie/StrategieDetailColumnVisibilityDrawer.js';
import { StrategieDetail } from '../modules/strategie/StrategieDetail.js';
import { renderMainPage } from '../modules/kampagne/KampagneDetailMainRenderer.js';
import {
  baueStrategieSpaltenfolge,
  standardBeweglicheSpalten,
  uebernehmeEigeneReihenfolge
} from '../modules/strategie/strategieSpaltenfolge.js';

function zieh(griff, quelle, ziel) {
  griff.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  const dataTransfer = {
    effectAllowed: '',
    dropEffect: '',
    setData() {},
    setDragImage() {}
  };
  const feuer = (type, target) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    event.dataTransfer = dataTransfer;
    target.dispatchEvent(event);
  };
  feuer('dragstart', quelle);
  feuer('dragover', ziel);
  feuer('dragend', quelle);
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.stubGlobal('requestAnimationFrame', (cb) => cb());
});

describe('Konzept – Spaltenfolge', () => {
  it('hängt eigene Spalten ohne gespeicherte Folge hinten an', () => {
    const folge = baueStrategieSpaltenfolge({ customColumnIds: ['custom:abc'] });
    expect(folge.at(-1)).toBe('custom:abc');
    expect(folge.slice(0, 2)).toEqual(standardBeweglicheSpalten().slice(0, 2));
  });

  it('behält eine gespeicherte Folge und setzt neue feste Spalten an ihren Platz', () => {
    const ohneDauer = standardBeweglicheSpalten().filter(id => id !== 'col-dauer');
    const folge = baueStrategieSpaltenfolge({
      columnOrder: ['custom:abc', ...ohneDauer],
      customColumnIds: ['custom:abc']
    });

    expect(folge[0]).toBe('custom:abc');
    expect(folge[folge.indexOf('col-funnel') + 1]).toBe('col-dauer');
  });

  it('zieht eigene Spalten nur untereinander um', () => {
    const next = uebernehmeEigeneReihenfolge(
      ['col-prio', 'custom:a', 'col-status', 'custom:b'],
      ['custom:b', 'custom:a', 'custom:c']
    );
    expect(next).toEqual(['col-prio', 'custom:b', 'col-status', 'custom:a', 'custom:c']);
  });
});

describe('Drawer Konzept „Tabelle anpassen“', () => {
  it('heißt Tabelle anpassen und lässt die Reihenfolge ziehen', async () => {
    const onColumnOrderChange = vi.fn();
    const drawer = new StrategieDetailColumnVisibilityDrawer(
      [],
      vi.fn(),
      [{ className: 'custom:abc', label: 'Notiz' }],
      null,
      null,
      onColumnOrderChange
    );
    drawer.open();

    expect(document.querySelector('.drawer-title').textContent).toBe('Tabelle anpassen');
    const list = document.getElementById('strategie-tabelle-anpassen-spalten');
    const ids = [...list.querySelectorAll('.sourcing-spalten-item')].map(row => row.dataset.column);
    expect(ids).toContain('custom:abc');
    expect(ids).not.toContain('col-image');
    expect(list.querySelectorAll('.sourcing-spalten-griff').length).toBe(ids.length);

    const status = list.querySelector('[data-column="col-status"]');
    const prio = list.querySelector('[data-column="col-prio"]');
    zieh(status.querySelector('.sourcing-spalten-griff'), status, prio);
    await Promise.resolve();

    const danach = [...list.querySelectorAll('.sourcing-spalten-item')].map(row => row.dataset.column);
    expect(danach.indexOf('col-status')).toBeLessThan(danach.indexOf('col-prio'));
    expect(onColumnOrderChange).toHaveBeenCalledTimes(1);
    const gemeldet = onColumnOrderChange.mock.calls[0][0];
    expect(gemeldet.indexOf('col-status')).toBeLessThan(gemeldet.indexOf('col-prio'));
  });

  it('schaltet eine feste Spalte über denselben Toggle', () => {
    const onSave = vi.fn();
    const drawer = new StrategieDetailColumnVisibilityDrawer([], onSave, [], null, null, vi.fn());
    drawer.open();

    const toggle = document.querySelector('.column-visibility-toggle[data-column="col-prio"]');
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));

    expect(onSave).toHaveBeenCalledWith(['fixed:prio']);
  });
});

describe('Drawer Kooperation „Tabelle anpassen“', () => {
  it('heißt Tabelle anpassen und speichert die gezogene Reihenfolge', async () => {
    window.supabase = {
      from() {
        return {
          select() { return this; },
          update() { return this; },
          eq() { return Promise.resolve({ error: null }); },
          single() { return Promise.resolve({ data: { video_table_hidden_columns: [] }, error: null }); }
        };
      }
    };
    const store = {
      columnOrder: null,
      customColumns: [],
      setColumnOrder(order) { this.columnOrder = order; }
    };
    const onTableRefresh = vi.fn();
    const drawer = new VideoTableColumnVisibilityDrawer('kampagne-a', store, { onTableRefresh });
    drawer.open();

    expect(document.querySelector('.drawer-title').textContent).toBe('Tabelle anpassen');
    const list = document.getElementById('video-tabelle-anpassen-spalten');
    const tags = list.querySelector('[data-column="col-tags"]');
    const status = list.querySelector('[data-column="col-status"]');
    zieh(tags.querySelector('.sourcing-spalten-griff'), tags, status);
    await Promise.resolve();
    await Promise.resolve();

    expect(store.columnOrder.slice(0, 4)).toEqual(['col-nr', 'col-creator', 'col-tags', 'col-status']);
    expect(store.columnOrder.at(-1)).toBe('col-actions');
    expect(onTableRefresh).toHaveBeenCalledTimes(1);
  });
});

describe('Menüpunkt Tabelle anpassen', () => {
  it('steht so im Konzept-Menü', () => {
    const detail = new StrategieDetail();
    detail.canEdit = true;
    detail.strategie = {};
    const html = detail.renderAddItemActions();
    expect(html).toContain('Tabelle anpassen');
    expect(html).not.toContain('Sichtbarkeit anpassen');
  });

  it('steht so im Kooperations-Menü', () => {
    window.canFeature = (name) => name === 'kampagneTableLayout';
    window.isInternal = () => false;
    const html = renderMainPage({
      mode: 'workflow',
      kampagneData: { kampagnenname: 'Test' },
      lineTitle: 'Linie'
    });
    expect(html).toContain('Tabelle anpassen');
    expect(html).not.toContain('Sichtbarkeit anpassen');
  });
});
