export class DependentFields {
  constructor(autoGeneration) {
    this.autoGeneration = autoGeneration;
    this.dynamicDataLoader = null; // Wird später injiziert
    this.formEventHandlers = new Map(); // Für Cleanup von Event Listeners
  }

  // Abhängige Felder verwalten
  setupDependentFields(form) {
    // Spezielle Behandlung für Kampagne/Auftrag Edit-Mode: Überspringen
    const isKampagneEditMode = form.dataset.entityType === 'kampagne' && form.dataset.isEditMode === 'true';
    const isAuftragEditMode = form.dataset.entityType === 'auftrag' && form.dataset.isEditMode === 'true';
    if (isKampagneEditMode || isAuftragEditMode) {
      console.log(`🎯 DEPENDENTFIELDS: Überspringe Setup für ${form.dataset.entityType} Edit-Mode - DynamicDataLoader übernimmt`);
      return;
    }
    
    const dependentFields = form.querySelectorAll('[data-depends-on]');
    
    dependentFields.forEach(field => {
      const dependsOn = field.dataset.dependsOn;
      const showWhen = field.dataset.showWhen;
      const parentField = form.querySelector(`[name="${dependsOn}"]`);
      
      if (parentField) {
        const toggleField = () => {
          // Für Checkbox/Toggle: checked Property verwenden
          const isCheckbox = parentField.type === 'checkbox';
          const parentValue = isCheckbox ? parentField.checked : parentField.value;
          console.log(`🔍 Prüfe abhängiges Feld: ${dependsOn} = "${parentValue}", showWhen = "${showWhen}", isCheckbox = ${isCheckbox}`);
          
          // Für Select-Felder sowohl Value als auch Text prüfen (case-insensitive)
          let shouldShow = false;
          if (parentField.tagName === 'SELECT') {
            const selectedOption = parentField.selectedOptions[0];
            const displayText = selectedOption ? selectedOption.textContent.toLowerCase() : '';
            const selectValue = parentValue ? parentValue.toLowerCase() : '';
            const showWhenLower = showWhen ? showWhen.toLowerCase() : '';
            // Prüfe sowohl Value als auch displayText (case-insensitive)
            shouldShow = showWhen ? 
              (selectValue === showWhenLower || displayText.includes(showWhenLower)) : 
              !!parentValue;
            console.log(`🔍 Select-Feld: value="${selectValue}", text="${displayText}", showWhen="${showWhenLower}" = ${shouldShow}`);
          } else if (isCheckbox) {
            // Für Checkbox/Toggle: showWhen ignorieren, nur checked Status prüfen
            shouldShow = showWhen ? (parentValue === (showWhen === 'true')) : parentValue;
            console.log(`🔍 Checkbox/Toggle: checked = ${parentValue}, shouldShow = ${shouldShow}`);
          } else {
            shouldShow = showWhen ? 
              (parentValue === showWhen || parentValue.includes(showWhen)) : 
              !!parentValue;
          }
          
          // Prüfe ob es ein form-row-group Container ist (für gruppierte Felder)
          const isRowGroup = field.classList.contains('form-row-group');
          if (isRowGroup) {
            if (shouldShow) {
              field.classList.remove('form-row-group--hidden');
              field.style.display = '';
              // Auch alle form-field Kinder einblenden
              field.querySelectorAll('.form-field').forEach(f => {
                f.classList.remove('form-field--hidden');
                f.style.display = '';
              });
            } else {
              field.classList.add('form-row-group--hidden');
              // Auch alle form-field Kinder ausblenden
              field.querySelectorAll('.form-field').forEach(f => f.classList.add('form-field--hidden'));
            }
            return;
          }
          
          const fieldContainer = field.closest('.form-field');
          if (fieldContainer) {
            // Klasse toggeln statt inline-Style (für bessere Flexbox-Kompatibilität)
            if (shouldShow) {
              fieldContainer.classList.remove('form-field--hidden');
              fieldContainer.style.display = ''; // Inline-Style entfernen
              
              // Tag-basiertes Select reinitialisieren wenn es sichtbar wird
              const selectElement = fieldContainer.querySelector('select[data-tag-based="true"]');
              if (selectElement && window.formSystem?.optionsManager) {
                const fieldName = selectElement.name;
                
                // Debounce: Verhindere mehrfache gleichzeitige Initialisierungen
                if (!this._zieleFeldDebounce) this._zieleFeldDebounce = {};
                if (this._zieleFeldDebounce[fieldName]) {
                  clearTimeout(this._zieleFeldDebounce[fieldName]);
                }
                
                // Lock: Verhindere parallele Ausführungen
                if (!this._zieleInitRunning) this._zieleInitRunning = {};
                if (this._zieleInitRunning[fieldName]) {
                  console.log(`⏳ Initialisierung für ${fieldName} läuft bereits - überspringe`);
                  return;
                }
                
                this._zieleFeldDebounce[fieldName] = setTimeout(async () => {
                  this._zieleInitRunning[fieldName] = true;
                  console.log(`🏷️ Reinitialisiere Tag-Select für ${fieldName} nach Sichtbar-Werden`);
                  
                  try {
                    const selectId = selectElement.id;
                    
                    // Entferne bestehenden Container komplett
                    const existingContainer = fieldContainer.querySelector('.tag-based-select');
                    if (existingContainer) {
                      existingContainer.remove();
                      console.log(`🗑️ Bestehenden Tag-Container entfernt für ${fieldName}`);
                    }
                    
                    // Entferne verstecktes Select falls vorhanden
                    const existingHidden = document.getElementById(selectId + '_hidden');
                    if (existingHidden) {
                      existingHidden.remove();
                    }
                    
                    // Auch im Form nach versteckten Selects suchen
                    const formHidden = form.querySelector(`select[name="${fieldName}[]"]`);
                    if (formHidden && formHidden !== selectElement) {
                      formHidden.remove();
                    }
                    
                    // Entferne aus dem "bereits erstellt" Set
                    if (window.formSystem.optionsManager.constructor.createdTagBasedSelects) {
                      window.formSystem.optionsManager.constructor.createdTagBasedSelects.delete(selectId);
                    }
                    
                    // Original Select wieder sichtbar machen
                    selectElement.style.display = '';
                    
                    // Lade Optionen direkt aus Supabase
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
                          console.log(`✅ ${options.length} Optionen aus ${tableName} geladen`);
                          
                          // Optionen ins Select schreiben
                          selectElement.innerHTML = '<option value="">Bitte wählen...</option>';
                          options.forEach(opt => {
                            const optEl = document.createElement('option');
                            optEl.value = opt.value;
                            optEl.textContent = opt.label;
                            selectElement.appendChild(optEl);
                          });
                        } else {
                          console.error(`❌ Fehler beim Laden aus ${tableName}:`, error);
                        }
                      }
                    }
                    
                    if (options.length > 0) {
                      const fieldConfig = this.getFormConfig(form.dataset.entity)?.fields?.find(f => f.name === fieldName);
                      if (fieldConfig) {
                        // Kleine Verzögerung damit DOM sich stabilisiert
                        await new Promise(resolve => setTimeout(resolve, 50));
                        window.formSystem.optionsManager.createTagBasedSelect(selectElement, options, fieldConfig);
                        console.log(`✅ Tag-Select neu erstellt mit ${options.length} Optionen`);
                      }
                    } else {
                      console.warn(`⚠️ Keine Optionen für ${fieldName} verfügbar`);
                    }
                  } catch (e) {
                    console.error(`❌ Fehler bei Tag-Select Initialisierung für ${fieldName}:`, e);
                  } finally {
                    this._zieleInitRunning[fieldName] = false;
                  }
                }, 100); // 100ms Debounce
              }
            } else {
              // WICHTIG: Felder mit prefillFromUnternehmen NICHT verstecken (Waterfall-Logik)
              // Diese bleiben immer sichtbar, nur die Daten werden aktualisiert
              const isPrefillField = fieldContainer.dataset.prefillFromUnternehmen === 'true';
              if (!isPrefillField) {
                fieldContainer.classList.add('form-field--hidden');
              }
            }
            console.log(`🔍 Feld ${field.dataset.dependsOn} ${shouldShow ? 'angezeigt' : (fieldContainer.dataset.prefillFromUnternehmen ? 'sichtbar (prefill)' : 'versteckt')}`);
            
            // Auto-Generierung für Kampagnenname
            if (shouldShow && field.dataset.autoGenerate === 'true') {
              this.autoGeneration.autoGenerateKampagnenname(form, parentValue);
            }
          }
        };
        
        parentField.addEventListener('change', toggleField);
        toggleField(); // Initial state
      }
    });

    // Setup für dynamische abhängige Felder (z.B. Marke abhängig von Unternehmen)
    this.setupFormDelegation(form);
  }

  // Event Delegation für abhängige Felder
  setupFormDelegation(form) {
    // Spezielle Behandlung für Kampagne/Auftrag Edit-Mode beibehalten
    const isKampagneEditMode = form.dataset.entityType === 'kampagne' && form.dataset.isEditMode === 'true';
    const isAuftragEditMode = form.dataset.entityType === 'auftrag' && form.dataset.isEditMode === 'true';
    if (isKampagneEditMode || isAuftragEditMode) {
      console.log(`🎯 DEPENDENTFIELDS: Überspringe Delegation Setup für ${form.dataset.entityType} Edit-Mode`);
      return;
    }
    
    const entity = form.dataset.entity;
    const config = this.getFormConfig(entity);
    if (!config || !config.fields) return;
    
    // Dependency Map erstellen: parent → [children]
    const dependencyMap = new Map();
    config.fields.forEach(field => {
      if (field.dependsOn) {
        if (!dependencyMap.has(field.dependsOn)) {
          dependencyMap.set(field.dependsOn, []);
        }
        dependencyMap.get(field.dependsOn).push(field);
      }
    });
    
    // FilterBy Map erstellen: parent → [children] (für Felder die immer sichtbar sind aber gefiltert werden)
    const filterByMap = new Map();
    config.fields.forEach(field => {
      if (field.filterBy) {
        if (!filterByMap.has(field.filterBy)) {
          filterByMap.set(field.filterBy, []);
        }
        filterByMap.get(field.filterBy).push(field);
      }
    });
    
    console.log('🗺️ DELEGATION: Dependency Map:', Object.fromEntries(dependencyMap));
    console.log('🗺️ DELEGATION: FilterBy Map:', Object.fromEntries(filterByMap));
    
    // Field Cache erstellen (Performance Optimierung #2)
    const fieldCache = new Map();
    config.fields.forEach(field => {
      const element = form.querySelector(`[name="${field.name}"]`);
      if (element) {
        fieldCache.set(field.name, element);
      } else if (field.dependsOn) {
        console.warn(`⚠️ FIELDCACHE: Element für abhängiges Feld ${field.name} nicht gefunden`);
      }
    });
    console.log('📦 FIELDCACHE: Gecachte Felder:', Array.from(fieldCache.keys()));
    
    // Debounce Timers (Performance Optimierung #3)
    const debounceTimers = new Map();
    
    // Einmaliger Event-Listener auf Form-Level (Capturing Phase)
    const handler = async (e) => {
      const changedField = e.target;
      const fieldName = changedField.name;
      
      console.log(`🔔 FORM-CHANGE-EVENT: Feld "${fieldName}" geändert, Wert:`, this.getFieldValue(changedField));
      console.log(`   → In DependencyMap? ${dependencyMap.has(fieldName)}, Keys:`, Array.from(dependencyMap.keys()));
      
      // dependsOn-Logik: Felder die versteckt/angezeigt werden
      if (dependencyMap.has(fieldName)) {
        // Bestehenden Timer abbrechen (Debouncing)
        if (debounceTimers.has(fieldName)) {
          clearTimeout(debounceTimers.get(fieldName));
        }
        
        // Neuen Timer setzen
        const timer = setTimeout(async () => {
          const dependentFields = dependencyMap.get(fieldName);
          const parentValue = this.getFieldValue(changedField);
          
          console.log(`🔄 DELEGATION: ${fieldName} → "${parentValue}", ${dependentFields.length} abhängige Felder`);
          
          for (const fieldConfig of dependentFields) {
            let dependentField = fieldCache.get(fieldConfig.name);
            if (!dependentField) {
              console.warn(`⚠️ DELEGATION: Feld ${fieldConfig.name} nicht im Cache gefunden - versuche erneut zu finden`);
              // Fallback: Versuche das Feld direkt zu finden
              dependentField = form.querySelector(`[name="${fieldConfig.name}"]`);
              if (dependentField) {
                console.log(`✅ DELEGATION: Feld ${fieldConfig.name} per Fallback gefunden`);
                fieldCache.set(fieldConfig.name, dependentField);
              } else {
                console.error(`❌ DELEGATION: Feld ${fieldConfig.name} existiert nicht im DOM`);
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
        }, 150); // 150ms Debounce
        
        debounceTimers.set(fieldName, timer);
      }
      
      // filterBy-Logik: Felder die immer sichtbar sind aber gefiltert werden
      if (filterByMap.has(fieldName)) {
        // Bestehenden Timer abbrechen (Debouncing)
        const timerKey = `filter_${fieldName}`;
        if (debounceTimers.has(timerKey)) {
          clearTimeout(debounceTimers.get(timerKey));
        }
        
        // Neuen Timer setzen
        const timer = setTimeout(async () => {
          const filteredFields = filterByMap.get(fieldName);
          const parentValue = this.getFieldValue(changedField);
          
          console.log(`🔄 FILTERBY: ${fieldName} → "${parentValue}", ${filteredFields.length} gefilterte Felder`);
          
          for (const fieldConfig of filteredFields) {
            await this.reloadFilteredField(form, fieldConfig, parentValue);
          }
          
          debounceTimers.delete(timerKey);
        }, 150); // 150ms Debounce
        
        debounceTimers.set(timerKey, timer);
      }
    };
    
    // Alte Handler entfernen falls vorhanden (Memory Leak Prevention)
    if (this.formEventHandlers.has(form)) {
      const oldHandler = this.formEventHandlers.get(form);
      form.removeEventListener('change', oldHandler, true);
    }
    
    form.addEventListener('change', handler, true); // Capturing = true
    this.formEventHandlers.set(form, handler);
    
    // Spezieller Handler: Wenn Marke geändert wird, Aufträge neu laden (filterByMarke)
    const auftragConfig = config.fields.find(f => f.name === 'auftrag_id' && f.filterByMarke);
    if (auftragConfig) {
      const markeField = form.querySelector('[name="marke_id"]');
      const auftragField = form.querySelector('[name="auftrag_id"]');
      const unternehmenField = form.querySelector('[name="unternehmen_id"]');
      
      if (markeField && auftragField && unternehmenField) {
        markeField.addEventListener('change', async () => {
          const unternehmenValue = this.getFieldValue(unternehmenField);
          if (unternehmenValue) {
            console.log('🔄 Marke geändert - lade Aufträge neu...');
            await this.loadDependentFieldData(auftragField, auftragConfig, unternehmenValue, form);
          }
        });
        console.log('✅ Marke→Auftrag Filter-Handler registriert');
      }
    }
    
    // Initial State laden
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
            console.log(`📝 DELEGATION: Edit-Mode, behalte ${fieldConfig.name}`);
          } else {
            await this.clearDependentField(dependentField, fieldConfig);
          }
        });
      });
    }, 300); // Reduziert von 500ms auf 300ms (Performance Optimierung #7)
  }

  // Cleanup-Methode für Memory Leak Prevention
  cleanup(form) {
    if (this.formEventHandlers && this.formEventHandlers.has(form)) {
      const handler = this.formEventHandlers.get(form);
      form.removeEventListener('change', handler, true);
      this.formEventHandlers.delete(form);
      console.log('🗑️ DEPENDENTFIELDS: Event Listeners entfernt für Form');
    }
  }

  // Wert aus Feld extrahieren (auch für searchable Selects)
  getFieldValue(field) {
    console.log(`🔍 getFieldValue für Feld:`, field.name);
    
    // WICHTIG: Zuerst das ursprüngliche Select-Element prüfen
    const originalValue = field.value;
    console.log(`📋 Original Select Wert:`, originalValue);
    
    // Prüfe ob es ein Searchable Select ist (Container ist nextElementSibling)
    const nextElement = field.nextElementSibling;
    if (nextElement && (nextElement.classList.contains('searchable-select-container') || nextElement.classList.contains('tag-based-select'))) {
      console.log(`🔍 Searchable Select Container gefunden für:`, field.name);
      
      // Für Tag-basierte Multi-Selects: Hole Wert aus dem versteckten Select
      const hiddenSelect = nextElement.querySelector('select[style*="display: none"]');
      if (hiddenSelect && hiddenSelect.id.endsWith('_hidden')) {
        console.log(`📦 Verstecktes Multi-Select gefunden:`, hiddenSelect.id);
        // Bei Multi-Selects den ersten Wert zurückgeben (wenn vorhanden)
        if (hiddenSelect.selectedOptions.length > 0) {
          const value = hiddenSelect.selectedOptions[0].value;
          console.log(`✅ Wert aus verstecktem Multi-Select:`, value);
          return value;
        }
        console.log(`⚠️ Verstecktes Multi-Select hat keine Auswahl`);
        return '';
      }
      
      // Für normale Searchable Selects: Original-Wert verwenden
      if (originalValue) {
        console.log(`✅ Wert aus Original Select (Searchable):`, originalValue);
        return originalValue;
      }
    }
    
    // Alte Logik: Für versteckte Selects (bei searchable Selects) - Fallback
    const hiddenSelect = field.parentNode.querySelector('select[style*="display: none"]');
    if (hiddenSelect && hiddenSelect !== field) {
      const value = hiddenSelect.value;
      console.log(`📦 Wert aus verstecktem Select (Parent):`, value);
      return value;
    }
    
    console.log(`✅ Standard Wert:`, originalValue);
    return originalValue;
  }

  // Abhängiges Feld leeren
  clearDependentField(field, fieldConfig) {
    // PREFILL CHECK: Überspringe prefilled Felder
    if (field.dataset.prefilled === 'true') {
      console.log(`🔒 PREFILL: Überspringe Leeren von prefilled Feld: ${fieldConfig.name}`);
      return;
    }
    
    console.log(`🧹 Leere abhängiges Feld: ${fieldConfig.name}`);
    
    // Spezielle Behandlung für Tag-basierte Multi-Selects
    if (fieldConfig.type === 'multiselect' && fieldConfig.tagBased) {
      console.log(`🏷️ Spezielle Behandlung für Tag-basiertes Multi-Select: ${fieldConfig.name}`);
      
      // Tag-basierte Container finden
      const container = field.closest('.form-field')?.querySelector('.tag-based-select');
      if (container) {
        const input = container.querySelector('.searchable-select-input');
        if (input) {
          input.value = '';
          input.placeholder = `Erst ${this.getFieldLabel(fieldConfig.dependsOn)} auswählen...`;
          input.disabled = true; // DOCH deaktivieren bis Parent gewählt wird!
        }
        
        // Alle bestehenden Tags entfernen
        const tagsContainer = container.querySelector('.tags-container');
        if (tagsContainer) {
          tagsContainer.innerHTML = '';
          tagsContainer.style.display = 'none';
        }
        
        // Dropdown verstecken (nur Klasse entfernen, KEIN Inline-Style!)
        const dropdown = container.querySelector('.searchable-select-dropdown');
        if (dropdown) {
          dropdown.classList.remove('show');
          dropdown.style.removeProperty('display'); // Inline-Style entfernen falls vorhanden
        }
        
        // Verstecktes Select leeren
        const hiddenSelect = container.querySelector('select[style*="display: none"]');
        if (hiddenSelect) {
          hiddenSelect.innerHTML = '';
        }
      }
      
      // Original Select leeren UND deaktivieren
      field.innerHTML = '<option value="">Bitte wählen...</option>';
      field.value = '';
      field.disabled = true; // Für Tag-basierte Selects auch deaktivieren
      
      return;
    }
    
    // Für normale Felder: Dynamischen Placeholder basierend auf dependsOn erstellen
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
    
    // Für searchable Selects
    const container = field.closest('.searchable-select-container, .tag-based-select');
    if (container) {
      // Input leeren
      const input = container.querySelector('.searchable-select-input');
      if (input) {
        input.value = '';
        input.placeholder = placeholder;
      }
      
      // Tags entfernen
      const tagsContainer = container.querySelector('.tags-container');
      if (tagsContainer) {
        tagsContainer.innerHTML = '';
      }
    }
    
    // Original Select leeren
    field.innerHTML = `<option value="">${placeholder}</option>`;
    field.value = '';
    field.disabled = true;
  }

  // Daten für abhängiges Feld laden
  async loadDependentFieldData(field, fieldConfig, parentValue, form) {
    if (!this.dynamicDataLoader) {
      console.error('❌ DynamicDataLoader nicht verfügbar');
      return;
    }

    console.log(`🔄 Lade Daten für ${fieldConfig.name} basierend auf ${fieldConfig.dependsOn}:`, parentValue);
    
    // Loading State anzeigen (Performance Optimierung #4)
    this.showLoadingState(field, fieldConfig);
    
    try {
      // Spezielle Logik für Marken basierend auf Unternehmen (sowohl Single- als auch Multi-Select)
      if ((fieldConfig.name === 'marke_id' || fieldConfig.name === 'marke_ids') && fieldConfig.dependsOn === 'unternehmen_id') {
        const { data: marken, error } = await window.supabase
          .from('marke')
          .select('id, markenname')
          .eq('unternehmen_id', parentValue)
          .order('markenname');
        
        if (error) {
          console.error('❌ Fehler beim Laden der Marken:', error);
          return;
        }
        
        const options = marken.map(marke => ({
          value: marke.id,
          label: marke.markenname
        }));
        
        console.log(`✅ ${options.length} Marken geladen für Unternehmen ${parentValue}`);
        
        if (options.length === 0) {
          const message = 'Dieses Unternehmen hat keine Marke.';
          this.setNoOptionsState(field, fieldConfig, message);
          await this.loadAuftraegeForUnternehmen(parentValue, form, { disableMarke: true, message });
          return;
        }
        
        field.disabled = false;
        if (fieldConfig.name === 'marke_ids' && fieldConfig.tagBased) {
          const container = field.closest('.form-field')?.querySelector('.tag-based-select');
          if (container) {
            const input = container.querySelector('.searchable-select-input');
            if (input) {
              input.disabled = false;
              input.placeholder = fieldConfig.placeholder || 'Marken suchen und hinzufügen...';
            }
            try { container.dataset.options = JSON.stringify(options); } catch (_) {}
          }
          await this.updateTagBasedMultiSelectOptions(field, fieldConfig, options);
        } else {
          this.updateDependentFieldOptions(field, fieldConfig, options);
        }
      }
      
      // Spezielle Logik für Aufträge basierend auf Marke
      if (fieldConfig.name === 'auftrag_id' && fieldConfig.dependsOn === 'marke_id') {
        const { data: auftraege, error } = await window.supabase
          .from('auftrag')
          .select('id, auftragsname')
          .eq('marke_id', parentValue)
          .order('auftragsname');
        
        if (error) {
          console.error('❌ Fehler beim Laden der Aufträge:', error);
          return;
        }
        
        const options = auftraege.map(auftrag => ({
          value: auftrag.id,
          label: auftrag.auftragsname
        }));
        
        console.log(`✅ ${options.length} Aufträge geladen für Marke ${parentValue}`);
        
        // Feld wieder aktivieren
        field.disabled = false;
        
        // Optionen aktualisieren
        this.updateDependentFieldOptions(field, fieldConfig, options);
      }
      
      // Spezielle Logik für Aufträge basierend auf Unternehmen (intelligent: mit/ohne Marke)
      if (fieldConfig.name === 'auftrag_id' && fieldConfig.dependsOn === 'unternehmen_id') {
        const markeField = form.querySelector('[name="marke_id"]');
        const markeValue = markeField?.value;
        
        // Erst alle Aufträge des Unternehmens laden um zu prüfen ob welche ohne Marke existieren
        const { data: alleAuftraege, error: checkError } = await window.supabase
          .from('auftrag')
          .select('id, auftragsname, marke_id')
          .eq('unternehmen_id', parentValue)
          .order('auftragsname');
        
        if (checkError) {
          console.error('❌ Fehler beim Prüfen der Aufträge:', checkError);
          return;
        }
        
        // Prüfe ob es Aufträge ohne Marke gibt
        const auftraegeOhneMarke = alleAuftraege.filter(a => !a.marke_id);
        const auftraegeMitMarke = alleAuftraege.filter(a => a.marke_id);
        
        console.log(`📊 Aufträge-Analyse: ${auftraegeOhneMarke.length} ohne Marke, ${auftraegeMitMarke.length} mit Marke`);
        
        let auftraegeZuZeigen = [];
        
        if (markeValue) {
          // Marke ist ausgewählt → zeige nur Aufträge dieser Marke + Aufträge ohne Marke
          auftraegeZuZeigen = alleAuftraege.filter(a => !a.marke_id || a.marke_id === markeValue);
          console.log(`🔍 Marke ausgewählt: zeige ${auftraegeZuZeigen.length} Aufträge (ohne Marke + passende Marke)`);
        } else if (auftraegeOhneMarke.length > 0) {
          // Keine Marke ausgewählt, aber es gibt Aufträge ohne Marke → zeige diese
          auftraegeZuZeigen = auftraegeOhneMarke;
          console.log(`🔍 Keine Marke, aber ${auftraegeOhneMarke.length} Aufträge ohne Marke verfügbar`);
        } else if (auftraegeMitMarke.length > 0) {
          // Alle Aufträge haben eine Marke → Feld deaktivieren, Hinweis zeigen
          console.log(`⚠️ Alle ${auftraegeMitMarke.length} Aufträge haben eine Marke - bitte erst Marke auswählen`);
          field.disabled = true;
          this.updateDependentFieldOptions(field, fieldConfig, []);
          
          // Placeholder anpassen um Hinweis zu geben
          const container = field.nextElementSibling;
          if (container?.classList.contains('searchable-select-container')) {
            const input = container.querySelector('.searchable-select-input');
            if (input) {
              input.placeholder = 'Bitte erst eine Marke auswählen...';
            }
          }
          return;
        }
        
        const options = auftraegeZuZeigen.map(auftrag => ({
          value: auftrag.id,
          label: auftrag.auftragsname + (auftrag.marke_id ? '' : ' (ohne Marke)')
        }));
        
        console.log(`✅ ${options.length} Aufträge für Unternehmen geladen`);
        
        // Feld aktivieren
        field.disabled = false;
        
        // Placeholder zurücksetzen
        const container = field.nextElementSibling;
        if (container?.classList.contains('searchable-select-container')) {
          const input = container.querySelector('.searchable-select-input');
          if (input) {
            input.placeholder = fieldConfig.placeholder || 'Auftrag suchen und auswählen...';
          }
        }
        
        // Optionen aktualisieren
        this.updateDependentFieldOptions(field, fieldConfig, options);
      }

      // Spezielle Logik für Kampagnen basierend auf Marke
      if (fieldConfig.name === 'kampagne_id' && fieldConfig.dependsOn === 'marke_id') {
        const { data: kampagnen, error } = await window.supabase
          .from('kampagne')
          .select('id, kampagnenname, marke_id, videoanzahl')
          .eq('marke_id', parentValue)
          .order('kampagnenname');

        if (error) {
          console.error('❌ Fehler beim Laden der Kampagnen für Marke:', error);
          return;
        }

        let filtered = kampagnen || [];
        try {
          const kampagneIds = filtered.map(k => k.id);
          if (kampagneIds.length > 0) {
            const { data: koops, error: koopErr } = await window.supabase
              .from('kooperationen')
              .select('kampagne_id, videoanzahl')
              .in('kampagne_id', kampagneIds);
            if (!koopErr && koops) {
              const usedMap = {};
              koops.forEach(row => {
                const key = row.kampagne_id;
                const val = parseInt(row.videoanzahl, 10) || 0;
                usedMap[key] = (usedMap[key] || 0) + val;
              });
              filtered = filtered.filter(k => {
                const total = parseInt(k.videoanzahl, 10) || 0;
                const used = usedMap[k.id] || 0;
                const remaining = Math.max(0, total - used);
                return remaining > 0; // nur Kampagnen mit freien Videos
              });
            }
          }
        } catch (e) {
          console.warn('⚠️ Fehler beim Filtern der Kampagnen:', e);
        }

        const options = filtered.map(kampagne => ({
          value: kampagne.id,
          label: kampagne.kampagnenname
        }));
        
        console.log(`✅ ${options.length} Kampagnen geladen für Marke ${parentValue}`);
        
        // Feld wieder aktivieren
        field.disabled = false;
        
        // Optionen aktualisieren
        this.updateDependentFieldOptions(field, fieldConfig, options);
      }
      
      // Neue Logik: Kampagnen direkt basierend auf Unternehmen filtern (für Kooperation)
      else if (fieldConfig.name === 'kampagne_id' && fieldConfig.dependsOn === 'unternehmen_id') {
        const { data: kampagnen, error } = await window.supabase
          .from('kampagne')
          .select('id, kampagnenname, unternehmen_id, videoanzahl')
          .eq('unternehmen_id', parentValue)
          .order('kampagnenname');

        if (error) {
          console.error('❌ Fehler beim Laden der Kampagnen für Unternehmen:', error);
          return;
        }

        // Edit-Mode: Aktuelle Kampagne-ID merken
        let currentKampagneId = null;
        if (form && form.dataset.isEditMode === 'true' && form.dataset.editModeData) {
          try {
            const editData = JSON.parse(form.dataset.editModeData);
            currentKampagneId = editData.kampagne_id;
            console.log('🎯 DEPENDENTFIELDS: Edit-Mode - Aktuelle Kampagne-ID:', currentKampagneId);
          } catch (e) {
            console.warn('⚠️ Fehler beim Parsen der Edit-Mode-Daten:', e);
          }
        }

        let filtered = kampagnen || [];
        try {
          const kampagneIds = filtered.map(k => k.id);
          if (kampagneIds.length > 0) {
            const { data: koops, error: koopErr } = await window.supabase
              .from('kooperationen')
              .select('kampagne_id, videoanzahl')
              .in('kampagne_id', kampagneIds);
            if (!koopErr && koops) {
              const usedMap = {};
              koops.forEach(row => {
                const key = row.kampagne_id;
                const val = parseInt(row.videoanzahl, 10) || 0;
                usedMap[key] = (usedMap[key] || 0) + val;
              });
              filtered = filtered.filter(k => {
                // Im Edit-Mode: Aktuelle Kampagne IMMER behalten
                if (currentKampagneId && k.id === currentKampagneId) {
                  console.log('✅ DEPENDENTFIELDS: Behalte aktuelle Kampagne:', k.kampagnenname);
                  return true;
                }
                const total = parseInt(k.videoanzahl, 10) || 0;
                const used = usedMap[k.id] || 0;
                const remaining = Math.max(0, total - used);
                return remaining > 0; // nur Kampagnen mit freien Videos
              });
            }
          }
        } catch (e) {
          console.warn('⚠️ Konnte belegte Videos nicht überprüfen, zeige alle Kampagnen:', e);
        }

        const options = filtered.map(k => ({ value: k.id, label: k.kampagnenname || 'Unbenannte Kampagne' }));
        field.disabled = false;
        this.updateDependentFieldOptions(field, fieldConfig, options);
      }

      // Neue Logik: Alle Creator laden (nicht nur finale Creator der Kampagne)
      if (fieldConfig.name === 'creator_id' && fieldConfig.dependsOn === 'kampagne_id') {
        try {
          const { data: allCreators, error } = await window.supabase
            .from('creator')
            .select('id, vorname, nachname, instagram')
            .order('vorname');
          if (error) {
            console.error('❌ Fehler beim Laden aller Creator:', error);
            return;
          }
          const options = (allCreators || [])
            .map(creator => {
              const name = `${creator.vorname || ''} ${creator.nachname || ''}`.trim();
              const label = name || (creator.instagram ? `@${creator.instagram}` : `Creator ${creator.id}`);
              return { value: creator.id, label };
            });
          field.disabled = false;
          this.updateDependentFieldOptions(field, fieldConfig, options);
        } catch (e) {
          console.error('❌ Fehler beim Laden aller Creator:', e);
        }
      }

      // Neue Logik: Briefings basierend auf Kampagne laden (für Kooperation)
      if (fieldConfig.name === 'briefing_id' && fieldConfig.dependsOn === 'kampagne_id') {
        try {
          const { data: briefings, error } = await window.supabase
            .from('briefings')
            .select('id, product_service_offer, kampagne_id')
            .eq('kampagne_id', parentValue)
            .order('created_at', { ascending: false });
          if (error) {
            console.error('❌ Fehler beim Laden der Briefings für Kampagne:', error);
            return;
          }
          const options = (briefings || []).map(b => ({
            value: b.id,
            label: b.product_service_offer || `Briefing ${b.id.slice(0, 6)}`
          }));
          field.disabled = false;
          this.updateDependentFieldOptions(field, fieldConfig, options);
        } catch (e) {
          console.error('❌ Unerwarteter Fehler beim Laden der Briefings:', e);
        }
      }

      // Erweiterte Waterfall-Logik: Mitarbeiter bei Marke vom Unternehmen vorausfüllen
      // Behandelt management_ids, lead_mitarbeiter_ids, mitarbeiter_ids mit Rollen-Filterung
      if (fieldConfig.dependsOn === 'unternehmen_id' && fieldConfig.prefillFromUnternehmen && fieldConfig.prefillRole) {
        const targetRole = fieldConfig.prefillRole;
        console.log(`🔄 DEPENDENTFIELDS PREFILL: Starte Prefill für ${fieldConfig.name} (Rolle: ${targetRole}) vom Unternehmen:`, parentValue);
        console.log(`🔄 DEPENDENTFIELDS PREFILL: Field Element:`, field);
        console.log(`🔄 DEPENDENTFIELDS PREFILL: FieldConfig:`, fieldConfig);
        
        // Lade Mitarbeiter-Zuordnungen für dieses Unternehmen mit der spezifischen Rolle
        const { data: mitarbeiterRel, error } = await window.supabase
          .from('mitarbeiter_unternehmen')
          .select('mitarbeiter_id, role, benutzer:mitarbeiter_id(id, name)')
          .eq('unternehmen_id', parentValue)
          .eq('role', targetRole);
        
        if (error) {
          console.error(`❌ Fehler beim Laden der ${targetRole}-Mitarbeiter für Unternehmen:`, error);
          return;
        }
        
        // Mitarbeiter-IDs mit dieser Rolle extrahieren
        const roleMitarbeiterIds = (mitarbeiterRel || [])
          .map(rel => rel.mitarbeiter_id)
          .filter(Boolean);
        
        console.log(`✅ ${roleMitarbeiterIds.length} ${targetRole}-Mitarbeiter vom Unternehmen gefunden`);
        
        // Alle Benutzer laden (nicht nur Kunden)
        const { data: allMitarbeiter } = await window.supabase
          .from('benutzer')
          .select('id, name')
          .neq('rolle', 'kunde')
          .order('name');
        
        // Optionen erstellen, mit vorausgewählt für Mitarbeiter mit passender Rolle
        const options = (allMitarbeiter || []).map(m => ({
          value: m.id,
          label: m.name,
          selected: roleMitarbeiterIds.includes(m.id)
        }));
        
        console.log(`✅ DEPENDENTFIELDS PREFILL: ${options.filter(o => o.selected).length} von ${options.length} Mitarbeitern für ${fieldConfig.name} vorausgewählt`);
        console.log(`✅ DEPENDENTFIELDS PREFILL: Vorausgewählte Optionen:`, options.filter(o => o.selected).map(o => o.label));
        
        // Feld aktivieren und Optionen setzen
        field.disabled = false;
        
        if (fieldConfig.tagBased && window.formSystem?.optionsManager) {
          console.log(`🏷️ DEPENDENTFIELDS PREFILL: Erstelle Tag-basiertes Select für ${fieldConfig.name}`);
          window.formSystem.optionsManager.createTagBasedSelect(field, options, fieldConfig);
          console.log(`✅ DEPENDENTFIELDS PREFILL: ${fieldConfig.name} Tags erfolgreich erstellt`);
        } else {
          console.log(`📋 DEPENDENTFIELDS PREFILL: Aktualisiere Standard-Select für ${fieldConfig.name}`);
          this.updateDependentFieldOptions(field, fieldConfig, options);
        }
        
        return;
      }

      if (fieldConfig.name === 'ansprechpartner_id' && fieldConfig.dependsOn === 'unternehmen_id') {
        const { data: ansprechpartner, error } = await window.supabase
          .from('ansprechpartner')
          .select('id, vorname, nachname, email, unternehmen_id')
          .eq('unternehmen_id', parentValue)
          .order('nachname');
        
        if (error) {
          console.error('❌ Fehler beim Laden der Ansprechpartner für Unternehmen:', error);
          return;
        }
        
        const options = (ansprechpartner || []).map(ap => ({
          value: ap.id,
          label: [ap.vorname, ap.nachname, ap.email].filter(Boolean).join(' | ')
        }));
        
        if (options.length === 0) {
          this.setNoOptionsState(field, fieldConfig, 'Dieses Unternehmen hat keine Ansprechpartner.');
          return;
        }
        
        this.enableSearchableField(field, fieldConfig);
        this.updateDependentFieldOptions(field, fieldConfig, options);
      }
    } catch (error) {
      console.error(`❌ Fehler beim Laden der abhängigen Daten:`, error);
      
      // User Feedback bei Fehler (Performance Optimierung #5)
      this.showErrorState(field, fieldConfig);
    } finally {
      // Loading State ausblenden (Performance Optimierung #4)
      this.hideLoadingState(field);
    }
  }

  // Hilfsmethode: Aufträge direkt für Unternehmen laden (wenn keine Marken vorhanden)
  async loadAuftraegeForUnternehmen(unternehmenId, form, options = {}) {
    try {
      const { disableMarke = false, message = 'Keine Marken verfügbar' } = options;
      const { data: auftraege, error } = await window.supabase
        .from('auftrag')
        .select('id, auftragsname, marke_id')
        .eq('unternehmen_id', unternehmenId)
        .order('auftragsname');
      
      if (error) {
        console.error('❌ Fehler beim Laden der Aufträge für Unternehmen:', error);
        return;
      }
      
      if (auftraege.length > 0) {
        console.log(`✅ ${auftraege.length} Aufträge direkt für Unternehmen ${unternehmenId} gefunden`);
        const auftragField = form.querySelector('[name="auftrag_id"]');
        if (auftragField) {
          const optionsList = auftraege.map(auftrag => ({
            value: auftrag.id,
            label: auftrag.auftragsname
          }));
          auftragField.disabled = false;
          this.updateDependentFieldOptions(auftragField, { name: 'auftrag_id' }, optionsList);
        }
      } else {
        console.log(`⚠️ Keine Aufträge für Unternehmen ${unternehmenId} gefunden`);
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
        }
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der Aufträge für Unternehmen:', error);
    }
  }

  // Hilfsmethode: Kaskaden-Felder zurücksetzen
  resetCascadeFields(form, fieldNames) {
    console.log(`🔄 Setze Kaskaden-Felder zurück:`, fieldNames);
    
    fieldNames.forEach(fieldName => {
      const field = form.querySelector(`[name="${fieldName}"]`);
      if (field) {
        // Feld zurücksetzen
        field.value = '';
        field.disabled = true;
        
        // Für searchable Selects
        const container = field.closest('.searchable-select-container, .tag-based-select');
        if (container) {
          const input = container.querySelector('.searchable-select-input');
          if (input) {
            input.value = '';
            input.placeholder = `Erst ${this.getFieldLabel(fieldName.replace('_id', ''))} auswählen...`;
          }
          
          // Tags entfernen
          const tagsContainer = container.querySelector('.tags-container');
          if (tagsContainer) {
            tagsContainer.innerHTML = '';
          }
        }
        
        // Standard Select zurücksetzen
        const placeholder = `Erst ${this.getFieldLabel(fieldName.replace('_id', ''))} auswählen...`;
        field.innerHTML = `<option value="">${placeholder}</option>`;
      }
    });
  }

  // Hilfsmethode: Field-Label für Placeholder
  getFieldLabel(fieldName) {
    const labelMap = {
      'unternehmen': 'Unternehmen',
      'unternehmen_id': 'Unternehmen',
      'marke': 'Marke',
      'marke_id': 'Marke',
      'marke_ids': 'Marke',
      'auftrag': 'Auftrag',
      'auftrag_id': 'Auftrag',
      'kampagne': 'Kampagne',
      'kampagne_id': 'Kampagne'
    };
    return labelMap[fieldName] || fieldName;
  }

  // Optionen für abhängiges Feld aktualisieren
  updateDependentFieldOptions(field, fieldConfig, options) {
    console.log(`🔄 Aktualisiere Optionen für ${fieldConfig.name} mit ${options.length} Optionen`);
    
    // Standard Select aktualisieren
    field.innerHTML = '<option value="">Bitte wählen...</option>';
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      field.appendChild(optionElement);
    });
    
    // Für searchable Selects: Container finden und Input aktivieren
    // WICHTIG: nextElementSibling verwenden, da das Select-Element versteckt ist
    const container = field.nextElementSibling;
    if (container && (container.classList.contains('searchable-select-container') || container.classList.contains('tag-based-select'))) {
      console.log(`✅ Searchable Select Container gefunden für ${fieldConfig.name}`);
      
      const input = container.querySelector('.searchable-select-input');
      if (input) {
        // Input aktivieren und Placeholder aktualisieren
        input.disabled = false;
        input.placeholder = fieldConfig.placeholder || 'Suchen...';
        input.readOnly = false;
        console.log(`✅ Input-Feld aktiviert für ${fieldConfig.name}`);
      }
    }
    
    // Für searchable Selects: Optionen über OptionsManager aktualisieren
    if (this.dynamicDataLoader && this.dynamicDataLoader.updateSelectOptions) {
      this.dynamicDataLoader.updateSelectOptions(field, options, fieldConfig);
    }
    
    console.log(`✅ Optionen erfolgreich aktualisiert für ${fieldConfig.name}`);
  }

  // Optionen für Tag-basierte Multi-Select-Felder aktualisieren
  async updateTagBasedMultiSelectOptions(field, fieldConfig, options) {
    console.log(`🏷️ Aktualisiere Tag-basierte Multi-Select Optionen für ${fieldConfig.name}:`, options);
    
    const formField = field.closest('.form-field');
    if (!formField) {
      console.warn('❌ Kein Form-Field Container gefunden');
      return;
    }
    
    // Bereits ausgewählte Werte merken
    const selectedValues = new Set();
    
    // Suche nach bestehenden ausgewählten Werten
    const existingTagContainer = formField.querySelector('.tag-based-select');
    if (existingTagContainer) {
      // Aus bestehenden Tags lesen
      const existingTags = existingTagContainer.querySelectorAll('.tag');
      existingTags.forEach(tag => {
        const value = tag.dataset?.value;
        if (value) selectedValues.add(value);
      });
      
      // Aus verstecktem Select lesen
      const hiddenSelect = existingTagContainer.querySelector('select[style*="display: none"]');
      if (hiddenSelect) {
        Array.from(hiddenSelect.selectedOptions).forEach(option => {
          if (option.value) selectedValues.add(option.value);
        });
      }
    }
    
    console.log(`🔍 Bestehende ausgewählte Werte:`, Array.from(selectedValues));
    
    // Original Select aktualisieren (damit auch ohne Tag-System die Werte korrekt sind)
    field.innerHTML = '<option value="">Bitte wählen...</option>';
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      field.appendChild(optionElement);
    });
    
    // WICHTIG: createTagBasedSelect kümmert sich jetzt um ALLES:
    // - Bestehende Optionen vollständig aktualisieren (inkl. dataset.options)
    // - Ungültige Tags entfernen (Tags deren Optionen nicht mehr verfügbar sind)
    // - Input aktivieren falls deaktiviert
    // - Verstecktes Select synchronisieren
    // Die obige Logik ist NICHT mehr nötig - createTagBasedSelect macht alles!
    if (window.formSystem?.optionsManager?.createTagBasedSelect) {
      window.formSystem.optionsManager.createTagBasedSelect(field, options, fieldConfig);
      console.log(`✅ Tag-basierte Multi-Select Optionen für ${fieldConfig.name} vollständig aktualisiert`);
    } else {
      console.warn(`⚠️ OptionsManager nicht verfügbar für ${fieldConfig.name}`);
    }
  }

  setNoOptionsState(field, fieldConfig, message) {
    const container = field.closest('.searchable-select-container, .tag-based-select');
    if (container) {
      const input = container.querySelector('.searchable-select-input');
      if (input) {
        input.value = '';
        input.placeholder = message;
        input.disabled = true;
      }
      const dropdown = container.querySelector('.searchable-select-dropdown');
      if (dropdown) {
        dropdown.innerHTML = `<div class="dropdown-item no-results">${message}</div>`;
      }
    }
    field.innerHTML = `<option value="">${message}</option>`;
    field.value = '';
    field.disabled = true;
  }

  enableSearchableField(field, fieldConfig) {
    field.disabled = false;
    const container = field.closest('.searchable-select-container, .tag-based-select');
    if (container) {
      const input = container.querySelector('.searchable-select-input');
      if (input) {
        input.disabled = false;
        input.placeholder = fieldConfig.placeholder || 'Suchen...';
      }
      const dropdown = container.querySelector('.searchable-select-dropdown');
      if (dropdown) {
        dropdown.innerHTML = '';
      }
    }
  }

  // Loading State anzeigen (Performance Optimierung #4)
  showLoadingState(field, fieldConfig) {
    const container = field.nextElementSibling;
    if (container && container.classList.contains('searchable-select-container')) {
      const input = container.querySelector('.searchable-select-input');
      if (input) {
        input.disabled = true;
        input.placeholder = 'Lädt...';
        input.classList.add('loading');
      }
    }
    
    // Auch für Tag-basierte Multi-Selects
    const tagContainer = field.closest('.form-field')?.querySelector('.tag-based-select');
    if (tagContainer) {
      const input = tagContainer.querySelector('.searchable-select-input');
      if (input) {
        input.disabled = true;
        input.placeholder = 'Lädt...';
        input.classList.add('loading');
      }
    }
  }

  // Loading State ausblenden (Performance Optimierung #4)
  hideLoadingState(field) {
    const container = field.nextElementSibling;
    if (container && container.classList.contains('searchable-select-container')) {
      const input = container.querySelector('.searchable-select-input');
      if (input) {
        input.classList.remove('loading');
      }
    }
    
    // Auch für Tag-basierte Multi-Selects
    const tagContainer = field.closest('.form-field')?.querySelector('.tag-based-select');
    if (tagContainer) {
      const input = tagContainer.querySelector('.searchable-select-input');
      if (input) {
        input.classList.remove('loading');
      }
    }
  }

  // Error State anzeigen (Performance Optimierung #5)
  showErrorState(field, fieldConfig) {
    const container = field.nextElementSibling;
    if (container && container.classList.contains('searchable-select-container')) {
      const input = container.querySelector('.searchable-select-input');
      if (input) {
        input.placeholder = 'Fehler beim Laden';
        input.classList.add('error');
        setTimeout(() => {
          input.classList.remove('error');
          input.placeholder = fieldConfig.placeholder || 'Bitte wählen...';
        }, 3000);
      }
    }
    
    // Auch für Tag-basierte Multi-Selects
    const tagContainer = field.closest('.form-field')?.querySelector('.tag-based-select');
    if (tagContainer) {
      const input = tagContainer.querySelector('.searchable-select-input');
      if (input) {
        input.placeholder = 'Fehler beim Laden';
        input.classList.add('error');
        setTimeout(() => {
          input.classList.remove('error');
          input.placeholder = fieldConfig.placeholder || 'Bitte wählen...';
        }, 3000);
      }
    }
  }

  // Gefiltertes Feld neu laden (für filterBy-Logik)
  async reloadFilteredField(form, fieldConfig, parentValue) {
    console.log(`🔄 RELOADFILTEREDFIELD: Lade ${fieldConfig.name} mit Filter ${fieldConfig.filterBy}=${parentValue}`);
    
    const field = form.querySelector(`[name="${fieldConfig.name}"]`);
    if (!field) {
      console.warn(`⚠️ Feld ${fieldConfig.name} nicht gefunden`);
      return;
    }
    
    // Loading State anzeigen
    this.showLoadingState(field, fieldConfig);
    
    try {
      let options = [];
      
      if (parentValue && fieldConfig.table) {
        // Lade gefilterte Daten aus der Datenbank
        const { data, error } = await window.supabase
          .from(fieldConfig.table)
          .select('*')
          .eq(fieldConfig.filterBy, parentValue)
          .order(fieldConfig.displayField || 'name', { ascending: true });
        
        if (error) {
          console.error(`❌ Fehler beim Laden von ${fieldConfig.table}:`, error);
          this.showErrorState(field, fieldConfig);
          return;
        }
        
        options = (data || []).map(item => ({
          value: item[fieldConfig.valueField || 'id'],
          label: item[fieldConfig.displayField] || item.name || 'Unbekannt'
        }));
        
        console.log(`✅ ${options.length} Optionen geladen für ${fieldConfig.name}`);
      } else {
        console.log(`⏸️ Kein Parent-Wert - zeige leere Optionen für ${fieldConfig.name}`);
      }
      
      // Tag-basiertes Multiselect aktualisieren
      if (fieldConfig.tagBased && window.formSystem?.optionsManager) {
        // Bestehende Tags entfernen (da Unternehmen gewechselt wurde)
        const tagContainer = field.closest('.form-field')?.querySelector('.tag-based-select');
        if (tagContainer) {
          const tagsContainer = tagContainer.querySelector('.tags-container');
          if (tagsContainer) {
            // Alle Tags entfernen
            const tags = tagsContainer.querySelectorAll('.tag');
            tags.forEach(tag => tag.remove());
            
            // Placeholder wieder hinzufügen wenn keine Tags
            const placeholder = document.createElement('span');
            placeholder.className = 'tags-placeholder';
            placeholder.textContent = 'Keine Auswahl';
            placeholder.style.color = '#6b7280';
            placeholder.style.fontStyle = 'italic';
            placeholder.style.fontSize = '14px';
            tagsContainer.appendChild(placeholder);
          }
        }
        
        // Optionen aktualisieren
        window.formSystem.optionsManager.createTagBasedSelect(field, options, fieldConfig);
      }
      
      this.hideLoadingState(field);
      
    } catch (error) {
      console.error(`❌ Fehler bei reloadFilteredField für ${fieldConfig.name}:`, error);
      this.showErrorState(field, fieldConfig);
    }
  }
} 