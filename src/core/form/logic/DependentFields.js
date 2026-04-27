import { KampagneUtils } from '../../../modules/kampagne/KampagneUtils.js';
import { findStrategy } from './CascadeStrategies.js';
import { FieldStateHelpers } from './FieldStateHelpers.js';

export class DependentFields {
  constructor(autoGeneration) {
    this.autoGeneration = autoGeneration;
    this.dynamicDataLoader = null;
    this.formEventHandlers = new Map();
  }

  // Abhängige Felder verwalten
  setupDependentFields(form) {
    const isKampagneEditMode = form.dataset.entityType === 'kampagne' && form.dataset.isEditMode === 'true';
    if (isKampagneEditMode) {
      return;
    }
    
    const dependentFields = form.querySelectorAll('[data-depends-on]');
    
    dependentFields.forEach(field => {
      const dependsOn = field.dataset.dependsOn;
      const showWhen = field.dataset.showWhen;
      const parentField = form.querySelector(`[name="${dependsOn}"]`);
      
      if (parentField) {
        const toggleField = () => {
          const isCheckbox = parentField.type === 'checkbox';
          const parentValue = isCheckbox ? parentField.checked : parentField.value;
          
          let shouldShow = false;
          if (parentField.tagName === 'SELECT') {
            const selectedOption = parentField.selectedOptions[0];
            const displayText = selectedOption ? selectedOption.textContent.toLowerCase() : '';
            const selectValue = parentValue ? parentValue.toLowerCase() : '';
            const showWhenLower = showWhen ? showWhen.toLowerCase() : '';
            shouldShow = showWhen ? 
              (selectValue === showWhenLower || displayText.includes(showWhenLower)) : 
              !!parentValue;
          } else if (isCheckbox) {
            shouldShow = showWhen ? (parentValue === (showWhen === 'true')) : parentValue;
          } else {
            shouldShow = showWhen ? 
              (parentValue === showWhen || parentValue.includes(showWhen)) : 
              !!parentValue;
          }
          
          const isRowGroup = field.classList.contains('form-row-group');
          if (isRowGroup) {
            if (shouldShow) {
              field.classList.remove('form-row-group--hidden');
              field.style.display = '';
              field.querySelectorAll('.form-field').forEach(f => {
                f.classList.remove('form-field--hidden');
                f.style.display = '';
              });
            } else {
              field.classList.add('form-row-group--hidden');
              field.querySelectorAll('.form-field').forEach(f => f.classList.add('form-field--hidden'));
            }
            return;
          }
          
          const fieldContainer = field.closest('.form-field');
          if (fieldContainer) {
            if (shouldShow) {
              fieldContainer.classList.remove('form-field--hidden');
              fieldContainer.style.display = '';
              
              // Tag-basiertes Select reinitialisieren wenn es sichtbar wird
              // NICHT für prefillFromUnternehmen-Felder
              const isPrefillField = fieldContainer.dataset.prefillFromUnternehmen === 'true';
              const selectElement = fieldContainer.querySelector('select[data-tag-based="true"]');
              if (selectElement && window.formSystem?.optionsManager && !isPrefillField) {
                const fieldName = selectElement.name;
                
                if (!this._zieleFeldDebounce) this._zieleFeldDebounce = {};
                if (this._zieleFeldDebounce[fieldName]) {
                  clearTimeout(this._zieleFeldDebounce[fieldName]);
                }
                
                if (!this._zieleInitRunning) this._zieleInitRunning = {};
                if (this._zieleInitRunning[fieldName]) {
                  return;
                }
                
                this._zieleFeldDebounce[fieldName] = setTimeout(async () => {
                  this._zieleInitRunning[fieldName] = true;
                  
                  try {
                    const selectId = selectElement.id;
                    
                    const existingContainer = fieldContainer.querySelector('.tag-based-select');
                    if (existingContainer) {
                      existingContainer.remove();
                    }
                    
                    const existingHidden = document.getElementById(selectId + '_hidden');
                    if (existingHidden) {
                      existingHidden.remove();
                    }
                    
                    const formHidden = form.querySelector(`select[name="${fieldName}[]"]`);
                    if (formHidden && formHidden !== selectElement) {
                      formHidden.remove();
                    }
                    
                    if (window.formSystem.optionsManager.constructor.createdTagBasedSelects) {
                      window.formSystem.optionsManager.constructor.createdTagBasedSelects.delete(selectId);
                    }
                    
                    selectElement.style.display = '';
                    
                    let options = [];
                    if (window.supabase) {
                      let tableName = null;
                      if (fieldName === 'paid_ziele_ids') {
                        tableName = 'kampagne_paid_ziele_typen';
                      } else if (fieldName === 'organic_ziele_ids') {
                        tableName = 'kampagne_organic_ziele_typen';
                      }
                      
                      if (tableName) {
                        const { data, error } = await window.supabase
                          .from(tableName)
                          .select('id, name')
                          .order('sort_order');
                        
                        if (!error && data) {
                          options = data.map(item => ({ value: item.id, label: item.name }));
                          
                          selectElement.innerHTML = '<option value="">Bitte wählen...</option>';
                          options.forEach(opt => {
                            const optEl = document.createElement('option');
                            optEl.value = opt.value;
                            optEl.textContent = opt.label;
                            selectElement.appendChild(optEl);
                          });
                        } else {
                          console.error(`Fehler beim Laden aus ${tableName}:`, error);
                        }
                      }
                    }
                    
                    if (options.length > 0) {
                      const fieldConfig = this.getFormConfig(form.dataset.entity)?.fields?.find(f => f.name === fieldName);
                      if (fieldConfig) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                        window.formSystem.optionsManager.createTagBasedSelect(selectElement, options, fieldConfig);
                      }
                    }
                  } catch (e) {
                    console.error(`Fehler bei Tag-Select Initialisierung für ${fieldName}:`, e);
                  } finally {
                    this._zieleInitRunning[fieldName] = false;
                  }
                }, 100);
              }
            } else {
              const isPrefillField = fieldContainer.dataset.prefillFromUnternehmen === 'true';
              if (!isPrefillField) {
                fieldContainer.classList.add('form-field--hidden');
              }
            }
            
            const isKampagneEdit = form.dataset.isEditMode === 'true' && form.dataset.entityType === 'kampagne';
            if (shouldShow && field.dataset.autoGenerate === 'true' && !isKampagneEdit) {
              this.autoGeneration.autoGenerateKampagnenname(form, parentValue);
            }
          }
        };
        
        parentField.addEventListener('change', toggleField);
        toggleField();
      }
    });

    this.setupFormDelegation(form);
  }

  // Event Delegation für abhängige Felder
  setupFormDelegation(form) {
    const isKampagneEditMode = form.dataset.entityType === 'kampagne' && form.dataset.isEditMode === 'true';
    const isAuftragEditMode = form.dataset.entityType === 'auftrag' && form.dataset.isEditMode === 'true';
    if (isKampagneEditMode || isAuftragEditMode) {
      return;
    }
    
    const entity = form.dataset.entity;
    const config = this.getFormConfig(entity);
    if (!config || !config.fields) return;
    
    const dependencyMap = new Map();
    config.fields.forEach(field => {
      if (field.dependsOn) {
        if (!dependencyMap.has(field.dependsOn)) {
          dependencyMap.set(field.dependsOn, []);
        }
        dependencyMap.get(field.dependsOn).push(field);
      }
    });
    
    const filterByMap = new Map();
    config.fields.forEach(field => {
      if (field.filterBy) {
        if (!filterByMap.has(field.filterBy)) {
          filterByMap.set(field.filterBy, []);
        }
        filterByMap.get(field.filterBy).push(field);
      }
    });
    
    const fieldCache = new Map();
    config.fields.forEach(field => {
      const element = form.querySelector(`[name="${field.name}"]`);
      if (element) {
        fieldCache.set(field.name, element);
      }
    });
    
    const debounceTimers = new Map();
    
    const handler = async (e) => {
      const changedField = e.target;
      const fieldName = changedField.name;
      
      if (dependencyMap.has(fieldName)) {
        if (debounceTimers.has(fieldName)) {
          clearTimeout(debounceTimers.get(fieldName));
        }
        
        const timer = setTimeout(async () => {
          const dependentFields = dependencyMap.get(fieldName);
          const parentValue = this.getFieldValue(changedField);
          
          for (const fieldConfig of dependentFields) {
            let dependentField = fieldCache.get(fieldConfig.name);
            if (!dependentField) {
              dependentField = form.querySelector(`[name="${fieldConfig.name}"]`);
              if (dependentField) {
                fieldCache.set(fieldConfig.name, dependentField);
              } else {
                console.error(`DELEGATION: Feld ${fieldConfig.name} existiert nicht im DOM`);
                continue;
              }
            }
            
            if (!parentValue) {
              await this.clearDependentField(dependentField, fieldConfig);
            } else {
              await this.loadDependentFieldData(dependentField, fieldConfig, parentValue, form);
            }
          }
          
          debounceTimers.delete(fieldName);
        }, 150);
        
        debounceTimers.set(fieldName, timer);
      }
      
      if (filterByMap.has(fieldName)) {
        const timerKey = `filter_${fieldName}`;
        if (debounceTimers.has(timerKey)) {
          clearTimeout(debounceTimers.get(timerKey));
        }
        
        const timer = setTimeout(async () => {
          const filteredFields = filterByMap.get(fieldName);
          const parentValue = this.getFieldValue(changedField);
          
          for (const fieldConfig of filteredFields) {
            await this.reloadFilteredField(form, fieldConfig, parentValue);
          }
          
          debounceTimers.delete(timerKey);
        }, 150);
        
        debounceTimers.set(timerKey, timer);
      }
    };
    
    if (this.formEventHandlers.has(form)) {
      const oldHandler = this.formEventHandlers.get(form);
      form.removeEventListener('change', oldHandler, true);
    }
    
    form.addEventListener('change', handler, true);
    this.formEventHandlers.set(form, handler);
    
    const auftragConfig = config.fields.find(f => f.name === 'auftrag_id' && f.filterByMarke);
    if (auftragConfig) {
      const markeField = form.querySelector('[name="marke_id"]');
      const auftragField = form.querySelector('[name="auftrag_id"]');
      const unternehmenField = form.querySelector('[name="unternehmen_id"]');
      
      if (markeField && auftragField && unternehmenField) {
        markeField.addEventListener('change', async () => {
          const unternehmenValue = this.getFieldValue(unternehmenField);
          if (unternehmenValue) {
            await this.loadDependentFieldData(auftragField, auftragConfig, unternehmenValue, form);
          }
        });
      }
    }
    
    setTimeout(() => {
      const isEditMode = form.dataset.isEditMode === 'true';
      
      dependencyMap.forEach((dependentFields, parentFieldName) => {
        const parentField = fieldCache.get(parentFieldName);
        if (!parentField) return;
        
        const parentValue = this.getFieldValue(parentField);
        
        dependentFields.forEach(async (fieldConfig) => {
          const dependentField = fieldCache.get(fieldConfig.name);
          if (!dependentField) return;
          
          const hasExistingValue = this.getFieldValue(dependentField);
          
          if (parentValue) {
            await this.loadDependentFieldData(dependentField, fieldConfig, parentValue, form);
          } else if (isEditMode && hasExistingValue) {
            // Edit-Mode: behalte bestehenden Wert
          } else {
            await this.clearDependentField(dependentField, fieldConfig);
          }
        });
      });
    }, 300);
  }

  cleanup(form) {
    if (this.formEventHandlers && this.formEventHandlers.has(form)) {
      const handler = this.formEventHandlers.get(form);
      form.removeEventListener('change', handler, true);
      this.formEventHandlers.delete(form);
    }
  }

  getFieldValue(field) {
    if (field.type === 'checkbox') {
      return String(field.checked);
    }
    
    const originalValue = field.value;
    
    const nextElement = field.nextElementSibling;
    if (nextElement && (nextElement.classList.contains('searchable-select-container') || nextElement.classList.contains('tag-based-select'))) {
      const hiddenSelect = nextElement.querySelector('select[style*="display: none"]');
      if (hiddenSelect && hiddenSelect.id.endsWith('_hidden')) {
        if (hiddenSelect.selectedOptions.length > 0) {
          return hiddenSelect.selectedOptions[0].value;
        }
        return '';
      }
      
      if (originalValue) {
        return originalValue;
      }
    }
    
    const hiddenSelect = field.parentNode.querySelector('select[style*="display: none"]');
    if (hiddenSelect && hiddenSelect !== field) {
      return hiddenSelect.value;
    }
    
    return originalValue;
  }

  clearDependentField(field, fieldConfig) {
    if (field.dataset.prefilled === 'true') {
      return;
    }
    
    if (fieldConfig.type === 'multiselect' && fieldConfig.tagBased) {
      const container = field.closest('.form-field')?.querySelector('.tag-based-select');
      if (container) {
        const input = container.querySelector('.searchable-select-input');
        if (input) {
          input.value = '';
          input.placeholder = `Erst ${FieldStateHelpers.getFieldLabel(fieldConfig.dependsOn)} auswählen...`;
          input.disabled = true;
        }
        
        const tagsContainer = container.querySelector('.tags-container');
        if (tagsContainer) {
          tagsContainer.innerHTML = '';
          tagsContainer.style.display = 'none';
        }
        
        const dropdown = container.querySelector('.searchable-select-dropdown');
        if (dropdown) {
          dropdown.classList.remove('show');
          dropdown.style.removeProperty('display');
        }
        
        const hiddenSelect = container.querySelector('select[style*="display: none"]');
        if (hiddenSelect) {
          hiddenSelect.innerHTML = '';
        }
      }
      
      field.innerHTML = '<option value="">Bitte wählen...</option>';
      field.value = '';
      field.disabled = true;
      
      return;
    }
    
    const getPlaceholder = () => {
      const labelMap = {
        'unternehmen_id': 'Unternehmen',
        'marke_id': 'Marke',
        'kampagne_id': 'Kampagne',
        'auftrag_id': 'Auftrag'
      };
      const parentLabel = labelMap[fieldConfig.dependsOn] || fieldConfig.dependsOn;
      return `Erst ${parentLabel} auswählen...`;
    };
    
    const placeholder = getPlaceholder();
    
    const container = field.closest('.searchable-select-container, .tag-based-select');
    if (container) {
      const input = container.querySelector('.searchable-select-input');
      if (input) {
        input.value = '';
        input.placeholder = placeholder;
      }
      
      const tagsContainer = container.querySelector('.tags-container');
      if (tagsContainer) {
        tagsContainer.innerHTML = '';
      }
      
      const hiddenValue = document.getElementById(field.id + '_value');
      if (hiddenValue) {
        hiddenValue.value = '';
      }
    }
    
    field.innerHTML = `<option value="">${placeholder}</option>`;
    field.value = '';
    field.disabled = true;
  }

  // Daten für abhängiges Feld laden (Dispatcher → CascadeStrategies)
  async loadDependentFieldData(field, fieldConfig, parentValue, form) {
    if (!this.dynamicDataLoader) {
      console.error('DynamicDataLoader nicht verfügbar');
      return;
    }

    if (fieldConfig.prefillFromUnternehmen && fieldConfig.prefillRole) {
      const isMarkeEditMode = form.dataset.entityType === 'marke' && form.dataset.isEditMode === 'true';
      if (isMarkeEditMode) {
        return;
      }
    }

    FieldStateHelpers.showLoadingState(field, fieldConfig);
    
    try {
      const strategy = findStrategy(fieldConfig);
      if (strategy) {
        const ctx = {
          updateDependentFieldOptions: this.updateDependentFieldOptions.bind(this),
          updateTagBasedMultiSelectOptions: this.updateTagBasedMultiSelectOptions.bind(this),
          setNoOptionsState: FieldStateHelpers.setNoOptionsState,
          enableSearchableField: FieldStateHelpers.enableSearchableField,
          loadAuftraegeForUnternehmen: this.loadAuftraegeForUnternehmen.bind(this),
          getFieldValue: this.getFieldValue.bind(this),
        };
        await strategy(parentValue, form, field, fieldConfig, ctx);
      }
    } catch (error) {
      console.error(`Fehler beim Laden der abhängigen Daten:`, error);
      FieldStateHelpers.showErrorState(field, fieldConfig);
    } finally {
      FieldStateHelpers.hideLoadingState(field);
    }
  }

  async loadAuftraegeForUnternehmen(unternehmenId, form, options = {}) {
    try {
      const { disableMarke = false, message = 'Keine Marken verfügbar' } = options;
      const { data: auftraege, error } = await window.supabase
        .from('auftrag')
        .select('id, auftragsname, marke_id')
        .eq('unternehmen_id', unternehmenId)
        .order('auftragsname');
      
      if (error) {
        console.error('Fehler beim Laden der Aufträge für Unternehmen:', error);
        return;
      }
      
      if (auftraege.length > 0) {
        const auftragField = form.querySelector('[name="auftrag_id"]');
        if (auftragField) {
          const optionsList = auftraege.map(auftrag => ({
            value: auftrag.id,
            label: auftrag.auftragsname
          }));
          auftragField.disabled = false;
          this.updateDependentFieldOptions(auftragField, { name: 'auftrag_id' }, optionsList);
        }
      }

      if (disableMarke) {
        const markeField = form.querySelector('[name="marke_id"]');
        if (markeField) {
          const placeholder = message;
          markeField.innerHTML = `<option value="">${placeholder}</option>`;
          markeField.value = '';
          markeField.disabled = true;
          const container = markeField.closest('.searchable-select-container');
          if (container) {
            const input = container.querySelector('.searchable-select-input');
            if (input) {
              input.value = '';
              input.placeholder = placeholder;
              input.disabled = true;
            }
            const dropdown = container.querySelector('.searchable-select-dropdown');
            if (dropdown) {
              dropdown.innerHTML = `<div class="dropdown-item no-results">${placeholder}</div>`;
            }
          }
          const markeHiddenValue = document.getElementById(markeField.id + '_value');
          if (markeHiddenValue) {
            markeHiddenValue.value = '';
          }
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Aufträge für Unternehmen:', error);
    }
  }

  updateDependentFieldOptions(field, fieldConfig, options) {
    field.innerHTML = '<option value="">Bitte wählen...</option>';
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      field.appendChild(optionElement);
    });
    
    const container = field.nextElementSibling;
    if (container && (container.classList.contains('searchable-select-container') || container.classList.contains('tag-based-select'))) {
      const input = container.querySelector('.searchable-select-input');
      if (input) {
        input.disabled = false;
        input.placeholder = fieldConfig.placeholder || 'Suchen...';
        input.readOnly = false;
      }
    }
    
    if (this.dynamicDataLoader && this.dynamicDataLoader.updateSelectOptions) {
      this.dynamicDataLoader.updateSelectOptions(field, options, fieldConfig);
    }
  }

  async updateTagBasedMultiSelectOptions(field, fieldConfig, options) {
    const formField = field.closest('.form-field');
    if (!formField) {
      return;
    }
    
    field.innerHTML = '<option value="">Bitte wählen...</option>';
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      field.appendChild(optionElement);
    });
    
    if (window.formSystem?.optionsManager?.createTagBasedSelect) {
      window.formSystem.optionsManager.createTagBasedSelect(field, options, fieldConfig);
    }
  }

  // Gefiltertes Feld neu laden (für filterBy-Logik)
  async reloadFilteredField(form, fieldConfig, parentValue) {
    const field = form.querySelector(`[name="${fieldConfig.name}"]`);
    if (!field) {
      return;
    }
    
    FieldStateHelpers.showLoadingState(field, fieldConfig);
    
    try {
      let options = [];
      
      if (parentValue && fieldConfig.table) {
        const { data, error } = await window.supabase
          .from(fieldConfig.table)
          .select('*')
          .eq(fieldConfig.filterBy, parentValue)
          .order(fieldConfig.displayField || 'name', { ascending: true });
        
        if (error) {
          console.error(`Fehler beim Laden von ${fieldConfig.table}:`, error);
          FieldStateHelpers.showErrorState(field, fieldConfig);
          return;
        }
        
        options = (data || []).map(item => ({
          value: item[fieldConfig.valueField || 'id'],
          label: item[fieldConfig.displayField] || item.name || 'Unbekannt'
        }));

        if (fieldConfig.table === 'kampagne') {
          const allowedKampagneIds = await KampagneUtils.loadAllowedKampagneIds();
          if (Array.isArray(allowedKampagneIds)) {
            const allowedSet = new Set(allowedKampagneIds);
            options = options.filter(option => allowedSet.has(option.value));
          }
        }
      }
      
      if (fieldConfig.tagBased && window.formSystem?.optionsManager) {
        const tagContainer = field.closest('.form-field')?.querySelector('.tag-based-select');
        if (tagContainer) {
          const tagsContainer = tagContainer.querySelector('.tags-container');
          if (tagsContainer) {
            const tags = tagsContainer.querySelectorAll('.tag');
            tags.forEach(tag => tag.remove());
            
            const placeholder = document.createElement('span');
            placeholder.className = 'tags-placeholder';
            placeholder.textContent = 'Keine Auswahl';
            tagsContainer.appendChild(placeholder);
          }
        }
        
        window.formSystem.optionsManager.createTagBasedSelect(field, options, fieldConfig);
      } else {
        this.updateDependentFieldOptions(field, fieldConfig, options);
      }
      
      FieldStateHelpers.hideLoadingState(field);
      
    } catch (error) {
      console.error(`Fehler bei reloadFilteredField für ${fieldConfig.name}:`, error);
      FieldStateHelpers.showErrorState(field, fieldConfig);
    }
  }
}
