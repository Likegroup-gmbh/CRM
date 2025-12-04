// AddToVideoDrawer.js - Drawer zum Verknüpfen von Strategie-Items mit Videos
// All-in-One: Bestehendes Video auswählen ODER neues Video anlegen

export class AddToVideoDrawer {
  constructor() {
    this.drawerId = 'add-to-video-drawer';
    this.item = null;
    this.strategie = null;
    this.kampagneId = null;
    this.kooperationen = [];
    this.videos = [];
    this.selectedMode = 'existing'; // 'existing' oder 'new'
    this.selectedVideoId = null;
    this.selectedKooperationId = null;
  }

  /**
   * Drawer öffnen
   */
  async open(item, strategie) {
    this.item = item;
    this.strategie = strategie;
    this.kampagneId = strategie.kampagne_id;
    this.selectedMode = 'existing';
    this.selectedVideoId = null;
    this.selectedKooperationId = null;

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

  /**
   * Drawer DOM erstellen
   */
  async createDrawer() {
    this.removeDrawer();

    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;
    
    // Panel
    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = this.drawerId;

    // Header
    const header = document.createElement('div');
    header.className = 'drawer-header';
    
    const headerLeft = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'drawer-title';
    title.textContent = 'Idee zu Video hinzufügen';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = 'Verknüpfen Sie diese Idee mit einem Video';
    
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

    // Body
    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = `${this.drawerId}-body`;
    body.innerHTML = '<div class="drawer-loading-state">Lade Daten...</div>';

    panel.appendChild(header);
    panel.appendChild(body);

    // Events
    overlay.addEventListener('click', () => this.close());
    closeBtn.addEventListener('click', () => this.close());

    // Zum DOM hinzufügen
    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    // Slide-in Animation
    requestAnimationFrame(() => {
      panel.classList.add('show');
    });
  }

  /**
   * Daten laden: Kooperationen und Videos der Kampagne
   */
  async loadData() {
    if (!this.kampagneId) {
      console.warn('⚠️ Keine Kampagne mit dieser Strategie verknüpft');
      this.kooperationen = [];
      this.videos = [];
      return;
    }

    try {
      // Kooperationen der Kampagne laden
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

      // Videos aller Kooperationen laden (nur die ohne strategie_item_id)
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

  /**
   * Body rendern
   */
  renderBody() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    const hasKampagne = !!this.kampagneId;
    const hasVideos = this.videos.length > 0;
    const hasKooperationen = this.kooperationen.length > 0;

    body.innerHTML = `
      <!-- Vorschau-Box -->
      ${this.renderPreviewBox()}

      ${!hasKampagne ? `
        <div class="add-to-video-warning">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <span>Diese Strategie ist keiner Kampagne zugeordnet. Bitte erst eine Kampagne verknüpfen.</span>
        </div>
      ` : `
        <!-- Mode Toggle -->
        <div class="add-to-video-toggle">
          <label class="toggle-option ${this.selectedMode === 'existing' ? 'active' : ''}">
            <input type="radio" name="video-mode" value="existing" ${this.selectedMode === 'existing' ? 'checked' : ''}>
            <span class="toggle-label">Zu bestehendem Video</span>
          </label>
          <label class="toggle-option ${this.selectedMode === 'new' ? 'active' : ''}">
            <input type="radio" name="video-mode" value="new" ${this.selectedMode === 'new' ? 'checked' : ''}>
            <span class="toggle-label">Neues Video anlegen</span>
          </label>
        </div>

        <!-- Bereich A: Bestehendes Video -->
        <div id="section-existing" class="add-to-video-section ${this.selectedMode === 'existing' ? 'active' : ''}">
          ${hasVideos ? `
            <div class="form-field">
              <label>Video auswählen</label>
              <select id="select-video" class="form-input">
                <option value="">– Video wählen –</option>
                ${this.renderVideoOptions()}
              </select>
            </div>
            <div class="drawer-actions">
              <button type="button" id="btn-link-existing" class="primary-btn" disabled>
                Verknüpfen
              </button>
            </div>
          ` : `
            <div class="add-to-video-empty">
              <p>Keine verfügbaren Videos gefunden.</p>
              <p class="hint">Alle Videos haben bereits eine Idee verknüpft oder es existieren noch keine Videos.</p>
            </div>
          `}
        </div>

        <!-- Bereich B: Neues Video -->
        <div id="section-new" class="add-to-video-section ${this.selectedMode === 'new' ? 'active' : ''}">
          ${hasKooperationen ? `
            <form id="form-new-video">
              <div class="form-field">
                <label>Kooperation *</label>
                <div class="auto-suggest-container">
                  <input 
                    type="text" 
                    id="as-kooperation" 
                    class="form-input" 
                    placeholder="Kooperation suchen..." 
                    autocomplete="off"
                  />
                  <div id="asdd-kooperation" class="dropdown-menu"></div>
                </div>
                <div id="selected-kooperation-display" class="selected-item-display"></div>
                <div id="video-limit-info" class="video-limit-info"></div>
              </div>

              <div class="form-field">
                <label>Titel *</label>
                <input 
                  type="text" 
                  id="new-video-titel" 
                  class="form-input" 
                  placeholder="z.B. Hook/Intro" 
                  required
                />
              </div>

              <div class="form-field">
                <label>Content Art</label>
                <select id="new-video-content-art" class="form-input">
                  <option value="">– bitte wählen –</option>
                  <option value="Paid">Paid</option>
                  <option value="Organisch">Organisch</option>
                  <option value="Influencer">Influencer</option>
                  <option value="Videograph">Videograph</option>
                  <option value="Whitelisting">Whitelisting</option>
                  <option value="Spark-Ad">Spark-Ad</option>
                </select>
              </div>

              <div class="drawer-actions">
                <button type="submit" id="btn-create-video" class="primary-btn">
                  Video anlegen & verknüpfen
                </button>
              </div>
            </form>
          ` : `
            <div class="add-to-video-empty">
              <p>Keine Kooperationen in dieser Kampagne.</p>
              <p class="hint">Erstellen Sie zuerst eine Kooperation in der Kampagne.</p>
            </div>
          `}
        </div>
      `}
    `;
  }

  /**
   * Vorschau-Box rendern
   */
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

  /**
   * Video-Optionen gruppiert nach Kooperation rendern
   */
  renderVideoOptions() {
    // Videos nach Kooperation gruppieren
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

  /**
   * Events binden
   */
  bindEvents() {
    // Mode Toggle
    document.querySelectorAll('input[name="video-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.selectedMode = e.target.value;
        this.updateModeView();
      });
    });

    // Video-Dropdown
    const selectVideo = document.getElementById('select-video');
    if (selectVideo) {
      selectVideo.addEventListener('change', (e) => {
        this.selectedVideoId = e.target.value || null;
        const btn = document.getElementById('btn-link-existing');
        if (btn) btn.disabled = !this.selectedVideoId;
      });
    }

    // Link Button (bestehendes Video)
    const btnLink = document.getElementById('btn-link-existing');
    if (btnLink) {
      btnLink.addEventListener('click', () => this.handleLinkExisting());
    }

    // Kooperation Auto-Suggest
    this.setupKooperationAutoSuggest();

    // Neues Video Form
    const form = document.getElementById('form-new-video');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleCreateNew();
      });
    }
  }

  /**
   * Mode-Ansicht aktualisieren
   */
  updateModeView() {
    // Toggle-Buttons aktualisieren
    document.querySelectorAll('.toggle-option').forEach(opt => {
      const radio = opt.querySelector('input[type="radio"]');
      opt.classList.toggle('active', radio?.checked);
    });

    // Sections ein-/ausblenden
    const sectionExisting = document.getElementById('section-existing');
    const sectionNew = document.getElementById('section-new');
    
    if (sectionExisting) {
      sectionExisting.classList.toggle('active', this.selectedMode === 'existing');
    }
    if (sectionNew) {
      sectionNew.classList.toggle('active', this.selectedMode === 'new');
    }
  }

  /**
   * Kooperation Auto-Suggest einrichten
   */
  setupKooperationAutoSuggest() {
    const input = document.getElementById('as-kooperation');
    const dropdown = document.getElementById('asdd-kooperation');
    const displayDiv = document.getElementById('selected-kooperation-display');
    const limitInfo = document.getElementById('video-limit-info');

    if (!input || !dropdown || !displayDiv) return;

    let debounceTimer;

    const renderDropdown = (items) => {
      if (!items || items.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item no-results">Keine Kooperationen gefunden</div>';
        dropdown.style.display = 'block';
        return;
      }

      dropdown.innerHTML = items.map(item => {
        const creatorName = item.creator 
          ? `${item.creator.vorname || ''} ${item.creator.nachname || ''}`.trim() 
          : 'Kein Creator';
        return `
          <div class="dropdown-item" data-id="${item.id}" data-name="${this.escapeHtml(item.name)}">
            <div class="dropdown-item-title">${this.escapeHtml(item.name)}</div>
            <div class="dropdown-item-subtitle">Creator: ${this.escapeHtml(creatorName)}</div>
          </div>
        `;
      }).join('');
      dropdown.style.display = 'block';
    };

    const filterKooperationen = (query) => {
      if (!query) return this.kooperationen;
      const q = query.toLowerCase();
      return this.kooperationen.filter(k => 
        k.name?.toLowerCase().includes(q) ||
        k.creator?.vorname?.toLowerCase().includes(q) ||
        k.creator?.nachname?.toLowerCase().includes(q)
      );
    };

    // Focus: alle anzeigen
    input.addEventListener('focus', () => {
      renderDropdown(this.kooperationen);
    });

    // Blur: Dropdown ausblenden
    input.addEventListener('blur', () => {
      setTimeout(() => { dropdown.style.display = 'none'; }, 200);
    });

    // Input: filtern
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const filtered = filterKooperationen(input.value.trim());
        renderDropdown(filtered);
      }, 150);
    });

    // Klick auf Item
    dropdown.addEventListener('click', async (e) => {
      const item = e.target.closest('.dropdown-item[data-id]');
      if (!item) return;

      const koopId = item.dataset.id;
      const koopName = item.dataset.name;

      this.selectedKooperationId = koopId;

      // Anzeigen
      displayDiv.innerHTML = `
        <div class="selected-item-badge">
          <span>${this.escapeHtml(koopName)}</span>
          <button type="button" class="badge-remove-btn">✕</button>
        </div>
      `;

      input.value = '';
      dropdown.style.display = 'none';

      // Video-Limit prüfen
      await this.checkVideoLimit(koopId, limitInfo);

      // Remove-Button
      displayDiv.querySelector('.badge-remove-btn')?.addEventListener('click', () => {
        this.selectedKooperationId = null;
        displayDiv.innerHTML = '';
        limitInfo.innerHTML = '';
      });
    });
  }

  /**
   * Video-Limit prüfen
   */
  async checkVideoLimit(kooperationId, limitInfoElement) {
    if (!limitInfoElement) return;

    try {
      const koop = this.kooperationen.find(k => k.id === kooperationId);
      const videoLimit = parseInt(koop?.videoanzahl, 10) || 0;

      // Existierende Videos zählen
      const { data: existing } = await window.supabase
        .from('kooperation_videos')
        .select('id')
        .eq('kooperation_id', kooperationId);

      const uploaded = (existing || []).length;
      const remaining = Math.max(0, videoLimit - uploaded);
      const limitReached = videoLimit > 0 && uploaded >= videoLimit;

      if (limitReached) {
        limitInfoElement.innerHTML = `
          <div class="video-limit-message video-limit-error">
            ⚠️ Videolimit erreicht (${uploaded}/${videoLimit})
          </div>
        `;
      } else if (videoLimit > 0) {
        limitInfoElement.innerHTML = `
          <div class="video-limit-message video-limit-success">
            ✓ ${remaining} von ${videoLimit} noch verfügbar
          </div>
        `;
      } else {
        limitInfoElement.innerHTML = `
          <div class="video-limit-message video-limit-muted">
            ${uploaded} Video(s) erstellt (kein Limit)
          </div>
        `;
      }
    } catch (error) {
      console.error('❌ Fehler beim Prüfen des Videolimits:', error);
    }
  }

  /**
   * Bestehendes Video verknüpfen
   */
  async handleLinkExisting() {
    if (!this.selectedVideoId || !this.item?.id) return;

    const btn = document.getElementById('btn-link-existing');
    const originalText = btn?.innerHTML;

    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'Verknüpfe...';
      }

      // Video mit Item verknüpfen
      const { error } = await window.supabase
        .from('kooperation_videos')
        .update({ strategie_item_id: this.item.id })
        .eq('id', this.selectedVideoId);

      if (error) throw error;

      window.toastSystem?.show('Idee erfolgreich mit Video verknüpft!', 'success');

      // Event dispatchen
      window.dispatchEvent(new CustomEvent('strategieItemLinked', {
        detail: { itemId: this.item.id, videoId: this.selectedVideoId }
      }));

      this.close();

    } catch (error) {
      console.error('❌ Fehler beim Verknüpfen:', error);
      window.toastSystem?.show('Fehler beim Verknüpfen', 'error');
      
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  }

  /**
   * Neues Video anlegen und verknüpfen
   */
  async handleCreateNew() {
    if (!this.selectedKooperationId || !this.item?.id) {
      window.toastSystem?.show('Bitte wählen Sie eine Kooperation aus', 'warning');
      return;
    }

    const titel = document.getElementById('new-video-titel')?.value?.trim();
    if (!titel) {
      window.toastSystem?.show('Bitte geben Sie einen Titel ein', 'warning');
      return;
    }

    const btn = document.getElementById('btn-create-video');
    const originalText = btn?.innerHTML;

    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'Erstelle...';
      }

      // Nächste Position ermitteln
      const { data: lastVideo } = await window.supabase
        .from('kooperation_videos')
        .select('position')
        .eq('kooperation_id', this.selectedKooperationId)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = lastVideo && lastVideo.length > 0 
        ? (lastVideo[0].position || 0) + 1 
        : 1;

      // Video erstellen mit strategie_item_id
      const contentArt = document.getElementById('new-video-content-art')?.value || null;

      const videoData = {
        kooperation_id: this.selectedKooperationId,
        titel: titel,
        content_art: contentArt,
        status: 'produktion',
        position: nextPosition,
        strategie_item_id: this.item.id  // Automatische Verknüpfung!
      };

      const { data: newVideo, error } = await window.supabase
        .from('kooperation_videos')
        .insert([videoData])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Video erstellt und verknüpft:', newVideo);
      window.toastSystem?.show('Video erfolgreich erstellt und verknüpft!', 'success');

      // Events dispatchen
      window.dispatchEvent(new CustomEvent('videoCreated', {
        detail: { kooperationId: this.selectedKooperationId, videoId: newVideo.id }
      }));
      window.dispatchEvent(new CustomEvent('strategieItemLinked', {
        detail: { itemId: this.item.id, videoId: newVideo.id }
      }));

      this.close();

    } catch (error) {
      console.error('❌ Fehler beim Erstellen:', error);
      window.toastSystem?.show('Fehler beim Erstellen des Videos', 'error');
      
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  }

  /**
   * Drawer schließen
   */
  close() {
    const panel = document.getElementById(this.drawerId);
    if (panel) {
      panel.classList.remove('show');
      setTimeout(() => this.removeDrawer(), 250);
    } else {
      this.removeDrawer();
    }
  }

  /**
   * Drawer entfernen
   */
  removeDrawer() {
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
    document.getElementById(this.drawerId)?.remove();
  }

  /**
   * HTML escapen
   */
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




