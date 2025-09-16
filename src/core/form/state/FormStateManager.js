/**
 * FormStateManager - Zentrales State Management für Forms
 * 
 * Löst Race Conditions durch einheitlichen State und Event-basierte Updates
 */
export class FormStateManager {
  constructor(entityType, entityId = null, initialData = {}) {
    this.entityType = entityType;
    this.entityId = entityId;
    this.isEditMode = !!entityId;
    
    // Zentraler State
    this.formData = { ...initialData };
    this.fieldOptions = new Map(); // fieldName -> options[]
    this.fieldStates = new Map();  // fieldName -> { loading, loaded, error }
    this.selectedValues = new Map(); // fieldName -> selectedValue(s)
    
    // Dependency Tracking
    this.fieldDependencies = new Map(); // parentField -> [dependentField1, dependentField2]
    this.reverseDependencies = new Map(); // dependentField -> parentField
    
    // Event System
    this.listeners = new Map(); // eventType -> [callback1, callback2]
    
    console.log(`🏗️ FORMSTATE: Initialisiert für ${entityType}${entityId ? ` (Edit: ${entityId})` : ' (Create)'}`);
  }

  // ==================== STATE MANAGEMENT ====================
  
  setFieldValue(fieldName, value, triggerEvents = true) {
    const oldValue = this.selectedValues.get(fieldName);
    this.selectedValues.set(fieldName, value);
    this.formData[fieldName] = value;
    
    console.log(`📝 FORMSTATE: ${fieldName} = ${value} (war: ${oldValue})`);
    
    if (triggerEvents && oldValue !== value) {
      this.emit('fieldChanged', { fieldName, value, oldValue });
      this.triggerDependentFields(fieldName);
    }
  }

  getFieldValue(fieldName) {
    return this.selectedValues.get(fieldName) || this.formData[fieldName];
  }

  setFieldOptions(fieldName, options, selectedValues = null) {
    this.fieldOptions.set(fieldName, options);
    this.setFieldState(fieldName, { loaded: true, loading: false });
    
    // Auto-select in Edit Mode
    if (this.isEditMode && selectedValues) {
      if (Array.isArray(selectedValues)) {
        this.setFieldValue(fieldName, selectedValues, false); // Don't trigger events during init
      } else {
        this.setFieldValue(fieldName, selectedValues, false);
      }
    }
    
    console.log(`📋 FORMSTATE: ${fieldName} Optionen gesetzt: ${options.length} (selected: ${selectedValues})`);
    this.emit('fieldOptionsLoaded', { fieldName, options, selectedValues });
  }

  getFieldOptions(fieldName) {
    return this.fieldOptions.get(fieldName) || [];
  }

  setFieldState(fieldName, state) {
    const currentState = this.fieldStates.get(fieldName) || {};
    const newState = { ...currentState, ...state };
    this.fieldStates.set(fieldName, newState);
    
    if (state.loading !== undefined) {
      this.emit('fieldLoadingChanged', { fieldName, loading: state.loading });
    }
  }

  getFieldState(fieldName) {
    return this.fieldStates.get(fieldName) || { loading: false, loaded: false, error: null };
  }

  // ==================== DEPENDENCY MANAGEMENT ====================
  
  addDependency(parentField, dependentField) {
    // Forward dependency: parent -> [dependents]
    if (!this.fieldDependencies.has(parentField)) {
      this.fieldDependencies.set(parentField, []);
    }
    this.fieldDependencies.get(parentField).push(dependentField);
    
    // Reverse dependency: dependent -> parent
    this.reverseDependencies.set(dependentField, parentField);
    
    console.log(`🔗 FORMSTATE: Dependency ${parentField} -> ${dependentField}`);
  }

  getDependentFields(fieldName) {
    return this.fieldDependencies.get(fieldName) || [];
  }

  getParentField(fieldName) {
    return this.reverseDependencies.get(fieldName);
  }

  triggerDependentFields(parentFieldName) {
    const dependents = this.getDependentFields(parentFieldName);
    if (dependents.length > 0) {
      console.log(`⚡ FORMSTATE: Triggere abhängige Felder von ${parentFieldName}:`, dependents);
      this.emit('dependentFieldsTriggered', { parentField: parentFieldName, dependents });
    }
  }

  // ==================== EVENT SYSTEM ====================
  
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  off(eventType, callback) {
    if (this.listeners.has(eventType)) {
      const callbacks = this.listeners.get(eventType);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(eventType, data) {
    const callbacks = this.listeners.get(eventType) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`❌ FORMSTATE: Event callback error for ${eventType}:`, error);
      }
    });
  }

  // ==================== UTILITIES ====================
  
  isFieldLoading(fieldName) {
    return this.getFieldState(fieldName).loading;
  }

  isFieldLoaded(fieldName) {
    return this.getFieldState(fieldName).loaded;
  }

  hasFieldError(fieldName) {
    return !!this.getFieldState(fieldName).error;
  }

  getAllFormData() {
    // Combine initial data with selected values
    const result = { ...this.formData };
    for (const [fieldName, value] of this.selectedValues) {
      result[fieldName] = value;
    }
    return result;
  }

  getDebugInfo() {
    return {
      entityType: this.entityType,
      entityId: this.entityId,
      isEditMode: this.isEditMode,
      formData: this.getAllFormData(),
      fieldStates: Object.fromEntries(this.fieldStates),
      dependencies: Object.fromEntries(this.fieldDependencies),
      optionCounts: Object.fromEntries(
        Array.from(this.fieldOptions.entries()).map(([key, options]) => [key, options.length])
      )
    };
  }

  // ==================== CLEANUP ====================
  
  destroy() {
    this.listeners.clear();
    this.fieldOptions.clear();
    this.fieldStates.clear();
    this.selectedValues.clear();
    this.fieldDependencies.clear();
    this.reverseDependencies.clear();
    console.log(`🗑️ FORMSTATE: ${this.entityType} State Manager zerstört`);
  }
}



