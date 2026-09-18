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
      { id: 'view', icon: 'view', label: 'Details anzeigen', roles: ['all'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin', 'mitarbeiter'] }
    ],
    kundenActions: ['view']
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
        id: 'task-create', 
        icon: 'tasks', 
        label: 'Aufgabe erstellen',
        entityTypeCheck: 'kooperation',
        roles: ['admin', 'mitarbeiter']
      },
      { id: 'quickview', icon: 'quickview', label: 'Schnellansicht öffnen', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin', 'mitarbeiter'] }
    ],
    kundenActions: ['view']
  },

  // Creator Actions
  creator: {
    actions: [
      { id: 'view', icon: 'view', label: 'Profil ansehen', roles: ['all'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'add_to_list', icon: 'add-to-list', label: 'Zur Liste hinzufügen', roles: ['admin', 'mitarbeiter'] },
      { id: 'add_to_casting', icon: 'add-to-casting', label: 'Zu Casting hinzufügen', roles: ['admin', 'mitarbeiter'] },
      { id: 'connect', icon: 'connect', label: 'Connect', roles: ['admin'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin', 'mitarbeiter'] }
    ],
    kundenActions: ['view']
  },

  // Unternehmen Actions
  unternehmen: {
    actions: [
      { id: 'view', icon: 'view', label: 'Details anzeigen', roles: ['all'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'add_ansprechpartner_unternehmen', icon: 'add-ansprechpartner', label: 'Ansprechpartner hinzufügen', roles: ['admin', 'mitarbeiter'] },
      { id: 'add_produkt', icon: 'add-produkt', label: 'Produkt anlegen', roles: ['admin', 'mitarbeiter'] },
      { id: 'add_persona', icon: 'add-persona', label: 'Persona anlegen', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin', 'mitarbeiter'] }
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
      { id: 'add_produkt', icon: 'add-produkt', label: 'Produkt anlegen', roles: ['admin', 'mitarbeiter'] },
      { id: 'add_persona', icon: 'add-persona', label: 'Persona anlegen', roles: ['admin', 'mitarbeiter'] },
      { id: 'assign_staff', icon: 'add-ansprechpartner', label: 'Mitarbeiter zuordnen', roles: ['admin'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin', 'mitarbeiter'] }
    ],
    kundenActions: ['view']
  },

  produkt: {
    actions: [
      { id: 'view', icon: 'view', label: 'Öffnen', roles: ['all'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin', 'mitarbeiter'] }
    ],
    kundenActions: ['view']
  },

  persona: {
    actions: [
      { id: 'view', icon: 'view', label: 'Öffnen', roles: ['all'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin', 'mitarbeiter'] }
    ],
    kundenActions: ['view']
  },

  strategie: {
    actions: [
      { id: 'view', icon: 'view', label: 'Details anzeigen', roles: ['all'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin', 'mitarbeiter'] }
    ],
    kundenActions: ['view']
  },

  creator_auswahl: {
    actions: [
      { id: 'view', icon: 'view', label: 'Details anzeigen', roles: ['all'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin', 'mitarbeiter'] }
    ],
    kundenActions: ['view']
  },

  // Casting-Listen auf der Folder-Seite /castings (eigene Action-IDs, die
  // Handler leben in CreatorAuswahlList bzw. ActionsDropdownHandlers).
  // entity: Capability-Lookup laeuft auf 'sourcing' (Matrix-Key).
  creator_auswahl_liste: {
    entity: 'sourcing',
    actions: [
      { id: 'view-liste', icon: 'view', label: 'Details anzeigen', roles: ['all'] },
      { id: 'rename-liste', icon: 'edit', label: 'Name bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'edit-liste', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete-liste', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin', 'mitarbeiter'] }
    ],
    kundenActions: ['view-liste']
  },

  // Konzepte auf der Folder-Seite /konzepte (Handler in StrategieListEvents
  // bzw. ActionsDropdownHandlers).
  strategie_liste: {
    entity: 'strategie',
    actions: [
      { id: 'view-strategie', icon: 'view', label: 'Details anzeigen', roles: ['all'] },
      { id: 'edit-strategie', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete-strategie', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin', 'mitarbeiter'] }
    ],
    kundenActions: ['view-strategie']
  },

  // Contract Actions (Contracting-Auftraege)
  contract: {
    actions: [
      { id: 'view', icon: 'view', label: 'Details anzeigen', roles: ['all'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin'] }
    ],
    kundenActions: ['view']
  },

  // Auftrag Actions
  auftrag: {
    actions: [
      {
        id: 'status',
        type: 'submenu',
        icon: 'invoice',
        label: 'Status ändern',
        staticOptions: true,
        handler: 'setField',
        updateFields: ['status'],
        roles: ['admin', 'mitarbeiter']
      },
      { id: 'view', icon: 'view', label: 'Details anzeigen', roles: ['all'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'rechnung', icon: 'rechnung-create', label: 'Rechnung anlegen', roles: ['admin', 'mitarbeiter'] },
      { id: 'rechnung_anpassen', icon: 'edit', label: 'Rechnung anpassen', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin', 'mitarbeiter'] }
    ],
    kundenActions: []
  },

  // Ansprechpartner Actions
  ansprechpartner: {
    actions: [
      { id: 'view', icon: 'view', label: 'Details anzeigen', roles: ['all'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin', 'mitarbeiter'] }
    ],
    kundenActions: ['view']
  },

  // Ansprechpartner Actions (im Kontext von Unternehmen)
  ansprechpartner_unternehmen: {
    actions: [
      { id: 'view', icon: 'view', label: 'Details anzeigen', roles: ['all'] },
      { id: 'separator' },
      { id: 'remove_ansprechpartner_link', icon: 'delete', label: 'Verknüpfung entfernen', danger: true, roles: ['admin', 'mitarbeiter'] }
    ],
    kundenActions: ['view']
  },

  // Creator Adressen Actions
  creator_adresse: {
    actions: [
      { id: 'edit_creator_adresse', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'set_standard_adresse', icon: 'favorite', label: 'Als Standard festlegen', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete_creator_adresse', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin', 'mitarbeiter'] }
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
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin', 'mitarbeiter'] }
    ],
    kundenActions: ['view']
  },

  // Rechnung Actions  
  rechnung: {
    actions: [
      { 
        id: 'status', 
        type: 'submenu', 
        icon: 'invoice',
        label: 'Status ändern',
        staticOptions: true,
        handler: 'setField',
        updateFields: ['status'],
        roles: ['admin']
      },
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
      { 
        id: 'rolle', 
        type: 'submenu', 
        icon: 'edit',
        label: 'Rolle ändern',
        dynamicOptions: 'mitarbeiter_klasse',
        handler: 'setField',
        updateFields: ['mitarbeiter_klasse_id'],
        roles: ['admin']
      },
      { id: 'freischalten', icon: 'check', label: 'Freischalten / Sperren', roles: ['admin'] },
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
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin', 'mitarbeiter'] }
    ]
  },

  // Verträge Actions
  vertraege: {
    actions: [
      { id: 'view', icon: 'view', label: 'Details anzeigen', roles: ['admin', 'mitarbeiter'] },
      { id: 'edit', icon: 'edit', label: 'Bearbeiten', roles: ['admin', 'mitarbeiter'] },
      { id: 'download', icon: 'download', label: 'PDF herunterladen', roles: ['admin', 'mitarbeiter'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin', 'mitarbeiter'] }
    ],
    kundenActions: ['view', 'download']
  },

  skripte: {
    actions: [
      { id: 'view', icon: 'view', label: 'Öffnen', roles: ['all'] },
      { id: 'separator' },
      { id: 'delete', icon: 'delete', label: 'Löschen', danger: true, roles: ['admin', 'mitarbeiter'] }
    ],
    kundenActions: ['view']
  }
};

const VIEW_ACTION_IDS = new Set(['view', 'download', 'quickview', 'view-liste', 'view-strategie']);

// Welches Verb eine Action braucht. Default: Write-Actions brauchen can_edit,
// Löschen braucht can_delete, Create-Subactions (add_*) brauchen can_create.
// 'view'-Artige brauchen nichts (sie sind eh nur sichtbar, wenn die Seite sichtbar ist).
const ACTION_VERB = {
  delete: 'delete',
  remove_ansprechpartner_link: 'delete',
  delete_creator_adresse: 'delete',
  'delete-liste': 'delete',
  'delete-strategie': 'delete',
  'rename-liste': 'edit',
  'edit-liste': 'edit',
  'edit-strategie': 'edit',
  add_to_list: 'create',
  add_to_casting: 'create',
  add_ansprechpartner: 'create',
  add_ansprechpartner_unternehmen: 'create',
  add_produkt: 'create',
  add_persona: 'create',
  rechnung: 'create',        // Rechnung anlegen aus Auftrag
  'task-create': 'create',
};

function verbFor(action) {
  if (VIEW_ACTION_IDS.has(action.id)) return null;
  if (ACTION_VERB[action.id]) return ACTION_VERB[action.id];
  // setField-Submenüs (Status ändern), edit_*, set_* und der Rest sind Edits.
  return 'edit';
}

function collapseSeparators(actions) {
  const result = [];
  for (const action of actions) {
    if (action.id === 'separator') {
      if (result.length === 0 || result[result.length - 1].id === 'separator') continue;
      result.push(action);
      continue;
    }
    result.push(action);
  }
  if (result[result.length - 1]?.id === 'separator') result.pop();
  return result;
}

// Capability-Filter: fragt das Berechtigung-Modul, nicht Rollen.
// Admin bekommt alles; für alle anderen entscheidet can(entity, verb).
// Sonderfall admin-only (z.B. rechnung.status, mitarbeiter.*) bleibt ueber roles geregelt.
// capEntity: Matrix-Key fuer den Lookup — Configs mit eigenem entity-Feld
// (z.B. creator_auswahl_liste → sourcing) fragen dessen Zeile ab.
function filterByCapability(entityType, userRole, actions, capEntity = entityType) {
  if (!userRole || userRole === 'admin') return actions;
  const ps = window.permissionSystem;
  if (!ps) return actions;

  return collapseSeparators(actions.filter(action => {
    if (action.id === 'separator') return true;

    // Harte admin-only-Schranken bleiben Rollen-Sache (RLS laesst sie ohnehin nur admin).
    if (Array.isArray(action.roles) && action.roles.length && !action.roles.includes('all')
        && !action.roles.includes(userRole) && action.roles.every(r => r === 'admin')) {
      return false;
    }

    const verb = verbFor(action);
    if (verb === null) return true;
    return ps.can(capEntity, verb);
  }));
}

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
        actions: filterByCapability(entityType, userRole, config.actions.filter(action =>
          config.kundenActions.includes(action.id) || action.id === 'separator'
        ), config.entity)
      };
    }

    // Alle anderen Rollen: Capability-Filter entscheidet, nicht die roles-Liste.
    if (userRole && userRole !== 'admin') {
      return { ...config, actions: filterByCapability(entityType, userRole, config.actions, config.entity) };
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

