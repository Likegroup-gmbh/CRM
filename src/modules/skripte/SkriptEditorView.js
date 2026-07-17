// SkriptEditorView.js
// Chat-basierter Skript-Editor (3 Spalten, nach Figma-Entwurf):
//   links   Skriptliste zum Umschalten
//   mitte   Skript (Hook/Hauptteil/CTA) mit Selektions-Menue + Chat-Eingabe
//   rechts  Chat-Verlauf mit Aktions-Tag, Status und Annehmen/Ablehnen
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

const AKTION_ICONS = {
  neu_schreiben: '&#9998;',
  kuerzen: '&#9986;',
  laenger: '&#8597;',
  anderer_ton: '&#119070;',
  chat: '&#128172;'
};

const SEKTION_LABELS = { hook: 'HOOK', hauptteil: 'HAUPTTEIL', cta: 'CTA', gesamt: 'GESAMT' };

export class SkriptEditorView {
  constructor(page) {
    this.page = page;
    this.skript = null;
    this.skripte = [];
    this.messages = [];
    this.versionNr = 1;
    this.selektion = null; // { sektion, text }
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
          <span class="skripte-editor-cost" id="ed-cost"></span>
        </div>
        <div class="skripte-editor-grid">
          <aside class="skripte-editor-liste" id="ed-liste"></aside>
          <main class="skripte-editor-main">
            <div class="skripte-editor-doc" id="ed-doc"></div>
            <div class="skripte-editor-inputwrap">
              <div class="skripte-editor-chip" id="ed-chip" style="display:none;"></div>
              <div class="skripte-editor-input">
                <textarea id="ed-input" rows="2" placeholder="Feedback geben oder Frage stellen…"></textarea>
                <button id="ed-send" class="skripte-editor-send" title="Senden" aria-label="Senden">&#10148;</button>
              </div>
            </div>
          </main>
          <aside class="skripte-editor-chat" id="ed-chat"></aside>
        </div>
        <div class="skripte-editor-selmenu" id="ed-selmenu" style="display:none;"></div>
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
      <p class="skripte-hint">Text markieren, um eine Stelle gezielt zu überarbeiten – oder unten Feedback eingeben.</p>
      ${['hook', 'hauptteil', 'cta'].map((sektion) => `
        <div class="skripte-editor-sektion" data-sektion="${sektion}">
          <div class="skripte-sektion-label">${SEKTION_LABELS[sektion]}</div>
          <div class="skripte-editor-sektion-text" data-sektion="${sektion}">${escapeHtml(this.skript[sektion] || '–')}</div>
        </div>
      `).join('')}
    `;
  }

  // ------------------------------------------------------------------
  // Rechte Spalte: Chat-Verlauf
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

  renderMessage(m) {
    if (m.rolle === 'user') {
      const tag = m.aktion && m.aktion !== 'chat'
        ? `<span class="skripte-editor-tag">${AKTION_ICONS[m.aktion] || ''} ${escapeHtml(AKTION_LABELS[m.aktion])}${m.sektion && m.sektion !== 'gesamt' ? ` · ${SEKTION_LABELS[m.sektion]}` : ''}</span>`
        : '';
      return `
        <div class="skripte-editor-msg skripte-editor-msg--user">
          ${tag}
          ${m.inhalt ? `<div class="skripte-editor-msg-text">${escapeHtml(m.inhalt)}</div>` : ''}
          ${m.selektion_text ? `<div class="skripte-editor-msg-quote">${escapeHtml(m.selektion_text)}</div>` : ''}
        </div>
      `;
    }

    // Assistant
    const tag = m.aktion
      ? `<span class="skripte-editor-tag">${AKTION_ICONS[m.aktion] || ''} ${escapeHtml(AKTION_LABELS[m.aktion])}${m.sektion && m.sektion !== 'gesamt' ? ` · ${SEKTION_LABELS[m.sektion]}` : ''}</span>`
      : '';

    if (m.status === 'pending' || m.status === 'running') {
      return `
        <div class="skripte-editor-msg skripte-editor-msg--assistant">
          ${tag}
          <div class="skripte-editor-working"><span class="skripte-editor-dots"><i></i><i></i><i></i></span> Ich arbeite gerade…</div>
        </div>
      `;
    }

    if (m.status === 'error') {
      return `
        <div class="skripte-editor-msg skripte-editor-msg--assistant">
          ${tag}
          <div class="skripte-editor-msg-error">Fehler: ${escapeHtml(m.error_message || 'Unbekannt')}</div>
          <div class="skripte-editor-msg-actions">
            <button class="secondary-btn" data-msg-action="retry" data-msg-id="${m.id}">Nochmal versuchen</button>
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
          <button class="primary-btn" data-msg-action="accept" data-msg-id="${m.id}">Änderung annehmen</button>
          <button class="secondary-btn" data-msg-action="reject" data-msg-id="${m.id}">Ablehnen</button>
          <button class="secondary-btn" data-msg-action="retry" data-msg-id="${m.id}">Neu schreiben</button>
        </div>
      `;
    } else if (m.status === 'angenommen') {
      footer = `<div class="skripte-editor-msg-state">${badge('Angenommen', 'success')}</div>`;
    } else if (m.status === 'abgelehnt') {
      footer = `<div class="skripte-editor-msg-state">${badge('Abgelehnt', 'danger')}</div>`;
    }

    return `
      <div class="skripte-editor-msg skripte-editor-msg--assistant">
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
      if (menu && menu.style.display !== 'none' && !menu.contains(e.target)) {
        menu.style.display = 'none';
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
      menu.style.display = 'none';
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
      menu.style.display = 'none';
      return;
    }

    const sektion = start.dataset.sektion;
    this.selektion = { sektion, text };
    this.showSelectionChip();

    menu.innerHTML = ['neu_schreiben', 'kuerzen', 'laenger', 'anderer_ton'].map((aktion) => `
      <button data-aktion="${aktion}">${AKTION_ICONS[aktion]} ${AKTION_LABELS[aktion]}</button>
    `).join('');
    menu.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        menu.style.display = 'none';
        this.startAktion(btn.dataset.aktion);
      });
    });

    // Position: unter dem Ende der Auswahl, relativ zum Editor-Wrapper
    const wrap = this.container.querySelector('.skripte-editor');
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    menu.style.display = 'flex';
    menu.style.top = `${rect.bottom - wrapRect.top + 6}px`;
    menu.style.left = `${Math.max(8, Math.min(rect.left - wrapRect.left, wrap.clientWidth - 340))}px`;
  }

  showSelectionChip() {
    const chip = document.getElementById('ed-chip');
    if (!chip) return;
    if (!this.selektion) {
      chip.style.display = 'none';
      return;
    }
    const kurz = this.selektion.text.length > 60 ? `${this.selektion.text.slice(0, 60)}…` : this.selektion.text;
    chip.style.display = 'flex';
    chip.innerHTML = `
      <span>Auswahl · ${SEKTION_LABELS[this.selektion.sektion]}: „${escapeHtml(kurz)}“</span>
      <button id="ed-chip-clear" title="Auswahl entfernen" aria-label="Auswahl entfernen">&times;</button>
    `;
    chip.querySelector('#ed-chip-clear').addEventListener('click', () => {
      this.selektion = null;
      chip.style.display = 'none';
      window.getSelection()?.removeAllRanges();
    });
  }

  // ------------------------------------------------------------------
  // Aktionen ausloesen (Selektions-Menue oder Chat-Input)
  // ------------------------------------------------------------------
  async startAktion(aktion, userText = null) {
    if (!this.selektion) return;
    const { sektion, text } = this.selektion;

    let inhalt = userText;
    if (aktion === 'anderer_ton' && !inhalt) {
      inhalt = window.prompt('Welcher Ton soll es werden? (z.B. lockerer, emotionaler, seriöser)') || null;
      if (inhalt === null) return;
      inhalt = inhalt.trim() || null;
    }

    this.selektion = null;
    this.showSelectionChip();
    window.getSelection()?.removeAllRanges();

    await this.sendMessagePair({ aktion, sektion, selektion_text: text, inhalt });
  }

  async sendChat() {
    const input = document.getElementById('ed-input');
    const text = input?.value.trim();
    if (!text) return;
    input.value = '';

    const sel = this.selektion;
    this.selektion = null;
    this.showSelectionChip();
    window.getSelection()?.removeAllRanges();

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
