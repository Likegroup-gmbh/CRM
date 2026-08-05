import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SourcingTabelleAnpassenDrawer } from '../modules/creator-auswahl/SourcingTabelleAnpassenDrawer.js';
import {
  wendePresetAn,
  IG_REELS_SPALTEN,
  IG_STORY_SPALTEN,
  IG_GESAMTPREIS_SPALTEN,
  TT_SPALTEN
} from '../modules/creator-auswahl/sourcingSpaltenPreset.js';

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

function feld(name) {
  return document.querySelector(`[data-listen-einstellung="${name}"]`);
}

function istSichtbar(name) {
  const wrapper = document.querySelector(`[data-listen-feld="${name}"]`);
  return !wrapper.classList.contains('form-field--hidden');
}

/** change-Event feuern und die async-Handler abwarten */
async function setze(name, wert) {
  const el = feld(name);
  el.value = wert;
  el.dispatchEvent(new Event('change'));
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  document.body.innerHTML = '';
  // open() nutzt requestAnimationFrame nur fuer die Slide-in-Klassen
  vi.stubGlobal('requestAnimationFrame', (cb) => cb());
});

describe('Drawer "Tabelle anpassen" – Listeneinstellungen', () => {
  it('zeigt Typ, Plattform, Format und TKP mit den Werten der Liste', () => {
    oeffne({ liste_typ: 'influencer', plattformen: 'instagram', ig_formate: 'story', tkp: 40 });

    expect(document.querySelector('.drawer-title').textContent).toBe('Tabelle anpassen');
    expect(feld('liste_typ').value).toBe('influencer');
    expect(feld('plattformen').value).toBe('instagram');
    expect(feld('ig_formate').value).toBe('story');
    expect(feld('tkp').value).toBe('40');
  });

  it('nennt keine Kampagnenfelder – die gehoeren zum Anlegen', () => {
    oeffne({ liste_typ: 'mix' });

    for (const name of ['unternehmen_id', 'marke_id', 'kampagne_id', 'name']) {
      expect(feld(name)).toBeNull();
    }
  });

  it('zeigt fuer Bestandslisten ohne TKP die 25', () => {
    oeffne({});

    expect(feld('tkp').value).toBe('25');
  });

  it('blendet Plattform und Format aus, solange kein Influencer gewaehlt ist', () => {
    oeffne({ liste_typ: 'ugc' });

    expect(istSichtbar('liste_typ')).toBe(true);
    expect(istSichtbar('plattformen')).toBe(false);
    expect(istSichtbar('ig_formate')).toBe(false);
  });

  it('zeigt das Format nur, wenn Instagram dabei ist', () => {
    oeffne({ liste_typ: 'influencer', plattformen: 'tiktok' });

    expect(istSichtbar('plattformen')).toBe(true);
    expect(istSichtbar('ig_formate')).toBe(false);
  });

  it('speichert einen neuen TKP sofort', async () => {
    const { onListeChange } = oeffne({ tkp: 25 });

    await setze('tkp', '32.5');

    expect(onListeChange).toHaveBeenCalledWith({ tkp: 32.5 });
  });

  it('setzt einen ungueltigen TKP auf den gespeicherten Wert zurueck', async () => {
    const { onListeChange } = oeffne({ tkp: 30 });

    await setze('tkp', '-5');

    expect(onListeChange).not.toHaveBeenCalled();
    expect(feld('tkp').value).toBe('30');
  });
});

describe('Drawer "Tabelle anpassen" – Typwechsel', () => {
  it('belegt die Spalten neu vor und schaltet die Folgefelder frei', async () => {
    const { onListeChange } = oeffne({ liste_typ: 'ugc' }, [...IG_REELS_SPALTEN]);

    await setze('liste_typ', 'influencer');

    expect(onListeChange).toHaveBeenCalledWith({
      liste_typ: 'influencer', hidden_columns: []
    });
    expect(istSichtbar('plattformen')).toBe(true);
    // Reels-Spalten sind wieder an
    expect(document.querySelector('[data-column="cp-col-cpm-ig-8"]').checked).toBe(true);
  });

  it('vergisst Plattform und Format, wenn der Typ kein Influencer mehr ist', async () => {
    const { onListeChange } = oeffne({
      liste_typ: 'influencer', plattformen: 'instagram', ig_formate: 'reel'
    });

    await setze('liste_typ', 'ugc');

    expect(onListeChange).toHaveBeenCalledWith({
      liste_typ: 'ugc',
      plattformen: null,
      ig_formate: null,
      hidden_columns: [
        ...IG_REELS_SPALTEN, ...IG_STORY_SPALTEN, ...IG_GESAMTPREIS_SPALTEN, ...TT_SPALTEN
      ]
    });
    expect(istSichtbar('plattformen')).toBe(false);
  });

  it('vergisst das Format, wenn Instagram wegfaellt', async () => {
    const { onListeChange } = oeffne({
      liste_typ: 'influencer', plattformen: 'instagram,tiktok', ig_formate: 'story'
    });

    await setze('plattformen', 'tiktok');

    const updates = onListeChange.mock.calls[0][0];
    expect(updates.plattformen).toBe('tiktok');
    expect(updates.ig_formate).toBeNull();
    expect(updates.hidden_columns).toContain('cp-col-link-ig');
    expect(updates.hidden_columns).not.toContain('cp-col-link-tt');
  });

  it('laesst von Hand abgeschaltete Spalten in Ruhe', async () => {
    const { onListeChange } = oeffne({ liste_typ: 'mix' }, ['cp-col-mail', 'custom:abc']);

    await setze('liste_typ', 'influencer');

    expect(onListeChange.mock.calls[0][0].hidden_columns).toEqual(['cp-col-mail', 'custom:abc']);
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
