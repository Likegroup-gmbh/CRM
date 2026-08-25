// NotizDokument.test.js
// Render der festen Sektionen, Save-Mapping und Dirty-Schutz bei Remote-Updates.

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  renderNotizDokument,
  bindNotizDokument,
  applyRemoteSektionen,
  updateKiStand,
  DOKUMENT_SEKTIONEN,
  KI_SEKTIONEN
} from '../core/components/NotizDokument.js';
import { InlineEdit } from '../core/components/InlineEdit.js';

describe('NotizDokument', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('rendert alle Sektionen inkl. eigener Notizen', () => {
    const html = renderNotizDokument({
      entityType: 'unternehmen',
      entityId: 'u1',
      sektionen: { kampagnenstrategie: 'Kurz & knackig', todos: '' },
      kiStand: '2026-08-24T15:00:00.000Z'
    });

    expect(html).toContain('data-entity-type="unternehmen"');
    expect(html).toContain('data-entity-id="u1"');
    expect(html).toContain('Kurz &amp; knackig');
    expect(html).toContain('KI-Stand:');
    for (const s of DOKUMENT_SEKTIONEN) {
      expect(html).toContain(`data-feld="${s.key}"`);
      expect(html).toContain(s.label.replace(/&/g, '&amp;'));
    }
    expect(KI_SEKTIONEN).not.toContain('notizen');
  });

  it('escaped HTML in Sektionen', () => {
    const html = renderNotizDokument({
      entityType: 'marke',
      entityId: 'm1',
      sektionen: { notizen: '<script>alert(1)</script>' }
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('applyRemoteSektionen schreibt nur saubere Felder, dirty bleibt', () => {
    document.body.innerHTML = renderNotizDokument({
      entityType: 'marke',
      entityId: 'm1',
      sektionen: { todos: 'Alt', notizen: 'Meine Notiz' }
    });
    const root = document.getElementById('notiz-dokument');
    const edit = new InlineEdit();
    edit.attach(root);

    const todos = root.querySelector('[data-feld="todos"]');
    todos.textContent = 'Ich tippe gerade';
    todos.dispatchEvent(new Event('input', { bubbles: true }));
    expect(edit.isDirty('todos')).toBe(true);

    applyRemoteSektionen(root, edit, {
      todos: 'KI-To-dos',
      notizen: 'Meine Notiz',
      kampagnenstrategie: 'Neue Strategie'
    });

    expect(todos.textContent).toBe('Ich tippe gerade');
    expect(root.querySelector('[data-feld="kampagnenstrategie"]').textContent).toBe('Neue Strategie');
    expect(root.querySelector('[data-feld="notizen"]').textContent).toBe('Meine Notiz');
  });

  it('bind speichert die geaenderte Sektion per RPC', async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    const supabase = {
      rpc,
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
      })),
      removeChannel: vi.fn()
    };

    document.body.innerHTML = renderNotizDokument({
      entityType: 'unternehmen',
      entityId: 'u1',
      sektionen: { todos: 'Alt' }
    });
    const root = document.getElementById('notiz-dokument');
    const handle = bindNotizDokument(root, { entityType: 'unternehmen', entityId: 'u1', supabase });

    const todos = root.querySelector('[data-feld="todos"]');
    todos.textContent = 'Neu';
    todos.dispatchEvent(new Event('input', { bubbles: true }));
    await handle.inlineEdit.flush();

    expect(rpc).toHaveBeenCalledWith('patch_entity_dokument_sektion', {
      p_entity_type: 'unternehmen',
      p_entity_id: 'u1',
      p_feld: 'todos',
      p_text: 'Neu'
    });
    await handle.destroy();
  });

  it('updateKiStand setzt den Stand-Text', () => {
    document.body.innerHTML = renderNotizDokument({
      entityType: 'unternehmen',
      entityId: 'u1'
    });
    const root = document.getElementById('notiz-dokument');
    expect(root.querySelector('[data-notiz-kistand]').textContent).toBe('Noch keine KI-Auswertung');

    updateKiStand(root, '2026-08-24T15:00:00.000Z');
    expect(root.querySelector('[data-notiz-kistand]').textContent).toMatch(/^KI-Stand:/);
  });
});
