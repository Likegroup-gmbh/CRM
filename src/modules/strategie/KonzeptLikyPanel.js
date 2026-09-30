// KonzeptLikyPanel.js
// Header-Chat auf dem Konzept. Kein freier LLM: die untere Box bleibt zu.
// "Ideen vorschlagen" stellt die Anzahl als Inline-Frage und startet danach
// den bestehenden Job mit input.anzahl.

import { ChatPanelShell } from '../../core/chat/ChatPanelShell.js';
import { bindChatLog } from '../../core/chat/chatLog.js';
import { mountInlineQuestion } from '../../core/chat/inlineQuestion.js';
import { pushStep, renderThinking } from '../../core/chat/thinking.js';
import { VideoideeVorschlagService } from './VideoideeVorschlagService.js';

// Gleicher Clamp wie normalisiereAnzahl in strategie-idee.js.
const ANZAHL_MIN = 1;
const ANZAHL_MAX = 12;
const FRAGE = 'Wie viele Videoideen soll ich entwerfen?';

const HEAD = `<div class="chat-turn__head">
  <span class="chat-turn__avatar" aria-hidden="true">L</span>
  <span class="chat-turn__name">Liky</span>
</div>`;

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class KonzeptLikyPanel {
  constructor(detail) {
    this.detail = detail;
    this._shell = null;
    this._log = null;
    this._question = null;
    this._hooks = null;
    this._frageOffen = false;
    this._laeuft = false;
    this._steps = [];
    this._thinkingEl = null;
    this._onProgress = null;
  }

  get sichtbar() {
    if (!this.detail?.canCreate) return false;
    if (this.detail.isKunde) return false;
    if (window.isGastReadonly?.()) return false;
    return true;
  }

  blockiert() {
    return this._frageOffen || this._laeuft;
  }

  mount() {
    this.destroy();
    if (!this.sichtbar) return;

    this._shell = new ChatPanelShell().mount({
      trigger: 'header',
      persistKey: 'konzept-liky',
      headerTitle: 'Liky',
      dialogLabel: 'Liky',
      ids: { root: 'konzept-liky', panel: 'konzept-liky-panel' },
      panelClass: 'konzept-liky',
      titleHtml: HEAD,
      bodyHtml: `
        <div class="chat-log konzept-liky__log" id="konzept-liky-log"></div>
        <div class="konzept-liky__composer">
          <div class="konzept-liky__input">
            <textarea id="konzept-liky-input" rows="2" disabled placeholder="Antwort kommt in die Karte."></textarea>
          </div>
        </div>`,
      onOpen: () => this._pin(true)
    });

    this._log = bindChatLog(this._feed());
    const { offen, size } = this._shell.getStoredState();
    if (offen) this._shell.open({ size: size || undefined, persist: false });
  }

  destroy() {
    this._question?.destroy();
    this._question = null;
    this._unbindJob();
    this._log?.destroy();
    this._log = null;
    this._shell?.destroy();
    this._shell = null;
    this._hooks = null;
    this._frageOffen = false;
    this._laeuft = false;
    this._steps = [];
    this._thinkingEl = null;
  }

  fokussieren() {
    this._shell?.open();
  }

  /** Button-Pfad. Offene Karte oder laufender Job: nur das Panel holen. */
  fragAnzahl(hooks = {}) {
    if (!this._shell) return;
    this.fokussieren();
    if (this.blockiert()) return;

    const feed = this._feed();
    if (!feed) return;

    this._hooks = hooks;
    this._frageOffen = true;

    const turn = document.createElement('div');
    turn.className = 'chat-turn chat-turn--liky';
    turn.innerHTML = HEAD;
    feed.appendChild(turn);

    this._question = mountInlineQuestion(turn, {
      kind: 'input',
      prompt: FRAGE,
      input: {
        type: 'number',
        placeholder: 'z. B. 5',
        min: ANZAHL_MIN,
        max: ANZAHL_MAX
      },
      hint: 'Trag die Anzahl in die Karte ein.'
    }, {
      onAnswer: (answer) => { void this._starte(answer); },
      setComposerEnabled: () => this._lockComposer()
    });
    this._pin(true);
  }

  async _starte(answer) {
    this._frageOffen = false;
    this._question = null;
    const anzahl = answer.value;
    this._pushUser(String(anzahl));
    this._laeuft = true;
    this._steps = [];
    this._thinkingEl = null;
    this._bindJob();
    this._hooks?.onStart?.();

    try {
      const payload = await VideoideeVorschlagService.starteJob({
        strategieId: this.detail.strategieId,
        input: { anzahl }
      });
      this._doneThinking();
      const n = Number(payload?.anzahl);
      const gezeigt = Number.isInteger(n) ? n : anzahl;
      this._pushLiky(gezeigt === 1
        ? '1 Idee liegt als Vorschlag in der Tabelle.'
        : `${gezeigt} Ideen liegen als Vorschläge in der Tabelle.`);
    } catch (error) {
      console.error('Fehler bei den Videoidee-Vorschlägen:', error);
      this._doneThinking();
      this._pushError(error.message || 'Generierung fehlgeschlagen.');
      window.toastSystem?.show(error.message || 'Generierung fehlgeschlagen.', 'error');
    } finally {
      this._laeuft = false;
      this._unbindJob();
      this._hooks?.onSettled?.();
      this._hooks = null;
    }
  }

  _feed() {
    return document.getElementById('konzept-liky-log');
  }

  _lockComposer() {
    const input = document.getElementById('konzept-liky-input');
    if (input) input.disabled = true;
  }

  _pin(force = false) {
    this._log?.pin(force ? { force: true } : undefined);
  }

  _pushUser(text) {
    const feed = this._feed();
    if (!feed) return;
    const turn = document.createElement('div');
    turn.className = 'chat-turn chat-turn--user';
    turn.innerHTML = `<p class="chat-turn__text">${esc(text)}</p>`;
    feed.appendChild(turn);
    this._pin(true);
  }

  _pushLiky(text) {
    const feed = this._feed();
    if (!feed) return;
    const turn = document.createElement('div');
    turn.className = 'chat-turn chat-turn--liky';
    turn.innerHTML = `${HEAD}<p class="chat-turn__text">${esc(text)}</p>`;
    feed.appendChild(turn);
    this._pin(true);
  }

  _pushError(text) {
    const feed = this._feed();
    if (!feed) return;
    const turn = document.createElement('div');
    turn.className = 'chat-turn chat-turn--liky';
    turn.innerHTML = `${HEAD}<p class="chat-turn__error">${esc(text)}</p>`;
    feed.appendChild(turn);
    this._pin(true);
  }

  _bindJob() {
    this._unbindJob();
    this._onProgress = (e) => {
      const steps = e.detail?.steps;
      if (Array.isArray(steps) && steps.length) this._steps = steps;
      else {
        this._steps = pushStep(this._steps, {
          step: e.detail?.step || 'working',
          label: e.detail?.label || 'Ich arbeite'
        });
      }
      this._renderThinking(false);
    };
    document.addEventListener('videoideeVorschlagProgress', this._onProgress);
  }

  _unbindJob() {
    if (this._onProgress) {
      document.removeEventListener('videoideeVorschlagProgress', this._onProgress);
    }
    this._onProgress = null;
  }

  _renderThinking(done) {
    const feed = this._feed();
    if (!feed) return;
    if (!this._thinkingEl) {
      const turn = document.createElement('div');
      turn.className = 'chat-turn chat-turn--liky';
      turn.innerHTML = `${HEAD}<div class="chat-turn__thinking"></div>`;
      feed.appendChild(turn);
      this._thinkingEl = turn.querySelector('.chat-turn__thinking');
    }
    renderThinking(this._thinkingEl, this._steps, { done });
    this._pin(true);
  }

  _doneThinking() {
    if (!this._thinkingEl) return;
    this._renderThinking(true);
  }
}
