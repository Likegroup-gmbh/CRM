export class DependentFields {
  constructor(autoGeneration) {
    this.autoGeneration = autoGeneration;
    this.dynamicDataLoader = null; // Wird später injiziert
  }

  // Abhängige Felder verwalten
  setupDependentFields(form) {
    // Spezielle Behandlung für Kampagne Edit-Mode: Überspringen
    const isKampagneEditMode = form.dataset.entityType === 'kampagne' && form.dataset.isEditMode === 'true';
    if (isKampagneEditMode) {
      console.log('🎯 DEPENDENTFIELDS: Überspringe Setup für Kampagne Edit-Mode - DynamicDataLoader übernimmt');
      return;
    }
    
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
    // Spezielle Behandlung für Kampagne Edit-Mode: Überspringen
    const isKampagneEditMode = form.dataset.entityType === 'kampagne' && form.dataset.isEditMode === 'true';
    if (isKampagneEditMode) {
      console.log('🎯 DEPENDENTFIELDS: Überspringe Dynamic Setup für Kampagne Edit-Mode');
      return;
    }
    
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
            const isEditMode = form.dataset.isEditMode === 'true';
            const currentFieldValue = this.getFieldValue(dependentField);
            
            console.log(`🔍 Parent-Feld ${field.dependsOn} geändert:`, parentValue);
            
            if (!parentValue) {
              // Edit-Mode: Nicht automatisch leeren wenn das Feld bereits einen sinnvollen Wert hat
              if (isEditMode && currentFieldValue && 
                  !currentFieldValue.includes('auswählen') && 
                  currentFieldValue !== '' && 
                  currentFieldValue !== 'undefined') {
                console.log(`📝 Edit-Mode: Behalte bestehenden Wert für ${field.name}: "${currentFieldValue}"`);
                return;
              }
              
              // Kein Parent-Wert: Abhängiges Feld leeren und deaktivieren
              console.log(`🧹 Kein Parent-Wert für ${field.name} - Feld wird geleert und deaktiviert`);
              this.clearDependentField(dependentField, field);
              
              // Wenn Unternehmen geändert wurde, auch nachfolgende Felder zurücksetzen
              if (field.dependsOn === 'unternehmen_id') {
                this.resetCascadeFields(form, ['marke_id', 'marke_ids', 'kampagne_id', 'briefing_id', 'creator_id', 'auftrag_id']);
              }
              // Wenn Marke geändert wurde, auch nachfolgende Felder zurücksetzen
              else if (field.dependsOn === 'marke_id') {
                this.resetCascadeFields(form, ['kampagne_id', 'briefing_id', 'creator_id', 'auftrag_id']);
              }
              
              return;
            }
            
            // Daten für abhängiges Feld laden
            await this.loadDependentFieldData(dependentField, field, parentValue, form);
          };
          
          // Event-Listener für Parent-Feld registrieren
          // WICHTIG: Sofort registrieren UND nach Delays wiederholen für Searchable Selects
          console.log(`🔧 Registriere Event-Listener SOFORT für ${field.dependsOn} -> ${field.name}`);
          this.registerDependentFieldListeners(parentField, updateDependentField, form);
          
          // WICHTIG: Auf searchable-select-ready Event reagieren (AUSSERHALB von registerDependentFieldListeners)
          // Verhindere Duplikate mit Flag
          if (!parentField.dataset.searchableReadyListenerRegistered) {
            parentField.dataset.searchableReadyListenerRegistered = 'true';
            parentField.addEventListener('searchable-select-ready', (e) => {
              console.log(`🎯 Searchable Select bereit Event empfangen für ${field.dependsOn}, re-registriere Listener`);
              this.registerDependentFieldListeners(parentField, updateDependentField, form);
            });
          }
          
          // Zusätzlich nach Delays wiederholen (für Searchable Selects die später initialisiert werden)
          setTimeout(() => {
            console.log(`⏰ [300ms] Re-Registriere Event-Listener für ${field.dependsOn} -> ${field.name}`);
            this.registerDependentFieldListeners(parentField, updateDependentField, form);
          }, 300);
          setTimeout(() => {
            console.log(`⏰ [700ms] Re-Registriere Event-Listener für ${field.dependsOn} -> ${field.name}`);
            this.registerDependentFieldListeners(parentField, updateDependentField, form);
          }, 700);
          
          // Initial state - Edit-Mode berücksichtigen
          // WICHTIG: Warte kurz, bis Searchable Selects vollständig initialisiert sind
          setTimeout(() => {
            const initialParentValue = this.getFieldValue(parentField);
            const isEditMode = form.dataset.isEditMode === 'true';
            const hasExistingValue = this.getFieldValue(dependentField);
            
            console.log(`🔍 Initial Check für ${field.name}: Parent=${initialParentValue}, EditMode=${isEditMode}, ExistingValue=${hasExistingValue}`);
            
            if (initialParentValue) {
              // Parent hat Wert: Normal updaten
              console.log(`✅ Parent hat Wert - Update ${field.name}`);
              updateDependentField();
            } else if (isEditMode && hasExistingValue) {
              // Edit-Mode mit bestehendem Wert: Nicht deaktivieren
              console.log(`📝 Edit-Mode: Behalte bestehenden Wert für ${field.name}:`, hasExistingValue);
            } else {
              // Kein Parent-Wert und kein Edit-Mode: Feld initial deaktivieren
              console.log(`🚫 Initial deaktiviert: ${field.name} (kein Parent-Wert)`);
              updateDependentField();
            }
          }, 700); // Etwas später als Listener-Registrierung
        }
      }
    });
  }

  // Event-Listener für abhängige Felder registrieren
  registerDependentFieldListeners(parentField, updateCallback, form) {
    console.log(`🎧 Registriere Event-Listener für abhängiges Feld:`, parentField.name);
    
    // WICHTIG: Haupt-Listener auf dem ursprünglichen Select-Element SOFORT registrieren
    // Dieser wird vom FormSystem gefeuert, wenn ein Wert ausgewählt wird
    // ACHTUNG: Verwende { once: false } um mehrfache Registrierungen zuzulassen
    const changeHandler = (e) => {
      console.log(`🔔 CHANGE EVENT auf ${parentField.name}, Wert:`, e.target.value, 'Field Value:', parentField.value);
      // Sofort callback ausführen, nicht warten
      updateCallback();
    };
    
    // Entferne alte Listener falls vorhanden (über gespeicherte Referenz)
    if (parentField._dependentChangeHandler) {
      parentField.removeEventListener('change', parentField._dependentChangeHandler);
      console.log(`🗑️ Alter Change-Listener entfernt für ${parentField.name}`);
    }
    
    // Speichere Referenz und registriere neuen Listener
    parentField._dependentChangeHandler = changeHandler;
    parentField.addEventListener('change', changeHandler);
    
    console.log(`✅ Haupt-Listener registriert auf ${parentField.name}`);
    
    // Hilfsfunktion: Listener auf Searchable Select Container registrieren (zusätzlich)
    const registerSearchableListeners = () => {
      const searchableContainer = parentField.nextElementSibling;
      
      if (searchableContainer && searchableContainer.classList.contains('searchable-select-container')) {
        console.log(`🔍 Searchable Select Container gefunden für:`, parentField.name);
        
        // Prüfe ob bereits Listener registriert sind (data-attribute als Flag)
        if (searchableContainer.dataset.listenersRegistered === 'true') {
          console.log(`⏭️ Listener bereits registriert für:`, parentField.name);
          return true; // Erfolgreich registriert (bereits gemacht)
        }
        
        // Markiere als registriert
        searchableContainer.dataset.listenersRegistered = 'true';
        
        // Prüfe ob es ein verstecktes Select gibt (für Tag-basierte Multi-Selects)
        const hiddenSelect = searchableContainer.querySelector('select[style*="display: none"]');
        if (hiddenSelect && hiddenSelect.id.endsWith('_hidden')) {
          console.log(`📦 Verstecktes Select gefunden: ${hiddenSelect.id}`);
          hiddenSelect.addEventListener('change', () => {
            console.log(`🔔 Change Event von verstecktem Select: ${hiddenSelect.id}`);
            updateCallback();
          });
        }
        
        // Zusätzlich: Listener auf das Input-Feld für sofortige Reaktion
        const searchInput = searchableContainer.querySelector('.searchable-select-input');
        if (searchInput) {
          console.log(`🔍 Search Input gefunden für:`, parentField.name);
          searchInput.addEventListener('change', () => {
            console.log(`🔔 Change Event von Search Input`);
            updateCallback();
          });
        }
        
        console.log(`✅ Searchable Select Listener registriert für:`, parentField.name);
        return true; // Erfolgreich registriert
      }
      return false; // Noch nicht gefunden
    };
    
    // Sofort versuchen zu registrieren
    let registered = registerSearchableListeners();
    
    // Wenn noch nicht erfolgreich, mehrfach versuchen
    if (!registered) {
      const retryIntervals = [50, 200, 500, 1000];
      retryIntervals.forEach(delay => {
        setTimeout(() => {
          if (!registered) {
            registered = registerSearchableListeners();
          }
        }, delay);
      });
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
        
        // Dropdown verstecken
        const dropdown = container.querySelector('.searchable-select-dropdown');
        if (dropdown) {
          dropdown.style.display = 'none';
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
      'marke': 'Marke',
      'auftrag': 'Auftrag'
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
} 