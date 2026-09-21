// PersonaLikyPanel.js
// Rechte Spalte am Persona-Worksheet: URL-Extract (extract_jobs),
// PDF-Extract oder Freitext-Chat (persona_liky_jobs). Ein Composer, Send entscheidet.
// Was Liky darf, steht in likyCapabilities (persona: extract url+pdf, chat true).

import { renderThinking, pushStep } from '../../core/chat/thinking.js';
import { isLikyPdfName, likyPdfTagHtml } from '../../core/chat/likyComposer.js';
import { ExtractReviewLayer } from '../../core/form/ai/ExtractReviewLayer.js';
import { ExtractCostBadge } from '../../core/form/ai/ExtractCostBadge.js';
import { toAbsoluteUrl, requestExtractJob } from '../../core/form/ai/SiteExtractHandler.js';
import { likyHasChat, likyCanExtractUrl, likyCanExtractPdf } from '../../core/chat/likyCapabilities.js';
import { bindChatLog } from '../../core/chat/chatLog.js';

const ENTITY = 'persona';
const CHAT_ENDPOINT = '/.netlify/functions/persona-liky-background';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const GRUSS = 'Schick mir eine Shop-URL, ein PDF oder beschreib die Persona in ein paar Sätzen. '
  + 'Ich fülle das Dokument. Was du selbst geschrieben hast, bleibt stehen.';

const SNAPSHOT_FELDER = [
  'name', 'oberbegriff', 'unternehmen_id', 'alter_von', 'alter_bis',
  'geschlecht', 'wohnort_region', 'beruf', 'budgetrahmen', 'bildungsstand',
  'lebenssituation', 'pain_points', 'interessen', 'beduerfnisse',
  'kaufmotive', 'einwaende', 'produkt_loesung', 'produktvorteile',
  'tonalitaet', 'plattformen', 'content_praeferenzen', 'beschreibung'
];

/** Ganzer Input ohne Leerzeichen und parsebar als URL -> Extract, sonst Chat. */
export function decidePersonaLikyAktion(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  if (/\s/.test(trimmed)) return { aktion: 'chat', text: trimmed };
  const url = toAbsoluteUrl(trimmed);
  if (url) return { aktion: 'extract', url, text: trimmed };
  return { aktion: 'chat', text: trimmed };
}

export class PersonaLikyPanel {
  constructor() {
    this.form = null;
    this.feed = null;
    this.getUnternehmenId = null;
    this.getSituationPanel = null;
    this.review = null;
    this.transcript = [];
    this.running = false;
    this.turn = null;
    this.slot = null;
    this.received = [];
    this.pendingFile = null;
    this._abort = null;
    this._chatLog = null;
  }

  mount(form, { getUnternehmenId = null, getSituationPanel = null } = {}) {
    this.destroy();
    this.form = form;
    this.feed = form?.querySelector('#persona-liky-feed') || null;
    if (!this.form || !this.feed) return;

    this.getUnternehmenId = getUnternehmenId;
    this.getSituationPanel = getSituationPanel;
    this.review = new ExtractReviewLayer(this.form);
    this.feed.setAttribute('aria-live', 'polite');
    this._chatLog = bindChatLog(this.feed);
    this.renderTranscript();
    this.bindComposer();
    this.renderChip();
  }

  bindComposer() {
    this._abort = new AbortController();
    const opts = { signal: this._abort.signal };
    const send = document.getElementById('persona-liky-send');
    const input = document.getElementById('persona-liky-input');
    const composer = document.getElementById('persona-liky-composer');
    if (!send || !input) return;

    send.addEventListener('click', () => this.onSend(), opts);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.onSend();
      }
    }, opts);

    if (!likyCanExtractPdf(ENTITY) || !composer) return;

    input.addEventListener('paste', (e) => {
      const file = [...(e.clipboardData?.files || [])][0];
      if (file) {
        e.preventDefault();
        this.attachFile(file);
      }
    }, opts);

    const side = this.feed.closest('.doc__side') || composer;
    side.addEventListener('dragover', (e) => {
      e.preventDefault();
      composer.classList.add('is-dragover');
    }, opts);
    side.addEventListener('dragleave', (e) => {
      if (!side.contains(e.relatedTarget)) {
        composer.classList.remove('is-dragover');
      }
    }, opts);
    side.addEventListener('drop', (e) => {
      e.preventDefault();
      composer.classList.remove('is-dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) this.attachFile(file);
    }, opts);
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
    const chips = document.getElementById('persona-liky-chips');
    if (!chips) return;
    if (!this.pendingFile) {
      chips.innerHTML = '';
      return;
    }
    chips.innerHTML = likyPdfTagHtml(this.pendingFile.name, { remove: true });
    chips.querySelector('button')?.addEventListener('click', () => this.clearPendingFile());
  }

  async onSend() {
    if (this.running) return;
    const input = document.getElementById('persona-liky-input');

    if (this.pendingFile) {
      const file = this.pendingFile;
      this.clearPendingFile();
      if (input) input.value = '';
      if (!this.unternehmenId()) {
        this.pushUser(file.name);
        this.pushLiky('Erst das Unternehmen wählen, dann das PDF.');
        return;
      }
      if (!likyCanExtractPdf(ENTITY)) {
        this.pushUser(file.name);
        this.pushLiky('PDF-Auslesen ist auf dieser Seite ausgeschaltet.');
        return;
      }
      await this.runPdfExtract(file);
      return;
    }

    const entscheidung = decidePersonaLikyAktion(input?.value);
    if (!entscheidung) return;
    if (input) input.value = '';

    if (!this.unternehmenId()) {
      this.pushUser(entscheidung.text);
      this.pushLiky('Erst das Unternehmen wählen, dann kann ich mitdenken.');
      return;
    }

    if (entscheidung.aktion === 'extract') {
      if (!likyCanExtractUrl(ENTITY)) {
        this.pushUser(entscheidung.text);
        this.pushLiky('Webseiten-Auslesen ist auf dieser Seite ausgeschaltet.');
        return;
      }
      await this.runExtract(entscheidung);
      return;
    }

    if (!likyHasChat(ENTITY)) {
      this.pushUser(entscheidung.text);
      this.pushLiky('Chat ist auf dieser Seite ausgeschaltet.');
      return;
    }
    await this.runChat(entscheidung.text);
  }

  unternehmenId() {
    const nodes = [...(this.form?.querySelectorAll('[name="unternehmen_id"]') || [])];
    for (const el of nodes) {
      const value = (el.value || '').trim();
      if (value) return value;
    }
    const fromHook = this.getUnternehmenId?.();
    return fromHook || null;
  }

  // ---------------------------------------------------------------
  // Extract
  // ---------------------------------------------------------------
  async runExtract({ url, text }) {
    this.setRunning(true);
    this.pushUser(text);
    this.openLikyTurn();
    this.review?.revertAll();

    const send = document.getElementById('persona-liky-send');
    const costBadge = new ExtractCostBadge(this.form, send);
    costBadge.clear();

    try {
      const result = await requestExtractJob({
        entity: ENTITY,
        url,
        onStep: ({ step, label, steps }) => {
          if (Array.isArray(steps) && steps.length) this.setSteps(steps);
          else this.addStep(step, label);
        }
      });
      const { applied } = this.applyFields(result.fields || {});
      const situations = this.applySituations(result.audience_situations);
      costBadge.show(result);
      this.finishExtract({ ok: true, applied, situations, felder: Object.keys(result.fields || {}).length });
    } catch (error) {
      console.error('Persona-Extract:', error);
      this.finishExtract({ ok: false, error: error.message });
    } finally {
      this.setRunning(false);
    }
  }

  async runPdfExtract(file) {
    this.setRunning(true);
    this.pushUser(file.name);
    this.openLikyTurn();
    this.review?.revertAll();

    const send = document.getElementById('persona-liky-send');
    const costBadge = new ExtractCostBadge(this.form, send);
    costBadge.clear();

    try {
      const pdfPath = await this.uploadPdf(file);
      const result = await this.runLikyJob('extract', { pdfPath });
      const { applied } = this.applyFields(result.fields || {});
      const situations = this.applySituations(result.audience_situations);
      costBadge.show(result);
      this.finishExtract({ ok: true, applied, situations, felder: Object.keys(result.fields || {}).length });
    } catch (error) {
      console.error('Persona-PDF-Extract:', error);
      this.finishExtract({ ok: false, error: error.message });
    } finally {
      this.setRunning(false);
    }
  }

  async uploadPdf(file) {
    const session = await window.supabase?.auth?.getSession();
    const userId = session?.data?.session?.user?.id;
    if (!userId) throw new Error('Keine aktive Sitzung');

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `persona-liky/${userId}/${Date.now()}_${safeName}`;
    const { error } = await window.supabase.storage
      .from('documents')
      .upload(path, file, { upsert: false });
    if (error) throw new Error(`Upload fehlgeschlagen: ${error.message}`);
    return path;
  }

  finishExtract({ ok, applied = [], situations = false, felder = 0, error = null }) {
    if (this.slot && this.received.length) {
      renderThinking(this.slot, this.received, { done: true });
    }
    if (!ok) {
      this.addError(error || 'Prüf die Quelle und versuch es nochmal.');
      return;
    }
    const lines = [];
    if (applied.length || situations) {
      lines.push('Fertig, schau es dir an. Was ich nur vermute, ist im Dokument markiert.');
    } else if (!felder) {
      lines.push('Da war nichts Brauchbares zu finden.');
    } else {
      lines.push('Alles war schon ausgefüllt – ich habe nichts angerührt.');
    }
    if (situations) lines.push('Audience Situations liegen im Dokument.');
    this.closeTurnWith(lines.join(' '));
  }

  // ---------------------------------------------------------------
  // Chat
  // ---------------------------------------------------------------
  async runChat(text) {
    this.setRunning(true);
    this.pushUser(text);
    this.openLikyTurn();

    try {
      const result = await this.runLikyJob('chat', {
        userText: text,
        formData: this.snapshot(),
        history: this.transcript.slice(-20).map((t) => ({
          rolle: t.rolle === 'user' ? 'user' : 'assistant',
          inhalt: t.text
        }))
      });
      const patches = result.patches || {};
      const { applied } = this.applyFields(patches);
      const situations = this.applySituations(result.audience_situations);
      const reply = result.reply || (applied.length ? 'Habe Felder angepasst.' : 'Verstanden.');
      this.closeTurnWith(situations ? `${reply} Audience Situations liegen im Dokument.` : reply);
    } catch (error) {
      console.error('Persona-Chat:', error);
      this.addError(error.message);
    } finally {
      this.setRunning(false);
    }
  }

  async runLikyJob(modus, extra) {
    const session = await window.supabase?.auth?.getSession();
    const token = session?.data?.session?.access_token;
    if (!token) throw new Error('Keine aktive Sitzung');

    const { data: job, error: insertError } = await window.supabase
      .from('persona_liky_jobs')
      .insert({
        modus,
        created_by: session.data.session.user.id
      })
      .select('id')
      .single();
    if (insertError) throw new Error(`Job konnte nicht angelegt werden: ${insertError.message}`);

    const response = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        jobId: job.id,
        modus,
        ...extra
      })
    });
    if (response.status !== 202 && !response.ok) {
      throw new Error(`Liky konnte nicht gestartet werden (HTTP ${response.status})`);
    }

    return this.pollChatJob(job.id);
  }

  async pollChatJob(jobId) {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let letzterStep = null;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const { data: row, error } = await window.supabase
        .from('persona_liky_jobs')
        .select('status, progress_step, progress_steps, result, error_message')
        .eq('id', jobId)
        .maybeSingle();
      if (error || !row) continue;

      if (row.status === 'done') {
        const payload = row.result || {};
        if (!payload.success) throw new Error(payload.error || 'Kein Ergebnis');
        return payload;
      }
      if (row.status === 'error') {
        throw new Error(row.error_message || 'Das hat nicht geklappt');
      }
      if (row.progress_step && row.progress_step !== letzterStep) {
        letzterStep = row.progress_step;
        this.setSteps(Array.isArray(row.progress_steps) ? row.progress_steps : []);
      }
    }

    throw new Error('Zeitlimit erreicht – bitte später erneut versuchen.');
  }

  snapshot() {
    const data = window.formSystem?.collectSubmitData?.(this.form) || {};
    const out = {};
    for (const key of SNAPSHOT_FELDER) {
      const value = data[key];
      if (value !== undefined && value !== null && value !== '') out[key] = value;
    }
    const situations = this.getSituationPanel?.()?.visible?.() || [];
    if (situations.length) {
      out.audience_situations = situations.map((s) => ({
        name: s.name,
        beschreibung: s.beschreibung || null
      }));
    }
    return out;
  }

  // ---------------------------------------------------------------
  // Apply
  // ---------------------------------------------------------------
  applyFields(fields) {
    const applied = [];
    const skipped = [];
    if (!this.review) return { applied, skipped };

    for (const [name, entry] of Object.entries(fields || {})) {
      const raw = entry && typeof entry === 'object' && 'value' in entry
        ? entry
        : { value: entry, kind: 'guess', force: false };
      if (raw.value == null || raw.value === '') continue;

      const input = this.review.findInput(name);
      if (!input) continue;

      if (input.tagName === 'SELECT') {
        const ok = [...input.options].some((o) => o.value === String(raw.value));
        if (!ok) continue;
      }

      const overwrite = !!raw.force;
      if (!overwrite && String(input.value || '').trim()) {
        skipped.push(name);
        continue;
      }
      this.review.mark(name, {
        value: raw.value,
        kind: raw.kind === 'fact' ? 'fact' : 'guess',
        from: raw.from || null
      });
      applied.push(name);
    }
    return { applied, skipped };
  }

  applySituations(situationen) {
    const panel = this.getSituationPanel?.();
    if (!panel?.applyKi) return false;
    return panel.applyKi(situationen);
  }

  // ---------------------------------------------------------------
  // Verlauf
  // ---------------------------------------------------------------
  pushUser(text) {
    if (!text) return;
    this.transcript.push({ rolle: 'user', text });
    this.feed?.appendChild(this.userNode(text));
    this._chatLog?.pin({ force: true });
  }

  pushLiky(text) {
    if (!text) return;
    this.transcript.push({ rolle: 'liky', text });
    this.turn = null;
    this.slot = null;
    this.feed?.appendChild(this.likyNode(text));
    this.scrollToEnd();
  }

  renderTranscript() {
    if (!this.feed) return;
    this.feed.innerHTML = '';
    const turns = this.transcript.length ? this.transcript : [{ rolle: 'liky', text: GRUSS }];
    for (const turn of turns) {
      this.feed.appendChild(turn.rolle === 'user' ? this.userNode(turn.text) : this.likyNode(turn.text));
    }
    this._chatLog?.pin({ force: true });
  }

  openLikyTurn() {
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
  }

  closeTurnWith(text) {
    if (this.slot && this.received.length) {
      renderThinking(this.slot, this.received, { done: true });
    }
    if (this.turn) this.turn.remove();
    this.turn = null;
    this.slot = null;
    this.pushLiky(text);
  }

  setSteps(steps) {
    if (!this.slot) return;
    this.received = Array.isArray(steps) ? steps : [];
    renderThinking(this.slot, this.received);
    this.scrollToEnd();
  }

  addStep(step, label) {
    if (!this.slot || !step) return;
    if (this.received.some((s) => s.step === step)) return;
    this.setSteps(pushStep(this.received, { step, label: label || 'Ich arbeite' }));
  }

  addError(text) {
    const error = document.createElement('div');
    error.className = 'doc-chat__error';
    error.textContent = `Das hat nicht geklappt: ${text}`;
    (this.turn || this.feed)?.appendChild(error);
    this.scrollToEnd();
  }

  userNode(text) {
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
  }

  likyNode(text) {
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
  }

  setRunning(running) {
    this.running = running;
    const send = document.getElementById('persona-liky-send');
    if (send) {
      send.disabled = running;
      send.classList.toggle('is-loading', running);
    }
  }

  scrollToEnd() {
    this._chatLog?.pin();
  }

  destroy() {
    this._chatLog?.destroy();
    this._chatLog = null;
    if (this._abort) {
      try { this._abort.abort(); } catch (_) { /* noop */ }
      this._abort = null;
    }
    this.transcript = [];
    this.turn = null;
    this.slot = null;
    this.received = [];
    this.pendingFile = null;
    this.review = null;
    this.form = null;
    this.feed = null;
    this.getUnternehmenId = null;
    this.getSituationPanel = null;
    this.running = false;
  }
}
