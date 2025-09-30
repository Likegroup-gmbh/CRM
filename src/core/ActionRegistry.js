// ActionRegistry.js - Event-basiertes Action System ohne window-Abhängigkeiten

export class ActionRegistry {
  constructor() {
    this.actionHandlers = new Map();
    this.moduleRegistry = null; // Wird per DI gesetzt
  }

  // Dependency Injection für ModuleRegistry
  setModuleRegistry(moduleRegistry) {
    this.moduleRegistry = moduleRegistry;
  }

  // Action Handler registrieren
  registerHandler(action, handler) {
    this.actionHandlers.set(action, handler);
  }

  // Action ausführen
  async executeAction(action, entityId, entityType, actionItem) {
    console.log(`🎯 ACTIONREGISTRY: Action ${action} für ${entityType} ${entityId}`);

    // Standard-Actions
    switch (action) {
      case 'view':
        return this.handleView(entityType, entityId);
      
      case 'edit':
        return this.handleEdit(entityType, entityId);
      
      case 'delete':
        return this.handleDelete(entityType, entityId);

      case 'details':
      case 'auftrag-details':
        return this.handleDetails(entityType, entityId);

      default:
        // Custom Handler suchen
        const handler = this.actionHandlers.get(action);
        if (handler) {
          return await handler(entityId, entityType, actionItem);
        }
        
        // Event-basierter Fallback
        return this.dispatchActionEvent(action, entityId, entityType);
    }
  }

  // Standard View Action
  handleView(entityType, entityId) {
    if (this.moduleRegistry) {
      this.moduleRegistry.navigateTo(`/${entityType}/${entityId}`);
    } else {
      console.warn('ModuleRegistry nicht verfügbar');
    }
  }

  // Standard Edit Action
  handleEdit(entityType, entityId) {
    if (this.moduleRegistry) {
      this.moduleRegistry.navigateTo(`/${entityType}/${entityId}/edit`);
    } else {
      console.warn('ModuleRegistry nicht verfügbar');
    }
  }

  // Standard Delete Action
  async handleDelete(entityType, entityId) {
    // Event dispatchen - andere Module können darauf reagieren
    const event = new CustomEvent('actionRequested', {
      detail: {
        action: 'delete',
        entityType,
        entityId
      }
    });
    document.dispatchEvent(event);
  }

  // Details Action für Aufträge
  async handleDetails(entityType, entityId) {
    if (entityType === 'auftrag') {
      // Event für Auftragsdetails dispatchen
      const event = new CustomEvent('actionRequested', {
        detail: {
          action: 'showDetails',
          entityType: 'auftrag',
          entityId
        }
      });
      document.dispatchEvent(event);
    }
  }

  // Event-basierter Fallback für unbekannte Actions
  dispatchActionEvent(action, entityId, entityType) {
    const event = new CustomEvent('actionRequested', {
      detail: {
        action,
        entityType,
        entityId
      }
    });
    document.dispatchEvent(event);
  }
}

// Singleton erstellen
export const actionRegistry = new ActionRegistry();


