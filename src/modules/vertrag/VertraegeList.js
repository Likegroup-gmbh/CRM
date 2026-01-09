// VertraegeList.js (ES6-Modul)
// Verträge-Übersichtsseite mit allen Verträgen

import { PaginationSystem } from '../../core/PaginationSystem.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';

export class VertraegeList {
  constructor() {
    this.vertraege = [];
    this.selectedVertraege = new Set();
    this.pagination = new PaginationSystem();
  }

  // Initialisiere Verträge-Liste
  async init() {
    window.setHeadline('Verträge');
    
    // Breadcrumb für Listen-Seite
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Verträge', url: '/vertraege', clickable: false }
      ]);
    }
    
    // Berechtigungsprüfung
    const canView = window.currentUser?.rolle === 'admin' || 
                    window.currentUser?.rolle === 'mitarbeiter';
    
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Verträge anzuzeigen.</p>
        </div>
      `;
      return;
    }

    // Pagination initialisieren
    this.pagination.init('pagination-vertraege', {
      itemsPerPage: 25,
      onPageChange: (page) => this.handlePageChange(page),
      onItemsPerPageChange: () => this.loadAndRender()
    });

    // Events binden
    this.bindEvents();
    
    await this.loadAndRender();
  }

  // Seitenwechsel Handler
  handlePageChange(page) {
    this.loadAndRender();
  }

  // Lade und rendere Verträge-Liste
  async loadAndRender() {
    try {
      await this.render();
      const vertraege = await this.loadVertraege();
      this.updateTable(vertraege);
    } catch (error) {
      window.ErrorHandler?.handle(error, 'VertraegeList.loadAndRender');
      console.error('❌ Fehler beim Laden der Verträge:', error);
    }
  }

  // Lade Verträge aus Datenbank
  async loadVertraege() {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar');
        return [];
      }

      const { currentPage, itemsPerPage } = this.pagination.getState();
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { count } = await window.supabase
        .from('vertraege')
        .select('*', { count: 'exact', head: true });

      const { data: vertraege, error } = await window.supabase
        .from('vertraege')
        .select(`
          id,
          name,
          typ,
          is_draft,
          datei_url,
          datei_path,
          created_at,
          creator:creator_id (
            id,
            vorname,
            nachname
          )
        `)
        .order('created_at', { ascending: false })
        .range(from, to);

      this.pagination.updateTotal(count || 0);
      this.pagination.render();

      if (error) throw error;

      this.vertraege = vertraege || [];
      return this.vertraege;

    } catch (error) {
      console.error('❌ Fehler beim Laden der Verträge:', error);
      return [];
    }
  }

  // Rendere Seiten-Struktur
  async render() {
    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
    const canEdit = isAdmin || window.currentUser?.rolle === 'mitarbeiter';

    const html = `
      <div class="table-filter-wrapper">
        <div class="table-actions">
          ${isAdmin ? `<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>` : ''}
          ${canEdit ? '<button id="btn-vertrag-new" class="primary-btn">Neuen Vertrag anlegen</button>' : ''}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${isAdmin ? `<th><input type="checkbox" id="select-all-vertraege"></th>` : ''}
              <th>Name</th>
              <th>Status</th>
              <th>Typ</th>
              <th>Creator</th>
              <th>Datei</th>
              <th>Erstellt am</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="${isAdmin ? '8' : '7'}" class="no-data">Lade Verträge...</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="pagination-container" id="pagination-vertraege"></div>
    `;

    window.setContentSafely(window.content, html);
  }

  // Binde Events
  bindEvents() {
    // Neuer Vertrag anlegen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-vertrag-new') {
        e.preventDefault();
        window.navigateTo('/vertraege/new');
      }
    });

    // Vertrag Detail Links
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'vertrag') {
        e.preventDefault();
        const vertragId = e.target.dataset.id;
        window.navigateTo(`/vertraege/${vertragId}`);
      }
    });

    // Creator Links
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'creator') {
        e.preventDefault();
        const creatorId = e.target.dataset.id;
        window.navigateTo(`/creator/${creatorId}`);
      }
    });

    // Alle auswählen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-select-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.vertraege-check');
        checkboxes.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.id) this.selectedVertraege.add(cb.dataset.id);
        });
        const selectAllHeader = document.getElementById('select-all-vertraege');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = true;
        }
        this.updateSelection();
      }
    });

    // Auswahl aufheben Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-deselect-all') {
        e.preventDefault();
        this.deselectAll();
      }
    });

    // Ausgewählte löschen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-delete-selected') {
        e.preventDefault();
        this.showDeleteSelectedConfirmation();
      }
    });

    // Select-All Checkbox (Tabellen-Header)
    document.addEventListener('change', (e) => {
      if (e.target.id === 'select-all-vertraege') {
        const checkboxes = document.querySelectorAll('.vertraege-check');
        const isChecked = e.target.checked;
        
        checkboxes.forEach(cb => {
          cb.checked = isChecked;
          if (isChecked) {
            this.selectedVertraege.add(cb.dataset.id);
          } else {
            this.selectedVertraege.delete(cb.dataset.id);
          }
        });
        
        this.updateSelection();
        console.log(`${isChecked ? '✅ Alle Verträge ausgewählt' : '❌ Alle Verträge abgewählt'}: ${this.selectedVertraege.size}`);
      }
    });

    // Verträge Checkboxes (einzelne Zeilen)
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('vertraege-check')) {
        if (e.target.checked) {
          this.selectedVertraege.add(e.target.dataset.id);
        } else {
          this.selectedVertraege.delete(e.target.dataset.id);
        }
        this.updateSelection();
        this.updateSelectAllCheckbox();
      }
    });

    // Action Events (View, Edit, Continue, Download, Delete)
    document.addEventListener('click', (e) => {
      const actionItem = e.target.closest('.action-item');
      if (!actionItem) return;

      const action = actionItem.dataset.action;
      const id = actionItem.dataset.id;

      if (!action || !id) return;
      e.preventDefault();

      switch (action) {
        case 'view':
          window.navigateTo(`/vertraege/${id}`);
          break;
        case 'edit':
        case 'continue': // Draft weiter bearbeiten = gleiche Route wie edit
          window.navigateTo(`/vertraege/${id}/edit`);
          break;
        case 'download':
          this.downloadVertrag(id);
          break;
        case 'delete':
          this.deleteVertrag(id);
          break;
      }
    });
  }

  // Update Selection UI
  updateSelection() {
    const selectedCount = this.selectedVertraege.size;
    const selectedCountElement = document.getElementById('selected-count');
    const selectBtn = document.getElementById('btn-select-all');
    const deselectBtn = document.getElementById('btn-deselect-all');
    const deleteBtn = document.getElementById('btn-delete-selected');
    
    if (selectedCountElement) {
      selectedCountElement.textContent = `${selectedCount} ausgewählt`;
      selectedCountElement.style.display = selectedCount > 0 ? 'inline' : 'none';
    }
    
    if (selectBtn) {
      selectBtn.style.display = selectedCount > 0 ? 'none' : 'inline-block';
    }
    
    if (deselectBtn) {
      deselectBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    }
    
    if (deleteBtn) {
      deleteBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    }
  }

  // Update Select-All Checkbox Status
  updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-vertraege');
    const individualCheckboxes = document.querySelectorAll('.vertraege-check');
    
    if (!selectAllCheckbox || individualCheckboxes.length === 0) return;
    
    const checkedBoxes = document.querySelectorAll('.vertraege-check:checked');
    const allChecked = checkedBoxes.length === individualCheckboxes.length;
    const someChecked = checkedBoxes.length > 0;
    
    selectAllCheckbox.checked = allChecked;
    selectAllCheckbox.indeterminate = someChecked && !allChecked;
  }

  // Alle abwählen
  deselectAll() {
    this.selectedVertraege.clear();
    
    const checkboxes = document.querySelectorAll('.vertraege-check');
    checkboxes.forEach(cb => {
      cb.checked = false;
    });
    
    const selectAllCheckbox = document.getElementById('select-all-vertraege');
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
    
    this.updateSelection();
  }

  // Update Tabelle
  updateTable(vertraege) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';

    if (!vertraege || vertraege.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${isAdmin ? '8' : '7'}" class="no-data">
            <div class="empty-state">
              <div class="empty-icon">📄</div>
              <h3>Keine Verträge vorhanden</h3>
              <p>Es wurden noch keine Verträge erstellt.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const formatDate = (date) => {
      return date ? new Date(date).toLocaleDateString('de-DE') : '-';
    };

    const escapeHtml = (text) => {
      if (!text) return '';
      return window.validatorSystem?.sanitizeHtml(text) || text;
    };

    tbody.innerHTML = vertraege.map(vertrag => {
      const creator = vertrag.creator || {};

      const creatorName = creator.vorname 
        ? `${escapeHtml(creator.vorname)} ${escapeHtml(creator.nachname || '')}`.trim()
        : '-';

      const typClass = vertrag.typ ? `typ-${vertrag.typ.toLowerCase().replace(/\s+/g, '-')}` : '';

      const dateiHtml = vertrag.datei_url 
        ? `<a href="${escapeHtml(vertrag.datei_url)}" target="_blank" class="datei-link">📄 PDF anzeigen</a>`
        : '<span class="text-muted">Kein PDF</span>';

      const statusBadge = vertrag.is_draft
        ? '<span class="status-badge status-draft">📝 Entwurf</span>'
        : '<span class="status-badge status-final">✅ Finalisiert</span>';

      // Custom Actions basierend auf Draft-Status
      const actionsHtml = this.renderVertragActions(vertrag, isAdmin);

      return `
        <tr data-id="${vertrag.id}">
          ${isAdmin ? `<td><input type="checkbox" class="vertraege-check" data-id="${vertrag.id}"></td>` : ''}
          <td>
            <a href="#" class="table-link" data-table="vertrag" data-id="${vertrag.id}">
              ${escapeHtml(vertrag.name) || '—'}
            </a>
          </td>
          <td>${statusBadge}</td>
          <td>
            ${vertrag.typ 
              ? `<span class="status-badge ${typClass}">${escapeHtml(vertrag.typ)}</span>`
              : '-'}
          </td>
          <td>
            ${creator.id ? `
              <a href="#" class="table-link" data-table="creator" data-id="${creator.id}">
                ${creatorName}
              </a>
            ` : '-'}
          </td>
          <td>${dateiHtml}</td>
          <td>${formatDate(vertrag.created_at)}</td>
          <td>
            ${actionsHtml}
          </td>
        </tr>
      `;
    }).join('');
  }

  // Rendere Aktionen basierend auf Draft-Status
  renderVertragActions(vertrag, isAdmin) {
    const isDraft = vertrag.is_draft;
    
    // Basis-Aktionen
    let actions = '';
    
    if (isDraft) {
      // Draft: Hauptaktion ist "Weiter bearbeiten"
      actions = `
        <a href="#" class="action-item" data-action="continue" data-id="${vertrag.id}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
          </svg>
          Weiter bearbeiten
        </a>
        <a href="#" class="action-item" data-action="view" data-id="${vertrag.id}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
            <path fill-rule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
          </svg>
          Details anzeigen
        </a>
      `;
    } else {
      // Finalisiert: Normale Aktionen
      actions = `
        <a href="#" class="action-item" data-action="view" data-id="${vertrag.id}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
            <path fill-rule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
          </svg>
          Details anzeigen
        </a>
        <a href="#" class="action-item" data-action="edit" data-id="${vertrag.id}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
          </svg>
          Bearbeiten
        </a>
        ${vertrag.datei_url ? `
          <a href="#" class="action-item" data-action="download" data-id="${vertrag.id}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
              <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
            </svg>
            PDF herunterladen
          </a>
        ` : ''}
      `;
    }
    
    // Separator und Delete nur für Admin
    if (isAdmin) {
      actions += `
        <div class="action-separator"></div>
        <a href="#" class="action-item action-danger" data-action="delete" data-id="${vertrag.id}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd" />
          </svg>
          Löschen
        </a>
      `;
    }
    
    return `
      <div class="actions-dropdown-container" data-entity-type="vertraege">
        <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
            <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
          </svg>
        </button>
        <div class="actions-dropdown">
          ${actions}
        </div>
      </div>
    `;
  }

  // PDF herunterladen
  async downloadVertrag(id) {
    const vertrag = this.vertraege.find(v => v.id === id);
    if (!vertrag?.datei_url) {
      window.toastSystem?.show('Keine PDF-Datei vorhanden', 'warning');
      return;
    }
    window.open(vertrag.datei_url, '_blank');
  }

  // Einzelnen Vertrag löschen
  async deleteVertrag(id) {
    if (!confirm('Möchten Sie diesen Vertrag wirklich löschen?')) return;

    try {
      const vertrag = this.vertraege.find(v => v.id === id);
      if (vertrag?.datei_path) {
        await window.supabase.storage
          .from('vertraege')
          .remove([vertrag.datei_path]);
      }

      const { error } = await window.supabase
        .from('vertraege')
        .delete()
        .eq('id', id);

      if (error) throw error;

      window.toastSystem?.show('Vertrag gelöscht', 'success');
      await this.loadAndRender();

    } catch (error) {
      console.error('❌ Fehler beim Löschen:', error);
      window.toastSystem?.show(`Fehler: ${error.message}`, 'error');
    }
  }

  // Bestätigungsdialog für Bulk-Delete
  async showDeleteSelectedConfirmation() {
    const selectedCount = this.selectedVertraege.size;
    if (selectedCount === 0) {
      alert('Keine Verträge ausgewählt.');
      return;
    }

    if (!confirm(`Möchten Sie wirklich ${selectedCount} Vertrag/Verträge löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden.`)) {
      return;
    }

    await this.deleteSelected();
  }

  // Ausgewählte Verträge löschen
  async deleteSelected() {
    if (window.currentUser?.rolle !== 'admin') return;
    
    const selectedIds = Array.from(this.selectedVertraege);
    const totalCount = selectedIds.length;

    try {
      const vertraegeToDelete = this.vertraege.filter(v => selectedIds.includes(v.id) && v.datei_path);
      if (vertraegeToDelete.length > 0) {
        const paths = vertraegeToDelete.map(v => v.datei_path);
        await window.supabase.storage
          .from('vertraege')
          .remove(paths);
      }

      const { error } = await window.supabase
        .from('vertraege')
        .delete()
        .in('id', selectedIds);

      if (error) throw error;

      this.selectedVertraege.clear();
      window.toastSystem?.show(`${totalCount} Vertrag/Verträge gelöscht`, 'success');
      await this.loadAndRender();

    } catch (error) {
      console.error('❌ Fehler beim Löschen:', error);
      window.toastSystem?.show(`Fehler: ${error.message}`, 'error');
    }
  }

  // Cleanup
  destroy() {
    this.selectedVertraege.clear();
    this.vertraege = [];
  }
}

// Exportiere Instanz
export const vertraegeList = new VertraegeList();
