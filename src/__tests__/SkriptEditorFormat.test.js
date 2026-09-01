// SkriptEditorFormat.test.js
// Mini-WYSIWYG Apply-Pfad: Menue-Aktion (Offsets aus v.selektion) und
// Shortcut (live-Selektion) muessen beide ueber toggleInlineFormat ->
// Zellen-Re-Render -> saveManuell laufen. Seam: fake view, echte Zellen.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { SkriptEditorFormat } from '../modules/skripte/editor/SkriptEditorFormat.js';
import { renderInlineMd } from '../core/utils/inlineFormat.js';

let container;
afterEach(() => {
  container?.remove();
  window.getSelection()?.removeAllRanges();
});

function setup(raw, { feld = 'hook', master = false } = {}) {
  container = document.createElement('div');
  const zelle = document.createElement('div');
  zelle.className = master
    ? 'skripte-editor-sektion-text skripte-editor-sektion-text--md'
    : 'skripte-editor-sektion-text';
  zelle.dataset.feld = feld;
  zelle.dataset.sektion = feld;
  zelle.innerHTML = renderInlineMd(raw).html;
  container.appendChild(zelle);
  document.body.appendChild(container);

  const view = {
    container,
    skript: { [feld]: raw },
    inlineEdit: { flush: vi.fn(async () => {}), syncSaved: vi.fn() },
    saveManuell: vi.fn(async () => {}),
    clearPending: vi.fn(),
    selektion: null
  };
  return { view, zelle };
}

function selectAll(zelle) {
  const range = document.createRange();
  range.selectNodeContents(zelle);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

describe('SkriptEditorFormat.anwendenAusMenue', () => {
  it('fett wrappt die Auswahl, rendert strong und speichert Markdown', async () => {
    const { view } = setup('Hallo Welt');
    view.selektion = { feld: 'hook', start: 6, end: 10 };
    const format = new SkriptEditorFormat(view);

    await format.anwendenAusMenue('fett');

    expect(view.saveManuell).toHaveBeenCalledWith('hook', 'Hallo **Welt**', 'Hallo Welt');
    expect(view.skript.hook).toBe('Hallo **Welt**');
    expect(view.inlineEdit.syncSaved).toHaveBeenCalledWith('hook', 'Hallo **Welt**');
    const zelle = container.querySelector('[data-feld="hook"]');
    expect(zelle.innerHTML).toBe('Hallo <strong>Welt</strong>');
    // Selektion liegt wieder auf dem formatierten Text
    expect(window.getSelection().toString()).toBe('Welt');
    expect(view.clearPending).toHaveBeenCalled();
  });

  it('fett_entfernen unwrappt eine fette Auswahl', async () => {
    const { view } = setup('Hallo **Welt**');
    view.selektion = { feld: 'hook', start: 8, end: 12 };
    const format = new SkriptEditorFormat(view);

    await format.anwendenAusMenue('fett_entfernen');

    expect(view.saveManuell).toHaveBeenCalledWith('hook', 'Hallo Welt', 'Hallo **Welt**');
    expect(container.querySelector('[data-feld="hook"]').innerHTML).toBe('Hallo Welt');
  });

  it('kursiv auf fettem Inhalt kombiniert zu ***', async () => {
    const { view } = setup('Hallo **Welt**');
    view.selektion = { feld: 'hook', start: 8, end: 12 };
    const format = new SkriptEditorFormat(view);

    await format.anwendenAusMenue('kursiv');

    expect(view.saveManuell).toHaveBeenCalledWith('hook', 'Hallo ***Welt***', 'Hallo **Welt**');
    expect(container.querySelector('strong em')?.textContent).toBe('Welt');
  });

  it('ignoriert unbekannte Aktionen und kaputte Offsets', async () => {
    const { view } = setup('Hallo');
    const format = new SkriptEditorFormat(view);

    await format.anwendenAusMenue('neu_schreiben');
    view.selektion = { feld: 'hook', start: 3, end: 99 };
    await format.anwendenAusMenue('fett');

    expect(view.saveManuell).not.toHaveBeenCalled();
  });
});

describe('SkriptEditorFormat.anwendenShortcut', () => {
  it('wrappt die live markierte Auswahl', async () => {
    const { view, zelle } = setup('Hallo Welt');
    const format = new SkriptEditorFormat(view);
    selectAll(zelle);

    await format.anwendenShortcut(zelle, 'italic');

    expect(view.saveManuell).toHaveBeenCalledWith('hook', '*Hallo Welt*', 'Hallo Welt');
  });

  it('ohne Selektion passiert nichts', async () => {
    const { view, zelle } = setup('Hallo Welt');
    const format = new SkriptEditorFormat(view);

    await format.anwendenShortcut(zelle, 'bold');

    expect(view.saveManuell).not.toHaveBeenCalled();
  });
});

describe('SkriptEditorFormat.zelleFuer', () => {
  it('Master-Zellen (--md) sind ausgenommen', () => {
    const { zelle } = setup('# Hook', { feld: 'inhalt_md', master: true });
    const format = new SkriptEditorFormat(view0);
    expect(format.zelleFuer(zelle)).toBeNull();
  });

  it('Grid-Zellen werden gefunden (auch aus Textnodes heraus)', () => {
    const { zelle } = setup('Hallo');
    const format = new SkriptEditorFormat(view0);
    expect(format.zelleFuer(zelle)).toBe(zelle);
    expect(format.zelleFuer(zelle.firstChild)).toBe(zelle);
  });
});

// zelleFuer ist view-unabhaengig - Minimal-Stub genuegt
const view0 = { container: null };
