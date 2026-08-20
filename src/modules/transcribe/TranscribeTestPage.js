// TranscribeTestPage.js
// Test-Seite fuer Video-Transkription (TikTok/Instagram) via Cloudflare Workers AI.
// Erreichbar unter /transcribe (kein Nav-Eintrag, Deep-Link only).
// Flow: URL eingeben -> TranscribeService (Job + Background Function) ->
//       Live-Progress + Logs via Supabase Realtime -> Transkript + Beschreibung anzeigen.

import { TranscribeService, isSupportedVideoUrl } from './TranscribeService.js';

const PROGRESS_STEPS = {
  pending: { pct: 5, label: 'Warte auf Start...' },
  browser: { pct: 15, label: 'Browser starten (Stealth Mode)...' },
  navigation: { pct: 30, label: 'Seite laden & Video-URL suchen...' },
  captions: { pct: 55, label: 'Native Captions laden...' },
  download: { pct: 50, label: 'Video herunterladen (in Memory)...' },
  whisper: { pct: 70, label: 'Whisper-Transkription laeuft...' },
  description: { pct: 90, label: 'Beschreibung generieren (Llama 3.1)...' },
  done: { pct: 100, label: 'Fertig' }
};

export class TranscribeTestPage {
  constructor() {
    this.service = new TranscribeService({ onUpdate: (job) => this.handleJobUpdate(job) });
    this.timerInterval = null;
    this.startTime = null;
    this.renderedLogCount = 0;
  }

  async init() {
    if (!window.isAdmin?.()) {
      window.setContentSafely(window.content, `
        <div class="empty-state">
          <p>Kein Zugriff – diese Test-Seite ist nur für Admins.</p>
        </div>
      `);
      return;
    }
    window.setHeadline('Transkription (Test)');
    this.render();
    this.bindEvents();
  }

  render() {
    const html = `
      <div class="transcribe-test-page">

        <div class="transcribe-input-row">
          <input
            type="url"
            id="transcribe-url-input"
            class="form-input flex-1"
            placeholder="TikTok- oder Instagram-URL einfügen (z.B. https://www.tiktok.com/@user/video/...)"
          />
          <button id="transcribe-start-btn" class="mdc-btn transcribe-start-btn">
            Transkribieren
          </button>
        </div>

        <div id="transcribe-progress-wrap" style="display: none; flex-direction: column; gap: 6px;">
          <div class="transcribe-progress-header">
            <span id="transcribe-progress-label">Starte...</span>
            <span id="transcribe-elapsed">0.0s</span>
          </div>
          <div class="transcribe-progress-track">
            <div id="transcribe-progress-bar" style="height: 100%; width: 0%; background: var(--color-primary); border-radius: 4px; transition: width 0.4s ease;"></div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Console-Log</label>
          <div id="transcribe-log" class="transcribe-log">Bereit. URL eingeben und Button drücken.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Transkript <span id="transcribe-source-badge" class="transcribe-source-badge"></span></label>
          <textarea id="transcribe-transcript" class="form-input transcribe-textarea" rows="8" readonly
                    placeholder="Transkript erscheint hier..."></textarea>
          <button id="copy-transcript-btn" class="mdc-btn mdc-btn--secondary transcribe-copy-btn">Kopieren</button>
        </div>

        <div id="transcribe-meta" style="display: none; flex-direction: column; gap: var(--space-xs);
                    border: 1px solid var(--gray-200); border-radius: var(--radius-xl); padding: var(--space-sm) var(--space-md);">
          <div class="transcribe-meta-row">
            <span class="transcribe-meta-muted">Hochgeladen von</span>
            <a id="transcribe-author-link" href="#" target="_blank" rel="noopener"
               class="transcribe-author-link"></a>
            <span id="transcribe-posted-at" class="transcribe-meta-muted"></span>
          </div>
          <div id="transcribe-stats" class="transcribe-stats"></div>
        </div>

        <div class="form-group">
          <label class="form-label">Caption</label>
          <textarea id="transcribe-caption" class="form-input transcribe-textarea" rows="4" readonly
                    placeholder="Video-Caption erscheint hier..."></textarea>
          <button id="copy-caption-btn" class="mdc-btn mdc-btn--secondary transcribe-copy-btn">Kopieren</button>
        </div>

        <div class="form-group">
          <label class="form-label">Beschreibung</label>
          <textarea id="transcribe-description" class="form-input transcribe-textarea" rows="4" readonly
                    placeholder="KI-Beschreibung erscheint hier..."></textarea>
          <button id="copy-description-btn" class="mdc-btn mdc-btn--secondary transcribe-copy-btn">Kopieren</button>
        </div>

      </div>
    `;
    window.setContentSafely(window.content, html);
  }

  bindEvents() {
    document.getElementById('transcribe-start-btn')?.addEventListener('click', () => this.startJob());
    document.getElementById('transcribe-url-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.startJob();
    });
    document.getElementById('copy-transcript-btn')?.addEventListener('click', () => {
      this.copyField('transcribe-transcript', 'Transkript kopiert');
    });
    document.getElementById('copy-description-btn')?.addEventListener('click', () => {
      this.copyField('transcribe-description', 'Beschreibung kopiert');
    });
    document.getElementById('copy-caption-btn')?.addEventListener('click', () => {
      this.copyField('transcribe-caption', 'Caption kopiert');
    });
  }

  copyField(elementId, toastMsg) {
    const value = document.getElementById(elementId)?.value;
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      window.toastSystem?.show(toastMsg, 'success');
    });
  }

  async startJob() {
    const input = document.getElementById('transcribe-url-input');
    const btn = document.getElementById('transcribe-start-btn');
    const url = (input?.value || '').trim();

    if (!isSupportedVideoUrl(url)) {
      window.toastSystem?.show('Bitte eine gültige TikTok- oder Instagram-URL eingeben', 'error');
      return;
    }

    // UI zurücksetzen
    this.cleanup();
    btn.disabled = true;
    btn.textContent = 'Läuft...';
    document.getElementById('transcribe-transcript').value = '';
    document.getElementById('transcribe-caption').value = '';
    document.getElementById('transcribe-description').value = '';
    document.getElementById('transcribe-source-badge').textContent = '';
    document.getElementById('transcribe-log').textContent = '';
    this.renderMeta(null);
    this.renderedLogCount = 0;
    this.startTime = Date.now();

    const progressWrap = document.getElementById('transcribe-progress-wrap');
    progressWrap.style.display = 'flex';
    this.setProgress('pending');
    this.startTimer();
    this.appendLog(`[Client] Job wird angelegt für: ${url}`);

    try {
      const job = await this.service.start(url);
      this.appendLog(`[Client] Job-ID: ${job.id}`);
      this.appendLog('[Client] Background Function gestartet – warte auf Server-Updates...');
    } catch (err) {
      console.error('Transcribe-Start fehlgeschlagen:', err);
      this.appendLog(`[Client] FEHLER: ${err.message}`);
      window.toastSystem?.show(err.message, 'error');
      this.finishUi();
    }
  }

  handleJobUpdate(job) {
    // Server-Logs anhängen (nur neue Zeilen)
    const logs = Array.isArray(job.logs) ? job.logs : [];
    for (let i = this.renderedLogCount; i < logs.length; i++) {
      const entry = logs[i];
      const time = entry.ts ? new Date(entry.ts).toLocaleTimeString('de-DE') : '';
      this.appendLog(`[Server ${time}] ${entry.msg}`);
    }
    this.renderedLogCount = Math.max(this.renderedLogCount, logs.length);

    if (job.progress_step) this.setProgress(job.progress_step);

    if (job.status === 'done') {
      document.getElementById('transcribe-transcript').value = job.transcript || '';
      document.getElementById('transcribe-caption').value = job.caption || '';
      document.getElementById('transcribe-description').value = job.description || '';
      this.renderMeta(job);
      const badge = document.getElementById('transcribe-source-badge');
      if (badge && job.transcript_source) {
        badge.textContent = job.transcript_source === 'native_captions'
          ? '(Quelle: native TikTok-Captions)'
          : '(Quelle: Whisper)';
      }
      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
      this.appendLog(`[Client] Fertig nach ${elapsed}s (Gesamtzeit inkl. Warteschlange)`);
      window.toastSystem?.show('Transkription abgeschlossen', 'success');
      this.finishUi();
    } else if (job.status === 'error') {
      this.appendLog(`[Client] Job fehlgeschlagen: ${job.error_message || 'Unbekannter Fehler'}`);
      window.toastSystem?.show(`Fehler: ${job.error_message || 'Unbekannt'}`, 'error');
      this.finishUi();
    }
  }

  /**
   * Autor-Card + Stats-Chips rendern. job=null versteckt/leert alles.
   * Werte kommen von gescrapten Fremdseiten -> nur textContent/href, kein innerHTML.
   */
  renderMeta(job) {
    const wrap = document.getElementById('transcribe-meta');
    const authorLink = document.getElementById('transcribe-author-link');
    const postedAt = document.getElementById('transcribe-posted-at');
    const statsEl = document.getElementById('transcribe-stats');
    if (!wrap || !authorLink || !postedAt || !statsEl) return;

    statsEl.textContent = '';

    const stats = [
      { label: 'Likes', value: job?.likes_count },
      { label: 'Comments', value: job?.comments_count },
      { label: 'Shares', value: job?.shares_count },
      { label: 'Saves', value: job?.saves_count }
    ].filter(s => s.value !== null && s.value !== undefined);

    const hasAuthor = !!job?.author_name;
    if (!job || (!hasAuthor && stats.length === 0)) {
      wrap.style.display = 'none';
      return;
    }

    if (hasAuthor) {
      authorLink.textContent = `@${job.author_name}`;
      if (job.author_url) {
        authorLink.href = job.author_url;
        authorLink.style.pointerEvents = '';
      } else {
        authorLink.removeAttribute('href');
        authorLink.style.pointerEvents = 'none';
      }
      authorLink.parentElement.style.display = 'flex';
    } else {
      authorLink.parentElement.style.display = 'none';
    }

    postedAt.textContent = job.posted_at
      ? `· gepostet am ${new Date(job.posted_at).toLocaleDateString('de-DE', { timeZone: 'UTC' })}`
      : '';

    for (const stat of stats) {
      const chip = document.createElement('span');
      chip.style.cssText = 'background: var(--gray-100); border-radius: 999px; padding: 2px 10px; font-size: var(--text-sm);';
      const num = document.createElement('strong');
      num.textContent = Number(stat.value).toLocaleString('de-DE');
      chip.appendChild(num);
      chip.appendChild(document.createTextNode(` ${stat.label}`));
      statsEl.appendChild(chip);
    }
    statsEl.style.display = stats.length ? 'flex' : 'none';

    wrap.style.display = 'flex';
  }

  setProgress(step) {
    const config = PROGRESS_STEPS[step] || PROGRESS_STEPS.pending;
    const bar = document.getElementById('transcribe-progress-bar');
    const label = document.getElementById('transcribe-progress-label');
    if (bar) bar.style.width = `${config.pct}%`;
    if (label) label.textContent = config.label;
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      const el = document.getElementById('transcribe-elapsed');
      if (el && this.startTime) {
        el.textContent = `${((Date.now() - this.startTime) / 1000).toFixed(1)}s`;
      }
    }, 100);
  }

  appendLog(msg) {
    const logEl = document.getElementById('transcribe-log');
    if (!logEl) return;
    logEl.textContent += (logEl.textContent ? '\n' : '') + msg;
    logEl.scrollTop = logEl.scrollHeight;
    console.log(`📝 ${msg}`);
  }

  finishUi() {
    const btn = document.getElementById('transcribe-start-btn');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Transkribieren';
    }
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
  }

  cleanup() {
    this.finishUi();
    this.service.cancel();
  }

  destroy() {
    this.cleanup();
  }
}

export const transcribeTestPage = new TranscribeTestPage();
