// MarkeCreate.js (ES6-Modul)
// Marke-Erstellungsseite mit Multi-Select für Branchen (wie Unternehmen)

import { MarkeService } from './services/MarkeService.js';
import { FormSubmitHelper } from '../../core/form/FormSubmitHelper.js';
import { normalizeFormUrlFields } from '../../core/UrlHelper.js';
import { navigateBack } from '../../core/breadcrumbTrail.js';
import { bindDuplicateCheck } from '../../core/validation/DuplicateCheckBinding.js';

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
      <div class="form-page">
        ${formHtml}
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
      
      // Duplikat-Validierung auf Markenname
      this._duplicateCheck?.destroy();
      this._duplicateCheck = bindDuplicateCheck('marke', form, { signal: this._abort?.signal });
    }
  }

  // Handle Form Submit für Seiten-Formular
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
      
      // URL-Felder duerfen ohne Schema eingegeben werden, in der DB landen sie absolut
      normalizeFormUrlFields(form, data);

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
        
        setTimeout(() => {
          navigateBack(result.id ? `/marke/${result.id}` : '/unternehmen');
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
    if (this._abort) {
      try { this._abort.abort(); } catch (_) { /* noop */ }
      this._abort = null;
    }
  }
}

// Exportiere Instanz für globale Nutzung
export const markeCreate = new MarkeCreate();
