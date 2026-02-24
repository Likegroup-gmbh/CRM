// MarkeCreate.js (ES6-Modul)
// Marke-Erstellungsseite mit Multi-Select für Branchen (wie Unternehmen)

import { MarkeService } from './services/MarkeService.js';
import { FormSubmitHelper } from '../../core/form/FormSubmitHelper.js';

export class MarkeCreate {
  constructor() {
    this.formData = {};
  }

  // Initialisiere Marke-Erstellung
  async init() {
    console.log('🎯 MARKECREATE: Initialisiere Marke-Erstellung');
    this.showCreateForm();
  }

  // Show Create Form
  showCreateForm() {
    console.log('🎯 MARKECREATE: Zeige Marke-Erstellungsformular mit FormSystem');
    window.setHeadline('Neue Marke anlegen');
    
    // Breadcrumb aktualisieren
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Marken', url: '/marke', clickable: true },
        { label: 'Neue Marke', url: '/marke/new', clickable: false }
      ]);
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
      
      // HINWEIS: Mitarbeiter-Prefill wird automatisch durch DependentFields.js gehandhabt
      // Die Felder haben prefillFromUnternehmen: true und prefillRole in der FormConfig
    }
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

    // Blur Event
    markennameField.addEventListener('blur', async (e) => {
      await this.validateMarkeDuplicate(e.target.value, messageContainer);
    });

    // Clear beim Tippen
    markennameField.addEventListener('input', () => {
      this.clearDuplicateMessages(messageContainer);
      this.enableSubmitButton();
    });
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
      });
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
      });
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
  }
}

// Exportiere Instanz für globale Nutzung
export const markeCreate = new MarkeCreate();
