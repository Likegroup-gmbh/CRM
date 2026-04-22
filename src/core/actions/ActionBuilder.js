// ActionBuilder.js (ES6-Modul)
// Builder-Pattern für Action-Dropdown HTML-Generierung

import { iconRegistry } from './IconRegistry.js';
import { ActionConfig } from './ActionConfig.js';

/**
 * ActionBuilder - Generiert HTML für Action-Dropdowns basierend auf Konfiguration
 */
export class ActionBuilder {
  constructor() {
    this.iconRegistry = iconRegistry;
  }

  /**
   * Erstellt ein komplettes Action-Dropdown für einen Entity
   * @param {string} entityType - Der Entity-Type (z.B. 'kampagne', 'kooperation')
   * @param {string|number} entityId - Die ID der Entity
   * @param {object} currentUser - Optional: Aktueller User (falls nicht, wird window.currentUser verwendet)
   * @param {object} options - Zusätzliche Optionen
   * @param {object} options.statusOptions - Dynamische Status-Optionen für Submenü
   * @param {object} options.currentStatus - Aktueller Status für Checkmark
   * @returns {string} HTML-String für das Dropdown
   */
  create(entityType, entityId, currentUser = null, options = {}) {
    // Wenn currentUser ein Object mit statusOptions ist, dann wurde es falsch aufgerufen
    if (currentUser && typeof currentUser === 'object' && currentUser.statusOptions) {
      options = currentUser;
      currentUser = null;
    }
    
    const userRole = (currentUser || window.currentUser)?.rolle;
    const config = ActionConfig.get(entityType, userRole);

    if (!config) {
      console.warn(`ActionBuilder: Keine Config für Entity-Type '${entityType}'`);
      return this.createFallbackDropdown(entityId);
    }

    return this.renderDropdown(config, entityId, entityType, options);
  }

  /**
   * Rendert das komplette Dropdown HTML
   * @param {object} config - Die Action-Konfiguration
   * @param {string|number} entityId - Die Entity-ID
   * @param {string} entityType - Der Entity-Type
   * @param {object} options - Zusätzliche Optionen
   * @returns {string} HTML-String
   */
  renderDropdown(config, entityId, entityType, options) {
    const actionsHtml = this.buildActionsHTML(config.actions, entityId, entityType, options);

    return `
      <div class="actions-dropdown-container" data-entity-type="${entityType}">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
            <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
          </svg>
        </button>
        <div class="actions-dropdown">
          ${actionsHtml}
        </div>
      </div>
    `;
  }

  /**
   * Baut das HTML für alle Actions
   * @param {array} actions - Array von Action-Definitionen
   * @param {string|number} entityId - Die Entity-ID
   * @param {string} entityType - Der Entity-Type
   * @param {object} options - Zusätzliche Optionen
   * @returns {string} HTML-String
   */
  buildActionsHTML(actions, entityId, entityType, options) {
    // Spezial-Filter: bei bezahlten Rechnungen für Nicht-Admins nur view + download erlauben
    let filteredActions = actions;
    if (options && options.restrictToPaid) {
      const allowedOnPaid = new Set(['view', 'download']);
      filteredActions = actions.filter(action => {
        if (action.id === 'separator') return false;
        return allowedOnPaid.has(action.id);
      });
    }

    return filteredActions.map(action => {
      if (action.id === 'separator') {
        return this.buildSeparator();
      }
      
      if (action.type === 'submenu') {
        return this.buildSubmenu(action, entityId, entityType, options);
      }
      
      return this.buildActionItem(action, entityId);
    }).join('');
  }

  /**
   * Baut ein einzelnes Action-Item
   * @param {object} action - Die Action-Definition
   * @param {string|number} entityId - Die Entity-ID
   * @returns {string} HTML-String
   */
  buildActionItem(action, entityId) {
    const dangerClass = action.danger ? 'action-danger' : '';
    const icon = this.iconRegistry.get(action.icon);
    
    return `
      <a href="#" class="action-item ${dangerClass}" data-action="${action.id}" data-id="${entityId}">
        ${icon}
        ${action.label}
      </a>
    `;
  }

  /**
   * Baut ein Separator-Element
   * @returns {string} HTML-String
   */
  buildSeparator() {
    return '<div class="action-separator"></div>';
  }

  /**
   * Baut ein Submenu (z.B. für Status-Änderung)
   * @param {object} action - Die Action-Definition
   * @param {string|number} entityId - Die Entity-ID
   * @param {string} entityType - Der Entity-Type
   * @param {object} options - Optionen mit statusOptions und currentStatus
   * @returns {string} HTML-String
   */
  buildSubmenu(action, entityId, entityType, options) {
    const icon = this.iconRegistry.get(action.icon);
    
    // Submenu-Items generieren
    let submenuItems = '';
    
    // Debug-Logging
    console.log('🔍 buildSubmenu:', {
      action: action.id,
      entityId,
      entityType,
      hasOptions: !!options,
      hasStatusOptions: !!(options && options.statusOptions),
      statusOptionsLength: options?.statusOptions?.length || 0,
      statusOptions: options?.statusOptions
    });
    
    if ((action.dynamicOptions || action.staticOptions) && options && options.statusOptions && options.statusOptions.length > 0) {
      submenuItems = this.buildSubmenuItems(
        options.statusOptions,
        entityId,
        action,
        options.currentStatus
      );
    } else if (action.dynamicOptions || action.staticOptions) {
      console.warn('⚠️ Status-Submenü hat keine Options:', {
        entityType,
        entityId,
        options
      });
      submenuItems = '<div style="padding: 8px 12px; color: #999;">Keine Status-Optionen verfügbar</div>';
    }

    return `
      <div class="action-submenu">
        <a href="#" class="action-item has-submenu" data-submenu="${action.id}">
          ${icon}
          <span>${action.label}</span>
        </a>
        <div class="submenu" data-submenu="${action.id}" data-entity-id="${entityId}" data-entity-type="${entityType}">
          ${submenuItems}
        </div>
      </div>
    `;
  }

  /**
   * Baut die Items für ein Submenu
   * @param {array} items - Array von Optionen (z.B. Status)
   * @param {string|number} entityId - Die Entity-ID
   * @param {object} action - Die Action-Definition
   * @param {object} currentStatus - Aktueller Status für Checkmark
   * @returns {string} HTML-String
   */
  buildSubmenuItems(items, entityId, action, currentStatus) {
    return items.map(item => {
      const icon = this.iconRegistry.getStatusIcon(item.name);
      const isActive = currentStatus && (
        currentStatus.id === item.id || 
        currentStatus.name === item.name
      );
      const checkIcon = isActive ? this.iconRegistry.get('check') : '';

      return `
        <a href="#" class="submenu-item" 
           data-action="set-field" 
           data-field="${action.updateFields ? action.updateFields[0] : 'status_id'}" 
           data-value="${item.id}" 
           data-status-name="${this.escapeHtml(item.name)}" 
           data-id="${entityId}">
          ${icon}
          <span>${this.escapeHtml(item.name)}</span>
          ${isActive ? `<span class="submenu-check">${checkIcon}</span>` : ''}
        </a>
      `;
    }).join('');
  }

  /**
   * Erstellt ein Fallback-Dropdown wenn keine Config vorhanden
   * @param {string|number} entityId - Die Entity-ID
   * @returns {string} HTML-String
   */
  createFallbackDropdown(entityId) {
    const viewIcon = this.iconRegistry.get('view');
    
    return `
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
            <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${entityId}">
            ${viewIcon}
            Details anzeigen
          </a>
        </div>
      </div>
    `;
  }

  /**
   * Escaped HTML-String für sichere Ausgabe
   * @param {string} str - Der zu escapende String
   * @returns {string} Escapeter String
   */
  escapeHtml(str) {
    if (!str) return '';
    
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Hilfsfunktion: Erstellt nur die Actions (ohne Container)
   * Nützlich wenn das Container-HTML bereits existiert
   * @param {string} entityType - Der Entity-Type
   * @param {string|number} entityId - Die Entity-ID
   * @param {object} options - Zusätzliche Optionen
   * @returns {string} HTML-String nur für Actions
   */
  createActionsOnly(entityType, entityId, options = {}) {
    const userRole = window.currentUser?.rolle;
    const config = ActionConfig.get(entityType, userRole);

    if (!config) {
      return '';
    }

    return this.buildActionsHTML(config.actions, entityId, entityType, options);
  }

  /**
   * Erstellt ein vereinfachtes Dropdown nur mit View-Action
   * (für Kunden-Fallback)
   * @param {string|number} entityId - Die Entity-ID
   * @returns {string} HTML-String
   */
  createReadOnlyDropdown(entityId) {
    const viewIcon = this.iconRegistry.get('view');

    return `
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
            <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${entityId}">
            ${viewIcon}
            Details anzeigen
          </a>
        </div>
      </div>
    `;
  }

  /**
   * Prüft ob der User berechtigt ist, Actions zu sehen
   * @param {string} entityType - Der Entity-Type
   * @returns {boolean} True wenn berechtigt
   */
  canUserSeeActions(entityType) {
    const userRole = window.currentUser?.rolle;
    const config = ActionConfig.get(entityType, userRole);
    
    return config && config.actions && config.actions.length > 0;
  }

  /**
   * Debug-Funktion: Gibt Info über generiertes Dropdown
   * @param {string} entityType - Der Entity-Type
   * @param {string|number} entityId - Die Entity-ID
   */
  debugDropdown(entityType, entityId) {
    const userRole = window.currentUser?.rolle;
    const config = ActionConfig.get(entityType, userRole);
    
    console.group(`ActionBuilder Debug: ${entityType}#${entityId}`);
    console.log('User Role:', userRole);
    console.log('Config:', config);
    console.log('Actions Count:', config?.actions?.length || 0);
    if (config) {
      config.actions.forEach((action, index) => {
        console.log(`  ${index + 1}. ${action.id} (${action.label})`);
      });
    }
    console.groupEnd();
  }
}

// Singleton-Instanz erstellen und exportieren
export const actionBuilder = new ActionBuilder();

