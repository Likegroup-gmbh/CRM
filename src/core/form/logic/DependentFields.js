export class DependentFields {
  constructor(autoGeneration) {
    this.autoGeneration = autoGeneration;
    this.dynamicDataLoader = null; // Wird später injiziert
  }

  // Abhängige Felder verwalten
  setupDependentFields(form) {
    const dependentFields = form.querySelectorAll('[data-depends-on]');
    
    dependentFields.forEach(field => {
      const dependsOn = field.dataset.dependsOn;
      const showWhen = field.dataset.showWhen;
      const parentField = form.querySelector(`[name="${dependsOn}"]`);
      
      if (parentField) {
        const toggleField = () => {
          const parentValue = parentField.value;
          console.log(`🔍 Prüfe abhängiges Feld: ${dependsOn} = "${parentValue}", showWhen = "${showWhen}"`);
          
          // Für Select-Felder den angezeigten Text verwenden
          let shouldShow = false;
          if (parentField.tagName === 'SELECT') {
            const selectedOption = parentField.selectedOptions[0];
            const displayText = selectedOption ? selectedOption.textContent : '';
            shouldShow = showWhen ? displayText.includes(showWhen) : !!parentValue;
            console.log(`🔍 Select-Feld: "${displayText}" enthält "${showWhen}" = ${shouldShow}`);
          } else {
            shouldShow = showWhen ? 
              (parentValue === showWhen || parentValue.includes(showWhen)) : 
              !!parentValue;
          }
          
          const fieldContainer = field.closest('.form-field');
          if (fieldContainer) {
            fieldContainer.style.display = shouldShow ? 'block' : 'none';
            console.log(`🔍 Feld ${field.dataset.dependsOn} ${shouldShow ? 'angezeigt' : 'versteckt'}`);
            
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
    this.setupDynamicDependentFields(form);
  }

  // Dynamische abhängige Felder verwalten
  setupDynamicDependentFields(form) {
    // Finde alle Felder mit dependsOn-Eigenschaft in der Konfiguration
    const entity = form.dataset.entity;
    if (!entity || !this.getFormConfig) return;

    const config = this.getFormConfig(entity);
    if (!config) return;

    config.fields.forEach(field => {
      if (field.dependsOn) {
        const dependentField = form.querySelector(`[name="${field.name}"]`);
        const parentField = form.querySelector(`[name="${field.dependsOn}"]`);
        
        if (dependentField && parentField) {
          console.log(`🔧 Setup dynamisches abhängiges Feld: ${field.name} abhängig von ${field.dependsOn}`);
          
          const updateDependentField = async () => {
            const parentValue = this.getFieldValue(parentField);
            console.log(`🔍 Parent-Feld ${field.dependsOn} geändert:`, parentValue);
            
            if (!parentValue) {
              // Kein Parent-Wert: Abhängiges Feld leeren und deaktivieren
              this.clearDependentField(dependentField, field);
              
              // Wenn Unternehmen geändert wurde, auch nachfolgende Felder zurücksetzen
              if (field.dependsOn === 'unternehmen_id') {
                this.resetCascadeFields(form, ['marke_id', 'kampagne_id', 'creator_id', 'auftrag_id']);
              }
              // Wenn Marke geändert wurde, auch nachfolgende Felder zurücksetzen
              else if (field.dependsOn === 'marke_id') {
                this.resetCascadeFields(form, ['kampagne_id', 'creator_id', 'auftrag_id']);
              }
              
              return;
            }
            
            // Daten für abhängiges Feld laden
            await this.loadDependentFieldData(dependentField, field, parentValue, form);
          };
          
          // Event-Listener für Parent-Feld
          parentField.addEventListener('change', updateDependentField);
          
          // Für searchable Selects auch auf Input-Events hören
          const searchableContainer = parentField.closest('.searchable-select-container, .tag-based-select');
          if (searchableContainer) {
            const searchInput = searchableContainer.querySelector('.searchable-select-input');
            if (searchInput) {
              // Debounced Event für Suche
              let timeout;
              searchInput.addEventListener('input', () => {
                clearTimeout(timeout);
                timeout = setTimeout(updateDependentField, 300);
              });
            }
          }
          
          // Initial state
          updateDependentField();
        }
      }
    });
  }

  // Wert aus Feld extrahieren (auch für searchable Selects)
  getFieldValue(field) {
    // Für versteckte Selects (bei searchable Selects)
    const hiddenSelect = field.parentNode.querySelector('select[style*="display: none"]');
    if (hiddenSelect && hiddenSelect !== field) {
      return hiddenSelect.value;
    }
    
    return field.value;
  }

  // Abhängiges Feld leeren
  clearDependentField(field, fieldConfig) {
    console.log(`🧹 Leere abhängiges Feld: ${fieldConfig.name}`);
    
    // Dynamischen Placeholder basierend auf dependsOn erstellen
    const getPlaceholder = () => {
      const labelMap = {
        'unternehmen_id': 'Unternehmen',
        'marke_id': 'Marke',
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
    
    try {
      // Spezielle Logik für Marken basierend auf Unternehmen
      if (fieldConfig.name === 'marke_id' && fieldConfig.dependsOn === 'unternehmen_id') {
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
        
        // Feld wieder aktivieren
        field.disabled = false;
        
        // Optionen aktualisieren
        this.updateDependentFieldOptions(field, fieldConfig, options);
        
        // Wenn keine Marken vorhanden, Aufträge direkt basierend auf Unternehmen laden
        if (options.length === 0) {
          console.log(`⚠️ Keine Marken für Unternehmen ${parentValue} gefunden - lade Aufträge direkt`);
          await this.loadAuftraegeForUnternehmen(parentValue, form);
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
      
      // Spezielle Logik für Aufträge basierend auf Unternehmen (wenn keine Marken vorhanden)
      if (fieldConfig.name === 'auftrag_id' && fieldConfig.dependsOn === 'unternehmen_id') {
        const { data: auftraege, error } = await window.supabase
          .from('auftrag')
          .select('id, auftragsname')
          .eq('unternehmen_id', parentValue)
          .order('auftragsname');
        
        if (error) {
          console.error('❌ Fehler beim Laden der Aufträge für Unternehmen:', error);
          return;
        }
        
        const options = auftraege.map(auftrag => ({
          value: auftrag.id,
          label: auftrag.auftragsname
        }));
        
        console.log(`✅ ${options.length} Aufträge direkt für Unternehmen ${parentValue} geladen`);
        
        // Feld wieder aktivieren
        field.disabled = false;
        
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
          console.warn('⚠️ Konnte belegte Videos nicht überprüfen, zeige alle Kampagnen:', e);
        }

        const options = filtered.map(k => ({ value: k.id, label: k.kampagnenname || 'Unbenannte Kampagne' }));
        field.disabled = false;
        this.updateDependentFieldOptions(field, fieldConfig, options);
      }

      // Neue Logik: Creator basierend auf Kampagne laden (nur finale Creator der Kampagne)
      if (fieldConfig.name === 'creator_id' && fieldConfig.dependsOn === 'kampagne_id') {
        try {
          const { data: kampagneCreators, error } = await window.supabase
            .from('kampagne_creator')
            .select('creator_id, creator:creator_id(id, vorname, nachname)')
            .eq('kampagne_id', parentValue)
            .order('creator_id');
          if (error) {
            console.error('❌ Fehler beim Laden der Kampagnen-Creator:', error);
            return;
          }
          const options = (kampagneCreators || [])
            .map(row => {
              const c = row.creator || {};
              const label = `${c.vorname || ''} ${c.nachname || ''}`.trim() || row.creator_id;
              return { value: row.creator_id, label };
            });
          field.disabled = false;
          this.updateDependentFieldOptions(field, fieldConfig, options);
        } catch (e) {
          console.error('❌ Fehler beim Laden der Creator für Kampagne:', e);
        }
      }
    } catch (error) {
      console.error(`❌ Fehler beim Laden der abhängigen Daten:`, error);
    }
  }

  // Hilfsmethode: Aufträge direkt für Unternehmen laden (wenn keine Marken vorhanden)
  async loadAuftraegeForUnternehmen(unternehmenId, form) {
    try {
      // Erst prüfen ob Aufträge für dieses Unternehmen existieren
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
        
        // Auftrag-Feld finden und aktivieren
        const auftragField = form.querySelector('[name="auftrag_id"]');
        if (auftragField) {
          const options = auftraege.map(auftrag => ({
            value: auftrag.id,
            label: auftrag.auftragsname
          }));
          
          // Auftrag-Feld aktivieren und Optionen setzen
          auftragField.disabled = false;
          this.updateDependentFieldOptions(auftragField, { name: 'auftrag_id' }, options);
          
          // Marke-Feld als "Nicht verfügbar" markieren
          const markeField = form.querySelector('[name="marke_id"]');
          if (markeField) {
            markeField.innerHTML = '<option value="">Keine Marken verfügbar</option>';
            markeField.disabled = true;
          }
          
          // Auftrag-Feld temporär auf Unternehmen-Abhängigkeit umstellen
          // (wird beim nächsten Unternehmen-Wechsel wieder zurückgesetzt)
          console.log('🔄 Auftrag-Feld temporär auf Unternehmen-Abhängigkeit umgestellt');
        }
      } else {
        console.log(`⚠️ Keine Aufträge für Unternehmen ${unternehmenId} gefunden`);
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
      'marke': 'Marke',
      'auftrag': 'Auftrag'
    };
    return labelMap[fieldName] || fieldName;
  }

  // Optionen für abhängiges Feld aktualisieren
  updateDependentFieldOptions(field, fieldConfig, options) {
    // Für searchable Selects
    const container = field.closest('.searchable-select-container, .tag-based-select');
    if (container) {
      const input = container.querySelector('.searchable-select-input');
      if (input) {
        input.placeholder = fieldConfig.placeholder || 'Suchen...';
      }
    }
    
    // Standard Select aktualisieren
    field.innerHTML = '<option value="">Bitte wählen...</option>';
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      field.appendChild(optionElement);
    });
    
    // Für searchable Selects: Optionen über OptionsManager aktualisieren
    if (this.dynamicDataLoader && this.dynamicDataLoader.updateSelectOptions) {
      this.dynamicDataLoader.updateSelectOptions(field, options, fieldConfig);
    }
  }
} 