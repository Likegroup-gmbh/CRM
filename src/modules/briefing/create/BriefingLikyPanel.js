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
// Job -> Poll -> Apply (nur leere Felder) -> knapper Ergebnis-Turn.
// Was nicht in der Spec liegt, wird nicht nachgefragt.
// Der Verlauf bleibt am Briefing (briefing_chat_messages) und ueberlebt
// Step-Wechsel ueber das In-Memory-Transcript (renderMultistep baut das
// DOM bei jedem Step neu).

import { renderThinking, pushStep } from '../../../core/chat/thinking.js';
import { isLikyPdfName, likyPdfTagHtml } from '../../../core/chat/likyComposer.js';
import { BriefingExtractApply } from './BriefingExtractApply.js';
import { getStepsForBereich } from './fieldConfig.js';
import { likyCanExtractPdf, likyHasChat } from '../../../core/chat/likyCapabilities.js';

const ENTITY = 'briefing';
const ENDPOINT = '/.netlify/functions/briefing-pdf-background';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const GRUSS = 'Zieh das Kundenbriefing (PDF) hier rein, dann fülle ich das Formular vor. '
  + 'Was du selbst geschrieben hast, bleibt stehen.';

// Spec wird clientseitig aus fieldConfig abgeleitet und an die Function
// geschickt. So bleibt fieldConfig die einzige Feld-Quelle.
// valueShape sagt dem Modell exakt, in welcher Form der Wert erwartet wird -
// ohne das kommen KPIs als { kpi, ziel } und Channels als
// [{ format, anzahl, vorgaben }] zurueck und binden nicht an die Widgets.
function valueShape(field) {
  switch (field.type) {
    case 'date': return 'string "YYYY-MM-DD"';
    case 'checkbox': return 'true | false';
    case 'radio': return 'ein options.value als string';
    case 'checkboxes':
    case 'customMulti': return 'array von options.value (strings)';
    case 'repeatableKpi': return 'array von { kpi: kpiOptions.value, zielwert: string }';
    case 'repeatableText': return 'array von strings';
    case 'channelGroup': return 'object: channel.key -> array von format-values (strings), z.B. { instagram: ["reel","story"] }';
    case 'group': return 'object mit den Sub-Feldern aus fields, jeder Wert ein string';
    default: return 'string';
  }
}

function buildSpec(bereich) {
  const steps = getStepsForBereich(bereich);
  const fields = [];
  for (const step of steps) {
    for (const section of step.sections || []) {
      for (const field of section.fields || []) {
        if (field.persist === false) continue;
        // Entity-Felder sind schon gewaehlt (Unternehmen ist Pflicht vor dem
        // Upload) - das Modell wuerde sonst Namen statt IDs liefern.
        if (field.type === 'entitySelect' || field.type === 'entityMulti') continue;
        fields.push({
          name: field.name,
          label: field.label,
          type: field.type,
          valueShape: valueShape(field),
          options: field.options?.map((o) => ({ value: o.value, label: o.label })),
          kpiOptions: field.kpiOptions?.map((o) => ({ value: o.value, label: o.label })),
          channels: field.channels?.map((c) => ({ key: c.key, label: c.label, formats: c.formats || null })),
          fields: field.fields?.map((f) => ({ name: f.name, label: f.label, type: f.type })),
          condition: field.condition || null,
          hint: field.helper || null
        });
      }
    }
  }
  return fields;
}

/**
 * Liky-Text nach dem Extract. Orphans aus alten Jobs werden bewusst
 * verschluckt: was nicht in der Spec liegt, wird nicht nachgefragt.
 */
export function formatExtractResult(result = {}, applied = [], skipped = []) {
  const lines = [];
  if (applied.length) lines.push(`${applied.length} Felder gefüllt. Was ich nur vermute, ist markiert.`);
  if (!applied.length && skipped.length) lines.push('Alles war schon ausgefüllt - ich habe nichts angerührt.');
  else if (skipped.length) lines.push(`${skipped.length} Felder waren schon voll, die bleiben wie sie sind.`);
  if (result.missing?.length) {
    lines.push(`Noch offen: ${result.missing.join(', ')}`);
  }
  if (result.unternehmen_hint && !result.unternehmen_hint.passt) {
    lines.push(`Achtung: Das PDF nennt „${result.unternehmen_hint.name}“ - das gewählte Unternehmen bleibt.`);
  }
  const unbekannteProdukte = (result.produkte_hint || []).filter((p) => !p.produkt_id).map((p) => p.name);
  if (unbekannteProdukte.length) {
    lines.push(`Produkte nicht im CRM: ${unbekannteProdukte.join(', ')}`);
  }
  return lines.join('\n') || 'Fertig, schau es dir an.';
}

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
  }

  /** Nach jedem renderMultistep: DOM-Refs neu holen, Verlauf wiederzeichnen. */
  mount() {
    this.side = document.querySelector('.briefing-liky-side');
    this.feed = document.getElementById('briefing-liky-feed');
    if (!this.side || !this.feed) return;

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
      const fields = lastJob?.result?.fields;
      if (fields) {
        for (const [name, entry] of Object.entries(fields)) {
          this.apply.aiFill.set(name, entry);
        }
        this.apply.markVisible();
      }
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
    if (this.running) return;
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
      applied.push(...this.apply.applyProduktHints(result.produkte_hint));
      this.apply.renderAndMark();

      // renderAndMark hat das DOM neu gebaut - frischen Liky-Beitrag oeffnen
      this.openLikyTurn();
      this.showResult(result, applied, skipped);
    } catch (error) {
      console.error('Briefing-Extract:', error);
      this.addError(error.message);
    } finally {
      this.setRunning(false);
    }
  }

  async uploadPdf(file) {
    const briefingId = this.briefing.editId;
    const entityType = this.briefing.formData.marke_id ? 'marke' : 'unternehmen';
    const entityId = this.briefing.formData.marke_id || this.briefing.formData.unternehmen_id;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `kundenbriefings/${entityType}/${entityId}/${briefingId}_${Date.now()}_${safeName}`;

    const { error } = await window.supabase.storage
      .from('documents')
      .upload(path, file, { upsert: false });
    if (error) throw new Error(`Upload fehlgeschlagen: ${error.message}`);

    // 1:1 - das alte Kundenbriefing wird ersetzt
    if (this.kundenbriefing?.storage_path) {
      await window.supabase.storage.from('documents').remove([this.kundenbriefing.storage_path]);
    }

    const { data: { user } } = await window.supabase.auth.getUser();
    const { data: row, error: dbError } = await window.supabase
      .from('kundenbriefings')
      .upsert({
        briefing_id: briefingId,
        entity_type: entityType,
        entity_id: entityId,
        storage_path: path,
        dateiname: file.name,
        created_by: user?.id
      }, { onConflict: 'briefing_id' })
      .select()
      .single();
    if (dbError) throw new Error(`DB fehlgeschlagen: ${dbError.message}`);

    this.kundenbriefing = row;
    return path;
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
      console.error('Briefing-Chat:', error);
      this.addError(error.message);
    } finally {
      this.setRunning(false);
    }
  }

  // ---------------------------------------------------------------
  // Job anlegen, triggern, pollen
  // ---------------------------------------------------------------
  async runJob(modus, extra) {
    const session = await window.supabase.auth.getSession();
    const token = session?.data?.session?.access_token;
    if (!token) throw new Error('Keine aktive Sitzung');

    const { data: job, error: insertError } = await window.supabase
      .from('briefing_pdf_jobs')
      .insert({
        briefing_id: this.briefing.editId,
        modus,
        created_by: session.data.session.user.id
      })
      .select('id')
      .single();
    if (insertError) throw new Error(`Job konnte nicht angelegt werden: ${insertError.message}`);

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        jobId: job.id,
        briefing_id: this.briefing.editId,
        modus,
        ...extra
      })
    });
    if (response.status !== 202 && !response.ok) {
      throw new Error(`Liky konnte nicht gestartet werden (HTTP ${response.status})`);
    }

    return this.pollJob(job.id);
  }

  async pollJob(jobId) {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let letzterStep = null;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const { data: row, error } = await window.supabase
        .from('briefing_pdf_jobs')
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

    throw new Error('Zeitlimit erreicht - bitte später erneut versuchen.');
  }

  // ---------------------------------------------------------------
  // Verlauf (Transcript + DB)
  // ---------------------------------------------------------------
  pushUser(text) {
    if (!text) return;
    this.transcript.push({ rolle: 'user', text });
    this.renderTranscript();
    this.saveMessage('user', text);
  }

  pushLiky(text) {
    if (!text) return;
    this.transcript.push({ rolle: 'liky', text });
    this.turn = null;
    this.renderTranscript();
    this.saveMessage('assistant', text);
  }

  renderTranscript() {
    if (!this.feed) return;
    this.feed.innerHTML = '';
    const turns = this.transcript.length ? this.transcript : [{ rolle: 'liky', text: GRUSS }];
    for (const turn of turns) {
      this.feed.appendChild(turn.rolle === 'user' ? this.userNode(turn.text) : this.likyNode(turn.text));
    }
    this.scrollToEnd();
  }

  /** Transienter Beitrag mit Thinking-Slot fuer den laufenden Job. */
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

  showResult(result, applied, skipped) {
    if (this.slot && this.received.length) {
      renderThinking(this.slot, this.received, { done: true });
    }

    const text = formatExtractResult(result, applied, skipped);
    // Den transienten Beitrag durch einen gespeicherten Turn ersetzen
    if (this.turn) this.turn.remove();
    this.turn = null;
    this.slot = null;
    this.pushLiky(text);
  }

  async saveMessage(rolle, inhalt) {
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
  }

  // ---------------------------------------------------------------
  // DOM-Helfer
  // ---------------------------------------------------------------
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
    const send = document.getElementById('briefing-liky-send');
    if (send) {
      send.disabled = running;
      send.classList.toggle('is-loading', running);
    }
  }

  scrollToEnd() {
    if (this.feed) this.feed.scrollTop = this.feed.scrollHeight;
  }

  destroy() {
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
