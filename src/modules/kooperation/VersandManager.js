export class KooperationVersandManager {
  constructor() {
    this.drawerId = 'kooperation-versand-drawer';
    this.currentKooperationId = null;
    this.isSubmitting = false;
    this.bindGlobalEvents();
  }

  // Event-basierte Kommunikation (globale Events, einmal gebunden)
  bindGlobalEvents() {
    document.addEventListener('actionRequested', (event) => {
      const { action, entityType, entityId } = event.detail;
      
      if (action === 'showVersand' && entityType === 'kooperation') {
        console.log('%c🎯 VERSANDMANAGER: Event empfangen für ID: ' + entityId, 'color: blue; font-weight: bold');
        this.open(entityId);
      }
    });

    // Event-Delegation für Form-Submits (verhindert Page Reload)
    document.addEventListener('submit', (e) => {
      if (e.target.id === 'versand-form') {
        e.preventDefault();
        e.stopPropagation();
        console.log('%c📝 VERSANDMANAGER: Form Submit abgefangen', 'color: green; font-weight: bold');
        const kooperationId = e.target.dataset.kooperationId;
        if (kooperationId && !this.isSubmitting) {
          this.handleSubmit(e.target, kooperationId);
        }
      }
    }, true); // Use capture phase!

    // Event-Delegation für Delete-Buttons
    document.addEventListener('click', async (e) => {
      if (e.target.closest('.btn-delete-versand')) {
        e.preventDefault();
        const btn = e.target.closest('.btn-delete-versand');
        const versandId = btn.dataset.id;
        
        if (confirm('Versand-Eintrag wirklich löschen?')) {
          await this.deleteVersandEintrag(versandId, this.currentKooperationId);
        }
      }
    });

    // Event-Delegation für Abbrechen-Button
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]') && e.target.closest(`#${this.drawerId}`)) {
        e.preventDefault();
        this.close();
      }
    });
  }

  async open(kooperationId) {
    console.log('%c🎯 VERSANDMANAGER: open() aufgerufen mit ID: ' + kooperationId, 'color: blue; font-weight: bold');
    this.currentKooperationId = kooperationId;
    
    // Speichere in LocalStorage für Debugging nach Reload
    localStorage.setItem('versand_debug_last_open', JSON.stringify({
      kooperationId,
      timestamp: new Date().toISOString()
    }));
    
    try {
      console.log('%c🎯 VERSANDMANAGER: Erstelle Drawer', 'color: blue');
      await this.createDrawer();
      this.showLoading();

      console.log('%c🎯 VERSANDMANAGER: Lade Kooperation und Creator-Daten', 'color: blue');
      const kooperationData = await this.loadKooperationData(kooperationId);
      console.log('%c✅ VERSANDMANAGER: Kooperation-Daten geladen', 'color: green', kooperationData);

      // Versuche Versand-Daten zu laden
      let versandDaten = null;
      try {
        versandDaten = await this.loadVersandDaten(kooperationId);
        console.log('%c✅ VERSANDMANAGER: Versand-Daten geladen', 'color: green', versandDaten);
      } catch (detailError) {
        console.warn('⚠️ Konnte Versand-Daten nicht laden, zeige leeres Formular:', detailError);
      }
      
      console.log('%c🎯 VERSANDMANAGER: Rendere Form', 'color: blue');
      await this.renderForm(kooperationId, kooperationData, versandDaten);
      console.log('%c✅ VERSANDMANAGER: Drawer komplett geladen', 'color: green; font-weight: bold');
    } catch (error) {
      console.error('%c❌ VersandManager.open Fehler:', 'color: red; font-weight: bold', error);
      this.showErrorAlert('Fehler beim Laden der Versand-Daten: ' + error.message);
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
    title.textContent = 'Versand-Daten verwalten';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = 'Tracking-Nummer und Versand-Status verwalten';
    
    headerLeft.appendChild(title);
    headerLeft.appendChild(subtitle);
    
    const headerRight = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close';
    closeBtn.textContent = 'Schließen';
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
    body.innerHTML = '<div class="drawer-loading">Lade Versand-Daten...</div>';
  }

  showError(message) {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;
    
    // Entferne alte Alerts
    const oldAlerts = body.querySelectorAll('.alert');
    oldAlerts.forEach(alert => alert.remove());
    
    // Füge neuen Error hinzu
    const alert = document.createElement('div');
    alert.className = 'alert alert-danger';
    alert.style.marginBottom = '1rem';
    alert.textContent = message;
    body.insertBefore(alert, body.firstChild);
    
    // Scroll to top
    body.scrollTop = 0;
  }

  showErrorAlert(message) {
    // Fallback wenn body nicht existiert
    alert(message);
    const body = document.getElementById(`${this.drawerId}-body`);
    if (body) {
      body.innerHTML = `<div class="alert alert-danger">${message}</div>`;
    }
  }

  showSuccess(message) {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;
    
    // Entferne alte Alerts
    const oldAlerts = body.querySelectorAll('.alert');
    oldAlerts.forEach(alert => alert.remove());
    
    // Füge neuen Success hinzu
    const alert = document.createElement('div');
    alert.className = 'alert alert-success';
    alert.style.marginBottom = '1rem';
    alert.textContent = message;
    body.insertBefore(alert, body.firstChild);
    
    // Scroll to top
    body.scrollTop = 0;
  }

  async loadKooperationData(kooperationId) {
    if (!window.supabase) return {};
    const { data, error } = await window.supabase
      .from('kooperationen')
      .select(`
        id, 
        name, 
        creator:creator_id(
          id, vorname, nachname, 
          lieferadresse_strasse, lieferadresse_hausnummer, 
          lieferadresse_plz, lieferadresse_stadt, lieferadresse_land
        )
      `)
      .eq('id', kooperationId)
      .single();
    if (error) throw error;
    return data || {};
  }

  async loadVersandDaten(kooperationId) {
    if (!window.supabase) return [];
    
    try {
      const { data, error } = await window.supabase
        .from('kooperation_versand')
        .select(`
          *,
          creator_adresse:creator_adresse_id(*)
        `)
        .eq('kooperation_id', kooperationId)
        .order('created_at', { ascending: false});
      
      if (error) {
        console.warn('⚠️ Fehler beim Laden der Versand-Daten:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.warn('⚠️ Fehler beim Laden der Versand-Daten:', error);
      return [];
    }
  }

  async renderForm(kooperationId, kooperationData, versandDaten) {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    const creator = kooperationData.creator;
    
    // Lade alle verfügbaren Adressen des Creators
    let creatorAdressen = [];
    try {
      const { data } = await window.supabase
        .from('creator_adressen')
        .select('*')
        .eq('creator_id', creator.id)
        .order('ist_standard', { ascending: false })
        .order('adressname');
      creatorAdressen = data || [];
    } catch (error) {
      console.error('Fehler beim Laden der Creator-Adressen:', error);
    }

    // Adressauswahl-Dropdown erstellen
    const adressOptionen = [
      `<option value="">Hauptadresse (aus Creator-Profil)</option>`,
      ...creatorAdressen.map(adresse => 
        `<option value="${adresse.id}">${adresse.adressname}${adresse.ist_standard ? ' (Standard)' : ''}</option>`
      )
    ].join('');
    
    body.innerHTML = `
      <div class="versand-form-layout">
        <form id="versand-form" data-kooperation-id="${kooperationId}" class="versand-form">
          <input type="hidden" name="kooperation_id" value="${kooperationId}">
          <div class="versand-details-grid">
            <div class="form-field">
                <label for="creator_adresse_id">Lieferadresse auswählen</label>
                <select id="creator_adresse_id" name="creator_adresse_id" class="form-select">
                  ${adressOptionen}
                </select>
                <small class="field-hint">Wählen Sie die Zieladresse für diesen Versand</small>
              </div>
            <div class="form-field">
              <label for="produkt_name">Produktname</label>
              <input type="text" name="produkt_name" placeholder="z.B. Produktpaket, Geschenkbox, etc." required>
            </div>
            <div class="form-field">
              <label for="tracking_nummer">Tracking-Nummer</label>
              <input type="text" name="tracking_nummer" placeholder="z.B. 1Z999AA1234567890">
              <small class="field-hint">Status wird automatisch auf "versendet" gesetzt</small>
            </div>
            <div class="form-field">
              <label for="versand_datum">Versand-Datum</label>
              <input type="date" name="versand_datum">
            </div>
            <div class="form-field">
              <label for="beschreibung">Beschreibung</label>
              <textarea name="beschreibung" rows="2" placeholder="Details zum Produkt...""></textarea>
            </div>
            <div class="form-field form-field-full">
              <label for="notizen">Versand-Notizen</label>
              <textarea name="notizen" rows="2" placeholder="Zusätzliche Notizen zum Versand..."></textarea>
            </div>
          </div>

          <div class="drawer-actions">
            <button type="submit" class="primary-btn" id="versand-submit-btn">
              <span class="btn-label">Produkt hinzufügen</span>
              <span class="btn-loader" style="display: none;">
                <svg class="spinner" width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="50" stroke-dashoffset="0">
                    <animateTransform attributeName="transform" type="rotate" from="0 10 10" to="360 10 10" dur="1s" repeatCount="indefinite"/>
                  </circle>
                </svg>
                Speichere...
              </span>
            </button>
            <button type="button" class="secondary-btn" data-close>Abbrechen</button>
          </div>
        </form>
      </div>
    `;
  }

  // ENTFERNT: Keine lokale Event-Bindung mehr nötig
  // Events werden über globale Event-Delegation in bindGlobalEvents() behandelt

  async handleSubmit(form, kooperationId) {
    // Guard gegen Mehrfach-Submits
    if (this.isSubmitting) {
      console.log('%c⏸️ Submit bereits in Bearbeitung, überspringe', 'color: orange');
      return;
    }

    this.isSubmitting = true;
    const submitBtn = document.getElementById('versand-submit-btn');
    const btnLabel = submitBtn?.querySelector('.btn-label');
    const btnLoader = submitBtn?.querySelector('.btn-loader');

    // Speichere Submit-Versuch in LocalStorage für Debugging
    localStorage.setItem('versand_debug_last_submit', JSON.stringify({
      kooperationId,
      timestamp: new Date().toISOString(),
      formData: Object.fromEntries(new FormData(form))
    }));

    console.log('%c📝 VERSANDMANAGER: handleSubmit START', 'color: purple; font-weight: bold', { kooperationId });

    try {
      // UI: Loading-State
      if (submitBtn) {
        submitBtn.disabled = true;
        if (btnLabel) btnLabel.style.display = 'none';
        if (btnLoader) btnLoader.style.display = 'inline-flex';
      }

      const formData = new FormData(form);
      const payload = { kooperation_id: kooperationId };

      // Pflichtfelder, die nicht null sein dürfen
      const requiredFields = ['produkt_name'];

      formData.forEach((value, key) => {
        if (key === 'kooperation_id') return;
        
        // creator_adresse_id: Leere Auswahl = null (Hauptadresse)
        if (key === 'creator_adresse_id' && value === '') {
          payload[key] = null;
        } 
        // Pflichtfelder: Leeren Wert nicht auf null setzen
        else if (requiredFields.includes(key)) {
          payload[key] = value;
        }
        // Andere Felder: Leeren Wert auf null setzen
        else if (value === '') {
          payload[key] = null;
        } 
        else {
          payload[key] = value;
        }
      });

      // Validierung: produkt_name muss vorhanden sein
      if (!payload.produkt_name || payload.produkt_name.trim() === '') {
        throw new Error('Produktname ist erforderlich.');
      }

      // Automatische Versand-Status-Logik: Tracking-Nummer vorhanden = versendet
      const hasTracking = payload.tracking_nummer && payload.tracking_nummer.trim() !== '';
      payload.versendet = hasTracking;

      console.log('%c📦 VERSANDMANAGER: Versand-Payload:', 'color: blue; font-weight: bold', payload);

      if (window.supabase) {
        // Immer neuen Eintrag erstellen (mehrere Produkte möglich)
        const { data, error } = await window.supabase
          .from('kooperation_versand')
          .insert(payload)
          .select();

        if (error) {
          console.error('%c❌ VERSANDMANAGER: Supabase Insert Fehler', 'color: red; font-weight: bold', error);
          localStorage.setItem('versand_debug_last_error', JSON.stringify({
            error: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            timestamp: new Date().toISOString()
          }));
          throw error;
        }
        console.log('%c✅ VERSANDMANAGER: Versand-Eintrag erstellt', 'color: green; font-weight: bold', data);
        localStorage.setItem('versand_debug_last_success', JSON.stringify({
          data,
          timestamp: new Date().toISOString()
        }));
      } else if (window.dataService?.createEntity) {
        const result = await window.dataService.createEntity('kooperation_versand', payload);
        console.log('%c✅ VERSANDMANAGER: Versand-Eintrag erstellt via DataService', 'color: green; font-weight: bold', result);
      }

      // Erfolg!
      this.showSuccess('✅ Versand-Daten erfolgreich gespeichert!');
      
      // Form zurücksetzen
      form.reset();
      
      // Drawer nach Erfolg schließen
      setTimeout(() => {
        this.close();
      }, 1500);

      // Event für andere Module
      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'kooperation_versand', kooperation_id: kooperationId, action: 'saved' }
      }));

      console.log('%c✅ VERSANDMANAGER: handleSubmit ERFOLGREICH', 'color: green; font-weight: bold');

    } catch (error) {
      console.error('%c❌ VERSANDMANAGER: handleSubmit FEHLER', 'color: red; font-weight: bold', error);
      
      // Detaillierte Fehlermeldung anzeigen
      let errorMessage = '❌ Speichern fehlgeschlagen.';
      if (error.message) {
        errorMessage = `❌ ${error.message}`;
      } else if (error.details) {
        errorMessage = `❌ Datenbankfehler: ${error.details}`;
      } else if (error.hint) {
        errorMessage = `❌ Fehler: ${error.hint}`;
      }
      
      this.showError(errorMessage);

      // UI: Error-State
      if (submitBtn) {
        submitBtn.disabled = false;
        if (btnLabel) btnLabel.style.display = 'inline';
        if (btnLoader) btnLoader.style.display = 'none';
      }

    } finally {
      this.isSubmitting = false;
      
      // UI: Reset nach Erfolg
      if (submitBtn && !submitBtn.disabled) {
        if (btnLabel) btnLabel.style.display = 'inline';
        if (btnLoader) btnLoader.style.display = 'none';
      } else if (submitBtn) {
        // Bei Erfolg: Button nach kurzer Zeit wieder aktivieren
        setTimeout(() => {
          submitBtn.disabled = false;
          if (btnLabel) btnLabel.style.display = 'inline';
          if (btnLoader) btnLoader.style.display = 'none';
        }, 1500);
      }
    }
  }

  async deleteVersandEintrag(versandId, kooperationId) {
    try {
      if (window.supabase) {
        const { error } = await window.supabase
          .from('kooperation_versand')
          .delete()
          .eq('id', versandId);

        if (error) throw error;
      }

      // Drawer schließen nach Löschen
      this.close();

      // Event für Tab-Update
      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'kooperation_versand', kooperation_id: kooperationId, action: 'deleted' }
      }));

    } catch (error) {
      console.error('❌ Fehler beim Löschen des Versand-Eintrags:', error);
      alert('Fehler beim Löschen: ' + error.message);
    }
  }
}

export const kooperationVersandManager = new KooperationVersandManager();

// Global verfügbar machen
window.kooperationVersandManager = kooperationVersandManager;
