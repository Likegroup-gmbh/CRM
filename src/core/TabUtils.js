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

/**
 * Einzelnes Secondary-Nav-Item (Detailseiten-Sidebar)
 * @param {Object} config
 * @param {string} config.tab
 * @param {string} config.label
 * @param {boolean} [config.isActive]
 * @param {string} [config.icon]
 * @param {boolean} [config.skipPermissionCheck]
 * @param {boolean} [config.showIcon]
 * @param {string} [config.dataAttr] - data-tab oder data-main-tab
 * @param {string} [config.href]
 * @returns {string} <li> oder leer ohne Berechtigung
 */
export function renderSecondaryNavItem({
  tab,
  label,
  isActive = false,
  icon,
  skipPermissionCheck = false,
  showIcon = true,
  dataAttr = 'data-tab',
  href
}) {
  if (!skipPermissionCheck && !canViewTab(tab)) {
    return '';
  }

  const tabIcon = icon || getTabIcon(tab);
  const current = isActive ? ' aria-current="page"' : '';

  let linkHref = href;
  if (!linkHref) {
    if (typeof window !== 'undefined' && window.location) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      linkHref = `${url.pathname}${url.search}${url.hash}`;
    } else {
      linkHref = `?tab=${encodeURIComponent(tab)}`;
    }
  }

  return `
    <li class="secondary-nav-item">
      <a href="${linkHref}" class="secondary-nav-link${isActive ? ' is-active' : ''}" ${dataAttr}="${tab}"${current}>
        ${showIcon ? `<span class="tab-icon">${tabIcon}</span>` : ''}
        <span class="secondary-nav-label">${label}</span>
      </a>
    </li>
  `;
}

function renderSecondaryNavList(items, dataAttr) {
  const html = (items || []).map((item) => renderSecondaryNavItem({
    ...item,
    dataAttr: item.dataAttr || dataAttr,
    showIcon: item.showIcon !== false
  })).join('');
  return `<ul class="secondary-nav-list">${html}</ul>`;
}

/**
 * Secondary-Navigation als semantische Liste.
 * Optional groups: [{ title, items }] — ohne title nur die Liste.
 *
 * @param {Array<Object>} tabs
 * @param {Object} [options]
 * @param {string} [options.ariaLabel]
 * @param {string} [options.dataAttr]
 * @param {Array<{title?: string, items: Array}>} [options.groups]
 * @returns {string}
 */
export function renderSecondaryNav(tabs = [], { ariaLabel = 'Seitenbereiche', dataAttr = 'data-tab', groups } = {}) {
  if (groups?.length) {
    const sections = groups.map((group) => {
      if (!group.items?.length) return '';
      const list = renderSecondaryNavList(group.items, dataAttr);
      if (!group.title) return list;
      return `<div class="secondary-nav-section"><span class="secondary-nav-section-title">${group.title}</span>${list}</div>`;
    }).join('');
    return `<nav class="secondary-nav" aria-label="${ariaLabel}">${sections}</nav>`;
  }

  return `
    <nav class="secondary-nav" aria-label="${ariaLabel}">
      ${renderSecondaryNavList(tabs, dataAttr)}
    </nav>
  `;
}

/**
 * ?tab= in der URL halten, ohne Navigation auszulösen.
 * @param {string} tab
 */
export function syncTabQueryParam(tab) {
  if (!tab || typeof window === 'undefined' || !window.history?.replaceState) return;
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

/**
 * @returns {string|null}
 */
export function getTabQueryParam() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('tab');
}

/**
 * Liest data-tab / data-main-tab aus einem Secondary-Nav-Klick.
 * @param {Event} e
 * @param {string} [dataAttr]
 * @returns {string|null}
 */
export function getSecondaryNavTabFromEvent(e, dataAttr = 'data-tab') {
  const link = e.target.closest?.(`.secondary-nav [${dataAttr}]`);
  if (!link) return null;
  return dataAttr === 'data-main-tab' ? link.dataset.mainTab : link.dataset.tab;
}

/**
 * Active-State der Secondary-Nav + passendes Pane setzen, URL ?tab= syncen.
 * @param {string} tab
 * @param {Object} [options]
 * @param {string} [options.dataAttr]
 * @returns {HTMLElement|null} das aktivierte Pane
 */
export function activateSecondaryNavTab(tab, { dataAttr = 'data-tab' } = {}) {
  if (!tab) return null;
  const panePrefix = dataAttr === 'data-main-tab' ? 'main' : 'tab';

  document.querySelectorAll(`.secondary-nav [${dataAttr}]`).forEach((link) => {
    const value = dataAttr === 'data-main-tab' ? link.dataset.mainTab : link.dataset.tab;
    const isActive = value === tab;
    link.classList.toggle('is-active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
  const pane = document.getElementById(`${panePrefix}-${tab}`);
  if (pane) pane.classList.add('active');
  syncTabQueryParam(tab);
  return pane;
}
















