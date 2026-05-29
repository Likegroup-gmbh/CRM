// MarkeCreate.js (ES6-Modul)
// Marke-Erstellungsseite mit Multi-Select für Branchen (wie Unternehmen)

import { MarkeService } from './services/MarkeService.js';
import { FormSubmitHelper } from '../../core/form/FormSubmitHelper.js';
import { StrategiebriefingService } from '../kickoff/StrategiebriefingService.js';

export class MarkeCreate {
  constructor() {
    this.formData = {};
    this._abort = null;
  }

  // Initialisiere Marke-Erstellung
  async init() {
    console.log('🎯 MARKECREATE: Initialisiere Marke-Erstellung');
    this._abort?.abort();
    this._abort = new AbortController();
    this.showCreateForm();
  }

  // Show Create Form
  showCreateForm() {
    console.log('🎯 MARKECREATE: Zeige Marke-Erstellungsformular mit FormSystem');
    window.setHeadline('Neue Marke anlegen');
    
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateDetailLabel('Neue Marke');
    }
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('marke');
    window.content.innerHTML = `
      <div class="form-split-container">
        <div class="form-split-left">
          <div class="form-page">
            ${formHtml}
            <div id="logo-preview-container" class="form-logo-preview" style="display: none;">
              <label class="form-logo-label">Logo Vorschau:</label>
              <img id="logo-preview-image" class="form-logo-image" alt="Logo Vorschau" />
            </div>
            <button type="button" class="kickoff-create-toggle-btn" id="kickoff-toggle-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
              Strategiebriefing anlegen
            </button>
          </div>
        </div>
        <div class="form-split-right hidden" id="marke-split-container">
          <div id="marke-embedded-form"></div>
        </div>
      </div>
    `;

    // Formular-Events binden
    window.formSystem.bindFormEvents('marke', null);
    
    // Custom Submit Handler für Seiten-Formular (wie bei Unternehmen)
    const form = document.getElementById('marke-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      };
      
      // Logo-Preview-Funktion
      this.setupLogoPreview(form);
      
      // Duplikat-Validierung auf Markenname
      this.setupDuplicateValidation(form);
    }

    this._kickoffType = null;
    this._kickoffPanelOpen = false;
    this.setupKickOffToggle();
  }

  async setupKickOffToggle() {
    const toggleBtn = document.getElementById('kickoff-toggle-btn');
    if (!toggleBtn) return;

    const signal = this._abort?.signal;
    const opts = signal ? { signal } : undefined;

    toggleBtn.addEventListener('click', () => {
      if (this._kickoffPanelOpen) {
        this.closeKickOffPanel();
        return;
      }

      this._kickoffPanelOpen = true;
      toggleBtn.classList.add('active');
      toggleBtn.textContent = 'Strategiebriefing ✓';

      const splitContainer = document.getElementById('marke-split-container');
      const embeddedForm = document.getElementById('marke-embedded-form');
      if (!splitContainer || !embeddedForm) return;

      splitContainer.classList.remove('hidden');

      const kickoffFormHtml = window.formSystem.renderFormOnly('strategiebriefing_embedded');
      embeddedForm.innerHTML = `
        <div class="kickoff-panel-header">
          <h3 class="kickoff-panel-header__title">Strategiebriefing</h3>
          <button type="button" class="kickoff-panel-header__close" id="kickoff-panel-close" title="Panel schließen">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div>
          ${kickoffFormHtml}
        </div>
      `;

      window.formSystem.bindFormEvents('strategiebriefing_embedded', null);

      const kickoffForm = embeddedForm.querySelector('form');
      if (kickoffForm) {
        kickoffForm.onsubmit = (e) => e.preventDefault();
        const submitRow = kickoffForm.querySelector('.form-actions');
        if (submitRow) submitRow.style.display = 'none';
      }

      document.getElementById('kickoff-panel-close')?.addEventListener('click', () => {
        this.closeKickOffPanel();
      });

      setTimeout(() => {
        const container = document.querySelector('.form-split-container');
        if (container) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }, opts);
  }

  closeKickOffPanel() {
    const splitContainer = document.getElementById('marke-split-container');
    if (splitContainer) splitContainer.classList.add('hidden');
    
    const toggleBtn = document.getElementById('kickoff-toggle-btn');
    if (toggleBtn) {
      toggleBtn.classList.remove('active');
      toggleBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
        Strategiebriefing anlegen
      `;
    }
    
    this._kickoffPanelOpen = false;
    this._kickoffType = null;
  }

  // Setup Duplikat-Validierung für Markenname
  setupDuplicateValidation(form) {
    const markennameField = form.querySelector('#markenname, input[name="markenname"]');
    if (!markennameField) {
      console.warn('⚠️ MARKECREATE: Markenname-Feld nicht gefunden');
      return;
    }

    // Container für Duplicate-Messages (falls nicht existiert)
    let messageContainer = markennameField.parentElement.querySelector('.duplicate-message-container');
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.className = 'duplicate-message-container';
      markennameField.parentElement.appendChild(messageContainer);
    }

    const signal = this._abort?.signal;
    const opts = signal ? { signal } : undefined;

    // Blur Event
    markennameField.addEventListener('blur', async (e) => {
      await this.validateMarkeDuplicate(e.target.value, messageContainer);
    }, opts);

    // Clear beim Tippen
    markennameField.addEventListener('input', () => {
      this.clearDuplicateMessages(messageContainer);
      this.enableSubmitButton();
    }, opts);
  }

  // Validiere Marke Duplikat
  async validateMarkeDuplicate(markenname, messageContainer) {
    if (!markenname || markenname.trim().length < 2) {
      this.clearDuplicateMessages(messageContainer);
      return;
    }

    if (!window.duplicateChecker) {
      console.warn('⚠️ MARKECREATE: DuplicateChecker nicht verfügbar');
      return;
    }

    try {
      const result = await window.duplicateChecker.checkMarke(markenname, null);

      if (result.exact) {
        // Exakt vorhanden → Button disablen, Fehler anzeigen
        this.showDuplicateError(messageContainer, result.similar);
        this.disableSubmitButton(true);
      } else if (result.similar.length > 0) {
        // Ähnlich → Info-Box (nicht blockierend)
        this.showDuplicateWarning(messageContainer, result.similar);
        this.enableSubmitButton();
      } else {
        // Alles gut
        this.clearDuplicateMessages(messageContainer);
        this.enableSubmitButton();
      }
    } catch (error) {
      console.error('❌ MARKECREATE: Fehler bei Duplikat-Validierung:', error);
    }
  }

  // Zeige Duplikat-Fehler
  showDuplicateError(container, entries) {
    container.innerHTML = `
      <div class="duplicate-error">
        <strong>Dieser Markenname existiert bereits!</strong>
        ${entries.length > 0 ? `
          <ul class="duplicate-list">
            ${entries.map(entry => `
              <li class="duplicate-list-item">
                <a href="javascript:void(0)" class="duplicate-link" data-entity-id="${entry.id}">
                  ${entry.logo_url ? `<img src="${entry.logo_url}" alt="${entry.markenname}" class="duplicate-avatar" />` : '<div class="duplicate-avatar duplicate-avatar-placeholder"></div>'}
                  <span class="duplicate-name">${entry.markenname}${entry.unternehmen_name ? ` <span class="duplicate-meta">(${entry.unternehmen_name})</span>` : ''}</span>
                </a>
              </li>
            `).join('')}
          </ul>
        ` : ''}
      </div>
    `;
    
    // Event-Listener für Links
    this.bindDuplicateLinks(container, 'marke');
  }

  // Zeige Duplikat-Warnung
  showDuplicateWarning(container, entries) {
    container.innerHTML = `
      <div class="duplicate-warning">
        <strong>Folgende ähnliche Einträge gefunden:</strong>
        <ul class="duplicate-list">
          ${entries.map(entry => `
            <li class="duplicate-list-item">
              <a href="javascript:void(0)" class="duplicate-link" data-entity-id="${entry.id}">
                ${entry.logo_url ? `<img src="${entry.logo_url}" alt="${entry.markenname}" class="duplicate-avatar" />` : '<div class="duplicate-avatar duplicate-avatar-placeholder"></div>'}
                <span class="duplicate-name">${entry.markenname}${entry.unternehmen_name ? ` <span class="duplicate-meta">(${entry.unternehmen_name})</span>` : ''}</span>
              </a>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
    
    // Event-Listener für Links
    this.bindDuplicateLinks(container, 'marke');
  }

  // Bind Click-Events für Duplikat-Links
  bindDuplicateLinks(container, entityType) {
    const links = container.querySelectorAll('.duplicate-link[data-entity-id]');
    const signal = this._abort?.signal;
    const opts = signal ? { signal } : undefined;
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const id = e.currentTarget.dataset.entityId;
        if (id) {
          // Internes Routing verwenden (ohne Reload, im gleichen Tab)
          const route = `/${entityType}/${id}`;
          if (window.navigationSystem) {
            window.navigationSystem.navigateTo(route);
          }
        }
      }, opts);
    });
  }

  // Lösche Duplikat-Messages
  clearDuplicateMessages(container) {
    if (container) {
      container.innerHTML = '';
    }
  }

  // Disable Submit Button
  disableSubmitButton(disable) {
    const form = document.getElementById('marke-form');
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = disable;
        if (disable) {
          submitBtn.style.opacity = '0.5';
          submitBtn.style.cursor = 'not-allowed';
        }
      }
    }
  }

  // Enable Submit Button
  enableSubmitButton() {
    const form = document.getElementById('marke-form');
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
      }
    }
  }

  // Setup Logo Preview für Upload
  setupLogoPreview(form) {
    const uploaderRoot = form.querySelector('.uploader[data-name="logo_file"]');
    if (!uploaderRoot) return;

    // Event für File-Input (falls vorhanden)
    const fileInput = uploaderRoot.querySelector('input[type="file"]');
    if (fileInput) {
      const signal = this._abort?.signal;
      const opts = signal ? { signal } : undefined;
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const previewContainer = document.getElementById('logo-preview-container');
            const previewImage = document.getElementById('logo-preview-image');
            if (previewContainer && previewImage) {
              previewImage.src = event.target.result;
              previewContainer.style.display = 'block';
            }
          };
          reader.readAsDataURL(file);
        }
      }, opts);
    }
  }

  // Handle Form Submit für Seiten-Formular (kopiert von UnternehmenCreate)
  async handleFormSubmit() {
    try {
      console.log('🎯 MARKECREATE: Verarbeite Formular-Submit');
      
      // Loading-State
      const submitBtn = document.querySelector('#marke-form button[type="submit"]');
      let originalText = 'Marke anlegen'; // Default-Text
      if (submitBtn) {
        originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<div class="loading-spinner"></div> Wird angelegt...';
        submitBtn.disabled = true;
      }

      const form = document.getElementById('marke-form');
      const formData = new FormData(form);
      const tagBasedValues = FormSubmitHelper.collectTagBasedSelects(form);
      const allFormData = FormSubmitHelper.formDataToObject(formData, tagBasedValues);
      const data = {};
      for (const [key, value] of Object.entries(allFormData)) {
        data[key] = Array.isArray(value) ? value : (typeof value === 'string' ? value.trim() : value);
      }
      
      // URL-Felder: https:// automatisch hinzufügen
      if (data.webseite && data.webseite.trim() !== '') {
        let urlValue = data.webseite.trim();
        if (!urlValue.match(/^https?:\/\//i)) {
          data.webseite = 'https://' + urlValue;
          console.log('🔗 Webseite: https:// Präfix hinzugefügt ->', data.webseite);
        }
      }
      
      console.log('📤 Finale Marke-Daten:', data);

      // Validierung (wie bei Unternehmen)
      const validation = window.validatorSystem.validateForm(data, {
        markenname: { type: 'text', minLength: 2, required: true }
      });
      
      if (!validation.isValid) {
        this.showValidationErrors(validation.errors);
        return;
      }

      // Strategiebriefing-Validierung (wenn Panel offen)
      if (this._kickoffPanelOpen) {
        const kickoffForm = document.querySelector('#marke-embedded-form form');
        if (kickoffForm) {
          const kickoffData = window.formSystem.collectSubmitData(kickoffForm);
          const kickoffValidation = window.validatorSystem.validateForm(kickoffData, StrategiebriefingService.getValidationRules());
          if (!kickoffValidation.isValid) {
            window.toastSystem?.show('Bitte alle Pflichtfelder im Strategiebriefing ausfüllen', 'error');
            if (submitBtn) {
              submitBtn.innerHTML = originalText;
              submitBtn.disabled = false;
            }
            return;
          }
        }
      }

      // Marke erstellen
      const result = await window.dataService.createEntity('marke', data);
      
      if (result.success) {
        // Logo-Upload (falls vorhanden) - über MarkeService
        if (result.id) {
          console.log('🔵 START: Logo-Upload für Marke', result.id);
          await MarkeService.uploadLogo(result.id, form);
          console.log('✅ Logo-Upload abgeschlossen');
          
          // Mitarbeiter-Zuordnungen mit Rollen speichern - über MarkeService
          const unternehmenId = data.unternehmen_id || null;
          await MarkeService.saveMitarbeiterToMarke(result.id, data, unternehmenId, { deleteExisting: false });

          // Strategiebriefing speichern (wenn Panel offen)
          if (this._kickoffPanelOpen) {
            try {
              await this.saveStrategiebriefing(unternehmenId, result.id);
            } catch (kickoffErr) {
              console.error('❌ Strategiebriefing Fehler:', kickoffErr);
              window.toastSystem?.show('Marke erstellt, aber Strategiebriefing konnte nicht gespeichert werden', 'warning');
            }
          }
        }

        this.showSuccessMessage('Marke erfolgreich erstellt!');
        
        // Kurz warten, dann zur Übersicht
        setTimeout(() => {
          window.navigateTo('/marke');
        }, 1500);
      } else {
        throw new Error(result.error || 'Fehler beim Erstellen der Marke');
      }
      
    } catch (error) {
      console.error('❌ Fehler beim Erstellen der Marke:', error);
      this.showErrorMessage(error.message || 'Ein unerwarteter Fehler ist aufgetreten');
    } finally {
      // Loading-State zurücksetzen
      const submitBtn = document.querySelector('#marke-form button[type="submit"]');
      if (submitBtn) {
        submitBtn.innerHTML = 'Marke erstellen';
        submitBtn.disabled = false;
      }
    }
  }

  async saveStrategiebriefing(unternehmenId, markeId) {
    const kickoffForm = document.querySelector('#marke-embedded-form form');
    if (!kickoffForm) return;

    const formData = window.formSystem.collectSubmitData(kickoffForm);
    const kampagnenart = formData.kampagnenart || kickoffForm.querySelector('[name="kampagnenart"]')?.value;

    const result = await StrategiebriefingService.saveBriefing(formData, {
      markeId,
      unternehmenId,
      kampagnenart
    });

    console.log('✅ Strategiebriefing gespeichert:', result.id);
    return result;
  }
  
  // Validierungsfehler anzeigen
  showValidationErrors(errors) {
    // Alte Fehler entfernen
    document.querySelectorAll('.field-error').forEach(el => el.remove());
    
    for (const [field, message] of Object.entries(errors)) {
      const fieldElement = document.querySelector(`[name="${field}"]`);
      if (fieldElement) {
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.textContent = message;
        errorElement.style.color = 'red';
        errorElement.style.fontSize = '12px';
        errorElement.style.marginTop = '4px';
        
        fieldElement.parentNode.appendChild(errorElement);
      }
    }
  }
  
  // Erfolgsmeldung anzeigen (kopiert von Unternehmen)
  showSuccessMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Animation
    setTimeout(() => toast.style.opacity = '1', 100);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
  
  // Fehlermeldung anzeigen (kopiert von Unternehmen)
  showErrorMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Animation
    setTimeout(() => toast.style.opacity = '1', 100);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Destroy
  destroy() {
    console.log('🎯 MARKECREATE: Destroy');
    if (this._abort) {
      try { this._abort.abort(); } catch (_) { /* noop */ }
      this._abort = null;
    }
  }
}

// Exportiere Instanz für globale Nutzung
export const markeCreate = new MarkeCreate();
