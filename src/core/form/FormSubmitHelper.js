// FormSubmitHelper.js (ES6-Modul)
// Zentralisierte Hilfsfunktionen für Formular-Submit-Handling
// Eliminiert Code-Duplikation zwischen verschiedenen Modulen

export class FormSubmitHelper {
  
  /**
   * Sammelt Werte aus tag-basierten Multi-Select-Feldern
   * @param {HTMLFormElement} form - Das Formular-Element
   * @returns {Object} - Objekt mit Feldnamen als Keys und Array-Werten
   */
  static collectTagBasedSelects(form) {
    const result = {};
    
    const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
    tagBasedSelects.forEach(select => {
      const fieldName = select.name;
      
      // Suche das versteckte Select mit den tatsächlichen Werten
      let hiddenSelect = form.querySelector(`select[name="${fieldName}[]"][style*="display: none"]`);
      if (!hiddenSelect) {
        hiddenSelect = form.querySelector(`select[name="${fieldName}"][style*="display: none"]`);
      }
      
      // Alternative: Suche nach Tag-Container und sammle Werte aus Tags
      if (!hiddenSelect) {
        const tagContainer = form.querySelector(`select[name="${fieldName}"]`)?.closest('.form-field')?.querySelector('.tag-based-select');
        if (tagContainer) {
          const tags = tagContainer.querySelectorAll('.tag[data-value]');
          const tagValues = Array.from(tags).map(tag => tag.dataset.value).filter(Boolean);
          if (tagValues.length > 0) {
            result[fieldName] = tagValues;
            console.log(`🏷️ Tag-basiertes Feld ${fieldName} aus Tags gesammelt:`, tagValues);
            return;
          }
        }
      }
      
      if (hiddenSelect) {
        const values = Array.from(hiddenSelect.selectedOptions).map(opt => opt.value).filter(Boolean);
        if (values.length > 0) {
          result[fieldName] = values;
          console.log(`🏷️ Tag-basiertes Feld ${fieldName} aus Hidden-Select gesammelt:`, values);
        }
      } else {
        console.warn(`⚠️ Kein Hidden-Select oder Tags für ${fieldName} gefunden`);
      }
    });
    
    return result;
  }

  /**
   * Konvertiert FormData zu einem Objekt, berücksichtigt Array-Felder und tag-basierte Selects
   * @param {FormData} formData - Das FormData-Objekt
   * @param {Object} tagBasedValues - Bereits gesammelte tag-basierte Werte
   * @returns {Object} - Das konvertierte Objekt
   */
  static formDataToObject(formData, tagBasedValues = {}) {
    const result = { ...tagBasedValues };
    
    for (const [key, value] of formData.entries()) {
      if (key.includes('[]')) {
        // Multi-Select behandeln
        const cleanKey = key.replace('[]', '');
        if (!result[cleanKey]) {
          result[cleanKey] = [];
        }
        result[cleanKey].push(value);
      } else {
        // Nur setzen wenn nicht bereits als Array von Tag-basierten Feldern gesetzt
        if (!result.hasOwnProperty(key) || !Array.isArray(result[key])) {
          result[key] = value;
        } else {
          console.log(`⚠️ Überspringe ${key}, bereits als Array gesetzt:`, result[key]);
        }
      }
    }
    
    // Duplikate aus Array-Feldern entfernen
    for (const [key, value] of Object.entries(result)) {
      if (Array.isArray(value)) {
        result[key] = [...new Set(value)];
      }
    }
    
    return result;
  }

  /**
   * Zeigt Validierungsfehler im Formular an
   * @param {Object} errors - Objekt mit Feldnamen als Keys und Fehlermeldungen als Values
   * @param {HTMLElement} container - Container-Element (optional, für Fallback)
   */
  static showValidationErrors(errors, container = null) {
    // Alte Fehler entfernen
    document.querySelectorAll('.field-error, .validation-error').forEach(el => el.remove());
    
    // Felder-Styles zurücksetzen
    document.querySelectorAll('[style*="border-color: rgb(220, 53, 69)"]').forEach(el => {
      el.style.borderColor = '';
    });

    // Neue Fehler anzeigen
    Object.entries(errors).forEach(([field, message]) => {
      const fieldElement = document.querySelector(`[name="${field}"]`);
      if (fieldElement) {
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error validation-error';
        errorElement.textContent = message;
        errorElement.style.cssText = `
          color: #dc3545;
          font-size: 0.875rem;
          margin-top: 0.25rem;
        `;
        fieldElement.parentNode.appendChild(errorElement);
        fieldElement.style.borderColor = '#dc3545';
      }
    });
  }

  /**
   * Zeigt eine Erfolgsmeldung an
   * @param {string} message - Die anzuzeigende Nachricht
   * @param {HTMLElement} container - Container-Element für die Nachricht
   */
  static showSuccessMessage(message, container = null) {
    const targetContainer = container || document.querySelector('.form-page');
    if (!targetContainer) {
      window.toastSystem?.show('success', message);
      return;
    }
    
    // Bestehende Nachrichten entfernen
    targetContainer.querySelectorAll('.alert-success').forEach(el => el.remove());
    
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success';
    successDiv.textContent = message;
    successDiv.style.cssText = `
      background: #d4edda;
      color: #155724;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #c3e6cb;
    `;
    
    targetContainer.insertBefore(successDiv, targetContainer.firstChild);
  }

  /**
   * Zeigt eine Fehlermeldung an
   * @param {string} message - Die anzuzeigende Nachricht
   * @param {HTMLElement} container - Container-Element für die Nachricht
   */
  static showErrorMessage(message, container = null) {
    const targetContainer = container || document.querySelector('.form-page');
    if (!targetContainer) {
      window.toastSystem?.show('error', message);
      return;
    }
    
    // Bestehende Nachrichten entfernen
    targetContainer.querySelectorAll('.alert-error, .alert-danger').forEach(el => el.remove());
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-error alert-danger';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      background: #f8d7da;
      color: #721c24;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      border: 1px solid #f5c6cb;
    `;
    
    targetContainer.insertBefore(errorDiv, targetContainer.firstChild);
  }

  /**
   * Setzt den Submit-Button in Loading-Status
   * @param {HTMLButtonElement} btn - Der Button
   * @param {boolean} loading - Loading-Status
   * @param {string} loadingText - Text während Loading
   * @param {string} normalText - Text nach Loading
   */
  static setButtonLoading(btn, loading, loadingText = 'Wird verarbeitet…', normalText = 'Speichern') {
    if (!btn) return;
    
    if (loading) {
      btn.dataset.locked = 'true';
      btn.classList.add('is-loading');
      btn.disabled = true;
      const labelEl = btn.querySelector('.mdc-btn__label');
      if (labelEl) labelEl.textContent = loadingText;
    } else {
      btn.dataset.locked = 'false';
      btn.classList.remove('is-loading');
      btn.disabled = false;
      const labelEl = btn.querySelector('.mdc-btn__label');
      if (labelEl) labelEl.textContent = normalText;
    }
  }

  /**
   * Setzt den Submit-Button in Success-Status
   * @param {HTMLButtonElement} btn - Der Button
   * @param {string} successText - Text bei Erfolg
   */
  static setButtonSuccess(btn, successText = 'Erfolgreich gespeichert') {
    if (!btn) return;
    
    btn.classList.remove('is-loading');
    btn.classList.add('is-success');
    const labelEl = btn.querySelector('.mdc-btn__label');
    if (labelEl) labelEl.textContent = successText;
  }

  /**
   * Verarbeitet ein Formular-Submit vollständig
   * @param {Object} options - Optionen für den Submit
   * @returns {Object|null} - Die verarbeiteten Daten oder null bei Fehler
   */
  static async processFormSubmit(options) {
    const {
      formId,
      validationRules = {},
      onSuccess,
      onError,
      loadingText = 'Wird verarbeitet…',
      successText = 'Erfolgreich gespeichert',
      normalText = 'Speichern'
    } = options;

    const form = document.getElementById(formId);
    if (!form) {
      console.error(`Form mit ID ${formId} nicht gefunden`);
      return null;
    }

    const btn = form.querySelector('.mdc-btn.mdc-btn--create, button[type="submit"]');
    
    // Guard gegen Doppelklick
    if (btn?.dataset.locked === 'true') return null;
    
    this.setButtonLoading(btn, true, loadingText, normalText);

    try {
      const formData = new FormData(form);
      const tagBasedValues = this.collectTagBasedSelects(form);
      const submitData = this.formDataToObject(formData, tagBasedValues);

      // Validierung
      if (Object.keys(validationRules).length > 0 && window.validatorSystem) {
        const validation = window.validatorSystem.validateForm(submitData, validationRules);
        
        if (!validation.isValid) {
          this.setButtonLoading(btn, false, loadingText, normalText);
          this.showValidationErrors(validation.errors);
          return null;
        }
      }

      // Callback für Erfolg
      if (onSuccess) {
        const result = await onSuccess(submitData);
        
        if (result?.success) {
          this.setButtonSuccess(btn, successText);
          return submitData;
        } else {
          throw new Error(result?.error || 'Unbekannter Fehler');
        }
      }

      return submitData;

    } catch (error) {
      this.setButtonLoading(btn, false, loadingText, normalText);
      console.error('❌ Formular-Submit Fehler:', error);
      
      if (onError) {
        onError(error);
      } else {
        this.showErrorMessage(error.message);
      }
      
      return null;
    }
  }
}

// Exportiere Instanz für direkten Zugriff
export const formSubmitHelper = FormSubmitHelper;

// Globale Verfügbarkeit für Kompatibilität
if (typeof window !== 'undefined') {
  window.FormSubmitHelper = FormSubmitHelper;
}
