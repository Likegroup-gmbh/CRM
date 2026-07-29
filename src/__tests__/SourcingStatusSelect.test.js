import { describe, it, expect } from 'vitest';
import { renderItemRow, migrateHiddenColumns } from '../modules/creator-auswahl/CreatorAuswahlTemplates.js';
import {
  getSourcingStatus,
  buildSourcingStatusUpdates,
  getSourcingStatusMeta,
  isSourcingStatus
} from '../modules/creator-auswahl/sourcingStatusOptions.js';

function renderRow(item, ctx = {}) {
  const html = renderItemRow({ isKunde: false, hiddenColumns: [], ...ctx }, { id: 'i1', ...item }, 0);
  return new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
}

describe('getSourcingStatus – Rangfolge bei Mehrfach-Flags', () => {
  it('faellt ohne gesetztes Flag auf "offen" zurueck', () => {
    expect(getSourcingStatus({})).toBe('offen');
    expect(getSourcingStatus(null)).toBe('offen');
  });

  it('liefert den einzeln gesetzten Status', () => {
    expect(getSourcingStatus({ on_hold: true })).toBe('on_hold');
    expect(getSourcingStatus({ gebucht: true })).toBe('gebucht');
    expect(getSourcingStatus({ prio_1: true })).toBe('prio_1');
    expect(getSourcingStatus({ prio_2: true })).toBe('prio_2');
    expect(getSourcingStatus({ absage: true })).toBe('absage');
  });

  it('bevorzugt On Hold gegenueber Prio', () => {
    expect(getSourcingStatus({ on_hold: true, prio_1: true })).toBe('on_hold');
    expect(getSourcingStatus({ on_hold: true, prio_2: true })).toBe('on_hold');
  });

  it('bevorzugt Absage vor allem und Gebucht vor On Hold', () => {
    expect(getSourcingStatus({ absage: true, gebucht: true, on_hold: true, prio_1: true })).toBe('absage');
    expect(getSourcingStatus({ gebucht: true, on_hold: true, prio_1: true })).toBe('gebucht');
  });
});

describe('buildSourcingStatusUpdates', () => {
  const FLAGS = ['on_hold', 'gebucht', 'prio_1', 'prio_2', 'absage'];

  it('setzt je Status genau ein Flag auf true', () => {
    for (const status of FLAGS) {
      const updates = buildSourcingStatusUpdates(status);
      const gesetzt = FLAGS.filter(f => updates[f] === true);
      expect(gesetzt).toEqual([status]);
    }
  });

  it('raeumt bei "offen" alle Flags und Zeitstempel ab', () => {
    expect(buildSourcingStatusUpdates('offen')).toEqual({
      on_hold: false,
      on_hold_am: null,
      gebucht: false,
      prio_1: false,
      prio_2: false,
      absage: false,
      absage_am: null
    });
  });

  it('schreibt den Zeitstempel nur fuer On Hold und Absage', () => {
    const now = new Date('2026-07-29T06:00:00.000Z');

    const onHold = buildSourcingStatusUpdates('on_hold', now);
    expect(onHold.on_hold_am).toBe(now.toISOString());
    expect(onHold.absage_am).toBeNull();

    const absage = buildSourcingStatusUpdates('absage', now);
    expect(absage.absage_am).toBe(now.toISOString());
    expect(absage.on_hold_am).toBeNull();

    expect(buildSourcingStatusUpdates('gebucht', now).on_hold_am).toBeNull();
  });

  it('nimmt beim Wechsel von Absage auf Gebucht die Absage inklusive Datum zurueck', () => {
    const updates = buildSourcingStatusUpdates('gebucht');

    expect(updates.absage).toBe(false);
    expect(updates.absage_am).toBeNull();
    expect(updates.gebucht).toBe(true);
  });

  it('erkennt gueltige Status-Werte', () => {
    expect(isSourcingStatus('on_hold')).toBe(true);
    expect(isSourcingStatus('offen')).toBe(true);
    expect(isSourcingStatus('quatsch')).toBe(false);
  });
});

describe('getSourcingStatusMeta', () => {
  it('zeigt das Datum nur bei On Hold und Absage', () => {
    expect(getSourcingStatusMeta({ on_hold: true, on_hold_am: '2026-07-29T06:00:00.000Z' })).toBe('29.7.2026');
    expect(getSourcingStatusMeta({ absage: true, absage_am: '2026-07-29T06:00:00.000Z' })).toBe('29.7.2026');
    expect(getSourcingStatusMeta({ gebucht: true, on_hold_am: '2026-07-29T06:00:00.000Z' })).toBe('');
    expect(getSourcingStatusMeta({ on_hold: true })).toBe('');
  });
});

describe('Sourcing-Zeile – Status-Spalte', () => {
  it('rendert genau eine Status-Zelle statt der fuenf Checkbox-Spalten', () => {
    const doc = renderRow({ on_hold: true });

    expect(doc.querySelectorAll('td.cp-col-status')).toHaveLength(1);
    expect(doc.querySelector('td.cp-col-onhold')).toBeNull();
    expect(doc.querySelector('td.cp-col-buchen')).toBeNull();
    expect(doc.querySelector('td.cp-col-prio1')).toBeNull();
    expect(doc.querySelector('td.cp-col-prio2')).toBeNull();
    expect(doc.querySelector('td.cp-col-absagen')).toBeNull();
  });

  it('rendert die manuellen CPM-Spalten nicht mehr', () => {
    const doc = renderRow({ cpm_instagram: 15, cpm_tiktok: 10 });

    expect(doc.querySelector('td.cp-col-cpm-ig')).toBeNull();
    expect(doc.querySelector('td.cp-col-cpm-tt')).toBeNull();
    expect(doc.querySelector('td.cp-col-cpm-ig-8')).not.toBeNull();
  });

  it('zeigt den aktuellen Status im Trigger und markiert ihn in der Optionsliste', () => {
    const select = renderRow({ gebucht: true }).querySelector('td.cp-col-status .table-select');

    expect(select.dataset.field).toBe('sourcing_status');
    expect(select.dataset.itemId).toBe('i1');
    expect(select.dataset.value).toBe('gebucht');
    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('Buchen');
    expect(select.querySelector('.table-select__item.is-active').dataset.value).toBe('gebucht');
  });

  it('haengt das On-Hold-Datum als Meta-Zeile unter den Trigger', () => {
    const select = renderRow({ on_hold: true, on_hold_am: '2026-07-29T06:00:00.000Z' })
      .querySelector('td.cp-col-status .table-select');

    expect(select.querySelector('.table-select__meta').textContent.trim()).toBe('29.7.2026');
  });

  it('sperrt fuer Kunden die Absage-Option', () => {
    const select = renderRow({}, { isKunde: true }).querySelector('td.cp-col-status .table-select');
    const absage = select.querySelector('.table-select__item[data-value="absage"]');

    expect(absage.disabled).toBe(true);
    expect(select.querySelector('.table-select__item[data-value="on_hold"]').disabled).toBe(false);
  });

  it('sperrt fuer Kunden eine bereits gesetzte Absage komplett', () => {
    const select = renderRow({ absage: true }, { isKunde: true }).querySelector('td.cp-col-status .table-select');

    expect(select.querySelector('button.table-select__trigger')).toBeNull();
    expect(select.querySelector('.table-select__trigger--disabled')).not.toBeNull();
  });

  it('rendert fuer Gaeste im Readonly-Modus keinen klickbaren Trigger', () => {
    const select = renderRow({ prio_1: true }, { gastReadonly: true }).querySelector('td.cp-col-status .table-select');

    expect(select.querySelector('button.table-select__trigger')).toBeNull();
    expect(select.querySelector('.table-select__panel')).toBeNull();
    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('Prio 1');
  });

  it('blendet die Status-Spalte aus, wenn sie versteckt ist', () => {
    const doc = renderRow({}, { hiddenColumns: ['cp-col-status'] });

    expect(doc.querySelector('td.cp-col-status').getAttribute('style')).toContain('display:none');
  });
});

describe('migrateHiddenColumns', () => {
  it('entfernt die alten Status-Spalten aus gespeicherten Einstellungen', () => {
    expect(migrateHiddenColumns(['cp-col-onhold', 'cp-col-notiz'])).toEqual(['cp-col-notiz']);
  });

  it('versteckt die Status-Spalte nur, wenn vorher alle fuenf versteckt waren', () => {
    const alle = ['cp-col-onhold', 'cp-col-buchen', 'cp-col-prio1', 'cp-col-prio2', 'cp-col-absagen'];

    expect(migrateHiddenColumns(alle)).toEqual(['cp-col-status']);
    expect(migrateHiddenColumns(alle.slice(0, 4))).toEqual([]);
  });

  it('entfernt die abgeschafften CPM-Spalten', () => {
    expect(migrateHiddenColumns(['cp-col-cpm-ig', 'cp-col-cpm-tt', 'cp-col-vk'])).toEqual(['cp-col-vk']);
  });

  it('teilt die alte Links-Spalte weiterhin in IG und TT auf', () => {
    expect(migrateHiddenColumns(['cp-col-links'])).toEqual(['cp-col-link-ig', 'cp-col-link-tt']);
  });

  it('kommt mit fehlenden Werten klar', () => {
    expect(migrateHiddenColumns(null)).toEqual([]);
    expect(migrateHiddenColumns(undefined)).toEqual([]);
  });
});
