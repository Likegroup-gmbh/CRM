// StrategieList.js
// Übersicht aller Strategielisten

import { strategieService } from './StrategieService.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';

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
                <th>Verknüpfung</th>
                <th>Items</th>
                <th>Erstellt</th>
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
      // Verknüpfung ermitteln
      let verknuepfung = '';
      if (strategie.marke) {
        verknuepfung = `Marke: ${strategie.marke.markenname}`;
      } else if (strategie.unternehmen) {
        verknuepfung = `Unternehmen: ${strategie.unternehmen.firmenname}`;
      } else if (strategie.kampagne) {
        verknuepfung = `Kampagne: ${strategie.kampagne.kampagnenname}`;
      } else if (strategie.auftrag) {
        verknuepfung = `Auftrag: ${strategie.auftrag.auftragsname}`;
      }

      // Datum formatieren
      const createdAt = new Date(strategie.created_at).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      return `
        <tr class="table-row-clickable" data-strategie-id="${strategie.id}">
          <td>
            <strong>${strategie.name || 'Ohne Namen'}</strong>
            ${strategie.beschreibung ? `<br><span style="font-size: var(--text-xs); color: var(--text-secondary);">${strategie.beschreibung}</span>` : ''}
          </td>
          <td>${verknuepfung}</td>
          <td><span style="color: var(--text-secondary);">-</span></td>
          <td>${createdAt}</td>
          <td>${strategie.created_by_user?.name || '-'}</td>
          <td class="col-actions">
            <button class="secondary-btn" data-action="view-strategie" data-id="${strategie.id}" title="Strategie öffnen">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
            ${window.currentUser?.rolle !== 'kunde' ? `
              <button class="danger-btn" data-action="delete-strategie" data-id="${strategie.id}" title="Strategie löschen">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
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
        // Ignoriere Klicks auf Buttons
        if (e.target.closest('button')) return;
        
        const id = row.dataset.strategieId;
        window.navigateTo(`/strategie/${id}`);
      };
      row.addEventListener('click', handler);
      this._boundEventListeners.add(() => row.removeEventListener('click', handler));
    });

    // View Buttons
    document.querySelectorAll('[data-action="view-strategie"]').forEach(btn => {
      const handler = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        window.navigateTo(`/strategie/${id}`);
      };
      btn.addEventListener('click', handler);
      this._boundEventListeners.add(() => btn.removeEventListener('click', handler));
    });

    // Delete Buttons
    document.querySelectorAll('[data-action="delete-strategie"]').forEach(btn => {
      const handler = (e) => {
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
          <label for="strategie-name">Name *</label>
          <input type="text" id="strategie-name" name="name" required class="form-input" placeholder="z.B. Q1 2025 Content Ideen">
        </div>

        <div class="form-field">
          <label for="strategie-beschreibung">Beschreibung</label>
          <textarea id="strategie-beschreibung" name="beschreibung" class="form-input" rows="3" placeholder="Optional"></textarea>
        </div>

        <div class="form-field">
          <label for="strategie-unternehmen">Unternehmen</label>
          <select id="strategie-unternehmen" name="unternehmen_id" class="form-select">
            <option value="">Bitte wählen...</option>
          </select>
        </div>

        <div class="form-field">
          <label for="strategie-marke">Marke</label>
          <select id="strategie-marke" name="marke_id" class="form-select">
            <option value="">Bitte wählen...</option>
          </select>
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

    // Lade Unternehmen & Marken
    this.loadCreateDialogData();

    // Events binden
    this.bindCreateDialogEvents();
  }

  /**
   * Drawer entfernen
   */
  removeDrawer() {
    const overlay = document.getElementById('create-strategie-overlay');
    const panel = document.getElementById('create-strategie-drawer');
    if (overlay) overlay.remove();
    if (panel) panel.remove();
  }

  /**
   * Drawer schließen
   */
  closeDrawer() {
    const overlay = document.getElementById('create-strategie-overlay');
    const panel = document.getElementById('create-strategie-drawer');
    
    if (overlay) overlay.classList.remove('active');
    if (panel) panel.classList.remove('show');
    
    setTimeout(() => {
      this.removeDrawer();
    }, 300);
  }

  /**
   * Lade Daten für Erstellen-Dialog
   */
  async loadCreateDialogData() {
    try {
      const unternehmen = await strategieService.getAllUnternehmen();
      const unternehmenSelect = document.getElementById('strategie-unternehmen');
      
      unternehmen.forEach(u => {
        const option = document.createElement('option');
        option.value = u.id;
        option.textContent = u.firmenname;
        unternehmenSelect.appendChild(option);
      });

      // Marken laden wenn Unternehmen gewählt wird
      unternehmenSelect.addEventListener('change', async (e) => {
        const markeSelect = document.getElementById('strategie-marke');
        markeSelect.innerHTML = '<option value="">Bitte wählen...</option>';
        
        if (e.target.value) {
          const marken = await strategieService.getAllMarken(e.target.value);
          marken.forEach(m => {
            const option = document.createElement('option');
            option.value = m.id;
            option.textContent = m.markenname;
            markeSelect.appendChild(option);
          });
        }
      });
    } catch (error) {
      console.error('Fehler beim Laden der Dialog-Daten:', error);
    }
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
      const data = {
        name: formData.get('name'),
        beschreibung: formData.get('beschreibung') || null,
        unternehmen_id: formData.get('unternehmen_id') || null,
        marke_id: formData.get('marke_id') || null
      };

      // Validierung: Mindestens eine Verknüpfung
      if (!data.unternehmen_id && !data.marke_id) {
        window.toastSystem?.show('Bitte wählen Sie mindestens ein Unternehmen oder eine Marke aus', 'error');
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

