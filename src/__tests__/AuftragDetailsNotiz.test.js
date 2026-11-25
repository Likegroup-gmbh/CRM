import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  canonicalNotiz,
  canSeeAuftragNotiz,
  formatNotizKonflikt,
  formatNotizMeta,
  linkifyNotizHtml,
  prepareNotizText,
  renderNotizHtml
} from '../modules/auftrag/logic/AuftragDetailsNotizText.js';
import { applyNotizFormat } from '../modules/auftrag/logic/AuftragDetailsNotizFormat.js';
import { AuftragDetailsNotizController, renderAuftragNotizSection } from '../modules/auftrag/AuftragDetailsNotiz.js';

describe('AuftragDetailsNotizText', () => {
  it('kürzt auf 10.000 Zeichen und entfernt nur äußere Leerzeichen', () => {
    expect(canonicalNotiz('  Zeile\n\nnoch  ')).toBe('Zeile\n\nnoch');
    expect(canonicalNotiz('   ')).toBe('');
    const long = `a${'b'.repeat(10000)}`;
    expect(prepareNotizText(long).text).toHaveLength(10000);
    expect(prepareNotizText(long).limited).toBe(true);
  });

  it('macht nur http- und https-Adressen zu Links und lässt Satzzeichen draußen', () => {
    const html = linkifyNotizHtml('siehe <b> https://example.com/a?x=1&y=2. und www.example.com javascript:alert(1)');
    expect(html).toContain('&lt;b&gt;');
    expect(html).not.toContain('<b>');
    expect(html).toContain('href="https://example.com/a?x=1&amp;y=2"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toMatch(/<\/a>\./);
    expect(html).toContain('www.example.com');
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('href="http://www.example.com"');
  });

  it('zeigt Fett und Kursiv und lässt http-Links klickbar', () => {
    const html = renderNotizHtml('**fett** *kursiv* und <b> https://example.com/a?x=1&y=2.');
    expect(html).toContain('<strong>fett</strong>');
    expect(html).toContain('<em>kursiv</em>');
    expect(html).toContain('&lt;b&gt;');
    expect(html).not.toContain('<b>');
    expect(html).toContain('href="https://example.com/a?x=1&amp;y=2"');
    expect(html).toContain('target="_blank"');
    expect(html).toMatch(/<\/a>\./);
    expect(renderNotizHtml('siehe **https://example.com/plan**')).toContain('<strong><a href="https://example.com/plan"');
    expect(renderNotizHtml('javascript:alert(1)')).not.toContain('href="javascript:');
  });

  it('setzt und entfernt Fett und Kursiv um eine Auswahl', () => {
    expect(applyNotizFormat('Hallo Team', 0, 5, 'bold').text).toBe('**Hallo** Team');
    expect(applyNotizFormat('**Hallo** Team', 2, 7, 'bold').text).toBe('Hallo Team');
    expect(applyNotizFormat('Hallo', 0, 5, 'italic').text).toBe('*Hallo*');
    expect(applyNotizFormat('*Hallo*', 1, 6, 'italic').text).toBe('Hallo');
  });

  it('formatiert Herkunft und Konflikt auf Deutsch', () => {
    const iso = '2026-10-21T08:03:00.000Z';
    const meta = formatNotizMeta('Ada', iso);
    expect(meta).toMatch(/^Zuletzt geändert von Ada am \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}\.$/);
    expect(formatNotizKonflikt('', iso)).toMatch(/^Inzwischen geändert von Unbekannt am /);
    expect(formatNotizMeta('Ada', null)).toBe('');
  });
});

describe('canSeeAuftragNotiz', () => {
  it('zeigt die Notiz Admin und Mitarbeitern, nicht Investor, Agent oder Finanzen', () => {
    window.currentUser = { rolle: 'admin' };
    expect(canSeeAuftragNotiz()).toBe(true);
    expect(renderAuftragNotizSection()).toContain('Notizen');
    expect(renderAuftragNotizSection()).toContain('Fett');
    expect(renderAuftragNotizSection()).toContain('Kursiv');
    expect(renderAuftragNotizSection()).not.toContain('Code');

    window.currentUser = { rolle: 'mitarbeiter' };
    expect(canSeeAuftragNotiz()).toBe(true);

    window.currentUser = { rolle: 'investor' };
    expect(canSeeAuftragNotiz()).toBe(false);
    expect(renderAuftragNotizSection()).toBe('');

    window.currentUser = { rolle: 'agent' };
    expect(canSeeAuftragNotiz()).toBe(false);

    window.currentUser = { rolle: 'mitarbeiter', mitarbeiter_klasse: { name: 'Finanzen' } };
    expect(canSeeAuftragNotiz()).toBe(false);
  });
});

describe('AuftragDetailsNotizController', () => {
  let host;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    window.currentUser = { rolle: 'mitarbeiter', id: 'user-1', name: 'Ada' };
  });

  afterEach(() => {
    host.remove();
    vi.useRealTimers();
  });

  function mount(overrides = {}) {
    window.currentUser = { rolle: 'mitarbeiter' };
    host.innerHTML = renderAuftragNotizSection();
    const root = host.querySelector('[data-auftrag-notiz]');
    const load = overrides.load || vi.fn(async () => ({ text: '', updatedAt: null, authorName: null }));
    const write = overrides.write || vi.fn(async ({ nextText }) => ({
      status: 'saved',
      row: { text: nextText, updatedAt: '2026-10-21T08:05:00.000Z', authorName: 'Ada' }
    }));
    const controller = new AuftragDetailsNotizController({
      load,
      write,
      getUserId: async () => 'user-1',
      idleMs: 1000,
      savedMs: 1600
    });
    controller.mount(root, 'details-1');
    return { controller, root, load, write };
  }

  it('zeigt den Platzhalter und speichert nach der Ruhepause', async () => {
    vi.useFakeTimers();
    const { root, write, controller } = mount();
    await vi.runAllTimersAsync();
    expect(root.querySelector('[data-notiz-read]').textContent).toBe('Notiz zum Auftrag');

    controller._enterEdit();
    controller.input.textContent = '  Hallo https://example.com/x  ';
    controller._onInput();
    await vi.advanceTimersByTimeAsync(1000);

    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      detailsId: 'details-1',
      userId: 'user-1',
      baseUpdatedAt: null,
      nextText: 'Hallo https://example.com/x'
    }));
    controller._leaveEdit({ flush: false });
    expect(root.querySelector('[data-notiz-read] a')?.getAttribute('href')).toBe('https://example.com/x');
    expect(root.querySelector('[data-notiz-meta]').textContent).toMatch(/Zuletzt geändert von Ada am /);
    expect(root.querySelector('[data-notiz-status]').hidden).toBe(false);
  });

  it('lässt einen Link in Ruhe und öffnet beim Klick in den Text das Feld', async () => {
    const { controller, root } = mount({
      load: vi.fn(async () => ({
        text: 'Plan https://example.com/plan',
        updatedAt: '2026-10-21T08:01:00.000Z',
        authorName: 'Bea'
      }))
    });
    await controller._loading;
    const link = root.querySelector('[data-notiz-read] a');
    link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(root.querySelector('[data-notiz-input]').hidden).toBe(true);

    root.querySelector('[data-notiz-read]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(root.querySelector('[data-notiz-input]').hidden).toBe(false);
    expect(root.querySelector('[data-notiz-input]').textContent).toBe('Plan https://example.com/plan');
    expect(root.querySelector('[data-notiz-tools]').hidden).toBe(false);
  });

  it('pausiert bei einem fremden Stand und übernimmt ihn erst auf Zuruf', async () => {
    const { controller, root, write } = mount({
      load: vi.fn(async () => ({
        text: 'Alt',
        updatedAt: '2026-10-21T08:01:00.000Z',
        authorName: 'Ada'
      })),
      write: vi.fn(async () => ({
        status: 'conflict',
        row: { text: 'Neu von Bea', updatedAt: '2026-10-21T08:04:00.000Z', authorName: 'Bea' }
      }))
    });
    await controller._loading;
    controller._enterEdit();
    controller.input.textContent = 'Mein Text';
    controller._onInput();
    controller._leaveEdit();
    await controller.flush();

    expect(write).toHaveBeenCalled();
    expect(root.querySelector('[data-notiz-conflict]').hidden).toBe(false);
    expect(root.querySelector('[data-notiz-conflict-text]').textContent).toMatch(/Inzwischen geändert von Bea/);
    expect(root.querySelector('[data-notiz-read]').textContent).toContain('Mein Text');
    expect(await controller.beforeLeave()).toBe(false);
    expect(write).toHaveBeenCalledTimes(1);

    root.querySelector('[data-notiz-load-theirs]').click();
    expect(root.querySelector('[data-notiz-conflict]').hidden).toBe(true);
    expect(root.querySelector('[data-notiz-read]').textContent).toBe('Neu von Bea');
    expect(root.querySelector('[data-notiz-meta]').textContent).toMatch(/Bea/);
    expect(await controller.beforeLeave()).toBe(true);
  });

  it('behält den Text und blockiert das Verlassen, wenn das Speichern fehlschlägt', async () => {
    const { controller, root } = mount({
      write: vi.fn(async () => { throw new Error('netz'); })
    });
    await controller._loading;
    controller.draft = 'bleibt';
    expect(await controller.flush()).toBe(false);
    expect(root.querySelector('[data-notiz-error]').textContent).toBe('Die Notiz konnte nicht gespeichert werden.');
    expect(await controller.beforeLeave()).toBe(false);
    expect(controller.draft).toBe('bleibt');
  });

  it('leert die Notiz ohne Herkunftszeile', async () => {
    const write = vi.fn(async () => ({ status: 'saved', row: { text: '', updatedAt: null, authorName: null } }));
    const { controller, root } = mount({
      load: vi.fn(async () => ({ text: 'Weg damit', updatedAt: 't1', authorName: 'Ada' })),
      write
    });
    await controller._loading;
    controller.draft = '   ';
    expect(await controller.flush()).toBe(true);
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ nextText: '', baseUpdatedAt: 't1' }));
    expect(root.querySelector('[data-notiz-meta]').hidden).toBe(true);
    expect(root.querySelector('[data-notiz-read]').textContent).toBe('Notiz zum Auftrag');
  });

  it('setzt eine Auswahl fett und zeigt sie danach wieder als Text mit Links', async () => {
    const { controller, root } = mount({
      load: vi.fn(async () => ({ text: 'Hallo Team', updatedAt: null, authorName: null }))
    });
    await controller._loading;
    controller._enterEdit();
    const input = root.querySelector('[data-notiz-input]');
    const range = document.createRange();
    range.setStart(input.firstChild, 0);
    range.setEnd(input.firstChild, 5);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    root.querySelector('[data-notiz-format="bold"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(controller.draft).toBe('**Hallo** Team');
    expect(input.querySelector('strong')?.textContent).toBe('Hallo');
    controller._leaveEdit({ flush: false });
    expect(root.querySelector('[data-notiz-read] strong')?.textContent).toBe('Hallo');
    expect(root.querySelector('[data-notiz-tools]').hidden).toBe(true);
    expect(root.querySelector('[data-notiz-input]').hidden).toBe(true);
  });
});
