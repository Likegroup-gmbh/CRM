export class FormValidator {
  constructor() {
    this.validator = window.validatorSystem || {
      sanitizeHtml: (text) => text || '',
      validateForm: (data, rules) => ({ isValid: true, errors: {} })
    };
  }

  // Formular-Validierung
  validateFormData(entity, data) {
    const errors = [];
    const config = this.getFormConfig(entity);
    
    if (!config) return errors;

    config.fields.forEach(field => {
      if (field.required && (!data[field.name] || data[field.name].toString().trim() === '')) {
        errors.push(`${field.label} ist erforderlich.`);
      }

      if (field.validation && data[field.name]) {
        const value = data[field.name];
        const fieldErrors = this.validateField(field, value);
        errors.push(...fieldErrors);
      }
    });

    return errors;
  }

  // Einzelnes Feld validieren
  validateField(field, value) {
    const errors = [];
    
    if (!field.validation) return errors;

    switch (field.validation.type) {
      case 'text':
        if (field.validation.minLength && value.length < field.validation.minLength) {
          errors.push(`${field.label} muss mindestens ${field.validation.minLength} Zeichen lang sein.`);
        }
        if (field.validation.maxLength && value.length > field.validation.maxLength) {
          errors.push(`${field.label} darf maximal ${field.validation.maxLength} Zeichen lang sein.`);
        }
        break;

      case 'number':
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          errors.push(`${field.label} muss eine Zahl sein.`);
        } else {
          if (field.validation.min !== undefined && numValue < field.validation.min) {
            errors.push(`${field.label} muss mindestens ${field.validation.min} sein.`);
          }
          if (field.validation.max !== undefined && numValue > field.validation.max) {
            errors.push(`${field.label} darf maximal ${field.validation.max} sein.`);
          }
        }
        break;

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push(`${field.label} muss eine gültige E-Mail-Adresse sein.`);
        }
        break;

      case 'url':
        try {
          new URL(value);
        } catch {
          errors.push(`${field.label} muss eine gültige URL sein.`);
        }
        break;

      case 'phone':
        const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
        if (!phoneRegex.test(value)) {
          errors.push(`${field.label} muss eine gültige Telefonnummer sein.`);
        }
        break;
    }

    return errors;
  }

  // HTML-Sanitization
  sanitizeHtml(text) {
    if (!text) return '';
    
    // Einfache HTML-Entitäten escapen
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  // Validierungsfehler anzeigen
  showValidationErrors(errors) {
    // Alte Fehler entfernen
    document.querySelectorAll('.field-error').forEach(el => el.remove());

    // Neue Fehler anzeigen
    errors.forEach(error => {
      // Finde das entsprechende Feld
      const fieldName = this.extractFieldNameFromError(error);
      if (fieldName) {
        const fieldElement = document.querySelector(`[name="${fieldName}"]`);
        if (fieldElement) {
          const errorElement = document.createElement('div');
          errorElement.className = 'field-error';
          errorElement.textContent = error;
          errorElement.style.cssText = `
            color: #dc2626;
            font-size: 12px;
            margin-top: 4px;
          `;
          fieldElement.parentNode.appendChild(errorElement);
        }
      }
    });

    // Allgemeine Fehlermeldung
    if (errors.length > 0) {
      const message = errors.join('\n');
      alert(`Validierungsfehler:\n${message}`);
    }
  }

  // Feldname aus Fehlermeldung extrahieren
  extractFieldNameFromError(error) {
    // Einfache Heuristik: Suche nach Feldnamen in der Fehlermeldung
    const fieldNames = ['vorname', 'nachname', 'firmenname', 'kampagnenname', 'auftragsname', 'markenname'];
    for (const fieldName of fieldNames) {
      if (error.toLowerCase().includes(fieldName)) {
        return fieldName;
      }
    }
    return null;
  }

  // Erfolgsmeldung anzeigen
  showSuccessMessage(message) {
    console.log(`✅ ${message}`);
    // Hier könnte eine schönere Benachrichtigung implementiert werden
  }

  // Fehlermeldung anzeigen
  showErrorMessage(message) {
    console.error(`❌ ${message}`);
    alert(message);
  }

  // Konfiguration abrufen (wird von außen injiziert)
  getFormConfig(entity) {
    // Diese Methode wird von außen überschrieben
    return null;
  }
} 