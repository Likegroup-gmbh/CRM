// SkriptEditorBlocks.test.js
// Skript-Dokument (ADR 0062): Bearbeiten, Speichern mit Revision und
// Konflikt-Dialog, Undo, Enter/Backspace und dass die Skript-Tabelle als
// DOM-Knoten beim Neurendern stehen bleibt.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../modules/skripte/SkripteService.js', () => ({
  skripteService: {
    saveDokumentBloecke: vi.fn(),
    loadDokumentBloecke: vi.fn(),
    skriptBildUrl: vi.fn((pfad) => `https://cdn/${pfad}`),
    uploadSkriptBild: vi.fn()
  }
}));

import { skripteService } from '../modules/skripte/SkripteService.js';
import { SkriptEditorBlocks } from '../modules/skripte/editor/SkriptEditorBlocks.js';
import { dokumentHtml } from '../modules/skripte/editor/dokument/blockRenderer.js';
import { SKRIPT_TABELLE_ID } from '../modules/skripte/editor/dokument/blockModell.js';
import { selectRenderedRange } from '../core/utils/inlineFormat.js';

function setup(bloecke, { rev = 3 } = {}) {
  const skript = { id: 's1', dokument_bloecke: bloecke, dokument_bloecke_rev: rev };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const view = { skript, container, kannBloeckeEditieren: true, _toolbar: null };
  const blocks = new SkriptEditorBlocks(view);
  blocks.sync(skript);
  container.innerHTML = `<div class="skripte-editor">${dokumentHtml(skript.dokument_bloecke, {
    editierbar: true, mitIntern: true, skriptTabelleHtml: '<table id="grid"><tr><td data-feld="hook">Hook</td></tr></table>'
  })}</div>`;
  blocks.attach(container);
  return { skript, container, view, blocks };
}

function zelle(container, blockId, sel = '[data-block-feld]') {
  return container.querySelector(`[data-block-id="${blockId}"] ${sel}`);
}

function tippe(el, text) {
  el.textContent = text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function taste(el, key, opts = {}) {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
  el.dispatchEvent(e);
  return e;
}

beforeEach(() => {
  vi.useFakeTimers();
  skripteService.saveDokumentBloecke.mockReset();
  skripteService.loadDokumentBloecke.mockReset();
  window.toastSystem = { error: vi.fn(), info: vi.fn(), success: vi.fn() };
  window.confirmationModal = { open: vi.fn() };
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('SkriptEditorBlocks: Speichern', () => {
  it('Tippen aktualisiert Modell und Skript, speichert entprellt mit Revision', async () => {
    skripteService.saveDokumentBloecke.mockResolvedValue({ konflikt: false, rev: 4 });
    const { container, blocks, skript } = setup([{ id: 'a', typ: 'absatz', md: '' }, { id: SKRIPT_TABELLE_ID, typ: 'skript_tabelle' }]);
    tippe(zelle(container, 'a'), 'Hallo');
    expect(blocks.bloecke[0].md).toBe('Hallo');
    expect(skript.dokument_bloecke).toBe(blocks.bloecke);
    expect(skripteService.saveDokumentBloecke).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(900);
    expect(skripteService.saveDokumentBloecke).toHaveBeenCalledTimes(1);
    const [id, stand, rev] = skripteService.saveDokumentBloecke.mock.calls[0];
    expect(id).toBe('s1');
    expect(rev).toBe(3);
    expect(stand.map((b) => b.id)).toEqual(['a', SKRIPT_TABELLE_ID]);
    expect(blocks.rev).toBe(4);
    expect(skript.dokument_bloecke_rev).toBe(4);
    expect(blocks.dirty).toBe(false);
  });

  it('Nur die Skript-Tabelle uebrig: gespeichert wird null', async () => {
    skripteService.saveDokumentBloecke.mockResolvedValue({ konflikt: false, rev: 4 });
    const { blocks } = setup([{ id: 'a', typ: 'absatz', md: 'x' }, { id: SKRIPT_TABELLE_ID, typ: 'skript_tabelle' }]);
    blocks.griffAktion('a', 'loeschen');
    await blocks.flush();
    expect(skripteService.saveDokumentBloecke.mock.calls[0][1]).toBeNull();
  });

  it('Konflikt + "Meinen Stand speichern": neue Revision holen und ueberschreiben', async () => {
    skripteService.saveDokumentBloecke
      .mockResolvedValueOnce({ konflikt: true })
      .mockResolvedValueOnce({ konflikt: false, rev: 8 });
    skripteService.loadDokumentBloecke.mockResolvedValue({ bloecke: null, rev: 7 });
    window.confirmationModal.open.mockResolvedValue({ confirmed: true });
    const { container, blocks } = setup([{ id: 'a', typ: 'absatz', md: '' }]);
    tippe(zelle(container, 'a'), 'meins');
    await vi.advanceTimersByTimeAsync(900);
    await vi.runAllTimersAsync();
    expect(window.confirmationModal.open).toHaveBeenCalledTimes(1);
    expect(skripteService.saveDokumentBloecke).toHaveBeenCalledTimes(2);
    expect(skripteService.saveDokumentBloecke.mock.calls[1][2]).toBe(7);
    expect(blocks.rev).toBe(8);
    expect(blocks.bloecke.find((b) => b.id === 'a').md).toBe('meins');
  });

  it('Konflikt + "Anderen Stand laden": fremder Stand, Undo holt den eigenen zurueck', async () => {
    skripteService.saveDokumentBloecke.mockResolvedValueOnce({ konflikt: true });
    skripteService.loadDokumentBloecke.mockResolvedValue({
      bloecke: [{ id: SKRIPT_TABELLE_ID, typ: 'skript_tabelle' }, { id: 'f', typ: 'absatz', md: 'fremd' }],
      rev: 9
    });
    window.confirmationModal.open.mockResolvedValue({ confirmed: false });
    const { container, blocks } = setup([{ id: 'a', typ: 'absatz', md: '' }]);
    tippe(zelle(container, 'a'), 'meins');
    await vi.advanceTimersByTimeAsync(900);
    await vi.runAllTimersAsync();
    expect(blocks.rev).toBe(9);
    expect(blocks.bloecke.map((b) => b.md).filter(Boolean)).toEqual(['fremd']);
    expect(container.textContent).toContain('fremd');

    blocks.rueckgaengig();
    expect(blocks.bloecke.find((b) => b.id === 'a')?.md).toBe('meins');
  });
});

describe('SkriptEditorBlocks: Struktur', () => {
  it('Neurendern behaelt den DOM-Knoten der Skript-Tabelle', () => {
    const { container, blocks } = setup([{ id: 'a', typ: 'absatz', md: 'x' }]);
    const grid = container.querySelector('#grid');
    blocks.griffAktion('a', 'absatz_danach');
    expect(container.querySelector('#grid')).toBe(grid);
    expect(blocks.bloecke).toHaveLength(3);
  });

  it('Skript-Tabelle laesst sich nicht loeschen und nicht intern schalten', () => {
    const { blocks } = setup([{ id: 'a', typ: 'absatz', md: 'x' }]);
    blocks.griffAktion(SKRIPT_TABELLE_ID, 'loeschen');
    blocks.griffAktion(SKRIPT_TABELLE_ID, 'intern');
    expect(blocks.bloecke.find((b) => b.id === SKRIPT_TABELLE_ID)).toEqual({ id: SKRIPT_TABELLE_ID, typ: 'skript_tabelle' });
  });

  it('intern-Schalter, Undo und Redo', () => {
    const { blocks, container } = setup([{ id: 'a', typ: 'absatz', md: 'x' }]);
    blocks.griffAktion('a', 'intern');
    expect(blocks.bloecke.find((b) => b.id === 'a').intern).toBe(true);
    expect(container.querySelector('[data-block-id="a"]').classList.contains('is-intern')).toBe(true);
    blocks.rueckgaengig();
    expect(blocks.bloecke.find((b) => b.id === 'a').intern).toBe(false);
    blocks.wiederholen();
    expect(blocks.bloecke.find((b) => b.id === 'a').intern).toBe(true);
  });

  it('Enter mitten im Absatz teilt ihn, Formatierung bleibt gueltig', () => {
    const { container, blocks } = setup([{ id: 'a', typ: 'absatz', md: '**fett text**' }]);
    const el = zelle(container, 'a');
    selectRenderedRange(el, 4);
    const e = taste(el, 'Enter');
    expect(e.defaultPrevented).toBe(true);
    const absaetze = blocks.bloecke.filter((b) => b.typ === 'absatz');
    expect(absaetze.map((b) => b.md)).toEqual(['**fett**', '** text**']);
  });

  it('Enter auf leerem Listenpunkt verlaesst die Liste', () => {
    const { container, blocks } = setup([{ id: 'l', typ: 'liste', punkte: ['eins', ''] }]);
    const leer = zelle(container, 'l', '[data-block-feld="punkte"][data-index="1"]');
    selectRenderedRange(leer, 0);
    taste(leer, 'Enter');
    expect(blocks.bloecke.find((b) => b.id === 'l').punkte).toEqual(['eins']);
    expect(blocks.bloecke.at(-1).typ).toBe('absatz');
  });

  it('Backspace am Anfang haengt den Absatz an den vorherigen', () => {
    const { container, blocks } = setup([
      { id: SKRIPT_TABELLE_ID, typ: 'skript_tabelle' },
      { id: 'a', typ: 'absatz', md: 'Eins' },
      { id: 'b', typ: 'absatz', md: 'Zwei' }
    ]);
    const el = zelle(container, 'b');
    selectRenderedRange(el, 0);
    taste(el, 'Backspace');
    expect(blocks.bloecke.map((b) => b.id)).toEqual([SKRIPT_TABELLE_ID, 'a']);
    expect(blocks.bloecke[1].md).toBe('EinsZwei');
  });

  it('Eingaben in Grid-Zellen ignoriert der Block-Editor', () => {
    const { container, blocks } = setup([{ id: 'a', typ: 'absatz', md: 'x' }]);
    const vorher = JSON.stringify(blocks.bloecke);
    tippe(container.querySelector('[data-feld="hook"]'), 'neu');
    expect(JSON.stringify(blocks.bloecke)).toBe(vorher);
    expect(blocks.dirty).toBe(false);
  });

  it('einfuegenBloecke ersetzt einen leeren aktiven Absatz', () => {
    const { blocks } = setup([{ id: SKRIPT_TABELLE_ID, typ: 'skript_tabelle' }, { id: 'leer', typ: 'absatz', md: '' }]);
    blocks.setAktiv('leer');
    blocks.einfuegenBloecke([{ id: 'n1', typ: 'h1', md: 'Tech-Setup', intern: false }]);
    expect(blocks.bloecke.map((b) => b.id)).toEqual([SKRIPT_TABELLE_ID, 'n1']);
  });
});
