// RechnungAnpassenDrawer.js
// Drawer zur Verwaltung von Rechnungs-Status und Datums-Feldern

export class RechnungAnpassenDrawer {
  constructor() {
    this.drawerId = 'rechnung-anpassen-drawer';
    this.auftragId = null;
    this.auftragData = null;
  }

  // Öffne Drawer
  async open(auftragId) {
    console.log('📋 RECHNUNG-ANPASSEN: Öffne Drawer für Auftrag:', auftragId);
    this.auftragId = auftragId;

    try {
      await this.createDrawer();
      await this.loadAuftragData();
      this.renderForm();
      this.bindEvents();
    } catch (error) {
      console.error('❌ Fehler beim Öffnen des Drawers:', error);
      this.showError('Fehler beim Laden der Auftragsdaten.');
    }
  }

  // Erstelle Drawer-Struktur
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
    title.textContent = 'Rechnung anpassen';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = 'Status und Datums-Felder verwalten';
    
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

    // Footer
    const footer = document.createElement('div');
    footer.className = 'drawer-footer';
    footer.innerHTML = `
      <button type="button" class="mdc-btn mdc-btn--cancel" data-action="cancel">
        <span class="mdc-btn__icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </span>
        <span class="mdc-btn__label">Abbrechen</span>
      </button>
      <button type="button" class="mdc-btn mdc-btn--create" data-action="save">
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
        <span class="mdc-btn__label">Speichern</span>
      </button>
    `;

    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(footer);

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

  // Lade Auftragsdaten
  async loadAuftragData() {
    console.log('🔍 RECHNUNG-ANPASSEN: Lade Auftragsdaten');

    const { data, error } = await window.supabase
      .from('auftrag')
      .select('id, auftragsname, rechnung_gestellt, rechnung_gestellt_am, ueberwiesen, ueberwiesen_am')
      .eq('id', this.auftragId)
      .single();

    if (error) {
      console.error('❌ Fehler beim Laden:', error);
      throw error;
    }

    this.auftragData = data;
    console.log('✅ Auftragsdaten geladen:', this.auftragData);
  }

  // Rendere Formular
  renderForm() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    const rechnungGestellt = this.auftragData.rechnung_gestellt || false;
    const rechnungGestelltAm = this.formatDateForInput(this.auftragData.rechnung_gestellt_am);
    const ueberwiesen = this.auftragData.ueberwiesen || false;
    const ueberwiesenAm = this.formatDateForInput(this.auftragData.ueberwiesen_am);

    body.innerHTML = `
      <div class="form-section">
        <h3 class="form-section-title">Rechnungsinformationen</h3>
        
        <!-- Rechnung gestellt -->
        <div class="form-field">
          <label class="toggle-container">
            <span>Rechnung gestellt</span>
            <div class="toggle-switch">
              <input type="checkbox" id="rechnung_gestellt" ${rechnungGestellt ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </div>
          </label>
        </div>
        
        <!-- Rechnung gestellt am -->
        <div class="form-field" id="rechnung_gestellt_am_field" style="display: ${rechnungGestellt ? 'flex' : 'none'}">
          <label for="rechnung_gestellt_am">Rechnung gestellt am</label>
          <input type="date" id="rechnung_gestellt_am" value="${rechnungGestelltAm}">
        </div>
      </div>

      <div class="form-section">
        <h3 class="form-section-title">Zahlungsinformationen</h3>
        
        <!-- Überwiesen -->
        <div class="form-field">
          <label class="toggle-container">
            <span>Überwiesen</span>
            <div class="toggle-switch">
              <input type="checkbox" id="ueberwiesen" ${ueberwiesen ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </div>
          </label>
        </div>
        
        <!-- Überwiesen am -->
        <div class="form-field" id="ueberwiesen_am_field" style="display: ${ueberwiesen ? 'flex' : 'none'}">
          <label for="ueberwiesen_am">Überwiesen am</label>
          <input type="date" id="ueberwiesen_am" value="${ueberwiesenAm}">
        </div>
      </div>
    `;
  }

  // Formatiere Datum für Input-Feld (yyyy-MM-dd)
  formatDateForInput(dateString) {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('❌ Fehler beim Formatieren des Datums:', error);
      return '';
    }
  }

  // Binde Events
  bindEvents() {
    // Toggle-Änderungen
    const rechnungGestelltToggle = document.getElementById('rechnung_gestellt');
    const ueberwiesenToggle = document.getElementById('ueberwiesen');

    if (rechnungGestelltToggle) {
      rechnungGestelltToggle.addEventListener('change', (e) => {
        this.handleToggleChange('rechnung_gestellt', e.target.checked);
      });
    }

    if (ueberwiesenToggle) {
      ueberwiesenToggle.addEventListener('change', (e) => {
        this.handleToggleChange('ueberwiesen', e.target.checked);
      });
    }

    // Footer Buttons
    const footer = document.querySelector(`#${this.drawerId} .drawer-footer`);
    if (footer) {
      footer.addEventListener('click', async (e) => {
        // Finde den Button mit data-action (auch wenn auf Icon/Label geklickt wurde)
        const button = e.target.closest('[data-action]');
        if (!button) return;
        
        const action = button.dataset.action;
        console.log('🖱️ RECHNUNG-ANPASSEN: Button geklickt:', action);
        
        if (action === 'cancel') {
          this.close();
        } else if (action === 'save') {
          await this.save();
        }
      });
    }
  }

  // Handle Toggle-Änderung
  handleToggleChange(toggleId, checked) {
    console.log(`🔄 Toggle geändert: ${toggleId} = ${checked}`);
    
    const fieldId = `${toggleId}_am_field`;
    const dateFieldId = `${toggleId}_am`;
    
    const field = document.getElementById(fieldId);
    const dateField = document.getElementById(dateFieldId);
    
    if (!field || !dateField) return;

    // Zeige/Verstecke Datumsfeld
    field.style.display = checked ? 'flex' : 'none';
    
    // Wenn aktiviert und kein Datum gesetzt → setze heutiges Datum
    if (checked && !dateField.value) {
      const today = new Date().toISOString().split('T')[0];
      dateField.value = today;
      console.log(`  ✅ Heutiges Datum gesetzt: ${today}`);
    }
  }

  // Speichere Änderungen
  async save() {
    console.log('💾 RECHNUNG-ANPASSEN: Speichere Änderungen');

    const saveBtn = document.querySelector(`#${this.drawerId} [data-action="save"]`);
    
    // Loading State
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.classList.add('is-loading');
    }

    try {
      // Sammle Werte
      const rechnungGestellt = document.getElementById('rechnung_gestellt').checked;
      const rechnungGestelltAm = document.getElementById('rechnung_gestellt_am').value || null;
      const ueberwiesen = document.getElementById('ueberwiesen').checked;
      const ueberwiesenAm = document.getElementById('ueberwiesen_am').value || null;

      const updates = {
        rechnung_gestellt: rechnungGestellt,
        rechnung_gestellt_am: rechnungGestellt ? rechnungGestelltAm : null,
        ueberwiesen: ueberwiesen,
        ueberwiesen_am: ueberwiesen ? ueberwiesenAm : null
      };

      console.log('  📝 Updates:', updates);

      // Update in Supabase
      const { error } = await window.supabase
        .from('auftrag')
        .update(updates)
        .eq('id', this.auftragId);

      if (error) {
        console.error('❌ Fehler beim Speichern:', error);
        this.showError('Fehler beim Speichern der Änderungen.');
        return;
      }

      console.log('✅ Erfolgreich gespeichert');
      
      // Trigger Event für Neu-Laden
      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'auftrag', id: this.auftragId }
      }));

      // Zeige Erfolg
      this.showSuccess();
      
      // Schließe Drawer nach kurzer Verzögerung
      setTimeout(() => this.close(), 500);

    } catch (error) {
      console.error('❌ Fehler beim Speichern:', error);
      this.showError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      // Loading State zurücksetzen
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.classList.remove('is-loading');
      }
    }
  }

  // Zeige Erfolgsmeldung
  showSuccess() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    const successMsg = document.createElement('div');
    successMsg.className = 'alert alert-success';
    successMsg.textContent = '✅ Änderungen erfolgreich gespeichert';
    successMsg.style.marginBottom = 'var(--space-md)';
    
    body.insertBefore(successMsg, body.firstChild);
  }

  // Zeige Fehlermeldung
  showError(message) {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) {
      alert(message);
      return;
    }

    body.innerHTML = `
      <div class="alert alert-error">
        <strong>Fehler:</strong> ${message}
      </div>
    `;
  }

  // Schließe Drawer
  close() {
    const panel = document.getElementById(this.drawerId);
    const overlay = document.getElementById(`${this.drawerId}-overlay`);

    if (panel) panel.classList.remove('show');
    
    setTimeout(() => {
      this.removeDrawer();
    }, 300);
  }

  // Entferne Drawer
  removeDrawer() {
    const panel = document.getElementById(this.drawerId);
    const overlay = document.getElementById(`${this.drawerId}-overlay`);

    if (panel) panel.remove();
    if (overlay) overlay.remove();
  }
}


