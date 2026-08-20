import { describe, it, expect, beforeEach } from 'vitest';
import { renderItemRow, renderItemsTable } from '../modules/strategie/StrategieDetailRenderer.js';
import {
  getStrategiePrio,
  buildStrategiePrioUpdates,
  isStrategiePrio
} from '../modules/strategie/strategiePrioOptions.js';
import {
  isFixedColumnVisible,
  setFixedColumnVisibility
} from '../modules/strategie/strategieColumns.js';

const FLAGS = ['prio_1', 'prio_2', 'nicht_umsetzen'];

function detailStub(overrides = {}) {
  return {
    isKunde: false,
    hiddenColumns: [],
    customColumns: null,
    items: [],
    getTeilbereicheFromStrategie: () => ['A'],
    ...overrides
  };
}

function renderRow(item, detailOverrides = {}) {
  const html = renderItemRow(detailStub(detailOverrides), { id: 'i1', ...item }, 0);
  return new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
}

beforeEach(() => {
  window.isGastReadonly = () => false;
  window.ActionsDropdown = { getHeroIcon: () => '' };
});

describe('getStrategiePrio – Rangfolge bei Altdaten mit mehreren Flags', () => {
  it('faellt ohne gesetztes Flag auf "offen" zurueck', () => {
    expect(getStrategiePrio({})).toBe('offen');
    expect(getStrategiePrio(null)).toBe('offen');
  });

  it('liefert das einzeln gesetzte Flag', () => {
    expect(getStrategiePrio({ prio_1: true })).toBe('prio_1');
    expect(getStrategiePrio({ prio_2: true })).toBe('prio_2');
    expect(getStrategiePrio({ nicht_umsetzen: true })).toBe('nicht_umsetzen');
  });

  it('bevorzugt "Nicht umsetzen", dann Prio 1', () => {
    expect(getStrategiePrio({ nicht_umsetzen: true, prio_1: true, prio_2: true })).toBe('nicht_umsetzen');
    expect(getStrategiePrio({ prio_1: true, prio_2: true })).toBe('prio_1');
  });
});

describe('buildStrategiePrioUpdates', () => {
  it('setzt je Wert genau ein Flag und nimmt die anderen zurueck', () => {
    for (const flag of FLAGS) {
      const updates = buildStrategiePrioUpdates(flag);
      expect(FLAGS.filter(f => updates[f] === true)).toEqual([flag]);
      expect(Object.keys(updates).sort()).toEqual([...FLAGS].sort());
    }
  });

  it('raeumt bei "offen" alle Flags ab', () => {
    expect(buildStrategiePrioUpdates('offen')).toEqual({
      prio_1: false,
      prio_2: false,
      nicht_umsetzen: false
    });
  });

  it('erkennt nur bekannte Werte', () => {
    expect(isStrategiePrio('prio_1')).toBe(true);
    expect(isStrategiePrio('offen')).toBe(true);
    expect(isStrategiePrio('quatsch')).toBe(false);
  });
});

describe('Sichtbarkeit der festen Spalten', () => {
  it('zeigt normale Spalten ohne Eintrag und versteckt sie mit "fixed:"', () => {
    expect(isFixedColumnVisible([], 'beschreibung')).toBe(true);
    expect(isFixedColumnVisible(['fixed:beschreibung'], 'beschreibung')).toBe(false);
  });

  it('zeigt Transkript und Caption ohne Eintrag standardmaessig', () => {
    expect(isFixedColumnVisible([], 'transkript')).toBe(true);
    expect(isFixedColumnVisible([], 'caption')).toBe(true);
    expect(isFixedColumnVisible(['fixed:transkript'], 'transkript')).toBe(false);
  });

  it('laesst nach dem Umschalten nie widerspruechliche Eintraege zurueck', () => {
    let hidden = ['custom:abc'];

    hidden = setFixedColumnVisibility(hidden, 'transkript', false);
    expect(isFixedColumnVisible(hidden, 'transkript')).toBe(false);
    // Pro Spalte hoechstens ein Eintrag - nie "fixed:" und "show:fixed:" zugleich
    expect(hidden.filter(e => e.includes('transkript'))).toHaveLength(1);

    hidden = setFixedColumnVisibility(hidden, 'transkript', true);
    expect(isFixedColumnVisible(hidden, 'transkript')).toBe(true);
    expect(hidden.filter(e => e.includes('transkript'))).toHaveLength(0);

    hidden = setFixedColumnVisibility(hidden, 'prio', false);
    expect(isFixedColumnVisible(hidden, 'prio')).toBe(false);

    // Eigene Spalten bleiben unberuehrt
    expect(hidden).toContain('custom:abc');
  });
});

describe('renderItemRow – Prio-Select statt drei Checkboxen', () => {
  it('rendert ein Select mit dem aktuellen Wert', () => {
    const doc = renderRow({ prio_1: true });
    const select = doc.querySelector('td.col-prio .table-select');

    expect(select).toBeTruthy();
    expect(select.dataset.field).toBe('strategie_prio');
    expect(select.dataset.value).toBe('prio_1');
    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('Prio 1');
  });

  it('hat keine Checkboxen mehr fuer die Prio-Flags', () => {
    const doc = renderRow({ prio_1: true });
    for (const flag of FLAGS) {
      expect(doc.querySelector(`input[data-field="${flag}"]`)).toBeNull();
    }
  });

  it('bleibt fuer Kunden klickbar - die Prio ist Kundenfeedback', () => {
    const doc = renderRow({ prio_2: true }, { isKunde: true });
    expect(doc.querySelector('td.col-prio button.table-select__trigger')).not.toBeNull();
    expect(doc.querySelector('td.col-prio .table-select__trigger--disabled')).toBeNull();
  });
});

describe('renderItemRow – Transkript, Caption und KI-Tag', () => {
  it('zeigt den Volltext in einer Textarea', () => {
    const doc = renderRow({ transkript: 'Hallo Welt', transkript_quelle: 'whisper' });
    const zelle = doc.querySelector('td.col-transkript');
    const textarea = zelle.querySelector('textarea[data-field="transkript"]');

    expect(textarea.dataset.itemId).toBe('i1');
    expect(textarea.textContent).toBe('Hallo Welt');
  });

  it('rendert leere Felder als leere Textareas', () => {
    const doc = renderRow({ transkript: null, caption: '' });

    expect(doc.querySelector('td.col-transkript textarea[data-field="transkript"]').textContent).toBe('');
    expect(doc.querySelector('td.col-caption textarea[data-field="caption"]')).toBeTruthy();
  });

  it('stellt Transkript und Caption fuer Kunden readonly dar', () => {
    const doc = renderRow({ transkript: 'Hallo', caption: 'Welt' }, { isKunde: true });

    expect(doc.querySelector('td.col-transkript textarea')).toBeNull();
    expect(doc.querySelector('td.col-transkript .cell-text-readonly').textContent).toBe('Hallo');
    expect(doc.querySelector('td.col-caption .cell-text-readonly').textContent).toBe('Welt');
  });

});

describe('renderItemRow – Fortschritt der Hintergrund-Verarbeitung', () => {
  it('zeigt den aktuellen Schritt im Klartext', () => {
    const doc = renderRow({ video_link: 'https://tiktok.com/x', verarbeitung_status: 'processing', verarbeitung_step: 'whisper' });
    expect(doc.querySelector('.verarbeitung-status--laeuft').textContent).toContain('Transkription');
  });

  it('nennt wartende Items die Warteschlange', () => {
    const doc = renderRow({ video_link: 'https://tiktok.com/x', verarbeitung_status: 'pending' });
    expect(doc.querySelector('.verarbeitung-status--laeuft').textContent).toContain('Warteschlange');
  });

  it('haengt den Fehlertext an den Hinweis und behaelt den Screenshot', () => {
    const doc = renderRow({
      video_link: 'https://tiktok.com/x',
      screenshot_url: 'https://cdn/bild.jpg',
      verarbeitung_status: 'error',
      verarbeitung_fehler: 'Transkript: Whisper fehlgeschlagen'
    });

    expect(doc.querySelector('img.strategie-screenshot')).toBeTruthy();
    expect(doc.querySelector('.verarbeitung-status--fehler').getAttribute('title'))
      .toBe('Transkript: Whisper fehlgeschlagen');
  });

  it('zeigt nichts an, wenn die Verarbeitung durch ist', () => {
    const doc = renderRow({ video_link: 'https://tiktok.com/x', screenshot_url: 'https://cdn/bild.jpg', verarbeitung_status: 'done' });
    expect(doc.querySelector('.verarbeitung-status')).toBeNull();
  });

  it('bietet "Neu verarbeiten" nur fuer Items mit Video an', () => {
    expect(renderRow({ video_link: 'https://tiktok.com/x' }).querySelector('[data-action="reprocess-item"]')).toBeTruthy();
    expect(renderRow({ video_link: null }).querySelector('[data-action="reprocess-item"]')).toBeNull();
  });
});

describe('renderItemsTable – Kopfzeile und colspan', () => {
  const items = [{ id: 'i1', teilbereich: 'A' }];

  it('fuehrt Prio 1, Prio 2 und Nicht umsetzen zu einer Spalte zusammen', () => {
    const html = renderItemsTable(detailStub({ items }));
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const header = [...doc.querySelectorAll('thead th')].map(th => th.textContent.trim());

    expect(header).toContain('Prio');
    expect(header).not.toContain('Prio 1');
    expect(header).not.toContain('Nicht umsetzen');
  });

  it('zaehlt den colspan der Gruppenzeile aus den sichtbaren Spalten', () => {
    const detail = detailStub({ items, hiddenColumns: ['show:fixed:transkript'] });
    const doc = new DOMParser().parseFromString(renderItemsTable(detail), 'text/html');

    const spalten = doc.querySelectorAll('thead th').length;
    const gruppe = doc.querySelector('.category-header-cell');
    expect(Number(gruppe.getAttribute('colspan'))).toBe(spalten);
  });
});
