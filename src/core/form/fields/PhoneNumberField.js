import { BaseField } from './BaseField.js';

/**
 * PhoneNumberField - Wiederverwendbare Telefonnummer-Komponente mit Ländervorwahl-Dropdown
 * 
 * Features:
 * - Kombiniertes Feld: Dropdown (Land mit Flagge) + Textfeld (Nummer)
 * - Flaggen-Icons via flag-icons Library
 * - Searchable Dropdown für schnelle Suche
 * - Speichert: land_id (UUID) + telefonnummer (nur Nummer ohne Vorwahl)
 */
export class PhoneNumberField extends BaseField {
  constructor(field, value = {}) {
    super(field, value);
    
    // Werte können als Objekt oder einzelne Felder kommen
    // Sicherstellen dass phoneNumber immer ein String ist
    if (typeof value === 'string') {
      this.phoneNumber = value;
      this.countryId = '';
    } else if (value && typeof value === 'object') {
      this.phoneNumber = value.telefonnummer || '';
      this.countryId = value.land_id || '';
    } else {
      this.phoneNumber = '';
      this.countryId = '';
    }
    this.countries = [];
  }

  render() {
    const required = this.field.required ? 'required' : '';
    const requiredMark = this.field.required ? '<span class="required">*</span>' : '';
    const dependsOn = this.field.dependsOn ? `data-depends-on="${this.field.dependsOn}"` : '';
    const showWhen = this.field.showWhen ? `data-show-when="${this.field.showWhen}"` : '';
    const initialStyle = this.field.dependsOn ? 'style="display: none;"' : '';

    // Name für das Land-Feld (z.B. telefonnummer_land_id)
    const countryFieldName = this.field.nameCountry || `${this.field.name}_land_id`;
    const countryFieldId = `field-${countryFieldName}`;
    const phoneFieldId = `field-${this.field.name}`;
    
    // phoneType: 'mobile' (international +49) oder 'landline' (national 0 für DE)
    const phoneType = this.field.phoneType || 'mobile';
    const placeholder = phoneType === 'landline' ? '30 123 456' : '176 123 4567';

    return `
      <div class="form-field phone-number-field-container" ${dependsOn} ${showWhen} ${initialStyle}>
        <label>${this.field.label} ${requiredMark}</label>
        <div class="phone-number-field">
          <select 
            id="${countryFieldId}" 
            name="${countryFieldName}" 
            class="phone-country-select"
            data-searchable="true"
            data-placeholder="Land wählen..."
            data-table="eu_laender"
            data-display-field="name_de"
            data-value-field="id"
            data-phone-field="true"
            data-phone-type="${phoneType}"
            ${required}>
            <option value="">Land wählen...</option>
          </select>
          <div class="phone-input-wrapper">
            <span class="phone-prefix" style="display: none;"></span>
            <input 
              type="tel" 
              id="${phoneFieldId}" 
              name="${this.field.name}" 
              class="phone-number-input"
              placeholder="${placeholder}"
              value="${this.sanitizeHtml(this.phoneNumber)}"
              autocomplete="off"
              ${required}>
          </div>
        </div>
        
      </div>
    `;
  }

  /**
   * Rendert eine Option mit Flagge, Vorwahl und Ländername
   */
  static renderCountryOption(country, isSelected = false) {
    const selected = isSelected ? 'selected' : '';
    // Format: 🇩🇪 +49 Deutschland
    return `
      <option value="${country.id}" ${selected} data-iso="${country.iso_code}" data-vorwahl="${country.vorwahl}">
        ${country.vorwahl} ${country.name_de}
      </option>
    `;
  }

  /**
   * Lädt die Länder-Daten und initialisiert das Feld
   */
  async loadCountries() {
    try {
      const { data, error } = await window.supabase
        .from('eu_laender')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      
      this.countries = data;
      return data;
    } catch (error) {
      console.error('❌ Fehler beim Laden der Länder:', error);
      return [];
    }
  }

  /**
   * Gibt die Daten für das Formular-Submit zurück
   */
  getValue() {
    return {
      [this.field.name]: this.phoneNumber,
      [this.field.nameCountry || `${this.field.name}_land_id`]: this.countryId
    };
  }

  validateField() {
    const errors = [];
    
    // Wenn Telefonnummer eingegeben wurde, muss auch Land ausgewählt sein
    if (this.phoneNumber && this.phoneNumber.trim() !== '' && !this.countryId) {
      errors.push(`${this.field.label}: Bitte wähle ein Land aus.`);
    }

    // Wenn required und nichts ausgefüllt
    if (this.field.required && (!this.phoneNumber || this.phoneNumber.trim() === '')) {
      errors.push(`${this.field.label} ist erforderlich.`);
    }

    // Basis-Validierung für Telefonnummer (nur Zahlen, Leerzeichen, +, -, ())
    if (this.phoneNumber && this.phoneNumber.trim() !== '') {
      const phoneRegex = /^[0-9\s\-\(\)]+$/;
      if (!phoneRegex.test(this.phoneNumber)) {
        errors.push(`${this.field.label}: Ungültiges Format. Nur Zahlen, Leerzeichen und - ( ) erlaubt.`);
      }
    }

    return errors;
  }
}

