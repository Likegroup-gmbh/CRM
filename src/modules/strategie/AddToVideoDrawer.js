// AddToVideoDrawer.js - Drawer zum Verknüpfen von Strategie-Items mit bestehenden Videos

import { buildVideoPickerOptions } from './VideoPickerOptions.js';
import { icon } from '../../core/icons/IconSystem.js';

export class AddToVideoDrawer {
  constructor() {
    this.drawerId = 'add-to-video-drawer';
    this.item = null;
    this.strategie = null;
    this.kampagneId = null;
    this.kooperationen = [];
    this.videos = [];
    this.selectedVideoId = null;
  }

  async open(item, strategie) {
    this.item = item;
    this.strategie = strategie;
    this.kampagneId = strategie.kampagne_id;
    this.selectedVideoId = null;

    try {
      await this.createDrawer();
      await this.loadData();
      this.renderBody();
      this.bindEvents();
    } catch (error) {
      console.error('❌ Fehler beim Öffnen des AddToVideo-Drawers:', error);
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

    const header = document.createElement('div');
    header.className = 'drawer-header';
    
    const headerLeft = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'drawer-title';
    title.textContent = 'Idee zu Video hinzufügen';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = 'Verknüpfen Sie diese Idee mit einem bestehenden Video';
    
    headerLeft.appendChild(title);
    headerLeft.appendChild(subtitle);
    
    const headerRight = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close-btn';
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('aria-label', 'Schließen');
    closeBtn.innerHTML = '&times;';
    headerRight.appendChild(closeBtn);
    
    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = `${this.drawerId}-body`;
    body.innerHTML = '<div class="drawer-loading-state">Lade Daten...</div>';

    panel.appendChild(header);
    panel.appendChild(body);

    overlay.addEventListener('click', () => this.close());
    closeBtn.addEventListener('click', () => this.close());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      panel.classList.add('show');
    });
  }

  async loadData() {
    if (!this.kampagneId) {
      this.kooperationen = [];
      this.videos = [];
      return;
    }

    try {
      const { data: kooperationen, error: koopError } = await window.supabase
        .from('kooperationen')
        .select('id, name, videoanzahl, creator:creator_id(id, vorname, nachname)')
        .eq('kampagne_id', this.kampagneId)
        .order('created_at', { ascending: false });

      if (koopError) throw koopError;
      this.kooperationen = kooperationen || [];

      if (this.kooperationen.length === 0) {
        this.videos = [];
        return;
      }

      const koopIds = this.kooperationen.map(k => k.id);
      const { data: videos, error: videoError } = await window.supabase
        .from('kooperation_videos')
        .select('id, titel, video_name, thema, content_art, kampagnenart, kooperation_id, position, strategie_item_id')
        .in('kooperation_id', koopIds)
        .is('strategie_item_id', null)
        .order('position', { ascending: true });

      if (videoError) throw videoError;
      this.videos = videos || [];

    } catch (error) {
      console.error('❌ Fehler beim Laden der Daten:', error);
      this.kooperationen = [];
      this.videos = [];
    }
  }

  renderBody() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    const hasKampagne = !!this.kampagneId;
    const hasVideos = this.videos.length > 0;

    body.innerHTML = `
      ${this.renderPreviewBox()}

      ${!hasKampagne ? `
        <div class="add-to-video-warning">
          ${icon('exclamation-circle', { className: 'icon-20' })}
          <span>Diese Strategie ist keiner Kampagne zugeordnet. Bitte erst eine Kampagne verknüpfen.</span>
        </div>
      ` : hasVideos ? `
        <div class="form-field">
          <label>Video auswählen</label>
          <select id="select-video" class="form-input" data-searchable="true">
            <option value="">– Video wählen –</option>
          </select>
        </div>
        <div class="drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button type="button" id="btn-link-existing" class="mdc-btn mdc-btn--create" disabled>
            <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
              ${icon('check-filled')}
            </span>
            <span class="mdc-btn__spinner" aria-hidden="true">
              <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16">
                <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
              </svg>
            </span>
            <span class="mdc-btn__label">Verknüpfen</span>
          </button>
        </div>
      ` : `
        <div class="add-to-video-empty">
          <p>Keine verfügbaren Videos gefunden.</p>
          <p class="hint">Alle Videos haben bereits eine Idee verknüpft oder es existieren noch keine Videos. Videos werden automatisch beim Anlegen einer Kooperation erstellt.</p>
        </div>
      `}
    `;

    this.initVideoSearchableSelect();
  }

  initVideoSearchableSelect() {
    const selectVideo = document.getElementById('select-video');
    if (!selectVideo || !window.formSystem) return;

    const options = buildVideoPickerOptions(this.kooperationen, this.videos);
    window.formSystem.createSimpleSearchableSelect(selectVideo, options, {
      placeholder: 'Kooperation oder Video suchen…'
    });
  }

  renderPreviewBox() {
    const screenshotUrl = this.item?.screenshot_url;
    const beschreibung = this.item?.beschreibung || 'Keine Beschreibung';
    const videoLink = this.item?.video_link;
    const isIdea = !videoLink;

    return `
      <div class="add-to-video-preview">
        <div class="preview-image">
          ${screenshotUrl ? `
            <img src="${screenshotUrl}" alt="Screenshot" />
          ` : isIdea ? `
            <div class="preview-idea-icon">
              ${icon('light-bulb')}
            </div>
          ` : `
            <div class="preview-placeholder">Kein Bild</div>
          `}
        </div>
        <div class="preview-content">
          <p class="preview-beschreibung">${this.escapeHtml(beschreibung)}</p>
          ${videoLink ? `
            <a href="${videoLink}" target="_blank" rel="noopener" class="preview-link">
              ${icon('external-link', { className: 'icon-14' })}
              Original ansehen
            </a>
          ` : '<span class="preview-type-badge">Idee</span>'}
        </div>
      </div>
    `;
  }

  bindEvents() {
    document.querySelectorAll('[data-action="close"]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    const selectVideo = document.getElementById('select-video');
    if (selectVideo) {
      selectVideo.addEventListener('change', (e) => {
        this.selectedVideoId = e.target.value || null;
        const btn = document.getElementById('btn-link-existing');
        if (btn) btn.disabled = !this.selectedVideoId;
      });
    }

    const btnLink = document.getElementById('btn-link-existing');
    if (btnLink) {
      btnLink.addEventListener('click', () => this.handleLinkExisting());
    }
  }

  async handleLinkExisting() {
    if (!this.selectedVideoId || !this.item?.id) return;

    const btn = document.getElementById('btn-link-existing');

    try {
      if (btn) {
        btn.disabled = true;
        btn.classList.add('is-loading');
      }

      const { error } = await window.supabase
        .from('kooperation_videos')
        .update({ strategie_item_id: this.item.id })
        .eq('id', this.selectedVideoId);

      if (error) throw error;

      window.toastSystem?.show('Idee erfolgreich mit Video verknüpft!', 'success');

      window.dispatchEvent(new CustomEvent('strategieItemLinked', {
        detail: { itemId: this.item.id, videoId: this.selectedVideoId }
      }));

      this.close();

    } catch (error) {
      console.error('❌ Fehler beim Verknüpfen:', error);
      window.toastSystem?.show('Fehler beim Verknüpfen', 'error');
      
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
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

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text || '').replace(/[&<>"']/g, m => map[m]);
  }
}
