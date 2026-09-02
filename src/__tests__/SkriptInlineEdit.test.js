// SkriptInlineEdit.test.js
// Word-aehnliches Inline-Edit der Skript-Zellen (Hook/Hauptteil/CTA + Visual).
// Seam: oeffentliche API attach / flush / onSave – kein DOM-Interna der View.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { InlineEdit } from '../core/components/InlineEdit.js';

function zelle(feld, text = '') {
  const el = document.createElement('div');
  el.className = feld.endsWith('_visuell')
    ? 'skripte-editor-sektion-visual'
    : 'skripte-editor-sektion-text';
  el.dataset.feld = feld;
  el.dataset.sektion = feld.replace('_visuell', '');
  el.textContent = text;
  return el;
}

function rootMitZellen(felder) {
  const root = document.createElement('div');
  for (const [feld, text] of Object.entries(felder)) {
    root.appendChild(zelle(feld, text));
  }
  document.body.appendChild(root);
  return root;
}

describe('InlineEdit', () => {
  let root;

  afterEach(() => {
    root?.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('attach macht Zellen contenteditable, leerer Hook bleibt leer', () => {
    root = rootMitZellen({ hook: '', hook_visuell: 'Shot' });
    const edit = new InlineEdit();
    edit.attach(root);

    const hook = root.querySelector('[data-feld="hook"]');
    const visual = root.querySelector('[data-feld="hook_visuell"]');
    expect(hook.getAttribute('contenteditable')).toBe('plaintext-only');
    expect(visual.getAttribute('contenteditable')).toBe('plaintext-only');
    expect(hook.textContent).toBe('');
    expect(hook.textContent).not.toContain('–');
  });

  it('Input + Blur mit Aenderung ruft onSave mit feld und text', async () => {
    const onSave = vi.fn().mockResolvedValue();
    root = rootMitZellen({ hook: 'Alt' });
    const edit = new InlineEdit({ onSave });
    edit.attach(root);

    const hook = root.querySelector('[data-feld="hook"]');
    hook.textContent = 'Neu';
    hook.dispatchEvent(new Event('input', { bubbles: true }));
    hook.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    await Promise.resolve();

    expect(onSave).toHaveBeenCalledWith('hook', 'Neu', 'Alt');
  });

  it('Blur ohne Aenderung ruft onSave nicht', () => {
    const onSave = vi.fn();
    root = rootMitZellen({ hook: 'Alt' });
    const edit = new InlineEdit({ onSave });
    edit.attach(root);

    const hook = root.querySelector('[data-feld="hook"]');
    hook.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

    expect(onSave).not.toHaveBeenCalled();
  });

  it('Paste fuegt nur Plaintext ein', () => {
    root = rootMitZellen({ hook: 'Hallo' });
    const edit = new InlineEdit();
    edit.attach(root);

    const hook = root.querySelector('[data-feld="hook"]');
    const ev = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'clipboardData', {
      value: { getData: (typ) => (typ === 'text/plain' ? 'Welt' : '<b>Welt</b>') }
    });
    hook.dispatchEvent(ev);

    expect(hook.textContent).toContain('Welt');
    expect(hook.innerHTML).not.toContain('<b>');
  });

  it('flush speichert ausstehende Aenderung sofort', async () => {
    const onSave = vi.fn().mockResolvedValue();
    root = rootMitZellen({ hook: 'Alt' });
    const edit = new InlineEdit({ onSave });
    edit.attach(root);

    const hook = root.querySelector('[data-feld="hook"]');
    hook.textContent = 'Neu';
    hook.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onSave).not.toHaveBeenCalled();

    await edit.flush();
    expect(onSave).toHaveBeenCalledWith('hook', 'Neu', 'Alt');
  });

  it('isDirty ist true nach Input und false nach flush', async () => {
    const onSave = vi.fn().mockResolvedValue();
    root = rootMitZellen({ hook: 'Alt' });
    const edit = new InlineEdit({ onSave });
    edit.attach(root);

    const hook = root.querySelector('[data-feld="hook"]');
    hook.textContent = 'Neu';
    hook.dispatchEvent(new Event('input', { bubbles: true }));
    expect(edit.isDirty('hook')).toBe(true);

    await edit.flush();
    expect(edit.isDirty('hook')).toBe(false);
  });
});
