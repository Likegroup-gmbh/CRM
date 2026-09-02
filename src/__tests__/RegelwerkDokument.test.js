// Render + Autosave-Bind des zentralen Regelwerk-Papiers.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderRegelwerkDokument, bindRegelwerkDokument } from '../core/components/RegelwerkDokument.js';

describe('RegelwerkDokument', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('rendert Titel, Body und Meta-Slot', () => {
    const html = renderRegelwerkDokument({
      title: 'Conversion',
      inhalt: '# Hook',
      metaHtml: '<label>Layer</label>',
      titlePlaceholder: 'Name',
      bodyPlaceholder: 'Text'
    });
    expect(html).toContain('data-feld="name"');
    expect(html).toContain('data-feld="inhalt"');
    expect(html).toContain('Conversion');
    expect(html).toContain('# Hook');
    expect(html).toContain('<label>Layer</label>');
    expect(html).toContain('data-placeholder="Name"');
  });

  it('escaped HTML in Titel und Inhalt', () => {
    const html = renderRegelwerkDokument({
      title: '<script>x</script>',
      inhalt: '<img src=x>'
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('bind speichert geaenderte Felder per onSave', async () => {
    const onSave = vi.fn(async () => {});
    document.body.innerHTML = renderRegelwerkDokument({ title: 'Alt', inhalt: 'Body' });
    const root = document.getElementById('regelwerk-dokument');
    const handle = bindRegelwerkDokument(root, { onSave, readonly: false });

    const title = root.querySelector('[data-feld="name"]');
    title.textContent = 'Neu';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    await handle.inlineEdit.flush();

    expect(onSave).toHaveBeenCalledWith('name', 'Neu', 'Alt');
    expect(handle.readFeld('name')).toBe('Neu');
    await handle.destroy();
  });
});
