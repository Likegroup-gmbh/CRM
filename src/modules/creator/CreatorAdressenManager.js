// CreatorAdressenManager.js
// Verwaltet zusätzliche Adressen für Creator

export class CreatorAdressenManager {
  constructor() {
    this.drawerId = 'creator-adressen-drawer';
    this.creatorId = null;
    this.adresseId = null; // Für Edit-Modus
  }

  // Öffne Drawer für neue Adresse
  open(creatorId) {
    this.creatorId = creatorId;
    this.adresseId = null;
    this.createDrawer();
    this.renderForm();
    this.bindFormEvents();
  }

  // Öffne Drawer zum Bearbeiten einer Adresse
  async openEdit(creatorId, adresseId) {
    this.creatorId = creatorId;
    this.adresseId = adresseId;
    this.createDrawer();
    
    // Lade Adressdaten
    const adresse = await this.loadAdresse(adresseId);
    if (adresse) {
      this.renderForm(adresse);
      this.bindFormEvents();
    }
  }

  // Lade eine bestimmte Adresse
  async loadAdresse(adresseId) {
    try {
      const { data, error } = await window.supabase
        .from('creator_adressen')
        .select('*')
        .eq('id', adresseId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Fehler beim Laden der Adresse:', error);
      this.showError('Adresse konnte nicht geladen werden.');
      return null;
    }
  }

  // Erstelle Drawer-Struktur
  createDrawer() {
    // Entferne existierenden Drawer
    const existing = document.getElementById(this.drawerId);
    if (existing) existing.remove();

    const drawer = document.createElement('div');
    drawer.id = this.drawerId;
    drawer.className = 'drawer-overlay';
    drawer.innerHTML = `
      <div class="drawer-panel">
        <div class="drawer-header">
          <h2>${this.adresseId ? 'Adresse bearbeiten' : 'Neue Adresse hinzufügen'}</h2>
          <button class="drawer-close-btn" type="button" aria-label="Schließen" data-close>
            &times;
          </button>
        </div>
        <div class="drawer-body" id="${this.drawerId}-body"></div>
      </div>
    `;

    document.body.appendChild(drawer);

    // Schließen-Funktionalität
    drawer.querySelector('[data-close]').addEventListener('click', () => this.close());
    drawer.addEventListener('click', (e) => {
      if (e.target === drawer) this.close();
    });

    // ESC-Taste
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Zeige Drawer
    setTimeout(() => drawer.classList.add('active'), 10);
  }

  // Rendere Formular
  renderForm(adresse = null) {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;

    body.innerHTML = `
      <form id="creator-adresse-form" class="form-layout">
        <div class="form-section">
          <div class="form-field">
            <label for="adressname">Adressname <span class="required">*</span></label>
            <input 
              type="text" 
              id="adressname" 
              name="adressname" 
              placeholder="z.B. Firmenadresse, Wohnadresse" 
              value="${adresse?.adressname || ''}"
              required
            >
            <small class="field-hint">Geben Sie einen Namen für diese Adresse ein</small>
          </div>

          <div class="form-field">
            <label for="firmenname">Firmenname</label>
            <input 
              type="text" 
              id="firmenname" 
              name="firmenname" 
              placeholder="Name der Firma (optional)" 
              value="${adresse?.firmenname || ''}"
            >
            <small class="field-hint">Falls es sich um eine Firmenadresse handelt</small>
          </div>

          <div class="form-row">
            <div class="form-field" style="flex: 3;">
              <label for="strasse">Straße</label>
              <input 
                type="text" 
                id="strasse" 
                name="strasse" 
                placeholder="Straßenname" 
                value="${adresse?.strasse || ''}"
              >
            </div>
            <div class="form-field" style="flex: 1;">
              <label for="hausnummer">Hausnummer</label>
              <input 
                type="text" 
                id="hausnummer" 
                name="hausnummer" 
                placeholder="Nr." 
                value="${adresse?.hausnummer || ''}"
              >
            </div>
          </div>

          <div class="form-row">
            <div class="form-field" style="flex: 1;">
              <label for="plz">PLZ</label>
              <input 
                type="text" 
                id="plz" 
                name="plz" 
                placeholder="PLZ" 
                value="${adresse?.plz || ''}"
              >
            </div>
            <div class="form-field" style="flex: 2;">
              <label for="stadt">Stadt</label>
              <input 
                type="text" 
                id="stadt" 
                name="stadt" 
                placeholder="Stadt" 
                value="${adresse?.stadt || ''}"
              >
            </div>
          </div>

          <div class="form-field">
            <label for="land">Land</label>
            <input 
              type="text" 
              id="land" 
              name="land" 
              placeholder="Deutschland" 
              value="${adresse?.land || 'Deutschland'}"
            >
          </div>

          <div class="form-field">
            <label class="checkbox-label">
              <input 
                type="checkbox" 
                id="ist_standard" 
                name="ist_standard" 
                ${adresse?.ist_standard ? 'checked' : ''}
              >
              <span>Als Standard-Adresse festlegen</span>
            </label>
            <small class="field-hint">Diese Adresse wird beim Versand vorausgewählt</small>
          </div>

          <div class="form-field">
            <label for="notiz">Notizen</label>
            <textarea 
              id="notiz" 
              name="notiz" 
              rows="3" 
              placeholder="Zusätzliche Informationen..."
            >${adresse?.notiz || ''}</textarea>
          </div>
        </div>

        <div class="drawer-actions">
          <button type="button" class="mdc-btn mdc-btn--cancel" data-close>
            <span class="mdc-btn__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </span>
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
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
            <span class="mdc-btn__label">${this.adresseId ? 'Aktualisieren' : 'Hinzufügen'}</span>
          </button>
        </div>

        <div id="form-feedback" class="form-feedback"></div>
      </form>
    `;
  }

  // Binde Formular-Events
  bindFormEvents() {
    const form = document.getElementById('creator-adresse-form');
    if (!form) return;

    // Abbrechen-Button
    const cancelBtn = form.querySelector('[data-close]');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.close());
    }

    // Form Submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit(form);
    });
  }

  // Validiere Formular-Daten
  validateFormData(formData) {
    const errors = [];
    
    // Adressname ist Pflichtfeld
    const adressname = formData.get('adressname')?.trim();
    if (!adressname || adressname.length === 0) {
      errors.push('Adressname ist erforderlich');
    } else if (adressname.length > 100) {
      errors.push('Adressname darf maximal 100 Zeichen lang sein');
    }
    
    // PLZ validieren (wenn angegeben)
    const plz = formData.get('plz')?.trim();
    if (plz && plz.length > 0) {
      // Deutsche PLZ: 5 Ziffern, Österreich/Schweiz: 4 Ziffern
      if (!/^\d{4,5}$/.test(plz)) {
        errors.push('PLZ muss 4-5 Ziffern enthalten');
      }
    }
    
    // Feldlängen prüfen
    const firmenname = formData.get('firmenname')?.trim();
    if (firmenname && firmenname.length > 200) {
      errors.push('Firmenname darf maximal 200 Zeichen lang sein');
    }
    
    const strasse = formData.get('strasse')?.trim();
    if (strasse && strasse.length > 200) {
      errors.push('Straße darf maximal 200 Zeichen lang sein');
    }
    
    const hausnummer = formData.get('hausnummer')?.trim();
    if (hausnummer && hausnummer.length > 20) {
      errors.push('Hausnummer darf maximal 20 Zeichen lang sein');
    }
    
    const stadt = formData.get('stadt')?.trim();
    if (stadt && stadt.length > 100) {
      errors.push('Stadt darf maximal 100 Zeichen lang sein');
    }
    
    const land = formData.get('land')?.trim();
    if (land && land.length > 100) {
      errors.push('Land darf maximal 100 Zeichen lang sein');
    }
    
    const notiz = formData.get('notiz')?.trim();
    if (notiz && notiz.length > 1000) {
      errors.push('Notiz darf maximal 1000 Zeichen lang sein');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Verarbeite Formular-Submit
  async handleSubmit(form) {
    try {
      const formData = new FormData(form);
      
      // Validierung durchführen
      const validation = this.validateFormData(formData);
      if (!validation.isValid) {
        this.showError(validation.errors.join('\n'));
        return;
      }
      
      const payload = {
        creator_id: this.creatorId,
        adressname: formData.get('adressname')?.trim(),
        firmenname: formData.get('firmenname')?.trim() || null,
        strasse: formData.get('strasse')?.trim() || null,
        hausnummer: formData.get('hausnummer')?.trim() || null,
        plz: formData.get('plz')?.trim() || null,
        stadt: formData.get('stadt')?.trim() || null,
        land: formData.get('land')?.trim() || 'Deutschland',
        ist_standard: formData.get('ist_standard') === 'on',
        notiz: formData.get('notiz')?.trim() || null,
        updated_at: new Date().toISOString()
      };

      // Wenn als Standard markiert, setze alle anderen auf false
      if (payload.ist_standard) {
        await window.supabase
          .from('creator_adressen')
          .update({ ist_standard: false })
          .eq('creator_id', this.creatorId);
      }

      if (this.adresseId) {
        // Update existierende Adresse
        const { error } = await window.supabase
          .from('creator_adressen')
          .update(payload)
          .eq('id', this.adresseId);

        if (error) throw error;
        this.showSuccess('Adresse erfolgreich aktualisiert.');
      } else {
        // Erstelle neue Adresse
        const { error } = await window.supabase
          .from('creator_adressen')
          .insert(payload);

        if (error) throw error;
        this.showSuccess('Adresse erfolgreich hinzugefügt.');
      }

      // Event auslösen für UI-Update
      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'creator_adressen', creatorId: this.creatorId }
      }));

      setTimeout(() => this.close(), 1000);
    } catch (error) {
      console.error('❌ Fehler beim Speichern der Adresse:', error);
      this.showError(error.message || 'Speichern fehlgeschlagen.');
    }
  }

  // Lösche Adresse
  async deleteAdresse(adresseId, creatorId) {
    // Nutze confirmationModal für konsistente UX
    let confirmed = false;
    
    if (window.confirmationModal) {
      const result = await window.confirmationModal.open({
        title: 'Adresse löschen',
        message: 'Möchten Sie diese Adresse wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.',
        confirmText: 'Löschen',
        cancelText: 'Abbrechen',
        danger: true
      });
      confirmed = result?.confirmed;
    } else {
      // Fallback auf native confirm
      confirmed = confirm('Möchten Sie diese Adresse wirklich löschen?');
    }
    
    if (!confirmed) return;

    try {
      const { error } = await window.supabase
        .from('creator_adressen')
        .delete()
        .eq('id', adresseId);

      if (error) throw error;

      // Nutze toastSystem oder NotificationSystem
      if (window.toastSystem) {
        window.toastSystem.show('success', 'Adresse erfolgreich gelöscht.');
      } else {
        window.NotificationSystem?.show('success', 'Adresse erfolgreich gelöscht.');
      }
      
      // Event auslösen
      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'creator_adressen', creatorId: creatorId }
      }));
    } catch (error) {
      console.error('❌ Fehler beim Löschen der Adresse:', error);
      if (window.toastSystem) {
        window.toastSystem.show('error', 'Löschen fehlgeschlagen: ' + error.message);
      } else {
        window.NotificationSystem?.show('error', 'Löschen fehlgeschlagen: ' + error.message);
      }
    }
  }

  // Schließe Drawer
  close() {
    const drawer = document.getElementById(this.drawerId);
    if (drawer) {
      drawer.classList.remove('active');
      setTimeout(() => drawer.remove(), 300);
    }
  }

  // Zeige Erfolgs-Nachricht
  showSuccess(message) {
    const feedback = document.getElementById('form-feedback');
    if (feedback) {
      feedback.className = 'form-feedback success';
      feedback.textContent = message;
      feedback.style.display = 'block';
    }
  }

  // Zeige Fehler-Nachricht
  showError(message) {
    const feedback = document.getElementById('form-feedback');
    if (feedback) {
      feedback.className = 'form-feedback error';
      feedback.textContent = message;
      feedback.style.display = 'block';
    }
  }
}

// Globale Instanz
window.creatorAdressenManager = new CreatorAdressenManager();

