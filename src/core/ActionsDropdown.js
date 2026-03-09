// ActionsDropdown.js (ES6-Modul)
// Modulare Dropdown-Komponente für Listen-Aktionen

import { actionRegistry } from './ActionRegistry.js';
import { iconRegistry } from './actions/IconRegistry.js';
import { actionBuilder } from './actions/ActionBuilder.js';
import { KampagneUtils } from '../modules/kampagne/KampagneUtils.js';

export class ActionsDropdown {
  constructor() {
    this.dropdowns = new Map();
    this.boundEventListeners = new Set();
    this._iconObserver = null;
    this._normalizingIcons = false;
    this.actionRegistry = actionRegistry;
    this.iconRegistry = iconRegistry;
    this.actionBuilder = actionBuilder;
  }

  // Initialisiere die Komponente
  init() {
    console.log('🎯 ACTIONSDROPDOWN: Initialisiere ActionsDropdown');
    this.bindGlobalEvents();
    this.normalizeIcons(document);
    this.observeTableMutations();
    
    // Debug: Überprüfe ob die Komponente korrekt geladen ist
    setTimeout(() => {
      console.log('🔍 ACTIONSDROPDOWN: Debug - Überprüfe Initialisierung');
      console.log('🔍 ACTIONSDROPDOWN: window.ActionsDropdown verfügbar:', !!window.ActionsDropdown);
      console.log('🔍 ACTIONSDROPDOWN: createAuftragActions verfügbar:', !!window.ActionsDropdown?.createAuftragActions);
    }, 1000);
  }

  // Einheitliche Heroicons bereitstellen
  // REFACTORED: Nutzt jetzt IconRegistry (Backward Compatible)
  getHeroIcon(name) {
    return this.iconRegistry.get(name);
  }

  // Status-Icon je nach Statusnamen (zentral für alle Menüs)
  // REFACTORED: Nutzt jetzt IconRegistry (Backward Compatible)
  getStatusIcon(statusName) {
    return this.iconRegistry.getStatusIcon(statusName);
  }

  async setField(entityType, entityId, fieldName, fieldValue) {
    try {
      console.log('⬆️ setField starte Update', { entityType, entityId, fieldName, fieldValue });
      if (window.supabase) {
        const table = window.dataService?.entities?.[entityType]?.table || entityType;
        const payload = { [fieldName]: fieldValue };
        if (window.dataService?.entities?.[entityType]?.fields?.updated_at) {
          payload.updated_at = new Date().toISOString();
        }
        const { error } = await window.supabase.from(table).update(payload).eq('id', entityId);
        if (error) throw error;
      } else if (window.dataService?.updateEntity) {
        const res = await window.dataService.updateEntity(entityType, entityId, { [fieldName]: fieldValue });
        if (!res?.success) throw new Error(res?.error || 'Update fehlgeschlagen');
      } else {
        throw new Error('Kein Update-Mechanismus verfügbar');
      }
      console.log('✅ setField DB-Update erfolgreich');
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: entityType, action: 'updated', id: entityId, field: fieldName, value: fieldValue } }));
    } catch (err) {
      console.error('❌ setField fehlgeschlagen', err);
      alert('Aktualisierung fehlgeschlagen.');
    }
  }

  // Ersetze Icons in bereits gerenderten Dropdowns (einheitlicher Look)
  normalizeIcons(root) {
    try {
      if (this._normalizingIcons) return; // Guard gegen Re-Entrancy
      this._normalizingIcons = true;

      const container = root || document;

      // Jede Dropdown-Box nur einmal normalisieren
      const dropdowns = container.querySelectorAll('.actions-dropdown:not([data-icons-normalized="1"])');
      dropdowns.forEach((dd) => {
        const replaceIn = (selector, iconName) => {
          dd.querySelectorAll(selector).forEach((link) => {
            const existingSvg = link.querySelector('svg');
            if (existingSvg) existingSvg.remove();
            link.insertAdjacentHTML('afterbegin', this.getHeroIcon(iconName));
          });
        };

        replaceIn('.action-item[data-action="view"]', 'view');
        replaceIn('.action-item[data-action="edit"]', 'edit');
        replaceIn('.action-item[data-action="notiz"]', 'notiz');
        replaceIn('.action-item[data-action="favorite"]', 'favorite');
        replaceIn('.action-item.action-danger[data-action="delete"]', 'delete');
        replaceIn('.action-item[data-action="rechnungen"]', 'rechnungen');
        replaceIn('.action-item[data-action="auftrag-details"]', 'details');

        dd.setAttribute('data-icons-normalized', '1');
      });
    } catch (err) {
      console.warn('⚠️ ACTIONSDROPDOWN: normalizeIcons Fehler', err);
    } finally {
      this._normalizingIcons = false;
    }
  }

  // Beobachte DOM-Änderungen (z. B. beim Tabellen-Update) und normalisiere Icons erneut
  // OPTIMIERT: Nur auf .data-table-container lauschen statt auf ganzes document
  observeTableMutations() {
    if (this._iconObserver) return;
    
    // Warte kurz bis DOM vollständig geladen ist
    setTimeout(() => {
      // Nur auf Tabellen-Container lauschen (Performance-Optimierung)
      const targets = document.querySelectorAll('.data-table-container, #dashboard-content');
      
      if (targets.length === 0) {
        // Fallback: Ganzes Dashboard wenn keine Container gefunden
        const fallbackTarget = document.getElementById('dashboard-content') || document.body;
        this.observeSingleTarget(fallbackTarget);
        return;
      }
      
      // Observer für jeden Container erstellen
      targets.forEach(target => {
        this.observeSingleTarget(target);
      });
    }, 100);
  }
  
  // Helper: Observer für einzelnes Target
  observeSingleTarget(target) {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length > 0) {
          // Normalisiere nur im Kontext der hinzugefügten Nodes
          m.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              this.normalizeIcons(node);
            }
          });
        }
      }
    });
    observer.observe(target, { childList: true, subtree: true });
    
    // Speichere Observer (kann mehrere sein)
    if (!this._iconObserver) {
      this._iconObserver = [observer];
    } else {
      this._iconObserver.push(observer);
    }
  }

  // Globale Event-Listener binden
  bindGlobalEvents() {
    // Event-Delegation für Dropdown-Toggles
    document.addEventListener('click', (e) => {
      // Prüfe ob der Klick auf einen actions-toggle Button oder dessen Inhalt war
      const toggleButton = e.target.closest('.actions-toggle');
      if (toggleButton) {
        e.preventDefault();
        // Wichtig: Verhindere, dass andere Click-Listener auf document (z. B. Outside-Handler)
        // im selben Bubbling-Durchlauf ausgeführt werden.
        if (typeof e.stopImmediatePropagation === 'function') {
          e.stopImmediatePropagation();
        } else {
          e.stopPropagation();
        }
        this.toggleDropdown(toggleButton);
      }
    });

    // Event-Delegation für Submenu-Items (z. B. Status ändern)
    document.addEventListener('click', async (e) => {
      const submenuItem = e.target.closest('.submenu-item');
      if (!submenuItem) return;
      e.preventDefault();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

      const entityId = submenuItem.dataset.id;
      const fieldName = submenuItem.dataset.field;
      const fieldValue = submenuItem.dataset.value;
      const entityType = submenuItem.closest('.actions-dropdown-container')?.dataset?.entityType || 'auftrag';

      console.log('▶️ Submenu-Click erkannt', { entityType, entityId, fieldName, fieldValue });

      if (submenuItem.dataset.action === 'set-field') {
        try {
          if (entityType === 'kampagne' && fieldName === 'status_id') {
            const statusName = submenuItem.dataset.statusName || '';
            // Kombiniertes Update: status_id + status setzen, damit Trigger sicher feuert
            const { error } = await window.supabase
              .from('kampagne')
              .update({ status_id: fieldValue, status: statusName, updated_at: new Date().toISOString() })
              .eq('id', entityId);
            if (error) throw error;
            // Optional: Event für UI-Refresh
            window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kampagne', action: 'updated', id: entityId, field: 'status_id', value: fieldValue } }));
            console.log('✅ Status (id+name) aktualisiert');
          } else if (entityType === 'kooperation' && fieldName === 'status_id') {
            const statusName = submenuItem.dataset.statusName || '';
            const { error } = await window.supabase
              .from('kooperationen')
              .update({ status_id: fieldValue, status: statusName, updated_at: new Date().toISOString() })
              .eq('id', entityId);
            if (error) throw error;
            window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kooperation', action: 'updated', id: entityId, field: 'status_id', value: fieldValue } }));
            console.log('✅ Kooperation-Status (id+name) aktualisiert');
          } else {
            await this.setField(entityType, entityId, fieldName, fieldValue);
            console.log('✅ setField abgeschlossen');
          }
        } catch (err) {
          console.error('❌ setField Fehler aus Submenu', err);
          alert('Aktualisierung fehlgeschlagen.');
        }
        this.closeAllDropdowns();
      }
    });
    // Event-Delegation für Action-Items
    document.addEventListener('click', (e) => {
      const actionItem = e.target.closest('.action-item');
      if (!actionItem) return;

      const action = actionItem.dataset?.action;
      // Wenn keine data-action gesetzt ist (custom Actions wie Favoriten-Menü),
      // NICHT abfangen – lasse andere Listener (z. B. KampagneDetail) den Klick verarbeiten
      if (!action) return;

      // Custom Actions die nicht vom ActionsDropdown gehandhabt werden
      // (z.B. comment-delete, remove-zuordnung) sollen durch Event-Delegation behandelt werden
      const customActions = ['comment-delete', 'video-view', 'video-edit', 'video-delete', 'remove-zuordnung', 'continue'];
      if (customActions.includes(action)) {
        // Lasse Event weiterlaufen für custom Handler
        return;
      }

      e.preventDefault();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      } else {
        e.stopPropagation();
      }

      const entityId = actionItem.dataset.id;
      // Entity-Type aus data-attribute ermitteln
      const container = actionItem.closest('.actions-dropdown-container');
      let entityType = container?.dataset?.entityType || 'auftrag';

      console.log(`🎯 ACTIONSDROPDOWN: Entity-Type aus data-attribute: ${entityType}`);
      // Sonderfall: Favoriten im Sourcing-Tab – IDs direkt aus dem Link nehmen
      if (action === 'favorite') {
        const creatorId = actionItem.dataset.creatorId || entityId;
        let kampagneId = actionItem.dataset.kampagneId || null;
        this.addToFavorites(creatorId, kampagneId);
        this.closeAllDropdowns();
        return;
      }

      this.handleAction(action, entityId, entityType, actionItem);
      this.closeAllDropdowns();
    });

    // Schließe Dropdowns beim Klick außerhalb
    document.addEventListener('click', (e) => {
      // Klicke innerhalb des gesamten Containers NICHT schließen
      if (!e.target.closest('.actions-dropdown-container')) {
        this.closeAllDropdowns();
      }
    });

    // ESC-Taste schließt alle Dropdowns
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllDropdowns();
      }
    });
  }

  // Entity-Type aus dem Kontext ermitteln
  getEntityTypeFromContext(actionItem) {
    // Versuche aus der aktuellen URL zu ermitteln
    const currentPath = window.location.pathname;
    const pathSegments = currentPath.split('/').filter(segment => segment);
    
    if (pathSegments.length > 0) {
      const firstSegment = pathSegments[0];
      const entityTypes = ['creator', 'unternehmen', 'marke', 'auftrag'];
      
      if (entityTypes.includes(firstSegment)) {
        return firstSegment;
      }
    }
    
    // Fallback: Versuche aus der Tabelle zu ermitteln
    const tableRow = actionItem.closest('tr');
    if (tableRow) {
      const table = tableRow.closest('table');
      if (table) {
        const tableId = table.id;
        if (tableId.includes('creator')) return 'creator';
        if (tableId.includes('unternehmen')) return 'unternehmen';
        if (tableId.includes('marke')) return 'marke';
        if (tableId.includes('auftrag')) return 'auftrag';
      }
    }
    
    // Fallback: Versuche aus dem Action-Item selbst zu ermitteln
    const actionItemText = actionItem.textContent.toLowerCase();
    if (actionItemText.includes('creator') || actionItemText.includes('creator')) return 'creator';
    if (actionItemText.includes('unternehmen') || actionItemText.includes('firmenname')) return 'unternehmen';
    if (actionItemText.includes('marke') || actionItemText.includes('markenname')) return 'marke';
    if (actionItemText.includes('auftrag') || actionItemText.includes('auftragsname')) return 'auftrag';
    
    // Versuche aus der umgebenden Tabelle zu ermitteln
    const tableBody = actionItem.closest('tbody');
    if (tableBody) {
      const table = tableBody.closest('table');
      if (table) {
        const tableHeaders = table.querySelectorAll('th');
        for (let header of tableHeaders) {
          const headerText = header.textContent.toLowerCase();
          if (headerText.includes('creator') || headerText.includes('influencer')) return 'creator';
          if (headerText.includes('unternehmen') || headerText.includes('firmenname')) return 'unternehmen';
          if (headerText.includes('marke') || headerText.includes('markenname')) return 'marke';
          if (headerText.includes('auftrag') || headerText.includes('auftragsname')) return 'auftrag';
        }
      }
    }
    
    // Letzter Fallback: Versuche aus der URL zu ermitteln
    const urlPath = window.location.pathname;
    if (urlPath.includes('/creator')) return 'creator';
    if (urlPath.includes('/unternehmen')) return 'unternehmen';
    if (urlPath.includes('/marke')) return 'marke';
    if (urlPath.includes('/auftrag')) return 'auftrag';
    
    console.warn('⚠️ Konnte Entity-Type nicht ermitteln, verwende "auftrag" als Fallback');
    return 'auftrag'; // Fallback zu auftrag
  }

  // Dropdown umschalten
  toggleDropdown(toggleButton) {
    const dropdown = toggleButton.nextElementSibling;
    const isOpen = dropdown.classList.contains('show');

    // Alle anderen Dropdowns schließen
    this.closeAllDropdowns();

    if (!isOpen) {
      dropdown.classList.remove('dropdown-flip-up');
      dropdown.style.position = '';
      dropdown.style.top = '';
      dropdown.style.bottom = '';
      dropdown.style.right = '';

      const buttonRect = toggleButton.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - buttonRect.bottom;

      // Dropdown kurz unsichtbar einblenden um die echte Höhe zu messen
      dropdown.style.visibility = 'hidden';
      dropdown.style.opacity = '0';
      dropdown.classList.add('show');
      const dropdownHeight = dropdown.offsetHeight || 300;
      dropdown.classList.remove('show');
      dropdown.style.visibility = '';
      dropdown.style.opacity = '';

      const needsFlip = spaceBelow < dropdownHeight && buttonRect.top > dropdownHeight;

      // Container mit overflow: hidden/auto schneiden das Dropdown ab → fixed positioning
      const scrollContainer = toggleButton.closest('.data-table-container, .auftrag-table, [style*="overflow"]');
      if (scrollContainer) {
        dropdown.style.position = 'fixed';
        dropdown.style.right = (window.innerWidth - buttonRect.right) + 'px';
        if (needsFlip) {
          dropdown.style.top = 'auto';
          dropdown.style.bottom = (viewportHeight - buttonRect.top + 4) + 'px';
        } else {
          dropdown.style.top = (buttonRect.bottom + 4) + 'px';
          dropdown.style.bottom = 'auto';
        }
      } else if (needsFlip) {
        dropdown.classList.add('dropdown-flip-up');
      }

      dropdown.classList.add('show');
      toggleButton.setAttribute('aria-expanded', 'true');
    }
  }

  // Alle Dropdowns schließen
  closeAllDropdowns() {
    document.querySelectorAll('.actions-dropdown').forEach(dropdown => {
      dropdown.classList.remove('show');
    });
    document.querySelectorAll('.actions-toggle').forEach(toggle => {
      toggle.setAttribute('aria-expanded', 'false');
    });
  }

  // Erstelle Actions für Creator
  // @deprecated - Nutze stattdessen actionBuilder.create('creator', creatorId)
  // Diese Methode bleibt für Backward Compatibility, wird aber schrittweise ersetzt
  createCreatorActions(creatorId) {
    if (this.isKunde()) {
      return this.createReadOnlyActions(creatorId);
    }
    
    return `
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${creatorId}">
            <i class="icon-eye"></i>
            Details anzeigen
          </a>
          <a href="#" class="action-item" data-action="edit" data-id="${creatorId}">
            <i class="icon-edit"></i>
            Bearbeiten
          </a>
          <a href="#" class="action-item" data-action="notiz" data-id="${creatorId}">
            <i class="icon-note"></i>
            Notiz hinzufügen
          </a>
          <a href="#" class="action-item" data-action="rating" data-id="${creatorId}">
            
            Bewerten
          </a>
          <a href="#" class="action-item" data-action="add_to_list" data-id="${creatorId}">
            ${this.getHeroIcon('add-to-list')}
            Zur Liste hinzufügen
          </a>
          <div class="action-separator"></div>
          <a href="#" class="action-item action-danger" data-action="delete" data-id="${creatorId}">
            <i class="icon-trash"></i>
            Löschen
          </a>
        </div>
      </div>
    `;
  }

  // Erstelle Actions für Unternehmen
  // @deprecated - Nutze stattdessen actionBuilder.create('unternehmen', unternehmenId)
  // Diese Methode bleibt für Backward Compatibility, wird aber schrittweise ersetzt
  createUnternehmenActions(unternehmenId) {
    if (this.isKunde()) {
      return this.createReadOnlyActions(unternehmenId);
    }
    
    return `
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${unternehmenId}">
            <i class="icon-eye"></i>
            Details anzeigen
          </a>
          <a href="#" class="action-item" data-action="edit" data-id="${unternehmenId}">
            <i class="icon-edit"></i>
            Bearbeiten
          </a>
          <a href="#" class="action-item" data-action="notiz" data-id="${unternehmenId}">
            <i class="icon-note"></i>
            Notiz hinzufügen
          </a>
          <a href="#" class="action-item" data-action="marken" data-id="${unternehmenId}">
            <i class="icon-tag"></i>
            Marken anzeigen
          </a>
          <a href="#" class="action-item" data-action="auftraege" data-id="${unternehmenId}">
            <i class="icon-briefcase"></i>
            Aufträge anzeigen
          </a>
          <div class="action-separator"></div>
          <a href="#" class="action-item action-danger" data-action="delete" data-id="${unternehmenId}">
            <i class="icon-trash"></i>
            Löschen
          </a>
        </div>
      </div>
    `;
  }

  // Erstelle Actions für Marken
  // @deprecated - Nutze stattdessen actionBuilder.create('marke', markeId)
  // Diese Methode bleibt für Backward Compatibility, wird aber schrittweise ersetzt
  createMarkeActions(markeId) {
    if (this.isKunde()) {
      return this.createReadOnlyActions(markeId);
    }
    
    return `
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${markeId}">
            <i class="icon-eye"></i>
            Details anzeigen
          </a>
          <a href="#" class="action-item" data-action="edit" data-id="${markeId}">
            <i class="icon-edit"></i>
            Bearbeiten
          </a>
          <a href="#" class="action-item" data-action="notiz" data-id="${markeId}">
            <i class="icon-note"></i>
            Notiz hinzufügen
          </a>
          <a href="#" class="action-item" data-action="auftraege" data-id="${markeId}">
            <i class="icon-briefcase"></i>
            Aufträge anzeigen
          </a>
          <div class="action-separator"></div>
          <a href="#" class="action-item action-danger" data-action="delete" data-id="${markeId}">
            <i class="icon-trash"></i>
            Löschen
          </a>
        </div>
      </div>
    `;
  }

  // Erstelle Actions für Kooperationen
  // @deprecated - Nutze stattdessen actionBuilder.create('kooperation', kooperationId)
  // Diese Methode bleibt für Backward Compatibility, wird aber schrittweise ersetzt
  createKooperationActions(kooperationId) {
    if (this.isKunde()) {
      return this.createReadOnlyActions(kooperationId);
    }
    
    return `
      <div class="actions-dropdown-container" data-entity-type="kooperation">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
            <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${kooperationId}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
              <path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd" />
            </svg>
            Details anzeigen
          </a>
          <a href="#" class="action-item" data-action="edit" data-id="${kooperationId}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path d="M5.433 13.917l-1.523 1.523a.75.75 0 001.06 1.06l1.523-1.523L5.433 13.917zM11.206 6.106L13.917 3.4a.75.75 0 011.06 1.06l-2.711 2.711-.693-.693z" />
              <path fill-rule="evenodd" d="M1.334 10.606a1.5 1.5 0 011.06-1.06l10.38-10.38a1.5 1.5 0 012.122 0l1.523 1.523a1.5 1.5 0 010 2.122l-10.38 10.38a1.5 1.5 0 01-1.06 1.06H1.334v-3.182z" clip-rule="evenodd" />
            </svg>
            Bearbeiten
          </a>
          <a href="#" class="action-item" data-action="notiz" data-id="${kooperationId}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.336-3.117C2.688 12.31 2 11.104 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd" />
            </svg>
            Notiz hinzufügen
          </a>
          <a href="#" class="action-item" data-action="quickview" data-id="${kooperationId}">
            ${this.getHeroIcon('quickview')}
            Schnellansicht öffnen
          </a>
          <div class="action-separator"></div>
          <a href="#" class="action-item action-danger" data-action="delete" data-id="${kooperationId}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
              <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.368.298a.75.75 0 10.232 1.482l.175-.027c.572-.089 1.14-.19 1.706-.302A3.75 3.75 0 019.75 3h.5a3.75 3.75 0 013.657 3.234c.566.112 1.134.213 1.706.302l.175.027a.75.75 0 10.232-1.482A41.203 41.203 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM2.5 7.75a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H3.25a.75.75 0 01-.75-.75zM7.25 9.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5H8a.75.75 0 01-.75-.75zM6 12.25a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM4.75 14.75a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
            </svg>
            Löschen
          </a>
        </div>
      </div>
    `;
  }

  // Erstelle Actions für Aufträge
  // @deprecated - Nutze stattdessen actionBuilder.create('auftrag', auftragId)
  // Diese Methode bleibt für Backward Compatibility, wird aber schrittweise ersetzt
  createAuftragActions(auftragId) {
    console.log('🎯 ACTIONSDROPDOWN: createAuftragActions aufgerufen für ID:', auftragId);
    
    if (this.isKunde()) {
      return this.createReadOnlyActions(auftragId);
    }
    
    const html = `
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${auftragId}">
            <i class="icon-eye"></i>
            Details anzeigen
          </a>
          <a href="#" class="action-item" data-action="edit" data-id="${auftragId}">
            <i class="icon-edit"></i>
            Bearbeiten
          </a>
          <a href="#" class="action-item" data-action="notiz" data-id="${auftragId}">
            <i class="icon-note"></i>
            Notiz hinzufügen
          </a>
          <a href="#" class="action-item" data-action="auftrag-details" data-icon="details" data-id="${auftragId}">
            Auftragsdetails hinzufügen
          </a>
          <a href="#" class="action-item" data-action="rechnung" data-id="${auftragId}">
            <i class="icon-invoice"></i>
            Rechnung erstellen
          </a>
          <div class="action-separator"></div>
          <a href="#" class="action-item action-danger" data-action="delete" data-id="${auftragId}">
            <i class="icon-trash"></i>
            Löschen
          </a>
        </div>
      </div>
    `;
    
    console.log('🎯 ACTIONSDROPDOWN: HTML generiert:', html.substring(0, 100) + '...');
    return html;
  }

  // Hilfsfunktion: Prüft ob Benutzer Kunde ist
  isKunde() {
    return window.currentUser?.rolle === 'kunde';
  }

  // Hilfsfunktion: Erstellt nur-Lesen Actions für Kunden
  createReadOnlyActions(entityId) {
    return `
      <div class="actions-dropdown-container">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view" data-id="${entityId}">
            <i class="icon-eye"></i>
            Details anzeigen
          </a>
        </div>
      </div>
    `;
  }

  // Handle Remove-Zuordnung Action
  async handleRemoveZuordnung(entityId, entityType) {
    // Prüfe ob wir auf der Kunden-Detail-Seite sind
    if (!window.kundenDetail || !window.kundenDetail.kundeId) {
      console.error('❌ KundenDetail nicht verfügbar für Remove-Action');
      return;
    }

    // Rufe die removeZuordnung Methode des KundenDetail auf
    await window.kundenDetail.removeZuordnung(entityId, entityType);
  }

  // Generische Action-Erstellung für zukünftige Listen
  // @deprecated - Nutze stattdessen actionBuilder.create(entityType, entityId)
  // Diese Methode bleibt für Backward Compatibility, wird aber schrittweise ersetzt
  createGenericActions(entityType, entityId, customActions = []) {
    // Für Kunden: Nur Details anzeigen erlaubt
    if (this.isKunde()) {
      return this.createReadOnlyActions(entityId);
    }
    
    const defaultActions = [
      { action: 'view', icon: 'icon-eye', label: 'Details anzeigen' },
      { action: 'edit', icon: 'icon-edit', label: 'Bearbeiten' },
      { action: 'notiz', icon: 'icon-note', label: 'Notiz hinzufügen' }
    ];

    const allActions = [...defaultActions, ...customActions];

    const actionItems = allActions.map(item => {
      const dangerClass = (item.action === 'delete' || item.action === 'remove') ? 'action-danger' : '';
      const iconHtml = this.getHeroIcon(item.action) || `<i class="${item.icon}"></i>`;
      return `
        <a href="#" class="action-item ${dangerClass}" data-action="${item.action}" data-id="${entityId}">
          ${iconHtml}
          ${item.label}
        </a>
      `;
    }).join('');

    return `
      <div class="actions-dropdown-container" data-entity-type="${entityType}">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
        <div class="actions-dropdown">
          ${actionItems}
        </div>
      </div>
    `;
  }

  // Event-Handler für Actions
  async handleAction(action, entityId, entityType, actionItem) {
    console.log(`🎯 ACTIONSDROPDOWN: Action ${action} für ${entityType} ${entityId}`);

    // Erst versuchen über das neue ActionRegistry
    try {
      await this.actionRegistry.executeAction(action, entityId, entityType, actionItem);
      return; // Wenn erfolgreich, hier beenden
    } catch (error) {
      console.warn('⚠️ ActionRegistry konnte Action nicht verarbeiten, verwende Legacy-System:', error);
    }

    // Legacy-System als Fallback
    switch (action) {
      case 'view':
        window.navigateTo(`/${entityType}/${entityId}`);
        break;
      
      case 'edit':
        // Standard-Route für alle Entitäten inkl. Auftragsdetails
        {
          const returnTo = actionItem?.dataset?.returnTo;
          const editRoute = returnTo
            ? `/${entityType}/${entityId}/edit?returnTo=${encodeURIComponent(returnTo)}`
            : `/${entityType}/${entityId}/edit`;
          window.navigateTo(editRoute);
        }
        break;
      
      case 'delete':
        if (entityType === 'vertraege') {
          // Vertraege haben eigene Lösch-Logik (inkl. PDF-Datei-Löschung)
          const vertraegeModule = window.moduleRegistry?.modules?.get('vertraege');
          if (vertraegeModule?.deleteVertrag) {
            vertraegeModule.deleteVertrag(entityId);
          }
        } else {
          this.confirmDelete(entityId, entityType);
        }
        break;
      
      case 'delete-liste':
        // Speziell für Creator-Auswahl Listen
        if (entityType === 'creator-auswahl' && window.creatorAuswahlList) {
          window.creatorAuswahlList.confirmDeleteListe(entityId);
        } else {
          this.confirmDelete(entityId, entityType);
        }
        break;
      
      case 'delete-strategie':
        // Speziell für Strategien
        if (window.strategieList) {
          window.strategieList.confirmDeleteStrategie(entityId);
        } else {
          this.confirmDelete(entityId, 'strategie');
        }
        break;
      
      case 'view-strategie':
        window.navigateTo(`/strategie/${entityId}`);
        break;
      
      case 'edit-strategie':
        window.navigateTo(`/strategie/${entityId}/edit`);
        break;
      
      case 'remove':
        this.handleRemoveZuordnung(entityId, entityType);
        break;
      
      case 'notiz':
        this.openNotizModal(entityId, entityType);
        break;
      
      case 'rating':
        this.openRatingModal(entityId, entityType);
        break;
      
      case 'rechnung_anpassen':
        // Öffne Rechnung-Anpassen-Drawer
        this.openRechnungAnpassenDrawer(entityId);
        break;
      
      case 'download':
        // PDF-Download für Rechnungen
        if (entityType === 'rechnung') {
          this.handleRechnungDownload(entityId);
        }
        break;
      
      case 'marken':
        window.navigateTo(`/unternehmen/${entityId}/marken`);
        break;
      
      case 'auftraege':
        window.navigateTo(`/unternehmen/${entityId}/auftraege`);
        break;
      
      case 'kampagnen':
        window.navigateTo(`/auftrag/${entityId}/kampagnen`);
        break;
      case 'video-create':
        // Direkt zum Video-Formular für die Kooperation navigieren
        if (entityType === 'kooperation') {
          window.navigateTo(`/video/new?kooperation=${entityId}`);
        } else {
          console.warn('video-create nur im Kontext kooperation unterstützt');
        }
        break;
      case 'task-create':
        // Task-Modal öffnen mit vorausgefüllter Kooperation
        if (entityType === 'kooperation' && window.taskDetailDrawer) {
          window.taskDetailDrawer.open(null, { entity_type: 'kooperation', entity_id: entityId });
        } else {
          console.warn('task-create nur im Kontext kooperation unterstützt');
        }
        break;
      case 'quickview':
        this.openKooperationQuickView(entityId);
        break;
      case 'assign-staff':
        // Nur Admin darf
        if (window.currentUser?.rolle !== 'admin') {
          alert('Nur Admins dürfen Mitarbeiter zuordnen.');
          break;
        }
        this.openAssignStaffModal(entityId);
        break;
      
      case 'assign_staff':
        // Mitarbeiter zu Marke zuordnen
        if (entityType === 'marke') {
          // Nur Admin und Benutzer mit entsprechenden Rechten
          if (window.currentUser?.rolle !== 'admin') {
            alert('Nur Admins dürfen Mitarbeiter zuordnen.');
            break;
          }
          this.openAssignMarkeStaffModal(entityId);
        } else {
          console.warn('assign_staff Action nur für Marken implementiert');
        }
        break;
      
      case 'rechnung':
        this.openRechnungModal(entityId, entityType);
        break;
      case 'add_to_campaign':
        this.openAddToCampaignModal(entityId);
        break;
      case 'favorite': {
        // Favorit hinzufügen wird nur im Kontext Kampagnen-Sourcing verwendet
        const kampagneId = document.querySelector('[data-kampagne-id]')?.dataset?.kampagneId;
        this.addToFavorites(entityId, kampagneId);
        break;
      }
      case 'add_to_list': {
        this.openAddToListModal(entityId);
        break;
      }
      case 'add-signed':
      case 'edit-signed': {
        // Unterschriebenen Vertrag hinzufügen/bearbeiten - Event an VertraegeList weiterleiten
        const existingUrl = actionItem?.dataset?.url || '';
        const existingPath = actionItem?.dataset?.path || '';
        window.dispatchEvent(new CustomEvent('vertrag-signed-action', { 
          detail: { 
            action, 
            vertragId: entityId, 
            existingUrl,
            existingPath
          } 
        }));
        break;
      }
      case 'add_ansprechpartner': {
        this.openAddAnsprechpartnerModal(entityId);
        break;
      }
      case 'add_ansprechpartner_kampagne': {
        this.openAddAnsprechpartnerToKampagneModal(entityId);
        break;
      }
      case 'add_ansprechpartner_unternehmen': {
        this.openAddAnsprechpartnerToUnternehmenModal(entityId);
        break;
      }
      case 'remove_ansprechpartner_unternehmen': {
        this.openRemoveAnsprechpartnerFromUnternehmenModalNew(entityId);
        break;
      }
      case 'remove_ansprechpartner_link': {
        // Verknüpfung zwischen Ansprechpartner und Unternehmen entfernen
        if (entityType === 'ansprechpartner_unternehmen') {
          // Unternehmen-ID aus dem aktuellen Kontext holen
          const unternehmenId = window.moduleRegistry?.modules?.get('unternehmen-detail')?.unternehmenId;
          if (unternehmenId && confirm('Möchten Sie diesen Ansprechpartner wirklich vom Unternehmen entfernen?')) {
            await this.removeAnsprechpartnerFromUnternehmen(entityId, unternehmenId);
            // UI aktualisieren
            window.dispatchEvent(new CustomEvent('entityUpdated', { 
              detail: { entity: 'ansprechpartner', action: 'removed', unternehmenId: unternehmenId } 
            }));
          }
        }
        break;
      }
      case 'edit_creator_adresse': {
        // Creator-Adresse bearbeiten
        if (entityType === 'creator_adresse') {
          // Creator-ID aus dem aktuellen Kontext holen
          const creatorId = window.moduleRegistry?.modules?.get('creator-detail')?.creatorId;
          if (creatorId) {
            window.creatorAdressenManager?.openEdit(creatorId, entityId);
          }
        }
        break;
      }
      case 'set_standard_adresse': {
        // Creator-Adresse als Standard festlegen
        if (entityType === 'creator_adresse') {
          const creatorId = window.moduleRegistry?.modules?.get('creator-detail')?.creatorId;
          if (creatorId) {
            if (confirm('Möchten Sie diese Adresse als Standard-Adresse festlegen?')) {
              await this.setStandardAdresse(entityId, creatorId);
            }
          }
        }
        break;
      }
      case 'set_hauptadresse_standard': {
        // Hauptadresse als Standard festlegen (setzt alle anderen auf nicht-standard)
        if (entityType === 'creator_hauptadresse') {
          const creatorId = entityId; // Bei Hauptadresse ist entityId = creatorId
          if (confirm('Möchten Sie die Hauptadresse als Standard-Adresse festlegen?')) {
            await this.setHauptadresseStandard(creatorId);
          }
        }
        break;
      }
      case 'delete_creator_adresse': {
        // Creator-Adresse löschen
        if (entityType === 'creator_adresse') {
          // Creator-ID aus dem aktuellen Kontext holen
          const creatorId = window.moduleRegistry?.modules?.get('creator-detail')?.creatorId;
          if (creatorId) {
            window.creatorAdressenManager?.deleteAdresse(entityId, creatorId);
          }
        }
        break;
      }
      case 'unassign-kampagne': {
        // Kontext: Mitarbeiter-Detail -> Kampagnen-Tabelle
        const mitarbeiterId = actionItem?.dataset?.mitarbeiterId || window.location.pathname.split('/').pop();
        if (!mitarbeiterId) {
          alert('Mitarbeiter-ID nicht gefunden');
          break;
        }
        const kampagneId = entityId;
        if (!kampagneId) break;
        
        let confirmed = false;
        if (window.confirmationModal) {
          const res = await window.confirmationModal.open({ 
            title: 'Zuweisung entfernen', 
            message: 'Zuweisung dieser Kampagne vom Mitarbeiter entfernen?', 
            confirmText: 'Entfernen', 
            cancelText: 'Abbrechen', 
            danger: true 
          });
          confirmed = res?.confirmed;
        } else {
          confirmed = confirm('Zuweisung dieser Kampagne vom Mitarbeiter entfernen?');
        }
        
        if (!confirmed) break;
        
        try {
          console.log(`🗑️ Entferne Kampagnen-Zuordnung: Mitarbeiter ${mitarbeiterId}, Kampagne ${kampagneId}`);
          
          const { error } = await window.supabase
            .from('kampagne_mitarbeiter')
            .delete()
            .eq('mitarbeiter_id', mitarbeiterId)
            .eq('kampagne_id', kampagneId);
            
          if (error) {
            console.error('❌ Supabase Fehler:', error);
            throw error;
          }
          
          console.log('✅ Kampagnen-Zuordnung erfolgreich entfernt');
          
          // UI: Zeile entfernen
          const row = actionItem.closest('tr');
          if (row) {
            row.remove();
            console.log('✅ Tabellenzeile entfernt');
          }
          
          // Tab-Count aktualisieren
          const countEl = document.querySelector('.tab-button[data-tab="kampagnen"] .tab-count');
          if (countEl) {
            const current = parseInt(countEl.textContent || '1', 10);
            countEl.textContent = String(Math.max(0, current - 1));
            console.log(`✅ Tab-Count aktualisiert: ${current} → ${Math.max(0, current - 1)}`);
          }
          
          // Mitarbeiter-Detail neu laden falls verfügbar
          if (window.mitarbeiterDetail && window.mitarbeiterDetail.load) {
            console.log('🔄 Lade Mitarbeiter-Detail neu...');
            await window.mitarbeiterDetail.load();
            await window.mitarbeiterDetail.render();
          }
          
          alert('Zuweisung entfernt');
        } catch (err) {
          console.error('❌ Zuweisung entfernen fehlgeschlagen:', err);
          alert(`Entfernen fehlgeschlagen: ${err.message}`);
        }
        break;
      }
      
      // Video-Entity: Redirect auf /video/:id
      case 'video-view':
        window.navigateTo(`/video/${entityId}`);
        break;
      case 'video-edit':
        window.navigateTo(`/video/${entityId}`);
        break;
      case 'video-delete':
        this.confirmDelete(entityId, 'kooperation_videos');
        break;
      case 'details':
      case 'auftrag-details':
        console.log('🎯 ACTIONSDROPDOWN: Details-Action wird verarbeitet');
        // Navigiere zur Auftragsdetails-Erstellungsseite
        window.navigateTo('/auftragsdetails/new');
        break;

      default:
        console.warn(`⚠️ Unbekannte Action: ${action}`);
    }
  }

  async openKooperationQuickView(kooperationId) {
    try {
      // Overlay
      const overlay = document.createElement('div');
      overlay.className = 'drawer-overlay';

      // Panel (right slide)
      const panel = document.createElement('div');
      panel.setAttribute('role', 'dialog');
      panel.className = 'drawer-panel';

      const header = document.createElement('div');
      header.className = 'drawer-header';
      const headerLeft = document.createElement('div');
      const title = document.createElement('h1');
      title.textContent = 'Kooperation · Schnellansicht';
      const subtitle = document.createElement('p');
      subtitle.style.margin = '0';
      subtitle.style.color = '#6b7280';
      subtitle.textContent = 'Videos & Kommentare';
      headerLeft.appendChild(title);
      headerLeft.appendChild(subtitle);
      
      const headerRight = document.createElement('div');
      const closeBtn = document.createElement('button');
      closeBtn.className = 'drawer-close';
      closeBtn.id = 'kvq-close';
      closeBtn.textContent = 'Schließen';
      headerRight.appendChild(closeBtn);
      
      header.appendChild(headerLeft);
      header.appendChild(headerRight);

      const body = document.createElement('div');
      body.className = 'drawer-body';
      const section = document.createElement('div');
      section.className = 'detail-section';
      
      const heading = document.createElement('h2');
      heading.textContent = 'Videos';
      
      const tableContainer = document.createElement('div');
      tableContainer.id = 'kvq-table';
      tableContainer.textContent = 'Lade...';
      
      section.appendChild(heading);
      section.appendChild(tableContainer);
      body.replaceChildren(section);

      panel.appendChild(header);
      panel.appendChild(body);
      document.body.appendChild(overlay);
      document.body.appendChild(panel);

      // Close handlers
      const close = () => { try { overlay.remove(); panel.remove(); } catch(err) { console.warn('⚠️ Drawer-Close fehlgeschlagen:', err?.message); } };
      overlay.addEventListener('click', close);
      header.querySelector('#kvq-close')?.addEventListener('click', close);
      document.addEventListener('keydown', function onEsc(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown', onEsc);} });

      // Animate in
      requestAnimationFrame(() => { panel.classList.add('show'); });

      // Load data
      const { data: videos } = await window.supabase
        .from('kooperation_videos')
        .select('id, position, content_art, titel, asset_url, status, created_at')
        .eq('kooperation_id', kooperationId)
        .order('position', { ascending: true });
      const videoList = videos || [];
      let commentsByVideo = {};
      if (videoList.length) {
        const ids = videoList.map(v => v.id);
        const { data: comments } = await window.supabase
          .from('kooperation_video_comment')
          .select('id, video_id, runde, text, author_name, created_at, deleted_at')
          .in('video_id', ids)
          .order('created_at', { ascending: true });
        (comments || []).forEach(c => {
          const key = c.video_id;
          if (!commentsByVideo[key]) commentsByVideo[key] = { r1: [], r2: [] };
          const bucket = (c.runde === 2 || c.runde === '2') ? 'r2' : 'r1';
          commentsByVideo[key][bucket].push(c);
        });
      }
      const safe = (s) => window.validatorSystem?.sanitizeHtml?.(s) ?? s;
      const fDate = d => d ? new Date(d).toLocaleDateString('de-DE') : '-';
      const fmtFeedback = (arr) => {
        if (!arr || !arr.length) return '-';
        return arr.map(c => {
          const isDeleted = !!c.deleted_at;
          const textStyle = isDeleted ? 'text-decoration: line-through; color: #999;' : '';
          const t = safe(c.text || '');
          const a = safe(c.author_name || '-');
          const dt = fDate(c.created_at);
          return `<div class="fb-line"><span class="fb-meta">${a} • ${dt}</span><div class="fb-text" style="${textStyle}">${t}</div></div>`;
        }).join('');
      };

      const rows = videoList.map(v => {
        const fb = commentsByVideo[v.id] || { r1: [], r2: [] };
        const linkBtn = v.asset_url ? `<a class=\"kvq-link-btn\" href=\"${v.asset_url}\" target=\"_blank\" rel=\"noopener\">${this.getHeroIcon('view')}<span>Öffnen</span></a>` : '-';
        return `
          <tr>
            <td>${v.position || '-'}</td>
            <td>${safe(v.content_art || '-')}</td>
            <td>
              <div class=\"kvq-cell\">
                <span class=\"kvq-title-text\">${safe(v.titel || '-')}</span>
                ${linkBtn}
              </div>
            </td>
            <td class="feedback-cell">${fmtFeedback(fb.r1)}</td>
            <td class="feedback-cell">${fmtFeedback(fb.r2)}</td>
            <td><span class="status-badge status-${(v.status || 'produktion').toLowerCase()}">${v.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Produktion'}</span></td>
          </tr>`;
      }).join('');

      const tableHtml = videoList.length ? `
        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Content Art</th>
                <th>Titel/URL</th>
                <th>Feedback K1</th>
                <th>Feedback K2</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>` : '<p class="empty-state">Keine Videos vorhanden.</p>';

      const tableDiv = body.querySelector('#kvq-table');
      tableDiv.innerHTML = '';
      if (videoList.length) {
        const tableContainer = document.createElement('div');
        tableContainer.className = 'data-table-container';
        tableContainer.innerHTML = tableHtml;
        tableDiv.appendChild(tableContainer);
      } else {
        const emptyState = document.createElement('p');
        emptyState.className = 'empty-state';
        emptyState.textContent = 'Keine Videos vorhanden.';
        tableDiv.appendChild(emptyState);
      }
      // Normalize icons inside any dropdowns rendered later (not used here, but keep consistent)
      this.normalizeIcons(body);
    } catch (err) {
      console.error('❌ Quickview öffnen fehlgeschlagen', err);
      alert('Schnellansicht konnte nicht geöffnet werden.');
    }
  }

  // Modal: Mitarbeiter einer Kampagne zuordnen (Auto-Suggest)
  async openAssignStaffModal(kampagneId) {
    const modal = document.createElement('div');
    modal.className = 'modal overlay-modal';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Mitarbeiter zuordnen</h3>
          <button class="modal-close" id="assign-staff-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Mitarbeiter wählen</label>
          <input type="text" id="staff-search" class="form-input auto-suggest-input" placeholder="Mitarbeiter suchen..." />
          <div id="staff-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="mdc-btn mdc-btn--cancel" id="assign-staff-cancel">
            <span class="mdc-btn__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </span>
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button class="mdc-btn mdc-btn--create" id="assign-staff-confirm" disabled>
            <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/>
              </svg>
            </span>
            <span class="mdc-btn__spinner" aria-hidden="true">
              <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16">
                <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
              </svg>
            </span>
            <span class="mdc-btn__label">Zuordnen</span>
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const input = modal.querySelector('#staff-search');
    const dropdown = modal.querySelector('#staff-dropdown');
    let selectedId = null;

    const search = async (term) => {
      try {
        // Zuerst bereits zugeordnete Mitarbeiter der Kampagne laden, um sie auszuschließen
        let assignedIds = [];
        try {
          const { data: assigned } = await window.supabase
            .from('kampagne_mitarbeiter')
            .select('mitarbeiter_id')
            .eq('kampagne_id', kampagneId);
          assignedIds = (assigned || []).map(r => r.mitarbeiter_id);
        } catch (err) {
          console.warn('⚠️ Fehler beim Laden zugewiesener Mitarbeiter:', err?.message);
        }

        let query = window.supabase
          .from('benutzer')
          .select('id, name, rolle, mitarbeiter_klasse:mitarbeiter_klasse_id(name)')
          .neq('rolle', 'kunde')
          .order('name');
        if (term) query = query.ilike('name', `%${term}%`);
        if (assignedIds.length > 0) {
          query = query.not('id', 'in', `(${assignedIds.join(',')})`);
        }
        const { data } = await query;
        return data || [];
      } catch (err) {
        console.warn('⚠️ Mitarbeiter-Suche fehlgeschlagen', err);
        return [];
      }
    };

    const hydrate = (items) => {
      const s = window.validatorSystem?.sanitizeHtml?.bind(window.validatorSystem) || (x => x);
      dropdown.innerHTML = items.length
        ? items.map(u => `<div class="dropdown-item" data-id="${u.id}">${s(u.name)}${u.mitarbeiter_klasse?.name ? ` <span class=\"muted\">(${s(u.mitarbeiter_klasse.name)})</span>` : ''}${u.rolle ? ` <span class=\"muted\">[${s(u.rolle)}]</span>` : ''}</div>`).join('')
        : '<div class="dropdown-item no-results">Keine Mitarbeiter gefunden</div>';
    };

    hydrate(await search(''));
    dropdown.classList.add('show');
    input.focus();
    // Falls das generische absolute Dropdown greift, stelle sicher, dass die Position relativ zum Input richtig ist
    const ensurePosition = () => {
      if (!dropdown.style.position || dropdown.style.position === 'absolute') {
        dropdown.style.position = 'relative';
      }
      dropdown.style.display = 'block';
    };
    ensurePosition();
    input.addEventListener('focus', () => dropdown.classList.add('show'));
    input.addEventListener('blur', () => setTimeout(() => dropdown.classList.remove('show'), 150));

    let debounce;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(async () => hydrate(await search(input.value.trim())), 200);
    });
    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item || item.classList.contains('no-results')) return;
      selectedId = item.dataset.id;
      input.value = item.textContent.trim();
      modal.querySelector('#assign-staff-confirm').disabled = false;
      dropdown.classList.remove('show');
    });

    const close = () => modal.remove();
    modal.querySelector('#assign-staff-close').onclick = close;
    modal.querySelector('#assign-staff-cancel').onclick = close;
    modal.querySelector('#assign-staff-confirm').onclick = async () => {
      if (!selectedId) return;
      
      const btn = modal.querySelector('#assign-staff-confirm');
      btn.disabled = true;
      btn.classList.add('is-loading');
      
      try {
        // Speichere Zuordnung in Relationstabelle (mit role-Feld)
        const { error: insertError } = await window.supabase
          .from('kampagne_mitarbeiter')
          .insert({ 
            kampagne_id: kampagneId, 
            mitarbeiter_id: selectedId,
            role: 'projektmanager'  // Standard-Rolle
          });
        
        if (insertError) {
          console.error('❌ Insert-Fehler:', insertError);
          throw insertError;
        }
        // Notification an zugewiesenen Mitarbeiter
        try {
          const { data: kamp } = await window.supabase
            .from('kampagne')
            .select('id, kampagnenname, eigener_name')
            .eq('id', kampagneId)
            .single();
          const kampName = KampagneUtils.getDisplayName(kamp);
          await window.notificationSystem?.pushNotification(selectedId, {
            type: 'assign',
            entity: 'kampagne',
            entityId: kampagneId,
            title: 'Neue Kampagnen-Zuweisung',
            message: `Du wurdest der Kampagne "${kampName}" zugeordnet.`
          });
          window.dispatchEvent(new Event('notificationsRefresh'));
        } catch (err) {
          console.warn('⚠️ Fehler beim Erstellen der Benachrichtigung:', err?.message);
        }
        console.log('✅ Mitarbeiter erfolgreich zugeordnet');
        close();
        window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kampagne', action: 'staff-assigned', id: kampagneId } }));
        alert('Mitarbeiter zugeordnet.');
      } catch (err) {
        console.error('❌ Fehler beim Zuordnen', err);
        alert('Zuordnung fehlgeschlagen.');
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    };
  }

  // Modal: Mitarbeiter einer Marke zuordnen (Auto-Suggest) - Identisch zum Ansprechpartner-Modal
  async openAssignMarkeStaffModal(markeId) {
    console.log('🎯 ACTIONSDROPDOWN: Öffne Mitarbeiter-Auswahl-Modal für Marke:', markeId);

    // Bereits zugeordnete Mitarbeiter laden
    let mitarbeiter = [];
    let excludedMitarbeiterIds = [];
    
    try {
      const { data: existing } = await window.supabase
        .from('marke_mitarbeiter')
        .select('mitarbeiter_id')
        .eq('marke_id', markeId);
      
      excludedMitarbeiterIds = (existing || []).map(r => r.mitarbeiter_id).filter(Boolean);

      // Verfügbare Mitarbeiter laden (die noch nicht zugeordnet sind) - Nur Mitarbeiter, keine Kunden
      let query = window.supabase
        .from('benutzer')
        .select(`
          id, 
          name, 
          rolle,
          mitarbeiter_klasse:mitarbeiter_klasse_id(name)
        `)
        .neq('rolle', 'kunde')
        .order('name');
      
      if (excludedMitarbeiterIds.length > 0) {
        query = query.not('id', 'in', `(${excludedMitarbeiterIds.join(',')})`);
      }
      
      const { data } = await query;
      mitarbeiter = data || [];
      
    } catch (error) {
      console.warn('⚠️ Fehler beim Laden der Mitarbeiter:', error);
    }

    const modal = document.createElement('div');
    modal.className = 'modal overlay-modal';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Mitarbeiter zur Marke hinzufügen</h3>
          <button class="modal-close" id="add-mitarbeiter-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Mitarbeiter wählen</label>
          <input type="text" id="mitarbeiter-search" class="form-input auto-suggest-input" placeholder="Mitarbeiter suchen..." />
          <div id="mitarbeiter-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="mdc-btn mdc-btn--cancel" id="add-mitarbeiter-cancel">
            <span class="mdc-btn__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </span>
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button class="mdc-btn mdc-btn--create" id="add-mitarbeiter-confirm" disabled>
            <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/>
              </svg>
            </span>
            <span class="mdc-btn__spinner" aria-hidden="true">
              <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16">
                <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
              </svg>
            </span>
            <span class="mdc-btn__label">Hinzufügen</span>
          </button>
        </div>
      </div>`;
    
    document.body.appendChild(modal);

    const input = modal.querySelector('#mitarbeiter-search');
    const dropdown = modal.querySelector('#mitarbeiter-dropdown');
    let selectedId = null;

    const hydrateDropdown = (filter = '') => {
      // Wenn kein Filter, zeige Hinweis zum Tippen
      if (!filter || filter.trim().length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Mitarbeiter zu suchen...</div>';
        return;
      }
      
      const f = filter.toLowerCase();
      const items = mitarbeiter.filter(m => {
        const name = (m.name || '').toLowerCase();
        const rolle = (m.rolle || '').toLowerCase();
        const klasse = (m.mitarbeiter_klasse?.name || '').toLowerCase();
        return name.includes(f) || rolle.includes(f) || klasse.includes(f);
      });
      
      dropdown.innerHTML = items.length
        ? items.map(m => {
            const displayName = m.name;
            const details = [
              m.rolle,
              m.mitarbeiter_klasse?.name
            ].filter(Boolean).join(' • ');
            
            return `<div class="dropdown-item" data-id="${m.id}">
              <div class="dropdown-item-main">${displayName}</div>
              ${details ? `<div class="dropdown-item-details">${details}</div>` : ''}
            </div>`;
          }).join('')
        : '<div class="dropdown-item no-results">Keine verfügbaren Mitarbeiter gefunden</div>';
    };
    
    // Initial kein Dropdown anzeigen - erst beim Tippen
    dropdown.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Mitarbeiter zu suchen...</div>';
    
    input.addEventListener('focus', () => {
      // Nur anzeigen wenn bereits Text eingegeben wurde
      if (input.value.trim().length > 0) {
        dropdown.classList.add('show');
      }
    });
    input.addEventListener('blur', () => {
      setTimeout(() => dropdown.classList.remove('show'), 150);
    });

    // Dynamische Suche
    let searchTimeout;
    input.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        const term = e.target.value.trim();
        
        // Kein Dropdown anzeigen wenn weniger als 1 Zeichen
        if (term.length < 1) {
          dropdown.classList.remove('show');
          return;
        }
        
        // Ab 1 Zeichen suchen und anzeigen - Nur Mitarbeiter, keine Kunden
        try {
          let query = window.supabase
            .from('benutzer')
            .select(`
              id, 
              name, 
              rolle,
              mitarbeiter_klasse:mitarbeiter_klasse_id(name)
            `)
            .neq('rolle', 'kunde')
            .or(`name.ilike.%${term}%,rolle.ilike.%${term}%`)
            .order('name');
          
          if (excludedMitarbeiterIds.length > 0) {
            query = query.not('id', 'in', `(${excludedMitarbeiterIds.join(',')})`);
          }
          
          const { data } = await query;
          mitarbeiter = data || [];
          hydrateDropdown(term);
          dropdown.classList.add('show');
        } catch (err) {
          console.warn('⚠️ Mitarbeiter-Suche fehlgeschlagen', err);
        }
      }, 200);
    });

    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item || item.classList.contains('no-results')) return;
      
      selectedId = item.dataset.id;
      const mainText = item.querySelector('.dropdown-item-main')?.textContent || item.textContent;
      input.value = mainText;
      modal.querySelector('#add-mitarbeiter-confirm').disabled = false;
      dropdown.classList.remove('show');
    });

    // Event-Handlers
    const close = () => modal.remove();
    modal.querySelector('#add-mitarbeiter-close').onclick = close;
    modal.querySelector('#add-mitarbeiter-cancel').onclick = close;
    
    // ESC-Taste zum Schließen
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);

    // Hinzufügen-Handler
    modal.querySelector('#add-mitarbeiter-confirm').onclick = async () => {
      if (!selectedId) return;
      
      const btn = modal.querySelector('#add-mitarbeiter-confirm');
      btn.disabled = true;
      btn.classList.add('is-loading');
      
      try {
        // Mitarbeiter zur Marke hinzufügen (Junction Table)
        const { error } = await window.supabase
          .from('marke_mitarbeiter')
          .insert({ 
            marke_id: markeId, 
            mitarbeiter_id: selectedId,
            assigned_by: window.currentUser?.id || null
          });

        if (error) throw error;

        // Push-Benachrichtigung senden
        try {
          const { data: marke } = await window.supabase
            .from('marke')
            .select('id, markenname')
            .eq('id', markeId)
            .single();
          const markeName = marke?.markenname || markeId;
          
          await window.notificationSystem?.pushNotification(selectedId, {
            type: 'assignment',
            entity: 'marke',
            entityId: markeId,
            title: 'Neue Marken-Zuordnung',
            message: `Sie wurden der Marke "${markeName}" zugeordnet und können nun alle zugehörigen Kampagnen und Kooperationen einsehen.`
          });
          window.dispatchEvent(new Event('notificationsRefresh'));
        } catch (notifError) {
          console.warn('⚠️ Benachrichtigung fehlgeschlagen:', notifError);
        }

        close();
        document.removeEventListener('keydown', handleEsc);
        
        // UI aktualisieren - Multiple Events für Live-Updates
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'mitarbeiter', action: 'added', markeId: markeId } 
        }));
        // Zusätzliches Event für MarkeList Live-Update
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'marke', action: 'mitarbeiter-added', id: markeId } 
        }));
        
        alert('✅ Mitarbeiter wurde erfolgreich zur Marke hinzugefügt und wird automatisch angezeigt!');
        console.log('✅ ACTIONSDROPDOWN: Mitarbeiter erfolgreich hinzugefügt');

      } catch (error) {
        console.error('❌ Fehler beim Hinzufügen des Mitarbeiters:', error);
        alert('Fehler beim Hinzufügen: ' + (error.message || 'Unbekannter Fehler'));
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    };
  }

  async addToFavorites(creatorId, kampagneId) {
    try {
      // Fallback: kampagneId aus URL /kampagne/:id extrahieren
      if (!kampagneId) {
        const match = window.location.pathname.match(/\/kampagne\/([0-9a-fA-F-]{36})/);
        kampagneId = match ? match[1] : null;
      }
      if (!kampagneId) {
        alert('Kampagne konnte nicht ermittelt werden.');
        return;
      }
      await window.supabase
        .from('kampagne_creator_favoriten')
        .insert({ kampagne_id: kampagneId, creator_id: creatorId });
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kampagne', action: 'favorite-added', id: kampagneId } }));
      alert('Zu Favoriten hinzugefügt.');
    } catch (err) {
      console.error('❌ Fehler beim Hinzufügen zu Favoriten', err);
      alert('Hinzufügen zu Favoriten fehlgeschlagen.');
    }
  }

  // Modal: Creator zu Kampagne hinzufügen
  async openAddToCampaignModal(creatorId) {
    // Kampagnen laden: Nur solche anzeigen, zu denen der Creator noch NICHT gehört
    // und für Nicht-Admins nur Kampagnen, denen der Nutzer zugeordnet ist
    let kampagnen = [];
    let excludedCampaignIds = [];
    let allowedCampaignIds = null; // null = kein Filter, [] = nichts erlaubt
    try {
      const [finalRes, sourcingRes] = await Promise.all([
        window.supabase
          .from('kampagne_creator')
          .select('kampagne_id')
          .eq('creator_id', creatorId),
        window.supabase
          .from('kampagne_creator_sourcing')
          .select('kampagne_id')
          .eq('creator_id', creatorId)
      ]);
      const finalIds = (finalRes?.data || []).map(r => r.kampagne_id).filter(Boolean);
      const sourcingIds = (sourcingRes?.data || []).map(r => r.kampagne_id).filter(Boolean);
      excludedCampaignIds = Array.from(new Set([...finalIds, ...sourcingIds]));

      // Sichtbarkeits-Filter: Nicht-Admin sieht nur ihm zugewiesene Kampagnen
      if (window.currentUser?.rolle !== 'admin') {
        const { data: assignedK } = await window.supabase
          .from('kampagne_mitarbeiter')
          .select('kampagne_id')
          .eq('mitarbeiter_id', window.currentUser?.id);
        allowedCampaignIds = (assignedK || []).map(r => r.kampagne_id).filter(Boolean);
      }

      let shouldQuery = true;
      let query = window.supabase
        .from('kampagne')
        .select('id, kampagnenname, eigener_name, status')
        .order('created_at', { ascending: false });
      if (Array.isArray(allowedCampaignIds)) {
        if (allowedCampaignIds.length === 0) {
          shouldQuery = false;
          kampagnen = [];
        } else {
          query = query.in('id', allowedCampaignIds);
        }
      }
      if (excludedCampaignIds.length > 0) {
        // PostgREST erwartet bei not in für UUIDs Werte ohne Quotes
        query = query.not('id', 'in', `(${excludedCampaignIds.join(',')})`);
      }
      if (shouldQuery) {
        const { data } = await query;
        kampagnen = data || [];
      }
    } catch {}

    const modal = document.createElement('div');
    modal.className = 'modal overlay-modal';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Zu Kampagne hinzufügen</h3>
          <button class="modal-close" id="add-to-campaign-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Kampagne wählen</label>
          <input type="text" id="campaign-search" class="form-input auto-suggest-input" placeholder="Kampagne suchen..." />
          <div id="campaign-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="mdc-btn mdc-btn--cancel" id="add-to-campaign-cancel">
            <span class="mdc-btn__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </span>
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button class="mdc-btn mdc-btn--create" id="add-to-campaign-confirm" disabled>
            <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/>
              </svg>
            </span>
            <span class="mdc-btn__spinner" aria-hidden="true">
              <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16">
                <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
              </svg>
            </span>
            <span class="mdc-btn__label">Hinzufügen</span>
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const input = modal.querySelector('#campaign-search');
    const dropdown = modal.querySelector('#campaign-dropdown');
    let selectedId = null;

    const hydrateDropdown = (filter = '') => {
      const f = filter.toLowerCase();
      const items = kampagnen.filter(k => KampagneUtils.getDisplayName(k).toLowerCase().includes(f));
      dropdown.innerHTML = items.length
        ? items.map(k => `<div class=\"dropdown-item\" data-id=\"${k.id}\">${KampagneUtils.getDisplayName(k)}</div>`).join('')
        : '<div class=\"dropdown-item no-results\">Keine Kampagne gefunden</div>';
    };
    hydrateDropdown('');
    input.addEventListener('focus', () => {
      dropdown.classList.add('show');
    });
    input.addEventListener('blur', () => {
      setTimeout(() => dropdown.classList.remove('show'), 150);
    });

    // Debounced dynamische Suche gegen DB (unter Beachtung der Exclusions und erlaubten Kampagnen)
    let debounceTimer;
    input.addEventListener('input', () => {
      const term = input.value.trim();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          let query = window.supabase
            .from('kampagne')
            .select('id, kampagnenname, eigener_name, status')
            .order('created_at', { ascending: false });
          if (term.length > 0) {
            query = query.ilike('kampagnenname', `%${term}%`);
          }
          if (Array.isArray(allowedCampaignIds)) {
            if (allowedCampaignIds.length === 0) {
              kampagnen = [];
              hydrateDropdown(term);
              return;
            }
            query = query.in('id', allowedCampaignIds);
          }
          if (excludedCampaignIds.length > 0) {
            query = query.not('id', 'in', `(${excludedCampaignIds.join(',')})`);
          }
          const { data } = await query;
          kampagnen = data || [];
          hydrateDropdown(term);
        } catch (err) {
          console.warn('⚠️ Kampagnen-Suche fehlgeschlagen', err);
        }
      }, 200);
    });
    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item || item.classList.contains('no-results')) return;
      selectedId = item.dataset.id;
      input.value = item.textContent;
      modal.querySelector('#add-to-campaign-confirm').disabled = false;
      dropdown.classList.remove('show');
    });

    const close = () => modal.remove();
    modal.querySelector('#add-to-campaign-close').onclick = close;
    modal.querySelector('#add-to-campaign-cancel').onclick = close;
    modal.querySelector('#add-to-campaign-confirm').onclick = async () => {
      if (!selectedId) return;
      
      const btn = modal.querySelector('#add-to-campaign-confirm');
      btn.disabled = true;
      btn.classList.add('is-loading');
      
      try {
        await window.supabase
          .from('kampagne_creator_sourcing')
          .insert({ kampagne_id: selectedId, creator_id: creatorId });
        // Notification an alle zugewiesenen Mitarbeiter der Kampagne (Sourcing update)
        try {
          const [{ data: staff }, { data: kamp }] = await Promise.all([
            window.supabase.from('kampagne_mitarbeiter').select('mitarbeiter_id').eq('kampagne_id', selectedId),
            window.supabase.from('kampagne').select('kampagnenname, eigener_name').eq('id', selectedId).single()
          ]);
          const kampName = KampagneUtils.getDisplayName(kamp);
          const mitarbeiterIds = (staff || []).map(r => r.mitarbeiter_id).filter(Boolean);
          for (const uid of mitarbeiterIds) {
            await window.notificationSystem?.pushNotification(uid, {
              type: 'update',
              entity: 'kampagne',
              entityId: selectedId,
              title: 'Sourcing-Update',
              message: `Neuer Creator wurde dem Sourcing von "${kampName}" hinzugefügt.`
            });
          }
          if (mitarbeiterIds.length) window.dispatchEvent(new Event('notificationsRefresh'));
        } catch (err) {
          console.warn('⚠️ Fehler beim Senden der Sourcing-Benachrichtigungen:', err?.message);
        }
        close();
        window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'kampagne', action: 'sourcing-added', id: selectedId } }));
        alert('Creator wurde zum Sourcing der Kampagne hinzugefügt.');
      } catch (err) {
        console.error('❌ Fehler beim Hinzufügen zur Kampagne', err);
        alert('Hinzufügen fehlgeschlagen.');
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    };
  }

  // Modal: Ansprechpartner zu Marke hinzufügen
  async openAddAnsprechpartnerModal(markeId) {
    console.log('🎯 ACTIONSDROPDOWN: Öffne Ansprechpartner-Auswahl-Modal für Marke:', markeId);

    // Bereits zugeordnete Ansprechpartner laden
    let ansprechpartner = [];
    let excludedAnsprechpartnerIds = [];
    
    try {
      const { data: existing } = await window.supabase
        .from('ansprechpartner_marke')
        .select('ansprechpartner_id')
        .eq('marke_id', markeId);
      
      excludedAnsprechpartnerIds = (existing || []).map(r => r.ansprechpartner_id).filter(Boolean);

      // Verfügbare Ansprechpartner laden (die noch nicht zugeordnet sind)
      let query = window.supabase
        .from('ansprechpartner')
        .select(`
          id, 
          vorname, 
          nachname, 
          email,
          unternehmen:unternehmen_id(firmenname),
          position:position_id(name)
        `)
        .order('nachname');
      
      if (excludedAnsprechpartnerIds.length > 0) {
        query = query.not('id', 'in', `(${excludedAnsprechpartnerIds.join(',')})`);
      }
      
      const { data } = await query;
      ansprechpartner = data || [];
      
    } catch (error) {
      console.warn('⚠️ Fehler beim Laden der Ansprechpartner:', error);
    }

    const modal = document.createElement('div');
    modal.className = 'modal overlay-modal';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Ansprechpartner zur Marke hinzufügen</h3>
          <button class="modal-close" id="add-ansprechpartner-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Ansprechpartner wählen</label>
          <input type="text" id="ansprechpartner-search" class="form-input auto-suggest-input" placeholder="Ansprechpartner suchen..." />
          <div id="ansprechpartner-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="mdc-btn mdc-btn--cancel" id="add-ansprechpartner-cancel">
            <span class="mdc-btn__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </span>
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button class="mdc-btn mdc-btn--create" id="add-ansprechpartner-confirm" disabled>
            <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/>
              </svg>
            </span>
            <span class="mdc-btn__spinner" aria-hidden="true">
              <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16">
                <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
              </svg>
            </span>
            <span class="mdc-btn__label">Hinzufügen</span>
          </button>
        </div>
      </div>`;
    
    document.body.appendChild(modal);

    const input = modal.querySelector('#ansprechpartner-search');
    const dropdown = modal.querySelector('#ansprechpartner-dropdown');
    let selectedId = null;

    const hydrateDropdown = (filter = '') => {
      // Wenn kein Filter, zeige Hinweis zum Tippen
      if (!filter || filter.trim().length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';
        return;
      }
      
      const f = filter.toLowerCase();
      const items = ansprechpartner.filter(ap => {
        const fullName = `${ap.vorname} ${ap.nachname}`.toLowerCase();
        const email = (ap.email || '').toLowerCase();
        const unternehmen = (ap.unternehmen?.firmenname || '').toLowerCase();
        return fullName.includes(f) || email.includes(f) || unternehmen.includes(f);
      });
      
      const s = window.validatorSystem?.sanitizeHtml?.bind(window.validatorSystem) || (x => x);
      dropdown.innerHTML = items.length
        ? items.map(ap => {
            const displayName = `${s(ap.vorname)} ${s(ap.nachname)}`;
            const details = [
              ap.email ? s(ap.email) : null,
              ap.unternehmen?.firmenname ? s(ap.unternehmen.firmenname) : null,
              ap.position?.name ? s(ap.position.name) : null
            ].filter(Boolean).join(' • ');
            
            return `<div class="dropdown-item" data-id="${ap.id}">
              <div class="dropdown-item-main">${displayName}</div>
              ${details ? `<div class="dropdown-item-details">${details}</div>` : ''}
            </div>`;
          }).join('')
        : '<div class="dropdown-item no-results">Keine verfügbaren Ansprechpartner gefunden</div>';
    };
    
    // Initial kein Dropdown anzeigen - erst beim Tippen
    dropdown.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';
    
    input.addEventListener('focus', () => {
      // Nur anzeigen wenn bereits Text eingegeben wurde
      if (input.value.trim().length > 0) {
        dropdown.classList.add('show');
      }
    });
    input.addEventListener('blur', () => {
      setTimeout(() => dropdown.classList.remove('show'), 150);
    });

    // Dynamische Suche
    let searchTimeout;
    input.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        const term = e.target.value.trim();
        
        // Kein Dropdown anzeigen wenn weniger als 1 Zeichen
        if (term.length < 1) {
          dropdown.classList.remove('show');
          return;
        }
        
        // Ab 1 Zeichen suchen und anzeigen
        try {
          let query = window.supabase
            .from('ansprechpartner')
            .select(`
              id, 
              vorname, 
              nachname, 
              email,
              unternehmen:unternehmen_id(firmenname),
              position:position_id(name)
            `)
            .or(`vorname.ilike.%${term}%,nachname.ilike.%${term}%,email.ilike.%${term}%`)
            .order('nachname');
          
          if (excludedAnsprechpartnerIds.length > 0) {
            query = query.not('id', 'in', `(${excludedAnsprechpartnerIds.join(',')})`);
          }
          
          const { data } = await query;
          ansprechpartner = data || [];
          hydrateDropdown(term);
          dropdown.classList.add('show');
        } catch (err) {
          console.warn('⚠️ Ansprechpartner-Suche fehlgeschlagen', err);
        }
      }, 200);
    });

    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item || item.classList.contains('no-results')) return;
      
      selectedId = item.dataset.id;
      const mainText = item.querySelector('.dropdown-item-main')?.textContent || item.textContent;
      input.value = mainText;
      modal.querySelector('#add-ansprechpartner-confirm').disabled = false;
      dropdown.classList.remove('show');
    });

    // Event-Handlers
    const close = () => modal.remove();
    modal.querySelector('#add-ansprechpartner-close').onclick = close;
    modal.querySelector('#add-ansprechpartner-cancel').onclick = close;
    
    // ESC-Taste zum Schließen
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);

    // Hinzufügen-Handler
    modal.querySelector('#add-ansprechpartner-confirm').onclick = async () => {
      if (!selectedId) return;
      
      const btn = modal.querySelector('#add-ansprechpartner-confirm');
      btn.disabled = true;
      btn.classList.add('is-loading');
      
      try {
        // Ansprechpartner zur Marke hinzufügen (Junction Table)
        const { error } = await window.supabase
          .from('ansprechpartner_marke')
          .insert({ 
            marke_id: markeId, 
            ansprechpartner_id: selectedId 
          });

        if (error) throw error;

        close();
        document.removeEventListener('keydown', handleEsc);
        
        // UI aktualisieren - Multiple Events für Live-Updates
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'ansprechpartner', action: 'added', markeId: markeId } 
        }));
        // Zusätzliches Event für MarkeList Live-Update
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'marke', action: 'ansprechpartner-added', id: markeId } 
        }));
        
        alert('✅ Ansprechpartner wurde erfolgreich zur Marke hinzugefügt und wird automatisch angezeigt!');
        console.log('✅ ACTIONSDROPDOWN: Ansprechpartner erfolgreich hinzugefügt');

      } catch (error) {
        console.error('❌ Fehler beim Hinzufügen des Ansprechpartners:', error);
        alert('Fehler beim Hinzufügen: ' + (error.message || 'Unbekannter Fehler'));
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    };
  }

  // Modal: Ansprechpartner zu Unternehmen hinzufügen
  async openAddAnsprechpartnerToUnternehmenModal(unternehmenId) {
    console.log('🎯 ACTIONSDROPDOWN: Öffne Ansprechpartner-Auswahl-Modal für Unternehmen:', unternehmenId);

    // Bereits zugeordnete Ansprechpartner laden
    let ansprechpartner = [];
    let excludedAnsprechpartnerIds = [];
    
    try {
      const { data: existing } = await window.supabase
        .from('ansprechpartner_unternehmen')
        .select('ansprechpartner_id')
        .eq('unternehmen_id', unternehmenId);
      
      excludedAnsprechpartnerIds = (existing || []).map(r => r.ansprechpartner_id).filter(Boolean);

      // Verfügbare Ansprechpartner laden (die noch nicht zugeordnet sind)
      let query = window.supabase
        .from('ansprechpartner')
        .select(`
          id, 
          vorname, 
          nachname, 
          email,
          unternehmen:unternehmen_id(firmenname),
          position:position_id(name)
        `)
        .order('nachname');
      
      if (excludedAnsprechpartnerIds.length > 0) {
        query = query.not('id', 'in', `(${excludedAnsprechpartnerIds.join(',')})`);
      }
      
      const { data } = await query;
      ansprechpartner = data || [];
      
    } catch (error) {
      console.warn('⚠️ Fehler beim Laden der Ansprechpartner:', error);
    }

    const modal = document.createElement('div');
    modal.className = 'modal overlay-modal';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Ansprechpartner zum Unternehmen hinzufügen</h3>
          <button class="modal-close" id="add-ansprechpartner-unternehmen-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Ansprechpartner wählen</label>
          <input type="text" id="ansprechpartner-unternehmen-search" class="form-input auto-suggest-input" placeholder="Ansprechpartner suchen..." />
          <div id="ansprechpartner-unternehmen-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="mdc-btn mdc-btn--cancel" id="add-ansprechpartner-unternehmen-cancel">
            <span class="mdc-btn__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </span>
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button class="mdc-btn mdc-btn--create" id="add-ansprechpartner-unternehmen-confirm" disabled>
            <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/>
              </svg>
            </span>
            <span class="mdc-btn__spinner" aria-hidden="true">
              <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16">
                <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
              </svg>
            </span>
            <span class="mdc-btn__label">Hinzufügen</span>
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const input = modal.querySelector('#ansprechpartner-unternehmen-search');
    const dropdown = modal.querySelector('#ansprechpartner-unternehmen-dropdown');
    let selectedId = null;

    const hydrateDropdown = (filter = '') => {
      // Wenn kein Filter, zeige Hinweis zum Tippen
      if (!filter || filter.trim().length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';
        return;
      }
      
      const f = filter.toLowerCase();
      const items = ansprechpartner.filter(ap => {
        const fullName = `${ap.vorname} ${ap.nachname}`.toLowerCase();
        const email = (ap.email || '').toLowerCase();
        const unternehmen = (ap.unternehmen?.firmenname || '').toLowerCase();
        return fullName.includes(f) || email.includes(f) || unternehmen.includes(f);
      });
      
      const s = window.validatorSystem?.sanitizeHtml?.bind(window.validatorSystem) || (x => x);
      dropdown.innerHTML = items.length
        ? items.map(ap => {
            const displayName = `${s(ap.vorname)} ${s(ap.nachname)}`;
            const details = [
              ap.email ? s(ap.email) : null,
              ap.unternehmen?.firmenname ? s(ap.unternehmen.firmenname) : null,
              ap.position?.name ? s(ap.position.name) : null
            ].filter(Boolean).join(' • ');
            
            return `<div class="dropdown-item" data-id="${ap.id}">
              <div class="dropdown-item-main">${displayName}</div>
              ${details ? `<div class="dropdown-item-details">${details}</div>` : ''}
            </div>`;
          }).join('')
        : '<div class="dropdown-item no-results">Keine verfügbaren Ansprechpartner gefunden</div>';
    };
    
    // Initial kein Dropdown anzeigen - erst beim Tippen
    dropdown.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';
    
    input.addEventListener('focus', () => {
      // Nur anzeigen wenn bereits Text eingegeben wurde
      if (input.value.trim().length > 0) {
        dropdown.classList.add('show');
      }
    });
    input.addEventListener('blur', () => {
      setTimeout(() => dropdown.classList.remove('show'), 150);
    });

    // Dynamische Suche
    let searchTimeout;
    input.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        const term = e.target.value.trim();
        
        // Kein Dropdown anzeigen wenn weniger als 1 Zeichen
        if (term.length < 1) {
          dropdown.classList.remove('show');
          return;
        }
        
        // Ab 1 Zeichen suchen und anzeigen
        try {
          let query = window.supabase
            .from('ansprechpartner')
            .select(`
              id, 
              vorname, 
              nachname, 
              email,
              unternehmen:unternehmen_id(firmenname),
              position:position_id(name)
            `)
            .or(`vorname.ilike.%${term}%,nachname.ilike.%${term}%,email.ilike.%${term}%`)
            .order('nachname');
          
          if (excludedAnsprechpartnerIds.length > 0) {
            query = query.not('id', 'in', `(${excludedAnsprechpartnerIds.join(',')})`);
          }
          
          const { data } = await query;
          ansprechpartner = data || [];
          hydrateDropdown(term);
          dropdown.classList.add('show');
        } catch (err) {
          console.warn('⚠️ Ansprechpartner-Suche fehlgeschlagen', err);
        }
      }, 200);
    });

    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item || item.classList.contains('no-results')) return;
      
      selectedId = item.dataset.id;
      const mainText = item.querySelector('.dropdown-item-main')?.textContent || item.textContent;
      input.value = mainText;
      modal.querySelector('#add-ansprechpartner-unternehmen-confirm').disabled = false;
      dropdown.classList.remove('show');
    });

    const close = () => {
      document.body.removeChild(modal);
    };

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', handleEsc);
      }
    };

    document.addEventListener('keydown', handleEsc);

    modal.querySelector('#add-ansprechpartner-unternehmen-close').onclick = () => {
      close();
      document.removeEventListener('keydown', handleEsc);
    };
    modal.querySelector('#add-ansprechpartner-unternehmen-cancel').onclick = () => {
      close();
      document.removeEventListener('keydown', handleEsc);
    };

    modal.querySelector('#add-ansprechpartner-unternehmen-confirm').onclick = async () => {
      if (!selectedId) return;

      const btn = modal.querySelector('#add-ansprechpartner-unternehmen-confirm');
      btn.disabled = true;
      btn.classList.add('is-loading');

      try {
        const { error } = await window.supabase
          .from('ansprechpartner_unternehmen')
          .insert([{
            ansprechpartner_id: selectedId,
            unternehmen_id: unternehmenId
          }]);

        if (error) throw error;

        close();
        document.removeEventListener('keydown', handleEsc);
        
        // UI aktualisieren - Multiple Events für Live-Updates
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'ansprechpartner', action: 'added', unternehmenId: unternehmenId } 
        }));
        // Zusätzliches Event für UnternehmenList Live-Update
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'unternehmen', action: 'ansprechpartner-added', id: unternehmenId } 
        }));
        
        alert('✅ Ansprechpartner wurde erfolgreich zum Unternehmen hinzugefügt und wird automatisch angezeigt!');
        console.log('✅ ACTIONSDROPDOWN: Ansprechpartner erfolgreich zu Unternehmen hinzugefügt');

      } catch (error) {
        console.error('❌ Fehler beim Hinzufügen des Ansprechpartners:', error);
        alert('Fehler beim Hinzufügen: ' + (error.message || 'Unbekannter Fehler'));
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    };
  }

  // Modal: Ansprechpartner von Unternehmen entfernen
  async openRemoveAnsprechpartnerFromUnternehmenModal(unternehmenId) {
    console.log('🎯 ACTIONSDROPDOWN: Öffne Ansprechpartner-Entfernen-Modal für Unternehmen:', unternehmenId);

    // Zugeordnete Ansprechpartner laden
    let ansprechpartner = [];
    
    try {
      const { data } = await window.supabase
        .from('ansprechpartner_unternehmen')
        .select(`
          ansprechpartner_id,
          ansprechpartner:ansprechpartner_id (
            id,
            vorname,
            nachname,
            email,
            position:position_id(name)
          )
        `)
        .eq('unternehmen_id', unternehmenId);
      
      ansprechpartner = (data || [])
        .filter(r => r.ansprechpartner)
        .map(r => r.ansprechpartner);
      
    } catch (error) {
      console.warn('⚠️ Fehler beim Laden der Ansprechpartner:', error);
    }

    if (ansprechpartner.length === 0) {
      alert('Diesem Unternehmen sind noch keine Ansprechpartner zugeordnet.');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal overlay-modal';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Ansprechpartner vom Unternehmen entfernen</h3>
          <button class="modal-close" id="remove-ansprechpartner-unternehmen-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Ansprechpartner wählen</label>
          <input type="text" id="ansprechpartner-unternehmen-remove-search" class="form-input auto-suggest-input" placeholder="Ansprechpartner suchen..." />
          <div id="ansprechpartner-unternehmen-remove-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="mdc-btn mdc-btn--cancel" id="remove-ansprechpartner-unternehmen-cancel">
            <span class="mdc-btn__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </span>
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button class="danger-btn" id="remove-ansprechpartner-unternehmen-confirm" disabled>Entfernen</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const input = modal.querySelector('#ansprechpartner-unternehmen-remove-search');
    const dropdown = modal.querySelector('#ansprechpartner-unternehmen-remove-dropdown');
    let selectedId = null;

    const hydrateDropdown = (filter = '') => {
      // Wenn kein Filter, zeige Hinweis zum Tippen
      if (!filter || filter.trim().length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';
        return;
      }
      
      const f = filter.toLowerCase();
      const items = ansprechpartner.filter(ap => {
        const fullName = `${ap.vorname} ${ap.nachname}`.toLowerCase();
        const email = (ap.email || '').toLowerCase();
        return fullName.includes(f) || email.includes(f);
      });
      
      dropdown.innerHTML = items.length
        ? items.map(ap => {
            const displayName = `${ap.vorname} ${ap.nachname}`;
            const details = [
              ap.email,
              ap.position?.name
            ].filter(Boolean).join(' • ');
            
            return `<div class="dropdown-item" data-id="${ap.id}">
              <div class="dropdown-item-main">${displayName}</div>
              ${details ? `<div class="dropdown-item-details">${details}</div>` : ''}
            </div>`;
          }).join('')
        : '<div class="dropdown-item no-results">Keine Ansprechpartner gefunden</div>';
    };
    
    // Initial kein Dropdown anzeigen - erst beim Tippen
    dropdown.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';
    
    input.addEventListener('focus', () => {
      // Nur anzeigen wenn bereits Text eingegeben wurde
      if (input.value.trim().length > 0) {
        dropdown.classList.add('show');
      }
    });
    input.addEventListener('blur', () => {
      setTimeout(() => dropdown.classList.remove('show'), 150);
    });

    // Dynamische Suche
    let searchTimeout;
    input.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const term = e.target.value.trim();
        
        // Kein Dropdown anzeigen wenn weniger als 1 Zeichen
        if (term.length < 1) {
          dropdown.classList.remove('show');
          return;
        }
        
        // Ab 1 Zeichen suchen und anzeigen
        hydrateDropdown(term);
        dropdown.classList.add('show');
      }, 200);
    });

    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item || item.classList.contains('no-results')) return;
      
      selectedId = item.dataset.id;
      const mainText = item.querySelector('.dropdown-item-main')?.textContent || item.textContent;
      input.value = mainText;
      modal.querySelector('#remove-ansprechpartner-unternehmen-confirm').disabled = false;
      dropdown.classList.remove('show');
    });

    const close = () => {
      document.body.removeChild(modal);
    };

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', handleEsc);
      }
    };

    document.addEventListener('keydown', handleEsc);

    modal.querySelector('#remove-ansprechpartner-unternehmen-close').onclick = () => {
      close();
      document.removeEventListener('keydown', handleEsc);
    };
    modal.querySelector('#remove-ansprechpartner-unternehmen-cancel').onclick = () => {
      close();
      document.removeEventListener('keydown', handleEsc);
    };

    modal.querySelector('#remove-ansprechpartner-unternehmen-confirm').onclick = async () => {
      if (!selectedId) return;

      try {
        const { error } = await window.supabase
          .from('ansprechpartner_unternehmen')
          .delete()
          .eq('ansprechpartner_id', selectedId)
          .eq('unternehmen_id', unternehmenId);

        if (error) throw error;

        close();
        document.removeEventListener('keydown', handleEsc);
        
        // UI aktualisieren - Multiple Events für Live-Updates
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'ansprechpartner', action: 'removed', unternehmenId: unternehmenId } 
        }));
        // Zusätzliches Event für UnternehmenList Live-Update
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'unternehmen', action: 'ansprechpartner-removed', id: unternehmenId } 
        }));
        
        alert('✅ Ansprechpartner wurde erfolgreich vom Unternehmen entfernt!');
        console.log('✅ ACTIONSDROPDOWN: Ansprechpartner erfolgreich von Unternehmen entfernt');

      } catch (error) {
        console.error('❌ Fehler beim Entfernen des Ansprechpartners:', error);
        alert('Fehler beim Entfernen: ' + (error.message || 'Unbekannter Fehler'));
      }
    };
  }

  // Modal: Ansprechpartner von Unternehmen entfernen (neue Tabellen-Ansicht)
  async openRemoveAnsprechpartnerFromUnternehmenModalNew(unternehmenId) {
    console.log('🎯 ACTIONSDROPDOWN: Öffne Ansprechpartner-Entfernen-Modal für Unternehmen (Tabelle):', unternehmenId);

    // Zugeordnete Ansprechpartner laden
    let ansprechpartner = [];
    
    try {
      const { data } = await window.supabase
        .from('ansprechpartner_unternehmen')
        .select(`
          ansprechpartner_id,
          ansprechpartner:ansprechpartner_id (
            id,
            vorname,
            nachname,
            email,
            telefonnummer,
            position:position_id(name),
            unternehmen:unternehmen_id(firmenname)
          )
        `)
        .eq('unternehmen_id', unternehmenId);
      
      ansprechpartner = (data || [])
        .filter(r => r.ansprechpartner)
        .map(r => r.ansprechpartner);
      
    } catch (error) {
      console.warn('⚠️ Fehler beim Laden der Ansprechpartner:', error);
    }

    if (ansprechpartner.length === 0) {
      alert('Diesem Unternehmen sind noch keine Ansprechpartner zugeordnet.');
      return;
    }

    // Tabellen-HTML generieren
    const s = window.validatorSystem?.sanitizeHtml?.bind(window.validatorSystem) || (x => x);
    const tableRows = ansprechpartner.map(ap => `
      <tr>
        <td>
          <input type="checkbox" class="ansprechpartner-remove-check" data-id="${ap.id}" />
        </td>
        <td>
          <a href="#" onclick="event.preventDefault(); window.navigateTo('/ansprechpartner/${ap.id}')" class="table-link">
            ${s(ap.vorname)} ${s(ap.nachname)}
          </a>
        </td>
        <td>${s(ap.email || '-')}</td>
        <td>${s(ap.telefonnummer || '-')}</td>
        <td>${s(ap.position?.name || '-')}</td>
        <td>
          <button class="btn-remove-single danger-btn" data-id="${ap.id}" title="Einzeln entfernen">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </td>
      </tr>
    `).join('');

    const modal = document.createElement('div');
    modal.className = 'modal overlay-modal modal-large';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Ansprechpartner vom Unternehmen entfernen</h3>
          <button class="modal-close" id="remove-ansprechpartner-unternehmen-close">×</button>
        </div>
        <div class="modal-body">
          <p class="modal-description">Wählen Sie die Ansprechpartner aus, die Sie vom Unternehmen entfernen möchten:</p>
          
          <!-- Bulk Actions -->
          <div class="bulk-actions">
            <button id="select-all-ansprechpartner" class="secondary-btn">Alle auswählen</button>
            <button id="deselect-all-ansprechpartner" class="secondary-btn">Auswahl aufheben</button>
            <span class="selected-count">0 ausgewählt</span>
          </div>
          
          <!-- Ansprechpartner Tabelle -->
          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th width="40">
                    <input type="checkbox" id="select-all-header" />
                  </th>
                  <th>Name</th>
                  <th>E-Mail</th>
                  <th>Telefon</th>
                  <th>Position</th>
                  <th width="80">Aktion</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <button class="mdc-btn mdc-btn--cancel" id="remove-ansprechpartner-unternehmen-cancel">
            <span class="mdc-btn__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </span>
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button class="danger-btn" id="remove-selected-ansprechpartner" disabled>Ausgewählte entfernen</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    // Event Handler für Checkboxen und Buttons
    const checkboxes = modal.querySelectorAll('.ansprechpartner-remove-check');
    const selectAllHeader = modal.querySelector('#select-all-header');
    const selectAllBtn = modal.querySelector('#select-all-ansprechpartner');
    const deselectAllBtn = modal.querySelector('#deselect-all-ansprechpartner');
    const selectedCountSpan = modal.querySelector('.selected-count');
    const removeSelectedBtn = modal.querySelector('#remove-selected-ansprechpartner');

    // Update selected count und Button state
    const updateSelection = () => {
      const selectedCheckboxes = modal.querySelectorAll('.ansprechpartner-remove-check:checked');
      const count = selectedCheckboxes.length;
      
      selectedCountSpan.textContent = `${count} ausgewählt`;
      removeSelectedBtn.disabled = count === 0;
      
      // Header checkbox state
      if (count === 0) {
        selectAllHeader.checked = false;
        selectAllHeader.indeterminate = false;
      } else if (count === checkboxes.length) {
        selectAllHeader.checked = true;
        selectAllHeader.indeterminate = false;
      } else {
        selectAllHeader.checked = false;
        selectAllHeader.indeterminate = true;
      }
    };

    // Checkbox Event Listeners
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', updateSelection);
    });

    selectAllHeader.addEventListener('change', () => {
      const isChecked = selectAllHeader.checked;
      checkboxes.forEach(cb => {
        cb.checked = isChecked;
      });
      updateSelection();
    });

    selectAllBtn.addEventListener('click', () => {
      checkboxes.forEach(cb => {
        cb.checked = true;
      });
      updateSelection();
    });

    deselectAllBtn.addEventListener('click', () => {
      checkboxes.forEach(cb => {
        cb.checked = false;
      });
      updateSelection();
    });

    // Einzeln entfernen Buttons
    modal.querySelectorAll('.btn-remove-single').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const ansprechpartnerId = e.target.closest('.btn-remove-single').dataset.id;
        const ap = ansprechpartner.find(ap => ap.id === ansprechpartnerId);
        const name = ap ? `${ap.vorname} ${ap.nachname}` : 'Ansprechpartner';
        
        {
          let proceed = false;
          const msg = `Möchten Sie ${name} wirklich vom Unternehmen entfernen?`;
          if (window.confirmationModal) {
            const res = await window.confirmationModal.open({ title: 'Entfernen bestätigen', message: msg, confirmText: 'Entfernen', cancelText: 'Abbrechen', danger: true });
            proceed = !!res?.confirmed;
          } else {
            proceed = confirm(msg);
          }
          if (!proceed) return;
          await this.removeAnsprechpartnerFromUnternehmen(ansprechpartnerId, unternehmenId);
          // Zeile aus Tabelle entfernen
          e.target.closest('tr').remove();
          updateSelection();
          
          // Modal schließen wenn keine Ansprechpartner mehr da sind
          if (modal.querySelectorAll('tbody tr').length === 0) {
            close();
          }
        }
      });
    });

    // Ausgewählte entfernen
    removeSelectedBtn.addEventListener('click', async () => {
      const selectedCheckboxes = modal.querySelectorAll('.ansprechpartner-remove-check:checked');
      const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.id);
      
      if (selectedIds.length === 0) return;
      
      const count = selectedIds.length;
      {
        let proceed = false;
        const msg = `Möchten Sie wirklich ${count} Ansprechpartner vom Unternehmen entfernen?`;
        if (window.confirmationModal) {
          const res = await window.confirmationModal.open({ title: 'Entfernen bestätigen', message: msg, confirmText: 'Entfernen', cancelText: 'Abbrechen', danger: true });
          proceed = !!res?.confirmed;
        } else {
          proceed = confirm(msg);
        }
        if (!proceed) return;
        let successCount = 0;
        let errorCount = 0;
        
        for (const ansprechpartnerId of selectedIds) {
          try {
            await this.removeAnsprechpartnerFromUnternehmen(ansprechpartnerId, unternehmenId);
            successCount++;
            
            // Zeile aus Tabelle entfernen
            const checkbox = modal.querySelector(`[data-id="${ansprechpartnerId}"]`);
            if (checkbox) {
              checkbox.closest('tr').remove();
            }
          } catch (error) {
            errorCount++;
            console.error('❌ Fehler beim Entfernen:', error);
          }
        }
        
        // Ergebnis anzeigen
        let message = '';
        if (successCount > 0) {
          message += `✅ ${successCount} Ansprechpartner erfolgreich entfernt.`;
        }
        if (errorCount > 0) {
          message += `\n❌ ${errorCount} Ansprechpartner konnten nicht entfernt werden.`;
        }
        alert(message);
        
        updateSelection();
        
        // Modal schließen wenn keine Ansprechpartner mehr da sind
        if (modal.querySelectorAll('tbody tr').length === 0) {
          close();
        }
      }
    });

    // Modal schließen
    const close = () => {
      document.body.removeChild(modal);
    };

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', handleEsc);
      }
    };

    document.addEventListener('keydown', handleEsc);

    modal.querySelector('#remove-ansprechpartner-unternehmen-close').onclick = () => {
      close();
      document.removeEventListener('keydown', handleEsc);
    };
    modal.querySelector('#remove-ansprechpartner-unternehmen-cancel').onclick = () => {
      close();
      document.removeEventListener('keydown', handleEsc);
    };

    // Initial update
    updateSelection();
  }

  // Helper-Methode: Einzelnen Ansprechpartner von Unternehmen entfernen
  async removeAnsprechpartnerFromUnternehmen(ansprechpartnerId, unternehmenId) {
    try {
      const { error } = await window.supabase
        .from('ansprechpartner_unternehmen')
        .delete()
        .eq('ansprechpartner_id', ansprechpartnerId)
        .eq('unternehmen_id', unternehmenId);

      if (error) throw error;

      // UI aktualisieren
      window.dispatchEvent(new CustomEvent('entityUpdated', { 
        detail: { entity: 'ansprechpartner', action: 'removed', unternehmenId: unternehmenId } 
      }));

      console.log('✅ ACTIONSDROPDOWN: Ansprechpartner erfolgreich von Unternehmen entfernt');
      return true;

    } catch (error) {
      console.error('❌ Fehler beim Entfernen des Ansprechpartners:', error);
      throw error;
    }
  }

  // Standard-Adresse festlegen
  async setStandardAdresse(adresseId, creatorId) {
    try {
      console.log('🔄 Setze Standard-Adresse:', adresseId, 'für Creator:', creatorId);
      
      // Erst alle anderen Adressen auf nicht-standard setzen
      const { error: resetError } = await window.supabase
        .from('creator_adressen')
        .update({ ist_standard: false })
        .eq('creator_id', creatorId);

      if (resetError) {
        console.error('❌ Fehler beim Zurücksetzen:', resetError);
        throw resetError;
      }

      // Dann die gewählte Adresse auf standard setzen
      const { error: setError } = await window.supabase
        .from('creator_adressen')
        .update({ ist_standard: true })
        .eq('id', adresseId);

      if (setError) {
        console.error('❌ Fehler beim Setzen:', setError);
        throw setError;
      }

      console.log('✅ Standard-Adresse erfolgreich gesetzt');
      window.NotificationSystem?.show('success', 'Standard-Adresse erfolgreich festgelegt.');

      // UI aktualisieren
      window.dispatchEvent(new CustomEvent('entityUpdated', { 
        detail: { entity: 'creator_adressen', creatorId: creatorId } 
      }));

      return true;

    } catch (error) {
      console.error('❌ Fehler beim Festlegen der Standard-Adresse:', error);
      window.NotificationSystem?.show('error', 'Fehler beim Festlegen der Standard-Adresse: ' + error.message);
      throw error;
    }
  }

  // Hauptadresse als Standard festlegen (setzt alle zusätzlichen Adressen auf nicht-standard)
  async setHauptadresseStandard(creatorId) {
    try {
      console.log('🔄 Setze Hauptadresse als Standard für Creator:', creatorId);
      
      // Alle zusätzlichen Adressen auf nicht-standard setzen
      const { error: resetError } = await window.supabase
        .from('creator_adressen')
        .update({ ist_standard: false })
        .eq('creator_id', creatorId);

      if (resetError) {
        console.error('❌ Fehler beim Zurücksetzen:', resetError);
        throw resetError;
      }

      console.log('✅ Hauptadresse erfolgreich als Standard gesetzt');
      window.NotificationSystem?.show('success', 'Hauptadresse erfolgreich als Standard festgelegt.');

      // UI aktualisieren
      window.dispatchEvent(new CustomEvent('entityUpdated', { 
        detail: { entity: 'creator_adressen', creatorId: creatorId } 
      }));

      return true;

    } catch (error) {
      console.error('❌ Fehler beim Festlegen der Hauptadresse als Standard:', error);
      window.NotificationSystem?.show('error', 'Fehler: ' + error.message);
      throw error;
    }
  }

  // Modal: Creator zu Liste hinzufügen
  async openAddToListModal(creatorId) {
    let listen = [];
    let excludedListIds = [];
    try {
      const { data: existing } = await window.supabase
        .from('creator_list_member')
        .select('list_id')
        .eq('creator_id', creatorId);
      excludedListIds = (existing || []).map(r => r.list_id).filter(Boolean);

      const { data } = await window.supabase
        .from('creator_list')
        .select('id, name, created_at')
        .order('created_at', { ascending: false });
      listen = (data || []).filter(l => !excludedListIds.includes(l.id));
    } catch (err) {
      console.warn('⚠️ Fehler beim Laden der Creator-Listen:', err?.message);
    }

    const modal = document.createElement('div');
    modal.className = 'modal overlay-modal';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Zu Liste hinzufügen</h3>
          <button class="modal-close" id="add-to-list-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Liste wählen</label>
          <input type="text" id="list-search" class="form-input auto-suggest-input" placeholder="Liste suchen..." />
          <div id="list-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="mdc-btn mdc-btn--cancel" id="add-to-list-cancel">
            <span class="mdc-btn__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </span>
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button class="mdc-btn mdc-btn--create" id="add-to-list-confirm" disabled>
            <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/>
              </svg>
            </span>
            <span class="mdc-btn__spinner" aria-hidden="true">
              <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16">
                <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
              </svg>
            </span>
            <span class="mdc-btn__label">Hinzufügen</span>
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const input = modal.querySelector('#list-search');
    const dropdown = modal.querySelector('#list-dropdown');
    let selectedId = null;

    const hydrate = (term = '') => {
      const f = term.toLowerCase();
      const items = listen.filter(l => (l.name || '').toLowerCase().includes(f));
      dropdown.innerHTML = items.length
        ? items.map(l => `<div class="dropdown-item" data-id="${l.id}">${l.name}</div>`).join('')
        : '<div class="dropdown-item no-results">Keine Liste gefunden</div>';
      dropdown.classList.add('show');
    };
    hydrate('');
    input.addEventListener('focus', () => dropdown.classList.add('show'));
    input.addEventListener('blur', () => setTimeout(() => dropdown.classList.remove('show'), 150));
    let debounce;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => hydrate(input.value.trim()), 150);
    });
    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item || item.classList.contains('no-results')) return;
      selectedId = item.dataset.id;
      input.value = item.textContent.trim();
      modal.querySelector('#add-to-list-confirm').disabled = false;
      dropdown.classList.remove('show');
    });

    const close = () => modal.remove();
    modal.querySelector('#add-to-list-close').onclick = close;
    modal.querySelector('#add-to-list-cancel').onclick = close;
    modal.querySelector('#add-to-list-confirm').onclick = async () => {
      if (!selectedId) return;
      
      const btn = modal.querySelector('#add-to-list-confirm');
      btn.disabled = true;
      btn.classList.add('is-loading');
      
      try {
        await window.supabase
          .from('creator_list_member')
          .insert({ list_id: selectedId, creator_id: creatorId, added_at: new Date().toISOString() });
        close();
        window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: 'creator_list', action: 'member-added', id: selectedId } }));
        alert('Creator zur Liste hinzugefügt.');
      } catch (err) {
        console.error('❌ Fehler beim Hinzufügen zur Liste', err);
        alert('Hinzufügen fehlgeschlagen.');
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    };
  }

  // Bestätigungsdialog für Löschen
  async confirmDelete(entityId, entityType) {
    const entityName = this.getEntityDisplayName(entityType);
    const message = `Möchten Sie wirklich ${entityName} löschen? Diese Aktion kann nicht rückgängig gemacht werden.`;
    let proceed = false;
    if (window.confirmationModal) {
      const res = await window.confirmationModal.open({ title: 'Löschvorgang bestätigen', message, confirmText: 'Endgültig löschen', cancelText: 'Abbrechen', danger: true });
      proceed = !!res?.confirmed;
    } else {
      proceed = confirm(message);
    }
    if (!proceed) return;
    console.log(`🗑️ Lösche ${entityType} ${entityId}`);
    const result = await window.dataService.deleteEntity(entityType, entityId);
    if (result?.success) {
      window.dispatchEvent(new CustomEvent('entityUpdated', { detail: { entity: entityType, action: 'deleted', id: entityId } }));
    }
  }

  // Modal für Notizen öffnen
  openNotizModal(entityId, entityType) {
    console.log(`📝 Öffne Notiz-Modal für ${entityType} ${entityId}`);
    // TODO: Implementiere Notiz-Modal
  }

  // Modal für Bewertungen öffnen
  openRatingModal(entityId, entityType) {
    console.log(`⭐ Öffne Rating-Modal für ${entityType} ${entityId}`);
    // TODO: Implementiere Rating-Modal
  }

  // Modal für Rechnungen öffnen
  openRechnungModal(entityId, entityType) {
    console.log(`💰 Öffne Rechnung-Modal für ${entityType} ${entityId}`);
    // TODO: Implementiere Rechnung-Modal
  }

  // Hilfsmethode für Entity-Namen
  getEntityDisplayName(entityType) {
    const names = {
      creator: 'den Creator',
      unternehmen: 'das Unternehmen',
      marke: 'die Marke',
      auftrag: 'den Auftrag',
      auftragsdetails: 'die Auftragsdetails',
      auftrag_details: 'die Auftragsdetails',
      kooperation: 'die Kooperation',
      briefing: 'das Briefing',
      kampagne: 'die Kampagne'
    };
    return names[entityType] || 'das Element';
  }

  // Modal: Ansprechpartner zu Kampagne hinzufügen
  async openAddAnsprechpartnerToKampagneModal(kampagneId) {
    console.log('🎯 ACTIONSDROPDOWN: Öffne Ansprechpartner-Auswahl-Modal für Kampagne:', kampagneId);

    // Bereits zugeordnete Ansprechpartner laden
    let ansprechpartner = [];
    let excludedAnsprechpartnerIds = [];
    
    try {
      const { data: existing } = await window.supabase
        .from('ansprechpartner_kampagne')
        .select('ansprechpartner_id')
        .eq('kampagne_id', kampagneId);
      
      excludedAnsprechpartnerIds = (existing || []).map(r => r.ansprechpartner_id).filter(Boolean);

      // Verfügbare Ansprechpartner laden (die noch nicht zugeordnet sind)
      let query = window.supabase
        .from('ansprechpartner')
        .select(`
          id, 
          vorname, 
          nachname, 
          email,
          unternehmen:unternehmen_id(firmenname),
          position:position_id(name)
        `)
        .order('nachname');
      
      if (excludedAnsprechpartnerIds.length > 0) {
        query = query.not('id', 'in', `(${excludedAnsprechpartnerIds.join(',')})`);
      }
      
      const { data } = await query;
      ansprechpartner = data || [];
      
    } catch (error) {
      console.warn('⚠️ Fehler beim Laden der Ansprechpartner:', error);
    }

    const modal = document.createElement('div');
    modal.className = 'modal overlay-modal';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Ansprechpartner zur Kampagne hinzufügen</h3>
          <button class="modal-close" id="add-ansprechpartner-kampagne-close">×</button>
        </div>
        <div class="modal-body">
          <label class="form-label">Ansprechpartner wählen</label>
          <input type="text" id="ansprechpartner-kampagne-search" class="form-input auto-suggest-input" placeholder="Ansprechpartner suchen..." />
          <div id="ansprechpartner-kampagne-dropdown" class="auto-suggest-dropdown"></div>
        </div>
        <div class="modal-footer">
          <button class="mdc-btn mdc-btn--cancel" id="add-ansprechpartner-kampagne-cancel">
            <span class="mdc-btn__icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </span>
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button class="mdc-btn mdc-btn--create" id="add-ansprechpartner-kampagne-confirm" disabled>
            <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l10-10a1 1 0 10-1.41-1.41L9 16.17z"/>
              </svg>
            </span>
            <span class="mdc-btn__spinner" aria-hidden="true">
              <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16">
                <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
              </svg>
            </span>
            <span class="mdc-btn__label">Hinzufügen</span>
          </button>
        </div>
      </div>`;
    
    document.body.appendChild(modal);

    const input = modal.querySelector('#ansprechpartner-kampagne-search');
    const dropdown = modal.querySelector('#ansprechpartner-kampagne-dropdown');
    let selectedId = null;

    const hydrateDropdown = (filter = '') => {
      // Wenn kein Filter, zeige Hinweis zum Tippen
      if (!filter || filter.trim().length === 0) {
        dropdown.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';
        return;
      }
      
      const f = filter.toLowerCase();
      const items = ansprechpartner.filter(ap => {
        const fullName = `${ap.vorname} ${ap.nachname}`.toLowerCase();
        const email = (ap.email || '').toLowerCase();
        const unternehmen = (ap.unternehmen?.firmenname || '').toLowerCase();
        return fullName.includes(f) || email.includes(f) || unternehmen.includes(f);
      });
      
      const s = window.validatorSystem?.sanitizeHtml?.bind(window.validatorSystem) || (x => x);
      dropdown.innerHTML = items.length
        ? items.map(ap => {
            const displayName = `${s(ap.vorname)} ${s(ap.nachname)}`;
            const details = [
              ap.email ? s(ap.email) : null,
              ap.unternehmen?.firmenname ? s(ap.unternehmen.firmenname) : null,
              ap.position?.name ? s(ap.position.name) : null
            ].filter(Boolean).join(' • ');
            
            return `<div class="dropdown-item" data-id="${ap.id}">
              <div class="dropdown-item-main">${displayName}</div>
              ${details ? `<div class="dropdown-item-details">${details}</div>` : ''}
            </div>`;
          }).join('')
        : '<div class="dropdown-item no-results">Keine verfügbaren Ansprechpartner gefunden</div>';
    };
    
    // Initial kein Dropdown anzeigen - erst beim Tippen
    dropdown.innerHTML = '<div class="dropdown-item no-results">Beginnen Sie zu tippen, um Ansprechpartner zu suchen...</div>';
    
    input.addEventListener('focus', () => {
      // Nur anzeigen wenn bereits Text eingegeben wurde
      if (input.value.trim().length > 0) {
        dropdown.classList.add('show');
      }
    });
    input.addEventListener('blur', () => {
      setTimeout(() => dropdown.classList.remove('show'), 150);
    });

    // Dynamische Suche
    let searchTimeout;
    input.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        const term = e.target.value.trim();
        
        // Kein Dropdown anzeigen wenn weniger als 1 Zeichen
        if (term.length < 1) {
          dropdown.classList.remove('show');
          return;
        }
        
        // Ab 1 Zeichen suchen und anzeigen
        try {
          let query = window.supabase
            .from('ansprechpartner')
            .select(`
              id, 
              vorname, 
              nachname, 
              email,
              unternehmen:unternehmen_id(firmenname),
              position:position_id(name)
            `)
            .or(`vorname.ilike.%${term}%,nachname.ilike.%${term}%,email.ilike.%${term}%`)
            .order('nachname');
          
          if (excludedAnsprechpartnerIds.length > 0) {
            query = query.not('id', 'in', `(${excludedAnsprechpartnerIds.join(',')})`);
          }
          
          const { data } = await query;
          ansprechpartner = data || [];
          hydrateDropdown(term);
          dropdown.classList.add('show'); // Ensure dropdown is shown after search
        } catch (err) {
          console.warn('⚠️ Ansprechpartner-Suche fehlgeschlagen', err);
        }
      }, 200);
    });

    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.dropdown-item');
      if (!item || item.classList.contains('no-results')) return;
      
      selectedId = item.dataset.id;
      const mainText = item.querySelector('.dropdown-item-main')?.textContent || item.textContent;
      input.value = mainText;
      modal.querySelector('#add-ansprechpartner-kampagne-confirm').disabled = false;
      dropdown.classList.remove('show');
    });

    // Event-Handlers
    const close = () => modal.remove();
    modal.querySelector('#add-ansprechpartner-kampagne-close').onclick = close;
    modal.querySelector('#add-ansprechpartner-kampagne-cancel').onclick = close;
    
    // ESC-Taste zum Schließen
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);

    // Hinzufügen-Handler
    modal.querySelector('#add-ansprechpartner-kampagne-confirm').onclick = async () => {
      if (!selectedId) return;
      
      const btn = modal.querySelector('#add-ansprechpartner-kampagne-confirm');
      btn.disabled = true;
      btn.classList.add('is-loading');
      
      try {
        // Ansprechpartner zur Kampagne hinzufügen (Junction Table)
        const { error } = await window.supabase
          .from('ansprechpartner_kampagne')
          .insert({ 
            kampagne_id: kampagneId, 
            ansprechpartner_id: selectedId 
          });

        if (error) throw error;

        close();
        document.removeEventListener('keydown', handleEsc);
        
        // UI aktualisieren - Multiple Events für Live-Updates
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'ansprechpartner', action: 'added', kampagneId: kampagneId } 
        }));
        // Zusätzliches Event für KampagneList Live-Update
        window.dispatchEvent(new CustomEvent('entityUpdated', { 
          detail: { entity: 'kampagne', action: 'ansprechpartner-added', id: kampagneId } 
        }));
        
        alert('✅ Ansprechpartner wurde erfolgreich zur Kampagne hinzugefügt und wird automatisch angezeigt!');
        console.log('✅ ACTIONSDROPDOWN: Ansprechpartner erfolgreich zu Kampagne hinzugefügt');

      } catch (error) {
        console.error('❌ Fehler beim Hinzufügen des Ansprechpartners:', error);
        alert('Fehler beim Hinzufügen: ' + (error.message || 'Unbekannter Fehler'));
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    };
  }

  // Rechnung-Anpassen-Drawer öffnen
  async openRechnungAnpassenDrawer(auftragId) {
    console.log('📋 ACTIONSDROPDOWN: Öffne Rechnung-Anpassen-Drawer für Auftrag', auftragId);
    
    try {
      const { RechnungAnpassenDrawer } = await import('/src/modules/auftrag/RechnungAnpassenDrawer.js');
      const drawer = new RechnungAnpassenDrawer();
      await drawer.open(auftragId);
    } catch (error) {
      console.error('❌ Fehler beim Öffnen des Rechnung-Anpassen-Drawers:', error);
      alert('Fehler beim Öffnen: ' + (error.message || 'Unbekannter Fehler'));
    }
  }

  // Rechnung PDF herunterladen
  async handleRechnungDownload(rechnungId) {
    console.log('📥 ACTIONSDROPDOWN: Lade Rechnung PDF herunter für ID', rechnungId);
    
    try {
      // Rechnung-Daten direkt von Supabase laden
      const { data: rechnung, error } = await window.supabase
        .from('rechnung')
        .select('id, rechnung_nr, pdf_url')
        .eq('id', rechnungId)
        .single();
      
      if (error) throw error;
      
      if (!rechnung) {
        window.toastSystem?.show('Rechnung nicht gefunden', 'error');
        return;
      }
      
      if (!rechnung.pdf_url) {
        window.toastSystem?.show('Keine PDF für diese Rechnung hinterlegt', 'warning');
        return;
      }
      
      window.toastSystem?.show('Download wird vorbereitet...', 'info');
      
      // PDF als Blob herunterladen für echten Download
      const response = await fetch(rechnung.pdf_url);
      if (!response.ok) throw new Error('PDF konnte nicht geladen werden');
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      // Download-Link erstellen und klicken
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Rechnung_${rechnung.rechnung_nr || rechnungId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Blob URL freigeben
      URL.revokeObjectURL(blobUrl);
      
      window.toastSystem?.show('Download gestartet', 'success');
    } catch (error) {
      console.error('❌ Fehler beim Herunterladen der Rechnung:', error);
      window.toastSystem?.show('Fehler beim Herunterladen: ' + (error.message || 'Unbekannter Fehler'), 'error');
    }
  }

  // Cleanup
  destroy() {
    console.log('🗑️ ACTIONSDROPDOWN: Cleanup');
    this.closeAllDropdowns();
    this.boundEventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this.boundEventListeners.clear();
  }
}

// Singleton-Instanz erstellen
export const actionsDropdown = new ActionsDropdown(); 