export class AuftragsDetailsManager {
  constructor() {
    this.drawerId = 'auftrag-details-drawer';
    this.bindEvents();
  }

  // Event-basierte Kommunikation
  bindEvents() {
    document.addEventListener('actionRequested', (event) => {
      const { action, entityType, entityId } = event.detail;
      
      if (action === 'showDetails' && entityType === 'auftrag') {
        console.log('🎯 AUFTRAGSDETAILSMANAGER: Event empfangen für ID:', entityId);
        this.open(entityId);
      }
    });
  }

  async openForEdit(auftragsdetailsId) {
    console.log('🎯 AUFTRAGSDETAILSMANAGER: openForEdit() aufgerufen mit auftragsdetails-ID:', auftragsdetailsId);
    
    try {
      // Lade die auftragsdetails um die auftrag_id zu bekommen
      const { data, error } = await window.supabase
        .from('auftrag_details')
        .select('auftrag_id')
        .eq('id', auftragsdetailsId)
        .single();
      
      if (error || !data) {
        console.error('❌ Fehler beim Laden der auftragsdetails:', error);
        window.notificationSystem?.show('Fehler beim Laden der Auftragsdetails', 'error');
        return;
      }
      
      // Öffne den Drawer mit der auftrag_id
      await this.open(data.auftrag_id);
    } catch (error) {
      console.error('❌ AuftragsDetailsManager.openForEdit Fehler:', error);
      window.notificationSystem?.show('Fehler beim Öffnen der Auftragsdetails', 'error');
    }
  }

  async open(auftragId) {
    console.log('🎯 AUFTRAGSDETAILSMANAGER: open() aufgerufen mit ID:', auftragId);
    try {
      console.log('🎯 AUFTRAGSDETAILSMANAGER: Erstelle Drawer');
      await this.createDrawer();
      console.log('🎯 AUFTRAGSDETAILSMANAGER: Zeige Loading');
      this.showLoading();

      // Versuche Details zu laden, aber zeige Form auch wenn das fehlschlägt
      let details = null;
      try {
        console.log('🎯 AUFTRAGSDETAILSMANAGER: Lade Details');
        details = await this.loadDetails(auftragId);
        console.log('🎯 AUFTRAGSDETAILSMANAGER: Details geladen:', details);
      } catch (detailError) {
        console.warn('⚠️ Konnte Details nicht laden, zeige leeres Formular:', detailError);
      }

      console.log('🎯 AUFTRAGSDETAILSMANAGER: Lade Auftrag-Basis');
      const auftragBasis = await this.loadAuftrag(auftragId);
      console.log('🎯 AUFTRAGSDETAILSMANAGER: Auftrag-Basis geladen:', auftragBasis);
      
      // Lade Kampagnenarten für dynamische Feldgenerierung
      console.log('🎯 AUFTRAGSDETAILSMANAGER: Lade Kampagnenarten');
      const kampagnenarten = await this.loadKampagnenartenForAuftrag(auftragId);
      console.log('🎯 AUFTRAGSDETAILSMANAGER: Kampagnenarten geladen:', kampagnenarten);
      
      console.log('🎯 AUFTRAGSDETAILSMANAGER: Rendere Form');
      await this.renderForm(auftragId, auftragBasis, details, kampagnenarten);
      console.log('🎯 AUFTRAGSDETAILSMANAGER: Binde Events');
      this.bindFormEvents(auftragId, kampagnenarten);
      console.log('🎯 AUFTRAGSDETAILSMANAGER: Drawer sollte jetzt sichtbar sein');
    } catch (error) {
      console.error('❌ AuftragsDetailsManager.open Fehler:', error);
      this.showError('Fehler beim Laden der Auftragsdetails.');
    }
  }

  async createDrawer() {
    // Entferne existierendes Drawer falls vorhanden
    this.removeDrawer();

    // Erstelle Overlay
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;
    
    // Erstelle Panel
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
    title.textContent = 'Auftragsdetails anlegen';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = 'Ergänzen Sie detaillierte Produktionsinformationen';
    
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

    // Slide-in Animation nach kurzer Verzögerung
    requestAnimationFrame(() => {
      panel.classList.add('show');
    });
  }

  close() {
    const panel = document.getElementById(this.drawerId);
    if (panel) {
      panel.classList.remove('show');
      // Nach Animation entfernen
      setTimeout(() => this.removeDrawer(), 250);
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
    if (!body) return;
    body.innerHTML = '<div class="drawer-loading">Lade Auftragsdetails...</div>';
  }

  showError(message) {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;
    body.innerHTML = `<div class="alert alert-danger">${message}</div>`;
  }

  showSuccess(message) {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;
    const alert = document.createElement('div');
    alert.className = 'alert alert-success';
    alert.textContent = message;
    body.insertBefore(alert, body.firstChild);
  }

  async loadAuftrag(auftragId) {
    if (!window.supabase) return {};
    const { data, error } = await window.supabase
      .from('auftrag')
      .select(`id, auftragsname, kampagnenanzahl, unternehmen:unternehmen_id(firmenname), marke:marke_id(markenname), ansprechpartner:ansprechpartner_id(vorname, nachname, email)`)
      .eq('id', auftragId)
      .single();
    if (error) throw error;
    return data || {};
  }

  async loadDetails(auftragId) {
    if (!window.supabase) return null;
    
    try {
      const { data, error } = await window.supabase
        .from('auftrag_details')
        .select('*')
        .eq('auftrag_id', auftragId)
        .maybeSingle();
      
      if (error) {
        console.warn('⚠️ Fehler beim Laden der auftrag_details:', error);
        // Bei 406 oder anderen Fehlern null zurückgeben statt zu werfen
        if (error.code === 'PGRST116' || error.status === 406) {
          return null;
        }
        throw error;
      }
      
      return data || null;
    } catch (error) {
      console.warn('⚠️ Fehler beim Laden der auftrag_details:', error);
      return null; // Graceful fallback
    }
  }

  /**
   * Lädt die Kampagnenarten für einen Auftrag
   * PRIMÄR: Aus der auftrag_kampagne_art Junction-Tabelle (direkt am Auftrag hinterlegt)
   * FALLBACK: Aus den zugehörigen Kampagnen
   * @param {string} auftragId - ID des Auftrags
   * @returns {Promise<string[]>} - Array der eindeutigen Kampagnenarten-Namen
   */
  async loadKampagnenartenForAuftrag(auftragId) {
    if (!window.supabase) return [];
    
    try {
      const artenSet = new Set();
      
      // PRIMÄR: Lade Kampagnenarten direkt vom Auftrag (über auftrag_kampagne_art Junction)
      const { data: auftragArten, error: auftragError } = await window.supabase
        .from('auftrag_kampagne_art')
        .select(`
          kampagne_art_typen:kampagne_art_id(id, name)
        `)
        .eq('auftrag_id', auftragId);
      
      if (auftragError) {
        console.warn('⚠️ Fehler beim Laden der Auftrag-Kampagnenarten:', auftragError);
      } else {
        (auftragArten || []).forEach(item => {
          if (item.kampagne_art_typen?.name) {
            artenSet.add(item.kampagne_art_typen.name);
          }
        });
      }
      
      // Falls vom Auftrag Kampagnenarten gefunden wurden, diese verwenden
      if (artenSet.size > 0) {
        console.log('📋 Kampagnenarten aus Auftrag geladen:', Array.from(artenSet));
        return Array.from(artenSet);
      }
      
      // FALLBACK: Lade aus den Kampagnen (für Abwärtskompatibilität)
      console.log('ℹ️ Keine Kampagnenarten im Auftrag, prüfe Kampagnen...');
      const { data: kampagnen, error: kampError } = await window.supabase
        .from('kampagne')
        .select(`
          id,
          kampagne_art_typen:art_der_kampagne(id, name)
        `)
        .eq('auftrag_id', auftragId);
      
      if (kampError) {
        console.error('❌ Fehler beim Laden der Kampagnen:', kampError);
        return [];
      }
      
      (kampagnen || []).forEach(kampagne => {
        const arten = kampagne.kampagne_art_typen;
        if (Array.isArray(arten)) {
          arten.forEach(art => {
            if (art?.name) artenSet.add(art.name);
          });
        } else if (arten?.name) {
          artenSet.add(arten.name);
        }
      });
      
      console.log('📋 Kampagnenarten aus Kampagnen geladen:', Array.from(artenSet));
      return Array.from(artenSet);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Kampagnenarten:', error);
      return [];
    }
  }

  async renderForm(auftragId, basisDaten, details, kampagnenarten = []) {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    // Importiere das Mapping
    let KAMPAGNENARTEN_MAPPING = {};
    try {
      const module = await import('/src/modules/auftrag/logic/KampagnenartenMapping.js');
      KAMPAGNENARTEN_MAPPING = module.KAMPAGNENARTEN_MAPPING;
    } catch (e) {
      console.error('❌ Fehler beim Laden des Kampagnenarten-Mappings:', e);
    }

    // Generiere dynamische Sections basierend auf Kampagnenarten
    let sectionsHtml = '';
    
    if (kampagnenarten.length === 0) {
      sectionsHtml = `
        <div class="alert alert-info">
          <p>Keine Kampagnen für diesen Auftrag gefunden.</p>
          <p>Erstellen Sie zuerst eine Kampagne mit einer Kampagnenart, um hier die entsprechenden Details erfassen zu können.</p>
        </div>
      `;
    } else {
      kampagnenarten.forEach(artName => {
        const config = KAMPAGNENARTEN_MAPPING[artName];
        if (config) {
          sectionsHtml += this.renderDynamicSection(artName, config, details);
        } else {
          console.warn(`⚠️ Unbekannte Kampagnenart: "${artName}"`);
        }
      });
    }

    body.innerHTML = `
      <div class="auftrag-details-layout">
        <form id="auftrag-details-form" data-auftrag-id="${auftragId}" class="auftrag-details-form">
          <input type="hidden" name="auftrag_id" value="${auftragId}">

          ${sectionsHtml}

          ${kampagnenarten.length > 0 ? `
          <div class="detail-summary">
            <div class="summary-grid">
              <div class="summary-item">
                <label>Gesamtanzahl Videos</label>
                <input type="number" name="gesamt_videos" value="${details?.gesamt_videos || ''}" readonly>
              </div>
              <div class="summary-item">
                <label>Gesamtanzahl Creator</label>
                <input type="number" name="gesamt_creator" value="${details?.gesamt_creator || ''}" readonly>
              </div>
            </div>
          </div>
          ` : ''}

          <div class="drawer-actions">
            <button type="button" class="mdc-btn mdc-btn--cancel" data-close>
              <span class="mdc-btn__icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </span>
              <span class="mdc-btn__label">Abbrechen</span>
            </button>
            ${kampagnenarten.length > 0 ? `
            <button type="submit" class="mdc-btn mdc-btn--create">
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
              <span class="mdc-btn__label">Details speichern</span>
            </button>
            ` : ''}
          </div>
        </form>
      </div>
    `;
  }

  /**
   * Rendert eine dynamische Section basierend auf der Kampagnenart-Konfiguration
   * @param {string} artName - Name der Kampagnenart
   * @param {object} config - Konfiguration aus KAMPAGNENARTEN_MAPPING
   * @param {object} details - Bestehende Auftragsdetails
   * @returns {string} HTML der Section
   */
  renderDynamicSection(artName, config, details) {
    const { prefix, hasCreator, hasBilder, hasVideographen, displayName } = config;
    
    let inputsHtml = '';
    
    // Video-Anzahl (readonly - wird von Kampagnen übertragen)
    inputsHtml += `
      <div class="form-field">
        <label for="${prefix}_video_anzahl">Anzahl Videos</label>
        <input type="number" name="${prefix}_video_anzahl" 
               value="${details?.[`${prefix}_video_anzahl`] || ''}" 
               min="0" step="1" readonly style="background-color: #f5f5f5;">
      </div>
    `;
    
    // Creator-Anzahl (readonly - wird von Kampagnen übertragen)
    if (hasCreator) {
      inputsHtml += `
        <div class="form-field">
          <label for="${prefix}_creator_anzahl">Anzahl Creator</label>
          <input type="number" name="${prefix}_creator_anzahl" 
                 value="${details?.[`${prefix}_creator_anzahl`] || ''}" 
                 min="0" step="1" readonly style="background-color: #f5f5f5;">
        </div>
      `;
    }
    
    // Bilder-Anzahl (readonly - wird von Kampagnen übertragen)
    if (hasBilder) {
      inputsHtml += `
        <div class="form-field">
          <label for="${prefix}_bilder_anzahl">Anzahl Bilder</label>
          <input type="number" name="${prefix}_bilder_anzahl" 
                 value="${details?.[`${prefix}_bilder_anzahl`] || ''}" 
                 min="0" step="1" readonly style="background-color: #f5f5f5;">
        </div>
      `;
    }
    
    // Videographen-Anzahl (readonly - wird von Kampagnen übertragen)
    if (hasVideographen) {
      inputsHtml += `
        <div class="form-field">
          <label for="${prefix}_videographen_anzahl">Anzahl Videographen</label>
          <input type="number" name="${prefix}_videographen_anzahl" 
                 value="${details?.[`${prefix}_videographen_anzahl`] || ''}" 
                 min="0" step="1" readonly style="background-color: #f5f5f5;">
        </div>
      `;
    }
    
    // Budget-Info (editierbar)
    inputsHtml += `
      <div class="form-field form-field--full">
        <label for="${prefix}_budget_info">Budget & Informationen</label>
        <textarea name="${prefix}_budget_info" rows="6" class="budget-textarea">${details?.[`${prefix}_budget_info`] || ''}</textarea>
      </div>
    `;
    
    return `
      <section class="details-section" data-kampagnenart="${artName}" data-prefix="${prefix}">
        <h3>${displayName}</h3>
        <div class="section-grid">
          ${inputsHtml}
        </div>
      </section>
    `;
  }

  // Legacy renderSection für Abwärtskompatibilität
  renderSection(title, details, keyPrefix, fields) {
    const inputs = Object.entries(fields).map(([key, config]) => {
      const name = `${keyPrefix}_${key}`;
      const value = details?.[name] ?? '';
      if (config.type === 'textarea') {
        return `
          <div class="form-field form-field--full">
            <label for="${name}">${config.label}</label>
            <textarea name="${name}" rows="6" class="budget-textarea">${value || ''}</textarea>
          </div>
        `;
      }
      return `
        <div class="form-field">
          <label for="${name}">${config.label}</label>
          <input type="number" name="${name}" value="${value || ''}" min="0" step="1">
        </div>
      `;
    }).join('');

    return `
      <section class="details-section">
        <h3>${title}</h3>
        <div class="section-grid">
          ${inputs}
        </div>
      </section>
    `;
  }

  formatAnsprechpartner(ansprechpartner) {
    if (!ansprechpartner) return '-';
    const name = [ansprechpartner.vorname, ansprechpartner.nachname].filter(Boolean).join(' ');
    return ansprechpartner.email ? `${name} (${ansprechpartner.email})` : name;
  }

  bindFormEvents(auftragId, kampagnenarten = []) {
    const form = document.getElementById('auftrag-details-form');
    if (!form) return;

    const inputs = form.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
      input.addEventListener('input', () => this.updateSummaryFields(form, kampagnenarten));
    });

    form.querySelector('[data-close]')?.addEventListener('click', () => this.close());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit(form, auftragId);
    });

    this.updateSummaryFields(form, kampagnenarten);
  }

  async updateSummaryFields(form, kampagnenarten = []) {
    // Lade Mapping für dynamische Berechnung
    let KAMPAGNENARTEN_MAPPING = {};
    try {
      const module = await import('/src/modules/auftrag/logic/KampagnenartenMapping.js');
      KAMPAGNENARTEN_MAPPING = module.KAMPAGNENARTEN_MAPPING;
    } catch (e) {
      console.error('❌ Fehler beim Laden des Mappings:', e);
      return;
    }
    
    let totalVideos = 0;
    let totalCreator = 0;
    
    // Berechne Summen dynamisch basierend auf vorhandenen Sections
    const sections = form.querySelectorAll('.details-section[data-prefix]');
    sections.forEach(section => {
      const prefix = section.dataset.prefix;
      
      // Video-Anzahl
      const videoInput = form.querySelector(`[name="${prefix}_video_anzahl"]`);
      if (videoInput) {
        totalVideos += parseInt(videoInput.value || '0', 10) || 0;
      }
      
      // Creator-Anzahl (nur wenn die Kampagnenart Creator hat)
      const creatorInput = form.querySelector(`[name="${prefix}_creator_anzahl"]`);
      if (creatorInput) {
        totalCreator += parseInt(creatorInput.value || '0', 10) || 0;
      }
    });

    const videosTarget = form.querySelector('[name="gesamt_videos"]');
    if (videosTarget) {
      videosTarget.value = totalVideos;
    }

    const creatorTarget = form.querySelector('[name="gesamt_creator"]');
    if (creatorTarget) {
      creatorTarget.value = totalCreator;
    }
  }

  async handleSubmit(form, auftragId) {
    try {
      const formData = new FormData(form);
      const payload = { auftrag_id: auftragId };

      formData.forEach((value, key) => {
        if (key === 'auftrag_id') return;
        if (value === '') {
          payload[key] = null;
        } else if (key.endsWith('_anzahl') || key === 'gesamt_videos' || key === 'gesamt_creator' || key === 'kampagnenanzahl') {
          payload[key] = parseInt(value, 10) || 0;
        } else {
          payload[key] = value;
        }
      });

      if (window.supabase) {
        const { data: existing, error: loadErr } = await window.supabase
          .from('auftrag_details')
          .select('id')
          .eq('auftrag_id', auftragId)
          .maybeSingle();
        if (loadErr && loadErr.code !== 'PGRST116') throw loadErr;

        let error;
        if (existing?.id) {
          ({ error } = await window.supabase
            .from('auftrag_details')
            .update(payload)
            .eq('id', existing.id));
        } else {
          ({ error } = await window.supabase
            .from('auftrag_details')
            .insert(payload));
        }

        if (error) throw error;
      } else if (window.dataService?.createEntity) {
        await window.dataService.createEntity('auftrag_details', payload);
      }

      this.showSuccess('Auftragsdetails gespeichert.');
      setTimeout(() => this.close(), 1200);

      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'auftrag_details', auftrag_id: auftragId, action: 'saved' }
      }));
    } catch (error) {
      console.error('❌ Auftragsdetails speichern fehlgeschlagen:', error);
      this.showError(error.message || 'Speichern fehlgeschlagen.');
    }
  }
}

export const auftragsDetailsManager = new AuftragsDetailsManager();


