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

    // Liste aller Actions, die ans Legacy-System delegiert werden sollen
    const legacyActions = [
      'edit', 'delete', 'notiz', 
      'add_ansprechpartner_unternehmen', 'remove_ansprechpartner_unternehmen',
      'add_ansprechpartner_kampagne', 'remove_ansprechpartner_kampagne',
      'add_ansprechpartner',
      'marken', 'auftraege', 'kampagnen',
      'assign_staff', 'assign-staff',
      'add_to_list', 'add_to_campaign',
      'video-create', 'bewerten', 'rechnung', 'rechnung_anpassen',
      'invite', 'freischalten',
      'set-role', 'set-field',
      'assign-unternehmen', 'remove-unternehmen',
      'assign-marke', 'remove-marke',
      'unassign-kampagne',  // Mitarbeiter-Detail: Kampagnen-Zuweisung entfernen
      'rating', 'favorite',
      // Creator-Adressen Actions
      'edit_creator_adresse', 'delete_creator_adresse',
      'set_standard_adresse', 'set_hauptadresse_standard'
    ];

    if (legacyActions.includes(action)) {
      throw new Error(`${action}: Use legacy handler`);
    }

    // Standard-Actions
    switch (action) {
      case 'view':
        if (!this.moduleRegistry) {
          throw new Error('view: ModuleRegistry not set, use legacy handler');
        }
        return this.handleView(entityType, entityId);
      
      case 'details':
      case 'auftrag-details':
        return this.handleDetails(entityType, entityId);

      case 'quickview':
        // Diese Action wird vom ActionsDropdown Legacy-Handler behandelt
        throw new Error('quickview: Use legacy handler');

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





