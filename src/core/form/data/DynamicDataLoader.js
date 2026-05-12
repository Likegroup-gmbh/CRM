import staticDataCache from '../../cache/StaticDataCache.js';
import {
  loadFieldOptions,
  loadKooperationenOhneRechnung,
  loadBenutzerOptions,
  loadZieleOptions,
  loadAnsprechpartnerOptions
} from './FieldOptionsLoader.js';
import { loadDirectQueryOptions } from './DirectQueryLoader.js';
import {
  loadKampagneDependentFieldsImproved,
  setKampagneFieldAsReadonly,
  loadKampagneDependentFields,
  loadAuftragDependentFieldsImproved,
  loadRechnungDependentFieldsImproved,
  prefillMitarbeiterFromUnternehmen
} from './EditModeDataSetter.js';
import {
  handleKooperationPrefill,
  prefillAndLockField,
  disableFieldWithMessage
} from './PrefillHandler.js';

export class DynamicDataLoader {
  constructor({ getFormConfig, createSearchableSelect, reinitializeSearchableSelect } = {}) {
    this.dataService = window.dataService;
    this.cache = staticDataCache;
    this.getFormConfig = getFormConfig || (() => null);
    this.createSearchableSelect = createSearchableSelect || (() => {});
    this.reinitializeSearchableSelect = reinitializeSearchableSelect || (() => {});
  }

  setDataService(dataService) {
    this.dataService = dataService;
  }

  // Dynamische Formulardaten laden - paralleles Laden aller Feldoptionen
  async loadDynamicFormData(entity, form) {
    try {
      const config = this.getFormConfig(entity);
      if (!config) return;

      const fields = config.fields || [];
      const loadPromises = [];

      for (const field of fields) {
        if (field.dynamic) {
          loadPromises.push(this.loadFieldOptions(entity, field, form));
        }
      }

      loadPromises.push(this.loadPhoneFieldCountries(form));
      loadPromises.push(this.loadCountryFieldCountries(form));

      await Promise.all(loadPromises);
    } catch (error) {
      console.error('❌ Fehler beim Laden der dynamischen Formulardaten:', error);
    }
  }

  // Lade Länder für Phone-Fields
  async loadPhoneFieldCountries(form) {
    try {
      const phoneCountrySelects = form.querySelectorAll('select[data-phone-field="true"]');

      if (phoneCountrySelects.length === 0) {
        return;
      }

      const countries = await this.cache.get('eu_laender', '*', 'sort_order');

      if (!countries || countries.length === 0) {
        console.error('❌ Keine EU-Länder geladen');
        return;
      }

      phoneCountrySelects.forEach(select => {
        while (select.options.length > 1) {
          select.remove(1);
        }

        countries.forEach(country => {
          const option = document.createElement('option');
          option.value = country.id;
          option.textContent = `${country.vorwahl} ${country.name_de}`;
          option.dataset.isoCode = country.iso_code;
          option.dataset.vorwahl = country.vorwahl;
          option.dataset.customProperties = JSON.stringify({
            isoCode: country.iso_code,
            vorwahl: country.vorwahl
          });
          select.appendChild(option);
        });
      });

      phoneCountrySelects.forEach(select => {
        if (form.dataset.isEditMode === 'true' && form.dataset.editModeData) {
          try {
            const editData = JSON.parse(form.dataset.editModeData);
            const countryFieldName = select.name;
            const savedCountryId = editData[countryFieldName];

            if (savedCountryId) {
              const savedCountryOption = Array.from(select.options).find(opt =>
                opt.value === savedCountryId
              );
              if (savedCountryOption) {
                savedCountryOption.selected = true;
                select.value = savedCountryId;
              }
            }
          } catch (e) {
          }
        } else if (!select.value) {
          const deutschlandOption = Array.from(select.options).find(opt =>
            opt.dataset.isoCode === 'de'
          );
          if (deutschlandOption) {
            deutschlandOption.selected = true;
            select.value = deutschlandOption.value;
          }
        }

        const options = Array.from(select.options).slice(1).map(option => ({
          value: option.value,
          label: option.textContent,
          isoCode: option.dataset.isoCode,
          vorwahl: option.dataset.vorwahl,
          selected: option.selected || option.value === select.value
        }));

        if (this.createSearchableSelect) {
          this.createSearchableSelect(select, options, {
            placeholder: select.dataset.placeholder || 'Land wählen...',
            type: 'phone'
          });

          if (select.value) {
            const selectedOption = options.find(opt => opt.value === select.value);
            if (selectedOption) {
              const container = select.nextElementSibling;
              if (container && container.classList.contains('searchable-select-container')) {
                const input = container.querySelector('input');
                if (input) {
                  input.value = selectedOption.label.replace(selectedOption.vorwahl, '').trim();
                  input.dataset.selectedIsoCode = selectedOption.isoCode;
                }

                const flagIcon = container.querySelector('.phone-flag-icon');
                if (flagIcon && selectedOption.isoCode) {
                  flagIcon.className = `phone-flag-icon fi fi-${selectedOption.isoCode.toLowerCase()}`;
                }

                const phoneType = select.dataset.phoneType || 'mobile';

                const phoneNumberField = container.closest('.phone-number-field');

                const phoneWrapper = phoneNumberField?.querySelector('.phone-input-wrapper');

                if (phoneWrapper && selectedOption.vorwahl) {
                  const prefixSpan = phoneWrapper.querySelector('.phone-prefix');
                  const phoneInput = phoneWrapper.querySelector('.phone-number-input');

                  if (prefixSpan && phoneInput) {
                    const prefix = this.getPhonePrefix(phoneType, selectedOption.isoCode, selectedOption.vorwahl);

                    prefixSpan.textContent = prefix;
                    prefixSpan.style.display = 'inline-block';

                    if (phoneInput.value.startsWith(selectedOption.vorwahl)) {
                      phoneInput.value = phoneInput.value.substring(selectedOption.vorwahl.length).trim();
                    }
                    if (phoneInput.value.startsWith('0')) {
                      phoneInput.value = phoneInput.value.substring(1).trim();
                    }

                    phoneInput.dataset.vorwahl = selectedOption.vorwahl;
                    phoneInput.dataset.phoneType = phoneType;
                  }
                }
              }
            }
          }

          select.addEventListener('change', (e) => {
            const selectedValue = e.target.value;
            const selectedOption = options.find(opt => opt.value === selectedValue);

            if (selectedOption) {
              const container = select.nextElementSibling;
              if (container && container.classList.contains('searchable-select-container')) {
                const flagIcon = container.querySelector('.phone-flag-icon');
                if (flagIcon && selectedOption.isoCode) {
                  flagIcon.className = `phone-flag-icon fi fi-${selectedOption.isoCode.toLowerCase()}`;
                }

                const phoneType = select.dataset.phoneType || 'mobile';
                const phoneWrapper = container.parentElement.querySelector('.phone-input-wrapper');
                if (phoneWrapper && selectedOption.vorwahl) {
                  const prefixSpan = phoneWrapper.querySelector('.phone-prefix');
                  const phoneInput = phoneWrapper.querySelector('.phone-number-input');

                  if (prefixSpan && phoneInput) {
                    const prefix = this.getPhonePrefix(phoneType, selectedOption.isoCode, selectedOption.vorwahl);

                    prefixSpan.textContent = prefix;
                    prefixSpan.style.display = 'inline-block';

                    const oldVorwahl = phoneInput.dataset.vorwahl;
                    if (oldVorwahl && phoneInput.value.startsWith(oldVorwahl)) {
                      phoneInput.value = phoneInput.value.substring(oldVorwahl.length).trim();
                    }
                    if (phoneInput.value.startsWith('0')) {
                      phoneInput.value = phoneInput.value.substring(1).trim();
                    }

                    phoneInput.dataset.vorwahl = selectedOption.vorwahl;
                  }
                }
              }
            }
          });
        }
      });
    } catch (error) {
      console.error('❌ Fehler beim Laden der Phone-Field-Länder:', error);
    }
  }

  // Korrekter Telefon-Prefix basierend auf phoneType und Land (mobile: intl, landline: 0 für DE, sonst intl)
  getPhonePrefix(phoneType, isoCode, vorwahl) {
    if (phoneType === 'mobile') {
      return vorwahl;
    }

    if (phoneType === 'landline') {
      if (isoCode?.toLowerCase() === 'de') {
        return '0';
      }
      return vorwahl;
    }

    return vorwahl;
  }

  // Lade Länder für Country-Fields (Länder-Dropdown ohne Telefonnummer)
  async loadCountryFieldCountries(form) {
    try {
      const countrySelects = form.querySelectorAll('select[data-country-field="true"]');

      if (countrySelects.length === 0) {
        return;
      }

      const countries = await this.cache.get('eu_laender', '*', 'sort_order');

      if (!countries || countries.length === 0) {
        console.error('❌ Keine Länder geladen für Country-Fields');
        return;
      }

      countrySelects.forEach(select => {
        while (select.options.length > 1) {
          select.remove(1);
        }

        countries.forEach(country => {
          const option = document.createElement('option');
          option.value = country.id;
          option.textContent = country.name_de;
          option.dataset.isoCode = country.iso_code;
          select.appendChild(option);
        });
      });

      countrySelects.forEach(select => {
        if (form.dataset.isEditMode === 'true' && form.dataset.editModeData) {
          try {
            const editData = JSON.parse(form.dataset.editModeData);
            const savedCountryId = editData[select.name];

            if (savedCountryId) {
              const savedOption = Array.from(select.options).find(opt => opt.value === savedCountryId);
              if (savedOption) {
                savedOption.selected = true;
                select.value = savedCountryId;
              }
            }
          } catch (e) {
          }
        } else if (!select.value) {
          const deutschlandOption = Array.from(select.options).find(opt => opt.dataset.isoCode === 'de');
          if (deutschlandOption) {
            deutschlandOption.selected = true;
            select.value = deutschlandOption.value;
          }
        }

        const options = Array.from(select.options).slice(1).map(option => ({
          value: option.value,
          label: option.textContent,
          isoCode: option.dataset.isoCode,
          selected: option.selected || option.value === select.value
        }));

        if (this.createSearchableSelect) {
          this.createSearchableSelect(select, options, {
            placeholder: select.dataset.placeholder || 'Land wählen...',
            type: 'country'
          });
        }
      });
    } catch (error) {
      console.error('❌ Fehler beim Laden der Country-Field-Länder:', error);
    }
  }

  // Select-Optionen aktualisieren (Fill + selected setzen + Searchable reinit)
  updateSelectOptions(selectElement, options, field) {
    const form = selectElement.closest('form');

    // Prefill-Wert sichern, bevor wir innerHTML resetten. Searchable-Selects
    // entfernen das `name`-Attribut, daher hidden input als Fallback.
    const hiddenInputForName = form?.querySelector(`input[type="hidden"][name="${field.name}"]`);
    const prefilledValue = selectElement.dataset.prefilledValue
      || (selectElement.dataset.prefilled === 'true' ? selectElement.value : '')
      || (selectElement.dataset.prefilled === 'true' ? (hiddenInputForName?.value || '') : '');
    const prefilledLabel = selectElement.dataset.prefilledLabel || '';
    const isPrefilled = selectElement.dataset.prefilled === 'true' && !!prefilledValue;

    selectElement.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = field.placeholder || 'Bitte wählen...';
    selectElement.appendChild(placeholder);

    let editModeValue = null;
    if (form && form.dataset.isEditMode === 'true' && form.dataset.editModeData) {
      try {
        const editData = JSON.parse(form.dataset.editModeData);
        editModeValue = editData[field.name];
      } catch (e) {
        // ignore
      }
    }

    const isCreateMode = !form || form.dataset.isEditMode !== 'true';
    const defaultValue = isCreateMode && field.defaultValue !== undefined ? field.defaultValue : null;

    let prefillFoundInOptions = false;
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.label;

      if (
        option.selected
        || (editModeValue && option.value === editModeValue)
        || (defaultValue && option.value === String(defaultValue))
        || (isPrefilled && String(option.value) === String(prefilledValue))
      ) {
        optionElement.selected = true;
        option.selected = true;
        if (isPrefilled && String(option.value) === String(prefilledValue)) {
          prefillFoundInOptions = true;
        }
      }
      selectElement.appendChild(optionElement);
    });

    // Falls Prefill-Wert nicht in den geladenen Optionen vorhanden ist
    // (z.B. weil eine vorausgefuellte Kampagne fuer diese Marke gar nicht in der
    // Liste auftaucht), trotzdem als Option einfuegen, damit der Wert erhalten
    // bleibt und auch der Searchable das Display korrekt setzen kann.
    if (isPrefilled && !prefillFoundInOptions) {
      const fallbackOpt = document.createElement('option');
      fallbackOpt.value = prefilledValue;
      fallbackOpt.textContent = prefilledLabel || prefilledValue;
      fallbackOpt.selected = true;
      selectElement.appendChild(fallbackOpt);
      options = [
        ...options,
        { value: prefilledValue, label: prefilledLabel || prefilledValue, selected: true }
      ];
    }

    if (isPrefilled) {
      selectElement.value = prefilledValue;
    }

    if (selectElement.dataset.searchable === 'true') {
      const normalized = options.map(o => ({
        value: o.value,
        label: o.label,
        selected: o.selected || (isPrefilled && String(o.value) === String(prefilledValue))
      }));

      this.reinitializeSearchableSelect(selectElement, normalized, field);

      // Nach Reinit den frischen Searchable-Container locken, damit der User
      // den vorausgefuellten Wert sieht und nicht mehr aendern kann.
      if (isPrefilled) {
        this.applyPrefillLockToSearchable(selectElement, field, prefilledValue, prefilledLabel);
      }
      return;
    }

    if (isPrefilled) {
      selectElement.disabled = true;
    }
  }

  // Searchable nach Reinit visuell wieder als prefilled markieren + locken
  applyPrefillLockToSearchable(selectElement, field, value, label) {
    const form = selectElement.closest('form');
    if (!form) return;

    const findContainer = () => {
      if (selectElement.previousElementSibling?.classList?.contains('searchable-select-container')) {
        return selectElement.previousElementSibling;
      }
      if (selectElement.nextElementSibling?.classList?.contains('searchable-select-container')) {
        return selectElement.nextElementSibling;
      }
      if (selectElement.parentNode) {
        const inParent = selectElement.parentNode.querySelector('.searchable-select-container');
        if (inParent) return inParent;
      }
      const formField = selectElement.closest('.form-field, .form-group');
      return formField?.querySelector('.searchable-select-container') || null;
    };

    const apply = () => {
      const container = findContainer();
      if (!container) return false;

      const input = container.querySelector('.searchable-select-input');
      if (input) {
        if (label) input.value = label;
        input.disabled = true;
        input.readOnly = true;
      }
      container.classList.add('prefilled-locked');

      const hiddenInput = container.querySelector(`input[type="hidden"][name="${field.name}"]`)
        || form.querySelector(`input[type="hidden"][name="${field.name}"]`);
      if (hiddenInput) {
        hiddenInput.value = value;
      }

      const formField = container.closest('.form-field, .form-group')
        || selectElement.closest('.form-field, .form-group');
      if (formField) {
        formField.classList.add('form-field--prefilled');
        const lbl = formField.querySelector('label');
        if (lbl && !lbl.querySelector('.prefill-badge')) {
          const badge = document.createElement('span');
          badge.className = 'prefill-badge';
          badge.textContent = ' (aus Kampagne)';
          lbl.appendChild(badge);
        }
      }

      // Aenderung signalisieren, damit Auto-Gen / Folge-Cascades den Wert sehen
      selectElement.dispatchEvent(new Event('change', { bubbles: true }));
      if (hiddenInput) {
        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return true;
    };

    if (!apply()) {
      // Container koennte erst im naechsten Frame fertig sein
      requestAnimationFrame(() => {
        if (!apply()) {
          setTimeout(apply, 50);
        }
      });
    }
  }


  // ===== Delegationen an ausgelagerte Module =====

  async loadFieldOptions(entity, field, form) {
    return loadFieldOptions.call(this, entity, field, form);
  }

  async loadDirectQueryOptions(field, form) {
    return loadDirectQueryOptions.call(this, field, form);
  }

  async loadKooperationenOhneRechnung() {
    return loadKooperationenOhneRechnung();
  }

  async loadBenutzerOptions(filter = {}) {
    return loadBenutzerOptions(filter);
  }

  async loadZieleOptions(tableName) {
    return loadZieleOptions(tableName);
  }

  async loadAnsprechpartnerOptions(field, form) {
    return loadAnsprechpartnerOptions(field, form);
  }

  async loadKampagneDependentFieldsImproved(field, form, options) {
    return loadKampagneDependentFieldsImproved(field, form, options);
  }

  setKampagneFieldAsReadonly(field, form) {
    return setKampagneFieldAsReadonly(field, form);
  }

  async loadKampagneDependentFields(field, form, options) {
    return loadKampagneDependentFields(field, form, options);
  }

  async loadAuftragDependentFieldsImproved(field, form, options) {
    return loadAuftragDependentFieldsImproved(field, form, options);
  }

  async loadRechnungDependentFieldsImproved(field, form, options) {
    return loadRechnungDependentFieldsImproved(field, form, options);
  }

  async prefillMitarbeiterFromUnternehmen(form, unternehmenId) {
    return prefillMitarbeiterFromUnternehmen(form, unternehmenId);
  }

  async handleKooperationPrefill(form) {
    return handleKooperationPrefill(form);
  }

  async prefillAndLockField(form, fieldName, value, displayLabel) {
    return prefillAndLockField(form, fieldName, value, displayLabel);
  }

  disableFieldWithMessage(form, fieldName, message) {
    return disableFieldWithMessage(form, fieldName, message);
  }
}
