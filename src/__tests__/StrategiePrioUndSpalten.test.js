import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderItemRow, renderItemsTable, reorderStrategieItemsByKategorien } from '../modules/strategie/StrategieDetailRenderer.js';
import { syncRowTextClips, toggleTextClip } from '../modules/strategie/strategieTextClip.js';
import {
  getStrategiePrio,
  buildStrategiePrioUpdates,
  isStrategiePrio
} from '../modules/strategie/strategiePrioOptions.js';
import {
  isFixedColumnVisible,
  setFixedColumnVisibility
} from '../modules/strategie/strategieColumns.js';
import { renderKategorienDrawerBody, applyKategorieOrder } from '../modules/strategie/StrategieDetailKategorienDrawer.js';
import { strategieService } from '../modules/strategie/StrategieService.js';

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

  it('hat Plattform und keinen separaten Link-Header', () => {
    const html = renderItemsTable(detailStub({ items }));
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const header = [...doc.querySelectorAll('thead th')].map(th => th.textContent.trim());

    expect(header).toContain('Plattform');
    expect(header).not.toContain('Link');
    expect(doc.querySelector('th.col-link')).toBeNull();
  });
});

describe('renderItemRow – Plattform als Link', () => {
  it('macht das Plattform-Icon zum Link', () => {
    const doc = renderRow({ video_link: 'https://tiktok.com/x', plattform: 'tiktok' });
    const link = doc.querySelector('td.col-platform a.strategie-platform-link');

    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('https://tiktok.com/x');
    expect(doc.querySelector('.strategie-ext-link')).toBeNull();
    expect(doc.querySelector('td.col-link')).toBeNull();
  });

  it('nimmt bei unbekannter Plattform das Fallback-Icon', () => {
    const doc = renderRow({ video_link: 'https://example.com/x', plattform: 'other' });
    const link = doc.querySelector('td.col-platform a.strategie-platform-link');

    expect(link).toBeTruthy();
    expect(link.innerHTML.trim().length).toBeGreaterThan(0);
  });

  it('zeigt bei Ideen ohne URL einen Gedankenstrich', () => {
    const doc = renderRow({ video_link: null });
    expect(doc.querySelector('td.col-platform .strategie-cell-muted').textContent).toBe('-');
    expect(doc.querySelector('td.col-platform a')).toBeNull();
  });
});

describe('renderItemRow – Text-Clips', () => {
  it('packt Beschreibung, Transkript und Caption in einen Clip', () => {
    const doc = renderRow({ beschreibung: 'B', transkript: 'T', caption: 'C' });

    for (const sel of ['td.col-beschreibung', 'td.col-transkript', 'td.col-caption']) {
      const clip = doc.querySelector(`${sel} .strategie-text-clip`);
      expect(clip).toBeTruthy();
      const btn = clip.querySelector('.strategie-text-more');
      expect(btn).toBeTruthy();
      expect(btn.getAttribute('aria-label')).toBe('Mehr anzeigen');
      expect(btn.querySelector('.crm-icon')).toBeTruthy();
    }
  });
});

describe('strategieTextClip', () => {
  it('setzt die Row-Klasse wenn eine Zelle aufgeht', () => {
    const doc = renderRow({ beschreibung: 'B', transkript: 'T', caption: 'C' });
    const row = doc.querySelector('tr.item-row');
    const beschreibung = row.querySelector('td.col-beschreibung .strategie-text-clip');
    const transkript = row.querySelector('td.col-transkript .strategie-text-clip');

    toggleTextClip(beschreibung);
    expect(beschreibung.classList.contains('is-expanded')).toBe(true);
    expect(row.classList.contains('has-expanded-text')).toBe(true);
    expect(transkript.classList.contains('is-expanded')).toBe(false);
    expect(beschreibung.querySelector('.strategie-text-more').getAttribute('aria-label')).toBe('Weniger anzeigen');

    toggleTextClip(beschreibung);
    expect(row.classList.contains('has-expanded-text')).toBe(false);
  });

  it('laesst den Mehr-Button bei kurzem Text versteckt', () => {
    const doc = renderRow({ beschreibung: 'Kurz', transkript: 'Auch kurz', caption: 'C' });
    const row = doc.querySelector('tr.item-row');
    syncRowTextClips(row);
    expect(row.querySelectorAll('.strategie-text-more:not([hidden])')).toHaveLength(0);
  });

  it('zeigt Mehr wenn der Inhalt die Clip-Hoehe sprengt', () => {
    const doc = renderRow({ transkript: 'Lang' });
    const clip = doc.querySelector('td.col-transkript .strategie-text-clip');
    const body = clip.querySelector('.strategie-text-clip__body');
    const textarea = clip.querySelector('textarea');

    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 200 });
    Object.defineProperty(body, 'clientHeight', { configurable: true, value: 50 });

    syncRowTextClips(clip.closest('tr'));

    const btn = clip.querySelector('.strategie-text-more');
    expect(btn.hidden).toBe(false);
    expect(btn.getAttribute('aria-label')).toBe('Mehr anzeigen');
    expect(btn.querySelector('.crm-icon')).toBeTruthy();
    expect(clip.classList.contains('is-truncated')).toBe(true);
  });
});

describe('reorderStrategieItemsByKategorien', () => {
  it('verschiebt Videos mit ihrer Kategorie und behaelt die Reihenfolge in der Gruppe', () => {
    const items = [
      { id: 'a1', teilbereich: 'A', sortierung: 0 },
      { id: 'a2', teilbereich: 'A', sortierung: 1 },
      { id: 'b1', teilbereich: 'B', sortierung: 2 },
      { id: 'c1', teilbereich: 'C', sortierung: 3 }
    ];

    const reordered = reorderStrategieItemsByKategorien(items, ['C', 'A', 'B']);

    expect(reordered.map(i => i.id)).toEqual(['c1', 'a1', 'a2', 'b1']);
    expect(reordered.map(i => i.sortierung)).toEqual([0, 1, 2, 3]);
  });

  it('laesst Ohne Kategorie am Ende', () => {
    const items = [
      { id: 'o1', teilbereich: null, sortierung: 0 },
      { id: 'a1', teilbereich: 'A', sortierung: 1 },
      { id: 'b1', teilbereich: 'B', sortierung: 2 }
    ];

    const reordered = reorderStrategieItemsByKategorien(items, ['B', 'A']);
    expect(reordered.map(i => i.id)).toEqual(['b1', 'a1', 'o1']);
  });
});

describe('Strategie-Kategorien-Drawer Reihenfolge', () => {
  it('zeigt einen Drag-Griff an jeder Kategorie', () => {
    const html = renderKategorienDrawerBody({
      getTeilbereicheFromStrategie: () => ['Reels', 'Stories']
    });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('[data-action="drag-kategorie"]')).toHaveLength(2);
  });

  it('schreibt CSV und Item-Sortierung in der neuen Reihenfolge', async () => {
    window.toastSystem = { show: vi.fn() };
    const items = [
      { id: 'a1', teilbereich: 'A', sortierung: 0 },
      { id: 'b1', teilbereich: 'B', sortierung: 1 }
    ];
    const detail = {
      strategieId: 'strat-1',
      strategie: { teilbereich: 'A, B' },
      items,
      getTeilbereicheFromStrategie() {
        return (this.strategie.teilbereich || '').split(',').map(s => s.trim()).filter(Boolean);
      },
      rerenderItemsTable: vi.fn()
    };

    vi.spyOn(strategieService, 'updateStrategie').mockResolvedValue({});
    vi.spyOn(strategieService, 'updateItemsSortierungWithTeilbereich').mockResolvedValue();

    const didSave = await applyKategorieOrder(detail, ['B', 'A']);

    expect(didSave).toBe(true);
    expect(strategieService.updateStrategie).toHaveBeenCalledWith('strat-1', { teilbereich: 'B, A' });
    expect(strategieService.updateItemsSortierungWithTeilbereich).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'b1', teilbereich: 'B', sortierung: 0 }),
      expect.objectContaining({ id: 'a1', teilbereich: 'A', sortierung: 1 })
    ]);
    expect(detail.items.map(i => i.id)).toEqual(['b1', 'a1']);
    expect(detail.rerenderItemsTable).toHaveBeenCalled();
    delete window.toastSystem;
  });
});
