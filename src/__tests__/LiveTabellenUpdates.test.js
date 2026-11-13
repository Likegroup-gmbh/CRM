import { describe, it, expect, afterEach, vi } from 'vitest';
import { VideoTableRealtimeHandler } from '../modules/kampagne/VideoTableRealtimeHandler.js';
import { KampagneDetailStore } from '../modules/kampagne/KampagneDetailStore.js';
import {
  renderZeitkommentarList,
  zeitkommentareFuerSlot,
  zeitkommentarSelection
} from '../modules/kampagne/videoTableZeitkommentare.js';
import { VIDEO_FEEDBACK_FIELDS } from '../core/VideoFeedbackBuckets.js';
import { applyCastingRowUpdate, handleCastingRealtime } from '../modules/creator-auswahl/castingRealtime.js';
import { EntityCustomColumnsManager } from '../core/customColumns/EntityCustomColumnsManager.js';

const kundeR1 = VIDEO_FEEDBACK_FIELDS.find(s => s.field === 'feedback_kunde_r1');
const kundeR3 = VIDEO_FEEDBACK_FIELDS.find(s => s.field === 'feedback_kunde_r3');

function zeit(overrides = {}) {
  return {
    id: 'z1', video_id: 'v1', runde: 1, feedback_typ: 'kunde', text: 'approved',
    timecode_sec: 29.51, asset_id: 'a1', author_name: 'Angelika', created_at: '2026-11-06T09:24:41Z',
    deleted_at: null, ...overrides
  };
}

function videoTable() {
  const store = new KampagneDetailStore('k');
  store.kooperationen = [{ id: 'koop1' }];
  store.videos = { koop1: [{ id: 'v1', kooperation_id: 'koop1' }] };
  return {
    store,
    get kooperationen() { return store.kooperationen; },
    get videos() { return store.videos; },
    get videoComments() { return store.videoComments; },
    get stillComments() { return store.stillComments; },
    get zeitkommentare() { return store.zeitkommentare; },
    feedbackSaveController: { isDirty: () => false, acceptRemoteValue: vi.fn() },
    _rowHeightSync: { schedule() {} },
    refilter: vi.fn()
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  delete window.supabase;
});

describe('Kommentare aus dem Videos-Tab in der Feedback-Zelle', () => {
  it('ordnet Version 3 und höher der dritten Runde zu, getrennt nach Rolle', () => {
    const list = [zeit({ id: 'a', runde: 4 }), zeit({ id: 'b', runde: 3, feedback_typ: 'cj' }), zeit({ id: 'c', runde: 1 })];
    expect(zeitkommentareFuerSlot(list, kundeR3).map(c => c.id)).toEqual(['a']);
    expect(zeitkommentareFuerSlot(list, kundeR1).map(c => c.id)).toEqual(['c']);
  });

  it('zeigt Zeitstempel, Text und Autor und escaped den Text', () => {
    const html = renderZeitkommentarList([zeit({ text: '<b>Code</b> tiefer' })], { id: 'v1', kooperation_id: 'koop1' }, kundeR1);
    document.body.innerHTML = html;
    const item = document.querySelector('.feedback-zeit-item');
    expect(item.querySelector('.feedback-zeit-tc').textContent).toBe('0:29');
    expect(item.querySelector('.feedback-zeit-text').textContent).toBe('<b>Code</b> tiefer');
    expect(item.querySelector('b')).toBeNull();
    expect(item.querySelector('.feedback-zeit-author').textContent).toBe('Angelika');
  });

  it('öffnet die Datei der Schleife im Videos-Tab', () => {
    document.body.innerHTML = renderZeitkommentarList([zeit({ runde: 2, asset_id: 'a9' })], { id: 'v1', kooperation_id: 'koop1' }, VIDEO_FEEDBACK_FIELDS.find(s => s.field === 'feedback_kunde_r2'));
    expect(zeitkommentarSelection(document.querySelector('.feedback-zeit-item'))).toEqual({
      kooperationId: 'koop1', videoId: 'v1', folderId: 's2', itemId: 'a9'
    });
  });

  it('Kommentar an Bild bzw. Story: Label und Link auf die Datei', () => {
    const list = [
      zeit({ id: 'b', asset_id: null, still_asset_id: 'b1', timecode_sec: null }),
      zeit({ id: 's', asset_id: null, story_asset_id: 's1', timecode_sec: 4 })
    ];
    document.body.innerHTML = renderZeitkommentarList(list, { id: 'v1', kooperation_id: 'koop1' }, kundeR1);
    const [bild, story] = document.querySelectorAll('.feedback-zeit-item');
    expect(bild.querySelector('.feedback-zeit-art').textContent).toBe('Bild');
    expect(bild.querySelector('.feedback-zeit-tc')).toBeNull();
    expect(zeitkommentarSelection(bild).itemId).toBe('b1');
    expect(story.querySelector('.feedback-zeit-art').textContent).toBe('Story');
    expect(story.querySelector('.feedback-zeit-tc').textContent).toBe('0:04');
    expect(zeitkommentarSelection(story).itemId).toBe('s1');
    document.body.innerHTML = renderZeitkommentarList([zeit()], { id: 'v1', kooperation_id: 'koop1' }, kundeR1);
    expect(document.querySelector('.feedback-zeit-art')).toBeNull();
  });

  it('erscheint live und verschwindet beim Löschen', () => {
    const table = videoTable();
    document.body.innerHTML = `<div class="feedback-zeit-list" data-zeit-video-id="v1" data-zeit-field="feedback_kunde_r1"></div>`;
    const handler = new VideoTableRealtimeHandler(table);

    handler.handleZeitkommentarChange({ eventType: 'INSERT', new: zeit() });
    expect(document.querySelectorAll('.feedback-zeit-item')).toHaveLength(1);

    handler.handleZeitkommentarChange({ eventType: 'DELETE', new: {}, old: zeit() });
    expect(document.querySelectorAll('.feedback-zeit-item')).toHaveLength(0);
    expect(table.store.zeitkommentare.v1).toEqual([]);
  });

  it('ignoriert Kommentare fremder Kampagnen', () => {
    const table = videoTable();
    new VideoTableRealtimeHandler(table).handleZeitkommentarChange({ eventType: 'INSERT', new: zeit({ video_id: 'fremd' }) });
    expect(table.store.zeitkommentare.fremd).toBeUndefined();
  });
});

describe('Eigene Spalten der Kampagne live', () => {
  function withColumn(table) {
    table.store.customColumns = [{ id: 'c1' }];
    return table;
  }

  it('schreibt den Wert der anderen Seite in die Kommentar-Spalte', () => {
    const table = withColumn(videoTable());
    document.body.innerHTML = `<textarea data-custom-column-id="c1" data-entity-id="v1"></textarea>`;
    new VideoTableRealtimeHandler(table).handleCustomValueChange({
      eventType: 'UPDATE', new: { custom_column_id: 'c1', entity_id: 'v1', value: 'Bitte heller' }
    });
    expect(document.querySelector('textarea').value).toBe('Bitte heller');
    expect(table.store.getCustomColumnValue('v1', 'c1')).toBe('Bitte heller');
    expect(table.feedbackSaveController.acceptRemoteValue).toHaveBeenCalled();
  });

  it('überschreibt kein Feld, in dem gerade getippt wird', () => {
    const table = withColumn(videoTable());
    document.body.innerHTML = `<textarea data-custom-column-id="c1" data-entity-id="v1">Mein Text</textarea>`;
    document.querySelector('textarea').focus();
    new VideoTableRealtimeHandler(table).handleCustomValueChange({
      eventType: 'UPDATE', new: { custom_column_id: 'c1', entity_id: 'v1', value: 'Fremd' }
    });
    expect(document.querySelector('textarea').value).toBe('Mein Text');
    expect(table.store.getCustomColumnValue('v1', 'c1')).toBeNull();
  });

  it('ignoriert Spalten anderer Kampagnen', () => {
    const table = withColumn(videoTable());
    document.body.innerHTML = `<textarea data-custom-column-id="c2" data-entity-id="v1"></textarea>`;
    new VideoTableRealtimeHandler(table).handleCustomValueChange({
      eventType: 'UPDATE', new: { custom_column_id: 'c2', entity_id: 'v1', value: 'x' }
    });
    expect(document.querySelector('textarea').value).toBe('');
  });
});

describe('Bild-Feedback live', () => {
  it('aktualisiert Store und offenen Player', () => {
    const table = videoTable();
    document.body.innerHTML = `<textarea data-entity="still" data-id="v1" data-field="feedback_kunde_r1"></textarea>`;
    new VideoTableRealtimeHandler(table).handleStillCommentChange({
      eventType: 'INSERT', new: { video_id: 'v1', runde: 1, feedback_typ: 'kunde', text: 'Bild 2 tauschen', deleted_at: null }
    });
    expect(table.store.stillComments.v1.kundeR1[0].text).toBe('Bild 2 tauschen');
    expect(document.querySelector('textarea').value).toBe('Bild 2 tauschen');
  });
});

describe('Casting live', () => {
  function casting(items) {
    return {
      items,
      selectedItems: new Set(),
      _q: (sel) => document.querySelector(sel),
      refreshItemRow: vi.fn(),
      refreshNumberCell: vi.fn(),
      rerenderTable: vi.fn()
    };
  }

  it('zeigt das Kundenfeedback ohne Neuladen', () => {
    document.body.innerHTML = `<table><tr class="item-row" data-item-id="i1"><td>
      <textarea data-item-id="i1" data-field="feedback_kunde"></textarea></td></tr></table>`;
    const detail = casting([{ id: 'i1', feedback_kunde: null }]);
    const result = applyCastingRowUpdate(detail, { id: 'i1', feedback_kunde: 'Passt gut', updated_at: 'x' });
    expect(result).toBe('applied');
    expect(document.querySelector('textarea').value).toBe('Passt gut');
    expect(detail.items[0].feedback_kunde).toBe('Passt gut');
  });

  it('lässt ein gerade bearbeitetes Feld stehen', () => {
    document.body.innerHTML = `<table><tr class="item-row" data-item-id="i1"><td>
      <textarea data-item-id="i1" data-field="feedback_kunde">Ich tippe</textarea></td></tr></table>`;
    document.querySelector('textarea').focus();
    const detail = casting([{ id: 'i1', feedback_kunde: null }]);
    applyCastingRowUpdate(detail, { id: 'i1', feedback_kunde: 'Fremd' });
    expect(document.querySelector('textarea').value).toBe('Ich tippe');
    expect(detail.items[0].feedback_kunde).toBeNull();
  });

  it('zeichnet die Zeile neu, wenn ein Feld kein Eingabefeld hat (z. B. Kunden-Auswahl)', () => {
    document.body.innerHTML = `<table><tr class="item-row" data-item-id="i1"><td></td></tr></table>`;
    const detail = casting([{ id: 'i1', kunden_feedback: null }]);
    applyCastingRowUpdate(detail, { id: 'i1', kunden_feedback: 'ja' });
    expect(detail.refreshItemRow).toHaveBeenCalledWith('i1');
  });

  it('tut beim eigenen Echo nichts', () => {
    const detail = casting([{ id: 'i1', feedback_kunde: 'Gleich' }]);
    expect(applyCastingRowUpdate(detail, { id: 'i1', feedback_kunde: 'Gleich', updated_at: 'neu' })).toBe('unchanged');
  });

  it('entfernt gelöschte Einträge und ignoriert fremde', async () => {
    const detail = casting([{ id: 'i1' }]);
    await handleCastingRealtime(detail, { eventType: 'DELETE', new: {}, old: { id: 'fremd' } });
    expect(detail.items).toHaveLength(1);
    await handleCastingRealtime(detail, { eventType: 'DELETE', new: {}, old: { id: 'i1' } });
    expect(detail.items).toHaveLength(0);
    expect(detail.rerenderTable).toHaveBeenCalled();
  });

  it('lädt neue Einträge mit Joins nach', async () => {
    const detail = casting([{ id: 'i1' }]);
    const loadItems = vi.fn().mockResolvedValue([{ id: 'i1' }, { id: 'i2', creator: { name: 'X' } }]);
    await handleCastingRealtime(detail, { eventType: 'INSERT', new: { id: 'i2' } }, { loadItems });
    expect(detail.items.map(i => i.id)).toEqual(['i1', 'i2']);
    expect(detail.items[1].creator).toEqual({ name: 'X' });
  });
});

describe('Eigene Spalten in Casting und Konzept live', () => {
  function manager() {
    const m = new EntityCustomColumnsManager({ parentType: 'sourcing', parentTable: 'creator_auswahl' });
    m.columns = [{ id: 'c1' }];
    return m;
  }

  it('übernimmt den Wert und patcht das Feld', () => {
    document.body.innerHTML = `<input data-custom-column-id="c1" data-entity-id="i1" value="" />`;
    const m = manager();
    expect(m.applyRemoteChange({ eventType: 'UPDATE', new: { custom_column_id: 'c1', entity_id: 'i1', value: 'Top' } }, { root: document.body })).toBe(true);
    expect(document.querySelector('input').value).toBe('Top');
    expect(m.getValue('i1', 'c1')).toBe('Top');
  });

  it('zeichnet Upload- oder Nur-Lese-Zellen neu', () => {
    document.body.innerHTML = `<table><tr><td data-custom-col-id="custom:c1"><span>-</span></td></tr></table>`;
    const onRerender = vi.fn();
    manager().applyRemoteChange({ eventType: 'UPDATE', new: { custom_column_id: 'c1', entity_id: 'i1', value: 'https://x' } }, { root: document.body, onRerender });
    expect(onRerender).toHaveBeenCalled();
  });

  it('ignoriert Spalten anderer Listen', () => {
    const m = manager();
    expect(m.applyRemoteChange({ eventType: 'UPDATE', new: { custom_column_id: 'c9', entity_id: 'i1', value: 'x' } }, { root: document.body })).toBe(false);
  });
});
