import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  absorbEditedTextFields,
  mergeKeepingFilled,
  mergeRealtimeRow,
  shouldPersistTextField
} from '../core/table/textFieldBaseline.js';
import { EntityCustomColumnsManager } from '../core/customColumns/EntityCustomColumnsManager.js';

vi.mock('../modules/creator-auswahl/CreatorAuswahlService.js', () => ({
  creatorAuswahlService: { updateItem: vi.fn(async () => ({})) }
}));

vi.mock('../modules/strategie/StrategieService.js', () => ({
  strategieService: { updateStrategieItem: vi.fn(async () => ({})) }
}));

import { creatorAuswahlService } from '../modules/creator-auswahl/CreatorAuswahlService.js';
import { CreatorAuswahlDetail } from '../modules/creator-auswahl/CreatorAuswahlDetail.js';
import { strategieService } from '../modules/strategie/StrategieService.js';
import { handleFieldUpdate } from '../modules/strategie/StrategieDetailTableEvents.js';
import { rerenderItemsTable } from '../modules/strategie/StrategieDetailRenderer.js';
import { StrategieDetail } from '../modules/strategie/StrategieDetail.js';
import { VideoTableEventBinder } from '../modules/kampagne/VideoTableEventBinder.js';

describe('eigene Spalten', () => {
  it('sichert einen geänderten Text vor dem Neuzeichnen und lässt eine unberührte Zelle stehen', () => {
    document.body.innerHTML = `
      <textarea class="custom-col-input" data-custom-column-id="c1" data-entity-id="e1">Neu</textarea>
      <input class="custom-col-input" data-custom-column-id="c2" data-entity-id="e1" />
    `;
    const [edited, untouched] = document.querySelectorAll('.custom-col-input');
    edited.dataset.fieldBaseline = '';
    const saved = [];
    absorbEditedTextFields(document.body, (el) => saved.push(el.getAttribute('data-custom-column-id')));
    expect(saved).toEqual(['c1']);
    expect(untouched.value).toBe('');
  });

  it('schreibt den Text in den Speicher, bevor der Server antwortet', async () => {
    const manager = new EntityCustomColumnsManager({
      parentType: 'sourcing',
      parentTable: 'creator_auswahl'
    });
    manager.values = { e1: { c1: '' } };
    let release;
    manager.dataLoader = {
      upsertValue: () => new Promise((resolve) => { release = resolve; })
    };
    manager.columns = [];

    const field = document.createElement('textarea');
    field.className = 'custom-col-input';
    field.dataset.customColumnId = 'c1';
    field.dataset.entityId = 'e1';
    field.value = 'Hook kürzer';
    field.dataset.fieldBaseline = '';

    const pending = manager.handleFieldUpdate(field);
    expect(manager.getValue('e1', 'c1')).toBe('Hook kürzer');
    release();
    await pending;
    expect(manager.getValue('e1', 'c1')).toBe('Hook kürzer');
  });
});

describe('mergeRealtimeRow', () => {
  it('lässt leere Caption und Anmerkung den vorhandenen Text stehen', () => {
    const item = { id: '1', caption: 'Jetzt shoppen', kunde_anmerkung: 'Bitte kürzer', status: 'alt' };
    mergeRealtimeRow(item, { id: '1', caption: null, kunde_anmerkung: '', transkript: null, status: 'neu' });
    expect(item.caption).toBe('Jetzt shoppen');
    expect(item.kunde_anmerkung).toBe('Bitte kürzer');
    expect(item.status).toBe('neu');
  });

  it('übernimmt einen neuen Text und eine bewusste Leerung, wenn lokal nichts steht', () => {
    const item = { caption: '', kunde_anmerkung: null };
    mergeRealtimeRow(item, { caption: 'Neuer Text', kunde_anmerkung: '' });
    expect(item.caption).toBe('Neuer Text');
    expect(item.kunde_anmerkung).toBe('');
  });
});

describe('mergeKeepingFilled', () => {
  it('behält gefüllte Zellen, wenn das Update leer ist, und übernimmt echte Werte inklusive 0', () => {
    const existing = { thema: 'Sommer', stats_views: 120, link_live: 'https://ig/reel', stats_error: 'timeout' };
    const patch = mergeKeepingFilled(existing, {
      thema: null,
      stats_views: 0,
      link_live: '',
      stats_error: null,
      link_content: 'https://dropbox/file'
    });

    expect(patch.thema).toBeUndefined();
    expect(patch.link_live).toBeUndefined();
    expect(patch.stats_error).toBeUndefined();
    expect(patch.stats_views).toBe(0);
    expect(patch.link_content).toBe('https://dropbox/file');
  });
});

describe('Konzept-Tabelle verliert Caption und Anmerkung nicht', () => {
  beforeEach(() => {
    strategieService.updateStrategieItem.mockClear();
    document.body.innerHTML = '';
  });

  it('speichert einen Blur ohne Änderung nicht', async () => {
    const field = document.createElement('textarea');
    field.dataset.field = 'kunde_anmerkung';
    field.dataset.itemId = '1';
    field.value = '';
    const detail = { isKunde: true, canEdit: false, items: [{ id: '1', kunde_anmerkung: 'Bitte kürzer' }] };

    await handleFieldUpdate(detail, field);

    expect(strategieService.updateStrategieItem).not.toHaveBeenCalled();
    expect(detail.items[0].kunde_anmerkung).toBe('Bitte kürzer');
  });

  it('speichert eine bewusste Leerung', async () => {
    const field = document.createElement('textarea');
    field.dataset.field = 'caption';
    field.dataset.itemId = '1';
    field.dataset.fieldBaseline = 'Alter Text';
    field.value = '';
    const detail = { isKunde: false, canEdit: true, items: [{ id: '1', caption: 'Alter Text' }] };

    await handleFieldUpdate(detail, field);

    expect(strategieService.updateStrategieItem).toHaveBeenCalledWith('1', { caption: '' });
    expect(detail.items[0].caption).toBe('');
  });

  it('übernimmt getippte Caption vor dem Neuzeichnen und lässt eine leere Anmerkung stehen', async () => {
    document.body.innerHTML = `
      <div class="table-container">
        <table class="strategie-items-table">
          <tr class="item-row" data-item-id="1">
            <textarea data-field="caption" data-item-id="1">Neu vom Kunden</textarea>
            <textarea data-field="kunde_anmerkung" data-item-id="1"></textarea>
          </tr>
        </table>
      </div>
    `;
    const caption = document.querySelector('[data-field="caption"]');
    caption.dataset.fieldBaseline = 'Alt';
    const detail = {
      isKunde: true,
      canEdit: false,
      hiddenColumns: [],
      customColumns: null,
      items: [{ id: '1', caption: 'Alt', kunde_anmerkung: 'Bitte kürzer' }],
      getTeilbereicheFromStrategie: () => [],
      _bindTableEvents: vi.fn()
    };

    rerenderItemsTable(detail);

    expect(strategieService.updateStrategieItem).toHaveBeenCalledTimes(1);
    expect(strategieService.updateStrategieItem).toHaveBeenCalledWith('1', expect.objectContaining({ caption: 'Neu vom Kunden' }));
    expect(detail.items[0].caption).toBe('Neu vom Kunden');
    expect(detail.items[0].kunde_anmerkung).toBe('Bitte kürzer');
  });

  it('ersetzt vorhandenen Text nicht durch ein leeres Realtime-Payload', () => {
    const detail = new StrategieDetail();
    detail.items = [{ id: '1', caption: 'Jetzt shoppen', kunde_anmerkung: 'Bitte kürzer' }];

    detail.handleItemRealtimeUpdate({ id: '1', caption: null, kunde_anmerkung: '' });

    expect(detail.items[0].caption).toBe('Jetzt shoppen');
    expect(detail.items[0].kunde_anmerkung).toBe('Bitte kürzer');
  });
});

describe('Sourcing-Tabelle verliert Kundenfeedback nicht', () => {
  let detail;

  beforeEach(() => {
    creatorAuswahlService.updateItem.mockClear();
    document.body.innerHTML = '';
    detail = new CreatorAuswahlDetail();
    detail.root = document.body;
    detail.isKunde = true;
    detail.liste = {};
    detail.hiddenColumns = [];
    detail.activeTab = 'alle';
    detail.items = [{ id: '1', name: 'Anna', feedback_kunde: 'Bitte kürzer' }];
    vi.spyOn(detail, 'bindEvents').mockImplementation(() => {});
    vi.spyOn(detail, 'updateTabCounts').mockImplementation(() => {});
  });

  it('speichert einen Blur ohne Änderung nicht', async () => {
    const field = document.createElement('textarea');
    field.dataset.field = 'feedback_kunde';
    field.dataset.itemId = '1';
    field.value = '';

    await detail.handleFieldUpdate(field);

    expect(creatorAuswahlService.updateItem).not.toHaveBeenCalled();
    expect(detail.items[0].feedback_kunde).toBe('Bitte kürzer');
  });

  it('speichert eine bewusste Leerung', async () => {
    const field = document.createElement('textarea');
    field.dataset.field = 'feedback_kunde';
    field.dataset.itemId = '1';
    field.dataset.fieldBaseline = 'Bitte kürzer';
    field.value = '';

    await detail.handleFieldUpdate(field);

    expect(creatorAuswahlService.updateItem).toHaveBeenCalledWith('1', expect.objectContaining({ feedback_kunde: null }));
    expect(detail.items[0].feedback_kunde).toBeNull();
  });

  it('übernimmt getipptes Feedback, bevor die Tabelle ersetzt wird', () => {
    document.body.innerHTML = `
      <div class="table-container">
        <textarea data-field="feedback_kunde" data-item-id="1">Hook kürzer</textarea>
      </div>
    `;
    const field = document.querySelector('textarea');
    field.dataset.fieldBaseline = '';
    detail.items[0].feedback_kunde = null;

    detail.rerenderTable();

    expect(creatorAuswahlService.updateItem).toHaveBeenCalledTimes(1);
    expect(detail.items[0].feedback_kunde).toBe('Hook kürzer');
    expect(document.querySelector('textarea[data-field="feedback_kunde"]').value).toBe('Hook kürzer');
  });
});

describe('Kampagnen-Tabelle speichert Caption nur nach einer Änderung', () => {
  let table;

  afterEach(() => {
    table?._abortController?.abort();
    document.body.innerHTML = '';
  });

  it('schreibt einen Blur auf eine leere Caption nicht', () => {
    document.body.innerHTML = `
      <div class="kooperation-video-grid">
        <textarea class="grid-textarea" data-entity="video" data-id="v1" data-field="caption"></textarea>
      </div>
    `;
    table = {
      handleFieldUpdate: vi.fn(),
      _feedbackBinding: { bind() {} },
      _rowHeightSync: null,
      initAutoResizeTextareas() {},
      bindResizeEvents() {},
      bindDragToScroll() {},
      columnDragHandler: { bind() {} },
      _closeStatusPortal() {}
    };
    new VideoTableEventBinder(table).bind();

    const field = document.querySelector('textarea');
    field.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    field.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

    expect(table.handleFieldUpdate).not.toHaveBeenCalled();
    expect(shouldPersistTextField(field)).toBe(false);
  });
});
