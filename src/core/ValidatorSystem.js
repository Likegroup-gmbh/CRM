// ValidatorSystem.js (ES6-Modul)
// Zentrale Validierung und HTML-Sanitization

export class ValidatorSystem {
  constructor() {
    this.sanitizeCache = new Map();
  }

  // HTML sanitize
  sanitizeHtml(html) {
    if (!html || typeof html !== 'string') {
      return '';
    }

    // Cache prüfen
    if (this.sanitizeCache.has(html)) {
      return this.sanitizeCache.get(html);
    }

    // Einfache HTML-Sanitization
    let sanitized = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    // Cache speichern
    this.sanitizeCache.set(html, sanitized);
    
    return sanitized;
  }

  // Email validieren
  validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  // Telefonnummer validieren
  validatePhone(phone) {
    if (!phone || typeof phone !== 'string') {
      return false;
    }
    
    // Entferne alle nicht-numerischen Zeichen außer +, -, (, )
    const cleaned = phone.replace(/[^\d+\-\(\)\s]/g, '');
    return cleaned.length >= 10;
  }

  // URL validieren
  validateUrl(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }
    
    try {
      // URL-Felder haben visuellen https:// Prefix - füge diesen zur Validierung hinzu
      let urlToValidate = url.trim();
      if (!urlToValidate.match(/^https?:\/\//i)) {
        urlToValidate = 'https://' + urlToValidate;
      }
      new URL(urlToValidate);
      return true;
    } catch {
      return false;
    }
  }

  // URL sanitize - verhindert javascript: und andere gefährliche Schemas
  // Gibt null zurück wenn URL ungültig oder gefährlich ist
  sanitizeUrl(url) {
    if (!url || typeof url !== 'string') {
      return null;
    }
    
    try {
      const trimmed = url.trim();
      // Erlaubte Schemas: http, https
      // Wenn kein Schema, füge https:// hinzu
      let urlToCheck = trimmed;
      if (!urlToCheck.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:/)) {
        urlToCheck = 'https://' + urlToCheck;
      }
      
      const parsed = new URL(urlToCheck);
      
      // Nur http und https erlauben - blockiert javascript:, data:, vbscript:, etc.
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        console.warn('🛡️ VALIDATOR: Unsicheres URL-Schema blockiert:', parsed.protocol);
        return null;
      }
      
      return parsed.href;
    } catch {
      return null;
    }
  }

  // Bild-URL sanitize - zusätzliche Prüfung für Bild-Quellen
  sanitizeImageUrl(url) {
    const sanitized = this.sanitizeUrl(url);
    if (!sanitized) return null;
    
    // Optional: Zusätzliche Prüfungen für Bild-URLs
    // z.B. bekannte CDN-Domains erlauben
    return sanitized;
  }

  // Zahl validieren
  validateNumber(value, min = null, max = null) {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return false;
    }
    
    if (min !== null && num < min) {
      return false;
    }
    
    if (max !== null && num > max) {
      return false;
    }
    
    return true;
  }

  // Text validieren
  validateText(text, minLength = 0, maxLength = null) {
    if (!text || typeof text !== 'string') {
      return false;
    }
    
    const length = text.trim().length;
    
    if (length < minLength) {
      return false;
    }
    
    if (maxLength !== null && length > maxLength) {
      return false;
    }
    
    return true;
  }

  // Pflichtfeld validieren
  validateRequired(value) {
    if (value === null || value === undefined) {
      return false;
    }
    
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    
    return true;
  }

  // Formular validieren
  validateForm(formData, rules) {
    const errors = {};
    
    for (const [field, rule] of Object.entries(rules)) {
      const value = formData[field];
      
      // Pflichtfeld prüfen
      if (rule.required && !this.validateRequired(value)) {
        errors[field] = `${field} ist erforderlich`;
        continue;
      }
      
      // Wenn Feld leer ist und nicht erforderlich, überspringe weitere Validierung
      if (!this.validateRequired(value)) {
        continue;
      }
      
      // Email validieren
      if (rule.type === 'email' && !this.validateEmail(value)) {
        errors[field] = 'Ungültige Email-Adresse';
        continue;
      }
      
      // Telefon validieren
      if (rule.type === 'phone' && !this.validatePhone(value)) {
        errors[field] = 'Ungültige Telefonnummer';
        continue;
      }
      
      // URL validieren
      if (rule.type === 'url' && !this.validateUrl(value)) {
        errors[field] = 'Ungültige URL';
        continue;
      }
      
      // Zahl validieren
      if (rule.type === 'number') {
        if (!this.validateNumber(value, rule.min, rule.max)) {
          errors[field] = 'Ungültige Zahl';
          continue;
        }
      }
      
      // Text validieren
      if (rule.type === 'text') {
        if (!this.validateText(value, rule.minLength, rule.maxLength)) {
          errors[field] = 'Ungültiger Text';
          continue;
        }
      }
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  // Cache leeren
  clearCache() {
    this.sanitizeCache.clear();
  }
}

// Exportiere Instanz
export const validatorSystem = new ValidatorSystem();

// Globale Funktionen für Kompatibilität
if (typeof window !== 'undefined') {
  window.Validator = {
    sanitizeHtml: (html) => validatorSystem.sanitizeHtml(html),
    sanitizeUrl: (url) => validatorSystem.sanitizeUrl(url),
    sanitizeImageUrl: (url) => validatorSystem.sanitizeImageUrl(url),
    validateEmail: (email) => validatorSystem.validateEmail(email),
    validatePhone: (phone) => validatorSystem.validatePhone(phone),
    validateUrl: (url) => validatorSystem.validateUrl(url),
    validateNumber: (value, min, max) => validatorSystem.validateNumber(value, min, max),
    validateText: (text, minLength, maxLength) => validatorSystem.validateText(text, minLength, maxLength),
    validateRequired: (value) => validatorSystem.validateRequired(value),
    validateForm: (formData, rules) => validatorSystem.validateForm(formData, rules)
  };
}
