import { BaseField } from './BaseField.js';

/**
 * CountryField - Wiederverwendbare Länder-Auswahl mit Flaggen-Icons
 * 
 * Analog zu PhoneNumberField, aber ohne Telefonnummer-Input.
 * Speichert: land_id (UUID) als FK auf eu_laender
 */
export class CountryField extends BaseField {
  constructor(field, value = '') {
    super(field, value);
    this.countryId = value || '';
    this.countries = [];
  }

  render() {
    const required = this.field.required ? 'required' : '';
    const requiredMark = this.field.required ? '<span class="required">*</span>' : '';
    const dependsOn = this.field.dependsOn ? `data-depends-on="${this.field.dependsOn}"` : '';
    const showWhen = this.field.showWhen ? `data-show-when="${this.field.showWhen}"` : '';
    const initialStyle = this.field.dependsOn ? 'style="display: none;"' : '';

    const fieldId = `field-${this.field.name}`;

    return `
      <div class="form-field" ${dependsOn} ${showWhen} ${initialStyle}>
        <label for="${fieldId}">${this.field.label} ${requiredMark}</label>
        <select 
          id="${fieldId}" 
          name="${this.field.name}" 
          class="country-select"
          data-searchable="true"
          data-placeholder="${this.field.placeholder || 'Land wählen...'}"
          data-table="eu_laender"
          data-display-field="name_de"
          data-value-field="id"
          data-country-field="true"
          ${required}>
          <option value="">${this.field.placeholder || 'Land wählen...'}</option>
        </select>
      </div>
    `;
  }

  static renderCountryOption(country, isSelected = false) {
    const selected = isSelected ? 'selected' : '';
    return `
      <option value="${country.id}" ${selected} data-iso="${country.iso_code}">
        ${country.name_de}
      </option>
    `;
  }

  getValue() {
    return {
      [this.field.name]: this.countryId
    };
  }

  validateField() {
    const errors = [];
    if (this.field.required && !this.countryId) {
      errors.push(`${this.field.label} ist erforderlich.`);
    }
    return errors;
  }
}
