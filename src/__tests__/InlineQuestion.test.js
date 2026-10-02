import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mountInlineQuestion } from '../core/chat/inlineQuestion.js';
import { KonzeptLikyPanel } from '../modules/strategie/KonzeptLikyPanel.js';
import { VideoideeVorschlagService } from '../modules/strategie/VideoideeVorschlagService.js';

function feed() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function submit(root) {
  root.querySelector('.chat-ask__form').dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true })
  );
}

describe('mountInlineQuestion', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('committet eine Option und lockt die Karte', () => {
    const onAnswer = vi.fn();
    const setComposerEnabled = vi.fn();
    const rootFeed = feed();
    mountInlineQuestion(rootFeed, {
      kind: 'choice',
      prompt: 'Welche?',
      step: { current: 2, total: 5 },
      options: [
        { id: 'a', label: 'CAC' },
        { id: 'b', label: 'Funnel Velocity' }
      ]
    }, { onAnswer, setComposerEnabled });

    expect(setComposerEnabled).toHaveBeenCalledWith(false);
    expect(rootFeed.textContent).toContain('Frage 2 von 5');

    const option = rootFeed.querySelector('[data-option-id="b"]');
    option.click();

    expect(onAnswer).toHaveBeenCalledWith({
      kind: 'choice',
      optionId: 'b',
      label: 'Funnel Velocity',
      text: 'Funnel Velocity',
      value: 'b'
    });
    expect(rootFeed.querySelector('.chat-ask').dataset.answered).toBe('true');
    expect(option.disabled).toBe(true);
    expect(option.classList.contains('is-selected')).toBe(true);
    expect(setComposerEnabled).toHaveBeenLastCalledWith(true);

    option.disabled = false;
    option.click();
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('schickt eine Zahl und verwirft leer oder außerhalb', () => {
    const onAnswer = vi.fn();
    const rootFeed = feed();
    mountInlineQuestion(rootFeed, {
      kind: 'input',
      prompt: 'Wie viele?',
      input: { type: 'number', min: 1, max: 12, placeholder: 'z. B. 5' }
    }, { onAnswer });

    const field = rootFeed.querySelector('.chat-ask__field');
    field.value = '';
    submit(rootFeed);
    field.value = '0';
    submit(rootFeed);
    field.value = '99';
    submit(rootFeed);
    field.value = 'abc';
    submit(rootFeed);
    expect(onAnswer).not.toHaveBeenCalled();
    expect(rootFeed.querySelector('.chat-ask').dataset.answered).toBeUndefined();

    field.value = '4';
    submit(rootFeed);
    expect(onAnswer).toHaveBeenCalledWith({
      kind: 'input',
      optionId: null,
      label: null,
      text: '4',
      value: 4
    });
    expect(field.disabled).toBe(true);

    field.disabled = false;
    field.value = '5';
    submit(rootFeed);
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('gibt den Composer frei, wenn die offene Karte entfernt wird', () => {
    const setComposerEnabled = vi.fn();
    const handle = mountInlineQuestion(feed(), {
      kind: 'choice',
      options: [{ id: 'a', label: 'A' }]
    }, { setComposerEnabled });
    handle.destroy();
    expect(setComposerEnabled).toHaveBeenLastCalledWith(true);
    expect(document.querySelector('.chat-ask')).toBeNull();
  });
});

describe('KonzeptLikyPanel Anzahl', () => {
  let panel;

  beforeEach(() => {
    const header = document.createElement('div');
    header.className = 'header-actions';
    header.innerHTML = '<button class="logout-btn"></button>';
    document.body.appendChild(header);
  });

  afterEach(() => {
    panel?.destroy();
    panel = null;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('startet den Job mit der Zahl aus der Karte', async () => {
    const starte = vi.spyOn(VideoideeVorschlagService, 'starteJob').mockResolvedValue({ anzahl: 3, success: true });
    const onStart = vi.fn();
    panel = new KonzeptLikyPanel({ canCreate: true, isKunde: false, strategieId: 's1' });
    panel.mount();
    panel.fragAnzahl({ onStart });

    const input = document.getElementById('konzept-liky-input');
    expect(input.disabled).toBe(true);

    const field = document.querySelector('.chat-ask__field');
    field.value = '3';
    submit(document.querySelector('.chat-ask'));
    await vi.waitFor(() => {
      expect(document.getElementById('konzept-liky-log').textContent).toContain('3 Ideen liegen als Vorschläge');
    });

    expect(starte).toHaveBeenCalledWith({ strategieId: 's1', input: { anzahl: 3 } });
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.chat-turn--user').textContent).toContain('3');
  });

  it('öffnet bei offener Karte keine zweite', () => {
    panel = new KonzeptLikyPanel({ canCreate: true, isKunde: false, strategieId: 's1' });
    panel.mount();
    panel.fragAnzahl();
    panel.fragAnzahl();
    expect(document.querySelectorAll('.chat-ask')).toHaveLength(1);
  });

  it('Header-Klick verwirft die Button-Anzahl-Karte und gibt den Composer frei', () => {
    panel = new KonzeptLikyPanel({ canCreate: true, isKunde: false, strategieId: 's1' });
    panel.mount();
    panel.fragAnzahl();

    expect(document.querySelectorAll('.chat-ask')).toHaveLength(1);
    expect(document.getElementById('konzept-liky-input').disabled).toBe(true);
    expect(document.getElementById('konzept-liky-send').disabled).toBe(true);

    document.getElementById('header-chat-toggle').click();

    expect(document.querySelectorAll('.chat-ask')).toHaveLength(0);
    expect(document.getElementById('konzept-liky-input').disabled).toBe(false);
    expect(document.getElementById('konzept-liky-send').disabled).toBe(false);
    expect(panel.blockiert()).toBe(false);
    expect(document.getElementById('konzept-liky-panel').hidden).toBe(false);
  });

  it('Header-Klick laesst eine Chat-Anzahl-Karte (braucht_anzahl) stehen', () => {
    panel = new KonzeptLikyPanel({ canCreate: true, isKunde: false, strategieId: 's1' });
    panel.mount();
    panel.fragAnzahl({ pendingAktion: { text: 'entwirf noch welche' } });

    document.getElementById('header-chat-toggle').click();

    expect(document.querySelectorAll('.chat-ask')).toHaveLength(1);
    expect(document.getElementById('konzept-liky-input').disabled).toBe(true);
    expect(document.getElementById('konzept-liky-panel').hidden).toBe(true);
  });
});
