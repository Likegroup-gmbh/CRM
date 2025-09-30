// MarkeCreate.js (ES6-Modul)
// Marke-Erstellungsseite mit Multi-Select für Branchen (wie Unternehmen)

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
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('marke');
    window.content.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neue Marke anlegen</h1>
          <p>Erstellen Sie eine neue Marke für das CRM</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/marke')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
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

      // Formular-Daten sammeln
      const form = document.getElementById('marke-form');
      const formData = new FormData(form);
      const data = {};
      
      // Multi-Select Felder zuerst sammeln (Tag-basierte)
      const allFormData = {};
      
      // Tag-basierte Multi-Selects verarbeiten (genau wie bei Unternehmen)
      const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
      console.log('🏷️ Tag-basierte Selects gefunden:', tagBasedSelects.length);
      
      tagBasedSelects.forEach(select => {
        // Suche das versteckte Select (OHNE [] wie bei Unternehmen)
        let hiddenSelect = form.querySelector(`select[name="${select.name}"][style*="display: none"]`);
        
        // Fallback: Nach allen Selects mit dem gleichen Namen
        if (!hiddenSelect) {
          const allSelects = form.querySelectorAll(`select[name="${select.name}"]`);
          if (allSelects.length > 1) {
            hiddenSelect = allSelects[1]; // Das zweite ist das versteckte
          }
        }
        
        if (hiddenSelect) {
          const selectedValues = Array.from(hiddenSelect.selectedOptions).map(option => option.value).filter(val => val !== '');
          if (selectedValues.length > 0) {
            allFormData[select.name] = selectedValues;
            console.log(`🏷️ Tag-basiertes Multi-Select ${select.name}:`, selectedValues);
          }
        }
      });
      
      // Spezielle Behandlung für Tag-basierte Multi-Selects - versteckte Selects manuell verarbeiten
      // Das versteckte Select wird möglicherweise nicht korrekt von FormData erfasst
      const hiddenBranchenSelect = form.querySelector('select[name="branche_ids[]"]');
      if (hiddenBranchenSelect && hiddenBranchenSelect.multiple) {
        const selectedOptions = Array.from(hiddenBranchenSelect.selectedOptions);
        if (selectedOptions.length > 0) {
          const branchenIds = selectedOptions.map(option => option.value).filter(val => val !== '');
          if (branchenIds.length > 0) {
            allFormData['branche_ids'] = branchenIds;
            console.log('🏷️ MARKECREATE: Verstecktes Branchen-Select manuell verarbeitet:', branchenIds);
          }
        }
      }
      
      // Standard FormData-Einträge sammeln (nur für Felder, die nicht bereits von Tag-basierten Selects verarbeitet wurden)
      for (let [key, value] of formData.entries()) {
        if (!allFormData.hasOwnProperty(key)) {
          if (key.includes('[]')) {
            // Multi-Select Array behandeln (z.B. branche_ids[])
            const cleanKey = key.replace('[]', '');
            // Nur verarbeiten wenn nicht bereits von Tag-basierten Selects verarbeitet
            if (!allFormData[cleanKey]) {
              allFormData[cleanKey] = [];
            }
            allFormData[cleanKey].push(value);
          } else {
            if (allFormData[key]) {
              if (!Array.isArray(allFormData[key])) {
                allFormData[key] = [allFormData[key]];
              }
              allFormData[key].push(value);
            } else {
              allFormData[key] = value;
            }
          }
        }
      }
      
      // Duplikate aus Array-Feldern entfernen
      for (let [key, value] of Object.entries(allFormData)) {
        if (Array.isArray(value)) {
          allFormData[key] = [...new Set(value)]; // Entfernt Duplikate
        }
      }
      
      // Finale Daten zusammenstellen
      for (let [key, value] of Object.entries(allFormData)) {
        data[key] = Array.isArray(value) ? value : value.trim();
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

  // Validierungsfehler anzeigen (kopiert von Unternehmen)
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
