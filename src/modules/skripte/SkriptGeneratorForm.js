// SkriptGeneratorForm.js
// Wiederverwendbares Generator-Formular (Kontext + Videovorlage + Video-Vorgaben)
// mit Kaskade Unternehmen -> Marke -> Kampagne/Produkt. Wird vom Generator-Tab
// und vom Chat-Editor (Neu-Modus) genutzt. Liefert den Payload fuer die
// Background Function skript-generate-background.

import { skripteService, FUNNEL_STUFEN, VIDEO_LAENGEN } from './SkripteService.js';
import { escapeHtml } from './SkripteUtils.js';
import { TranscribeService, isSupportedVideoUrl } from '../transcribe/TranscribeService.js';

const BRIEFING_MAX_BYTES = 10 * 1024 * 1024; // Bucket-Limit 'documents': 10 MB
const REF_MANUELL_MIN_ZEICHEN = 50; // manuelles Transkript: Mindestlaenge

// Kompakte Labels fuer den Transcribe-Fortschritt (ohne Console-Log)
const REF_PROGRESS = {
  pending: { pct: 5, label: 'Warte auf Start…' },
  browser: { pct: 15, label: 'Video wird geöffnet…' },
  navigation: { pct: 30, label: 'Video wird geladen…' },
  captions: { pct: 55, label: 'Untertitel werden geladen…' },
  download: { pct: 50, label: 'Video wird heruntergeladen…' },
  whisper: { pct: 70, label: 'Transkription läuft…' },
  description: { pct: 90, label: 'Beschreibung wird erstellt…' },
  done: { pct: 100, label: 'Fertig' }
};

/**
 * Referenz-Payload aus dem UI-Zustand bauen (pure Funktion, testbar).
 * Wirft bei fehlender/unfertiger Videovorlage - die Vorlage ist PFLICHT
 * fuer jede neue KI-Generierung.
 */
export function buildReferenzVideoPayload({ status, url, job, transkript, beschreibung, caption }) {
  const cleanUrl = (url || '').trim();
  const cleanTranskript = (transkript || '').trim();

  if (!cleanUrl) {
    throw new Error('Bitte eine Videovorlage angeben (TikTok- oder Instagram-URL)');
  }
  if (!isSupportedVideoUrl(cleanUrl)) {
    throw new Error('Die Videovorlage muss eine TikTok- oder Instagram-URL sein');
  }
  if (status === 'transcribing') {
    throw new Error('Die Videovorlage wird noch analysiert – bitte kurz warten');
  }

  if (status === 'ready' && job) {
    if (!cleanTranskript) {
      throw new Error('Das Transkript der Videovorlage ist leer – bitte prüfen oder manuell ergänzen');
    }
    return {
      url: cleanUrl,
      transcription_job_id: job.id,
      quelle: 'job',
      transkript_verwendet: cleanTranskript,
      beschreibung: (beschreibung || '').trim() || null,
      caption: (caption || '').trim() || null,
      platform: job.platform || null,
      duration_seconds: job.duration_seconds ?? null,
      author_name: job.author_name || null,
      metrics: {
        likes: job.likes_count ?? null,
        comments: job.comments_count ?? null,
        shares: job.shares_count ?? null,
        saves: job.saves_count ?? null
      }
    };
  }

  // Fehlgeschlagene Analyse: manuelles Transkript zur URL ist der Fallback
  if (status === 'error') {
    if (cleanTranskript.length < REF_MANUELL_MIN_ZEICHEN) {
      throw new Error('Analyse fehlgeschlagen – bitte erneut versuchen oder das Transkript manuell einfügen (min. 50 Zeichen)');
    }
    return {
      url: cleanUrl,
      transcription_job_id: null,
      quelle: 'manual',
      transkript_verwendet: cleanTranskript,
      beschreibung: (beschreibung || '').trim() || null,
      caption: (caption || '').trim() || null,
      platform: null,
      duration_seconds: null,
      author_name: null,
      metrics: { likes: null, comments: null, shares: null, saves: null }
    };
  }

  throw new Error('Bitte die Videovorlage zuerst analysieren (Button „Analysieren“)');
}

export class SkriptGeneratorForm {
  constructor({ prefix = 'gen' } = {}) {
    this.prefix = prefix;
    this.container = null;
    this.unternehmen = [];
    this.marken = [];
    this.briefingFile = null; // gewaehltes PDF (File), Upload erst beim Generieren

    // Videovorlage (Pflicht): Transcribe-Job-Zustand dieser Form-Instanz
    this.transcribe = new TranscribeService({ onUpdate: (job) => this.onTranscribeUpdate(job) });
    this.referenz = { status: 'idle', url: '', job: null };
  }

  el(name) {
    return this.container?.querySelector(`#${this.prefix}-${name}`) || null;
  }

  async render(container) {
    this.container = container;
    const p = this.prefix;
    container.innerHTML = `
      <div class="skripte-card">
        <h3>Kontext auswählen</h3>
        <p class="skripte-hint">Unternehmen wählen – Marke ist optional (nicht jedes Unternehmen hat eine). Briefing, Kickoff und Produktdaten werden automatisch aus dem CRM gezogen.</p>
        <div class="skripte-form-grid">
          <div class="form-group">
            <label class="form-label">Unternehmen *</label>
            <select id="${p}-unternehmen" class="form-input"><option value="">Laden...</option></select>
          </div>
          <div class="form-group">
            <label class="form-label">Marke</label>
            <select id="${p}-marke" class="form-input" disabled><option value="">– Erst Unternehmen wählen –</option></select>
          </div>
          <div class="form-group">
            <label class="form-label">Kampagne</label>
            <select id="${p}-kampagne" class="form-input" disabled><option value="">– Erst Unternehmen wählen –</option></select>
          </div>
          <div class="form-group">
            <label class="form-label">Produkt</label>
            <select id="${p}-produkt" class="form-input" disabled><option value="">– Erst Unternehmen wählen –</option></select>
          </div>
          <div class="form-group">
            <label class="form-label">Persona (Zielgruppe)</label>
            <select id="${p}-persona" class="form-input"><option value="">Laden...</option></select>
          </div>
          <div class="form-group">
            <label class="form-label">Branche</label>
            <select id="${p}-branche" class="form-input"><option value="">Laden...</option></select>
            <span class="skripte-hint">Wird bei Markenwahl automatisch gesetzt, kann überschrieben werden.</span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">PDF-Briefing (optional)</label>
          <input id="${p}-briefing-pdf" type="file" accept="application/pdf,.pdf" hidden />
          <div class="skripte-briefing-upload" id="${p}-briefing-wrap">
            <button type="button" id="${p}-briefing-btn" class="secondary-btn">PDF auswählen</button>
            <span class="skripte-briefing-name" id="${p}-briefing-name" hidden></span>
            <button type="button" id="${p}-briefing-clear" class="skripte-briefing-clear" title="PDF entfernen" aria-label="PDF entfernen" hidden>&times;</button>
          </div>
          <span class="skripte-hint">Liky durchforstet das Briefing und nutzt die Fakten als verbindliche Basis für das Skript (max. 10 MB).</span>
        </div>
      </div>

      <div class="skripte-card">
        <h3>Videovorlage *</h3>
        <p class="skripte-hint">Jedes Skript basiert auf einer Videovorlage: Liky übernimmt Aufbau und Machart (Hook-Typ, Dramaturgie, Pace, CTA-Mechanik) – aber keine Formulierungen oder Produktaussagen. Fakten kommen weiter aus CRM und Briefing.</p>
        <div class="skripte-ref-row">
          <input type="url" id="${p}-ref-url" class="form-input"
            placeholder="TikTok- oder Instagram-URL der Vorlage (z.B. https://www.tiktok.com/@user/video/...)" />
          <button type="button" id="${p}-ref-start" class="secondary-btn">Analysieren</button>
        </div>
        <div id="${p}-ref-progress" class="skripte-ref-progress" hidden>
          <div class="skripte-progress-head">
            <span id="${p}-ref-progress-label">Starte…</span>
          </div>
          <div class="skripte-progress-track"><div id="${p}-ref-progress-bar" class="skripte-progress-bar"></div></div>
        </div>
        <div id="${p}-ref-error" class="skripte-ref-error" hidden>
          <span id="${p}-ref-error-text"></span>
          <button type="button" id="${p}-ref-retry" class="secondary-btn">Erneut versuchen</button>
        </div>
        <div id="${p}-ref-result" hidden>
          <div id="${p}-ref-meta" class="skripte-ref-meta"></div>
          <div class="form-group">
            <label class="form-label">Transkript der Vorlage <span id="${p}-ref-source" class="skripte-hint"></span></label>
            <textarea id="${p}-ref-transkript" class="form-input" rows="6"
              placeholder="Transkript erscheint hier nach der Analyse – oder bei Fehlern manuell einfügen"></textarea>
          </div>
          <div class="skripte-form-grid">
            <div class="form-group">
              <label class="form-label">Beschreibung (KI)</label>
              <textarea id="${p}-ref-beschreibung" class="form-input" rows="3"
                placeholder="Automatische Beschreibung des Vorlage-Videos"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Caption</label>
              <textarea id="${p}-ref-caption" class="form-input" rows="3"
                placeholder="Caption des Original-Posts"></textarea>
            </div>
          </div>
          <button type="button" id="${p}-ref-clear" class="secondary-btn">Vorlage entfernen</button>
        </div>
      </div>

      <div class="skripte-card">
        <h3>Vorgaben für dieses Video</h3>
        <div class="form-group">
          <label class="form-label">Video-Idee *</label>
          <textarea id="${p}-idee" class="form-input" rows="3"
            placeholder="Worum soll es in dem Video gehen? (z.B. 'Morgenroutine mit Produkt X, Fokus auf Zeitersparnis')"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Location</label>
          <textarea id="${p}-location" class="form-input" rows="3"
            placeholder="Wo findet der Dreh statt? (z.B. 'Zuhause in der Küche, morgens bei Tageslicht; zweiter Teil im Auto auf dem Weg zur Arbeit')"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Regieanweisung</label>
          <textarea id="${p}-regie" class="form-input" rows="3"
            placeholder="Hinweise für den Creator zur Umsetzung (z.B. 'direkt in die Kamera sprechen, Produkt erst ab Sekunde 5 zeigen'). Fließt NICHT in die Skript-Generierung ein."></textarea>
          <span class="skripte-hint">Wird nur als Zusatzinfo am Skript gespeichert – kein Einfluss auf den generierten Text.</span>
        </div>
        <div class="skripte-form-grid">
          <div class="form-group">
            <label class="form-label">Video-Länge (gesamt)</label>
            <select id="${p}-laenge" class="form-input">
              <option value="">– Keine Vorgabe –</option>
              ${Object.entries(VIDEO_LAENGEN).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
            <span class="skripte-hint">Das Skript wird auf diese gesprochene Länge dimensioniert.</span>
          </div>
          <div class="form-group">
            <label class="form-label">Funnel-Stufe</label>
            <select id="${p}-funnel" class="form-input">
              <option value="">– Keine Vorgabe –</option>
              ${Object.entries(FUNNEL_STUFEN).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Tonalität</label>
            <input id="${p}-tonalitaet" class="form-input" type="text"
              placeholder="z.B. locker & humorvoll, seriös, emotional" />
          </div>
          <div class="form-group">
            <label class="form-label">Skript-DNA</label>
            <select id="${p}-dna" class="form-input"><option value="auto">Laden...</option></select>
            <span class="skripte-hint">"Automatisch" nutzt alle zum Kontext passenden aktiven DNA-Layer.</span>
          </div>
        </div>
      </div>
    `;

    this.el('unternehmen').addEventListener('change', () => this.onUnternehmenChange());
    this.el('marke').addEventListener('change', () => this.onMarkeChange());
    this.bindBriefingUpload();
    this.bindReferenzEvents();

    await Promise.all([this.loadUnternehmen(), this.loadPersonas(), this.loadBranchen(), this.loadDnaOptionen()]);
  }

  // ------------------------------------------------------------------
  // Videovorlage (Pflicht): Transcribe direkt im Formular
  // ------------------------------------------------------------------
  bindReferenzEvents() {
    this.el('ref-start')?.addEventListener('click', () => this.startTranscribe());
    this.el('ref-retry')?.addEventListener('click', () => this.startTranscribe());
    this.el('ref-clear')?.addEventListener('click', () => this.resetReferenz());
    this.el('ref-url')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.startTranscribe(); }
    });
    // URL-Wechsel verwirft den bisherigen Snapshot (er gehoert zur alten URL)
    this.el('ref-url')?.addEventListener('input', () => {
      const url = this.el('ref-url')?.value.trim() || '';
      if (this.referenz.status !== 'idle' && url !== this.referenz.url) {
        this.resetReferenz({ behalteUrl: true });
      }
    });
  }

  async startTranscribe() {
    const url = this.el('ref-url')?.value.trim() || '';
    if (!isSupportedVideoUrl(url)) {
      window.toastSystem?.error('Bitte eine gültige TikTok- oder Instagram-URL eingeben');
      return;
    }

    this.referenz = { status: 'transcribing', url, job: null };
    this.renderReferenzState();

    try {
      await this.transcribe.start(url);
    } catch (err) {
      this.referenz = { status: 'error', url, job: null, fehler: err.message };
      this.renderReferenzState();
      window.toastSystem?.error(err.message);
    }
  }

  onTranscribeUpdate(job) {
    if (this.referenz.status !== 'transcribing') return;

    if (job.status === 'done') {
      this.referenz = { status: 'ready', url: this.referenz.url, job };
      this.renderReferenzState();
      const setzen = (name, wert) => { const el = this.el(name); if (el) el.value = wert || ''; };
      setzen('ref-transkript', job.transcript);
      setzen('ref-beschreibung', job.description);
      setzen('ref-caption', job.caption);
      const source = this.el('ref-source');
      if (source) {
        source.textContent = job.transcript_source === 'native_captions'
          ? '(Quelle: native Captions – prüfen/anpassen möglich)'
          : '(Quelle: Whisper – prüfen/anpassen möglich)';
      }
      this.renderReferenzMeta(job);
      window.toastSystem?.success('Videovorlage analysiert');
      return;
    }

    if (job.status === 'error') {
      this.referenz = { status: 'error', url: this.referenz.url, job: null, fehler: job.error_message || 'Unbekannter Fehler' };
      this.renderReferenzState();
      return;
    }

    // Fortschritt aktualisieren
    if (job.progress_step) {
      const config = REF_PROGRESS[job.progress_step] || REF_PROGRESS.pending;
      const bar = this.el('ref-progress-bar');
      const label = this.el('ref-progress-label');
      if (bar) bar.style.width = `${config.pct}%`;
      if (label) label.textContent = config.label;
    }
  }

  /** Sichtbarkeit der Referenz-Bereiche anhand des Status umschalten. */
  renderReferenzState() {
    const { status, fehler } = this.referenz;
    const progress = this.el('ref-progress');
    const errorBox = this.el('ref-error');
    const result = this.el('ref-result');
    const startBtn = this.el('ref-start');

    if (progress) {
      progress.hidden = status !== 'transcribing';
      if (status === 'transcribing') {
        const bar = this.el('ref-progress-bar');
        const label = this.el('ref-progress-label');
        if (bar) bar.style.width = '5%';
        if (label) label.textContent = REF_PROGRESS.pending.label;
      }
    }
    if (errorBox) {
      errorBox.hidden = status !== 'error';
      const text = this.el('ref-error-text');
      if (text && status === 'error') {
        text.textContent = `Analyse fehlgeschlagen: ${fehler || 'Unbekannter Fehler'} – erneut versuchen oder Transkript unten manuell einfügen.`;
      }
    }
    // Ergebnisbereich: bei ready (Job-Daten) UND bei error (manuelle Eingabe)
    if (result) result.hidden = !(status === 'ready' || status === 'error');
    if (startBtn) {
      startBtn.disabled = status === 'transcribing';
      startBtn.textContent = status === 'transcribing' ? 'Läuft…' : 'Analysieren';
    }
    if (status !== 'ready') {
      const source = this.el('ref-source');
      if (source) source.textContent = status === 'error' ? '(manuell einfügbar)' : '';
      if (status !== 'error') this.renderReferenzMeta(null);
    }
  }

  /** Meta-Chips: Autor, Plattform, Dauer + Engagement (reine Zusatzinfo). */
  renderReferenzMeta(job) {
    const el = this.el('ref-meta');
    if (!el) return;
    el.textContent = '';
    if (!job) { el.hidden = true; return; }

    const dauer = job.duration_seconds ? `${Math.round(job.duration_seconds)}s` : null;
    const chips = [
      job.author_name ? `@${job.author_name}` : null,
      job.platform === 'tiktok' ? 'TikTok' : job.platform === 'instagram' ? 'Instagram' : null,
      dauer,
      job.likes_count != null ? `${Number(job.likes_count).toLocaleString('de-DE')} Likes` : null,
      job.comments_count != null ? `${Number(job.comments_count).toLocaleString('de-DE')} Kommentare` : null,
      job.shares_count != null ? `${Number(job.shares_count).toLocaleString('de-DE')} Shares` : null,
      job.saves_count != null ? `${Number(job.saves_count).toLocaleString('de-DE')} Saves` : null
    ].filter(Boolean);

    if (!chips.length) { el.hidden = true; return; }
    for (const text of chips) {
      const chip = document.createElement('span');
      chip.className = 'skripte-ref-chip';
      chip.textContent = text;
      el.appendChild(chip);
    }
    el.hidden = false;
  }

  /** Vorlage komplett zuruecksetzen (Clear-Button / URL-Wechsel). */
  resetReferenz({ behalteUrl = false } = {}) {
    this.transcribe.cancel();
    const url = behalteUrl ? (this.el('ref-url')?.value.trim() || '') : '';
    this.referenz = { status: 'idle', url, job: null };
    if (!behalteUrl) {
      const urlEl = this.el('ref-url');
      if (urlEl) urlEl.value = '';
    }
    for (const name of ['ref-transkript', 'ref-beschreibung', 'ref-caption']) {
      const el = this.el(name);
      if (el) el.value = '';
    }
    this.renderReferenzState();
  }

  /** Referenz-Block fuer den Payload (wirft bei fehlender/unfertiger Vorlage). */
  getReferenzPayload() {
    return buildReferenzVideoPayload({
      status: this.referenz.status,
      url: this.el('ref-url')?.value || this.referenz.url,
      job: this.referenz.job,
      transkript: this.el('ref-transkript')?.value,
      beschreibung: this.el('ref-beschreibung')?.value,
      caption: this.el('ref-caption')?.value
    });
  }

  /** Realtime/Polling der Videovorlage beenden (Tab-Wechsel, Re-Render). */
  destroy() {
    this.transcribe.cancel();
  }

  // ------------------------------------------------------------------
  // PDF-Briefing: Auswahl im Formular, Upload erst beim Generieren
  // ------------------------------------------------------------------
  bindBriefingUpload() {
    const input = this.el('briefing-pdf');
    const btn = this.el('briefing-btn');
    const clear = this.el('briefing-clear');
    if (!input || !btn) return;

    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      const file = input.files?.[0] || null;
      if (!file) return;
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        window.toastSystem?.error('Bitte eine PDF-Datei wählen');
        input.value = '';
        return;
      }
      if (file.size > BRIEFING_MAX_BYTES) {
        window.toastSystem?.error('PDF ist zu groß (max. 10 MB)');
        input.value = '';
        return;
      }
      this.briefingFile = file;
      this.renderBriefingState();
    });
    clear?.addEventListener('click', () => {
      this.briefingFile = null;
      input.value = '';
      this.renderBriefingState();
    });
  }

  renderBriefingState() {
    const name = this.el('briefing-name');
    const clear = this.el('briefing-clear');
    const btn = this.el('briefing-btn');
    if (!name || !btn) return;
    const hatDatei = !!this.briefingFile;
    name.hidden = !hatDatei;
    name.textContent = hatDatei ? this.briefingFile.name : '';
    if (clear) clear.hidden = !hatDatei;
    btn.textContent = hatDatei ? 'Anderes PDF wählen' : 'PDF auswählen';
  }

  /**
   * Gewaehltes PDF in den Storage-Bucket 'documents' hochladen.
   * Pfad MUSS unter 'briefings/' liegen (Storage-INSERT-Policy erlaubt nur
   * die Top-Level-Ordner 'briefings' und 'kampagnen').
   */
  async uploadBriefingPdf() {
    if (!this.briefingFile) return null;
    const safeName = this.briefingFile.name.replace(/[^a-zA-Z0-9äöüÄÖÜß._-]/g, '_');
    const pfad = `briefings/skript-generator/${Date.now()}-${safeName}`;
    const { error } = await window.supabase.storage.from('documents')
      .upload(pfad, this.briefingFile, { contentType: 'application/pdf', upsert: false });
    if (error) throw new Error(`PDF-Upload fehlgeschlagen: ${error.message}`);
    return { pfad, name: this.briefingFile.name };
  }

  /**
   * Wie getPayload(), laedt aber zusaetzlich ein gewaehltes PDF-Briefing hoch
   * und haengt es als briefing_pdf { pfad, name } an den Payload.
   */
  async getPayloadMitUpload() {
    const payload = this.getPayload();
    const briefingPdf = await this.uploadBriefingPdf();
    if (briefingPdf) payload.briefing_pdf = briefingPdf;
    return payload;
  }

  async loadUnternehmen() {
    this.unternehmen = await skripteService.loadUnternehmen();
    const select = this.el('unternehmen');
    if (!select) return;
    select.innerHTML = '<option value="">– Unternehmen wählen –</option>'
      + this.unternehmen.map((u) => `<option value="${u.id}">${escapeHtml(u.firmenname)}</option>`).join('');
  }

  // Personas sind global (nicht an Marke gebunden) und werden sofort geladen
  async loadPersonas() {
    const personas = await skripteService.loadPersonas();
    const select = this.el('persona');
    if (!select) return;
    select.innerHTML = '<option value="">– Keine –</option>'
      + personas.map((p) => `<option value="${p.id}">${escapeHtml(skripteService.personaLabel(p))}</option>`).join('');
  }

  async loadBranchen() {
    const branchen = await skripteService.loadBranchen();
    const select = this.el('branche');
    if (!select) return;
    select.innerHTML = '<option value="">– Keine –</option>'
      + branchen.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
  }

  // DNA-Auswahl: Automatisch (Layer-Logik), Ohne (Blindvergleich) oder gezielt EIN Dokument
  async loadDnaOptionen() {
    const dokumente = await skripteService.loadAktiveDna();
    const select = this.el('dna');
    if (!select) return;

    const scopeLabel = (d) => {
      if (d.layer_typ === 'branche') return d.branchen?.name;
      if (d.layer_typ === 'zielgruppe') return d.personas ? skripteService.personaLabel(d.personas) : null;
      if (d.layer_typ === 'marke') return d.marke?.markenname;
      return null;
    };

    select.innerHTML = '<option value="auto">Automatisch (passende aktive Layer)</option>'
      + '<option value="ohne">Ohne DNA (Blindvergleich)</option>'
      + dokumente.map((d) => {
        const scope = scopeLabel(d);
        const label = d.name || `${d.layer_typ}${scope ? `: ${scope}` : ''} v${d.version}`;
        return `<option value="${d.id}">${escapeHtml(label)}${d.name && scope ? ` (${escapeHtml(scope)})` : ''}</option>`;
      }).join('');
  }

  async onUnternehmenChange() {
    const unternehmenId = this.el('unternehmen').value;
    const markeSelect = this.el('marke');
    const kampagneSelect = this.el('kampagne');
    const produktSelect = this.el('produkt');

    // Kampagne/Produkt bei Unternehmenswechsel zuruecksetzen
    for (const el of [kampagneSelect, produktSelect]) {
      el.disabled = true;
      el.innerHTML = '<option value="">– Erst Unternehmen wählen –</option>';
    }

    if (!unternehmenId) {
      markeSelect.disabled = true;
      markeSelect.innerHTML = '<option value="">– Erst Unternehmen wählen –</option>';
      return;
    }

    // Branche des Unternehmens vorbelegen (Marke kann sie gleich ueberschreiben)
    const unternehmen = this.unternehmen.find((u) => u.id === unternehmenId);
    const brancheSelect = this.el('branche');
    if (brancheSelect && unternehmen?.branche_id) brancheSelect.value = unternehmen.branche_id;

    this.marken = await skripteService.loadMarken(unternehmenId);
    markeSelect.disabled = false;
    markeSelect.innerHTML = (this.marken.length
      ? '<option value="">– Keine –</option>'
      : '<option value="">– Keine Marke vorhanden –</option>')
      + this.marken.map((m) => `<option value="${m.id}">${escapeHtml(m.markenname)}</option>`).join('');

    // Ohne (gewaehlte) Marke haengen Kampagne/Produkt direkt am Unternehmen
    await this.loadKampagnenUndProdukte();
  }

  async onMarkeChange() {
    const markeId = this.el('marke').value;

    // Branche der Marke vorbelegen (manuell ueberschreibbar)
    const marke = this.marken.find((m) => m.id === markeId);
    const brancheSelect = this.el('branche');
    if (brancheSelect && marke?.branche_id) brancheSelect.value = marke.branche_id;

    await this.loadKampagnenUndProdukte();
  }

  /**
   * Kampagnen/Produkte passend zum Kontext laden: mit Marke nach Marke
   * gefiltert, ohne Marke faellt die Filterung aufs Unternehmen zurueck
   * (z.B. wenn das Unternehmen gar keine Marke hat).
   */
  async loadKampagnenUndProdukte() {
    const unternehmenId = this.el('unternehmen')?.value || null;
    const markeId = this.el('marke')?.value || null;
    const kampagneSelect = this.el('kampagne');
    const produktSelect = this.el('produkt');
    if (!kampagneSelect || !produktSelect) return;

    if (!unternehmenId) {
      for (const el of [kampagneSelect, produktSelect]) {
        el.disabled = true;
        el.innerHTML = '<option value="">– Erst Unternehmen wählen –</option>';
      }
      return;
    }

    const filter = { markeId, unternehmenId };
    const [kampagnen, produkte] = await Promise.all([
      skripteService.loadKampagnen(filter),
      skripteService.loadProdukte(filter)
    ]);

    kampagneSelect.disabled = false;
    kampagneSelect.innerHTML = '<option value="">– Keine –</option>'
      + kampagnen.map((k) => `<option value="${k.id}">${escapeHtml(k.eigener_name || k.kampagnenname || k.id)}</option>`).join('');

    produktSelect.disabled = false;
    produktSelect.innerHTML = '<option value="">– Keins –</option>'
      + produkte.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  }

  /** Payload fuer skript-generate-background. Wirft Error bei fehlenden Pflichtfeldern. */
  getPayload() {
    const unternehmenId = this.el('unternehmen')?.value;
    const videoIdee = this.el('idee')?.value.trim();

    if (!unternehmenId) throw new Error('Bitte ein Unternehmen wählen');
    if (!videoIdee) throw new Error('Bitte eine Video-Idee eingeben');

    // Videovorlage ist Pflicht - wirft mit klarer Meldung, wenn sie fehlt,
    // noch analysiert wird oder kein verwendbares Transkript vorliegt
    const referenzVideo = this.getReferenzPayload();

    const dnaWahl = this.el('dna').value;
    return {
      referenz_video: referenzVideo,
      unternehmen_id: unternehmenId,
      marke_id: this.el('marke').value || null,
      kampagne_id: this.el('kampagne').value || null,
      produkt_id: this.el('produkt').value || null,
      persona_id: this.el('persona').value || null,
      branche_id: this.el('branche').value || null,
      video_idee: videoIdee,
      location: this.el('location').value.trim() || null,
      regieanweisung: this.el('regie').value.trim() || null,
      video_laenge: this.el('laenge').value || null,
      funnel_stufe: this.el('funnel').value || null,
      tonalitaet: this.el('tonalitaet').value.trim() || null,
      mit_dna: dnaWahl !== 'ohne',
      dna_id: dnaWahl !== 'auto' && dnaWahl !== 'ohne' ? dnaWahl : null
    };
  }
}
