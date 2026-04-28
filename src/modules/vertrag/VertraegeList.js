// VertraegeList.js (ES6-Modul)
// Verträge-Übersichtsseite mit Unternehmens-Ordnern — Orchestrator

import { PaginationSystem } from '../../core/PaginationSystem.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { modularFilterSystem } from '../../core/filters/ModularFilterSystem.js';
import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { syncVertragCheckbox } from '../../core/VertragSyncHelper.js';

import { loadUnternehmenName, loadUnternehmenFolders, loadVertraege } from './VertraegeListDataLoader.js';
import {
  renderFoldersView,
  updateFoldersGrid,
  updateUnternehmenListTableBody,
  renderVertraegeView,
  renderVertraegeTableBody
} from './VertraegeListRenderers.js';
import {
  bindTableDelegation,
  bindSelectionEvents,
  openVertragUploadDrawer as _openVertragUploadDrawer,
  removeSignedContract as _removeSignedContract
} from './VertraegeListHandlers.js';

export class VertraegeList {
  constructor() {
    this.vertraege = [];
    this.unternehmenFolders = [];
    this.selectedVertraege = new Set();
    this.pagination = new PaginationSystem();
    this._boundEventListeners = new Set();

    this.viewMode = 'folders';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.listViewMode = 'grid';
  }

  getVertragPermissions() {
    const isAdmin = window.isAdmin();
    const perms = window.currentUser?.permissions?.vertraege || {};
    return {
      isAdmin,
      canBulkDelete: window.canBulkDelete(),
      canView: isAdmin || perms.can_view === true,
      canEdit: isAdmin || perms.can_edit === true
    };
  }

  // ============================================
  // INIT + LIFECYCLE
  // ============================================

  async init(unternehmenId = null) {
    if (unternehmenId) {
      this.viewMode = 'vertraege';
      this.currentUnternehmenId = unternehmenId;
      this.currentUnternehmenName = await loadUnternehmenName(unternehmenId);
    } else {
      this.viewMode = 'folders';
      this.currentUnternehmenId = null;
      this.currentUnternehmenName = null;
    }

    window.setHeadline('Verträge');
    this.updateBreadcrumbDisplay();

    const { canView } = this.getVertragPermissions();
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Verträge anzuzeigen.</p>
        </div>`;
      return;
    }

    const paginationContainer = this.viewMode === 'vertraege'
      ? 'pagination-vertraege'
      : 'pagination-vertraege-all';

    this.pagination.init(paginationContainer, {
      itemsPerPage: 25,
      onPageChange: () => this.reloadData(),
      onItemsPerPageChange: () => this.loadAndRender(),
      dynamicResize: true,
      tbodySelector: '.data-table tbody'
    });

    await this.loadAndRender();
  }

  updateBreadcrumbDisplay() {
    if (!window.breadcrumbSystem) return;
    if (this.viewMode === 'folders') return;
    window.breadcrumbSystem.updateDetailLabel(this.currentUnternehmenName || 'Unternehmen');
  }

  async reloadData() {
    try {
      if (this.viewMode === 'folders') {
        this.unternehmenFolders = await loadUnternehmenFolders();
        if (this.listViewMode === 'grid') {
          updateFoldersGrid(this.unternehmenFolders);
        } else {
          this._updateUnternehmenTable();
        }
      } else {
        this.vertraege = await loadVertraege(this.currentUnternehmenId, this.pagination);
        this.updateVertraegeTable(this.vertraege);
      }
    } catch (error) {
      window.ErrorHandler?.handle(error, 'VertraegeList.reloadData');
      console.error('❌ Fehler beim Laden:', error);
    }
  }

  async loadAndRender() {
    try {
      this._render();

      const tbody = document.querySelector('.data-table tbody');
      TableAnimationHelper.showLoadingOverlay(tbody);

      const paginationContainer = this.viewMode === 'vertraege'
        ? 'pagination-vertraege'
        : 'pagination-vertraege-all';

      this.pagination.init(paginationContainer, {
        itemsPerPage: 25,
        onPageChange: () => this.reloadData(),
        onItemsPerPageChange: () => this.loadAndRender()
      });

      this.bindEvents();

      if (this.viewMode === 'folders') {
        this.unternehmenFolders = await loadUnternehmenFolders();
        if (this.listViewMode === 'grid') {
          updateFoldersGrid(this.unternehmenFolders);
        } else {
          this._updateUnternehmenTable();
        }
        TableAnimationHelper.hideLoadingOverlay(tbody);
      } else {
        const [, vertraege] = await Promise.all([
          this._initializeFilterBar(),
          loadVertraege(this.currentUnternehmenId, this.pagination)
        ]);
        this.vertraege = vertraege;
        this.updateVertraegeTable(this.vertraege);
        TableAnimationHelper.hideLoadingOverlay(tbody);
      }
    } catch (error) {
      const tbodyError = document.querySelector('.data-table tbody');
      TableAnimationHelper.hideLoadingOverlay(tbodyError);
      window.ErrorHandler?.handle(error, 'VertraegeList.loadAndRender');
      console.error('❌ Fehler beim Laden:', error);
    }
  }

  // ============================================
  // RENDER
  // ============================================

  _render() {
    const html = this.viewMode === 'folders'
      ? renderFoldersView(this.listViewMode, this.getVertragPermissions().canEdit)
      : renderVertraegeView(this.getVertragPermissions());
    window.setContentSafely(window.content, html);
  }

  updateVertraegeTable(vertraege) {
    const tbody = document.getElementById('vertraege-table-body');
    if (!tbody) return;

    const perms = this.getVertragPermissions();

    if (!vertraege || vertraege.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${perms.canBulkDelete ? '10' : '9'}" class="no-data">
            <div class="empty-state">
              <div class="empty-icon">📄</div>
              <h3>Keine Verträge vorhanden</h3>
              <p>Für dieses Unternehmen wurden noch keine Verträge erstellt.</p>
            </div>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = renderVertraegeTableBody(vertraege, perms);

    if (window.ActionsDropdown) window.ActionsDropdown.init();

    // Event-Delegation statt per-row Binding
    bindTableDelegation(this);
    if (this.viewMode === 'vertraege') {
      bindSelectionEvents(this);
    }
  }

  _updateUnternehmenTable() {
    updateUnternehmenListTableBody(this.unternehmenFolders);
    this._bindUnternehmenRowEvents();
  }

  // ============================================
  // EVENTS
  // ============================================

  bindEvents() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();

    // View-Toggle (Liste vs Grid)
    const btnViewList = document.getElementById('btn-view-list');
    const btnViewGrid = document.getElementById('btn-view-grid');

    if (btnViewList) {
      const handler = (e) => {
        e.preventDefault();
        if (this.listViewMode === 'list') return;
        this.listViewMode = 'list';
        this.selectedVertraege.clear();
        this.pagination.currentPage = 1;
        this.loadAndRender();
      };
      btnViewList.addEventListener('click', handler);
      this._boundEventListeners.add(() => btnViewList.removeEventListener('click', handler));
    }

    if (btnViewGrid) {
      const handler = (e) => {
        e.preventDefault();
        if (this.listViewMode === 'grid') return;
        this.listViewMode = 'grid';
        this.selectedVertraege.clear();
        this.loadAndRender();
      };
      btnViewGrid.addEventListener('click', handler);
      this._boundEventListeners.add(() => btnViewGrid.removeEventListener('click', handler));
    }

    // Neuer Vertrag
    const newBtn = document.getElementById('btn-vertrag-new');
    if (newBtn) {
      const handler = (e) => {
        e.preventDefault();
        if (this.currentUnternehmenId) {
          window.navigateTo(`/vertraege/new?unternehmen=${this.currentUnternehmenId}`);
        } else {
          window.navigateTo('/vertraege/new');
        }
      };
      newBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => newBtn.removeEventListener('click', handler));
    }

    // Zurück
    const backBtn = document.getElementById('btn-back-to-folders');
    if (backBtn) {
      const handler = (e) => { e.preventDefault(); this.switchToFoldersView(); };
      backBtn.addEventListener('click', handler);
      this._boundEventListeners.add(() => backBtn.removeEventListener('click', handler));
    }

    // Ordner-Grid-Click
    const foldersGrid = document.getElementById('folders-grid');
    if (foldersGrid) {
      const handler = (e) => {
        const folder = e.target.closest('.folder-card');
        if (folder) {
          this.switchToVertraegeView(folder.dataset.unternehmenId, folder.dataset.unternehmenName);
        }
      };
      foldersGrid.addEventListener('click', handler);
      this._boundEventListeners.add(() => foldersGrid.removeEventListener('click', handler));
    }

    // Table links (delegiert auf document)
    document.addEventListener('click', this._tableLinkHandler = (e) => {
      const link = e.target.closest('.table-link[data-table]');
      if (!link) return;
      e.preventDefault();
      const table = link.dataset.table;
      const id = link.dataset.id;
      switch (table) {
        case 'vertrag': {
          const row = link.closest('tr[data-vertrag-draft]');
          const isDraft = row?.dataset?.vertragDraft === '1';
          window.navigateTo(isDraft ? `/vertraege/${id}/edit` : `/vertraege/${id}`);
          break;
        }
        case 'creator': window.navigateTo(`/creator/${id}`); break;
        case 'kampagne': window.navigateTo(`/kampagnen/${id}`); break;
        case 'unternehmen': window.navigateTo(`/unternehmen/${id}`); break;
      }
    });

    // Signed-Contract Custom Event (from ActionsDropdown dispatch)
    const signedActionHandler = async (e) => {
      const { action, vertragId } = e.detail;
      if (action === 'add-signed' || action === 'replace-signed') {
        this.openVertragUploadDrawer(vertragId);
      } else if (action === 'remove-signed') {
        await this.removeSignedContract(vertragId);
      }
    };
    window.addEventListener('vertrag-signed-action', signedActionHandler);
    this._boundEventListeners.add(() => window.removeEventListener('vertrag-signed-action', signedActionHandler));
  }

  _bindUnternehmenRowEvents() {
    const rows = document.querySelectorAll('.unternehmen-row');
    rows.forEach(row => {
      const handler = (e) => {
        if (e.target.closest('.unternehmen-link')) e.preventDefault();
        const id = row.dataset.unternehmenId;
        const name = row.dataset.unternehmenName;
        if (id) this.switchToVertraegeView(id, name);
      };
      row.addEventListener('click', handler);
      this._boundEventListeners.add(() => row.removeEventListener('click', handler));
    });
  }

  // ============================================
  // PUBLIC API (delegiert)
  // ============================================

  openVertragUploadDrawer(vertragId) {
    return _openVertragUploadDrawer(this, vertragId);
  }

  async removeSignedContract(vertragId) {
    return _removeSignedContract(this, vertragId);
  }

  // ============================================
  // VIEW SWITCHING
  // ============================================

  switchToFoldersView() {
    this.viewMode = 'folders';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
    this.selectedVertraege.clear();
    this.updateBreadcrumbDisplay();
    this.loadAndRender();
  }

  switchToVertraegeView(unternehmenId, unternehmenName) {
    this.viewMode = 'vertraege';
    this.currentUnternehmenId = unternehmenId;
    this.currentUnternehmenName = unternehmenName;
    this.selectedVertraege.clear();
    this.pagination.currentPage = 1;
    this.updateBreadcrumbDisplay();
    this.loadAndRender();
  }

  // ============================================
  // FILTER
  // ============================================

  async _initializeFilterBar() {
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      await filterDropdown.init('vertrag', filterContainer, {
        onFilterApply: (filters) => {
          modularFilterSystem.applyFilters('vertrag', filters);
          this.reloadData();
        },
        onFilterReset: () => {
          modularFilterSystem.resetFilters('vertrag');
          this.reloadData();
        }
      });
    }
  }

  // ============================================
  // SELECTION HELPERS
  // ============================================

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
    if (selectBtn) selectBtn.style.display = selectedCount > 0 ? 'none' : 'inline-block';
    if (deselectBtn) deselectBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    if (deleteBtn) deleteBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
  }

  updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-vertraege');
    const individualCheckboxes = document.querySelectorAll('.vertraege-check');
    if (!selectAllCheckbox || individualCheckboxes.length === 0) return;

    const checkedBoxes = document.querySelectorAll('.vertraege-check:checked');
    selectAllCheckbox.checked = checkedBoxes.length === individualCheckboxes.length;
    selectAllCheckbox.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < individualCheckboxes.length;
  }

  deselectAll() {
    this.selectedVertraege.clear();
    document.querySelectorAll('.vertraege-check').forEach(cb => { cb.checked = false; });
    const selectAllCheckbox = document.getElementById('select-all-vertraege');
    if (selectAllCheckbox) { selectAllCheckbox.checked = false; selectAllCheckbox.indeterminate = false; }
    this.updateSelection();
  }

  // ============================================
  // CRUD
  // ============================================

  downloadVertrag(id) {
    const vertrag = this.vertraege.find(v => v.id === id);
    if (!vertrag?.datei_url) {
      window.toastSystem?.show('Keine PDF-Datei vorhanden', 'warning');
      return;
    }
    window.open(vertrag.datei_url, '_blank');
  }

  async deleteVertrag(id) {
    const result = await window.confirmationModal?.open({
      title: 'Vertrag löschen?',
      message: 'Möchten Sie diesen Vertrag wirklich löschen?',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true
    });
    if (!result?.confirmed) return;

    try {
      const vertrag = this.vertraege.find(v => v.id === id);

      if (vertrag?.datei_path) {
        await window.supabase.storage.from('vertraege').remove([vertrag.datei_path]);
      }
      if (vertrag?.unterschriebener_vertrag_path) {
        await window.supabase.storage.from('unterschriebene-vertraege').remove([vertrag.unterschriebener_vertrag_path]);
      }
      if (vertrag?.dropbox_file_path) {
        try {
          await fetch('/.netlify/functions/dropbox-delete-vertrag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: vertrag.dropbox_file_path })
          });
        } catch (dbxErr) {
          console.warn('Dropbox-Löschung fehlgeschlagen (wird ignoriert):', dbxErr);
        }
      }

      const { error } = await window.supabase.from('vertraege').delete().eq('id', id);
      if (error) throw error;

      const hadSigned = vertrag?.unterschriebener_vertrag_url || vertrag?.dropbox_file_url;
      if (hadSigned && vertrag?.kooperation_id) {
        await syncVertragCheckbox(vertrag.kooperation_id, false);
      }

      window.toastSystem?.show('Vertrag gelöscht', 'success');
      await this.loadAndRender();
    } catch (error) {
      console.error('❌ Fehler beim Löschen:', error);
      window.toastSystem?.show(`Fehler: ${error.message}`, 'error');
    }
  }

  async showDeleteSelectedConfirmation() {
    const selectedCount = this.selectedVertraege.size;
    if (selectedCount === 0) {
      window.toastSystem?.show('Keine Verträge ausgewählt', 'warning');
      return;
    }

    const result = await window.confirmationModal?.open({
      title: `${selectedCount} Verträge löschen?`,
      message: 'Möchten Sie die ausgewählten Verträge wirklich löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden.',
      confirmText: 'Löschen',
      cancelText: 'Abbrechen',
      danger: true
    });
    if (!result?.confirmed) return;
    await this._deleteSelected();
  }

  async _deleteSelected() {
    if (!window.isInternal()) return;

    const selectedIds = Array.from(this.selectedVertraege);
    try {
      const vertraegeToDelete = this.vertraege.filter(v => selectedIds.includes(v.id) && v.datei_path);
      if (vertraegeToDelete.length > 0) {
        await window.supabase.storage.from('vertraege').remove(vertraegeToDelete.map(v => v.datei_path));
      }

      const { error } = await window.supabase.from('vertraege').delete().in('id', selectedIds);
      if (error) throw error;

      this.selectedVertraege.clear();
      window.toastSystem?.show(`${selectedIds.length} Vertrag/Verträge gelöscht`, 'success');
      await this.loadAndRender();
    } catch (error) {
      console.error('❌ Fehler beim Löschen:', error);
      window.toastSystem?.show(`Fehler: ${error.message}`, 'error');
    }
  }

  // ============================================
  // CLEANUP
  // ============================================

  destroy() {
    this._boundEventListeners.forEach(cleanup => cleanup());
    this._boundEventListeners.clear();
    if (this._tableLinkHandler) {
      document.removeEventListener('click', this._tableLinkHandler);
    }
    this.selectedVertraege.clear();
    this.vertraege = [];
    this.unternehmenFolders = [];
    this.viewMode = 'folders';
    this.currentUnternehmenId = null;
    this.currentUnternehmenName = null;
  }
}

export const vertraegeList = new VertraegeList();
