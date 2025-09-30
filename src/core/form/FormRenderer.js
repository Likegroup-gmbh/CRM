import { ValidatorSystem } from '../ValidatorSystem.js';
import { UploaderField } from './fields/UploaderField.js';

export class FormRenderer {
  constructor() {
    this.validator = new ValidatorSystem();
  }

  // Hilfsmethode: Field-Label aus dependsOn ermitteln
  getFieldLabel(fieldName) {
    const labelMap = {
      'unternehmen_id': 'Unternehmen',
      'marke_id': 'Marke',
      'auftrag_id': 'Auftrag',
      'kampagne_id': 'Kampagne',
      'creator_id': 'Creator'
    };
    return labelMap[fieldName] || fieldName;
  }

  // Hauptformular rendern
  renderForm(entity, data = null) {
    const config = this.getFormConfig(entity);
    if (!config) {
      console.error(`❌ Keine Konfiguration für Entity: ${entity}`);
      return '';
    }

    const isEdit = !!data;
    const formHtml = this.renderFormOnly(entity, data);
    
    const html = `
      <div class="modal-header">
        <h2>${isEdit ? 'Bearbeiten' : config.title}</h2>
        <button type="button" class="btn-close" aria-label="Schließen">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <form id="${entity}-form" data-entity="${entity}" data-entity-id="${data?.id || ''}">
          ${formHtml}
          <div class="form-actions">
            <button type="button" class="btn-secondary" onclick="this.closest('.modal-content').querySelector('.btn-close').click()">Abbrechen</button>
            <button type="submit" class="mdc-btn mdc-btn--create" data-variant="@create-prd.mdc" data-entity-label="${this.getEntityLabel(entity)}" data-mode="${isEdit ? 'update' : 'create'}">
              <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">${this.getCheckIcon()}</span>
              <span class="mdc-btn__spinner" aria-hidden="true">${this.getSpinnerIcon()}</span>
              <span class="mdc-btn__label">${isEdit ? 'Aktualisieren' : 'Erstellen'}</span>
            </button>
          </div>
        </form>
      </div>
    `;

    return html;
  }

  // Nur das Formular ohne Header rendern
  renderFormOnly(entity, data = null) {
    const config = this.getFormConfig(entity);
    if (!config) return '';

    const fields = config.fields || [];
    // Zweispaltige Gruppen: Video-/Preisfelder und Budget-Paare (USt und Deckungsbeitrag)
    const twoColNames = new Set([
      'influencer','influencer_preis','ugc','ugc_preis','vor_ort_produktion','vor_ort_preis',
      'ust_prozent','ust_betrag','deckungsbeitrag_prozent','deckungsbeitrag_betrag'
    ]);
    const parts = [];
    let inTwoCol = false;
    for (const field of fields) {
      const value = data ? data[field.name] : '';
      const isTwoCol = twoColNames.has(field.name);
      if (isTwoCol && !inTwoCol) {
        parts.push('<div class="form-two-col">');
        inTwoCol = true;
      }
      if (!isTwoCol && inTwoCol) {
        parts.push('</div>');
        inTwoCol = false;
      }
      let html = this.renderField(field, value);
      if (isTwoCol) {
        html = html.replace('<div class="form-field"', '<div class="form-field form-field--half"');
      }
      parts.push(html);
    }
    if (inTwoCol) parts.push('</div>');

    return `
      <form id="${entity}-form" data-entity="${entity}" data-entity-id="${data?.id || data?._entityId || ''}" data-is-edit-mode="${data?._isEditMode ? 'true' : 'false'}">
        ${parts.join('')}
        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="window.navigateTo('/${entity}')">Abbrechen</button>
          <button type="submit" class="mdc-btn mdc-btn--create" data-variant="@create-prd.mdc" data-entity-label="${this.getEntityLabel(entity)}" data-mode="${data ? 'update' : 'create'}">
            <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">${this.getCheckIcon()}</span>
            <span class="mdc-btn__spinner" aria-hidden="true">${this.getSpinnerIcon()}</span>
            <span class="mdc-btn__label">${data ? 'Aktualisieren' : 'Erstellen'}</span>
          </button>
        </div>
      </form>
    `;
  }

  // Einzelnes Feld rendern
  renderField(field, value = '') {
    const fieldId = `field-${field.name}`;
    const required = field.required ? 'required' : '';
    const requiredMark = field.required ? '<span class="required">*</span>' : '';

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
        const textDependsOn = field.dependsOn ? `data-depends-on="${field.dependsOn}"` : '';
        const textShowWhen = field.showWhen ? `data-show-when="${field.showWhen}"` : '';
        const autoGenerateAttr = field.autoGenerate ? `data-auto-generate="true"` : '';
        const readonlyAttr = field.readonly ? 'readonly' : '';
        const placeholder = field.placeholder ? `placeholder="${field.placeholder}"` : '';
        const initialStyle = field.dependsOn ? 'style="display: none;"' : '';
        
        return `
          <div class="form-field" ${textDependsOn} ${textShowWhen} ${initialStyle}>
            <label for="${fieldId}">${field.label} ${requiredMark}</label>
            <input type="${field.type}" id="${fieldId}" name="${field.name}" value="${this.validator.sanitizeHtml(value)}" ${required} ${autoGenerateAttr} ${readonlyAttr} ${placeholder}>
            ${field.autoGenerate ? '<small style="color: #6b7280; font-size: 12px;">Wird automatisch generiert</small>' : ''}
          </div>
        `;

      case 'number':
        const readonly = field.readonly ? 'readonly' : '';
        const autoCalculate = field.autoCalculate ? 'data-auto-calculate="true"' : '';
        const calculatedFrom = field.calculatedFrom ? `data-calculated-from="${field.calculatedFrom.join(',')}"` : '';
        const numberPlaceholder = field.placeholder ? `placeholder="${field.placeholder}"` : '';
        const min = field.validation?.min !== undefined ? `min="${field.validation.min}"` : '';
        const max = field.validation?.max !== undefined ? `max="${field.validation.max}"` : '';
        const step = field.validation?.step !== undefined ? `step="${field.validation.step}"` : 'step="0.01"';
        const defaultValue = field.defaultValue !== undefined && (value === '' || value === undefined || value === null)
          ? `value="${field.defaultValue}"` : `value="${value}"`;
        
        return `
          <div class="form-field">
            <label for="${fieldId}">${field.label} ${requiredMark}</label>
            <input type="number" id="${fieldId}" name="${field.name}" ${defaultValue} ${required} ${readonly} ${autoCalculate} ${calculatedFrom} ${numberPlaceholder} ${min} ${max} ${step}>
            ${field.readonly && field.calculatedFrom ? '<small style="color: #6b7280; font-size: 12px;">Wird automatisch berechnet</small>' : ''}
          </div>
        `;

      case 'date':
        return `
          <div class="form-field">
            <label for="${fieldId}">${field.label} ${requiredMark}</label>
            <input type="date" id="${fieldId}" name="${field.name}" value="${value}" ${required}>
          </div>
        `;

      case 'textarea':
        const textareaDependsOn = field.dependsOn ? `data-depends-on="${field.dependsOn}"` : '';
        const textareaShowWhen = field.showWhen ? `data-show-when="${field.showWhen}"` : '';
        return `
          <div class="form-field form-field-full" ${textareaDependsOn} ${textareaShowWhen}>
            <label for="${fieldId}">${field.label} ${requiredMark}</label>
            <textarea id="${fieldId}" name="${field.name}" rows="4" ${required}>${this.validator.sanitizeHtml(value)}</textarea>
          </div>
        `;

      case 'select':
        let options = '';
        
        if (field.dynamic) {
          // Für abhängige Felder speziellen Placeholder verwenden
          const placeholder = field.dependsOn ? 
            `Erst ${this.getFieldLabel(field.dependsOn)} auswählen...` : 
            (field.placeholder || 'Bitte wählen...');
          options = `<option value="">${placeholder}</option>`;
        } else {
          // Für statische Felder Placeholder hinzufügen
          const placeholder = field.placeholder || 'Bitte wählen...';
          options = `<option value="">${placeholder}</option>`;
          
          // Dann alle Optionen rendern
          options += field.options.map(option => {
            // Unterstütze sowohl String- als auch Objekt-Optionen
            if (typeof option === 'string') {
              const selected = value === option ? 'selected' : '';
              return `<option value="${option}" ${selected}>${option}</option>`;
            } else if (option && typeof option === 'object' && option.value !== undefined) {
              const selected = value === option.value ? 'selected' : '';
              return `<option value="${option.value}" ${selected}>${option.label || option.value}</option>`;
            }
            return '';
          }).join('');
        }
        
        if (field.searchable) {
          const disabled = field.dependsOn ? 'disabled' : '';
          const ro = field.readonly ? 'disabled' : disabled;
          const searchablePlaceholder = field.dependsOn ? 
            `Erst ${this.getFieldLabel(field.dependsOn)} auswählen...` : 
            (field.placeholder || 'Bitte wählen...');
          
          // Data-Attribute für dynamische Felder
          const dataAttrs = [];
          if (field.table) dataAttrs.push(`data-table="${field.table}"`);
          if (field.displayField) dataAttrs.push(`data-display-field="${field.displayField}"`);
          if (field.valueField) dataAttrs.push(`data-value-field="${field.valueField}"`);
          const dataAttrString = dataAttrs.join(' ');
          
          return `
            <div class="form-field">
              <label for="${fieldId}">${field.label} ${requiredMark}</label>
              <select id="${fieldId}" name="${field.name}" ${required} ${ro} data-searchable="true" data-placeholder="${searchablePlaceholder}" ${field.readonly ? 'data-readonly="true"' : ''} ${dataAttrString}>
                ${options}
              </select>
              ${field.readonly ? `<input type="hidden" name="${field.name}" id="${fieldId}-hidden" value="">` : ''}
            </div>
          `;
        }
        
        const disabled = field.dependsOn ? 'disabled' : '';
        const ro = field.readonly ? 'disabled' : disabled;
        
        // Data-Attribute für dynamische Felder
        const dataAttrs = [];
        if (field.table) dataAttrs.push(`data-table="${field.table}"`);
        if (field.displayField) dataAttrs.push(`data-display-field="${field.displayField}"`);
        if (field.valueField) dataAttrs.push(`data-value-field="${field.valueField}"`);
        const dataAttrString = dataAttrs.join(' ');
        
        return `
          <div class="form-field">
            <label for="${fieldId}">${field.label} ${requiredMark}</label>
            <select id="${fieldId}" name="${field.name}" ${required} ${ro} ${field.readonly ? 'data-readonly="true"' : ''} ${dataAttrString}>
              ${options}
            </select>
            ${field.readonly ? `<input type="hidden" name="${field.name}" id="${fieldId}-hidden" value="">` : ''}
          </div>
        `;

      case 'multiselect':
        const selectedValues = Array.isArray(value) ? value : (value ? value.split(',') : []);
        
        let multiOptions = '';
        if (!field.dynamic) {
          multiOptions = field.options.map(option => {
            const selected = selectedValues.includes(option) ? 'selected' : '';
            return `<option value="${option}" ${selected}>${option}</option>`;
          }).join('');
        }
        
        if (field.searchable) {
          // Für Edit-Mode: Bestehende Werte als data-attribute hinzufügen
          const editModeData = selectedValues.length > 0 ? `data-existing-values='${JSON.stringify(selectedValues)}'` : '';
          
          return `
            <div class="form-field">
              <label for="${fieldId}">${field.label} ${requiredMark}</label>
              <select id="${fieldId}" name="${field.name}" ${required} multiple data-searchable="true" data-tag-based="${field.tagBased || 'false'}" data-placeholder="${field.placeholder || 'Bitte wählen...'}" ${editModeData}>
                ${multiOptions}
              </select>
            </div>
          `;
        }
        
        return `
          <div class="form-field">
            <label for="${fieldId}">${field.label} ${requiredMark}</label>
            <select id="${fieldId}" name="${field.name}" ${required} multiple>
              ${multiOptions}
            </select>
          </div>
        `;

      case 'checkbox':
        const isChecked = value === 'on' || value === true || value === 'true' ? 'checked' : '';
        return `
          <div class="form-field">
            <label class="toggle-container">
              <span>${field.label} ${requiredMark}</span>
              <div class="toggle-switch">
                <input type="checkbox" id="${fieldId}" name="${field.name}" ${isChecked} ${required}>
                <span class="toggle-slider"></span>
              </div>
            </label>
          </div>
        `;

      case 'toggle':
        const isToggled = value === 'on' || value === true || value === 'true' || value === 1 ? 'checked' : '';
        return `
          <div class="form-field">
            <label class="toggle-container">
              <span>${field.label} ${requiredMark}</span>
              <div class="toggle-switch">
                <input type="checkbox" id="${fieldId}" name="${field.name}" ${isToggled} ${required}>
                <span class="toggle-slider"></span>
              </div>
            </label>
          </div>
        `;

      case 'custom':
        if (field.customType === 'addresses') {
          return this.renderAddressesField(field, value);
        }
        if (field.customType === 'videos') {
          return this.renderVideosField(field, value);
        }
        if (field.customType === 'file') {
          const accept = field.accept ? `accept="${field.accept}"` : '';
          const multiple = field.multiple ? 'multiple' : '';
          return `
            <div class="form-field">
              <label for="${fieldId}">${field.label} ${requiredMark}</label>
              <input type="file" id="${fieldId}" name="${field.name}" ${required} ${accept} ${multiple}>
            </div>
          `;
        }
        if (field.customType === 'uploader') {
          const containerId = `uploader-${field.name}-${Math.random().toString(36).slice(2)}`;
          // Gerüst rendern; Instanz wird nach Mount aufgebaut
          setTimeout(() => {
            const root = document.getElementById(containerId);
            if (root) {
              const uploader = new UploaderField({ multiple: !!field.multiple, accept: field.accept || '*/*' });
              uploader.mount(root.querySelector('.uploader'));
            }
          }, 0);
          return `
            <div class="form-field" id="${containerId}">
              <label>${field.label} ${requiredMark}</label>
              <div class="uploader" data-name="${field.name}"></div>
            </div>
          `;
        }
        return `<div class="form-field">Unbekannter Feldtyp: ${field.customType}</div>`;

      default:
        return `<div class="form-field">Unbekannter Feldtyp: ${field.type}</div>`;
    }
  }

  // Hilfsmethoden für Button-Icons und Labels
  getCheckIcon() {
    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
  <path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/>
</svg>`;
  }

  getSpinnerIcon() {
    return `
<svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16">
  <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
</svg>`;
  }

  getEntityLabel(entity) {
    switch (entity) {
      case 'kampagne': return 'Kampagne';
      case 'auftrag': return 'Auftrag';
      case 'creator': return 'Creator';
      case 'marke': return 'Marke';
      case 'unternehmen': return 'Unternehmen';
      case 'briefing': return 'Briefing';
      case 'kooperation': return 'Kooperation';
      case 'rechnung': return 'Rechnung';
      case 'ansprechpartner': return 'Ansprechpartner';
      default: return 'Eintrag';
    }
  }

  // Adressen-Feld rendern
  renderAddressesField(field, value = '') {
    const fieldId = `field-${field.name}`;
    const required = field.dependsOn ? `data-depends-on="${field.dependsOn}"` : '';
    const showWhen = field.showWhen ? `data-show-when="${field.showWhen}"` : '';
    
    return `
      <div class="form-field form-field-full" ${required} ${showWhen}>
        <label for="${fieldId}" style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">${field.label}</label>
        <div class="addresses-container" id="${fieldId}">
          <div class="addresses-list" style="margin-bottom: 16px;">
            <!-- Adressen werden hier dynamisch hinzugefügt -->
          </div>
          <button type="button" class="btn btn-secondary btn-sm add-address-btn" style="
            background: #6b7280;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 8px 16px;
            cursor: pointer;
            font-size: 14px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: background-color 0.2s;
          " onmouseover="this.style.background='#4b5563'" onmouseout="this.style.background='#6b7280'">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 16px; height: 16px;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Adresse hinzufügen
          </button>
        </div>
      </div>
    `;
  }

  // Videos-Feld rendern (Repeater mit Content-Art pro Item, kompakt)
  renderVideosField(field, value = '') {
    const fieldId = `field-${field.name}`;
    const options = Array.isArray(field.options) ? field.options : [];
    const optionsAttr = this.validator.sanitizeHtml(JSON.stringify(options));
    return `
      <div class="form-field form-field-full">
        <label for="${fieldId}" class="form-label">${field.label}</label>
        <div class="videos-container" id="${fieldId}" data-options='${optionsAttr}'>
          <div class="videos-list videos-grid"></div>
        </div>
      </div>
    `;
  }

  // Neue Adresszeile hinzufügen
  addAddressRow(addressesList) {
    const addressId = `address-${Date.now()}`;
    const addressHtml = `
      <div class="address-item" data-address-id="${addressId}" style="
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        background: #f9fafb;
      ">
        <div class="address-header" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        ">
          <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: #374151;">Adresse ${addressId}</h4>
          <button type="button" class="btn-remove-address" onclick="this.closest('.address-item').remove()" style="
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
          " onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">
            Entfernen
          </button>
        </div>
        <div class="address-fields" style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        ">
          <div class="form-field" style="grid-column: 1 / -1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Adressname</label>
            <input type="text" name="adressname_${addressId}" placeholder="z.B. Hauptbüro, Filiale, etc." 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Straße</label>
            <input type="text" name="strasse_${addressId}" placeholder="Musterstraße" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Hausnummer</label>
            <input type="text" name="hausnummer_${addressId}" placeholder="123" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">PLZ</label>
            <input type="text" name="plz_${addressId}" placeholder="12345" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Stadt</label>
            <input type="text" name="stadt_${addressId}" placeholder="Musterstadt" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Land</label>
            <input type="text" name="land_${addressId}" placeholder="Deutschland" 
                   style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>
          <div class="form-field" style="grid-column: 1 / -1;">
            <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #374151;">Notiz</label>
            <textarea name="notiz_${addressId}" rows="2" placeholder="Zusätzliche Informationen" 
                      style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; resize: vertical;"></textarea>
          </div>
        </div>
      </div>
    `;
    
    addressesList.insertAdjacentHTML('beforeend', addressHtml);
  }

  // Konfiguration abrufen (wird von außen injiziert)
  getFormConfig(entity) {
    // Diese Methode wird von außen überschrieben
    return null;
  }
} 