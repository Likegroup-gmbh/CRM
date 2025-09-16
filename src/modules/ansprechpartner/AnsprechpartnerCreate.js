// AnsprechpartnerCreate.js (ES6-Modul)
// Ansprechpartner-Erstellungsseite mit Multi-Select für Marken (wie Unternehmen/Marken)

export class AnsprechpartnerCreate {
  constructor() {
    this.formData = {};
  }

  // Initialisiere Ansprechpartner-Erstellung
  async init() {
    console.log('🎯 ANSPRECHPARTNERCREATE: Initialisiere Ansprechpartner-Erstellung');
    this.showCreateForm();
  }

  // Show Create Form
  showCreateForm() {
    console.log('🎯 ANSPRECHPARTNERCREATE: Zeige Ansprechpartner-Erstellungsformular mit FormSystem');
    window.setHeadline('Neuen Ansprechpartner anlegen');
    
    // Formular direkt in content rendern
    const formHtml = window.formSystem.renderFormOnly('ansprechpartner');
    window.content.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neuen Ansprechpartner anlegen</h1>
          <p>Erstellen Sie einen neuen Ansprechpartner für das CRM</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/ansprechpartner')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    // Formular-Events binden
    window.formSystem.bindFormEvents('ansprechpartner', null);
    
    // Custom Submit Handler für Seiten-Formular (wie bei Unternehmen/Marken)
    const form = document.getElementById('ansprechpartner-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      };
    }
  }

  // Handle Form Submit für Seiten-Formular (kopiert von MarkeCreate)
  async handleFormSubmit() {
    // Loading-State Variablen außerhalb des try-Blocks deklarieren
    let originalText = 'Ansprechpartner anlegen'; // Default-Text
    
    try {
      console.log('🎯 ANSPRECHPARTNERCREATE: Verarbeite Formular-Submit');
      
      // Loading-State
      const submitBtn = document.querySelector('#ansprechpartner-form button[type="submit"]');
      if (submitBtn) {
        originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<div class="loading-spinner"></div> Wird angelegt...';
        submitBtn.disabled = true;
      }

      // Formular-Daten sammeln
      const form = document.getElementById('ansprechpartner-form');
      const formData = new FormData(form);
      const data = {};
      
      // FormData-Einträge sammeln (mit Multi-Select Support)
      for (let [key, value] of formData.entries()) {
        if (value.trim() !== '') {
          // Multi-Select Felder (Array-Behandlung)
          if (data[key]) {
            if (!Array.isArray(data[key])) {
              data[key] = [data[key]];
            }
            data[key].push(value.trim());
          } else {
            data[key] = value.trim();
          }
        }
      }
      
      // Multi-Select Felder in Arrays konvertieren falls nur ein Wert
      if (data.marke_ids && !Array.isArray(data.marke_ids)) {
        data.marke_ids = [data.marke_ids];
      }
      
      console.log('📤 Finale Ansprechpartner-Daten:', data);

      // Validierung (wie bei Marken)
      const validation = window.validatorSystem.validateForm(data, {
        vorname: { type: 'text', minLength: 2, required: true },
        nachname: { type: 'text', minLength: 2, required: true }
      });
      
      if (!validation.isValid) {
        this.showValidationErrors(validation.errors);
        return;
      }

      // Ansprechpartner erstellen
      const result = await window.dataService.createEntity('ansprechpartner', data);
      
      if (result.success) {
        this.showSuccessMessage('Ansprechpartner erfolgreich erstellt!');
        
        // Kurz warten, dann zur Übersicht
        setTimeout(() => {
          window.navigateTo('/ansprechpartner');
        }, 1500);
      } else {
        throw new Error(result.error || 'Fehler beim Erstellen des Ansprechpartners');
      }
      
    } catch (error) {
      console.error('❌ Fehler beim Erstellen des Ansprechpartners:', error);
      this.showErrorMessage(error.message || 'Ein unerwarteter Fehler ist aufgetreten');
    } finally {
      // Loading-State zurücksetzen
      const submitBtn = document.querySelector('#ansprechpartner-form button[type="submit"]');
      if (submitBtn) {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    }
  }

  // Validierungsfehler anzeigen (kopiert von MarkeCreate)
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
  
  // Erfolgsmeldung anzeigen (kopiert von MarkeCreate)
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
  
  // Fehlermeldung anzeigen (kopiert von MarkeCreate)
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
    console.log('🎯 ANSPRECHPARTNERCREATE: Destroy');
  }
}

// Exportiere Instanz für globale Nutzung
export const ansprechpartnerCreate = new AnsprechpartnerCreate();
