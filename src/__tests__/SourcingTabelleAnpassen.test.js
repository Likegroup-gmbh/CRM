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

    const toggle = document.querySelector('[data-column="cp-col-location"]');
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));

    expect(onHiddenColumnsChange).toHaveBeenCalledWith(['cp-col-location']);
  });

  it('nimmt eigene Spalten mit auf', () => {
    oeffne({ liste_typ: 'mix' }, [], [{ className: 'custom:abc', label: 'Eigene Notiz' }]);

    expect(document.querySelector('[data-column="custom:abc"]')).not.toBeNull();
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
