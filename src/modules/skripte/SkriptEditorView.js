// SkriptEditorView.js
// Chat-basierter Skript-Editor (3 Spalten in einer Shell, nach Figma):
//   links   Skriptliste zum Umschalten
//   mitte   Skript (Hook/Hauptteil/CTA) mit Selektions-Menue + Chat-Eingabe
//   rechts  Chat-Verlauf ("Liky") mit Aktions-Tag, Status und Annehmen/Ablehnen
// Die Assistant-Message in skript_chat_messages ist der Job (Realtime + Poll).

import { skripteService } from './SkripteService.js';
import { escapeHtml, formatDate, badge, formatUsageCost } from './SkripteUtils.js';

const AKTION_LABELS = {
  neu_schreiben: 'Neu schreiben',
  kuerzen: 'Kürzen',
  laenger: 'Länger',
  anderer_ton: 'Anderer Ton',
  chat: 'Feedback'
};

// Phosphor-Icons (Inline-SVG, skalieren ueber CSS, Farbe via currentColor)
const AKTION_ICONS = {
  neu_schreiben: '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M48,64a8,8,0,0,1,8-8H72V40a8,8,0,0,1,16,0V56h16a8,8,0,0,1,0,16H88V88a8,8,0,0,1-16,0V72H56A8,8,0,0,1,48,64ZM184,192h-8v-8a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0v-8h8a8,8,0,0,0,0-16Zm56-48H224V128a8,8,0,0,0-16,0v16H192a8,8,0,0,0,0,16h16v16a8,8,0,0,0,16,0V160h16a8,8,0,0,0,0-16ZM219.31,80,80,219.31a16,16,0,0,1-22.62,0L36.68,198.63a16,16,0,0,1,0-22.63L176,36.69a16,16,0,0,1,22.63,0l20.68,20.68A16,16,0,0,1,219.31,80Zm-54.63,32L144,91.31l-96,96L68.68,208ZM208,68.69,187.31,48l-32,32L176,100.69Z"></path></svg>',
  kuerzen: '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M157.73,113.13A8,8,0,0,1,159.82,102L227.48,55.7a8,8,0,0,1,9,13.21l-67.67,46.3a7.92,7.92,0,0,1-4.51,1.4A8,8,0,0,1,157.73,113.13Zm80.87,85.09a8,8,0,0,1-11.12,2.08L136,137.7,93.49,166.78a36,36,0,1,1-9-13.19L121.83,128,84.44,102.41a35.86,35.86,0,1,1,9-13.19l143,97.87A8,8,0,0,1,238.6,198.22ZM80,180a20,20,0,1,0-5.86,14.14A19.85,19.85,0,0,0,80,180ZM74.14,90.13a20,20,0,1,0-28.28,0A19.85,19.85,0,0,0,74.14,90.13Z"></path></svg>',
  laenger: '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M216,48V96a8,8,0,0,1-16,0V67.31l-50.34,50.35a8,8,0,0,1-11.32-11.32L188.69,56H160a8,8,0,0,1,0-16h48A8,8,0,0,1,216,48ZM106.34,138.34,56,188.69V160a8,8,0,0,0-16,0v48a8,8,0,0,0,8,8H96a8,8,0,0,0,0-16H67.31l50.35-50.34a8,8,0,0,0-11.32-11.32Z"></path></svg>',
  anderer_ton: '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M56,96v64a8,8,0,0,1-16,0V96a8,8,0,0,1,16,0ZM88,24a8,8,0,0,0-8,8V224a8,8,0,0,0,16,0V32A8,8,0,0,0,88,24Zm40,32a8,8,0,0,0-8,8V192a8,8,0,0,0,16,0V64A8,8,0,0,0,128,56Zm40,32a8,8,0,0,0-8,8v64a8,8,0,0,0,16,0V96A8,8,0,0,0,168,88Zm40-16a8,8,0,0,0-8,8v96a8,8,0,0,0,16,0V80A8,8,0,0,0,208,72Z"></path></svg>',
  chat: ''
};

const SEND_ICON = '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M231.87,114l-168-95.89A16,16,0,0,0,40.92,37.34L71.55,128,40.92,218.67A16,16,0,0,0,56,240a16.15,16.15,0,0,0,7.93-2.1l167.92-96.05a16,16,0,0,0,.05-27.89ZM56,224a.56.56,0,0,0,0-.12L85.74,136H144a8,8,0,0,0,0-16H85.74L56.06,32.16A.46.46,0,0,0,56,32l168,95.83Z"></path></svg>';

const SEKTION_LABELS = { hook: 'HOOK', hauptteil: 'HAUPTTEIL', cta: 'CTA', gesamt: 'GESAMT' };

const PLACEHOLDER_DEFAULT = 'Feedback geben oder Frage stellen…';
const PLACEHOLDER_AKTION = 'Anweisung ergänzen (optional) – Enter startet';

export class SkriptEditorView {
  constructor(page) {
    this.page = page;
    this.skript = null;
    this.skripte = [];
    this.messages = [];
    this.versionNr = 1;
    this.selektion = null; // { sektion, text }
    this.pendingAktion = null; // 'neu_schreiben' | 'kuerzen' | 'laenger' | 'anderer_ton' | null
    this.channel = null;
    this.pollInterval = null;
    this.onMouseUp = null;
    this.onDocMouseDown = null;
  }

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------
  async render(container, skriptId) {
    this.cleanup();
    this.container = container;

    container.innerHTML = '<div class="empty-state"><p>Skript wird geladen...</p></div>';

    const [skript, skripte, messages, versionen] = await Promise.all([
      skripteService.loadSkript(skriptId),
      skripteService.loadSkripte(),
      skripteService.getChatMessages(skriptId),
      skripteService.getVersionen(skriptId)
    ]);

    if (!skript) {
      container.innerHTML = '<div class="empty-state"><p>Skript nicht gefunden.</p></div>';
      return;
    }

    this.skript = skript;
    this.skripte = skripte;
    this.messages = messages;
    this.versionNr = versionen.length ? versionen[versionen.length - 1].version_nr : 1;

    this.renderLayout();
    this.bindEvents();
    this.subscribe();

    // Nach Reload waehrend laufender Anfrage: Poll-Fallback direkt starten
    if (this.messages.some((m) => m.status === 'pending' || m.status === 'running')) {
      this.ensurePolling();
    }
  }

  renderLayout() {
    this.container.innerHTML = `
      <div class="skripte-editor">
        <div class="skripte-editor-topbar">
          <button class="secondary-btn" id="ed-back">&larr; Zurück</button>
          <div class="skripte-editor-topbar-meta">
            ${this.skript.unternehmen?.firmenname ? badge(this.skript.unternehmen.firmenname) : ''}
            ${this.skript.marke?.markenname ? badge(this.skript.marke.markenname) : ''}
            ${this.skript.personas?.name ? badge(this.skript.personas.name, 'info') : ''}
            ${badge(this.skript.mit_dna === false ? 'ohne DNA' : 'mit DNA', this.skript.mit_dna === false ? 'neutral' : 'success')}
          </div>
        </div>
        <div class="skripte-editor-shell">
          <aside class="skripte-editor-liste" id="ed-liste"></aside>
          <main class="skripte-editor-main">
            <div class="skripte-editor-doc" id="ed-doc"></div>
            <div class="skripte-editor-inputwrap">
              <div class="skripte-editor-chip" id="ed-chip" hidden></div>
              <div class="skripte-editor-input">
                <textarea id="ed-input" rows="2" placeholder="${PLACEHOLDER_DEFAULT}"></textarea>
                <div class="skripte-editor-input-footer">
                  <span class="skripte-editor-cost" id="ed-cost"></span>
                  <button id="ed-send" class="skripte-editor-send" title="Senden" aria-label="Senden">${SEND_ICON}</button>
                </div>
              </div>
            </div>
          </main>
          <aside class="skripte-editor-chat" id="ed-chat"></aside>
        </div>
        <div class="skripte-editor-selmenu" id="ed-selmenu" hidden></div>
      </div>
    `;

    this.renderListe();
    this.renderDoc();
    this.renderChat();
    this.renderCost();
  }

  cleanup() {
    if (this.channel) {
      window.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.onMouseUp) {
      document.removeEventListener('mouseup', this.onMouseUp);
      this.onMouseUp = null;
    }
    if (this.onDocMouseDown) {
      document.removeEventListener('mousedown', this.onDocMouseDown);
      this.onDocMouseDown = null;
    }
    this.selektion = null;
    this.pendingAktion = null;
  }

  // ------------------------------------------------------------------
  // Linke Spalte: Skriptliste
  // ------------------------------------------------------------------
  renderListe() {
    const el = document.getElementById('ed-liste');
    if (!el) return;
    el.innerHTML = `
      <div class="skripte-editor-liste-head">Skripte</div>
      ${this.skripte.map((s) => `
        <button class="skripte-editor-liste-item ${s.id === this.skript.id ? 'active' : ''}" data-id="${s.id}">
          <span class="skripte-editor-liste-titel">${escapeHtml(s.titel || s.hook?.slice(0, 50) || '(ohne Titel)')}</span>
          <span class="skripte-editor-liste-sub">${escapeHtml([s.marke?.markenname || s.unternehmen?.firmenname, formatDate(s.created_at)].filter(Boolean).join(' · '))}</span>
        </button>
      `).join('')}
    `;
    el.querySelectorAll('.skripte-editor-liste-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.id !== this.skript.id) this.page.openEditor(btn.dataset.id);
      });
    });
  }

  // ------------------------------------------------------------------
  // Mitte: Skript-Dokument
  // ------------------------------------------------------------------
  renderDoc() {
    const el = document.getElementById('ed-doc');
    if (!el) return;
    el.innerHTML = `
      <div class="skripte-editor-doc-head">
        <h2>${escapeHtml(this.skript.titel || 'Skript')}</h2>
        <span class="skripte-badge skripte-badge--info" title="Jede angenommene Änderung erzeugt eine neue Version">v${this.versionNr}</span>
      </div>
      <div class="skripte-editor-doc-box">
        ${['hook', 'hauptteil', 'cta'].map((sektion) => `
          <div class="skripte-editor-sektion" data-sektion="${sektion}">
            <div class="skripte-sektion-label">${SEKTION_LABELS[sektion]}</div>
            <div class="skripte-editor-sektion-text" data-sektion="${sektion}">${escapeHtml(this.skript[sektion] || '–')}</div>
          </div>
        `).join('')}
      </div>
      <p class="skripte-hint">Text markieren, um eine Stelle gezielt zu überarbeiten – oder unten Feedback eingeben.</p>
    `;
  }

  // ------------------------------------------------------------------
  // Rechte Spalte: Chat-Verlauf ("Liky")
  // ------------------------------------------------------------------
  renderChat() {
    const el = document.getElementById('ed-chat');
    if (!el) return;

    if (!this.messages.length) {
      el.innerHTML = `
        <div class="skripte-editor-chat-empty">
          <p>Noch kein Verlauf.</p>
          <p class="skripte-hint">Markiere eine Stelle im Skript und wähle eine Aktion – oder schreib unten dein Feedback. Vorschläge kannst du hier annehmen oder ablehnen.</p>
        </div>
      `;
      return;
    }

    el.innerHTML = this.messages.map((m) => this.renderMessage(m)).join('');

    el.querySelectorAll('[data-msg-action]').forEach((btn) => {
      btn.addEventListener('click', () => this.handleMessageAction(btn.dataset.msgAction, btn.dataset.msgId));
    });

    el.scrollTop = el.scrollHeight;
  }

  renderAktionTag(m) {
    if (!m.aktion || m.aktion === 'chat') return '';
    const icon = AKTION_ICONS[m.aktion] ? `<span class="skripte-editor-tag-icon">${AKTION_ICONS[m.aktion]}</span>` : '';
    const sektion = m.sektion && m.sektion !== 'gesamt' ? ` · ${SEKTION_LABELS[m.sektion]}` : '';
    return `<span class="skripte-editor-tag">${icon}${escapeHtml(AKTION_LABELS[m.aktion])}${sektion}</span>`;
  }

  renderMessage(m) {
    if (m.rolle === 'user') {
      return `
        <div class="skripte-editor-msg skripte-editor-msg--user">
          ${this.renderAktionTag(m)}
          ${m.inhalt ? `<div class="skripte-editor-msg-text">${escapeHtml(m.inhalt)}</div>` : ''}
          ${m.selektion_text ? `<div class="skripte-editor-msg-quote">${escapeHtml(m.selektion_text)}</div>` : ''}
        </div>
      `;
    }

    // Assistant ("Liky")
    const head = `
      <div class="skripte-editor-msg-head">
        <span class="skripte-editor-avatar">${SEND_ICON}</span>
        <span class="skripte-editor-msg-name">Liky</span>
      </div>
    `;
    const tag = this.renderAktionTag(m);

    if (m.status === 'pending' || m.status === 'running') {
      return `
        <div class="skripte-editor-msg skripte-editor-msg--assistant">
          ${head}
          ${tag}
          <div class="skripte-editor-working"><span class="skripte-editor-dots"><i></i><i></i><i></i></span> Ich arbeite gerade…</div>
        </div>
      `;
    }

    if (m.status === 'error') {
      return `
        <div class="skripte-editor-msg skripte-editor-msg--assistant">
          ${head}
          ${tag}
          <div class="skripte-editor-msg-error">Fehler: ${escapeHtml(m.error_message || 'Unbekannt')}</div>
          <div class="skripte-editor-msg-actions">
            <button class="skripte-editor-pill-btn" data-msg-action="retry" data-msg-id="${m.id}">Nochmal versuchen</button>
          </div>
        </div>
      `;
    }

    const vorschlagBlock = m.vorschlag_text ? `
      <div class="skripte-editor-vorschlag ${m.status === 'angenommen' ? 'is-angenommen' : ''} ${m.status === 'abgelehnt' ? 'is-abgelehnt' : ''}">
        <div class="skripte-editor-vorschlag-label">Vorschlag${m.sektion && m.sektion !== 'gesamt' ? ` · ${SEKTION_LABELS[m.sektion]}` : ''}</div>
        <div class="skripte-editor-vorschlag-text">${escapeHtml(m.vorschlag_text)}</div>
      </div>
    ` : '';

    let footer = '';
    if (m.status === 'vorschlag') {
      footer = `
        <div class="skripte-editor-msg-actions">
          <button class="skripte-editor-pill-btn skripte-editor-pill-btn--primary" data-msg-action="accept" data-msg-id="${m.id}">Änderung annehmen</button>
          <button class="skripte-editor-pill-btn" data-msg-action="reject" data-msg-id="${m.id}">Änderung ablehnen</button>
          <button class="skripte-editor-pill-btn" data-msg-action="retry" data-msg-id="${m.id}">Neu schreiben</button>
        </div>
      `;
    } else if (m.status === 'angenommen') {
      footer = `<div class="skripte-editor-msg-state">${badge('Angenommen', 'success')}</div>`;
    } else if (m.status === 'abgelehnt') {
      footer = `<div class="skripte-editor-msg-state">${badge('Abgelehnt', 'danger')}</div>`;
    }

    return `
      <div class="skripte-editor-msg skripte-editor-msg--assistant">
        ${head}
        ${tag}
        ${m.inhalt ? `<div class="skripte-editor-msg-text">${escapeHtml(m.inhalt)}</div>` : ''}
        ${vorschlagBlock}
        ${footer}
      </div>
    `;
  }

  renderCost() {
    const el = document.getElementById('ed-cost');
    if (!el) return;
    const entries = [
      { model: this.skript.model, usage: this.skript.prompt_kontext?.usage },
      ...this.messages.map((m) => ({ model: m.model, usage: m.usage }))
    ];
    const cost = formatUsageCost(entries);
    el.textContent = cost ? cost.label : '';
    if (cost) el.title = cost.tooltip;
  }

  // ------------------------------------------------------------------
  // Events: Selektion, Menue, Chat-Input
  // ------------------------------------------------------------------
  bindEvents() {
    document.getElementById('ed-back')?.addEventListener('click', () => this.page.closeEditor());

    const input = document.getElementById('ed-input');
    document.getElementById('ed-send')?.addEventListener('click', () => this.sendChat());
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendChat();
      }
      if (e.key === 'Escape' && this.pendingAktion) {
        this.clearPending();
      }
    });

    // Selektions-Menue: nach Mouseup pruefen, ob Auswahl in einer Sektion liegt
    this.onMouseUp = (e) => {
      const menu = document.getElementById('ed-selmenu');
      if (!menu || menu.contains(e.target)) return;
      // Timeout: Selection ist erst nach dem Event final
      setTimeout(() => this.checkSelection(), 10);
    };
    document.addEventListener('mouseup', this.onMouseUp);

    this.onDocMouseDown = (e) => {
      const menu = document.getElementById('ed-selmenu');
      if (menu && !menu.hidden && !menu.contains(e.target)) {
        menu.hidden = true;
      }
    };
    document.addEventListener('mousedown', this.onDocMouseDown);
  }

  checkSelection() {
    const menu = document.getElementById('ed-selmenu');
    const doc = document.getElementById('ed-doc');
    if (!menu || !doc) return;

    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!sel || sel.isCollapsed || !text) {
      menu.hidden = true;
      return;
    }

    // Beide Enden der Auswahl muessen in derselben Sektion liegen
    const findSektion = (node) => {
      let el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      return el?.closest?.('.skripte-editor-sektion-text') || null;
    };
    const start = findSektion(sel.anchorNode);
    const end = findSektion(sel.focusNode);
    if (!start || start !== end) {
      menu.hidden = true;
      return;
    }

    const sektion = start.dataset.sektion;
    this.selektion = { sektion, text };
    this.pendingAktion = null;
    this.updateChip();

    menu.innerHTML = ['neu_schreiben', 'kuerzen', 'laenger', 'anderer_ton'].map((aktion) => `
      <button data-aktion="${aktion}">
        <span class="skripte-editor-selmenu-icon">${AKTION_ICONS[aktion]}</span>
        <span>${AKTION_LABELS[aktion]}</span>
      </button>
    `).join('');
    menu.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        menu.hidden = true;
        this.setPendingAktion(btn.dataset.aktion);
      });
    });

    // Position: unter dem Ende der Auswahl, relativ zum Editor-Wrapper
    // (dynamische Koordinaten gehen nur per JS)
    const wrap = this.container.querySelector('.skripte-editor');
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    menu.hidden = false;
    menu.style.top = `${rect.bottom - wrapRect.top + 6}px`;
    menu.style.left = `${Math.max(8, Math.min(rect.left - wrapRect.left, wrap.clientWidth - 220))}px`;
  }

  /**
   * Aktion vormerken statt sofort auszufuehren: Der User kann erst noch
   * eine Anweisung eintippen (optional), Senden startet die Aktion.
   */
  setPendingAktion(aktion) {
    if (!this.selektion) return;
    this.pendingAktion = aktion;
    window.getSelection()?.removeAllRanges();
    this.updateChip();

    const input = document.getElementById('ed-input');
    if (input) {
      input.placeholder = PLACEHOLDER_AKTION;
      input.focus();
    }
  }

  clearPending() {
    this.selektion = null;
    this.pendingAktion = null;
    this.updateChip();
    window.getSelection()?.removeAllRanges();
    const input = document.getElementById('ed-input');
    if (input) input.placeholder = PLACEHOLDER_DEFAULT;
  }

  updateChip() {
    const chip = document.getElementById('ed-chip');
    if (!chip) return;
    if (!this.selektion) {
      chip.hidden = true;
      return;
    }
    const kurz = this.selektion.text.length > 60 ? `${this.selektion.text.slice(0, 60)}…` : this.selektion.text;
    const prefix = this.pendingAktion
      ? `${AKTION_LABELS[this.pendingAktion]} · ${SEKTION_LABELS[this.selektion.sektion]}`
      : `Auswahl · ${SEKTION_LABELS[this.selektion.sektion]}`;
    chip.hidden = false;
    chip.innerHTML = `
      ${this.pendingAktion && AKTION_ICONS[this.pendingAktion] ? `<span class="skripte-editor-tag-icon">${AKTION_ICONS[this.pendingAktion]}</span>` : ''}
      <span>${escapeHtml(prefix)}: „${escapeHtml(kurz)}“</span>
      <button id="ed-chip-clear" title="Abbrechen" aria-label="Abbrechen">&times;</button>
    `;
    chip.querySelector('#ed-chip-clear').addEventListener('click', () => this.clearPending());
  }

  // ------------------------------------------------------------------
  // Senden (freies Feedback oder vorgemerkte Aktion)
  // ------------------------------------------------------------------
  async sendChat() {
    const input = document.getElementById('ed-input');
    const text = input?.value.trim() || '';

    // Vorgemerkte Aktion: Anweisung ist optional, leer erlaubt
    if (this.pendingAktion && this.selektion) {
      const { sektion, text: selektionText } = this.selektion;
      const aktion = this.pendingAktion;
      input.value = '';
      this.clearPending();
      await this.sendMessagePair({ aktion, sektion, selektion_text: selektionText, inhalt: text || null });
      return;
    }

    // Freies Feedback braucht Text
    if (!text) return;
    input.value = '';

    const sel = this.selektion;
    this.clearPending();

    await this.sendMessagePair({
      aktion: 'chat',
      sektion: sel?.sektion || 'gesamt',
      selektion_text: sel?.text || null,
      inhalt: text
    });
  }

  /** User-Message + pending Assistant-Message anlegen, dann Function triggern. */
  async sendMessagePair({ aktion, sektion, selektion_text, inhalt }) {
    try {
      const userMsg = await skripteService.createChatMessage({
        skript_id: this.skript.id,
        rolle: 'user',
        aktion,
        sektion,
        selektion_text,
        inhalt,
        status: 'fertig'
      });
      this.messages.push(userMsg);

      // inhalt der pending Message = User-Anweisung (wird von der Function
      // als Auftrag gelesen und mit der Modell-Antwort ueberschrieben)
      const assistantMsg = await skripteService.createChatMessage({
        skript_id: this.skript.id,
        rolle: 'assistant',
        aktion,
        sektion,
        selektion_text,
        inhalt,
        status: 'pending'
      });
      this.messages.push(assistantMsg);
      this.renderChat();

      this.ensurePolling();
      await skripteService.triggerFunction('skript-edit-background', { messageId: assistantMsg.id });
    } catch (err) {
      window.toastSystem?.error(err.message);
    }
  }

  /** Erneuter Versuch: gleiche Anfrage als neue pending Assistant-Message. */
  async retryMessage(msg) {
    // Zugehoerige User-Anweisung aus dem Verlauf ziehen (letzte User-Message davor)
    const idx = this.messages.findIndex((m) => m.id === msg.id);
    let userInhalt = null;
    for (let i = idx - 1; i >= 0; i--) {
      if (this.messages[i].rolle === 'user') {
        userInhalt = this.messages[i].inhalt;
        break;
      }
    }

    try {
      if (msg.status === 'vorschlag') {
        await skripteService.updateChatMessage(msg.id, { status: 'abgelehnt' });
        msg.status = 'abgelehnt';
      }
      const assistantMsg = await skripteService.createChatMessage({
        skript_id: this.skript.id,
        rolle: 'assistant',
        aktion: msg.aktion,
        sektion: msg.sektion,
        selektion_text: msg.selektion_text,
        inhalt: userInhalt,
        status: 'pending'
      });
      this.messages.push(assistantMsg);
      this.renderChat();
      this.ensurePolling();
      await skripteService.triggerFunction('skript-edit-background', { messageId: assistantMsg.id });
    } catch (err) {
      window.toastSystem?.error(err.message);
    }
  }

  // ------------------------------------------------------------------
  // Vorschlag annehmen / ablehnen
  // ------------------------------------------------------------------
  async handleMessageAction(action, messageId) {
    const msg = this.messages.find((m) => m.id === messageId);
    if (!msg) return;

    if (action === 'retry') {
      await this.retryMessage(msg);
      return;
    }

    if (action === 'reject') {
      try {
        await skripteService.updateChatMessage(msg.id, { status: 'abgelehnt' });
        msg.status = 'abgelehnt';
        this.renderChat();
      } catch (err) {
        window.toastSystem?.error(err.message);
      }
      return;
    }

    if (action === 'accept') {
      await this.acceptVorschlag(msg);
    }
  }

  async acceptVorschlag(msg) {
    const sektion = msg.sektion;
    if (!['hook', 'hauptteil', 'cta'].includes(sektion) || !msg.vorschlag_text) {
      window.toastSystem?.error('Vorschlag kann nicht zugeordnet werden');
      return;
    }

    const alt = this.skript[sektion] || '';
    let neu;
    if (msg.selektion_text && alt.includes(msg.selektion_text)) {
      neu = alt.replace(msg.selektion_text, msg.vorschlag_text);
    } else {
      neu = msg.vorschlag_text;
    }

    const vorherigerStand = {
      titel: this.skript.titel,
      hook: this.skript.hook,
      hauptteil: this.skript.hauptteil,
      cta: this.skript.cta
    };

    try {
      await skripteService.updateSkript(this.skript.id, { [sektion]: neu });
      this.skript[sektion] = neu;

      const beschreibung = `${AKTION_LABELS[msg.aktion] || 'Änderung'} · ${SEKTION_LABELS[sektion]}`;
      this.versionNr = await skripteService.createVersion(this.skript, beschreibung, vorherigerStand);

      await skripteService.updateChatMessage(msg.id, { status: 'angenommen' });
      msg.status = 'angenommen';

      this.renderDoc();
      this.renderChat();
      window.toastSystem?.success(`Übernommen – jetzt v${this.versionNr}`);
    } catch (err) {
      window.toastSystem?.error(err.message);
    }
  }

  // ------------------------------------------------------------------
  // Realtime + Poll-Fallback
  // ------------------------------------------------------------------
  subscribe() {
    this.channel = skripteService.subscribeToChat(this.skript.id, (row, eventType) => {
      this.applyMessageUpdate(row, eventType);
    });
  }

  ensurePolling() {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(async () => {
      const offen = this.messages.filter((m) => m.status === 'pending' || m.status === 'running');
      if (!offen.length) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
        return;
      }
      for (const m of offen) {
        const fresh = await skripteService.pollChatMessage(m.id);
        if (fresh) this.applyMessageUpdate(fresh, 'UPDATE');
      }
    }, 5000);
  }

  applyMessageUpdate(row, eventType) {
    if (!row || row.skript_id !== this.skript?.id) return;
    const idx = this.messages.findIndex((m) => m.id === row.id);
    if (idx === -1) {
      if (eventType === 'INSERT' || eventType === 'UPDATE') this.messages.push(row);
    } else {
      // Lokal bereits final gesetzte Status (angenommen/abgelehnt) nicht
      // durch verspaetete Realtime-Events zuruecksetzen
      const lokal = this.messages[idx];
      if (['angenommen', 'abgelehnt'].includes(lokal.status) && ['vorschlag', 'running', 'pending'].includes(row.status)) return;
      this.messages[idx] = row;
    }
    this.renderChat();
    this.renderCost();
  }
}
