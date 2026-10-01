import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  skriptStatusFuerCheckbox,
  skriptFreigegebenFuerStatus,
  patchVideoStoreFreigabe,
  patchVideoCheckboxDom,
  patchSkripteCache
} from '../modules/kampagne/skriptFreigabeSync.js';

describe('skriptStatusFuerCheckbox', () => {
  it('setzt freigegeben beim Anhaken', () => {
    expect(skriptStatusFuerCheckbox(true, 'entwurf')).toBe('freigegeben');
    expect(skriptStatusFuerCheckbox(true, 'final')).toBe('freigegeben');
    expect(skriptStatusFuerCheckbox(true, 'freigegeben')).toBe('freigegeben');
  });

  it('nimmt eine bestehende Freigabe auf final zurück', () => {
    expect(skriptStatusFuerCheckbox(false, 'freigegeben')).toBe('final');
  });

  it('lässt andere Status beim Abhaken unangetastet', () => {
    expect(skriptStatusFuerCheckbox(false, 'entwurf')).toBe('entwurf');
    expect(skriptStatusFuerCheckbox(false, 'final')).toBe('final');
    expect(skriptStatusFuerCheckbox(false, null)).toBe(null);
  });
});

describe('skriptFreigegebenFuerStatus', () => {
  it('ist nur bei freigegeben true', () => {
    expect(skriptFreigegebenFuerStatus('freigegeben')).toBe(true);
    expect(skriptFreigegebenFuerStatus('final')).toBe(false);
    expect(skriptFreigegebenFuerStatus('entwurf')).toBe(false);
    expect(skriptFreigegebenFuerStatus('archiviert')).toBe(false);
  });
});

describe('patchVideoStoreFreigabe', () => {
  function storeStub() {
    return {
      videos: {
        k1: [
          { id: 'v1', skript_id: 's1', skript_freigegeben: false, skript: { id: 's1', status: 'final' } },
          { id: 'v2', skript_id: 's1', skript_freigegeben: false, skript: { id: 's1', status: 'final' } },
          { id: 'v3', skript_id: 's2', skript_freigegeben: false, skript: { id: 's2', status: 'entwurf' } }
        ]
      },
      updateVideo: vi.fn(function (id, patch) {
        for (const list of Object.values(this.videos)) {
          const idx = list.findIndex((v) => v.id === id);
          if (idx !== -1) list[idx] = { ...list[idx], ...patch };
        }
      })
    };
  }

  it('patcht alle Videos desselben Skripts, keine fremden', () => {
    const store = storeStub();
    patchVideoStoreFreigabe(store, 's1', { freigegeben: true, status: 'freigegeben' });

    expect(store.videos.k1[0].skript_freigegeben).toBe(true);
    expect(store.videos.k1[1].skript_freigegeben).toBe(true);
    expect(store.videos.k1[0].skript.status).toBe('freigegeben');
    expect(store.videos.k1[2].skript_freigegeben).toBe(false);
    expect(store.videos.k1[2].skript.status).toBe('entwurf');
    expect(store.updateVideo).toHaveBeenCalledTimes(2);
  });

  it('patcht auch virtuell über das Konzept zugeordnete Videos (nur skript.id)', () => {
    const store = storeStub();
    store.videos.k1[2].skript_id = null;
    store.videos.k1[2].skript = { id: 's1', status: 'final' };
    patchVideoStoreFreigabe(store, 's1', { freigegeben: true, status: 'freigegeben' });

    expect(store.videos.k1[2].skript_freigegeben).toBe(true);
    expect(store.videos.k1[2].skript.status).toBe('freigegeben');
    expect(store.updateVideo).toHaveBeenCalledTimes(3);
  });

  it('toleriert fehlenden Store', () => {
    expect(() => patchVideoStoreFreigabe(null, 's1', { freigegeben: true, status: 'freigegeben' })).not.toThrow();
  });
});

describe('patchVideoCheckboxDom', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('setzt nur die Checkboxen der Videos mit dieser skript_id', () => {
    document.body.innerHTML = `
      <input type="checkbox" data-entity="video" data-id="v1" data-field="skript_freigegeben">
      <input type="checkbox" data-entity="video" data-id="v2" data-field="skript_freigegeben" checked>
      <input type="checkbox" data-entity="video" data-id="v3" data-field="skript_freigegeben">
    `;
    const store = {
      videos: {
        k1: [
          { id: 'v1', skript_id: 's1' },
          { id: 'v2', skript_id: 's2' }
        ]
      }
    };
    patchVideoCheckboxDom('s1', true, store);

    expect(document.querySelector('[data-id="v1"]').checked).toBe(true);
    expect(document.querySelector('[data-id="v2"]').checked).toBe(true); // unangetastet
    expect(document.querySelector('[data-id="v3"]').checked).toBe(false);
  });

  it('setzt auch Checkboxen virtuell zugeordneter Videos (nur skript.id)', () => {
    document.body.innerHTML = `
      <input type="checkbox" data-entity="video" data-id="v9" data-field="skript_freigegeben">
    `;
    const store = {
      videos: { k1: [{ id: 'v9', skript_id: null, skript: { id: 's1', status: 'final' } }] }
    };
    patchVideoCheckboxDom('s1', true, store);
    expect(document.querySelector('[data-id="v9"]').checked).toBe(true);
  });
});

describe('patchSkripteCache', () => {
  it('patched den Cache und zeichnet das Pane über patchWorkflowItem neu', () => {
    const detail = { _workflowData: { skripte: [{ id: 's1', status: 'final' }] } };
    const patchWorkflowItem = vi.fn();
    patchSkripteCache(detail, 's1', 'freigegeben', patchWorkflowItem);
    expect(patchWorkflowItem).toHaveBeenCalledWith(detail, 'skripte', 's1', { status: 'freigegeben' });
  });

  it('ignoriert Skripte, die nicht im Cache liegen', () => {
    const detail = { _workflowData: { skripte: [{ id: 's1', status: 'final' }] } };
    const patchWorkflowItem = vi.fn();
    patchSkripteCache(detail, 'sX', 'freigegeben', patchWorkflowItem);
    expect(patchWorkflowItem).not.toHaveBeenCalled();
  });
});
