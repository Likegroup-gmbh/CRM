// StrategieList.js
// Übersicht aller Strategielisten

import { strategieService } from './StrategieService.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';
import { AvatarBubbles } from '../../core/components/AvatarBubbles.js';

export class StrategieList {
  constructor() {
    this._boundEventListeners = new Set();
    this.pagination = new PaginationSystem();
    this.strategien = [];
  }

  /**
   * Initialisiere Strategien-Liste
   */
  async init() {
    window.setHeadline('Strategien');
    
    // Breadcrumb
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Strategien', url: '/strategie', clickable: false }
      ]);
    }
    
    // Berechtigungsprüfung
    const canView = await this.checkPermission();
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Strategien anzuzeigen.</p>
        </div>
      `;
      return;
    }

    // Pagination initialisieren
    this.pagination.init('pagination-container-strategie', {
      onPageChange: (page) => this.handlePageChange(page)
    });

    await this.loadAndRender();
  }

  /**
   * Berechtigungsprüfung
   */
  async checkPermission() {
    const rolle = window.currentUser?.rolle;
    return rolle === 'admin' || rolle === 'mitarbeiter' || rolle === 'kunde';
  }

  /**
   * Handler für Seiten-Wechsel
   */
  handlePageChange(page) {
    this.pagination.currentPage = page;
    this.loadAndRender();
  }

  /**
   * Lade und rendere Strategien-Liste
   */
  async loadAndRender() {
    // Struktur rendern
    await this.render();
    
    // Events IMMER binden (auch bei Fehler)
    this.bindEvents();
    
    try {
      // Daten laden
      this.strategien = await strategieService.getAllStrategien();
      
      // Pagination
      const { currentPage, itemsPerPage } = this.pagination.getState();
      const start = (currentPage - 1) * itemsPerPage;
      const end = start + itemsPerPage;
      const paginatedData = this.strategien.slice(start, end);
      
      this.pagination.updateTotal(this.strategien.length);
      this.pagination.render();
      
      // Tabelle aktualisieren
      this.updateTable(paginatedData);
      
      // Events erneut binden nach Tabellen-Update
      this.bindEvents();
      
    } catch (error) {
      console.error('Fehler beim Laden der Strategien:', error);
      window.toastSystem?.show('Fehler beim Laden der Strategien', 'error');
      
      // Zeige Fehler in Tabelle
      const tbody = document.getElementById('strategien-table-body');
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: var(--space-lg); color: var(--color-error);">
              Fehler beim Laden der Strategien
            </td>
          </tr>
        `;
      }
    }
  }

  /**
   * Rendere die Seiten-Struktur
   */
  async render() {
    const canCreate = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle === 'mitarbeiter';

    const html = `
      <div class="list-container">
        <div class="list-header">
          <div class="list-header-actions">
            ${canCreate ? `
              <button class="primary-btn" data-action="create-strategie">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px;">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Neue Strategie
              </button>
            ` : ''}
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Unternehmen</th>
                <th>Marke</th>
                <th>Kampagne</th>
                <th>Erstellt von</th>
                <th class="col-actions">Aktionen</th>
              </tr>
            </thead>
            <tbody id="strategien-table-body">
              <tr>
                <td colspan="6" style="text-align: center; padding: var(--space-lg); color: var(--text-secondary);">
                  Lade Strategien...
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div id="pagination-container-strategie"></div>
      </div>
    `;

    window.content.innerHTML = html;
  }

  /**
   * Aktualisiere die Tabelle mit Strategien
   */
  updateTable(strategien) {
    const tbody = document.getElementById('strategien-table-body');
    
    if (!strategien || strategien.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: var(--space-lg); color: var(--text-secondary);">
            Keine Strategien gefunden
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = strategien.map(strategie => {
      // Unternehmen Bubble
      const unternehmenBubble = strategie.unternehmen 
        ? AvatarBubbles.renderBubbles([{
            name: strategie.unternehmen.firmenname,
            type: 'org',
            id: strategie.unternehmen.id,
            entityType: 'unternehmen',
            logo_url: strategie.unternehmen.logo_url
          }])
        : '-';

      // Marke Bubble
      const markeBubble = strategie.marke 
        ? AvatarBubbles.renderBubbles([{
            name: strategie.marke.markenname,
            type: 'org',
            id: strategie.marke.id,
            entityType: 'marke',
            logo_url: strategie.marke.logo_url
          }])
        : '-';

      // Kampagne (kein Bubble, nur Text)
      const kampagneName = strategie.kampagne?.kampagnenname || '-';

      // Erstellt von Bubble
      const createdByBubble = strategie.created_by_user 
        ? AvatarBubbles.renderBubbles([{
            name: strategie.created_by_user.name,
            type: 'person',
            id: strategie.created_by_user.id,
            entityType: 'mitarbeiter',
            profile_image_url: strategie.created_by_user.profile_image_url
          }])
        : '-';

      return `
        <tr class="table-row-clickable" data-strategie-id="${strategie.id}">
          <td><strong>${strategie.name || 'Ohne Namen'}</strong></td>
          <td>${unternehmenBubble}</td>
          <td>${markeBubble}</td>
          <td>${kampagneName}</td>
          <td>${createdByBubble}</td>
          <td class="col-actions">
            <div class="actions-dropdown-container" data-entity-type="strategie">
              <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
              </button>
              <div class="actions-dropdown">
                <a href="#" class="action-item" data-action="view-strategie" data-id="${strategie.id}">
                  ${window.ActionsDropdown?.getHeroIcon('view') || ''}
                  Details anzeigen
                </a>
                ${window.currentUser?.rolle !== 'kunde' ? `
                  <a href="#" class="action-item" data-action="edit-strategie" data-id="${strategie.id}">
                    ${window.ActionsDropdown?.getHeroIcon('edit') || ''}
                    Bearbeiten
                  </a>
                  <div class="action-separator"></div>
                  <a href="#" class="action-item action-danger" data-action="delete-strategie" data-id="${strategie.id}">
                    ${window.ActionsDropdown?.getHeroIcon('delete') || ''}
                    Löschen
                  </a>
                ` : ''}
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');
    
    // Actions Dropdown initialisieren
    if (window.ActionsDropdown) {
      window.ActionsDropdown.init();
    }
  }

  /**
   * Events binden
   */
  bindEvents() {
    // Cleanup alte Events
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();

    // Neue Strategie Button
    const createBtn = document.querySelector('[data-action="create-strategie"]');
    if (createBtn) {
      const handler = () => this.showCreateDialog();
      createBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => createBtn.removeEventListener('click', handler));
    }

    // Zeilen-Klick (Detail öffnen)
    const rows = document.querySelectorAll('.table-row-clickable');
    rows.forEach(row => {
      const handler = (e) => {
        // Ignoriere Klicks auf Actions-Dropdown
        if (e.target.closest('.actions-dropdown-container')) return;
        if (e.target.closest('button')) return;
        if (e.target.closest('a')) return;
        
        const id = row.dataset.strategieId;
        window.navigateTo(`/strategie/${id}`);
      };
      row.addEventListener('click', handler);
      this._boundEventListeners.add(() => row.removeEventListener('click', handler));
    });

    // View Action (im Dropdown)
    document.querySelectorAll('[data-action="view-strategie"]').forEach(btn => {
      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.dataset.id;
        window.navigateTo(`/strategie/${id}`);
      };
      btn.addEventListener('click', handler);
      this._boundEventListeners.add(() => btn.removeEventListener('click', handler));
    });

    // Edit Action (im Dropdown)
    document.querySelectorAll('[data-action="edit-strategie"]').forEach(btn => {
      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.dataset.id;
        this.showEditDialog(id);
      };
      btn.addEventListener('click', handler);
      this._boundEventListeners.add(() => btn.removeEventListener('click', handler));
    });

    // Delete Action (im Dropdown)
    document.querySelectorAll('[data-action="delete-strategie"]').forEach(btn => {
      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.dataset.id;
        this.handleDelete(id);
      };
      btn.addEventListener('click', handler);
      this._boundEventListeners.add(() => btn.removeEventListener('click', handler));
    });
  }

  /**
   * Zeige Erstellen-Drawer
   */
  showCreateDialog() {
    // Entferne bestehenden Drawer
    this.removeDrawer();

    // Drawer Overlay
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'create-strategie-overlay';

    // Drawer Panel
    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = 'create-strategie-drawer';

    // Header
    const header = document.createElement('div');
    header.className = 'drawer-header';
    
    const headerLeft = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'drawer-title';
    title.textContent = 'Neue Strategie';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = 'Erstellen Sie eine neue Strategieliste';
    
    headerLeft.appendChild(title);
    headerLeft.appendChild(subtitle);
    
    const headerRight = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close-btn';
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('aria-label', 'Schließen');
    closeBtn.innerHTML = '&times;';
    headerRight.appendChild(closeBtn);
    
    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    // Body
    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.innerHTML = `
      <form id="create-strategie-form">
        <div class="form-field">
          <label class="form-label">Name *</label>
          <input type="text" id="strategie-name" name="name" required class="form-input" placeholder="z.B. Q1 2025 Content Ideen">
        </div>

        <div class="form-field">
          <label class="form-label">Beschreibung</label>
          <textarea id="strategie-beschreibung" name="beschreibung" class="form-input" rows="3" placeholder="Optional"></textarea>
        </div>

        <div class="form-field tag-based-select">
          <label class="form-label">Unternehmen</label>
          <input type="text" id="as-unternehmen" class="form-input auto-suggest-input" placeholder="Unternehmen suchen..." autocomplete="off">
          <div id="asdd-unternehmen" class="auto-suggest-dropdown"></div>
          <div id="tags-unternehmen" class="tags-container"></div>
        </div>

        <div class="form-field tag-based-select">
          <label class="form-label">Marke</label>
          <input type="text" id="as-marke" class="form-input auto-suggest-input" placeholder="Marke suchen..." autocomplete="off">
          <div id="asdd-marke" class="auto-suggest-dropdown"></div>
          <div id="tags-marke" class="tags-container"></div>
        </div>

        <div class="form-field tag-based-select">
          <label class="form-label">Kampagne</label>
          <input type="text" id="as-kampagne" class="form-input auto-suggest-input" placeholder="Kampagne suchen..." autocomplete="off">
          <div id="asdd-kampagne" class="auto-suggest-dropdown"></div>
          <div id="tags-kampagne" class="tags-container"></div>
        </div>

        <div class="form-field">
          <label class="form-label">Teilbereiche</label>
          <div id="teilbereiche-container">
            <div class="teilbereich-row" data-index="0">
              <input type="text" class="form-input teilbereich-input" name="teilbereich[]" placeholder="z.B. Food, Sport, Leistungssport">
              <button type="button" class="teilbereich-add-btn" title="Weiteren Teilbereich hinzufügen">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px;">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>
          </div>
          <small style="color: var(--text-secondary); font-size: var(--text-xs);">Optional: Kategorisieren Sie Ihre Strategie in mehrere Teilbereiche</small>
        </div>

        <div class="drawer-footer">
          <button type="button" class="secondary-btn" data-action="close-drawer">Abbrechen</button>
          <button type="submit" class="primary-btn">Erstellen</button>
        </div>
      </form>
    `;

    panel.appendChild(header);
    panel.appendChild(body);

    // Event: Overlay-Klick schließt Drawer
    overlay.addEventListener('click', () => this.closeDrawer());
    closeBtn.addEventListener('click', () => this.closeDrawer());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    // Animation - WICHTIG: .show statt .open (siehe components.css)
    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });

    // Lade & binde Auto-Suggestion
    this.setupAutoSuggestion();

    // Teilbereiche dynamisch hinzufügen
    this.setupTeilbereicheEvents();

    // Events binden
    this.bindCreateDialogEvents();
  }

  /**
   * Setup Events für dynamische Teilbereiche
   */
  setupTeilbereicheEvents() {
    const container = document.getElementById('teilbereiche-container');
    if (!container) return;

    let teilbereichIndex = 1;

    // Event Delegation für Add/Remove Buttons
    container.addEventListener('click', (e) => {
      const addBtn = e.target.closest('.teilbereich-add-btn');
      const removeBtn = e.target.closest('.teilbereich-remove-btn');

      if (addBtn) {
        // Neuen Teilbereich hinzufügen
        const newRow = document.createElement('div');
        newRow.className = 'teilbereich-row';
        newRow.dataset.index = teilbereichIndex++;
        newRow.innerHTML = `
          <input type="text" class="form-input teilbereich-input" name="teilbereich[]" placeholder="Weiterer Teilbereich...">
          <button type="button" class="teilbereich-remove-btn" title="Teilbereich entfernen">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        `;
        container.appendChild(newRow);

        // Focus auf neues Input
        newRow.querySelector('input').focus();
      }

      if (removeBtn) {
        // Teilbereich entfernen (aber mindestens einen behalten)
        const rows = container.querySelectorAll('.teilbereich-row');
        if (rows.length > 1) {
          removeBtn.closest('.teilbereich-row').remove();
        }
      }
    });
  }

  /**
   * Setup Auto-Suggestion für Unternehmen, Marke, Kampagne
   * Pattern wie in KundenList.js
   */
  setupAutoSuggestion() {
    // State für ausgewählte Werte
    let selectedUnternehmenId = null;
    let selectedMarkeId = null;
    let selectedKampagneId = null;

    // Helper: Tag erstellen
    const addTag = (containerId, id, label, onRemove) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      
      // Nur ein Tag erlaubt - vorher leeren
      container.innerHTML = '';
      
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.dataset.id = id;
      tag.textContent = label;
      
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'tag-remove';
      closeBtn.innerHTML = '&times;';
      closeBtn.addEventListener('click', () => {
        onRemove();
        tag.remove();
      });
      
      tag.appendChild(closeBtn);
      container.appendChild(tag);
    };

    // Helper: Auto-Suggest binden
    const bindAutoSuggest = (inputId, dropdownId, queryFn, onSelect, renderItem) => {
      const input = document.getElementById(inputId);
      const dropdown = document.getElementById(dropdownId);
      if (!input || !dropdown) return;

      let debounce;
      const renderNoResults = (text) => {
        dropdown.innerHTML = `<div class="dropdown-item no-results">${text}</div>`;
      };

      // Bei Focus: Vorschläge laden
      input.addEventListener('focus', async () => {
        try {
          const rows = await queryFn('');
          dropdown.innerHTML = rows && rows.length 
            ? rows.map(r => renderItem(r)).join('') 
            : '<div class="dropdown-item no-results">Keine Treffer</div>';
          dropdown.classList.add('show');
        } catch (err) {
          renderNoResults('Fehler bei der Suche');
          dropdown.classList.add('show');
        }
      });

      // Bei Blur: Dropdown schließen
      input.addEventListener('blur', () => {
        setTimeout(() => dropdown.classList.remove('show'), 150);
      });

      // Bei Input: Suchen
      input.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(async () => {
          const query = input.value.trim();
          try {
            const rows = await queryFn(query);
            if (!rows || rows.length === 0) {
              renderNoResults('Keine Treffer');
              dropdown.classList.add('show');
              return;
            }
            dropdown.innerHTML = rows.map(r => renderItem(r)).join('');
            dropdown.classList.add('show');
          } catch (err) {
            console.warn('AutoSuggest Fehler:', err);
            renderNoResults('Fehler bei der Suche');
            dropdown.classList.add('show');
          }
        }, 200);
      });

      // Bei Klick auf Item: Auswählen
      dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item[data-id]');
        if (!item) return;
        
        const id = item.dataset.id;
        const label = item.dataset.label;
        onSelect(id, label);
        dropdown.classList.remove('show');
        input.value = '';
      });
    };

    // Unternehmen (single)
    bindAutoSuggest(
      'as-unternehmen', 
      'asdd-unternehmen',
      async (q) => {
        let query = window.supabase
          .from('unternehmen')
          .select('id, firmenname')
          .order('firmenname', { ascending: true })
          .limit(20);
        if (q && q.length > 0) query = query.ilike('firmenname', `%${q}%`);
        const { data } = await query;
        return data || [];
      },
      (id, label) => {
        selectedUnternehmenId = id;
        addTag('tags-unternehmen', id, label, () => { 
          selectedUnternehmenId = null;
        });
        // Marke und Kampagne zurücksetzen
        document.getElementById('tags-marke').innerHTML = '';
        document.getElementById('tags-kampagne').innerHTML = '';
        selectedMarkeId = null;
        selectedKampagneId = null;
      },
      (r) => `<div class="dropdown-item" data-id="${r.id}" data-label="${window.validatorSystem.sanitizeHtml(r.firmenname)}">${window.validatorSystem.sanitizeHtml(r.firmenname)}</div>`
    );

    // Marke (single, gefiltert nach Unternehmen)
    bindAutoSuggest(
      'as-marke',
      'asdd-marke',
      async (q) => {
        let query = window.supabase
          .from('marke')
          .select('id, markenname, unternehmen:unternehmen_id(firmenname)')
          .order('markenname', { ascending: true })
          .limit(20);
        if (q && q.length > 0) query = query.ilike('markenname', `%${q}%`);
        if (selectedUnternehmenId) query = query.eq('unternehmen_id', selectedUnternehmenId);
        const { data } = await query;
        return data || [];
      },
      (id, label) => {
        selectedMarkeId = id;
        addTag('tags-marke', id, label, () => {
          selectedMarkeId = null;
        });
      },
      (r) => {
        const subtitle = r.unternehmen ? ` <span style="color: var(--text-muted); font-size: var(--text-xs);">(${window.validatorSystem.sanitizeHtml(r.unternehmen.firmenname)})</span>` : '';
        return `<div class="dropdown-item" data-id="${r.id}" data-label="${window.validatorSystem.sanitizeHtml(r.markenname)}">${window.validatorSystem.sanitizeHtml(r.markenname)}${subtitle}</div>`;
      }
    );

    // Kampagne (single, gefiltert nach Marke)
    bindAutoSuggest(
      'as-kampagne',
      'asdd-kampagne',
      async (q) => {
        let query = window.supabase
          .from('kampagne')
          .select('id, kampagnenname, marke:marke_id(markenname)')
          .order('kampagnenname', { ascending: true })
          .limit(20);
        if (q && q.length > 0) query = query.ilike('kampagnenname', `%${q}%`);
        if (selectedMarkeId) query = query.eq('marke_id', selectedMarkeId);
        const { data } = await query;
        return data || [];
      },
      (id, label) => {
        selectedKampagneId = id;
        addTag('tags-kampagne', id, label, () => {
          selectedKampagneId = null;
        });
      },
      (r) => {
        const subtitle = r.marke ? ` <span style="color: var(--text-muted); font-size: var(--text-xs);">(${window.validatorSystem.sanitizeHtml(r.marke.markenname)})</span>` : '';
        return `<div class="dropdown-item" data-id="${r.id}" data-label="${window.validatorSystem.sanitizeHtml(r.kampagnenname)}">${window.validatorSystem.sanitizeHtml(r.kampagnenname)}${subtitle}</div>`;
      }
    );

    // State für Form-Submit verfügbar machen
    this._selectedUnternehmenId = () => selectedUnternehmenId;
    this._selectedMarkeId = () => selectedMarkeId;
    this._selectedKampagneId = () => selectedKampagneId;
  }

  /**
   * Drawer entfernen
   */
  removeDrawer() {
    // Create Drawer
    const createOverlay = document.getElementById('create-strategie-overlay');
    const createPanel = document.getElementById('create-strategie-drawer');
    if (createOverlay) createOverlay.remove();
    if (createPanel) createPanel.remove();
    
    // Edit Drawer
    const editOverlay = document.getElementById('edit-strategie-overlay');
    const editPanel = document.getElementById('edit-strategie-drawer');
    if (editOverlay) editOverlay.remove();
    if (editPanel) editPanel.remove();
  }

  /**
   * Drawer schließen
   */
  closeDrawer() {
    const createOverlay = document.getElementById('create-strategie-overlay');
    const createPanel = document.getElementById('create-strategie-drawer');
    const editOverlay = document.getElementById('edit-strategie-overlay');
    const editPanel = document.getElementById('edit-strategie-drawer');
    
    if (createOverlay) createOverlay.classList.remove('active');
    if (createPanel) createPanel.classList.remove('show');
    if (editOverlay) editOverlay.classList.remove('active');
    if (editPanel) editPanel.classList.remove('show');
    
    setTimeout(() => {
      this.removeDrawer();
    }, 300);
  }

  /**
   * Zeige Bearbeiten-Drawer
   */
  async showEditDialog(strategieId) {
    // Strategie laden
    const strategie = this.strategien.find(s => s.id === strategieId);
    if (!strategie) {
      window.toastSystem?.show('Strategie nicht gefunden', 'error');
      return;
    }

    // Entferne bestehenden Drawer
    this.removeDrawer();

    // Drawer Overlay
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'edit-strategie-overlay';

    // Drawer Panel
    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = 'edit-strategie-drawer';

    // Header
    const header = document.createElement('div');
    header.className = 'drawer-header';
    
    const headerLeft = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'drawer-title';
    title.textContent = 'Strategie bearbeiten';
    
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = strategie.name;
    
    headerLeft.appendChild(title);
    headerLeft.appendChild(subtitle);
    
    const headerRight = document.createElement('div');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close-btn';
    closeBtn.setAttribute('type', 'button');
    closeBtn.setAttribute('aria-label', 'Schließen');
    closeBtn.innerHTML = '&times;';
    headerRight.appendChild(closeBtn);
    
    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    // Teilbereiche als einzelne Inputs vorbereiten
    const teilbereiche = strategie.teilbereich ? strategie.teilbereich.split(',').map(t => t.trim()).filter(t => t) : [];
    const teilbereicheHTML = teilbereiche.length > 0 
      ? teilbereiche.map((tb, idx) => `
          <div class="teilbereich-row" data-index="${idx}">
            <input type="text" class="form-input teilbereich-input" name="teilbereich[]" value="${tb}" placeholder="Teilbereich...">
            ${idx === 0 ? `
              <button type="button" class="teilbereich-add-btn" title="Weiteren Teilbereich hinzufügen">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px;">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            ` : `
              <button type="button" class="teilbereich-remove-btn" title="Teilbereich entfernen">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px;">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            `}
          </div>
        `).join('')
      : `
          <div class="teilbereich-row" data-index="0">
            <input type="text" class="form-input teilbereich-input" name="teilbereich[]" placeholder="z.B. Food, Sport, Leistungssport">
            <button type="button" class="teilbereich-add-btn" title="Weiteren Teilbereich hinzufügen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
        `;

    // Body
    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.innerHTML = `
      <form id="edit-strategie-form" data-strategie-id="${strategie.id}">
        <div class="form-field">
          <label class="form-label">Name *</label>
          <input type="text" id="edit-strategie-name" name="name" required class="form-input" value="${strategie.name || ''}" placeholder="z.B. Q1 2025 Content Ideen">
        </div>

        <div class="form-field">
          <label class="form-label">Beschreibung</label>
          <textarea id="edit-strategie-beschreibung" name="beschreibung" class="form-input" rows="3" placeholder="Optional">${strategie.beschreibung || ''}</textarea>
        </div>

        <div class="form-field tag-based-select">
          <label class="form-label">Unternehmen</label>
          <input type="text" id="edit-as-unternehmen" class="form-input auto-suggest-input" placeholder="Unternehmen suchen..." autocomplete="off">
          <div id="edit-asdd-unternehmen" class="auto-suggest-dropdown"></div>
          <div id="edit-tags-unternehmen" class="tags-container"></div>
        </div>

        <div class="form-field tag-based-select">
          <label class="form-label">Marke</label>
          <input type="text" id="edit-as-marke" class="form-input auto-suggest-input" placeholder="Marke suchen..." autocomplete="off">
          <div id="edit-asdd-marke" class="auto-suggest-dropdown"></div>
          <div id="edit-tags-marke" class="tags-container"></div>
        </div>

        <div class="form-field tag-based-select">
          <label class="form-label">Kampagne</label>
          <input type="text" id="edit-as-kampagne" class="form-input auto-suggest-input" placeholder="Kampagne suchen..." autocomplete="off">
          <div id="edit-asdd-kampagne" class="auto-suggest-dropdown"></div>
          <div id="edit-tags-kampagne" class="tags-container"></div>
        </div>

        <div class="form-field">
          <label class="form-label">Teilbereiche</label>
          <div id="edit-teilbereiche-container">
            ${teilbereicheHTML}
          </div>
          <small style="color: var(--text-secondary); font-size: var(--text-xs);">Optional: Kategorisieren Sie Ihre Strategie in mehrere Teilbereiche</small>
        </div>

        <div class="drawer-footer">
          <button type="button" class="secondary-btn" data-action="close-drawer">Abbrechen</button>
          <button type="submit" class="primary-btn">Speichern</button>
        </div>
      </form>
    `;

    panel.appendChild(header);
    panel.appendChild(body);

    // Event: Overlay-Klick schließt Drawer
    overlay.addEventListener('click', () => this.closeDrawer());
    closeBtn.addEventListener('click', () => this.closeDrawer());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    // Animation
    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });

    // Auto-Suggestion setup mit bestehenden Werten
    this.setupEditAutoSuggestion(strategie);

    // Teilbereiche Events
    this.setupEditTeilbereicheEvents();

    // Form Events
    this.bindEditDialogEvents(strategie.id);
  }

  /**
   * Setup Auto-Suggestion für Edit-Dialog
   */
  setupEditAutoSuggestion(strategie) {
    let selectedUnternehmenId = strategie.unternehmen_id || null;
    let selectedMarkeId = strategie.marke_id || null;
    let selectedKampagneId = strategie.kampagne_id || null;

    // Helper: Tag erstellen
    const addTag = (containerId, id, label, onRemove) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = '';
      
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.dataset.id = id;
      tag.innerHTML = `
        ${label}
        <button type="button" class="tag-remove" aria-label="Entfernen">&times;</button>
      `;
      tag.querySelector('.tag-remove').addEventListener('click', () => {
        tag.remove();
        onRemove();
      });
      container.appendChild(tag);
    };

    // Bestehende Tags setzen
    if (strategie.unternehmen) {
      addTag('edit-tags-unternehmen', strategie.unternehmen.id, strategie.unternehmen.firmenname, () => { selectedUnternehmenId = null; });
    }
    if (strategie.marke) {
      addTag('edit-tags-marke', strategie.marke.id, strategie.marke.markenname, () => { selectedMarkeId = null; });
    }
    if (strategie.kampagne) {
      addTag('edit-tags-kampagne', strategie.kampagne.id, strategie.kampagne.kampagnenname, () => { selectedKampagneId = null; });
    }

    // Unternehmen Auto-Suggest
    const unternehmenInput = document.getElementById('edit-as-unternehmen');
    const unternehmenDropdown = document.getElementById('edit-asdd-unternehmen');
    
    if (unternehmenInput && unternehmenDropdown) {
      let debounceTimer;
      unternehmenInput.addEventListener('input', async () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const searchTerm = unternehmenInput.value.trim();
          if (searchTerm.length < 2) {
            unternehmenDropdown.innerHTML = '';
            unternehmenDropdown.style.display = 'none';
            return;
          }
          
          const results = await strategieService.getAllUnternehmen();
          const filtered = results.filter(u => u.firmenname.toLowerCase().includes(searchTerm.toLowerCase()));
          
          if (filtered.length === 0) {
            unternehmenDropdown.innerHTML = '<div class="auto-suggest-item">Keine Ergebnisse</div>';
          } else {
            unternehmenDropdown.innerHTML = filtered.map(u => 
              `<div class="auto-suggest-item" data-id="${u.id}" data-name="${u.firmenname}">${u.firmenname}</div>`
            ).join('');
          }
          unternehmenDropdown.style.display = 'block';
          
          unternehmenDropdown.querySelectorAll('.auto-suggest-item[data-id]').forEach(item => {
            item.addEventListener('click', () => {
              selectedUnternehmenId = item.dataset.id;
              addTag('edit-tags-unternehmen', item.dataset.id, item.dataset.name, () => { selectedUnternehmenId = null; });
              unternehmenInput.value = '';
              unternehmenDropdown.style.display = 'none';
            });
          });
        }, 300);
      });
    }

    // Marke Auto-Suggest
    const markeInput = document.getElementById('edit-as-marke');
    const markeDropdown = document.getElementById('edit-asdd-marke');
    
    if (markeInput && markeDropdown) {
      let debounceTimer;
      markeInput.addEventListener('input', async () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const searchTerm = markeInput.value.trim();
          if (searchTerm.length < 2) {
            markeDropdown.innerHTML = '';
            markeDropdown.style.display = 'none';
            return;
          }
          
          const results = await strategieService.getAllMarken();
          const filtered = results.filter(m => m.markenname.toLowerCase().includes(searchTerm.toLowerCase()));
          
          if (filtered.length === 0) {
            markeDropdown.innerHTML = '<div class="auto-suggest-item">Keine Ergebnisse</div>';
          } else {
            markeDropdown.innerHTML = filtered.map(m => 
              `<div class="auto-suggest-item" data-id="${m.id}" data-name="${m.markenname}">${m.markenname}</div>`
            ).join('');
          }
          markeDropdown.style.display = 'block';
          
          markeDropdown.querySelectorAll('.auto-suggest-item[data-id]').forEach(item => {
            item.addEventListener('click', () => {
              selectedMarkeId = item.dataset.id;
              addTag('edit-tags-marke', item.dataset.id, item.dataset.name, () => { selectedMarkeId = null; });
              markeInput.value = '';
              markeDropdown.style.display = 'none';
            });
          });
        }, 300);
      });
    }

    // Kampagne Auto-Suggest
    const kampagneInput = document.getElementById('edit-as-kampagne');
    const kampagneDropdown = document.getElementById('edit-asdd-kampagne');
    
    if (kampagneInput && kampagneDropdown) {
      let debounceTimer;
      kampagneInput.addEventListener('input', async () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const searchTerm = kampagneInput.value.trim();
          if (searchTerm.length < 2) {
            kampagneDropdown.innerHTML = '';
            kampagneDropdown.style.display = 'none';
            return;
          }
          
          const results = await strategieService.getAllKampagnen();
          const filtered = results.filter(k => k.kampagnenname.toLowerCase().includes(searchTerm.toLowerCase()));
          
          if (filtered.length === 0) {
            kampagneDropdown.innerHTML = '<div class="auto-suggest-item">Keine Ergebnisse</div>';
          } else {
            kampagneDropdown.innerHTML = filtered.map(k => 
              `<div class="auto-suggest-item" data-id="${k.id}" data-name="${k.kampagnenname}">${k.kampagnenname}</div>`
            ).join('');
          }
          kampagneDropdown.style.display = 'block';
          
          kampagneDropdown.querySelectorAll('.auto-suggest-item[data-id]').forEach(item => {
            item.addEventListener('click', () => {
              selectedKampagneId = item.dataset.id;
              addTag('edit-tags-kampagne', item.dataset.id, item.dataset.name, () => { selectedKampagneId = null; });
              kampagneInput.value = '';
              kampagneDropdown.style.display = 'none';
            });
          });
        }, 300);
      });
    }
  }

  /**
   * Setup Events für dynamische Teilbereiche im Edit-Dialog
   */
  setupEditTeilbereicheEvents() {
    const container = document.getElementById('edit-teilbereiche-container');
    if (!container) return;

    let teilbereichIndex = container.querySelectorAll('.teilbereich-row').length;

    container.addEventListener('click', (e) => {
      const addBtn = e.target.closest('.teilbereich-add-btn');
      const removeBtn = e.target.closest('.teilbereich-remove-btn');

      if (addBtn) {
        const newRow = document.createElement('div');
        newRow.className = 'teilbereich-row';
        newRow.dataset.index = teilbereichIndex++;
        newRow.innerHTML = `
          <input type="text" class="form-input teilbereich-input" name="teilbereich[]" placeholder="Weiterer Teilbereich...">
          <button type="button" class="teilbereich-remove-btn" title="Teilbereich entfernen">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        `;
        container.appendChild(newRow);
        newRow.querySelector('input').focus();
      }

      if (removeBtn) {
        const rows = container.querySelectorAll('.teilbereich-row');
        if (rows.length > 1) {
          removeBtn.closest('.teilbereich-row').remove();
        }
      }
    });
  }

  /**
   * Binde Events für Bearbeiten-Drawer
   */
  bindEditDialogEvents(strategieId) {
    const drawer = document.getElementById('edit-strategie-drawer');
    const form = document.getElementById('edit-strategie-form');

    if (!drawer || !form) return;

    // Close button
    drawer.querySelectorAll('[data-action="close-drawer"]').forEach(btn => {
      btn.addEventListener('click', () => this.closeDrawer());
    });

    // Form Submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn?.innerHTML;
      
      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = 'Speichern...';
        }

        const formData = new FormData(form);
        
        // Teilbereiche sammeln
        const teilbereiche = formData.getAll('teilbereich[]')
          .map(t => t.trim())
          .filter(t => t.length > 0);
        
        // IDs aus Tags holen
        const unternehmenTag = document.querySelector('#edit-tags-unternehmen .tag');
        const markeTag = document.querySelector('#edit-tags-marke .tag');
        const kampagneTag = document.querySelector('#edit-tags-kampagne .tag');
        
        const data = {
          name: formData.get('name'),
          beschreibung: formData.get('beschreibung') || null,
          unternehmen_id: unternehmenTag?.dataset.id || null,
          marke_id: markeTag?.dataset.id || null,
          kampagne_id: kampagneTag?.dataset.id || null,
          teilbereich: teilbereiche.length > 0 ? teilbereiche.join(', ') : null
        };

        // Validierung: Mindestens eine Verknüpfung
        if (!data.unternehmen_id && !data.marke_id && !data.kampagne_id) {
          window.toastSystem?.show('Bitte wählen Sie mindestens ein Unternehmen, eine Marke oder eine Kampagne aus', 'error');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
          }
          return;
        }

        await strategieService.updateStrategie(strategieId, data);
        window.toastSystem?.show('Strategie erfolgreich aktualisiert', 'success');
        this.closeDrawer();
        
        // Liste neu laden
        await this.loadAndRender();
        
      } catch (error) {
        console.error('Fehler beim Aktualisieren der Strategie:', error);
        window.toastSystem?.show('Fehler beim Aktualisieren der Strategie', 'error');
        
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      }
    });
  }

  /**
   * Binde Events für Erstellen-Drawer
   */
  bindCreateDialogEvents() {
    const drawer = document.getElementById('create-strategie-drawer');
    const form = document.getElementById('create-strategie-form');

    if (!drawer || !form) return;

    // Close button
    drawer.querySelectorAll('[data-action="close-drawer"]').forEach(btn => {
      btn.addEventListener('click', () => this.closeDrawer());
    });

    // Form Submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(form);
      
      // Teilbereiche sammeln (mehrere Werte)
      const teilbereiche = formData.getAll('teilbereich[]')
        .map(t => t.trim())
        .filter(t => t.length > 0);
      
      // IDs aus Tags holen
      const unternehmenTag = document.querySelector('#tags-unternehmen .tag');
      const markeTag = document.querySelector('#tags-marke .tag');
      const kampagneTag = document.querySelector('#tags-kampagne .tag');
      
      const data = {
        name: formData.get('name'),
        beschreibung: formData.get('beschreibung') || null,
        unternehmen_id: unternehmenTag?.dataset.id || null,
        marke_id: markeTag?.dataset.id || null,
        kampagne_id: kampagneTag?.dataset.id || null,
        teilbereich: teilbereiche.length > 0 ? teilbereiche.join(', ') : null
      };

      // Validierung: Mindestens eine Verknüpfung
      if (!data.unternehmen_id && !data.marke_id && !data.kampagne_id) {
        window.toastSystem?.show('Bitte wählen Sie mindestens ein Unternehmen, eine Marke oder eine Kampagne aus', 'error');
        return;
      }

      try {
        const strategie = await strategieService.createStrategie(data);
        window.toastSystem?.show('Strategie erfolgreich erstellt', 'success');
        this.closeDrawer();
        
        // Zur Detail-Seite navigieren
        window.navigateTo(`/strategie/${strategie.id}`);
      } catch (error) {
        console.error('Fehler beim Erstellen der Strategie:', error);
        window.toastSystem?.show('Fehler beim Erstellen der Strategie', 'error');
      }
    });
  }

  /**
   * Strategie löschen
   */
  async handleDelete(id) {
    const result = await window.confirmationModal?.open({
      title: 'Strategie löschen?',
      message: 'Möchten Sie diese Strategie wirklich löschen? Alle zugehörigen Items werden ebenfalls gelöscht.',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true
    });

    if (!result?.confirmed) return;

    try {
      await strategieService.deleteStrategie(id);
      window.toastSystem?.show('Strategie erfolgreich gelöscht', 'success');
      await this.loadAndRender();
    } catch (error) {
      console.error('Fehler beim Löschen der Strategie:', error);
      window.toastSystem?.show('Fehler beim Löschen der Strategie', 'error');
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();
    
    this.removeDrawer();
  }
}

// Singleton-Instanz exportieren
export const strategieList = new StrategieList();

