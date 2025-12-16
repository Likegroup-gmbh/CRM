import { BaseField } from './BaseField.js';

export class TextField extends BaseField {
  renderInput(required) {
    const readonlyAttr = this.field.readonly ? 'readonly' : '';
    const placeholder = this.field.placeholder ? `placeholder="${this.field.placeholder}"` : '';
    const autoGenerateAttr = this.field.autoGenerate ? `data-auto-generate="true"` : '';
    
    return `
      <input type="${this.field.type}" 
             id="${this.fieldId}" 
             name="${this.field.name}" 
             value="${this.sanitizeHtml(this.value)}" 
             ${required} 
             ${readonlyAttr} 
             ${placeholder}
             ${autoGenerateAttr}>
      ${this.field.autoGenerate ? '<small style="color: #6b7280; font-size: 12px;">Wird automatisch generiert</small>' : ''}
    `;
  }

  validateField() {
    const errors = [];
    const value = this.value;

    if (!this.field.validation) return errors;

    switch (this.field.validation.type) {
      case 'text':
        if (this.field.validation.minLength && value.length < this.field.validation.minLength) {
          errors.push(`${this.field.label} muss mindestens ${this.field.validation.minLength} Zeichen lang sein.`);
        }
        if (this.field.validation.maxLength && value.length > this.field.validation.maxLength) {
          errors.push(`${this.field.label} darf maximal ${this.field.validation.maxLength} Zeichen lang sein.`);
        }
        break;

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push(`${this.field.label} muss eine gültige E-Mail-Adresse sein.`);
        }
        break;

      case 'url':
        try {
          // URL-Felder haben visuellen https:// Prefix - füge diesen zur Validierung hinzu
          let urlToValidate = value.trim();
          if (!urlToValidate.match(/^https?:\/\//i)) {
            urlToValidate = 'https://' + urlToValidate;
          }
          new URL(urlToValidate);
        } catch {
          errors.push(`${this.field.label} muss eine gültige URL sein.`);
        }
        break;

      case 'phone':
        const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
        if (!phoneRegex.test(value)) {
          errors.push(`${this.field.label} muss eine gültige Telefonnummer sein.`);
        }
        break;
    }

    return errors;
  }
} 