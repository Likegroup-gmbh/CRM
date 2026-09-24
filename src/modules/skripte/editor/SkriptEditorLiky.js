// SkriptEditorLiky.js
// Liky-Shell und Chat-Verlauf (Prototype-Mixin).

import { ChatPanelShell } from '../../../core/chat/ChatPanelShell.js';
import { bindChatLog, isNearEnd, scrollToEnd } from '../../../core/chat/chatLog.js';
import { revealLines, cancelLineReveal } from '../../../core/animation/lineReveal.js';
import { formatUsageCost } from '../SkripteUtils.js';
import { SEND_ICON, PLACEHOLDER_DEFAULT, PLACEHOLDER_NEU } from './skriptEditorKonstanten.js';
import {
  chatLeerHtml, genStatusBubbleHtml, messageHtml, versionsHinweisHtml
} from './SkriptEditorChatRenderer.js';
import { SkriptEditorView } from './SkriptEditorViewCore.js';

const MSG_TEXT_SEL = '.skripte-editor-msg-text, .skripte-editor-vorschlag-text';
const MSG_FOOTER_SEL = '.skripte-editor-msg-actions, .skripte-editor-msg-state, p.skripte-hint';

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function cancelRowReveal(row) {
  row?.querySelectorAll(MSG_TEXT_SEL).forEach((node) => cancelLineReveal(node));
}

/**
 * Text-Ziele und Footer leeren/verstecken, bevor die Row ins Live-DOM kommt.
 * Sonst malt der Browser einen Frame den kompletten Block.
 */
function prepareRevealTargets(row) {
  const textByTarget = [];
  for (const node of row.querySelectorAll(MSG_TEXT_SEL)) {
    const text = node.textContent ?? '';
    node.textContent = '';
    const wrap = node.classList.contains('skripte-editor-vorschlag-text')
      ? node.closest('.skripte-editor-vorschlag')
      : null;
    if (wrap) wrap.style.display = 'none';
    textByTarget.push({ el: node, text, wrap });
  }
  for (const f of row.querySelectorAll(MSG_FOOTER_SEL)) f.style.display = 'none';
  return textByTarget;
}

/** Erst Kommentar, dann Vorschlag; Footer (Buttons) erst nach dem Reveal. */
async function revealMessageRow(row, { pin, textByTarget } = {}) {
  const footers = [...row.querySelectorAll(MSG_FOOTER_SEL)];
  for (const f of footers) f.style.display = 'none';

  const targets = textByTarget?.length
    ? textByTarget
    : [...row.querySelectorAll(MSG_TEXT_SEL)].map((el) => ({
      el,
      text: el.textContent ?? '',
      wrap: el.classList.contains('skripte-editor-vorschlag-text')
        ? el.closest('.skripte-editor-vorschlag')
        : null
    }));

  for (const { el, text, wrap } of targets) {
    if (!row.isConnected) return;
    if (!text) continue;
    if (wrap) wrap.style.display = '';
    await revealLines(el, { text, onLine: pin });
  }
  if (!row.isConnected) return;

  const reduce = prefersReducedMotion();
  for (const f of footers) {
    if (!f.isConnected) return;
    f.style.display = '';
    if (!reduce && typeof f.animate === 'function') {
      f.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 180, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }
      );
    }
  }
  pin?.();
}

/** Shell nur fuer interne User; Kunden/Readonly sehen keinen Einstieg. */
SkriptEditorView.prototype.mountLikyChat = function() {
  this._chatLog?.destroy();
  this._chatLog = null;
  this._likyShell?.destroy();
  this._likyShell = null;
  if (!this.kannAiAktionen) return;

  this._likyShell = new ChatPanelShell().mount({
    trigger: 'header',
    persistKey: 'skripte-liky',
    headerTitle: 'Liky',
    dialogLabel: 'Liky',
    ids: { root: 'ed-liky', panel: 'ed-chat' },
    panelClass: 'skripte-editor-chat',
    titleHtml: `
      <span class="skripte-editor-msg-head">
        <span class="skripte-editor-avatar">L</span>
        <span class="skripte-editor-msg-name">Liky</span>
      </span>`,
    bodyHtml: `
      <div class="skripte-editor-chat-log chat-log" id="ed-chat-log"></div>
      <div class="skripte-editor-inputwrap">
        <div class="skripte-editor-chip" id="ed-chip" hidden></div>
        <div class="skripte-editor-input">
          <textarea id="ed-input" rows="2" placeholder="${PLACEHOLDER_DEFAULT}"></textarea>
          <div class="skripte-editor-input-footer">
            <div class="skripte-editor-input-actions">
              <span class="skripte-editor-cost" id="ed-cost"></span>
              <button id="ed-send" class="skripte-editor-send" title="Senden" aria-label="Senden">${SEND_ICON}</button>
            </div>
          </div>
        </div>
      </div>`,
    onOpen: () => this._chatLog?.pin({ force: true })
  });
  this._chatLog = bindChatLog(document.getElementById('ed-chat-log'));

  const { offen, size } = this._likyShell.getStoredState();
  if (offen) this._likyShell.open({ size: size || undefined, persist: false });
};

SkriptEditorView.prototype.istLikyOffen = function() {
  return Boolean(this._likyShell?.isOpen());
};

/** Nur ein-/ausschalten - die Groesse behaelt die Shell (Restore/letzter Zustand). */
SkriptEditorView.prototype.setLikyOffen = function(offen, { persist = true } = {}) {
  if (!this._likyShell) return;
  if (offen) this._likyShell.open({ persist });
  else this._likyShell.close({ persist });
  this.updateLikyDot();
};

/** Punkt am Header-Icon, solange Liky arbeitet oder ein Vorschlag offen ist. */
SkriptEditorView.prototype.updateLikyDot = function() {
  if (!this._likyShell) return;
  const aktiv = this.messages.some(
    (m) => m.status === 'pending' || m.status === 'running' || m.status === 'vorschlag'
  );
  this._likyShell.setDot(aktiv);
};

SkriptEditorView.prototype.renderChat = function({ forceScroll = false } = {}) {
  const el = document.getElementById('ed-chat-log');
  if (!el) return;
  this.updateLikyDot();

  if (!this.messages.length) {
    el.innerHTML = this.versionsHinweisHtml()
      + genStatusBubbleHtml(this.genStatus)
      + chatLeerHtml();
    this.bindGenRetry(el);
    return;
  }

  // Scrollposition erhalten: nur ans Ende springen, wenn der User schon
  // (nahezu) unten war oder gerade selbst etwas abgeschickt hat
  const warUnten = this._chatLog?.isFollowing() ?? isNearEnd(el);
  const vorherigerScroll = el.scrollTop;

  el.innerHTML = this.versionsHinweisHtml()
    + this.messages.map((m) => this.renderMessage(m)).join('')
    + genStatusBubbleHtml(this.genStatus);

  el.querySelectorAll('[data-msg-action]').forEach((btn) => {
    btn.addEventListener('click', () => this.handleMessageAction(btn.dataset.msgAction, btn.dataset.msgId));
  });
  this.bindGenRetry(el);

  if (forceScroll || warUnten) {
    if (this._chatLog) this._chatLog.pin({ force: true });
    else scrollToEnd(el);
  } else {
    el.scrollTop = vorherigerScroll;
  }
};

/**
 * Einzelne Message aktualisieren oder anhaengen, ohne den ganzen Verlauf
 * neu zu rendern (Realtime/Poll-Pfad). Faellt auf renderChat() zurueck,
 * wenn die Row nicht existiert (z.B. leerer Verlauf oder Neu-Modus).
 */
SkriptEditorView.prototype.upsertMessageRow = function(m, { animateText = false } = {}) {
  const el = document.getElementById('ed-chat-log');
  if (!el) {
    this.renderChat();
    return;
  }
  const html = this.renderMessage(m);
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  const newRow = tpl.content.firstElementChild;
  if (!newRow) return;

  // Follow-State sitzt am persistenten _chatLog (vor dem Insert lesen).
  const pin = () => this._chatLog?.pin();
  const textByTarget = animateText ? prepareRevealTargets(newRow) : [];

  const existing = el.querySelector(`[data-msg-row="${m.id}"]`);
  if (existing) {
    cancelRowReveal(existing);
    existing.replaceWith(newRow);
  } else {
    // Vor der Gen-Status-Bubble einfuegen, damit sie immer unten bleibt
    const bubble = el.querySelector('#ed-gen-thinking')?.closest('.skripte-editor-msg');
    if (bubble) bubble.before(newRow);
    else el.append(newRow);
  }
  el.querySelectorAll(`[data-msg-id="${m.id}"]`).forEach((btn) => {
    btn.addEventListener('click', () => this.handleMessageAction(btn.dataset.msgAction, btn.dataset.msgId));
  });
  this.updateLikyDot();
  pin();

  if (animateText) {
    revealMessageRow(newRow, { pin, textByTarget });
  }
};

SkriptEditorView.prototype.renderMessage = function(m) {
  return messageHtml(m, {
    istFragenModus: this.istFragenModus(),
    genLaeuft: !!this.genStatus?.laeuft
  });
};

SkriptEditorView.prototype.versionsHinweisHtml = function() {
  return versionsHinweisHtml({
    neuModus: false,
    versionen: this.versionen,
    aktiveVersion: this.aktiveVersion
  });
};

SkriptEditorView.prototype.bindGenRetry = function(el) {
  el.querySelector('#ed-gen-retry')?.addEventListener('click', () => {
    this.startGenerationAusFragen();
  });
  el.querySelector('#ed-gen-cancel')?.addEventListener('click', () => this.brichGenerationAb());
};

SkriptEditorView.prototype.renderCost = function() {
  const el = document.getElementById('ed-cost');
  if (!el) return;
  if (!this.skript) {
    el.textContent = '';
    el.title = '';
    return;
  }
  const entries = [
    { model: this.skript.model, usage: this.skript.prompt_kontext?.usage },
    ...this.messages.map((m) => ({ model: m.model, usage: m.usage }))
  ];
  const cost = formatUsageCost(entries);
  el.textContent = cost ? cost.label : '';
  if (cost) el.title = cost.tooltip;
};

SkriptEditorView.prototype.setChatInputAktiv = function(aktiv) {
  const input = document.getElementById('ed-input');
  const send = document.getElementById('ed-send');
  if (input) {
    input.disabled = !aktiv;
    input.placeholder = aktiv ? PLACEHOLDER_DEFAULT : PLACEHOLDER_NEU;
  }
  if (send) send.disabled = !aktiv;
};
