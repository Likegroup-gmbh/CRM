// BriefingLikyPanel.js
// Liky in der rechten Spalte des Briefing-Multistep. Derselbe Composer wie
// am Produkt (likyComposer.js), nur mit PDF statt URL: Datei per Drag & Drop
// in die Karte ziehen, absenden, Liky fuellt das Formular vor. Danach freier
// Chat im selben Eingabefeld.
//
// Was Liky hier darf, steht zentral in core/chat/likyCapabilities.js
// (briefing: extract 'pdf', chat true) - nicht in dieser Datei.
//
// Ablauf Extract: Drop -> Send -> silent Draft (falls noetig) -> Upload ->
// Job -> Poll -> Apply (nur leere Felder) -> Produkt-Sync -> knapper Ergebnis-Turn.
// Job und Upload: briefingLikyJob.js, Verlauf: briefingLikyVerlauf.js, Spec: briefingLikySpec.js.

import { setLikySendBusy, likyPdfTagHtml } from '../../../core/chat/likyComposer.js';
import { BriefingExtractApply, coerceFieldMap } from './BriefingExtractApply.js';
import { likyCanExtractPdf, likyHasChat } from '../../../core/chat/likyCapabilities.js';
import { bindChatLog } from '../../../core/chat/chatLog.js';
import { buildSpec } from './briefingLikySpec.js';
import { installBriefingLikyJob } from './briefingLikyJob.js';
import { installBriefingLikyVerlauf } from './briefingLikyVerlauf.js';

export { buildSpec, formatExtractResult } from './briefingLikySpec.js';

const ENTITY = 'briefing';
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export class BriefingLikyPanel {
  constructor(briefingCreate) {
    this.briefing = briefingCreate;
    this.apply = new BriefingExtractApply(briefingCreate);
    // [{ rolle: 'user'|'liky', text }] - ueberlebt Step-Renders
    this.transcript = [];
    this.hydrated = false;
    this.pendingFile = null;
    this.kundenbriefing = null;
    this.running = false;
    // Laufender Liky-Beitrag fuer Thinking-Steps (transient, nicht im Transcript)
    this.turn = null;
    this.slot = null;
    this.received = [];
    this._laufAbort = null;
    this._chatLog = null;
  }

  /** Nach jedem renderMultistep: DOM-Refs neu holen, Verlauf wiederzeichnen. */
  mount() {
    this._chatLog?.destroy();
    this._chatLog = null;
    this.side = document.querySelector('.briefing-liky-side');
    this.feed = document.getElementById('briefing-liky-feed');
    if (!this.side || !this.feed) return;

    this._chatLog = bindChatLog(this.feed);
    this.apply.setForm(document.getElementById('briefing-form'));
    this.turn = null;
    this.slot = null;
    this.renderTranscript();
    this.renderChip();
    this.bindComposer();
    this.apply.markVisible();

    if (!this.hydrated) {
      this.hydrated = true;
      this.hydrate();
    }
  }

  /** Edit-Modus: Kundenbriefing, Chat-Verlauf und aiFill aus der DB holen. */
  async hydrate() {
    if (!this.briefing.editId) return;
    try {
      const [{ data: kb }, { data: messages }, { data: lastJob }] = await Promise.all([
        window.supabase.from('kundenbriefings').select('*')
          .eq('briefing_id', this.briefing.editId).maybeSingle(),
        window.supabase.from('briefing_chat_messages').select('rolle, inhalt')
          .eq('briefing_id', this.briefing.editId).order('created_at'),
        window.supabase.from('briefing_pdf_jobs').select('result')
          .eq('briefing_id', this.briefing.editId)
          .eq('modus', 'extract').eq('status', 'done')
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
      ]);

      this.kundenbriefing = kb || null;
      if (messages?.length) {
        this.transcript = messages.map((m) => ({
          rolle: m.rolle === 'user' ? 'user' : 'liky',
          text: m.inhalt
        }));
        this.renderTranscript();
      }
      const fields = coerceFieldMap(lastJob?.result?.fields);
      for (const [name, entry] of Object.entries(fields)) {
        this.apply.aiFill.set(name, entry);
      }
      if (Object.keys(fields).length) this.apply.markVisible();
    } catch (error) {
      console.warn('Liky-Verlauf konnte nicht geladen werden:', error);
    }
  }

  // ---------------------------------------------------------------
  // Composer: Drop + Send
  // ---------------------------------------------------------------
  bindComposer() {
    const composer = document.getElementById('briefing-liky-composer');
    const input = document.getElementById('briefing-liky-input');
    const send = document.getElementById('briefing-liky-send');
    if (!composer || !input || !send) return;

    send.addEventListener('click', () => this.onSend());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.onSend();
      }
    });

    // Einfuegen aus der Zwischenablage (PDF liegt selten im Clipboard vor,
    // aber kostet nichts)
    input.addEventListener('paste', (e) => {
      const file = [...(e.clipboardData?.files || [])][0];
      if (file) {
        e.preventDefault();
        this.attachFile(file);
      }
    });

    // Drop-Ziel ist die ganze Spalte, die optische Markierung sitzt am Composer
    this.side.addEventListener('dragover', (e) => {
      e.preventDefault();
      composer.classList.add('is-dragover');
    });
    this.side.addEventListener('dragleave', (e) => {
      if (!this.side.contains(e.relatedTarget)) {
        composer.classList.remove('is-dragover');
      }
    });
    this.side.addEventListener('drop', (e) => {
      e.preventDefault();
      composer.classList.remove('is-dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) this.attachFile(file);
    });
  }

  attachFile(file) {
    if (!likyCanExtractPdf(ENTITY)) {
      this.pushLiky('PDF-Auslesen ist auf dieser Seite ausgeschaltet.');
      return;
    }
    if (file.type !== 'application/pdf') {
      this.pushLiky('Nur PDF. Kein Word, kein PNG.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      this.pushLiky('Zu groß. Maximal 20 MB.');
      return;
    }
    this.pendingFile = file;
    this.renderChip();
  }

  clearPendingFile() {
    this.pendingFile = null;
    this.renderChip();
  }

  renderChip() {
    const chips = document.getElementById('briefing-liky-chips');
    if (!chips) return;
    if (!this.pendingFile) {
      chips.innerHTML = '';
      return;
    }
    chips.innerHTML = likyPdfTagHtml(this.pendingFile.name, { remove: true });
    chips.querySelector('button')?.addEventListener('click', () => this.clearPendingFile());
  }

  async onSend() {
    // Im Lauf ist der Button Stopp: Klick bricht ab, keine zweite Nachricht
    if (this.running) {
      this.abortLauf();
      return;
    }
    const input = document.getElementById('briefing-liky-input');
    const text = (input?.value || '').trim();

    if (this.pendingFile) {
      const file = this.pendingFile;
      this.clearPendingFile();
      if (input) input.value = '';
      await this.runExtract(file);
      return;
    }

    if (!text) return;
    if (!likyHasChat(ENTITY)) return;
    if (input) input.value = '';
    await this.runChat(text);
  }

  // ---------------------------------------------------------------
  // Extract
  // ---------------------------------------------------------------
  async runExtract(file) {
    if (!this.briefing.formData.unternehmen_id) {
      this.pushUser(file.name);
      this.pushLiky('Erst das Unternehmen wählen, dann das PDF.');
      return;
    }

    this.setRunning(true);

    try {
      if (!this.briefing.editId) {
        this.briefing.saveCurrentStepData();
        await this.briefing.persistDraft();
      }

      // Erst nach dem Draft pushen, damit die Nachricht auch gespeichert wird
      this.pushUser(file.name);
      this.openLikyTurn();

      const path = await this.uploadPdf(file);
      const spec = buildSpec(this.briefing.selectedBereich);
      // Kein Base64 durch den Function-Request (Netlify-Body-Limit, 413) -
      // die Function laedt das PDF selbst aus dem Storage (Service-Role).
      const result = await this.runJob('extract', { spec, pdfPath: path });

      const { applied, skipped } = this.apply.apply(result.fields || {}, spec);
      this.apply.renderAndMark();
      // Produkte aus dem PDF im Hintergrund anlegen oder verknüpfen (ADR 0074)
      void this.briefing.produkteVerknuepfen?.();

      // renderAndMark hat das DOM neu gebaut - frischen Liky-Beitrag oeffnen
      this.openLikyTurn();
      this.showResult(result, applied, skipped);
    } catch (error) {
      if (error?.name === 'AbortError') {
        this.finishAbort();
        return;
      }
      console.error('Briefing-Extract:', error);
      this.addError(error.message);
    } finally {
      this.setRunning(false);
    }
  }

  // ---------------------------------------------------------------
  // Chat
  // ---------------------------------------------------------------
  async runChat(text) {
    if (!this.briefing.formData.unternehmen_id) {
      this.pushUser(text);
      this.pushLiky('Erst das Unternehmen wählen, dann kann ich mitdenken.');
      return;
    }

    this.setRunning(true);

    try {
      if (!this.briefing.editId) {
        this.briefing.saveCurrentStepData();
        await this.briefing.persistDraft();
      }

      this.pushUser(text);
      this.openLikyTurn();

      const spec = buildSpec(this.briefing.selectedBereich);
      const result = await this.runJob('chat', {
        spec,
        formData: this.briefing.formData,
        userText: text,
        history: this.transcript.slice(-20).map((t) => ({
          rolle: t.rolle === 'user' ? 'user' : 'assistant',
          inhalt: t.text
        }))
      });

      if (result.patches && Object.keys(result.patches).length) {
        const { applied } = this.apply.applyPatches(result.patches, spec);
        if (applied.length) this.apply.renderAndMark();
      }

      this.pushLiky(result.reply || 'Verstanden.');
    } catch (error) {
      if (error?.name === 'AbortError') {
        this.finishAbort();
        return;
      }
      console.error('Briefing-Chat:', error);
      this.addError(error.message);
    } finally {
      this.setRunning(false);
    }
  }

  setRunning(running) {
    this.running = running;
    if (running) {
      this._laufAbort = new AbortController();
    } else {
      this._laufAbort = null;
    }
    const send = document.getElementById('briefing-liky-send');
    setLikySendBusy(send, running);
  }

  /** Stopp-Klick: Poll beenden, Ergebnis wird nicht mehr angewendet. */
  abortLauf() {
    this._laufAbort?.abort();
  }

  destroy() {
    this._chatLog?.destroy();
    this._chatLog = null;
    this.transcript = [];
    this.hydrated = false;
    this.pendingFile = null;
    this.kundenbriefing = null;
    this.turn = null;
    this.slot = null;
    this.received = [];
    this.side = null;
    this.feed = null;
  }
}

installBriefingLikyJob(BriefingLikyPanel.prototype);
installBriefingLikyVerlauf(BriefingLikyPanel.prototype);
