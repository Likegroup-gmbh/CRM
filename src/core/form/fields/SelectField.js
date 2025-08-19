import { BaseField } from './BaseField.js';

export class SelectField extends BaseField {
  renderInput(required) {
    const options = this.renderOptions();
    
    if (this.field.searchable) {
      return `
        <select id="${this.fieldId}" 
                name="${this.field.name}" 
                ${required} 
                data-searchable="true" 
                data-placeholder="${this.field.placeholder || 'Bitte wählen...'}">
          <option value="">${this.field.placeholder || 'Bitte wählen...'}</option>
          ${options}
        </select>
      `;
    }
    
    return `
      <select id="${this.fieldId}" name="${this.field.name}" ${required}>
        <option value="">Bitte wählen...</option>
        ${options}
      </select>
    `;
  }

  renderOptions() {
    if (!this.field.options) return '';
    
    return this.field.options.map(option => {
      const selected = this.value === option ? 'selected' : '';
      return `<option value="${option}" ${selected}>${option}</option>`;
    }).join('');
  }

  validateField() {
    const errors = [];
    
    // Für Select-Felder: Prüfe ob ein Wert ausgewählt wurde
    if (this.field.required && (!this.value || this.value === '')) {
      errors.push(`${this.field.label} muss ausgewählt werden.`);
    }

    return errors;
  }
}

export class MultiSelectField extends BaseField {
  renderInput(required) {
    const selectedValues = Array.isArray(this.value) ? this.value : (this.value ? this.value.split(',') : []);
    
    let multiOptions = '';
    if (!this.field.dynamic) {
      multiOptions = this.field.options.map(option => {
        const selected = selectedValues.includes(option) ? 'selected' : '';
        return `<option value="${option}" ${selected}>${option}</option>`;
      }).join('');
    }
    
    if (this.field.searchable) {
      return `
        <select id="${this.fieldId}" 
                name="${this.field.name}" 
                multiple 
                ${required} 
                data-searchable="true" 
                data-tag-based="${this.field.tagBased || 'false'}" 
                data-placeholder="${this.field.placeholder || 'Bitte wählen...'}">
          ${multiOptions}
        </select>
      `;
    }
    
    return `
      <select id="${this.fieldId}" name="${this.field.name}" multiple ${required}>
        ${multiOptions}
      </select>
    `;
  }

  validateField() {
    const errors = [];
    
    // Für Multi-Select: Prüfe ob mindestens ein Wert ausgewählt wurde
    if (this.field.required) {
      const selectedValues = Array.isArray(this.value) ? this.value : (this.value ? this.value.split(',') : []);
      if (selectedValues.length === 0) {
        errors.push(`${this.field.label} muss mindestens eine Option ausgewählt werden.`);
      }
    }

    return errors;
  }
} 