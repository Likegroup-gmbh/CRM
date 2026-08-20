import { describe, it, expect } from 'vitest';
import { renderItemRow, migrateHiddenColumns } from '../modules/creator-auswahl/CreatorAuswahlTemplates.js';
import {
  getSourcingStatus,
  getKundenFeedback,
  buildSourcingStatusUpdates,
  buildKundenFeedbackUpdates,
  getSourcingStatusMeta,
  getKundenFeedbackMeta,
  isSourcingStatus,
  isKundenFeedback
} from '../modules/creator-auswahl/sourcingStatusOptions.js';

function renderRow(item, ctx = {}) {
  const html = renderItemRow({ isKunde: false, hiddenColumns: [], ...ctx }, { id: 'i1', ...item }, 0);
  return new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
}

describe('getSourcingStatus – Rangfolge bei Mehrfach-Flags', () => {
  it('faellt ohne gesetztes Prozess-Flag auf "offen" zurueck', () => {
    expect(getSourcingStatus({})).toBe('offen');
    expect(getSourcingStatus(null)).toBe('offen');
  });

  it('liefert den einzeln gesetzten Prozess-Status', () => {
    expect(getSourcingStatus({ angefragt: true })).toBe('angefragt');
    expect(getSourcingStatus({ in_verhandlung: true })).toBe('in_verhandlung');
    expect(getSourcingStatus({ preis_zugesagt: true })).toBe('preis_zugesagt');
    expect(getSourcingStatus({ zusage: true })).toBe('zusage');
    expect(getSourcingStatus({ on_hold: true })).toBe('on_hold');
    expect(getSourcingStatus({ gebucht: true })).toBe('gebucht');
    expect(getSourcingStatus({ absage: true })).toBe('absage');
  });

  it('ignoriert die Feedback-Flags - Prio und Abgelehnt sind kein Prozess-Status', () => {
    expect(getSourcingStatus({ prio_1: true })).toBe('offen');
    expect(getSourcingStatus({ prio_2: true })).toBe('offen');
    expect(getSourcingStatus({ abgelehnt: true })).toBe('offen');
  });

  it('bevorzugt die weiter fortgeschrittene Prozess-Stufe bei Altdaten', () => {
    expect(getSourcingStatus({ on_hold: true, prio_1: true })).toBe('on_hold');
    expect(getSourcingStatus({ angefragt: true, prio_1: true })).toBe('angefragt');
    expect(getSourcingStatus({ in_verhandlung: true, angefragt: true })).toBe('in_verhandlung');
    expect(getSourcingStatus({ preis_zugesagt: true, in_verhandlung: true })).toBe('preis_zugesagt');
    expect(getSourcingStatus({ zusage: true, preis_zugesagt: true })).toBe('zusage');
    expect(getSourcingStatus({ zusage: true, in_verhandlung: true })).toBe('zusage');
    expect(getSourcingStatus({ gebucht: true, zusage: true })).toBe('gebucht');
    expect(getSourcingStatus({ on_hold: true, zusage: true })).toBe('on_hold');
    expect(getSourcingStatus({ absage: true, gebucht: true, on_hold: true, prio_1: true })).toBe('absage');
  });
});

describe('getKundenFeedback', () => {
  it('faellt ohne Feedback-Flag auf leer zurueck', () => {
    expect(getKundenFeedback({})).toBe('');
    expect(getKundenFeedback(null)).toBe('');
    expect(getKundenFeedback({ angefragt: true })).toBe('');
  });

  it('liefert das gesetzte Feedback', () => {
    expect(getKundenFeedback({ prio_1: true })).toBe('prio_1');
    expect(getKundenFeedback({ prio_2: true })).toBe('prio_2');
    expect(getKundenFeedback({ abgelehnt: true })).toBe('abgelehnt');
  });

  it('bevorzugt bei Altdaten die haertere Bewertung', () => {
    expect(getKundenFeedback({ abgelehnt: true, prio_1: true })).toBe('abgelehnt');
    expect(getKundenFeedback({ prio_1: true, prio_2: true })).toBe('prio_1');
  });
});

describe('buildSourcingStatusUpdates', () => {
  const PROZESS_FLAGS = ['angefragt', 'in_verhandlung', 'preis_zugesagt', 'zusage', 'on_hold', 'gebucht', 'absage'];
  const FEEDBACK_FELDER = ['prio_1', 'prio_2', 'abgelehnt', 'abgelehnt_am'];

  it('setzt je Status genau ein Prozess-Flag auf true', () => {
    for (const status of PROZESS_FLAGS) {
      const updates = buildSourcingStatusUpdates(status);
      const gesetzt = PROZESS_FLAGS.filter(f => updates[f] === true);
      expect(gesetzt).toEqual([status]);
    }
  });

  it('raeumt bei "offen" alle Prozess-Flags und Zeitstempel ab', () => {
    expect(buildSourcingStatusUpdates('offen')).toEqual({
      angefragt: false,
      angefragt_am: null,
      in_verhandlung: false,
      in_verhandlung_am: null,
      preis_zugesagt: false,
      preis_zugesagt_am: null,
      zusage: false,
      zusage_am: null,
      on_hold: false,
      on_hold_am: null,
      gebucht: false,
      absage: false,
      absage_am: null
    });
  });

  it('laesst die Feedback-Felder komplett unberuehrt', () => {
    // Prio und Abgelehnt stehen in der eigenen Kundenfeedback-Spalte - ein
    // Statuswechsel darf sie weder setzen noch zuruecknehmen
    for (const status of [...PROZESS_FLAGS, 'offen']) {
      const updates = buildSourcingStatusUpdates(status);
      for (const feld of FEEDBACK_FELDER) {
        expect(feld in updates, `${status} beruehrt ${feld}`).toBe(false);
      }
    }
  });

  it('schreibt den Zeitstempel fuer Angefragt, In Verhandlung, Preis zugesagt, Zusage, On Hold und Absage', () => {
    const now = new Date('2026-07-29T06:00:00.000Z');

    expect(buildSourcingStatusUpdates('angefragt', now).angefragt_am).toBe(now.toISOString());
    expect(buildSourcingStatusUpdates('in_verhandlung', now).in_verhandlung_am).toBe(now.toISOString());
    expect(buildSourcingStatusUpdates('preis_zugesagt', now).preis_zugesagt_am).toBe(now.toISOString());
    expect(buildSourcingStatusUpdates('zusage', now).zusage_am).toBe(now.toISOString());

    const onHold = buildSourcingStatusUpdates('on_hold', now);
    expect(onHold.on_hold_am).toBe(now.toISOString());
    expect(onHold.absage_am).toBeNull();

    const absage = buildSourcingStatusUpdates('absage', now);
    expect(absage.absage_am).toBe(now.toISOString());
    expect(absage.on_hold_am).toBeNull();

    expect(buildSourcingStatusUpdates('gebucht', now).on_hold_am).toBeNull();
  });

  it('laesst angefragt_am beim Weiterziehen stehen', () => {
    // Dass am 5. August angefragt wurde, bleibt wahr, auch wenn der Creator
    // inzwischen gebucht ist - nur das Boolean wandert weiter
    for (const status of ['in_verhandlung', 'gebucht', 'absage']) {
      const updates = buildSourcingStatusUpdates(status);
      expect(updates.angefragt).toBe(false);
      expect('angefragt_am' in updates).toBe(false);
    }
  });

  it('nimmt beim Wechsel von Absage auf Gebucht die Absage inklusive Datum zurueck', () => {
    const updates = buildSourcingStatusUpdates('gebucht');

    expect(updates.absage).toBe(false);
    expect(updates.absage_am).toBeNull();
    expect(updates.gebucht).toBe(true);
  });

  it('laesst zusage_am beim Weiterziehen stehen, raeumt es aber bei "offen" ab', () => {
    for (const status of ['gebucht', 'absage']) {
      expect('zusage_am' in buildSourcingStatusUpdates(status)).toBe(false);
    }
    expect(buildSourcingStatusUpdates('offen').zusage_am).toBeNull();
  });

  it('laesst preis_zugesagt_am beim Weiterziehen stehen, raeumt es aber bei "offen" ab', () => {
    for (const status of ['zusage', 'gebucht', 'absage']) {
      expect('preis_zugesagt_am' in buildSourcingStatusUpdates(status)).toBe(false);
    }
    expect(buildSourcingStatusUpdates('offen').preis_zugesagt_am).toBeNull();
  });

  it('erkennt gueltige Status-Werte und weist Feedback-Werte ab', () => {
    expect(isSourcingStatus('on_hold')).toBe(true);
    expect(isSourcingStatus('offen')).toBe(true);
    expect(isSourcingStatus('angefragt')).toBe(true);
    expect(isSourcingStatus('in_verhandlung')).toBe(true);
    expect(isSourcingStatus('preis_zugesagt')).toBe(true);
    expect(isSourcingStatus('zusage')).toBe(true);
    expect(isSourcingStatus('prio_1')).toBe(false);
    expect(isSourcingStatus('abgelehnt')).toBe(false);
    expect(isSourcingStatus('quatsch')).toBe(false);
  });
});

describe('buildKundenFeedbackUpdates', () => {
  const FEEDBACK_FLAGS = ['prio_1', 'prio_2', 'abgelehnt'];
  const PROZESS_FELDER = ['angefragt', 'in_verhandlung', 'preis_zugesagt', 'zusage', 'on_hold', 'gebucht', 'absage'];

  it('setzt je Feedback genau ein Flag auf true', () => {
    for (const feedback of FEEDBACK_FLAGS) {
      const updates = buildKundenFeedbackUpdates(feedback);
      const gesetzt = FEEDBACK_FLAGS.filter(f => updates[f] === true);
      expect(gesetzt).toEqual([feedback]);
    }
  });

  it('raeumt bei der Leer-Option alle Feedback-Flags ab', () => {
    expect(buildKundenFeedbackUpdates('')).toEqual({
      prio_1: false,
      prio_2: false,
      abgelehnt: false,
      abgelehnt_am: null
    });
  });

  it('schreibt den Zeitstempel nur bei Abgelehnt', () => {
    const now = new Date('2026-08-06T06:00:00.000Z');

    expect(buildKundenFeedbackUpdates('abgelehnt', now).abgelehnt_am).toBe(now.toISOString());
    expect(buildKundenFeedbackUpdates('prio_1', now).abgelehnt_am).toBeNull();
  });

  it('laesst die Prozess-Felder komplett unberuehrt', () => {
    for (const feedback of [...FEEDBACK_FLAGS, '']) {
      const updates = buildKundenFeedbackUpdates(feedback);
      for (const feld of PROZESS_FELDER) {
        expect(feld in updates, `${feedback} beruehrt ${feld}`).toBe(false);
      }
    }
  });

  it('erkennt gueltige Feedback-Werte', () => {
    expect(isKundenFeedback('')).toBe(true);
    expect(isKundenFeedback('prio_1')).toBe(true);
    expect(isKundenFeedback('prio_2')).toBe(true);
    expect(isKundenFeedback('abgelehnt')).toBe(true);
    expect(isKundenFeedback('gebucht')).toBe(false);
    expect(isKundenFeedback('quatsch')).toBe(false);
  });
});

describe('getSourcingStatusMeta', () => {
  it('zeigt das Datum bei allen Status, die einen Zeitstempel fuehren', () => {
    expect(getSourcingStatusMeta({ on_hold: true, on_hold_am: '2026-07-29T06:00:00.000Z' })).toBe('29.7.2026');
    expect(getSourcingStatusMeta({ absage: true, absage_am: '2026-07-29T06:00:00.000Z' })).toBe('29.7.2026');
    expect(getSourcingStatusMeta({ angefragt: true, angefragt_am: '2026-07-29T06:00:00.000Z' })).toBe('29.7.2026');
    expect(getSourcingStatusMeta({ in_verhandlung: true, in_verhandlung_am: '2026-07-29T06:00:00.000Z' }))
      .toBe('29.7.2026');
    expect(getSourcingStatusMeta({ preis_zugesagt: true, preis_zugesagt_am: '2026-07-29T06:00:00.000Z' }))
      .toBe('29.7.2026');
    expect(getSourcingStatusMeta({ zusage: true, zusage_am: '2026-07-29T06:00:00.000Z' })).toBe('29.7.2026');
  });

  it('zeigt kein Datum bei Status ohne eigenen Zeitstempel', () => {
    expect(getSourcingStatusMeta({ gebucht: true, on_hold_am: '2026-07-29T06:00:00.000Z' })).toBe('');
    expect(getSourcingStatusMeta({ on_hold: true })).toBe('');
  });
});

describe('getKundenFeedbackMeta', () => {
  it('zeigt das Ablehnungsdatum nur bei Abgelehnt', () => {
    const item = { abgelehnt: true, abgelehnt_am: '2026-08-06T06:00:00.000Z' };

    expect(getKundenFeedbackMeta(item)).toBe('6.8.2026');
    expect(getKundenFeedbackMeta({ prio_1: true })).toBe('');
    expect(getKundenFeedbackMeta({})).toBe('');
  });
});

describe('Sourcing-Zeile – Status-Spalte', () => {
  it('rendert genau eine Status-Zelle statt der sieben Checkbox-Spalten', () => {
    const doc = renderRow({ on_hold: true });

    expect(doc.querySelectorAll('td.cp-col-status')).toHaveLength(1);
    expect(doc.querySelector('td.cp-col-onhold')).toBeNull();
    expect(doc.querySelector('td.cp-col-buchen')).toBeNull();
    expect(doc.querySelector('td.cp-col-prio1')).toBeNull();
    expect(doc.querySelector('td.cp-col-prio2')).toBeNull();
    expect(doc.querySelector('td.cp-col-absagen')).toBeNull();
    expect(doc.querySelector('td.cp-col-anfragen')).toBeNull();
    expect(doc.querySelector('td.cp-col-check')).toBeNull();
  });

  it('steht direkt hinter der Creator Art, gefolgt vom Kundenfeedback', () => {
    const spalten = Array.from(renderRow({}).querySelectorAll('tr > td'))
      .map(el => Array.from(el.classList).find(c => c.startsWith('cp-col-')));

    expect(spalten[spalten.indexOf('cp-col-typ') + 1]).toBe('cp-col-status');
    expect(spalten[spalten.indexOf('cp-col-status') + 1]).toBe('cp-col-kunden-feedback');
  });

  it('bietet nur die Prozess-Stufen an - Prio und Abgelehnt sind ins Feedback gewandert', () => {
    const select = renderRow({}).querySelector('td.cp-col-status .table-select');
    const werte = Array.from(select.querySelectorAll('.table-select__item')).map(el => el.dataset.value);

    expect(werte).toEqual(['offen', 'angefragt', 'in_verhandlung', 'preis_zugesagt', 'on_hold', 'zusage', 'gebucht', 'absage']);
    expect(select.querySelector('.table-select__item[data-value="prio_1"]')).toBeNull();
    expect(select.querySelector('.table-select__item[data-value="abgelehnt"]')).toBeNull();
  });

  it('nutzt die neuen Beschriftungen Gebucht und Abgesagt', () => {
    const select = renderRow({}).querySelector('td.cp-col-status .table-select');

    expect(select.querySelector('.table-select__item[data-value="gebucht"]').textContent.trim()).toBe('Gebucht');
    expect(select.querySelector('.table-select__item[data-value="absage"]').textContent.trim()).toBe('Abgesagt');
  });

  it('zeigt Preis zugesagt samt Datum im Trigger', () => {
    const select = renderRow({ preis_zugesagt: true, preis_zugesagt_am: '2026-08-17T06:00:00.000Z' })
      .querySelector('td.cp-col-status .table-select');

    expect(select.dataset.value).toBe('preis_zugesagt');
    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('Preis zugesagt');
    expect(select.querySelector('.table-select__meta').textContent.trim()).toBe('17.8.2026');
  });

  it('zeigt die Zusage samt Datum im Trigger', () => {
    const select = renderRow({ zusage: true, zusage_am: '2026-08-05T06:00:00.000Z' })
      .querySelector('td.cp-col-status .table-select');

    expect(select.dataset.value).toBe('zusage');
    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('Zusage');
    expect(select.querySelector('.table-select__meta').textContent.trim()).toBe('5.8.2026');
  });

  it('haengt das Anfragedatum als Meta-Zeile unter den Trigger', () => {
    // Das Datum stand vorher in der Checkbox-Spalte "Anfragen"
    const select = renderRow({ angefragt: true, angefragt_am: '2026-08-05T06:00:00.000Z' })
      .querySelector('td.cp-col-status .table-select');

    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('Angefragt');
    expect(select.querySelector('.table-select__meta').textContent.trim()).toBe('5.8.2026');
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
    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('Gebucht');
    expect(select.querySelector('.table-select__item.is-active').dataset.value).toBe('gebucht');
  });

  it('zeigt bei einem reinen Feedback-Flag den Status Offen', () => {
    // Prio ist kein Prozess-Status mehr - der Trigger faellt auf Offen zurueck
    const select = renderRow({ prio_1: true }).querySelector('td.cp-col-status .table-select');

    expect(select.dataset.value).toBe('offen');
    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('Offen');
  });

  it('haengt das On-Hold-Datum als Meta-Zeile unter den Trigger', () => {
    const select = renderRow({ on_hold: true, on_hold_am: '2026-07-29T06:00:00.000Z' })
      .querySelector('td.cp-col-status .table-select');

    expect(select.querySelector('.table-select__meta').textContent.trim()).toBe('29.7.2026');
  });

  it('zeigt Kunden den Status nur an - kein klickbarer Trigger', () => {
    const select = renderRow({}, { isKunde: true }).querySelector('td.cp-col-status .table-select');

    expect(select.querySelector('button.table-select__trigger')).toBeNull();
    expect(select.querySelector('.table-select__trigger--disabled')).not.toBeNull();
    expect(select.querySelector('.table-select__panel')).toBeNull();
  });

  it('zeigt Kunden auch eine gesetzte Absage nur als Label', () => {
    const select = renderRow({ absage: true }, { isKunde: true }).querySelector('td.cp-col-status .table-select');

    expect(select.querySelector('button.table-select__trigger')).toBeNull();
    expect(select.querySelector('.table-select__trigger--disabled')).not.toBeNull();
    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('Abgesagt');
  });

  it('rendert fuer Gaeste im Readonly-Modus keinen klickbaren Trigger', () => {
    const select = renderRow({ gebucht: true }, { gastReadonly: true }).querySelector('td.cp-col-status .table-select');

    expect(select.querySelector('button.table-select__trigger')).toBeNull();
    expect(select.querySelector('.table-select__panel')).toBeNull();
    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('Gebucht');
  });

  it('blendet die Status-Spalte aus, wenn sie versteckt ist', () => {
    const doc = renderRow({}, { hiddenColumns: ['cp-col-status'] });

    expect(doc.querySelector('td.cp-col-status').getAttribute('style')).toContain('display:none');
  });
});

describe('Sourcing-Zeile – Kundenfeedback-Spalte', () => {
  it('rendert einen eigenen Select mit dem Feld kunden_feedback', () => {
    const select = renderRow({}).querySelector('td.cp-col-kunden-feedback .table-select');

    expect(select.dataset.field).toBe('kunden_feedback');
    expect(select.dataset.itemId).toBe('i1');
  });

  it('bietet Leer, Prio 1, Prio 2 und Abgelehnt an', () => {
    const select = renderRow({}).querySelector('td.cp-col-kunden-feedback .table-select');
    const werte = Array.from(select.querySelectorAll('.table-select__item')).map(el => el.dataset.value);

    expect(werte).toEqual(['', 'prio_1', 'prio_2', 'abgelehnt']);
  });

  it('zeigt ohne Feedback die Leer-Option', () => {
    const select = renderRow({}).querySelector('td.cp-col-kunden-feedback .table-select');

    expect(select.dataset.value).toBe('');
    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('–');
  });

  it('zeigt die Prio im Trigger und markiert sie in der Optionsliste', () => {
    const select = renderRow({ prio_1: true }).querySelector('td.cp-col-kunden-feedback .table-select');

    expect(select.dataset.value).toBe('prio_1');
    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('Prio 1');
    expect(select.querySelector('.table-select__item.is-active').dataset.value).toBe('prio_1');
  });

  it('haengt das Ablehnungsdatum als Meta-Zeile unter den Trigger', () => {
    const select = renderRow({ abgelehnt: true, abgelehnt_am: '2026-08-06T06:00:00.000Z' })
      .querySelector('td.cp-col-kunden-feedback .table-select');

    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('Abgelehnt');
    expect(select.querySelector('.table-select__meta').textContent.trim()).toBe('6.8.2026');
  });

  it('bleibt fuer Kunden klickbar - es ist ihr Feedback', () => {
    const select = renderRow({}, { isKunde: true }).querySelector('td.cp-col-kunden-feedback .table-select');

    expect(select.querySelector('button.table-select__trigger')).not.toBeNull();
  });

  it('sperrt das Select fuer Gaeste im Readonly-Modus', () => {
    const select = renderRow({ prio_1: true }, { gastReadonly: true })
      .querySelector('td.cp-col-kunden-feedback .table-select');

    expect(select.querySelector('button.table-select__trigger')).toBeNull();
    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('Prio 1');
  });

  it('blendet die Spalte aus, wenn sie versteckt ist', () => {
    const doc = renderRow({}, { hiddenColumns: ['cp-col-kunden-feedback'] });

    expect(doc.querySelector('td.cp-col-kunden-feedback').getAttribute('style')).toContain('display:none');
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

  it('entfernt die o.-A.-Spalten und die beiden Checkbox-Spalten', () => {
    const alt = [
      'cp-col-cpm-ig-8-clean', 'cp-col-cpm-ig-30-clean',
      'cp-col-anfragen', 'cp-col-check', 'cp-col-notiz'
    ];

    expect(migrateHiddenColumns(alt)).toEqual(['cp-col-notiz']);
  });

  it('teilt die alte Links-Spalte weiterhin in IG und TT auf', () => {
    expect(migrateHiddenColumns(['cp-col-links'])).toEqual(['cp-col-link-ig', 'cp-col-link-tt']);
  });

  it('kommt mit fehlenden Werten klar', () => {
    expect(migrateHiddenColumns(null)).toEqual([]);
    expect(migrateHiddenColumns(undefined)).toEqual([]);
  });
});
