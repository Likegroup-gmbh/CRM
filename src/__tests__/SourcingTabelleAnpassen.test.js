import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SourcingTabelleAnpassenDrawer } from '../modules/creator-auswahl/SourcingTabelleAnpassenDrawer.js';
import { wendePresetAn, TT_SPALTEN } from '../modules/creator-auswahl/sourcingSpaltenPreset.js';

/** Drawer oeffnen und die Callbacks mitgeben */
function oeffne(liste = {}, hiddenColumns = [], customColumns = []) {
  const onHiddenColumnsChange = vi.fn();
  const onListeChange = vi.fn();
  const drawer = new SourcingTabelleAnpassenDrawer({
    liste, hiddenColumns, customColumns, onHiddenColumnsChange, onListeChange
  });
  drawer.open();
  return { drawer, onHiddenColumnsChange, onListeChange };
}

beforeEach(() => {
  document.body.innerHTML = '';
  // open() nutzt requestAnimationFrame nur fuer die Slide-in-Klassen
  vi.stubGlobal('requestAnimationFrame', (cb) => cb());
});

describe('Drawer "Tabelle anpassen"', () => {
  it('zeigt nur Spalten, nicht Typ, Plattform, Format oder TKP', () => {
    oeffne({ liste_typ: 'influencer', plattformen: 'instagram', ig_formate: 'story', tkp: 40 });

    expect(document.querySelector('.drawer-title').textContent).toBe('Tabelle anpassen');
    for (const name of ['liste_typ', 'plattformen', 'ig_formate', 'tkp']) {
      expect(document.querySelector(`[data-listen-einstellung="${name}"]`)).toBeNull();
    }
  });
});

describe('Drawer "Tabelle anpassen" – Spalten', () => {
  it('meldet eine abgeschaltete Spalte an den Callback', () => {
    const { onHiddenColumnsChange } = oeffne({ liste_typ: 'mix' });

    const toggle = document.querySelector('.column-visibility-toggle[data-column="cp-col-location"]');
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));

    expect(onHiddenColumnsChange).toHaveBeenCalledWith(['cp-col-location']);
  });

  it('nimmt eigene Spalten mit auf', () => {
    oeffne({ liste_typ: 'mix' }, [], [{ className: 'custom:abc', label: 'Eigene Notiz' }]);

    expect(document.querySelector('[data-column="custom:abc"]')).not.toBeNull();
  });

  it('zeigt jede Spalte mit Griff, in der Standardreihenfolge', () => {
    oeffne({ liste_typ: 'mix' });

    const ids = Array.from(document.querySelectorAll('#sourcing-tabelle-anpassen-spalten .sourcing-spalten-item'))
      .map(row => row.dataset.column);

    expect(ids.slice(0, 4)).toEqual([
      'cp-col-bild', 'cp-col-notiz', 'cp-col-matching', 'cp-col-typ'
    ]);
    expect(document.querySelectorAll('.sourcing-spalten-griff').length).toBe(ids.length);
    expect(ids).not.toContain('cp-col-name');
    expect(ids).not.toContain('cp-col-actions');
  });

  it('oeffnet mit einer gespeicherten Reihenfolge', () => {
    oeffne({ column_order: ['cp-col-status', 'cp-col-bild', 'cp-col-notiz'] });

    const ids = Array.from(document.querySelectorAll('#sourcing-tabelle-anpassen-spalten .sourcing-spalten-item'))
      .map(row => row.dataset.column);

    expect(ids.slice(0, 3)).toEqual(['cp-col-status', 'cp-col-bild', 'cp-col-notiz']);
  });

  it('meldet die neue Reihenfolge nach dem Ziehen', async () => {
    const onColumnOrderChange = vi.fn();
    const drawer = new SourcingTabelleAnpassenDrawer({
      liste: { liste_typ: 'mix' },
      hiddenColumns: [],
      onHiddenColumnsChange: vi.fn(),
      onListeChange: vi.fn(),
      onColumnOrderChange
    });
    drawer.open();

    const list = document.getElementById('sourcing-tabelle-anpassen-spalten');
    const status = list.querySelector('.sourcing-spalten-item[data-column="cp-col-status"]');
    const notiz = list.querySelector('.sourcing-spalten-item[data-column="cp-col-notiz"]');
    const griff = status.querySelector('.sourcing-spalten-griff');

    griff.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData() {},
      setDragImage() {}
    };
    const ziehEvent = (type, target) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      event.dataTransfer = dataTransfer;
      target.dispatchEvent(event);
    };
    // dragstart/end am Item selbst – so wie der Browser es nach mousedown am Griff feuert
    ziehEvent('dragstart', status);
    ziehEvent('dragover', notiz);
    ziehEvent('dragend', status);
    await Promise.resolve();
    await Promise.resolve();

    const ids = Array.from(list.querySelectorAll('.sourcing-spalten-item')).map(row => row.dataset.column);
    expect(ids.indexOf('cp-col-status')).toBeLessThan(ids.indexOf('cp-col-notiz'));
    expect(onColumnOrderChange).toHaveBeenCalledTimes(1);
    const gemeldet = onColumnOrderChange.mock.calls[0][0];
    expect(gemeldet.indexOf('cp-col-status')).toBeLessThan(gemeldet.indexOf('cp-col-notiz'));
    expect(gemeldet[0]).toBe('cp-col-bild');
  });
});

describe('wendePresetAn', () => {
  it('ersetzt nur die Preset-Spalten', () => {
    const vorher = ['cp-col-mail', ...TT_SPALTEN];
    const nachher = wendePresetAn(vorher, { liste_typ: 'mix' });

    expect(nachher).toEqual(['cp-col-mail']);
  });

  it('vertraegt fehlende Eingaben', () => {
    expect(wendePresetAn()).toEqual([]);
  });
});
