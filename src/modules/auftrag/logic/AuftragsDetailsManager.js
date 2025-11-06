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
      
      console.log('🎯 AUFTRAGSDETAILSMANAGER: Rendere Form');
      this.renderForm(auftragId, auftragBasis, details);
      console.log('🎯 AUFTRAGSDETAILSMANAGER: Binde Events');
      this.bindFormEvents(auftragId);
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
    closeBtn.className = 'drawer-close';
    closeBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    `;
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

  renderForm(auftragId, basisDaten, details) {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    const getValue = (obj, key, fallback = '') => {
      if (!obj) return fallback;
      return obj[key] ?? fallback;
    };

    body.innerHTML = `
      <div class="auftrag-details-layout">
        <form id="auftrag-details-form" data-auftrag-id="${auftragId}" class="auftrag-details-form">
          <input type="hidden" name="auftrag_id" value="${auftragId}">


          ${this.renderSection('UGC', details, 'ugc', {
            video_anzahl: { label: 'Gesamt Anzahl Videos', type: 'number' },
            creator_anzahl: { label: 'Gesamt Anzahl Creator', type: 'number' },
            budget_info: { label: 'Budget & Informationen', type: 'textarea' }
          })}

          ${this.renderSection('Influencer', details, 'influencer', {
            video_anzahl: { label: 'Gesamt Anzahl Videos', type: 'number' },
            creator_anzahl: { label: 'Gesamt Anzahl Creator', type: 'number' },
            budget_info: { label: 'Budget & Informationen', type: 'textarea' }
          })}

          ${this.renderSection('Vor Ort Dreh', details, 'vor_ort', {
            video_anzahl: { label: 'Gesamt Anzahl Videos', type: 'number' },
            creator_anzahl: { label: 'Gesamt Anzahl Creator', type: 'number' },
            videographen_anzahl: { label: 'Gesamt Anzahl Videographen', type: 'number' },
            budget_info: { label: 'Budget & Informationen', type: 'textarea' }
          })}

          ${this.renderSection('Vor Ort Dreh Mitarbeiter', details, 'vor_ort_mitarbeiter', {
            video_anzahl: { label: 'Gesamt Anzahl Videos', type: 'number' },
            videographen_anzahl: { label: 'Gesamt Anzahl Videographen', type: 'number' },
            budget_info: { label: 'Budget & Informationen', type: 'textarea' }
          })}

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

          <div class="drawer-actions">
            <button type="submit" class="primary-btn">Details speichern</button>
            <button type="button" class="secondary-btn" data-close>Abbrechen</button>
          </div>
        </form>
      </div>
    `;
  }

  renderSection(title, details, keyPrefix, fields) {
    const inputs = Object.entries(fields).map(([key, config]) => {
      const name = `${keyPrefix}_${key}`;
      const value = details?.[name] ?? '';
      if (config.type === 'textarea') {
        return `
          <div class="form-field">
            <label for="${name}">${config.label}</label>
            <textarea name="${name}" rows="3">${value || ''}</textarea>
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

  bindFormEvents(auftragId) {
    const form = document.getElementById('auftrag-details-form');
    if (!form) return;

    const inputs = form.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
      input.addEventListener('input', () => this.updateSummaryFields(form));
    });

    form.querySelector('[data-close]')?.addEventListener('click', () => this.close());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit(form, auftragId);
    });

    this.updateSummaryFields(form);
  }

  updateSummaryFields(form) {
    // Videos berechnen
    const videoFields = [
      'ugc_video_anzahl',
      'influencer_video_anzahl',
      'vor_ort_video_anzahl',
      'vor_ort_mitarbeiter_video_anzahl'
    ];

    const totalVideos = videoFields.reduce((acc, name) => {
      const value = parseInt(form.querySelector(`[name="${name}"]`)?.value || '0', 10);
      return acc + (isNaN(value) ? 0 : value);
    }, 0);

    const videosTarget = form.querySelector('[name="gesamt_videos"]');
    if (videosTarget) {
      videosTarget.value = totalVideos;
    }

    // Creator berechnen
    const creatorFields = [
      'ugc_creator_anzahl',
      'influencer_creator_anzahl',
      'vor_ort_creator_anzahl'
      // vor_ort_mitarbeiter hat keine Creator, sondern nur Videographen
    ];

    const totalCreator = creatorFields.reduce((acc, name) => {
      const value = parseInt(form.querySelector(`[name="${name}"]`)?.value || '0', 10);
      return acc + (isNaN(value) ? 0 : value);
    }, 0);

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


