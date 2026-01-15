// CreatorAuswahlList.js
// Übersicht aller Creator-Auswahl-Listen

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';
import { AvatarBubbles } from '../../core/components/AvatarBubbles.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { AutoGeneration } from '../../core/form/logic/AutoGeneration.js';

export class CreatorAuswahlList {
  constructor() {
    this._boundEventListeners = new Set();
    this.pagination = new PaginationSystem();
    this.listen = [];
    this.autoGeneration = new AutoGeneration();
  }

  /**
   * Initialisiere Liste
   */
  async init() {
    window.setHeadline('Creator-Auswahl');
    
    // Breadcrumb
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Creator-Auswahl', url: '/creator-auswahl', clickable: false }
      ]);
    }
    
    // Berechtigungsprüfung
    const canView = await this.checkPermission();
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Creator-Auswahl-Listen anzuzeigen.</p>
        </div>
      `;
      return;
    }

    // Pagination initialisieren
    this.pagination.init('pagination-container-creator-auswahl', {
      onPageChange: (page) => this.handlePageChange(page)
    });

    await this.loadAndRender();
  }

  /**
   * Berechtigungsprüfung
   */
  async checkPermission() {
    if (window.currentUser?.rolle === 'admin') return true;
    return window.currentUser?.permissions?.kampagne?.can_view || false;
  }

  handlePageChange(page) {
    this.pagination.currentPage = page;
    this.loadAndRender();
  }

  /**
   * Lade und rendere Liste
   */
  async loadAndRender() {
    await this.render();
    this.bindEvents();
    
    try {
      this.listen = await creatorAuswahlService.getAllListen();
      
      const { currentPage, itemsPerPage } = this.pagination.getState();
      const start = (currentPage - 1) * itemsPerPage;
      const end = start + itemsPerPage;
      const paginatedData = this.listen.slice(start, end);
      
      this.pagination.updateTotal(this.listen.length);
      this.pagination.render();
      
      await this.updateTable(paginatedData);
      this.bindEvents();
      
    } catch (error) {
      console.error('Fehler beim Laden der Listen:', error);
      window.toastSystem?.show('Fehler beim Laden der Creator-Auswahl-Listen', 'error');
      
      const tbody = document.getElementById('creator-auswahl-table-body');
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="table-state-cell table-state-cell--error">
              Fehler beim Laden der Listen
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
    const rolle = window.currentUser?.rolle?.toLowerCase();
    const isKunde = rolle === 'kunde' || rolle === 'kunde_editor';
    const canCreate = !isKunde && (rolle === 'admin' || window.currentUser?.permissions?.kampagne?.can_edit);

    const html = `
      <div class="list-container">
        <div class="table-filter-wrapper">
          <div class="filter-bar">
            <div class="filter-left">
              <div id="filter-dropdown-container"></div>
            </div>
          </div>
          <div class="table-actions">
            ${canCreate ? `
              <button class="primary-btn" data-action="create-liste">Neue Creator-Auswahl</button>
            ` : ''}
          </div>
        </div>

        <div class="table-container table-container--creator-auswahl-list">
          <table class="data-table data-table--creator-auswahl-list">
            <thead>
              <tr>
                <th class="ca-col-name">Name</th>
                <th class="ca-col-unternehmen">Unternehmen</th>
                <th class="ca-col-marke">Marke</th>
                <th>Kampagne</th>
                <th class="col-actions">Aktionen</th>
              </tr>
            </thead>
            <tbody id="creator-auswahl-table-body">
              <tr>
                <td colspan="5" class="table-state-cell">
                  Lade Creator-Auswahl-Listen...
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div id="pagination-container-creator-auswahl"></div>
      </div>
    `;

    window.content.innerHTML = html;
  }

  /**
   * Aktualisiere die Tabelle
   */
  async updateTable(listen) {
    const tbody = document.getElementById('creator-auswahl-table-body');
    if (!tbody) return;
    
    const rolle = window.currentUser?.rolle?.toLowerCase();
    const isKunde = rolle === 'kunde' || rolle === 'kunde_editor';

    await TableAnimationHelper.animatedUpdate(tbody, () => {
      if (!listen || listen.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" class="table-state-cell">
              Keine Creator-Auswahl-Listen gefunden
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = listen.map(liste => {
        const unternehmenBubble = liste.unternehmen 
          ? AvatarBubbles.renderBubbles([{
              name: liste.unternehmen.firmenname,
              type: 'org',
              id: liste.unternehmen.id,
              entityType: 'unternehmen',
              logo_url: liste.unternehmen.logo_url
            }])
          : '-';

        const markeBubble = liste.marke 
          ? AvatarBubbles.renderBubbles([{
              name: liste.marke.markenname,
              type: 'org',
              id: liste.marke.id,
              entityType: 'marke',
              logo_url: liste.marke.logo_url
            }])
          : '-';

        const kampagneName = liste.kampagne?.kampagnenname || '-';

        return `
          <tr class="table-row-clickable" data-liste-id="${liste.id}">
            <td class="ca-col-name">${liste.name || 'Ohne Namen'}</td>
            <td class="ca-col-unternehmen">${unternehmenBubble}</td>
            <td class="ca-col-marke">${markeBubble}</td>
            <td>${kampagneName}</td>
            <td class="col-actions">
              <div class="actions-dropdown-container" data-entity-type="creator-auswahl">
                <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                  </svg>
                </button>
                <div class="actions-dropdown">
                  <a href="#" class="action-item" data-action="view-liste" data-id="${liste.id}">
                    ${window.ActionsDropdown?.getHeroIcon('view') || ''}
                    Details anzeigen
                  </a>
                  ${!isKunde ? `
                    <a href="#" class="action-item" data-action="edit-liste" data-id="${liste.id}">
                      ${window.ActionsDropdown?.getHeroIcon('edit') || ''}
                      Bearbeiten
                    </a>
                    ${rolle === 'admin' ? `
                      <div class="action-separator"></div>
                      <a href="#" class="action-item action-danger" data-action="delete-liste" data-id="${liste.id}">
                        ${window.ActionsDropdown?.getHeroIcon('delete') || ''}
                        Löschen
                      </a>
                    ` : ''}
                  ` : ''}
                </div>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    });
    
    if (window.ActionsDropdown) {
      window.ActionsDropdown.init();
    }
  }

  /**
   * Events binden
   */
  bindEvents() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();

    // Neue Liste Button
    const createBtn = document.querySelector('[data-action="create-liste"]');
    if (createBtn) {
      const handler = () => this.showCreateDialog();
      createBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => createBtn.removeEventListener('click', handler));
    }

    // Zeilen-Klick
    const rows = document.querySelectorAll('.table-row-clickable');
    rows.forEach(row => {
      const handler = (e) => {
        if (e.target.closest('.actions-dropdown-container')) return;
        if (e.target.closest('button')) return;
        if (e.target.closest('a')) return;
        
        const id = row.dataset.listeId;
        window.navigateTo(`/creator-auswahl/${id}`);
      };
      row.addEventListener('click', handler);
      this._boundEventListeners.add(() => row.removeEventListener('click', handler));
    });

    // View Action
    document.querySelectorAll('[data-action="view-liste"]').forEach(btn => {
      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.navigateTo(`/creator-auswahl/${btn.dataset.id}`);
      };
      btn.addEventListener('click', handler);
      this._boundEventListeners.add(() => btn.removeEventListener('click', handler));
    });

    // Edit Action
    document.querySelectorAll('[data-action="edit-liste"]').forEach(btn => {
      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showEditDialog(btn.dataset.id);
      };
      btn.addEventListener('click', handler);
      this._boundEventListeners.add(() => btn.removeEventListener('click', handler));
    });

    // Delete Action
    document.querySelectorAll('[data-action="delete-liste"]').forEach(btn => {
      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleDelete(btn.dataset.id);
      };
      btn.addEventListener('click', handler);
      this._boundEventListeners.add(() => btn.removeEventListener('click', handler));
    });
  }

  /**
   * Zeige Erstellen-Drawer
   */
  showCreateDialog() {
    this.removeDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'create-liste-overlay';

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = 'create-liste-drawer';

    const header = document.createElement('div');
    header.className = 'drawer-header';
    header.innerHTML = `
      <div>
        <span class="drawer-title">Neue Creator-Auswahl</span>
        <p class="drawer-subtitle">Erstellen Sie eine neue Creator-Auswahl-Liste</p>
      </div>
      <div>
        <button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.innerHTML = `
      <form id="create-liste-form">
        <input type="hidden" id="liste-name" name="name" value="">

        <div class="form-field">
          <label class="form-label">Beschreibung</label>
          <textarea id="liste-beschreibung" name="beschreibung" class="form-input" rows="3" placeholder="Optional"></textarea>
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

        <div class="drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close-drawer">
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button type="submit" class="mdc-btn mdc-btn--create">
            <span class="mdc-btn__label">Erstellen</span>
          </button>
        </div>
      </form>
    `;

    panel.appendChild(header);
    panel.appendChild(body);

    overlay.addEventListener('click', () => this.closeDrawer());
    header.querySelector('.drawer-close-btn').addEventListener('click', () => this.closeDrawer());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });

    this.setupAutoSuggestion();
    this.bindCreateDialogEvents();
  }

  /**
   * Setup Auto-Suggestion
   */
  setupAutoSuggestion() {
    let selectedUnternehmenId = null;
    let selectedMarkeId = null;
    let selectedKampagneId = null;

    const addTag = (containerId, id, label, onRemove) => {
      const container = document.getElementById(containerId);
      if (!container) return;
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

    const bindAutoSuggest = (inputId, dropdownId, queryFn, onSelect, renderItem) => {
      const input = document.getElementById(inputId);
      const dropdown = document.getElementById(dropdownId);
      if (!input || !dropdown) return;

      let debounce;

      input.addEventListener('focus', async () => {
        try {
          const rows = await queryFn('');
          dropdown.innerHTML = rows?.length 
            ? rows.map(r => renderItem(r)).join('') 
            : '<div class="dropdown-item no-results">Keine Treffer</div>';
          dropdown.classList.add('show');
        } catch (err) {
          dropdown.innerHTML = '<div class="dropdown-item no-results">Fehler</div>';
          dropdown.classList.add('show');
        }
      });

      input.addEventListener('blur', () => {
        setTimeout(() => dropdown.classList.remove('show'), 150);
      });

      input.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(async () => {
          const query = input.value.trim();
          try {
            const rows = await queryFn(query);
            dropdown.innerHTML = rows?.length 
              ? rows.map(r => renderItem(r)).join('') 
              : '<div class="dropdown-item no-results">Keine Treffer</div>';
            dropdown.classList.add('show');
          } catch (err) {
            dropdown.innerHTML = '<div class="dropdown-item no-results">Fehler</div>';
            dropdown.classList.add('show');
          }
        }, 200);
      });

      dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item[data-id]');
        if (!item) return;
        onSelect(item.dataset.id, item.dataset.label);
        dropdown.classList.remove('show');
        input.value = '';
      });
    };

    // Unternehmen - gefiltert nach Mitarbeiter-Zuordnungen
    bindAutoSuggest(
      'as-unternehmen', 
      'asdd-unternehmen',
      async (q) => {
        const allowedIds = await window.getAllowedUnternehmenIds?.();
        let query = window.supabase.from('unternehmen').select('id, firmenname').order('firmenname').limit(20);
        if (allowedIds !== null) {
          if (allowedIds.length === 0) return [];
          query = query.in('id', allowedIds);
        }
        if (q) query = query.ilike('firmenname', `%${q}%`);
        const { data } = await query;
        return data || [];
      },
      (id, label) => {
        selectedUnternehmenId = id;
        addTag('tags-unternehmen', id, label, () => { selectedUnternehmenId = null; });
        document.getElementById('tags-marke').innerHTML = '';
        document.getElementById('tags-kampagne').innerHTML = '';
        selectedMarkeId = null;
        selectedKampagneId = null;
      },
      (r) => `<div class="dropdown-item" data-id="${r.id}" data-label="${r.firmenname}">${r.firmenname}</div>`
    );

    // Marke - gefiltert nach Mitarbeiter-Zuordnungen
    bindAutoSuggest(
      'as-marke',
      'asdd-marke',
      async (q) => {
        const allowedMarkenIds = await window.getAllowedMarkenIds?.();
        let query = window.supabase.from('marke').select('id, markenname').order('markenname').limit(20);
        if (allowedMarkenIds !== null) {
          if (allowedMarkenIds.length === 0) return [];
          query = query.in('id', allowedMarkenIds);
        }
        if (q) query = query.ilike('markenname', `%${q}%`);
        if (selectedUnternehmenId) query = query.eq('unternehmen_id', selectedUnternehmenId);
        const { data } = await query;
        return data || [];
      },
      (id, label) => {
        selectedMarkeId = id;
        addTag('tags-marke', id, label, () => { selectedMarkeId = null; });
      },
      (r) => `<div class="dropdown-item" data-id="${r.id}" data-label="${r.markenname}">${r.markenname}</div>`
    );

    // Kampagne
    bindAutoSuggest(
      'as-kampagne',
      'asdd-kampagne',
      async (q) => {
        let query = window.supabase.from('kampagne').select('id, kampagnenname').order('kampagnenname').limit(20);
        if (q) query = query.ilike('kampagnenname', `%${q}%`);
        if (selectedMarkeId) query = query.eq('marke_id', selectedMarkeId);
        const { data } = await query;
        return data || [];
      },
      (id, label) => {
        selectedKampagneId = id;
        addTag('tags-kampagne', id, label, () => { selectedKampagneId = null; });
        
        // Auto-Generierung des Sourcing-Namens
        const nameInput = document.getElementById('liste-name');
        if (nameInput && label) {
          const sourcingName = this.autoGeneration.autoGenerateSourcingName(label);
          if (sourcingName) {
            nameInput.value = sourcingName;
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      },
      (r) => `<div class="dropdown-item" data-id="${r.id}" data-label="${r.kampagnenname}">${r.kampagnenname}</div>`
    );
  }

  /**
   * Binde Events für Erstellen-Drawer
   */
  bindCreateDialogEvents() {
    const drawer = document.getElementById('create-liste-drawer');
    const form = document.getElementById('create-liste-form');
    if (!drawer || !form) return;

    drawer.querySelectorAll('[data-action="close-drawer"]').forEach(btn => {
      btn.addEventListener('click', () => this.closeDrawer());
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(form);
      const unternehmenTag = document.querySelector('#tags-unternehmen .tag');
      const markeTag = document.querySelector('#tags-marke .tag');
      const kampagneTag = document.querySelector('#tags-kampagne .tag');
      
      const data = {
        name: formData.get('name'),
        beschreibung: formData.get('beschreibung') || null,
        unternehmen_id: unternehmenTag?.dataset.id || null,
        marke_id: markeTag?.dataset.id || null,
        kampagne_id: kampagneTag?.dataset.id || null
      };

      if (!data.unternehmen_id && !data.marke_id && !data.kampagne_id) {
        window.toastSystem?.show('Bitte wählen Sie mindestens ein Unternehmen, eine Marke oder eine Kampagne aus', 'error');
        return;
      }

      try {
        const liste = await creatorAuswahlService.createListe(data);
        window.toastSystem?.show('Creator-Auswahl erfolgreich erstellt', 'success');
        this.closeDrawer();
        window.navigateTo(`/creator-auswahl/${liste.id}`);
      } catch (error) {
        console.error('Fehler beim Erstellen:', error);
        window.toastSystem?.show('Fehler beim Erstellen der Creator-Auswahl', 'error');
      }
    });
  }

  /**
   * Zeige Bearbeiten-Drawer
   */
  async showEditDialog(listeId) {
    const liste = this.listen.find(l => l.id === listeId);
    if (!liste) {
      window.toastSystem?.show('Liste nicht gefunden', 'error');
      return;
    }

    this.removeDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'edit-liste-overlay';

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = 'edit-liste-drawer';

    const header = document.createElement('div');
    header.className = 'drawer-header';
    header.innerHTML = `
      <div>
        <span class="drawer-title">Creator-Auswahl bearbeiten</span>
        <p class="drawer-subtitle">${liste.name}</p>
      </div>
      <div>
        <button class="drawer-close-btn" type="button" aria-label="Schließen">&times;</button>
      </div>
    `;

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.innerHTML = `
      <form id="edit-liste-form" data-liste-id="${liste.id}">
        <input type="hidden" name="name" value="${liste.name || ''}">

        <div class="form-field">
          <label class="form-label">Beschreibung</label>
          <textarea name="beschreibung" class="form-input" rows="3">${liste.beschreibung || ''}</textarea>
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

        <div class="drawer-footer">
          <button type="button" class="mdc-btn mdc-btn--cancel" data-action="close-drawer">
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button type="submit" class="mdc-btn mdc-btn--create">
            <span class="mdc-btn__label">Speichern</span>
          </button>
        </div>
      </form>
    `;

    panel.appendChild(header);
    panel.appendChild(body);

    overlay.addEventListener('click', () => this.closeDrawer());
    header.querySelector('.drawer-close-btn').addEventListener('click', () => this.closeDrawer());

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    requestAnimationFrame(() => {
      overlay.classList.add('active');
      panel.classList.add('show');
    });

    this.setupEditAutoSuggestion(liste);
    this.bindEditDialogEvents(liste.id);
  }

  /**
   * Setup Auto-Suggestion für Edit
   */
  setupEditAutoSuggestion(liste) {
    let selectedUnternehmenId = liste.unternehmen_id;
    let selectedMarkeId = liste.marke_id;
    let selectedKampagneId = liste.kampagne_id;

    const addTag = (containerId, id, label, onRemove) => {
      const container = document.getElementById(containerId);
      if (!container) return;
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

    // Bestehende Tags setzen
    if (liste.unternehmen) {
      addTag('edit-tags-unternehmen', liste.unternehmen.id, liste.unternehmen.firmenname, () => { selectedUnternehmenId = null; });
    }
    if (liste.marke) {
      addTag('edit-tags-marke', liste.marke.id, liste.marke.markenname, () => { selectedMarkeId = null; });
    }
    if (liste.kampagne) {
      addTag('edit-tags-kampagne', liste.kampagne.id, liste.kampagne.kampagnenname, () => { selectedKampagneId = null; });
    }

    const bindAutoSuggest = (inputId, dropdownId, queryFn, onSelect, renderItem) => {
      const input = document.getElementById(inputId);
      const dropdown = document.getElementById(dropdownId);
      if (!input || !dropdown) return;

      let debounce;

      input.addEventListener('focus', async () => {
        const rows = await queryFn('');
        dropdown.innerHTML = rows?.length ? rows.map(r => renderItem(r)).join('') : '<div class="dropdown-item no-results">Keine Treffer</div>';
        dropdown.classList.add('show');
      });

      input.addEventListener('blur', () => setTimeout(() => dropdown.classList.remove('show'), 150));

      input.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(async () => {
          const rows = await queryFn(input.value.trim());
          dropdown.innerHTML = rows?.length ? rows.map(r => renderItem(r)).join('') : '<div class="dropdown-item no-results">Keine Treffer</div>';
          dropdown.classList.add('show');
        }, 200);
      });

      dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item[data-id]');
        if (!item) return;
        onSelect(item.dataset.id, item.dataset.label);
        dropdown.classList.remove('show');
        input.value = '';
      });
    };

    // Unternehmen - gefiltert nach Mitarbeiter-Zuordnungen
    bindAutoSuggest('edit-as-unternehmen', 'edit-asdd-unternehmen',
      async (q) => {
        const allowedIds = await window.getAllowedUnternehmenIds?.();
        let query = window.supabase.from('unternehmen').select('id, firmenname').order('firmenname').limit(20);
        if (allowedIds !== null) {
          if (allowedIds.length === 0) return [];
          query = query.in('id', allowedIds);
        }
        if (q) query = query.ilike('firmenname', `%${q}%`);
        const { data } = await query;
        return data || [];
      },
      (id, label) => {
        selectedUnternehmenId = id;
        addTag('edit-tags-unternehmen', id, label, () => { selectedUnternehmenId = null; });
      },
      (r) => `<div class="dropdown-item" data-id="${r.id}" data-label="${r.firmenname}">${r.firmenname}</div>`
    );

    // Marke - gefiltert nach Mitarbeiter-Zuordnungen
    bindAutoSuggest('edit-as-marke', 'edit-asdd-marke',
      async (q) => {
        const allowedMarkenIds = await window.getAllowedMarkenIds?.();
        let query = window.supabase.from('marke').select('id, markenname').order('markenname').limit(20);
        if (allowedMarkenIds !== null) {
          if (allowedMarkenIds.length === 0) return [];
          query = query.in('id', allowedMarkenIds);
        }
        if (q) query = query.ilike('markenname', `%${q}%`);
        if (selectedUnternehmenId) query = query.eq('unternehmen_id', selectedUnternehmenId);
        const { data } = await query;
        return data || [];
      },
      (id, label) => {
        selectedMarkeId = id;
        addTag('edit-tags-marke', id, label, () => { selectedMarkeId = null; });
      },
      (r) => `<div class="dropdown-item" data-id="${r.id}" data-label="${r.markenname}">${r.markenname}</div>`
    );

    bindAutoSuggest('edit-as-kampagne', 'edit-asdd-kampagne',
      async (q) => {
        let query = window.supabase.from('kampagne').select('id, kampagnenname').order('kampagnenname').limit(20);
        if (q) query = query.ilike('kampagnenname', `%${q}%`);
        if (selectedMarkeId) query = query.eq('marke_id', selectedMarkeId);
        const { data } = await query;
        return data || [];
      },
      (id, label) => {
        selectedKampagneId = id;
        addTag('edit-tags-kampagne', id, label, () => { selectedKampagneId = null; });
        
        // Auto-Generierung des Sourcing-Namens beim Bearbeiten
        const nameInput = document.querySelector('#edit-liste-form input[name="name"][type="hidden"]');
        if (nameInput && label) {
          const sourcingName = this.autoGeneration.autoGenerateSourcingName(label);
          if (sourcingName) {
            nameInput.value = sourcingName;
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      },
      (r) => `<div class="dropdown-item" data-id="${r.id}" data-label="${r.kampagnenname}">${r.kampagnenname}</div>`
    );
  }

  /**
   * Binde Events für Bearbeiten-Drawer
   */
  bindEditDialogEvents(listeId) {
    const drawer = document.getElementById('edit-liste-drawer');
    const form = document.getElementById('edit-liste-form');
    if (!drawer || !form) return;

    drawer.querySelectorAll('[data-action="close-drawer"]').forEach(btn => {
      btn.addEventListener('click', () => this.closeDrawer());
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(form);
      const unternehmenTag = document.querySelector('#edit-tags-unternehmen .tag');
      const markeTag = document.querySelector('#edit-tags-marke .tag');
      const kampagneTag = document.querySelector('#edit-tags-kampagne .tag');
      
      const data = {
        name: formData.get('name'),
        beschreibung: formData.get('beschreibung') || null,
        unternehmen_id: unternehmenTag?.dataset.id || null,
        marke_id: markeTag?.dataset.id || null,
        kampagne_id: kampagneTag?.dataset.id || null
      };

      if (!data.unternehmen_id && !data.marke_id && !data.kampagne_id) {
        window.toastSystem?.show('Bitte wählen Sie mindestens ein Unternehmen, eine Marke oder eine Kampagne aus', 'error');
        return;
      }

      try {
        await creatorAuswahlService.updateListe(listeId, data);
        window.toastSystem?.show('Creator-Auswahl erfolgreich aktualisiert', 'success');
        this.closeDrawer();
        await this.loadAndRender();
      } catch (error) {
        console.error('Fehler beim Aktualisieren:', error);
        window.toastSystem?.show('Fehler beim Aktualisieren', 'error');
      }
    });
  }

  removeDrawer() {
    ['create-liste-overlay', 'create-liste-drawer', 'edit-liste-overlay', 'edit-liste-drawer'].forEach(id => {
      document.getElementById(id)?.remove();
    });
  }

  closeDrawer() {
    ['create-liste-overlay', 'edit-liste-overlay'].forEach(id => {
      document.getElementById(id)?.classList.remove('active');
    });
    ['create-liste-drawer', 'edit-liste-drawer'].forEach(id => {
      document.getElementById(id)?.classList.remove('show');
    });
    setTimeout(() => this.removeDrawer(), 300);
  }

  async handleDelete(id) {
    const result = await window.confirmationModal?.open({
      title: 'Creator-Auswahl löschen?',
      message: 'Möchten Sie diese Liste wirklich löschen? Alle Creator werden ebenfalls entfernt.',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true
    });

    if (!result?.confirmed) return;

    try {
      await creatorAuswahlService.deleteListe(id);
      window.toastSystem?.show('Creator-Auswahl erfolgreich gelöscht', 'success');
      await this.loadAndRender();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      window.toastSystem?.show('Fehler beim Löschen', 'error');
    }
  }

  destroy() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();
    this.removeDrawer();
  }
}

export const creatorAuswahlList = new CreatorAuswahlList();

