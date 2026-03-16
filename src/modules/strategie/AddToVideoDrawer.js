// AddToVideoDrawer.js - Drawer zum Verknüpfen von Strategie-Items mit bestehenden Videos

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
        .select('id, titel, kooperation_id, position, strategie_item_id')
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
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <span>Diese Strategie ist keiner Kampagne zugeordnet. Bitte erst eine Kampagne verknüpfen.</span>
        </div>
      ` : hasVideos ? `
        <div class="form-field">
          <label>Video auswählen</label>
          <select id="select-video" class="form-input">
            <option value="">– Video wählen –</option>
            ${this.renderVideoOptions()}
          </select>
        </div>
        <div class="drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close">
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button type="button" id="btn-link-existing" class="mdc-btn mdc-btn--create" disabled>
            <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/>
              </svg>
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
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
            </div>
          ` : `
            <div class="preview-placeholder">Kein Bild</div>
          `}
        </div>
        <div class="preview-content">
          <p class="preview-beschreibung">${this.escapeHtml(beschreibung)}</p>
          ${videoLink ? `
            <a href="${videoLink}" target="_blank" rel="noopener" class="preview-link">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 14px; height: 14px;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Original ansehen
            </a>
          ` : '<span class="preview-type-badge">Idee</span>'}
        </div>
      </div>
    `;
  }

  renderVideoOptions() {
    const grouped = {};
    this.videos.forEach(video => {
      if (!grouped[video.kooperation_id]) {
        grouped[video.kooperation_id] = [];
      }
      grouped[video.kooperation_id].push(video);
    });

    let html = '';
    this.kooperationen.forEach(koop => {
      const koopVideos = grouped[koop.id];
      if (!koopVideos || koopVideos.length === 0) return;

      const creatorName = koop.creator 
        ? `${koop.creator.vorname || ''} ${koop.creator.nachname || ''}`.trim()
        : '';
      const label = creatorName ? `${koop.name} (${creatorName})` : koop.name;

      html += `<optgroup label="${this.escapeHtml(label)}">`;
      koopVideos.forEach(video => {
        const videoLabel = video.titel || `Video ${video.position}`;
        html += `<option value="${video.id}">${this.escapeHtml(videoLabel)}</option>`;
      });
      html += '</optgroup>';
    });

    return html;
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
