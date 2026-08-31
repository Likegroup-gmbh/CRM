// SkriptKooperationDrawer.js
// Drawer im Skript-Editor: Skript einem Video (Creator in Kooperation) zuweisen.

import { icon } from '../../core/icons/IconSystem.js';
import { buildVideoDisplayName, buildVideoPickerOptions } from '../strategie/VideoPickerOptions.js';
import { skripteService } from './SkripteService.js';
import { escapeHtml } from './SkripteUtils.js';

function creatorDisplayName(creator) {
  return `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim() || 'Unbekannt';
}

function verknuepfungLabel(row) {
  const creator = creatorDisplayName(row.kooperation?.creator);
  const koopName = row.kooperation?.name || 'Kooperation';
  const videoLabel = buildVideoDisplayName(row, row.kooperation);
  return `${creator} · ${koopName} · ${videoLabel}`;
}

export class SkriptKooperationDrawer {
  constructor() {
    this.drawerId = 'skript-kooperation-drawer';
    this.skript = null;
    this.verknuepfungen = [];
    this.kooperationen = [];
    this.videos = [];
    this.selectedVideoId = null;
    this.onSuccess = null;
  }

  async open({ skript, verknuepfungen = [], onSuccess } = {}) {
    this.skript = skript;
    this.verknuepfungen = verknuepfungen || [];
    this.onSuccess = onSuccess;
    this.selectedVideoId = null;

    try {
      await this.createDrawer();
      await this.loadData();
      this.renderBody();
      this.bindEvents();
    } catch (error) {
      console.error('Fehler beim Öffnen des SkriptKooperation-Drawers:', error);
      window.toastSystem?.show('Fehler beim Öffnen', 'error');
    }
  }

  async createDrawer() {
    this.removeDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.drawerId;

    panel.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="drawer-title">Creator zuweisen</span>
          <p class="drawer-subtitle">Verknüpfen Sie dieses Skript mit einem Video in einer Kooperation</p>
        </div>
        <div>
          <button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button>
        </div>
      </div>
      <div class="drawer-body" id="${this.drawerId}-body">
        <div class="drawer-loading-state">Lade Daten...</div>
      </div>
    `;

    overlay.addEventListener('click', () => this.close());
    panel.querySelector('.drawer-close-btn').addEventListener('click', () => this.close());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => panel.classList.add('show'));
  }

  async loadData() {
    this.kooperationen = [];
    this.videos = [];
    const kampagneId = this.skript?.kampagne_id;
    if (!kampagneId) return;

    const result = await skripteService.loadKooperationenMitVideos(kampagneId);
    this.kooperationen = result.kooperationen || [];
    this.videos = result.videos || [];
  }

  renderBody() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    const kampagneId = this.skript?.kampagne_id;
    const currentIds = new Set(this.verknuepfungen.map((v) => v.id));
    const pickerVideos = this.videos.filter((v) => !currentIds.has(v.id));
    const options = buildVideoPickerOptions(this.kooperationen, pickerVideos).map((opt) => {
      const video = pickerVideos.find((v) => v.id === opt.value);
      if (video?.skript_id && video.skript_id !== this.skript?.id) {
        return {
          ...opt,
          subtitle: [opt.subtitle, 'bereits anderes Skript'].filter(Boolean).join(' · ')
        };
      }
      return opt;
    });
    const hasVideos = options.length > 0;

    body.innerHTML = `
      ${this.renderCurrentLinks()}

      ${!kampagneId ? `
        <div class="add-to-video-warning">
          ${icon('exclamation-circle', { className: 'icon-20' })}
          <span>Dieses Skript ist keiner Kampagne zugeordnet. Bitte erst eine Kampagne setzen.</span>
        </div>
      ` : hasVideos ? `
        <div class="form-field">
          <label>Video auswählen</label>
          <select id="select-skript-video" class="form-input" data-searchable="true">
            <option value="">– Video wählen –</option>
          </select>
        </div>
        <div class="drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button type="button" id="btn-link-skript-video" class="mdc-btn mdc-btn--create" disabled>
            <span class="mdc-btn__label">Verknüpfen</span>
          </button>
        </div>
      ` : `
        <div class="add-to-video-empty">
          <p>Keine weiteren Videos in dieser Kampagne.</p>
          <p class="hint">Videos entstehen automatisch, wenn eine Kooperation angelegt wird.</p>
        </div>
      `}
    `;

    if (hasVideos) this.initVideoSearchableSelect(options);
  }

  renderCurrentLinks() {
    if (!this.verknuepfungen.length) return '';
    return `
      <div class="skript-koop-current">
        <div class="form-field">
          <label>Aktuell verknüpft</label>
        </div>
        <ul class="skript-koop-current-list">
          ${this.verknuepfungen.map((row) => `
            <li class="skript-koop-current-item">
              <span>${escapeHtml(verknuepfungLabel(row))}</span>
              <button type="button" class="skript-koop-unlink" data-action="unlink-video" data-video-id="${row.id}" title="Verknüpfung entfernen">
                ${icon('x-circle', { className: 'w-4 h-4' })}
              </button>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  initVideoSearchableSelect(options) {
    const select = document.getElementById('select-skript-video');
    if (!select || !window.formSystem) return;

    window.formSystem.createSimpleSearchableSelect(select, options, {
      placeholder: 'Kooperation oder Video suchen…'
    });
  }

  bindEvents() {
    document.querySelectorAll(`#${this.drawerId} [data-action="close"]`).forEach((btn) => {
      btn.addEventListener('click', () => this.close());
    });

    const select = document.getElementById('select-skript-video');
    if (select) {
      select.addEventListener('change', (e) => {
        this.selectedVideoId = e.target.value || null;
        const btn = document.getElementById('btn-link-skript-video');
        if (btn) btn.disabled = !this.selectedVideoId;
      });
    }

    document.getElementById('btn-link-skript-video')?.addEventListener('click', () => this.handleLink());

    document.querySelectorAll(`#${this.drawerId} [data-action="unlink-video"]`).forEach((btn) => {
      btn.addEventListener('click', () => this.handleUnlink(btn.dataset.videoId));
    });
  }

  async handleLink() {
    if (!this.selectedVideoId || !this.skript?.id) return;
    const btn = document.getElementById('btn-link-skript-video');
    try {
      if (btn) {
        btn.disabled = true;
        btn.classList.add('is-loading');
      }
      await skripteService.verknuepfeMitVideo(this.selectedVideoId, this.skript.id);
      window.toastSystem?.show('Skript erfolgreich verknüpft', 'success');
      window.dispatchEvent(new CustomEvent('skriptLinked', {
        detail: { skriptId: this.skript.id, videoId: this.selectedVideoId }
      }));
      if (this.onSuccess) await this.onSuccess();
      this.close();
    } catch (error) {
      console.error('Fehler beim Verknüpfen:', error);
      window.toastSystem?.show('Fehler beim Verknüpfen', 'error');
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    }
  }

  async handleUnlink(videoId) {
    if (!videoId) return;
    const result = await window.confirmationModal?.open({
      title: 'Verknüpfung entfernen?',
      message: 'Möchten Sie die Verknüpfung zwischen diesem Video und dem Skript entfernen?',
      confirmText: 'Entfernen',
      cancelText: 'Abbrechen',
      danger: true
    });
    if (!result?.confirmed) return;

    try {
      await skripteService.loeseVerknuepfung(videoId);
      window.toastSystem?.show('Verknüpfung entfernt', 'success');
      this.verknuepfungen = this.verknuepfungen.filter((v) => v.id !== videoId);
      if (this.onSuccess) await this.onSuccess();
      this.renderBody();
      this.bindEvents();
    } catch (error) {
      console.error('Fehler beim Entfernen:', error);
      window.toastSystem?.show('Fehler beim Entfernen', 'error');
    }
  }

  close() {
    const panel = document.getElementById(this.drawerId);
    if (panel) {
      panel.classList.remove('show');
      setTimeout(() => this.removeDrawer(), 250);
    } else {
      this.removeDrawer();
    }
  }

  removeDrawer() {
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }

  destroy() {
    this.close();
  }
}

export default SkriptKooperationDrawer;
