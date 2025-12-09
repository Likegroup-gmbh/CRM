// ActionConfig.js (ES6-Modul)
// Deklarative Action-Konfiguration für alle Entity-Types

/**
 * Zentrale Konfiguration aller Actions für verschiedene Entity-Types
 * 
 * Struktur:
 * - actions: Array von Action-Definitionen
 * - kundenActions: Speziell für Kunden-Rolle (optional)
 * 
 * Action-Definitionen:
 * - id: Action-Identifier
 * - icon: Icon-Name aus IconRegistry
 * - label: Anzeige-Text
 * - roles: Array erlaubter Rollen ['all', 'admin', 'mitarbeiter'] (optional)
 * - danger: Boolean, rote Darstellung (optional)
 * - type: 'submenu' für Submenüs (optional)
 * - dynamicOptions: Tabelle für dynamische Submenu-Optionen (optional)
 * - handler: Spezielle Handler-Funktion (optional)
 * - updateFields: Array von Feldern für kombinierte Updates (optional)
 * - entityTypeCheck: Nur für bestimmten Entity-Type (optional)
 */
export const ActionConfigs = {
  // Kampagnen Actions
  kampagne: {
    actions: [
      { 
        id: 'status', 
        type: 'submenu', 
        icon: 'invoice',
        label: 'Status ändern',
        dynamicOptions: 'kampagne_status',
        handler: 'setField',
        updateFields: ['status_id', 'status'],
        roles: ['admin', 'mitarbeiter']
      },
      { id: 'view', icon: 'view', label: 'Details anzeigen', roles: ['all'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'notiz', icon: 'notiz', label: 'Notiz hinzufügen', roles: ['admin', 'mitarbeiter'] },
      { id: 'assign-staff', icon: 'add-ansprechpartner', label: 'Mitarbeiter zuordnen', roles: ['admin'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin'] }
    ],
    kundenActions: ['view'] // Kunden dürfen nur Details ansehen
  },

  // Kooperationen Actions
  kooperation: {
    actions: [
      { 
        id: 'status', 
        type: 'submenu', 
        icon: 'invoice',
        label: 'Status ändern',
        dynamicOptions: 'kampagne_status',
        handler: 'setField',
        updateFields: ['status_id', 'status'],
        roles: ['admin', 'mitarbeiter']
      },
      { id: 'view', icon: 'view', label: 'Details anzeigen', roles: ['all'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { 
        id: 'video-create', 
        icon: 'video', 
        label: 'Video hochladen',
        entityTypeCheck: 'kooperation',
        roles: ['admin', 'mitarbeiter']
      },
      { 
        id: 'task-create', 
        icon: 'tasks', 
        label: 'Aufgabe erstellen',
        entityTypeCheck: 'kooperation',
        roles: ['admin', 'mitarbeiter']
      },
      { id: 'notiz', icon: 'notiz', label: 'Notiz hinzufügen', roles: ['admin', 'mitarbeiter'] },
      { id: 'quickview', icon: 'quickview', label: 'Schnellansicht öffnen', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin'] }
    ],
    kundenActions: ['view']
  },

  // Creator Actions
  creator: {
    actions: [
      { id: 'view', icon: 'view', label: 'Profil ansehen', roles: ['all'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'notiz', icon: 'notiz', label: 'Notiz hinzufügen', roles: ['admin', 'mitarbeiter'] },
      { id: 'rating', icon: 'favorite', label: 'Bewerten', roles: ['admin', 'mitarbeiter'] },
      { id: 'add_to_list', icon: 'add-to-list', label: 'Zur Liste hinzufügen', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin'] }
    ],
    kundenActions: ['view']
  },

  // Unternehmen Actions
  unternehmen: {
    actions: [
      { id: 'view', icon: 'view', label: 'Details anzeigen', roles: ['all'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'add_ansprechpartner_unternehmen', icon: 'add-ansprechpartner', label: 'Ansprechpartner hinzufügen', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin'] }
    ],
    kundenActions: ['view']
  },

  // Marke Actions
  marke: {
    actions: [
      { id: 'view', icon: 'view', label: 'Details anzeigen', roles: ['all'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'add_ansprechpartner', icon: 'add-ansprechpartner', label: 'Ansprechpartner hinzufügen', roles: ['admin', 'mitarbeiter'] },
      { id: 'assign_staff', icon: 'add-ansprechpartner', label: 'Mitarbeiter zuordnen', roles: ['admin'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin'] }
    ],
    kundenActions: ['view']
  },

  // Auftrag Actions
  auftrag: {
    actions: [
      { id: 'view', icon: 'view', label: 'Details anzeigen', roles: ['all'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'notiz', icon: 'notiz', label: 'Notiz hinzufügen', roles: ['admin', 'mitarbeiter'] },
      { id: 'rechnung', icon: 'rechnung-create', label: 'Rechnung anlegen', roles: ['admin', 'mitarbeiter'] },
      { id: 'rechnung_anpassen', icon: 'edit', label: 'Rechnung anpassen', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin'] }
    ],
    kundenActions: ['view', 'rechnung']
  },

  // Ansprechpartner Actions
  ansprechpartner: {
    actions: [
      { id: 'view', icon: 'view', label: 'Details anzeigen', roles: ['all'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'notiz', icon: 'notiz', label: 'Notiz hinzufügen', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin'] }
    ],
    kundenActions: ['view']
  },

  // Ansprechpartner Actions (im Kontext von Unternehmen)
  ansprechpartner_unternehmen: {
    actions: [
      { id: 'view', icon: 'view', label: 'Details anzeigen', roles: ['all'] },
      { id: 'separator' },
      { id: 'remove_ansprechpartner_link', icon: 'delete', label: 'Verknüpfung entfernen', danger: true, roles: ['admin'] }
    ],
    kundenActions: ['view']
  },

  // Creator Adressen Actions
  creator_adresse: {
    actions: [
      { id: 'edit_creator_adresse', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'set_standard_adresse', icon: 'favorite', label: 'Als Standard festlegen', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete_creator_adresse', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin'] }
    ],
    kundenActions: []
  },

  // Creator Hauptadresse Actions (nur bearbeiten, nicht löschen)
  creator_hauptadresse: {
    actions: [
      { id: 'edit_creator', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'set_hauptadresse_standard', icon: 'favorite', label: 'Als Standard festlegen', roles: ['admin', 'mitarbeiter'] }
    ],
    kundenActions: []
  },

  // Briefing Actions
  briefing: {
    actions: [
      { id: 'view', icon: 'view', label: 'Details anzeigen', roles: ['all'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin'] }
    ],
    kundenActions: ['view']
  },

  // Rechnung Actions  
  rechnung: {
    actions: [
      { id: 'view', icon: 'view', label: 'Details anzeigen', roles: ['all'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'download', icon: 'download', label: 'Rechnung herunterladen', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin'] }
    ],
    kundenActions: ['view', 'download']
  },

  // Kunden Actions (Admin-Bereich)
  kunde: {
    actions: [
      { id: 'view', icon: 'view', label: 'Details anzeigen', roles: ['admin'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin'] }
    ]
  },

  // Mitarbeiter Actions (Admin-Bereich)
  mitarbeiter: {
    actions: [
      { id: 'view', icon: 'view', label: 'Details anzeigen', roles: ['admin'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin'] }
    ]
  },

  // Auftragsdetails Actions (Mitarbeiter-only)
  auftragsdetails: {
    actions: [
      { id: 'view', icon: 'view', label: 'Details anzeigen', roles: ['admin', 'mitarbeiter'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin'] }
    ]
  }
};

/**
 * ActionConfig Klasse für das Abrufen und Filtern von Action-Konfigurationen
 */
export class ActionConfig {
  /**
   * Holt die Action-Konfiguration für einen Entity-Type
   * @param {string} entityType - Der Entity-Type (z.B. 'kampagne', 'kooperation')
   * @param {string|null} userRole - Die Benutzer-Rolle (null für kein Filtering)
   * @returns {object|null} Die gefilterte Config oder null
   */
  static get(entityType, userRole = null) {
    const config = ActionConfigs[entityType];
    
    if (!config) {
      console.warn(`ActionConfig: Keine Konfiguration für Entity-Type '${entityType}' gefunden`);
      return null;
    }

    // Kunden-Spezialfall: Nur bestimmte Actions erlaubt
    if (userRole === 'kunde' && config.kundenActions) {
      return {
        ...config,
        actions: config.actions.filter(action => 
          config.kundenActions.includes(action.id) || action.id === 'separator'
        )
      };
    }

    // Role-basiertes Filtering für andere Rollen
    if (userRole && userRole !== 'admin') {
      return {
        ...config,
        actions: config.actions.filter(action => {
          // Separators immer anzeigen
          if (action.id === 'separator') return true;
          
          // Actions ohne Rollen-Einschränkung
          if (!action.roles) return true;
          
          // Actions mit 'all' oder passender Rolle
          return action.roles.includes('all') || action.roles.includes(userRole);
        })
      };
    }

    // Admin oder keine Rolle: Alle Actions
    return config;
  }

  /**
   * Holt alle Actions für einen Entity-Type (ohne Filtering)
   * @param {string} entityType - Der Entity-Type
   * @returns {array} Array von Actions
   */
  static getAllActions(entityType) {
    const config = ActionConfigs[entityType];
    return config ? config.actions : [];
  }

  /**
   * Prüft ob eine Action für einen User erlaubt ist
   * @param {string} entityType - Der Entity-Type
   * @param {string} actionId - Die Action-ID
   * @param {string} userRole - Die Benutzer-Rolle
   * @returns {boolean} True wenn erlaubt
   */
  static isActionAllowed(entityType, actionId, userRole) {
    const config = this.get(entityType, userRole);
    if (!config) return false;

    return config.actions.some(action => action.id === actionId);
  }

  /**
   * Holt eine spezifische Action-Definition
   * @param {string} entityType - Der Entity-Type
   * @param {string} actionId - Die Action-ID
   * @returns {object|null} Die Action-Definition oder null
   */
  static getAction(entityType, actionId) {
    const config = ActionConfigs[entityType];
    if (!config) return null;

    return config.actions.find(action => action.id === actionId) || null;
  }

  /**
   * Gibt alle verfügbaren Entity-Types zurück
   * @returns {string[]} Array mit Entity-Types
   */
  static getAvailableEntityTypes() {
    return Object.keys(ActionConfigs);
  }

  /**
   * Prüft ob ein Entity-Type Submenu-Actions hat
   * @param {string} entityType - Der Entity-Type
   * @returns {boolean} True wenn Submenüs vorhanden
   */
  static hasSubmenuActions(entityType) {
    const config = ActionConfigs[entityType];
    if (!config) return false;

    return config.actions.some(action => action.type === 'submenu');
  }

  /**
   * Holt alle Submenu-Actions für einen Entity-Type
   * @param {string} entityType - Der Entity-Type
   * @returns {array} Array von Submenu-Actions
   */
  static getSubmenuActions(entityType) {
    const config = ActionConfigs[entityType];
    if (!config) return [];

    return config.actions.filter(action => action.type === 'submenu');
  }
}

