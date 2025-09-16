/**
 * SmartFormInitializer - Dependency-aware Field Initialization
 * 
 * Löst Race Conditions durch intelligente Dependency-Graph-basierte Initialisierung
 */
export class SmartFormInitializer {
  constructor() {
    this.stateManager = null;
    this.fieldLoader = null;
    this.dependencyGraph = null;
    this.initializationPromise = null;
  }

  // ==================== MAIN INITIALIZATION ====================
  
  async initializeForm(entityType, entityId = null, initialData = {}) {
    console.log(`🏗️ SMARTINIT: Initialisiere ${entityType}${entityId ? ` (Edit: ${entityId})` : ' (Create)'}`);
    
    // Prevent multiple simultaneous initializations
    if (this.initializationPromise) {
      console.log(`⏳ SMARTINIT: Warte auf laufende Initialisierung...`);
      return await this.initializationPromise;
    }

    this.initializationPromise = this._doInitialize(entityType, entityId, initialData);
    const result = await this.initializationPromise;
    this.initializationPromise = null;
    
    return result;
  }

  async _doInitialize(entityType, entityId, initialData) {
    try {
      // 1. Create state manager
      this.stateManager = new (await import('../state/FormStateManager.js')).FormStateManager(
        entityType, entityId, initialData
      );

      // 2. Create field loader
      this.fieldLoader = new (await import('../loading/FormFieldLoader.js')).FormFieldLoader(
        this.stateManager
      );

      // 3. Get form configuration
      const config = window.formSystem.config.getFormConfig(entityType);
      if (!config || !config.fields) {
        throw new Error(`Keine Form-Konfiguration für ${entityType} gefunden`);
      }

      // 4. Build dependency graph
      this.dependencyGraph = this.buildDependencyGraph(config.fields);
      console.log(`📊 SMARTINIT: Dependency Graph:`, {
        roots: this.dependencyGraph.roots.map(f => f.name),
        dependencies: Object.fromEntries(this.dependencyGraph.graph)
      });

      // 5. Register dependencies in state manager
      this.registerDependencies();

      // 6. Set up event listeners
      this.setupEventListeners();

      // 7. Load fields in correct order
      await this.loadFieldsInDependencyOrder();

      // 8. Initialize UI
      await this.initializeUI();

      console.log(`✅ SMARTINIT: ${entityType} erfolgreich initialisiert`);
      return {
        stateManager: this.stateManager,
        fieldLoader: this.fieldLoader,
        success: true
      };

    } catch (error) {
      console.error(`❌ SMARTINIT: Initialisierung fehlgeschlagen:`, error);
      this.cleanup();
      throw error;
    }
  }

  // ==================== DEPENDENCY GRAPH ====================
  
  buildDependencyGraph(fields) {
    const graph = new Map(); // parent -> [dependent1, dependent2]
    const reverseGraph = new Map(); // dependent -> parent
    const allFields = new Map(); // name -> fieldConfig
    const roots = []; // fields without dependencies

    // First pass: catalog all fields
    fields.forEach(field => {
      allFields.set(field.name, field);
      
      if (!field.dependsOn) {
        roots.push(field);
      } else {
        // Add to dependency graph
        if (!graph.has(field.dependsOn)) {
          graph.set(field.dependsOn, []);
        }
        graph.get(field.dependsOn).push(field);
        reverseGraph.set(field.name, field.dependsOn);
      }
    });

    // Validate dependencies
    this.validateDependencies(graph, reverseGraph, allFields);

    return {
      graph,
      reverseGraph,
      allFields,
      roots,
      levels: this.calculateDependencyLevels(graph, roots)
    };
  }

  validateDependencies(graph, reverseGraph, allFields) {
    // Check for circular dependencies
    const visited = new Set();
    const recursionStack = new Set();

    const hasCycle = (fieldName) => {
      if (recursionStack.has(fieldName)) {
        return true; // Circular dependency found
      }
      if (visited.has(fieldName)) {
        return false;
      }

      visited.add(fieldName);
      recursionStack.add(fieldName);

      const dependents = graph.get(fieldName) || [];
      for (const dependent of dependents) {
        if (hasCycle(dependent.name)) {
          return true;
        }
      }

      recursionStack.delete(fieldName);
      return false;
    };

    for (const fieldName of allFields.keys()) {
      if (hasCycle(fieldName)) {
        throw new Error(`Circular dependency detected involving field: ${fieldName}`);
      }
    }

    // Check for missing dependencies
    for (const [dependent, parent] of reverseGraph) {
      if (!allFields.has(parent)) {
        console.warn(`⚠️ SMARTINIT: Field ${dependent} depends on missing field ${parent}`);
      }
    }
  }

  calculateDependencyLevels(graph, roots) {
    const levels = [];
    let currentLevel = [...roots];
    let levelIndex = 0;

    while (currentLevel.length > 0) {
      levels[levelIndex] = currentLevel;
      console.log(`📊 SMARTINIT: Level ${levelIndex}:`, currentLevel.map(f => f.name));

      const nextLevel = [];
      for (const field of currentLevel) {
        const dependents = graph.get(field.name) || [];
        nextLevel.push(...dependents);
      }

      currentLevel = nextLevel;
      levelIndex++;

      // Safety check to prevent infinite loops
      if (levelIndex > 10) {
        console.warn(`⚠️ SMARTINIT: Dependency levels exceeded maximum depth`);
        break;
      }
    }

    return levels;
  }

  registerDependencies() {
    for (const [parent, dependents] of this.dependencyGraph.graph) {
      for (const dependent of dependents) {
        this.stateManager.addDependency(parent, dependent.name);
      }
    }
  }

  // ==================== EVENT HANDLING ====================
  
  setupEventListeners() {
    // Listen for field changes to trigger dependent fields
    this.stateManager.on('fieldChanged', ({ fieldName, value }) => {
      this.handleFieldChange(fieldName, value);
    });

    // Listen for dependent field triggers
    this.stateManager.on('dependentFieldsTriggered', ({ parentField, dependents }) => {
      this.loadDependentFields(parentField, dependents);
    });
  }

  async handleFieldChange(fieldName, value) {
    console.log(`🔄 SMARTINIT: Field ${fieldName} changed to:`, value);
    
    // Update UI immediately
    this.updateFieldUI(fieldName, value);
    
    // Trigger dependent fields will be handled by the state manager
  }

  async loadDependentFields(parentField, dependentFieldNames) {
    const parentValue = this.stateManager.getFieldValue(parentField);
    
    console.log(`⚡ SMARTINIT: Lade abhängige Felder von ${parentField} (${parentValue}):`, dependentFieldNames);

    for (const dependentFieldName of dependentFieldNames) {
      const fieldConfig = this.dependencyGraph.allFields.get(dependentFieldName);
      if (fieldConfig) {
        try {
          await this.fieldLoader.loadField(fieldConfig, parentValue);
        } catch (error) {
          console.error(`❌ SMARTINIT: Fehler beim Laden von ${dependentFieldName}:`, error);
        }
      }
    }
  }

  // ==================== FIELD LOADING ====================
  
  async loadFieldsInDependencyOrder() {
    console.log(`🔄 SMARTINIT: Lade Felder in Dependency-Reihenfolge...`);

    for (let levelIndex = 0; levelIndex < this.dependencyGraph.levels.length; levelIndex++) {
      const level = this.dependencyGraph.levels[levelIndex];
      console.log(`📊 SMARTINIT: Lade Level ${levelIndex} (${level.length} Felder):`, level.map(f => f.name));

      // Load all fields in this level in parallel (they don't depend on each other)
      const loadPromises = level.map(async (fieldConfig) => {
        try {
          // Get parent value if this field depends on something
          let parentValue = null;
          if (fieldConfig.dependsOn) {
            parentValue = this.stateManager.getFieldValue(fieldConfig.dependsOn);
            if (!parentValue) {
              console.log(`⏭️ SMARTINIT: ${fieldConfig.name} übersprungen - ${fieldConfig.dependsOn} hat keinen Wert`);
              return;
            }
          }

          await this.fieldLoader.loadField(fieldConfig, parentValue);
        } catch (error) {
          console.error(`❌ SMARTINIT: Fehler beim Laden von ${fieldConfig.name}:`, error);
        }
      });

      // Wait for all fields in this level to complete
      await Promise.all(loadPromises);
      
      console.log(`✅ SMARTINIT: Level ${levelIndex} abgeschlossen`);
    }

    console.log(`🏁 SMARTINIT: Alle Felder geladen`);
  }

  // ==================== UI INTEGRATION ====================
  
  async initializeUI() {
    console.log(`🎨 SMARTINIT: Initialisiere UI...`);
    
    // This will be called after all fields are loaded
    // The existing FormSystem will handle the actual UI rendering
    // We just need to make sure our state is available
    
    // Make state manager globally available for the existing system
    window.currentFormState = this.stateManager;
    window.currentFieldLoader = this.fieldLoader;
    
    console.log(`✅ SMARTINIT: UI initialisiert`);
  }

  updateFieldUI(fieldName, value) {
    // Update the actual form field in the DOM
    const field = document.querySelector(`[name="${fieldName}"]`);
    if (field) {
      if (field.tagName === 'SELECT') {
        // Handle select fields
        field.value = value;
      } else if (field.type === 'checkbox' || field.type === 'radio') {
        field.checked = value;
      } else {
        field.value = value;
      }
      
      // Trigger change event for other systems
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // ==================== UTILITIES ====================
  
  getInitializationStatus() {
    if (!this.stateManager) {
      return { status: 'not_initialized' };
    }

    return {
      status: 'initialized',
      entityType: this.stateManager.entityType,
      isEditMode: this.stateManager.isEditMode,
      loadedFields: this.fieldLoader?.getQueueStatus()?.loadedFields || [],
      stateDebug: this.stateManager.getDebugInfo()
    };
  }

  // ==================== CLEANUP ====================
  
  cleanup() {
    if (this.stateManager) {
      this.stateManager.destroy();
      this.stateManager = null;
    }
    
    if (this.fieldLoader) {
      this.fieldLoader.destroy();
      this.fieldLoader = null;
    }

    this.dependencyGraph = null;
    
    // Clean up global references
    if (window.currentFormState === this.stateManager) {
      window.currentFormState = null;
    }
    if (window.currentFieldLoader === this.fieldLoader) {
      window.currentFieldLoader = null;
    }

    console.log(`🗑️ SMARTINIT: Cleanup abgeschlossen`);
  }

  destroy() {
    this.cleanup();
  }
}
