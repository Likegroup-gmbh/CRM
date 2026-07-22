// SkriptGeneratorTab.js
// Pick-and-pull-Eingabe (via SkriptGeneratorForm) -> Background Function ->
// Live-Progress via Realtime -> danach direkt in den Chat-Editor
// (SkriptEditorView) zur Verfeinerung.

import { skripteService } from './SkripteService.js';
import { SkriptGeneratorForm } from './SkriptGeneratorForm.js';

export class SkriptGeneratorTab {
  constructor(page) {
    this.page = page;
    this.form = new SkriptGeneratorForm({ prefix: 'gen' });
    this.channel = null;
    this.pollInterval = null;
    this.jobId = null;
    this.renderedLogCount = 0;
  }

  async render(container) {
    container.innerHTML = `
      <div class="skripte-generator">
        <div id="gen-form"></div>

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
      </div>
    `;

    container.querySelector('#gen-start').addEventListener('click', () => this.startGeneration());
    await this.form.render(container.querySelector('#gen-form'));
  }

  async startGeneration() {
    let payload;
    try {
      payload = await this.form.getPayloadMitUpload();
    } catch (err) {
      window.toastSystem?.error(err.message);
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
        ...payload
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

    const steps = { pending: 5, kontext: 25, briefing: 40, generierung: 60, speichern: 90, done: 100 };
    if (job.progress_step) {
      this.setProgress(job.progress_step, steps[job.progress_step] ?? 50);
    }

    if (job.status === 'done' && job.skript_id) {
      this.finishUi();
      window.toastSystem?.success('Skript generiert');
      // Direkt in den Chat-Editor: dort wird verfeinert statt neu generiert
      this.page.openEditor(job.skript_id);
    } else if (job.status === 'error') {
      this.finishUi();
      window.toastSystem?.error(`Fehler: ${job.error_message || 'Unbekannt'}`);
    }
  }

  setProgress(step, pct) {
    const labels = {
      pending: 'Warte auf Start...',
      kontext: 'Kontext aus CRM-Daten sammeln...',
      briefing: 'PDF-Briefing durchforsten...',
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
