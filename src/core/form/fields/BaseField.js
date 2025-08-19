export class BaseField {
  constructor(field, value = '') {
    this.field = field;
    this.value = value;
    this.fieldId = `field-${field.name}`;
  }

  // Basis-Rendering-Methode
  render() {
    const required = this.field.required ? 'required' : '';
    const requiredMark = this.field.required ? '<span class="required">*</span>' : '';
    const dependsOn = this.field.dependsOn ? `data-depends-on="${this.field.dependsOn}"` : '';
    const showWhen = this.field.showWhen ? `data-show-when="${this.field.showWhen}"` : '';
    const initialStyle = this.field.dependsOn ? 'style="display: none;"' : '';

    return `
      <div class="form-field" ${dependsOn} ${showWhen} ${initialStyle}>
        <label for="${this.fieldId}">${this.field.label} ${requiredMark}</label>
        ${this.renderInput(required)}
      </div>
    `;
  }

  // Input-Rendering (muss von Unterklassen überschrieben werden)
  renderInput(required) {
    throw new Error('renderInput muss von Unterklassen implementiert werden');
  }

  // HTML-Sanitization
  sanitizeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  // Feld-Validierung
  validate() {
    const errors = [];
    
    // Required-Validierung
    if (this.field.required && (!this.value || this.value.toString().trim() === '')) {
      errors.push(`${this.field.label} ist erforderlich.`);
    }

    // Spezifische Validierung
    if (this.field.validation && this.value) {
      const fieldErrors = this.validateField();
      errors.push(...fieldErrors);
    }

    return errors;
  }

  // Feld-spezifische Validierung (muss von Unterklassen überschrieben werden)
  validateField() {
    return [];
  }

  // Event-Handler einrichten
  setupEvents(element) {
    // Basis-Events können hier hinzugefügt werden
    if (this.field.autoGenerate) {
      element.setAttribute('data-auto-generate', 'true');
    }
  }
} 