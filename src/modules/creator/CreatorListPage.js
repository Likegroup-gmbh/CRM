// CreatorListPage.js (ES6-Modul)
// Listenübersicht für Creator-Listen mit konsistentem Look & Feel

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { actionsDropdown } from '../../core/ActionsDropdown.js';

export class CreatorListPage {
  constructor() {
    this.lists = [];
    // AbortController für sauberes Event-Listener Cleanup
    this._abortController = null;
  }

  async init() {
    window.setHeadline('Listen');
    await this.render();
    await this.load();
    await this.initFilters();
  }

  async render() {
    // Cleanup vorheriger Listener
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    const html = `
      <div class="page-header">
        <div class="page-header-right">
          <button id="btn-new-list" class="primary-btn">Neue Liste</button>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-left"><div id="filter-container"></div></div>
        <div class="filter-right">
          <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters() ? 'inline-block' : 'none'};">Filter zurücksetzen</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Creator</th>
              <th>Erstellt am</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="creator-lists-body">
            <tr><td colspan="4" class="loading">Lade Listen...</td></tr>
          </tbody>
        </table>
      </div>
    `;
    window.setContentSafely(window.content, html);
    
    document.getElementById('btn-new-list')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleCreateNewList();
    }, { signal });
  }

  // Neue Liste erstellen
  async handleCreateNewList() {
    try {
      const { data, error } = await window.supabase
        .from('creator_list')
        .insert({ name: 'Neue Liste', created_by: window.currentUser?.id, created_at: new Date().toISOString() })
        .select('id')
        .single();
      if (!error && data?.id) {
        window.navigateTo(`/creator-lists/${data.id}`);
      } else {
        window.toastSystem?.show('error', 'Liste konnte nicht erstellt werden.');
      }
    } catch (err) {
      console.error('Fehler beim Erstellen der Liste:', err);
      window.toastSystem?.show('error', 'Liste konnte nicht erstellt werden.');
    }
  }

  async initFilters() {
    const container = document.getElementById('filter-container');
    if (!container) return;
    await filterSystem.renderFilterBar('creator_list', container, (f) => this.onFiltersApplied(f), () => this.onFiltersReset());
  }

  onFiltersApplied(filters) {
    filterSystem.applyFilters('creator_list', filters);
    this.load();
  }

  onFiltersReset() {
    filterSystem.resetFilters('creator_list');
    this.load();
  }

  hasActiveFilters() {
    const filters = filterSystem.getFilters('creator_list');
    return Object.keys(filters).length > 0;
  }

  async load() {
    // Anzahl Creator je Liste via Subselect zählen
    const { data, error } = await window.supabase
      .from('creator_list')
      .select('id, name, created_at, members:creator_list_member(count)')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('❌ Fehler beim Laden der Listen:', error);
      return this.updateTable([]);
    }
    const lists = (data || []).map(r => ({ id: r.id, name: r.name, created_at: r.created_at, count: (r.members && r.members[0]?.count) || 0 }));
    this.lists = lists;
    this.updateTable(lists);
  }

  updateTable(lists) {
    const tbody = document.getElementById('creator-lists-body');
    if (!tbody) return;
    if (!lists || lists.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">Keine Listen vorhanden</td></tr>';
      return;
    }
    const formatDate = (v) => v ? new Intl.DateTimeFormat('de-DE').format(new Date(v)) : '-';
    const sanitize = (val) => window.validatorSystem?.sanitizeHtml(val) || val || '';
    
    tbody.innerHTML = lists.map(l => `
      <tr data-list-id="${sanitize(l.id)}">
        <td><a href="/creator-lists/${sanitize(l.id)}" class="list-link" data-list-id="${sanitize(l.id)}">${sanitize(l.name || l.id)}</a></td>
        <td>${l.count}</td>
        <td>${formatDate(l.created_at)}</td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="creator_list">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item" data-action="view" data-list-id="${sanitize(l.id)}">Details anzeigen</a>
              <a href="#" class="action-item action-danger" data-action="delete" data-list-id="${sanitize(l.id)}">Löschen</a>
            </div>
          </div>
        </td>
      </tr>
    `).join('');
    
    actionsDropdown.normalizeIcons(document);
    this.bindTableEvents();
  }

  // Binde Event-Listener für Tabelle (delegated events)
  bindTableEvents() {
    const signal = this._abortController?.signal;
    
    // Listen-Links
    document.addEventListener('click', (e) => {
      const listLink = e.target.closest('.list-link[data-list-id]');
      if (listLink) {
        e.preventDefault();
        const listId = listLink.dataset.listId;
        window.navigateTo(`/creator-lists/${listId}`);
      }
    }, { signal });
    
    // Action: View
    document.addEventListener('click', (e) => {
      const viewAction = e.target.closest('[data-action="view"][data-list-id]');
      if (viewAction) {
        e.preventDefault();
        const listId = viewAction.dataset.listId;
        window.navigateTo(`/creator-lists/${listId}`);
      }
    }, { signal });
    
    // Action: Delete
    document.addEventListener('click', (e) => {
      const deleteAction = e.target.closest('[data-action="delete"][data-list-id]');
      if (deleteAction) {
        e.preventDefault();
        const listId = deleteAction.dataset.listId;
        this.handleDeleteList(listId);
      }
    }, { signal });
  }

  // Liste löschen mit Bestätigung
  async handleDeleteList(listId) {
    let confirmed = false;
    
    if (window.confirmationModal) {
      const result = await window.confirmationModal.open({
        title: 'Liste löschen',
        message: 'Möchten Sie diese Liste wirklich löschen? Die zugeordneten Creator werden nicht gelöscht.',
        confirmText: 'Löschen',
        cancelText: 'Abbrechen',
        danger: true
      });
      confirmed = result?.confirmed;
    } else {
      confirmed = confirm('Möchten Sie diese Liste wirklich löschen?');
    }
    
    if (!confirmed) return;
    
    try {
      const { error } = await window.supabase
        .from('creator_list')
        .delete()
        .eq('id', listId);
      
      if (error) throw error;
      
      window.toastSystem?.show('success', 'Liste erfolgreich gelöscht.');
      
      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: { entity: 'creator_list', action: 'deleted', id: listId }
      }));
      
      // Tabelle neu laden
      await this.load();
    } catch (error) {
      console.error('❌ Fehler beim Löschen der Liste:', error);
      window.toastSystem?.show('error', 'Löschen fehlgeschlagen: ' + error.message);
    }
  }

  destroy() {
    console.log('🗑️ CREATORLISTPAGE: Destroy aufgerufen - räume auf');
    
    // AbortController: Entferne alle Event-Listener auf einmal
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    
    this.lists = [];
    console.log('✅ CREATORLISTPAGE: Destroy abgeschlossen');
  }
}

export const creatorListPage = new CreatorListPage();


