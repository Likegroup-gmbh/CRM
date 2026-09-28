import { icon } from '../../core/icons/IconSystem.js';
// RechnungAnpassenDrawer.js
// Drawer zur Verwaltung von Rechnungs-Status und Datums-Feldern

export class RechnungAnpassenDrawer {
  constructor() {
    this.drawerId = 'rechnung-anpassen-drawer';
    this.auftragId = null;
    this.auftragData = null;
    // Angeklickte Zeile aus der Kundenrechnungsliste. null = Aufruf ohne
    // Zeilenkontext (z.B. Auftragsliste), dann eine Sektion pro Teilrechnung.
    this.teilrechnungId = null;
    this.teilrechnungen = [];
  }

  // Öffne Drawer
  async open(auftragId, { teilrechnungId = null } = {}) {
    console.log('📋 RECHNUNG-ANPASSEN: Öffne Drawer für Auftrag:', auftragId);
    this.auftragId = auftragId;
    this.teilrechnungId = teilrechnungId;

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
          ${icon('x-circle-filled')}
        </span>
        <span class="mdc-btn__label">Abbrechen</span>
      </button>
      <button type="button" class="mdc-btn mdc-btn--create" data-action="save">
        <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
          ${icon('check-filled')}
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

    const { data: teilrechnungen, error: trError } = await window.supabase
      .from('auftrag_teilrechnung')
      .select('id, position, rechnung_gestellt, rechnung_gestellt_am, ueberwiesen, ueberwiesen_am')
      .eq('auftrag_id', this.auftragId)
      .order('position', { ascending: true });
    if (trError) {
      console.error('❌ Fehler beim Laden der Teilrechnungen:', trError);
      throw trError;
    }
    this.teilrechnungen = teilrechnungen || [];

    console.log('✅ Auftragsdaten geladen:', this.auftragData, this.teilrechnungen.length, 'Teilrechnungen');
  }

  // Eine Zeile = eine Teilrechnung oder der Auftragskopf.
  _rows() {
    if (this.teilrechnungId) {
      const tr = this.teilrechnungen.find(t => t.id === this.teilrechnungId);
      if (tr) return [{ ...tr, _label: `Teilrechnung ${tr.position} von ${this.teilrechnungen.length}`, _trId: tr.id }];
    }
    if (this.teilrechnungen.length > 0) {
      return this.teilrechnungen.map(tr => ({
        ...tr,
        _label: `Teilrechnung ${tr.position} von ${this.teilrechnungen.length}`,
        _trId: tr.id
      }));
    }
    return [{ ...this.auftragData, _label: null, _trId: null }];
  }

  _renderRowFields(row, suffix) {
    const rechnungGestellt = row.rechnung_gestellt || false;
    const rechnungGestelltAm = this.formatDateForInput(row.rechnung_gestellt_am);
    const ueberwiesen = row.ueberwiesen || false;
    const ueberwiesenAm = this.formatDateForInput(row.ueberwiesen_am);

    return `
      <div class="form-section" data-tr-row="${row._trId || ''}">
        ${row._label ? `<h3 class="form-section-title">${row._label}</h3>` : ''}
        <div class="form-field">
          <label class="toggle-container">
            <span>Rechnung gestellt</span>
            <div class="toggle-switch">
              <input type="checkbox" id="rechnung_gestellt_${suffix}" data-suffix="${suffix}" class="drawer-toggle-rechnung" ${rechnungGestellt ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </div>
          </label>
        </div>
        <div class="form-field" id="rechnung_gestellt_am_field_${suffix}" style="display: ${rechnungGestellt ? 'flex' : 'none'}">
          <label for="rechnung_gestellt_am_${suffix}">gestellt am</label>
          <input type="date" id="rechnung_gestellt_am_${suffix}" value="${rechnungGestelltAm}">
        </div>
        <div class="form-field">
          <label class="toggle-container">
            <span>Überwiesen</span>
            <div class="toggle-switch">
              <input type="checkbox" id="ueberwiesen_${suffix}" data-suffix="${suffix}" class="drawer-toggle-ueberwiesen" ${ueberwiesen ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </div>
          </label>
        </div>
        <div class="form-field" id="ueberwiesen_am_field_${suffix}" style="display: ${ueberwiesen ? 'flex' : 'none'}">
          <label for="ueberwiesen_am_${suffix}">Überwiesen am</label>
          <input type="date" id="ueberwiesen_am_${suffix}" value="${ueberwiesenAm}">
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

  // Rendere Formular
  renderForm() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    const rows = this._rows();
    body.innerHTML = rows.map((row, i) => this._renderRowFields(row, i)).join('');
  }

  // Binde Events
  bindEvents() {
    // Toggle-Änderungen (eine Zeile pro Teilrechnung bzw. der Kopf)
    document.querySelectorAll(`#${this.drawerId} .drawer-toggle-rechnung`).forEach(toggle => {
      toggle.addEventListener('change', (e) => {
        this.handleToggleChange('rechnung_gestellt', e.target.checked, e.target.dataset.suffix);
      });
    });
    document.querySelectorAll(`#${this.drawerId} .drawer-toggle-ueberwiesen`).forEach(toggle => {
      toggle.addEventListener('change', (e) => {
        this.handleToggleChange('ueberwiesen', e.target.checked, e.target.dataset.suffix);
      });
    });

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
  handleToggleChange(toggleId, checked, suffix) {
    console.log(`🔄 Toggle geändert: ${toggleId} = ${checked}`);
    
    const fieldId = `${toggleId}_am_field_${suffix}`;
    const dateFieldId = `${toggleId}_am_${suffix}`;
    
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
      const rows = this._rows();
      const touchedTrIds = [];
      let kopfGeschrieben = false;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rechnungGestellt = document.getElementById(`rechnung_gestellt_${i}`).checked;
        const rechnungGestelltAm = document.getElementById(`rechnung_gestellt_am_${i}`).value || null;
        const ueberwiesen = document.getElementById(`ueberwiesen_${i}`).checked;
        const ueberwiesenAm = document.getElementById(`ueberwiesen_am_${i}`).value || null;

        const updates = {
          rechnung_gestellt: rechnungGestellt,
          rechnung_gestellt_am: rechnungGestellt ? rechnungGestelltAm : null,
          ueberwiesen: ueberwiesen,
          ueberwiesen_am: ueberwiesen ? ueberwiesenAm : null
        };

        if (row._trId) {
          // Nur geänderte Teilrechnungen schreiben
          const unveraendert =
            Boolean(row.rechnung_gestellt) === updates.rechnung_gestellt &&
            this.formatDateForInput(row.rechnung_gestellt_am) === (updates.rechnung_gestellt_am || '') &&
            Boolean(row.ueberwiesen) === updates.ueberwiesen &&
            this.formatDateForInput(row.ueberwiesen_am) === (updates.ueberwiesen_am || '');
          if (unveraendert) continue;

          console.log(`  📝 Updates Teilrechnung ${row._trId}:`, updates);
          const { error } = await window.supabase
            .from('auftrag_teilrechnung')
            .update(updates)
            .eq('id', row._trId);
          if (error) throw error;
          touchedTrIds.push(row._trId);
        } else {
          console.log('  📝 Updates Auftrag:', updates);
          const { error } = await window.supabase
            .from('auftrag')
            .update(updates)
            .eq('id', this.auftragId);
          if (error) throw error;
          kopfGeschrieben = true;
        }
      }

      console.log('✅ Erfolgreich gespeichert');

      // Trigger Event für Neu-Laden
      if (kopfGeschrieben) {
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'auftrag', id: this.auftragId }
        }));
      }
      for (const trId of touchedTrIds) {
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'auftrag_teilrechnung', id: trId }
        }));
      }

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


