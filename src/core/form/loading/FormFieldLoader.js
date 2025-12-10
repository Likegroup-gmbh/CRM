/**
 * FormFieldLoader - Sequentielle Field Loading Pipeline
 * 
 * Löst Race Conditions durch geordnete, sequentielle Feldladung
 */
export class FormFieldLoader {
  constructor(stateManager) {
    this.state = stateManager;
    this.loadingQueue = [];
    this.isProcessing = false;
    this.loadedFields = new Set();
    
    console.log(`🔄 FIELDLOADER: Initialisiert für ${stateManager.entityType}`);
  }

  // ==================== QUEUE MANAGEMENT ====================
  
  async loadField(fieldConfig, parentValue = null) {
    return new Promise((resolve, reject) => {
      const queueItem = {
        fieldConfig,
        parentValue,
        resolve,
        reject,
        timestamp: Date.now()
      };
      
      this.loadingQueue.push(queueItem);
      console.log(`📥 FIELDLOADER: ${fieldConfig.name} in Queue (${this.loadingQueue.length} items)`);
      
      // Start processing if not already running
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  async processQueue() {
    if (this.isProcessing) {
      console.log(`⏳ FIELDLOADER: Bereits am Verarbeiten, warte...`);
      return;
    }

    this.isProcessing = true;
    console.log(`🚀 FIELDLOADER: Starte Queue-Verarbeitung (${this.loadingQueue.length} items)`);

    while (this.loadingQueue.length > 0) {
      const { fieldConfig, parentValue, resolve, reject } = this.loadingQueue.shift();
      
      try {
        // Mark as loading
        this.state.setFieldState(fieldConfig.name, { loading: true, error: null });
        
        console.log(`🔄 FIELDLOADER: Lade ${fieldConfig.name}${parentValue ? ` (parent: ${parentValue})` : ''}`);
        
        // Load field data
        const result = await this.loadFieldData(fieldConfig, parentValue);
        
        // Mark as loaded
        this.state.setFieldState(fieldConfig.name, { loading: false, loaded: true });
        this.loadedFields.add(fieldConfig.name);
        
        console.log(`✅ FIELDLOADER: ${fieldConfig.name} geladen (${result.options.length} Optionen)`);
        resolve(result);
        
        // Small delay to prevent overwhelming the browser
        await this.sleep(10);
        
      } catch (error) {
        console.error(`❌ FIELDLOADER: Fehler beim Laden von ${fieldConfig.name}:`, error);
        this.state.setFieldState(fieldConfig.name, { loading: false, error: error.message });
        reject(error);
      }
    }

    this.isProcessing = false;
    console.log(`🏁 FIELDLOADER: Queue-Verarbeitung abgeschlossen`);
  }

  // ==================== FIELD DATA LOADING ====================
  
  async loadFieldData(fieldConfig, parentValue = null) {
    const { name, type, table, displayField, valueField, directQuery, dependsOn } = fieldConfig;
    
    // Check if field depends on a parent value
    if (dependsOn && (!parentValue || parentValue === 'null' || parentValue === '')) {
      console.log(`⏭️ FIELDLOADER: ${name} benötigt ${dependsOn} (${parentValue}), überspringe`);
      return { options: [], selectedValues: null };
    }

    let options = [];
    let selectedValues = null;

    // Load options based on field type
    if (directQuery && table) {
      options = await this.loadDirectQueryOptions(fieldConfig, parentValue);
    } else if (fieldConfig.options && Array.isArray(fieldConfig.options)) {
      options = fieldConfig.options.map(opt => 
        typeof opt === 'string' ? { value: opt, label: opt } : opt
      );
    } else {
      // Dynamic loading through DataService
      options = await this.loadDynamicOptions(fieldConfig, parentValue);
    }

    // Handle edit mode pre-selection
    if (this.state.isEditMode) {
      selectedValues = this.getEditModeSelectedValues(fieldConfig);
    }

    // Update state
    this.state.setFieldOptions(name, options, selectedValues);

    return { options, selectedValues };
  }

  async loadDirectQueryOptions(fieldConfig, parentValue = null) {
    const { name, table, displayField, valueField = 'id', filter, dependsOn } = fieldConfig;
    
    try {
      let query = window.supabase.from(table).select('*');

      // Apply parent filter if this is a dependent field
      if (dependsOn && parentValue) {
        if (name === 'marke_id' && dependsOn === 'unternehmen_id') {
          query = query.eq('unternehmen_id', parentValue);
        } else if (name === 'auftrag_id' && dependsOn === 'marke_id') {
          query = query.eq('marke_id', parentValue);
        } else {
          // Generic dependency handling
          query = query.eq(dependsOn, parentValue);
        }
      }

      // Apply additional filters
      if (filter) {
        query = query.or(filter);
      }

      // Benutzer-Tabelle: Kunden ausschließen (nur Mitarbeiter/Admins anzeigen)
      if (table === 'benutzer') {
        query = query.neq('rolle', 'kunde');
      }

      const { data, error } = await query;

      if (error) {
        console.error(`❌ FIELDLOADER: Supabase error for ${name}:`, error);
        throw error;
      }

      // Convert to options format
      const options = (data || []).map(item => {
        let label = 'Unbekannt';
        
        if (displayField) {
          if (displayField.includes(',')) {
            // Multiple fields: "vorname,nachname,email"
            const fields = displayField.split(',').map(f => f.trim());
            const values = fields.map(f => item[f]).filter(Boolean);
            label = values.length > 0 ? values.join(' ') : 'Unbekannt';
          } else {
            // Single field
            label = item[displayField] || 'Unbekannt';
          }
        } else {
          label = item.name || item.label || 'Unbekannt';
        }

        return {
          value: item[valueField],
          label: label,
          description: item.beschreibung || item.description,
          data: item // Keep original data for reference
        };
      });

      console.log(`📊 FIELDLOADER: ${name} direct query: ${options.length} Optionen aus ${table}`);
      return options;

    } catch (error) {
      console.error(`❌ FIELDLOADER: Fehler beim direkten Laden von ${name}:`, error);
      return [];
    }
  }

  async loadDynamicOptions(fieldConfig, parentValue = null) {
    // Fallback to existing DataService logic
    try {
      const options = await window.dataService.loadFieldOptions(fieldConfig, parentValue);
      console.log(`📊 FIELDLOADER: ${fieldConfig.name} dynamic: ${options.length} Optionen`);
      return options;
    } catch (error) {
      console.error(`❌ FIELDLOADER: DataService error for ${fieldConfig.name}:`, error);
      return [];
    }
  }

  getEditModeSelectedValues(fieldConfig) {
    const { name } = fieldConfig;
    
    // Get from initial form data
    const value = this.state.formData[name];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }

    // Try alternative field names for compatibility
    const alternativeNames = [
      `${name}_ids`,
      name.replace('_id', '_ids'),
      name.replace('_ids', '_id')
    ];

    for (const altName of alternativeNames) {
      const altValue = this.state.formData[altName];
      if (altValue !== undefined && altValue !== null && altValue !== '') {
        return altValue;
      }
    }

    // Für abhängige Felder: Wenn Parent null ist, skip field loading
    if (fieldConfig.dependsOn) {
      const parentValue = this.state.formData[fieldConfig.dependsOn];
      if (!parentValue) {
        console.log(`⏭️ FIELDLOADER: ${name} übersprungen - ${fieldConfig.dependsOn} ist null/undefined`);
        return null;
      }
    }

    return null;
  }

  // ==================== UTILITIES ====================
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isFieldLoaded(fieldName) {
    return this.loadedFields.has(fieldName);
  }

  getQueueStatus() {
    return {
      queueLength: this.loadingQueue.length,
      isProcessing: this.isProcessing,
      loadedFields: Array.from(this.loadedFields)
    };
  }

  // ==================== CLEANUP ====================
  
  destroy() {
    this.loadingQueue = [];
    this.isProcessing = false;
    this.loadedFields.clear();
    console.log(`🗑️ FIELDLOADER: Zerstört`);
  }
}
