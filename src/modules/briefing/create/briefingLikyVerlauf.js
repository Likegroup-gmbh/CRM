// briefingLikyVerlauf.js
// Verlauf von Liky am Briefing: Transcript (übersteht Step-Renders), gespeicherte
// Nachrichten (briefing_chat_messages), Thinking-Slot des laufenden Jobs, DOM-Knoten.

import { renderThinking, pushStep } from '../../../core/chat/thinking.js';
import { isLikyPdfName, likyPdfTagHtml } from '../../../core/chat/likyComposer.js';
import { formatExtractResult } from './briefingLikySpec.js';

const GRUSS = 'Zieh das Kundenbriefing (PDF) hier rein, dann fülle ich das Formular vor. '
  + 'Was du selbst geschrieben hast, bleibt stehen.';

export function installBriefingLikyVerlauf(proto) {
  proto.pushUser = function(text) {
    if (!text) return;
    this.transcript.push({ rolle: 'user', text });
    this.renderTranscript();
    this.saveMessage('user', text);
  };

  proto.pushLiky = function(text) {
    if (!text) return;
    this.transcript.push({ rolle: 'liky', text });
    this.turn = null;
    this.renderTranscript();
    this.saveMessage('assistant', text);
  };

  proto.renderTranscript = function() {
    if (!this.feed) return;
    this.feed.innerHTML = '';
    const turns = this.transcript.length ? this.transcript : [{ rolle: 'liky', text: GRUSS }];
    for (const turn of turns) {
      this.feed.appendChild(turn.rolle === 'user' ? this.userNode(turn.text) : this.likyNode(turn.text));
    }
    this._chatLog?.pin({ force: true });
  };

  /** Transienter Beitrag mit Thinking-Slot für den laufenden Job. */
  proto.openLikyTurn = function() {
    if (!this.feed) return;
    this.received = [];
    const msg = this.likyNode('');
    const slot = document.createElement('div');
    slot.className = 'doc-chat__thinking';
    msg.appendChild(slot);
    this.feed.appendChild(msg);
    this.turn = msg;
    this.slot = slot;
    this.scrollToEnd();
  };

  proto.setSteps = function(steps) {
    if (!this.slot) return;
    this.received = Array.isArray(steps) ? steps : [];
    renderThinking(this.slot, this.received);
    this.scrollToEnd();
  };

  proto.addStep = function(step, label) {
    if (!this.slot || !step) return;
    if (this.received.some((s) => s.step === step)) return;
    this.setSteps(pushStep(this.received, { step, label: label || 'Ich arbeite' }));
  };

  proto.addError = function(text) {
    const error = document.createElement('div');
    error.className = 'doc-chat__error';
    error.textContent = `Das hat nicht geklappt: ${text}`;
    (this.turn || this.feed)?.appendChild(error);
    this.scrollToEnd();
  };

  proto.showResult = function(result, applied, skipped) {
    if (this.slot && this.received.length) {
      renderThinking(this.slot, this.received, { done: true });
    }
    // Den transienten Beitrag durch einen gespeicherten Turn ersetzen
    if (this.turn) this.turn.remove();
    this.turn = null;
    this.slot = null;
    this.pushLiky(formatExtractResult(result, applied, skipped));
  };

  /** Abbruch: Thinking schließen, knapper Hinweis statt Ergebnis. */
  proto.finishAbort = function() {
    if (this.slot && this.received.length) {
      renderThinking(this.slot, this.received, { done: true });
    }
    if (this.turn) this.turn.remove();
    this.turn = null;
    this.slot = null;
    this.pushLiky('Abgebrochen.');
  };

  proto.saveMessage = async function(rolle, inhalt) {
    if (!this.briefing.editId) return;
    try {
      const { data: { user } } = await window.supabase.auth.getUser();
      await window.supabase.from('briefing_chat_messages').insert({
        briefing_id: this.briefing.editId,
        rolle,
        inhalt,
        aktion: 'chat',
        created_by: user?.id
      });
    } catch (error) {
      console.warn('Chat-Nachricht konnte nicht gespeichert werden:', error);
    }
  };

  proto.userNode = function(text) {
    const msg = document.createElement('div');
    msg.className = 'doc-chat__msg doc-chat__msg--user';
    if (isLikyPdfName(text)) {
      msg.innerHTML = likyPdfTagHtml(text);
      return msg;
    }
    const el = document.createElement('div');
    el.className = 'doc-chat__text';
    el.textContent = text;
    msg.appendChild(el);
    return msg;
  };

  proto.likyNode = function(text) {
    const msg = document.createElement('div');
    msg.className = 'doc-chat__msg doc-chat__msg--liky';
    msg.innerHTML = `
      <div class="doc-chat__head">
        <span class="doc-chat__avatar" aria-hidden="true">L</span>
        <span class="doc-chat__name">Liky</span>
      </div>
    `;
    if (text) {
      const el = document.createElement('div');
      el.className = 'doc-chat__text';
      el.textContent = text;
      msg.appendChild(el);
    }
    return msg;
  };

  proto.scrollToEnd = function() {
    this._chatLog?.pin();
  };
}
