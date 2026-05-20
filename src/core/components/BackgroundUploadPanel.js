// BackgroundUploadPanel.js
// Floating Panel rechts unten: zeigt aktive/abgeschlossene Upload-Jobs.
// Hört auf CustomEvents des BackgroundUploadService.

import { backgroundUploadService, UPLOAD_EVENTS } from '../BackgroundUploadService.js';

const ICONS = {
  video: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>',
  story: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="4"/><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5"/></svg>',
  abort: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>',
  retry: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>',
  done: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>',
  collapse: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25 12 15.75 4.5 8.25"/></svg>',
  expand: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75 12 8.25l7.5 7.5"/></svg>',
};

function fmtMB(bytes) {
  if (!bytes) return '0 MB';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function pct(loaded, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((loaded / total) * 100));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

const STATUS_LABEL = {
  pending: 'Wartet…',
  uploading: 'Lädt hoch…',
  saving: 'Speichert…',
  done: 'Fertig',
  error: 'Fehler',
  aborted: 'Abgebrochen',
};

export class BackgroundUploadPanel {
  constructor() {
    this.root = null;
    this.collapsed = false;
    this._boundHandlers = null;
  }

  init() {
    if (this.root) return;

    this.root = document.createElement('div');
    this.root.className = 'bg-upload-panel';
    this.root.id = 'background-upload-panel';
    this.root.style.display = 'none';
    document.body.appendChild(this.root);

    this._render();

    this._boundHandlers = {
      queue: () => this._render(),
      item: () => this._render(),
      job: () => this._render(),
    };
    window.addEventListener(UPLOAD_EVENTS.QUEUE_CHANGED, this._boundHandlers.queue);
    window.addEventListener(UPLOAD_EVENTS.ITEM_UPDATE, this._boundHandlers.item);
    window.addEventListener(UPLOAD_EVENTS.JOB_UPDATE, this._boundHandlers.job);

    this.root.addEventListener('click', (e) => this._onClick(e));
  }

  destroy() {
    if (this._boundHandlers) {
      window.removeEventListener(UPLOAD_EVENTS.QUEUE_CHANGED, this._boundHandlers.queue);
      window.removeEventListener(UPLOAD_EVENTS.ITEM_UPDATE, this._boundHandlers.item);
      window.removeEventListener(UPLOAD_EVENTS.JOB_UPDATE, this._boundHandlers.job);
      this._boundHandlers = null;
    }
    this.root?.remove();
    this.root = null;
  }

  _onClick(e) {
    const collapseBtn = e.target.closest('.bg-upload-toggle');
    if (collapseBtn) {
      this.collapsed = !this.collapsed;
      this._render();
      return;
    }

    const abortBtn = e.target.closest('[data-action="abort-job"]');
    if (abortBtn) {
      backgroundUploadService.abort(abortBtn.dataset.jobId);
      return;
    }

    const retryBtn = e.target.closest('[data-action="retry-job"]');
    if (retryBtn) {
      backgroundUploadService.retry(retryBtn.dataset.jobId);
      backgroundUploadService.dismiss(retryBtn.dataset.jobId);
      return;
    }

    const dismissBtn = e.target.closest('[data-action="dismiss-job"]');
    if (dismissBtn) {
      backgroundUploadService.dismiss(dismissBtn.dataset.jobId);
      return;
    }

    const dismissAllBtn = e.target.closest('[data-action="dismiss-all-done"]');
    if (dismissAllBtn) {
      for (const job of backgroundUploadService.getAllJobs()) {
        if (job.status === 'done' || job.status === 'error' || job.status === 'aborted') {
          backgroundUploadService.dismiss(job.id);
        }
      }
    }
  }

  _render() {
    if (!this.root) return;
    const jobs = backgroundUploadService.getAllJobs();

    if (jobs.length === 0) {
      this.root.style.display = 'none';
      return;
    }
    this.root.style.display = '';

    const active = jobs.filter(j => j.status === 'running' || j.status === 'pending').length;
    const errored = jobs.filter(j => j.status === 'error').length;

    let title = 'Uploads';
    if (active > 0) title = `${active} Upload${active !== 1 ? 's' : ''} laufen`;
    else if (errored > 0) title = `${errored} fehlgeschlagen`;
    else title = 'Uploads fertig';

    const hasDismissable = jobs.some(j => j.status === 'done' || j.status === 'error' || j.status === 'aborted');

    this.root.innerHTML = `
      <div class="bg-upload-header">
        <span class="bg-upload-title">${escapeHtml(title)}</span>
        <div class="bg-upload-header-actions">
          ${hasDismissable ? `<button type="button" class="bg-upload-link" data-action="dismiss-all-done" title="Erledigte schließen">Schließen</button>` : ''}
          <button type="button" class="bg-upload-toggle" title="${this.collapsed ? 'Ausklappen' : 'Einklappen'}">
            ${this.collapsed ? ICONS.expand : ICONS.collapse}
          </button>
        </div>
      </div>
      ${this.collapsed ? '' : `<div class="bg-upload-body">${jobs.map(j => this._renderJob(j)).join('')}</div>`}
    `;
  }

  _renderJob(job) {
    const kindIcon = job.kind === 'storys' ? ICONS.story : ICONS.video;
    const items = job.items.map(it => this._renderItem(it)).join('');

    const showRetry = job.status === 'error' || job.status === 'aborted';
    const showAbort = job.status === 'running' || job.status === 'pending';
    const showDismiss = job.status === 'done' || job.status === 'error' || job.status === 'aborted';

    return `
      <div class="bg-upload-job bg-upload-job--${job.status}" data-job-id="${job.id}">
        <div class="bg-upload-job-head">
          <span class="bg-upload-job-icon">${kindIcon}</span>
          <span class="bg-upload-job-label">${this._jobLabel(job)}</span>
          <div class="bg-upload-job-actions">
            ${showRetry ? `<button type="button" class="bg-upload-icon-btn" data-action="retry-job" data-job-id="${job.id}" title="Erneut versuchen">${ICONS.retry}</button>` : ''}
            ${showAbort ? `<button type="button" class="bg-upload-icon-btn" data-action="abort-job" data-job-id="${job.id}" title="Abbrechen">${ICONS.abort}</button>` : ''}
            ${showDismiss ? `<button type="button" class="bg-upload-icon-btn" data-action="dismiss-job" data-job-id="${job.id}" title="Schließen">${ICONS.abort}</button>` : ''}
          </div>
        </div>
        ${job.error ? `<div class="bg-upload-job-error">${escapeHtml(job.error)}</div>` : ''}
        <div class="bg-upload-items">${items}</div>
      </div>
    `;
  }

  _jobLabel(job) {
    if (job.kind === 'storys') return `Storys (${job.items.length})`;
    if (job.kind === 'video-replace') return 'Video ersetzen';
    return `Video${job.items.length > 1 ? `s (${job.items.length})` : ''}`;
  }

  _renderItem(item) {
    const p = pct(item.loaded, item.total);
    const statusLabel = STATUS_LABEL[item.status] || item.status;
    return `
      <div class="bg-upload-item bg-upload-item--${item.status}" data-item-id="${item.id}">
        <div class="bg-upload-item-row">
          <span class="bg-upload-item-name" title="${escapeHtml(item.fileName)}">${escapeHtml(item.fileName)}</span>
          <span class="bg-upload-item-meta">${fmtMB(item.fileSize)}</span>
        </div>
        <div class="bg-upload-item-row bg-upload-item-progress-row">
          <div class="bg-upload-bar">
            <div class="bg-upload-bar-fill" style="width:${p}%"></div>
          </div>
          <span class="bg-upload-item-pct">${item.status === 'done' ? ICONS.done : `${p}%`}</span>
        </div>
        <div class="bg-upload-item-status">${escapeHtml(statusLabel)}${item.error ? ` — ${escapeHtml(item.error)}` : ''}</div>
      </div>
    `;
  }
}

export const backgroundUploadPanel = new BackgroundUploadPanel();
