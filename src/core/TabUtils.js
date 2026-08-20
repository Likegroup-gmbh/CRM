// TabUtils.js (ES6-Modul)
// Zentrale Tab-Utility mit Icon-Mapping, Permission-Prüfung und Rendering-Funktionen

import { entityIcon } from './icons/entityIcons.js';

/**
 * Tab-Permission-Mapping
 * Mappt Tab-Namen auf Permission-Entities für Berechtigungsprüfung
 * Gleiche Logik wie in NavigationSystem.js
 * 
 * null = immer sichtbar (keine spezifische Berechtigung erforderlich)
 * string = prüfe canViewPage(string) für diese Entity
 */
export const TAB_PERMISSION_MAP = {
  // Tabs die direkt einer Seite entsprechen
  'auftraege': 'auftrag',
  'auftragsdetails': 'auftragsdetails',
  'kampagnen': 'kampagne',
  'briefings': 'briefing',
  'kooperationen': 'kooperation',
  'rechnungen': 'rechnung',
  'strategien': 'strategie',
  'creatorauswahl': 'sourcing',
  'sourcing': 'sourcing',
  'creators': 'creator',
  'creator': 'creator',
  'vertraege': 'vertraege',
  'videos': 'briefing',    // nutzt briefing-Berechtigung (wie Navigation)
  'marken': 'marke',
  // Personas und Produkte gehoeren dem Unternehmen und stehen auch auf dessen
  // Detailseite - die Marke-Berechtigung waere dort der falsche Massstab.
  'personas': 'unternehmen',
  'produkte': 'produkt',
  'ansprechpartner': 'ansprechpartner',
  
  // Tabs die IMMER sichtbar sind (keine spezifische Berechtigung)
  'informationen': null,
  'info': null,
  'overview': null,
  'stammdaten': null,
  'adresse': null,
  'dateien': null,
  'files': null,
  'aktivitaeten': null,
  'activity': null,
  'einstellungen': null,
  'settings': null,
  'rechte': null,
  'tasks': 'tasks',
  'aufgaben': 'tasks'
};

/**
 * Prüft ob ein Tab für den aktuellen Benutzer sichtbar sein soll
 * Nutzt das gleiche Berechtigungssystem wie die Navigation
 * 
 * @param {string} tabName - Der Tab-Name (z.B. 'auftraege', 'kampagnen')
 * @returns {boolean} true wenn der Tab angezeigt werden soll
 */
export function canViewTab(tabName) {
  if (window.isAdmin()) return true;
  
  // Tab-Name normalisieren
  const normalizedTab = tabName?.toLowerCase().replace(/\s+/g, '-');
  
  // Permission-Entity aus dem Mapping holen
  const permissionEntity = TAB_PERMISSION_MAP[normalizedTab];
  
  // Kein Mapping oder explizit null = immer sichtbar (z.B. "Informationen", "Notizen")
  if (permissionEntity === null || permissionEntity === undefined) {
    return true;
  }
  
  // Nutze bestehendes canViewPage aus dem PermissionSystem
  if (window.canViewPage && typeof window.canViewPage === 'function') {
    const allowed = window.canViewPage(permissionEntity);
    // canViewPage gibt true/false/undefined zurück
    // Bei undefined (kein explizites Mapping) erlauben wir den Zugriff
    if (allowed === false) return false;
    if (allowed === true) return true;
  }
  
  // Fallback: Berechtigungen direkt aus window.currentUser.permissions prüfen
  const entityPerms = window.currentUser?.permissions?.[permissionEntity];
  if (entityPerms && entityPerms.can_view === false) {
    return false;
  }
  
  // Default: erlauben wenn keine explizite Einschränkung
  return true;
}

/**
 * Holt das Icon für einen Tab-Namen (über zentrales IconSystem)
 * @param {string} tabName - Der Tab-Name (wird lowercase verglichen)
 * @returns {string} Das SVG-Icon als String
 */
export function getTabIcon(tabName) {
  if (!tabName) return entityIcon('default', { stroke: 1.5 });
  return entityIcon(tabName, { stroke: 1.5 });
}

/**
 * Rendert einen einzelnen Tab-Button mit Icon
 * Prüft automatisch die Berechtigung basierend auf TAB_PERMISSION_MAP
 * 
 * @param {Object} config - Tab-Konfiguration
 * @param {string} config.tab - Tab-ID/Name (für data-tab)
 * @param {string} config.label - Angezeigter Text
 * @param {number|string} [config.count] - Optionaler Count
 * @param {boolean} [config.isActive] - Ob der Tab aktiv ist
 * @param {string} [config.icon] - Optionales eigenes Icon (SVG-String)
 * @param {boolean} [config.skipPermissionCheck=false] - Überspringt die Berechtigungsprüfung wenn true
 * @returns {string} HTML für den Tab-Button oder leerer String wenn keine Berechtigung
 */
export function renderTabButton({ tab, label, count, isActive = false, icon, skipPermissionCheck = false, showIcon = false }) {
  // Berechtigungsprüfung (kann mit skipPermissionCheck umgangen werden)
  if (!skipPermissionCheck && !canViewTab(tab)) {
    return ''; // Tab nicht rendern wenn keine Berechtigung
  }
  
  const tabIcon = icon || getTabIcon(tab);
  return `
    <button class="tab-button ${isActive ? 'active' : ''}" data-tab="${tab}">
      ${showIcon ? `<span class="tab-icon">${tabIcon}</span>` : ''}
      ${label}
    </button>
  `;
}

/**
 * Rendert eine komplette Tab-Navigation
 * @param {Array<Object>} tabs - Array von Tab-Konfigurationen
 * @returns {string} HTML für die Tab-Navigation
 */
export function renderTabNavigation(tabs) {
  return `
    <div class="tab-navigation">
      ${tabs.map(tab => renderTabButton(tab)).join('')}
    </div>
  `;
}
















