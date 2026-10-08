import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mountInlineQuestion } from '../core/chat/inlineQuestion.js';
import { KonzeptLikyPanel } from '../modules/strategie/KonzeptLikyPanel.js';
import { VideoideeVorschlagService } from '../modules/strategie/VideoideeVorschlagService.js';
import { getBriefingProdukte } from '../modules/strategie/service/strategieFreigabe.js';

vi.mock('../modules/strategie/service/strategieFreigabe.js', () => ({
  getBriefingProdukte: vi.fn(async () => [])
}));

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

  describe('kind counts', () => {
    const SPEC = {
      kind: 'counts',
      prompt: 'Wie viele pro Produkt?',
      rows: [{ id: 'p1', label: 'Serum' }, { id: 'p2', label: 'Cleanser' }],
      max: 12
    };

    function fill(rootFeed, werte) {
      for (const [id, wert] of Object.entries(werte)) {
        const field = rootFeed.querySelector(`[data-row-id="${id}"]`);
        field.value = wert;
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    it('zeigt eine Zeile pro Eintrag und zaehlt die Summe mit', () => {
      const rootFeed = feed();
      mountInlineQuestion(rootFeed, SPEC);
      expect(rootFeed.querySelectorAll('[data-row-id]')).toHaveLength(2);
      expect(rootFeed.textContent).toContain('Serum');
      expect(rootFeed.textContent).toContain('Cleanser');
      expect(rootFeed.querySelector('.chat-ask__sum').textContent).toBe('Zusammen 0 von 12');

      fill(rootFeed, { p1: '3', p2: '2' });
      expect(rootFeed.querySelector('.chat-ask__sum').textContent).toBe('Zusammen 5 von 12');
    });

    it('schickt nichts bei Summe 0, Summe 13 oder ungueltiger Zahl', () => {
      const onAnswer = vi.fn();
      const rootFeed = feed();
      mountInlineQuestion(rootFeed, SPEC, { onAnswer });

      submit(rootFeed);
      fill(rootFeed, { p1: '0', p2: '' });
      submit(rootFeed);
      fill(rootFeed, { p1: '7', p2: '6' });
      submit(rootFeed);
      expect(rootFeed.querySelector('.chat-ask__sum').classList.contains('is-invalid')).toBe(true);
      fill(rootFeed, { p1: '-1', p2: '2' });
      submit(rootFeed);

      expect(onAnswer).not.toHaveBeenCalled();
      expect(rootFeed.querySelector('.chat-ask').dataset.answered).toBeUndefined();
    });

    it('schickt bei Summe 4 die IDs mit Zahl und laesst Nullen weg', () => {
      const onAnswer = vi.fn();
      const rootFeed = feed();
      mountInlineQuestion(rootFeed, SPEC, { onAnswer });

      fill(rootFeed, { p1: '4', p2: '0' });
      submit(rootFeed);

      expect(onAnswer).toHaveBeenCalledWith({
        kind: 'counts',
        optionId: null,
        label: null,
        text: 'Serum 4',
        value: [{ id: 'p1', anzahl: 4 }]
      });
      expect(rootFeed.querySelector('.chat-ask').dataset.answered).toBe('true');
      expect(rootFeed.querySelector('[data-row-id="p1"]').disabled).toBe(true);
    });

    it('fasst mehrere Zeilen im Antworttext zusammen', () => {
      const onAnswer = vi.fn();
      const rootFeed = feed();
      mountInlineQuestion(rootFeed, SPEC, { onAnswer });
      fill(rootFeed, { p1: '3', p2: '2' });
      submit(rootFeed);
      expect(onAnswer.mock.calls[0][0].text).toBe('Serum 3, Cleanser 2');
      expect(onAnswer.mock.calls[0][0].value).toEqual([
        { id: 'p1', anzahl: 3 },
        { id: 'p2', anzahl: 2 }
      ]);
    });
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
    getBriefingProdukte.mockReset();
    getBriefingProdukte.mockResolvedValue([]);
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('startet den Job mit der Zahl aus der Karte', async () => {
    const starte = vi.spyOn(VideoideeVorschlagService, 'starteJob').mockResolvedValue({ anzahl: 3, success: true });
    const onStart = vi.fn();
    panel = new KonzeptLikyPanel({ canCreate: true, isKunde: false, strategieId: 's1' });
    panel.mount();
    await panel.fragAnzahl({ onStart });

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

  it('öffnet bei offener Karte keine zweite', async () => {
    panel = new KonzeptLikyPanel({ canCreate: true, isKunde: false, strategieId: 's1' });
    panel.mount();
    const erste = panel.fragAnzahl();
    await panel.fragAnzahl();
    await erste;
    expect(document.querySelectorAll('.chat-ask')).toHaveLength(1);
  });

  it('Header-Klick verwirft die Button-Anzahl-Karte und gibt den Composer frei', async () => {
    panel = new KonzeptLikyPanel({ canCreate: true, isKunde: false, strategieId: 's1' });
    panel.mount();
    await panel.fragAnzahl();

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

  it('ein Produkt: bleibt die einzelne Zahl-Karte', async () => {
    getBriefingProdukte.mockResolvedValue([{ id: 'p1', name: 'Serum' }]);
    panel = new KonzeptLikyPanel({ canCreate: true, isKunde: false, strategieId: 's1' });
    panel.mount();
    await panel.fragAnzahl();

    expect(document.querySelector('.chat-ask').dataset.kind).toBe('input');
    expect(document.querySelectorAll('[data-row-id]')).toHaveLength(0);
  });

  it('mehrere Produkte: eine Zeile pro Produkt, Job-Input traegt proProdukt', async () => {
    getBriefingProdukte.mockResolvedValue([
      { id: 'p1', name: 'Serum' },
      { id: 'p2', name: 'Cleanser' },
      { id: 'p3', name: 'Maske' }
    ]);
    const starte = vi.spyOn(VideoideeVorschlagService, 'starteJob').mockResolvedValue({ anzahl: 5, success: true });
    panel = new KonzeptLikyPanel({ canCreate: true, isKunde: false, strategieId: 's1' });
    panel.mount();
    await panel.fragAnzahl();

    expect(getBriefingProdukte).toHaveBeenCalledWith('s1');
    expect(document.querySelector('.chat-ask').dataset.kind).toBe('counts');
    expect(document.querySelectorAll('[data-row-id]')).toHaveLength(3);
    expect(document.getElementById('konzept-liky-input').disabled).toBe(true);

    document.querySelector('[data-row-id="p1"]').value = '3';
    document.querySelector('[data-row-id="p2"]').value = '2';
    submit(document.querySelector('.chat-ask'));

    await vi.waitFor(() => {
      expect(document.getElementById('konzept-liky-log').textContent).toContain('5 Ideen liegen als Vorschläge');
    });
    expect(starte).toHaveBeenCalledWith({
      strategieId: 's1',
      input: {
        proProdukt: [
          { produkt_id: 'p1', anzahl: 3 },
          { produkt_id: 'p2', anzahl: 2 }
        ]
      }
    });
    expect(document.querySelector('.chat-turn--user').textContent).toContain('Serum 3, Cleanser 2');
  });

  it('mehrere Produkte aus dem Chat: Job mit proProdukt und Hinweis, kein Satz an den Planer', async () => {
    getBriefingProdukte.mockResolvedValue([
      { id: 'p1', name: 'Serum' },
      { id: 'p2', name: 'Cleanser' }
    ]);
    const starte = vi.spyOn(VideoideeVorschlagService, 'starteJob').mockResolvedValue({ anzahl: 2, success: true });
    const reload = vi.fn(async () => []);
    panel = new KonzeptLikyPanel({
      canCreate: true,
      isKunde: false,
      strategieId: 's1',
      reloadItems: reload,
      rerenderItemsTable: vi.fn()
    });
    panel.mount();
    await panel.fragAnzahl({ pendingAktion: { text: 'noch welche mit Humor' } });

    document.querySelector('[data-row-id="p1"]').value = '1';
    document.querySelector('[data-row-id="p2"]').value = '1';
    submit(document.querySelector('.chat-ask'));

    await vi.waitFor(() => expect(starte).toHaveBeenCalled());
    expect(starte.mock.calls[0][0].input).toEqual({
      proProdukt: [
        { produkt_id: 'p1', anzahl: 1 },
        { produkt_id: 'p2', anzahl: 1 }
      ],
      hinweis: 'noch welche mit Humor'
    });
    await vi.waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it('Header-Klick waehrend die Produkte laden: keine Karte, Composer frei', async () => {
    let fertig;
    getBriefingProdukte.mockReturnValue(new Promise((resolve) => { fertig = resolve; }));
    panel = new KonzeptLikyPanel({ canCreate: true, isKunde: false, strategieId: 's1' });
    panel.mount();
    const laden = panel.fragAnzahl();
    expect(document.getElementById('konzept-liky-input').disabled).toBe(true);

    document.getElementById('header-chat-toggle').click();
    fertig([{ id: 'p1', name: 'Serum' }, { id: 'p2', name: 'Cleanser' }]);
    await laden;

    expect(document.querySelectorAll('.chat-ask')).toHaveLength(0);
    expect(document.getElementById('konzept-liky-input').disabled).toBe(false);
    expect(panel.blockiert()).toBe(false);
  });

  it('Header-Klick laesst eine Chat-Anzahl-Karte (braucht_anzahl) stehen', async () => {
    panel = new KonzeptLikyPanel({ canCreate: true, isKunde: false, strategieId: 's1' });
    panel.mount();
    await panel.fragAnzahl({ pendingAktion: { text: 'entwirf noch welche' } });

    document.getElementById('header-chat-toggle').click();

    expect(document.querySelectorAll('.chat-ask')).toHaveLength(1);
    expect(document.getElementById('konzept-liky-input').disabled).toBe(true);
    expect(document.getElementById('konzept-liky-panel').hidden).toBe(true);
  });
});
