// VideoCreateDrawer.js - Drawer für Video-Erstellung auf Kampagnen-Detailseite
// Ermöglicht das schnelle Anlegen von Videos mit Kooperations-Auswahl

export class VideoCreateDrawer {
  constructor() {
    this.drawerId = 'video-create-drawer';
    this.kampagneId = null;
    this.selectedKooperationId = null;
    this.kooperationData = null;
  }

  async open(kampagneId) {
    this.kampagneId = kampagneId;
    this.selectedKooperationId = null;
    this.kooperationData = null;

    try {
      await this.createDrawer();
      await this.renderForm();
      this.bindEvents();
    } catch (error) {
      console.error('❌ Fehler beim Öffnen des Video-Drawers:', error);
      this.showError('Fehler beim Öffnen des Formulars.');
    }
  }

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
    title.textContent = 'Video anlegen';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = 'Neues Video für eine Kooperation dieser Kampagne erstellen';
    
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

  async renderForm() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    const formHtml = `
      <form id="video-create-form" class="entity-form">
        <div class="form-grid">
          <!-- Kooperation Auswahl mit Auto-Suggestion -->
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
            <input type="hidden" id="selected-kooperation-id" name="kooperation_id" />
            <div id="selected-kooperation-display" class="selected-kooperation-display"></div>
            <div id="video-limit-info" class="video-limit-info"></div>
          </div>

          <!-- Titel -->
          <div class="form-field">
            <label>Titel *</label>
            <input 
              type="text" 
              id="video-titel" 
              name="titel" 
              class="form-input" 
              placeholder="z. B. Hook/Intro" 
              required 
            />
          </div>

          <!-- Content Art -->
          <div class="form-field">
            <label>Content Art</label>
            <select id="video-content-art" name="content_art" class="form-input">
              <option value="">– bitte wählen –</option>
              <option value="Paid">Paid</option>
              <option value="Organisch">Organisch</option>
              <option value="Influencer">Influencer</option>
              <option value="Videograph">Videograph</option>
            </select>
          </div>

          <!-- Asset URL -->
          <div class="form-field">
            <label>Asset URL</label>
            <input 
              type="url" 
              id="video-asset-url" 
              name="asset_url" 
              class="form-input" 
              placeholder="https://..." 
            />
          </div>
        </div>

        <!-- Form Actions -->
        <div class="form-actions">
          <button type="button" id="btn-cancel-video" class="secondary-btn">
            Abbrechen
          </button>
          <button type="submit" id="btn-submit-video" class="primary-btn" disabled>
            Video anlegen
          </button>
        </div>
      </form>
    `;

    body.innerHTML = formHtml;
  }

  bindEvents() {
    // Auto-Suggestion für Kooperationen
    this.setupAutoSuggestion();

    // Form Submit
    const form = document.getElementById('video-create-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSubmit();
      });
    }

    // Cancel Button
    const cancelBtn = document.getElementById('btn-cancel-video');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.close());
    }
  }

  setupAutoSuggestion() {
    const input = document.getElementById('as-kooperation');
    const dropdown = document.getElementById('asdd-kooperation');
    const hiddenInput = document.getElementById('selected-kooperation-id');
    const displayDiv = document.getElementById('selected-kooperation-display');
    const submitBtn = document.getElementById('btn-submit-video');
    const limitInfo = document.getElementById('video-limit-info');

    if (!input || !dropdown || !hiddenInput || !displayDiv) return;

    let debounceTimer;

    const renderDropdown = (items, query) => {
      if (!items || items.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item no-results">Keine Kooperationen gefunden</div>';
        dropdown.style.display = 'block';
        return;
      }

      dropdown.innerHTML = items.map(item => {
        const creatorName = item.creator 
          ? `${item.creator.vorname || ''} ${item.creator.nachname || ''}`.trim() 
          : 'Unbekannt';
        return `
          <div class="dropdown-item" data-id="${item.id}" data-name="${this.escapeHtml(item.name)}" data-creator="${this.escapeHtml(creatorName)}">
            <div class="dropdown-item-title">${this.escapeHtml(item.name)}</div>
            <div class="dropdown-item-subtitle">Creator: ${this.escapeHtml(creatorName)}</div>
          </div>
        `;
      }).join('');
      dropdown.style.display = 'block';
    };

    const loadKooperationen = async (query) => {
      try {
        let supabaseQuery = window.supabase
          .from('kooperationen')
          .select('id, name, videoanzahl, creator:creator_id(id, vorname, nachname)')
          .eq('kampagne_id', this.kampagneId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (query && query.length > 0) {
          supabaseQuery = supabaseQuery.ilike('name', `%${query}%`);
        }

        const { data: kooperationen, error } = await supabaseQuery;
        
        if (error) throw error;
        if (!kooperationen || kooperationen.length === 0) return [];

        // Lade für jede Kooperation die Anzahl der existierenden Videos
        const koopIds = kooperationen.map(k => k.id);
        const { data: videos, error: videoError } = await window.supabase
          .from('kooperation_videos')
          .select('id, kooperation_id')
          .in('kooperation_id', koopIds);

        if (videoError) {
          console.error('❌ Fehler beim Laden der Videos:', videoError);
          return kooperationen; // Fallback: zeige alle Kooperationen
        }

        // Zähle Videos pro Kooperation
        const videoCounts = {};
        (videos || []).forEach(v => {
          videoCounts[v.kooperation_id] = (videoCounts[v.kooperation_id] || 0) + 1;
        });

        // Filtere Kooperationen: Nur die mit verfügbaren Slots
        const availableKooperationen = kooperationen.filter(koop => {
          const videoLimit = parseInt(koop.videoanzahl, 10) || 0;
          const existingCount = videoCounts[koop.id] || 0;
          
          // Wenn kein Limit gesetzt (0), immer anzeigen
          // Sonst nur wenn noch Slots frei sind
          return videoLimit === 0 || existingCount < videoLimit;
        });

        return availableKooperationen.slice(0, 20); // Max 20 Ergebnisse
      } catch (error) {
        console.error('❌ Fehler beim Laden der Kooperationen:', error);
        return [];
      }
    };

    // Focus Event - zeige alle Kooperationen
    input.addEventListener('focus', async () => {
      const items = await loadKooperationen('');
      renderDropdown(items, '');
    });

    // Blur Event - verstecke Dropdown verzögert
    input.addEventListener('blur', () => {
      setTimeout(() => {
        dropdown.style.display = 'none';
      }, 200);
    });

    // Input Event - Suche
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const query = input.value.trim();
        const items = await loadKooperationen(query);
        renderDropdown(items, query);
      }, 300);
    });

    // Dropdown Click - Auswahl
    dropdown.addEventListener('click', async (e) => {
      const item = e.target.closest('.dropdown-item[data-id]');
      if (!item) return;

      const koopId = item.dataset.id;
      const koopName = item.dataset.name;
      const creatorName = item.dataset.creator;

      // Speichere Auswahl
      this.selectedKooperationId = koopId;
      hiddenInput.value = koopId;

      // Zeige ausgewählte Kooperation
      displayDiv.innerHTML = `
        <div class="selected-kooperation-badge">
          <span class="badge-name">${this.escapeHtml(koopName)}</span>
          <button type="button" id="btn-remove-kooperation" class="badge-remove-btn">
            ✕
          </button>
        </div>
      `;

      // Clear input
      input.value = '';
      dropdown.style.display = 'none';

      // Enable submit button
      if (submitBtn) {
        submitBtn.disabled = false;
      }

      // Video-Limit prüfen und anzeigen
      await this.checkVideoLimit(koopId, limitInfo);

      // Remove-Button Event
      const removeBtn = document.getElementById('btn-remove-kooperation');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          this.selectedKooperationId = null;
          hiddenInput.value = '';
          displayDiv.innerHTML = '';
          limitInfo.innerHTML = '';
          if (submitBtn) {
            submitBtn.disabled = true;
          }
        });
      }
    });
  }

  async checkVideoLimit(kooperationId, limitInfoElement) {
    try {
      // Lade Kooperation mit videoanzahl
      const { data: koop, error: koopError } = await window.supabase
        .from('kooperationen')
        .select('videoanzahl')
        .eq('id', kooperationId)
        .single();

      if (koopError) throw koopError;

      const videoLimit = parseInt(koop?.videoanzahl, 10) || 0;

      // Lade existierende Videos
      const { data: existing, error: videoError } = await window.supabase
        .from('kooperation_videos')
        .select('id')
        .eq('kooperation_id', kooperationId);

      if (videoError) throw videoError;

      const uploaded = (existing || []).length;
      const remaining = Math.max(0, videoLimit - uploaded);
      const limitReached = videoLimit > 0 && uploaded >= videoLimit;

      this.kooperationData = {
        videoLimit,
        uploaded,
        remaining,
        limitReached
      };

      // Zeige Info
      if (limitReached) {
        limitInfoElement.innerHTML = `
          <div class="video-limit-message video-limit-error">
            ⚠️ Videolimit erreicht (${uploaded}/${videoLimit}). Keine weiteren Videos möglich.
          </div>
        `;
        // Disable submit
        const submitBtn = document.getElementById('btn-submit-video');
        if (submitBtn) {
          submitBtn.disabled = true;
        }
      } else if (videoLimit > 0) {
        limitInfoElement.innerHTML = `
          <div class="video-limit-message video-limit-success">
            ✓ ${remaining} von ${videoLimit} Videos noch verfügbar (${uploaded} bereits erstellt)
          </div>
        `;
      } else {
        limitInfoElement.innerHTML = `
          <div class="video-limit-message video-limit-muted">
            Kein Videolimit festgelegt (${uploaded} Videos bereits erstellt)
          </div>
        `;
      }
    } catch (error) {
      console.error('❌ Fehler beim Prüfen des Videolimits:', error);
      limitInfoElement.innerHTML = `
        <div class="video-limit-message video-limit-error">
          Fehler beim Prüfen des Videolimits
        </div>
      `;
    }
  }

  async handleSubmit() {
    const submitBtn = document.getElementById('btn-submit-video');
    
    try {
      // Validierung
      if (!this.selectedKooperationId) {
        this.showError('Bitte wählen Sie eine Kooperation aus.');
        return;
      }

      const titel = document.getElementById('video-titel')?.value?.trim();
      if (!titel) {
        this.showError('Bitte geben Sie einen Titel ein.');
        return;
      }

      // Video-Limit prüfen
      if (this.kooperationData?.limitReached) {
        this.showError('Das Videolimit für diese Kooperation wurde bereits erreicht.');
        return;
      }

      // Loading State
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Wird erstellt...';
      }

      // Nächste Position berechnen
      const { data: lastVideo } = await window.supabase
        .from('kooperation_videos')
        .select('position')
        .eq('kooperation_id', this.selectedKooperationId)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = lastVideo && lastVideo.length > 0 
        ? (lastVideo[0].position || 0) + 1 
        : 1;

      // Video erstellen
      const contentArt = document.getElementById('video-content-art')?.value || null;
      const assetUrl = document.getElementById('video-asset-url')?.value?.trim() || null;

      const videoData = {
        kooperation_id: this.selectedKooperationId,
        titel: titel,
        content_art: contentArt,
        asset_url: assetUrl,
        status: 'produktion',
        position: nextPosition
      };

      const { data: newVideo, error } = await window.supabase
        .from('kooperation_videos')
        .insert([videoData])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Video erfolgreich erstellt:', newVideo);

      // Success
      this.showSuccess('Video erfolgreich erstellt!');

      // Event dispatchen für Live-Update
      window.dispatchEvent(new CustomEvent('videoCreated', {
        detail: {
          kooperationId: this.selectedKooperationId,
          videoId: newVideo.id
        }
      }));

      // Drawer nach kurzer Verzögerung schließen
      setTimeout(() => {
        this.close();
      }, 1500);

    } catch (error) {
      console.error('❌ Fehler beim Erstellen des Videos:', error);
      this.showError('Fehler beim Erstellen des Videos: ' + (error.message || 'Unbekannter Fehler'));
      
      // Reset Button
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Video anlegen';
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
    const overlay = document.getElementById(`${this.drawerId}-overlay`);
    const panel = document.getElementById(this.drawerId);
    if (overlay) overlay.remove();
    if (panel) panel.remove();
  }

  showLoading() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (body) {
      body.innerHTML = '<div class="drawer-loading-state">Lädt...</div>';
    }
  }

  showError(message) {
    if (window.notificationSystem?.error) {
      window.notificationSystem.error(message);
    } else {
      alert(message);
    }
  }

  showSuccess(message) {
    if (window.notificationSystem?.success) {
      window.notificationSystem.success(message);
    } else {
      alert(message);
    }
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



