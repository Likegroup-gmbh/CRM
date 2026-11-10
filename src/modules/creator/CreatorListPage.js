// Uebersicht der Masterlisten unter Creatordaten.

import { SearchInput } from '../../core/components/SearchInput.js';
import { renderEmptyStateRow } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';
import {
  canManageMasterliste,
  escapeHtml,
  filterLists,
  formatDate,
  mapListRow
} from './masterliste.js';

const COLS = 5;
const LIST_SELECT = 'id, name, beschreibung, created_at, created_by, autor:created_by(name), members:creator_list_member(count)';

export class CreatorListPage {
  constructor() {
    this.lists = [];
    this.searchQuery = '';
    this._abortController = null;
  }

  async init() {
    window.setHeadline?.('Masterlisten');
    this.renderShell();
    await this.load();
  }

  renderShell() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;
    const canManage = canManageMasterliste();

    window.setContentSafely(window.content, `
      <div class="list-container">
        <div class="table-filter-wrapper">
          <div class="filter-bar">
            <div class="filter-left">
              ${SearchInput.render('masterliste', {
                placeholder: 'Masterliste suchen...',
                currentValue: this.searchQuery
              })}
            </div>
          </div>
          <div class="table-actions">
            ${canManage ? '<button type="button" class="mdc-btn" data-action="create-masterliste">Neue Masterliste</button>' : ''}
          </div>
        </div>
        <div class="table-container table-container--creator-auswahl-list">
          <table class="data-table data-table--creator-auswahl-list">
            <thead>
              <tr>
                <th class="col-name">Name</th>
                <th>Creator</th>
                <th>Erstellt von</th>
                <th>Erstellt am</th>
                <th class="col-actions">Aktionen</th>
              </tr>
            </thead>
            <tbody id="creator-lists-body">
              <tr><td colspan="${COLS}" class="table-state-cell">Lade Masterlisten...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `);

    SearchInput.bind('masterliste', (value) => {
      this.searchQuery = value;
      this.updateTable();
    }, signal);
    this.bindEvents(signal);
  }

  bindEvents(signal) {
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="create-masterliste"]')) {
        e.preventDefault();
        this.openFormDrawer();
        return;
      }
      const openBtn = e.target.closest('[data-action="view-masterliste"]');
      if (openBtn) {
        e.preventDefault();
        window.navigateTo(`/creator-lists/${openBtn.dataset.id}`);
        return;
      }
      const editBtn = e.target.closest('[data-action="rename-masterliste"]');
      if (editBtn) {
        e.preventDefault();
        const list = this.lists.find(item => item.id === editBtn.dataset.id);
        if (list) this.openFormDrawer(list);
        return;
      }
      const deleteBtn = e.target.closest('[data-action="delete-masterliste"]');
      if (deleteBtn) {
        e.preventDefault();
        this.handleDelete(deleteBtn.dataset.id);
        return;
      }
      const link = e.target.closest('.table-link[data-table="creator-lists"]');
      if (link) {
        e.preventDefault();
        window.navigateTo(`/creator-lists/${link.dataset.id}`);
        return;
      }
      const row = e.target.closest('tr[data-list-id]');
      if (row && !e.target.closest('.actions-dropdown-container') && !e.target.closest('a')) {
        window.navigateTo(`/creator-lists/${row.dataset.listId}`);
      }
    }, { signal });
  }

  async load() {
    const { data, error } = await window.supabase
      .from('creator_list')
      .select(LIST_SELECT)
      .order('name', { ascending: true });

    if (error) {
      console.error('Masterlisten konnten nicht geladen werden:', error);
      this.lists = [];
      this.updateTable({ failed: true });
      return;
    }
    this.lists = (data || []).map(mapListRow);
    this.updateTable();
    window.ActionsDropdown?.init?.();
  }

  updateTable({ failed = false } = {}) {
    const tbody = document.getElementById('creator-lists-body');
    if (!tbody) return;
    if (failed) {
      tbody.innerHTML = renderEmptyStateRow({
        icon: 'list',
        title: 'Masterlisten konnten nicht geladen werden',
        text: 'Bitte die Seite neu laden.'
      }, COLS);
      return;
    }
    const lists = filterLists(this.lists, this.searchQuery);
    if (!lists.length) {
      const searching = this.searchQuery.trim().length > 0;
      tbody.innerHTML = renderEmptyStateRow(searching ? {
        icon: 'search',
        title: 'Keine Treffer',
        text: 'Keine Masterliste entspricht der Suche.'
      } : {
        icon: 'list',
        title: 'Keine Masterlisten',
        text: 'Legen Sie eine Liste an, aus der das Team Creator für Kooperationen auswählt.',
        actionsHtml: canManageMasterliste()
          ? '<button type="button" class="mdc-btn" data-action="create-masterliste">Neue Masterliste</button>'
          : ''
      }, COLS);
      return;
    }
    tbody.innerHTML = lists.map(list => this.renderRow(list)).join('');
    window.ActionsDropdown?.init?.();
  }

  renderRow(list) {
    const beschreibung = list.beschreibung
      ? `<div class="text-muted">${escapeHtml(list.beschreibung)}</div>`
      : '';
    const menu = canManageMasterliste() ? `
      <div class="actions-dropdown-container" data-entity-type="creator_list">
        <button type="button" class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
          ${icon('dots-grid', { className: 'w-5 h-5' })}
        </button>
        <div class="actions-dropdown">
          <a href="#" class="action-item" data-action="view-masterliste" data-id="${escapeHtml(list.id)}">Öffnen</a>
          <a href="#" class="action-item" data-action="rename-masterliste" data-id="${escapeHtml(list.id)}">Bearbeiten</a>
          <div class="action-separator"></div>
          <a href="#" class="action-item action-danger" data-action="delete-masterliste" data-id="${escapeHtml(list.id)}">Löschen</a>
        </div>
      </div>
    ` : `
      <a href="#" class="table-link" data-table="creator-lists" data-id="${escapeHtml(list.id)}">Öffnen</a>
    `;
    return `
      <tr class="table-row-clickable" data-list-id="${escapeHtml(list.id)}">
        <td class="col-name">
          <a href="#" class="table-link" data-table="creator-lists" data-id="${escapeHtml(list.id)}">${escapeHtml(list.name || 'Ohne Namen')}</a>
          ${beschreibung}
        </td>
        <td>${list.count}</td>
        <td>${escapeHtml(list.autor || '-')}</td>
        <td>${formatDate(list.createdAt)}</td>
        <td class="col-actions">${menu}</td>
      </tr>
    `;
  }

  openFormDrawer(list = null) {
    if (!canManageMasterliste()) return;
    this.closeFormDrawer(true);
    const editing = Boolean(list?.id);

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = 'masterliste-form-overlay';
    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel';
    panel.id = 'masterliste-form-drawer';
    panel.innerHTML = `
      <div class="drawer-header">
        <div>
          <span class="drawer-title">${editing ? 'Masterliste bearbeiten' : 'Neue Masterliste'}</span>
          <p class="drawer-subtitle">${editing ? 'Name und Beschreibung dieser Liste' : 'Eine Liste, aus der das Team später Creator auswählt'}</p>
        </div>
        <div><button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button></div>
      </div>
      <div class="drawer-body">
        <form id="masterliste-form">
          <div class="form-group">
            <label class="form-label" for="masterliste-name">Name</label>
            <input type="text" id="masterliste-name" class="form-input" value="${escapeHtml(list?.name || '')}" required maxlength="120" placeholder="z. B. Beauty DACH">
          </div>
          <div class="form-group">
            <label class="form-label" for="masterliste-beschreibung">Beschreibung</label>
            <textarea id="masterliste-beschreibung" class="form-input" rows="3" maxlength="500" placeholder="Wofür das Team diese Liste nutzt">${escapeHtml(list?.beschreibung || '')}</textarea>
          </div>
          <div class="drawer-footer u-mt-lg">
            <button type="submit" class="mdc-btn">${editing ? 'Speichern' : 'Anlegen'}</button>
            <button type="button" class="mdc-btn mdc-btn--secondary" data-action="close-masterliste-form">Abbrechen</button>
          </div>
        </form>
      </div>
    `;

    const close = () => this.closeFormDrawer();
    overlay.addEventListener('click', close);
    panel.querySelector('.drawer-close-btn').addEventListener('click', close);
    panel.querySelector('[data-action="close-masterliste-form"]').addEventListener('click', close);
    panel.querySelector('#masterliste-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const name = panel.querySelector('#masterliste-name').value.trim();
      const beschreibung = panel.querySelector('#masterliste-beschreibung').value.trim();
      if (!name) {
        window.toastSystem?.show('Name darf nicht leer sein.', 'warning');
        return;
      }
      if (editing) this.saveList(list.id, name, beschreibung);
      else this.createList(name, beschreibung);
    });

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add('show'));
    panel.querySelector('#masterliste-name')?.focus();
  }

  closeFormDrawer(immediate = false) {
    const overlay = document.getElementById('masterliste-form-overlay');
    const panel = document.getElementById('masterliste-form-drawer');
    if (!panel) {
      overlay?.remove();
      return;
    }
    if (immediate) {
      overlay?.remove();
      panel.remove();
      return;
    }
    panel.classList.remove('show');
    setTimeout(() => {
      overlay?.remove();
      panel.remove();
    }, 300);
  }

  async createList(name, beschreibung) {
    const { data, error } = await window.supabase
      .from('creator_list')
      .insert({
        name,
        beschreibung: beschreibung || null,
        created_by: window.currentUser?.id || null,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();
    if (error || !data?.id) {
      window.toastSystem?.show('Masterliste konnte nicht erstellt werden.', 'error');
      return;
    }
    window.toastSystem?.show('Masterliste erstellt.', 'success');
    this.closeFormDrawer();
    window.navigateTo(`/creator-lists/${data.id}`);
  }

  async saveList(id, name, beschreibung) {
    const { error } = await window.supabase
      .from('creator_list')
      .update({ name, beschreibung: beschreibung || null })
      .eq('id', id);
    if (error) {
      window.toastSystem?.show('Speichern fehlgeschlagen.', 'error');
      return;
    }
    window.toastSystem?.show('Masterliste gespeichert.', 'success');
    this.closeFormDrawer();
    await this.load();
  }

  async handleDelete(listId) {
    const list = this.lists.find(item => item.id === listId);
    let confirmed = false;
    if (window.confirmationModal) {
      const result = await window.confirmationModal.open({
        title: 'Masterliste löschen',
        message: `„${escapeHtml(list?.name || 'Diese Liste')}“ wird gelöscht. Die Creator selbst bleiben erhalten.`,
        confirmText: 'Löschen',
        cancelText: 'Abbrechen',
        danger: true
      });
      confirmed = result?.confirmed;
    } else {
      confirmed = confirm('Diese Masterliste wirklich löschen? Die Creator bleiben erhalten.');
    }
    if (!confirmed) return;
    const { error } = await window.supabase.from('creator_list').delete().eq('id', listId);
    if (error) {
      window.toastSystem?.show('Löschen fehlgeschlagen.', 'error');
      return;
    }
    window.toastSystem?.show('Masterliste gelöscht.', 'success');
    await this.load();
  }

  destroy() {
    this._abortController?.abort();
    this._abortController = null;
    this.closeFormDrawer(true);
    this.lists = [];
  }
}

export const creatorListPage = new CreatorListPage();
