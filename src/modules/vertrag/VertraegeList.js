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
        ? `<a href="${escapeHtml(vertrag.datei_url)}" target="_blank" class="datei-link datei-icon" title="PDF anzeigen">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="20" height="20">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </a>`
        : '<span class="text-muted">—</span>';

      const statusBadge = vertrag.is_draft
        ? '<span class="status-badge status-draft">Entwurf</span>'
        : '<span class="status-badge status-final">Finalisiert</span>';

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
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
          Weiter bearbeiten
        </a>
        <a href="#" class="action-item" data-action="view" data-id="${vertrag.id}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          Details anzeigen
        </a>
      `;
    } else {
      // Finalisiert: Normale Aktionen
      actions = `
        <a href="#" class="action-item" data-action="view" data-id="${vertrag.id}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          Details anzeigen
        </a>
        <a href="#" class="action-item" data-action="edit" data-id="${vertrag.id}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
          Bearbeiten
        </a>
        ${vertrag.datei_url ? `
          <a href="#" class="action-item" data-action="download" data-id="${vertrag.id}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
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
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
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
