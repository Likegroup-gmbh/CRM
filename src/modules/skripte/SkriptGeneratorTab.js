// SkriptGeneratorTab.js
// Pick-and-pull-Eingabe -> Background Function -> Live-Progress via Realtime ->
// Ergebnis-Anzeige (Hook/Hauptteil/CTA) mit Direkt-Link zum Feedback.

import { skripteService, FUNNEL_STUFEN } from './SkripteService.js';
import { escapeHtml } from './SkripteUtils.js';

export class SkriptGeneratorTab {
  constructor(page) {
    this.page = page;
    this.channel = null;
    this.pollInterval = null;
    this.jobId = null;
    this.renderedLogCount = 0;
    this.marken = [];
  }

  async render(container) {
    container.innerHTML = `
      <div class="skripte-generator">
        <div class="skripte-card">
          <h3>Kontext auswählen</h3>
          <p class="skripte-hint">Marke wählen – Briefing, Kickoff und Produktdaten werden automatisch aus dem CRM gezogen.</p>
          <div class="skripte-form-grid">
            <div class="form-group">
              <label class="form-label">Marke *</label>
              <select id="gen-marke" class="form-input"><option value="">Laden...</option></select>
            </div>
            <div class="form-group">
              <label class="form-label">Kampagne</label>
              <select id="gen-kampagne" class="form-input" disabled><option value="">– Erst Marke wählen –</option></select>
            </div>
            <div class="form-group">
              <label class="form-label">Produkt</label>
              <select id="gen-produkt" class="form-input" disabled><option value="">– Erst Marke wählen –</option></select>
            </div>
            <div class="form-group">
              <label class="form-label">Persona (Zielgruppe)</label>
              <select id="gen-persona" class="form-input" disabled><option value="">– Erst Marke wählen –</option></select>
            </div>
          </div>
        </div>

        <div class="skripte-card">
          <h3>Vorgaben für dieses Video</h3>
          <div class="form-group">
            <label class="form-label">Video-Idee *</label>
            <textarea id="gen-idee" class="form-input" rows="3"
              placeholder="Worum soll es in dem Video gehen? (z.B. 'Morgenroutine mit Produkt X, Fokus auf Zeitersparnis')"></textarea>
          </div>
          <div class="skripte-form-grid">
            <div class="form-group">
              <label class="form-label">Funnel-Stufe</label>
              <select id="gen-funnel" class="form-input">
                <option value="">– Keine Vorgabe –</option>
                ${Object.entries(FUNNEL_STUFEN).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Tonalität</label>
              <input id="gen-tonalitaet" class="form-input" type="text"
                placeholder="z.B. locker & humorvoll, seriös, emotional" />
            </div>
          </div>
          <label class="skripte-checkbox">
            <input type="checkbox" id="gen-ohne-dna" />
            <span>Ohne DNA generieren (Blindvergleich – misst das rohe Können des Modells)</span>
          </label>
        </div>

        <div class="skripte-actions-row">
          <button id="gen-start" class="primary-btn">Skript generieren</button>
          <span id="gen-status" class="skripte-hint"></span>
        </div>

        <div id="gen-progress" class="skripte-card" style="display:none;">
          <div class="skripte-progress-head">
            <span id="gen-progress-label">Starte...</span>
            <span id="gen-elapsed"></span>
          </div>
          <div class="skripte-progress-track"><div id="gen-progress-bar" class="skripte-progress-bar"></div></div>
          <div id="gen-log" class="skripte-log"></div>
        </div>

        <div id="gen-result" style="display:none;"></div>
      </div>
    `;

    this.bindEvents(container);
    await this.loadMarken();
  }

  bindEvents(container) {
    container.querySelector('#gen-marke').addEventListener('change', () => this.onMarkeChange());
    container.querySelector('#gen-start').addEventListener('click', () => this.startGeneration());
  }

  async loadMarken() {
    this.marken = await skripteService.loadMarken();
    const select = document.getElementById('gen-marke');
    if (!select) return;
    select.innerHTML = '<option value="">– Marke wählen –</option>'
      + this.marken.map((m) => `<option value="${m.id}">${escapeHtml(m.markenname)}</option>`).join('');
  }

  async onMarkeChange() {
    const markeId = document.getElementById('gen-marke').value;
    const kampagneSelect = document.getElementById('gen-kampagne');
    const produktSelect = document.getElementById('gen-produkt');
    const personaSelect = document.getElementById('gen-persona');

    if (!markeId) {
      for (const el of [kampagneSelect, produktSelect, personaSelect]) {
        el.disabled = true;
        el.innerHTML = '<option value="">– Erst Marke wählen –</option>';
      }
      return;
    }

    const [kampagnen, produkte, personas] = await Promise.all([
      skripteService.loadKampagnen(markeId),
      skripteService.loadProdukte(markeId),
      skripteService.loadPersonas(markeId)
    ]);

    kampagneSelect.disabled = false;
    kampagneSelect.innerHTML = '<option value="">– Keine –</option>'
      + kampagnen.map((k) => `<option value="${k.id}">${escapeHtml(k.eigener_name || k.kampagnenname || k.id)}</option>`).join('');

    produktSelect.disabled = false;
    produktSelect.innerHTML = '<option value="">– Keins –</option>'
      + produkte.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');

    personaSelect.disabled = false;
    personaSelect.innerHTML = '<option value="">– Keine –</option>'
      + personas.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  }

  async startGeneration() {
    const markeId = document.getElementById('gen-marke').value;
    const videoIdee = document.getElementById('gen-idee').value.trim();

    if (!markeId) {
      window.toastSystem?.error('Bitte eine Marke wählen');
      return;
    }
    if (!videoIdee) {
      window.toastSystem?.error('Bitte eine Video-Idee eingeben');
      return;
    }

    const btn = document.getElementById('gen-start');
    btn.disabled = true;
    btn.textContent = 'Läuft...';

    this.cleanup();
    this.renderedLogCount = 0;
    this.startTime = Date.now();

    const progressWrap = document.getElementById('gen-progress');
    progressWrap.style.display = 'block';
    document.getElementById('gen-log').textContent = '';
    document.getElementById('gen-result').style.display = 'none';
    this.setProgress('pending', 5);
    this.timerInterval = setInterval(() => {
      const el = document.getElementById('gen-elapsed');
      if (el) el.textContent = `${((Date.now() - this.startTime) / 1000).toFixed(1)}s`;
    }, 100);

    try {
      const job = await skripteService.createJob();
      this.jobId = job.id;
      this.appendLog(`[Client] Job angelegt: ${job.id}`);

      this.channel = skripteService.subscribeToJob(job.id, (j) => this.handleJobUpdate(j));
      this.pollInterval = setInterval(async () => {
        if (!this.jobId) return;
        const j = await skripteService.pollJob(this.jobId);
        if (j) this.handleJobUpdate(j);
      }, 5000);

      await skripteService.triggerFunction('skript-generate-background', {
        jobId: job.id,
        marke_id: markeId,
        kampagne_id: document.getElementById('gen-kampagne').value || null,
        produkt_id: document.getElementById('gen-produkt').value || null,
        persona_id: document.getElementById('gen-persona').value || null,
        video_idee: videoIdee,
        funnel_stufe: document.getElementById('gen-funnel').value || null,
        tonalitaet: document.getElementById('gen-tonalitaet').value.trim() || null,
        mit_dna: !document.getElementById('gen-ohne-dna').checked
      });
      this.appendLog('[Client] Background Function gestartet');
    } catch (err) {
      this.appendLog(`[Client] FEHLER: ${err.message}`);
      window.toastSystem?.error(err.message);
      this.finishUi();
    }
  }

  handleJobUpdate(job) {
    const logs = Array.isArray(job.logs) ? job.logs : [];
    for (let i = this.renderedLogCount; i < logs.length; i++) {
      const time = logs[i].ts ? new Date(logs[i].ts).toLocaleTimeString('de-DE') : '';
      this.appendLog(`[Server ${time}] ${logs[i].msg}`);
    }
    this.renderedLogCount = Math.max(this.renderedLogCount, logs.length);

    const steps = { pending: 5, kontext: 25, generierung: 60, speichern: 90, done: 100 };
    if (job.progress_step) {
      this.setProgress(job.progress_step, steps[job.progress_step] ?? 50);
    }

    if (job.status === 'done' && job.skript_id) {
      this.finishUi();
      window.toastSystem?.success('Skript generiert');
      this.showResult(job.skript_id);
    } else if (job.status === 'error') {
      this.finishUi();
      window.toastSystem?.error(`Fehler: ${job.error_message || 'Unbekannt'}`);
    }
  }

  async showResult(skriptId) {
    const skript = await skripteService.loadSkript(skriptId);
    if (!skript) return;
    const resultEl = document.getElementById('gen-result');
    if (!resultEl) return;

    resultEl.innerHTML = `
      <div class="skripte-card skripte-result">
        <div class="skripte-result-head">
          <h3>${escapeHtml(skript.titel || 'Generiertes Skript')}</h3>
          <span class="skripte-hint">${escapeHtml(skript.model || '')}${skript.mit_dna ? '' : ' · ohne DNA (Blindvergleich)'}</span>
        </div>
        ${['hook', 'hauptteil', 'cta'].map((sektion) => `
          <div class="skripte-sektion">
            <div class="skripte-sektion-label">${sektion.toUpperCase()}</div>
            <div class="skripte-sektion-text">${escapeHtml(skript[sektion] || '')}</div>
          </div>
        `).join('')}
        <div class="skripte-actions-row">
          <button class="primary-btn" id="gen-feedback-btn">Feedback geben</button>
          <button class="secondary-btn" id="gen-copy-btn">Kopieren</button>
        </div>
      </div>
    `;
    resultEl.style.display = 'block';

    resultEl.querySelector('#gen-feedback-btn').addEventListener('click', () => {
      this.page.openSkriptDetail(skriptId);
    });
    resultEl.querySelector('#gen-copy-btn').addEventListener('click', () => {
      const text = `HOOK:\n${skript.hook}\n\nHAUPTTEIL:\n${skript.hauptteil}\n\nCTA:\n${skript.cta}`;
      navigator.clipboard.writeText(text).then(() => window.toastSystem?.success('Skript kopiert'));
    });
  }

  setProgress(step, pct) {
    const labels = {
      pending: 'Warte auf Start...',
      kontext: 'Kontext aus CRM-Daten sammeln...',
      generierung: 'Skript wird geschrieben...',
      speichern: 'Speichern...',
      done: 'Fertig'
    };
    const bar = document.getElementById('gen-progress-bar');
    const label = document.getElementById('gen-progress-label');
    if (bar) bar.style.width = `${pct}%`;
    if (label) label.textContent = labels[step] || step;
  }

  appendLog(msg) {
    const el = document.getElementById('gen-log');
    if (!el) return;
    el.textContent += (el.textContent ? '\n' : '') + msg;
    el.scrollTop = el.scrollHeight;
  }

  finishUi() {
    const btn = document.getElementById('gen-start');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Skript generieren';
    }
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
  }

  cleanup() {
    this.finishUi();
    if (this.channel) {
      window.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.jobId = null;
  }
}
