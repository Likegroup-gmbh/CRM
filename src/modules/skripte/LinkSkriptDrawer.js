// LinkSkriptDrawer.js
// Drawer zum Verknuepfen eines Kampagnen-Videos mit einem Skript (aus der Tabelle).

import { buildVideoDisplayName } from '../strategie/VideoPickerOptions.js';
import { skripteService } from './SkripteService.js';
import { STATUS_LABELS, skriptEditorPath } from './SkripteUtils.js';

function creatorDisplayName(creator) {
  return `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim() || 'Unbekannt';
}

function buildSkriptPickerOptions(skripte, linkedBySkriptId) {
  return (skripte || []).map((s) => {
    const linkedCount = linkedBySkriptId.get(s.id)?.size || 0;
    const status = STATUS_LABELS[s.status] || '';
    const subtitle = [
      status,
      linkedCount > 0 ? `${linkedCount}× verknüpft` : null
    ].filter(Boolean).join(' · ');
    return {
      value: s.id,
      label: s.titel || s.hook?.slice(0, 50) || '(ohne Titel)',
      ...(subtitle ? { subtitle } : {})
    };
  });
}

export class LinkSkriptDrawer {
  constructor() {
    this.drawerId = 'link-skript-drawer';
    this.video = null;
    this.kooperation = null;
    this.kampagneId = null;
    this.onSuccess = null;
    this.skripte = [];
    this.linkedBySkriptId = new Map();
    this.selectedSkriptId = null;
  }

  async open({ video, kooperation, kampagneId, onSuccess }) {
    this.video = video;
    this.kooperation = kooperation;
    this.kampagneId = kampagneId;
    this.onSuccess = onSuccess;
    this.selectedSkriptId = video?.skript_id || null;

    try {
      await this.createDrawer();
      await this.loadData();
      this.renderBody();
      this.bindEvents();
    } catch (error) {
      console.error('Fehler beim Öffnen des LinkSkript-Drawers:', error);
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
          <span class="drawer-title">Skript verknüpfen</span>
          <p class="drawer-subtitle">Wählen Sie ein Skript dieser Kampagne</p>
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
    this.skripte = [];
    this.linkedBySkriptId = new Map();

    if (!this.kampagneId) return;

    this.skripte = await skripteService.loadSkripte({ kampagneId: this.kampagneId });

    const { data: kooperationen } = await window.supabase
      .from('kooperationen')
      .select('id')
      .eq('kampagne_id', this.kampagneId);

    const koopIds = (kooperationen || []).map((k) => k.id);
    if (koopIds.length === 0) return;

    const { data: linkedVideos, error: linkError } = await window.supabase
      .from('kooperation_videos')
      .select('id, skript_id')
      .in('kooperation_id', koopIds)
      .not('skript_id', 'is', null);

    if (linkError) throw linkError;
    (linkedVideos || []).forEach((v) => {
      if (!v.skript_id) return;
      if (!this.linkedBySkriptId.has(v.skript_id)) this.linkedBySkriptId.set(v.skript_id, new Set());
      this.linkedBySkriptId.get(v.skript_id).add(v.id);
    });
  }

  renderBody() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    const creatorName = creatorDisplayName(this.kooperation?.creator);
    const videoLabel = buildVideoDisplayName(this.video, this.kooperation);
    const hasKampagne = !!this.kampagneId;
    const options = buildSkriptPickerOptions(this.skripte, this.linkedBySkriptId);
    const hasSkripte = options.length > 0;
    const isLinked = !!this.video?.skript_id;
    const linkedPath = isLinked ? skriptEditorPath(this.video.skript_id) : '';

    body.innerHTML = `
      <div class="link-strategie-context">
        <div class="link-strategie-context-row">
          <span class="link-strategie-context-label">Creator</span>
          <span>${this.escapeHtml(creatorName)}</span>
        </div>
        <div class="link-strategie-context-row">
          <span class="link-strategie-context-label">Kooperation</span>
          <span>${this.escapeHtml(this.kooperation?.name || '—')}</span>
        </div>
        <div class="link-strategie-context-row">
          <span class="link-strategie-context-label">Video</span>
          <span>${this.escapeHtml(videoLabel)}</span>
        </div>
      </div>

      ${!hasKampagne ? `
        <div class="add-to-video-empty">
          <p>Keine Kampagne zugeordnet.</p>
        </div>
      ` : !hasSkripte ? `
        <div class="add-to-video-empty">
          <p>Keine Skripte für diese Kampagne vorhanden.</p>
          <p class="hint">Lege zuerst ein Skript im Skripte-Modul an.</p>
        </div>
      ` : `
        <div class="form-field">
          <label>Skript auswählen</label>
          <select id="select-skript" class="form-input" data-searchable="true">
            <option value="">– Skript wählen –</option>
          </select>
        </div>
        ${isLinked ? `
          <p class="skript-link-open-hint">
            <a href="${linkedPath}" class="table-link" data-action="open-linked-skript">Skript öffnen</a>
          </p>
        ` : ''}
        <div class="drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          ${isLinked ? `
            <button type="button" id="btn-unlink-skript" class="mdc-btn mdc-btn--danger">
              <span class="mdc-btn__label">Verknüpfung entfernen</span>
            </button>
          ` : ''}
          <button type="button" id="btn-link-skript" class="mdc-btn mdc-btn--create" disabled>
            <span class="mdc-btn__label">Verknüpfen</span>
          </button>
        </div>
      `}
    `;

    if (hasSkripte) this.initSkriptSearchableSelect(options);
  }

  initSkriptSearchableSelect(options) {
    const select = document.getElementById('select-skript');
    if (!select || !window.formSystem) return;

    window.formSystem.createSimpleSearchableSelect(select, options, {
      placeholder: 'Skript suchen…'
    });

    if (this.selectedSkriptId) {
      select.value = this.selectedSkriptId;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      const hidden = select.parentNode?.querySelector('input[type="hidden"]');
      if (hidden) hidden.value = this.selectedSkriptId;
      const option = options.find((o) => o.value === this.selectedSkriptId);
      const input = select.parentNode?.querySelector('.searchable-select-input');
      if (option && input) input.value = option.label;
      const btn = document.getElementById('btn-link-skript');
      if (btn) btn.disabled = false;
    }
  }

  bindEvents() {
    document.querySelectorAll(`#${this.drawerId} [data-action="close"]`).forEach((btn) => {
      btn.addEventListener('click', () => this.close());
    });

    document.querySelector(`#${this.drawerId} [data-action="open-linked-skript"]`)?.addEventListener('click', (e) => {
      e.preventDefault();
      if (!this.video?.skript_id) return;
      this.close();
      window.navigateTo(skriptEditorPath(this.video.skript_id));
    });

    const select = document.getElementById('select-skript');
    if (select) {
      select.addEventListener('change', (e) => {
        this.selectedSkriptId = e.target.value || null;
        const btn = document.getElementById('btn-link-skript');
        if (btn) btn.disabled = !this.selectedSkriptId;
      });
    }

    document.getElementById('btn-link-skript')?.addEventListener('click', () => this.handleLink());
    document.getElementById('btn-unlink-skript')?.addEventListener('click', () => this.handleUnlink());
  }

  async handleLink() {
    if (!this.selectedSkriptId || !this.video?.id) return;

    const btn = document.getElementById('btn-link-skript');
    try {
      if (btn) {
        btn.disabled = true;
        btn.classList.add('is-loading');
      }

      await skripteService.verknuepfeMitVideo(this.video.id, this.selectedSkriptId);

      window.toastSystem?.show('Skript erfolgreich verknüpft', 'success');
      window.dispatchEvent(new CustomEvent('skriptLinked', {
        detail: { skriptId: this.selectedSkriptId, videoId: this.video.id }
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

  async handleUnlink() {
    if (!this.video?.id) return;

    const result = await window.confirmationModal?.open({
      title: 'Verknüpfung entfernen?',
      message: 'Möchten Sie die Verknüpfung zwischen diesem Video und dem Skript entfernen?',
      confirmText: 'Entfernen',
      cancelText: 'Abbrechen',
      danger: true
    });

    if (!result?.confirmed) return;

    try {
      await skripteService.loeseVerknuepfung(this.video.id);
      window.toastSystem?.show('Verknüpfung entfernt', 'success');
      if (this.onSuccess) await this.onSuccess();
      this.close();
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

  escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text || '').replace(/[&<>"']/g, (m) => map[m]);
  }
}

export default LinkSkriptDrawer;
