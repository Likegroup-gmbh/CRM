// Uebersicht der Masterlisten unter Creatordaten: Ordner je Unternehmen,
// darin die Listen. Eine Suche zeigt Treffer aus allen Ordnern.

import { SearchInput } from '../../core/components/SearchInput.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { renderEmptyStateRow } from '../../core/components/EmptyState.js';
import { fillFoldersGrid } from '../../core/components/GridFiller.js';
import { replaceRoute } from '../../core/breadcrumbTrail.js';
import { icon } from '../../core/icons/IconSystem.js';
import { canManageMasterliste, escapeHtml, filterLists, mapListRow } from './masterliste.js';
import {
  BASE_PATH,
  baueOrdner,
  leseOrdnerQuery,
  listenImOrdner,
  masterlistenCrumbs,
  ordnerUrl
} from './masterlisteOrdner.js';
import { closeMasterlisteFormDrawer, openMasterlisteFormDrawer } from './masterlisteFormDrawer.js';
import {
  listenSpaltenAnzahl,
  renderListenTabelle,
  renderOrdnerGrid,
  renderOrdnerTabelle
} from './masterlistenUebersichtRender.js';

const LIST_SELECT = `
  id, name, beschreibung, created_at, created_by, unternehmen_id,
  autor:created_by(name),
  unternehmen:unternehmen_id(id, firmenname, logo_url),
  members:creator_list_member(count)
`;

export class CreatorListPage {
  constructor() {
    this.lists = [];
    this.searchQuery = '';
    this.ordner = null;
    this.ansicht = 'grid';
    this.loaded = false;
    this.failed = false;
    this._abortController = null;
  }

  async init() {
    window.setHeadline?.('Masterlisten');
    this.ordner = leseOrdnerQuery(window.location.search);
    this.searchQuery = '';
    this.loaded = false;
    this.renderShell();
    await this.load();
  }

  renderShell() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;
    const canManage = canManageMasterliste();
    const navigation = this.ordner
      ? `<button type="button" id="masterlisten-zurueck" class="mdc-btn mdc-btn--secondary">${icon('arrow-left')} Zurück</button>`
      : ViewModeToggle.render([
        { buttonId: 'btn-masterlisten-list', label: 'Liste', icon: 'list', active: this.ansicht === 'list' },
        { buttonId: 'btn-masterlisten-grid', label: 'Grid', icon: 'grid', active: this.ansicht === 'grid' }
      ]);

    window.setContentSafely(window.content, `
      <div class="list-container">
        <div class="table-filter-wrapper">
          <div class="filter-bar">
            <div class="filter-left">
              ${navigation}
              ${SearchInput.render('masterliste', {
                placeholder: this.ordner ? 'In diesem Ordner suchen...' : 'Masterliste suchen...',
                currentValue: this.searchQuery
              })}
            </div>
          </div>
          <div class="table-actions">
            ${canManage ? '<button type="button" class="mdc-btn" data-action="create-masterliste">Neue Masterliste</button>' : ''}
          </div>
        </div>
        <div class="table-container table-container--creator-auswahl-list" id="masterlisten-inhalt"></div>
      </div>
    `);

    SearchInput.bind('masterliste', (value) => {
      this.searchQuery = value;
      this.updateContent();
    }, signal);
    this.bindEvents(signal);
    this.updateBreadcrumb();
    this.updateContent();
  }

  updateBreadcrumb() {
    window.breadcrumbSystem?.updateBreadcrumb?.(masterlistenCrumbs({ ordner: this.ordner }));
  }

  oeffneOrdner(ordner) {
    this.ordner = ordner;
    this.searchQuery = '';
    if (window.location.pathname === BASE_PATH) replaceRoute(ordnerUrl(ordner));
    this.renderShell();
  }

  bindEvents(signal) {
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="create-masterliste"]')) {
        e.preventDefault();
        this.openFormDrawer();
        return;
      }
      if (e.target.closest('#masterlisten-zurueck')) {
        e.preventDefault();
        this.oeffneOrdner(null);
        return;
      }
      const ansichtBtn = e.target.closest('#btn-masterlisten-list, #btn-masterlisten-grid');
      if (ansichtBtn) {
        e.preventDefault();
        const ansicht = ansichtBtn.id === 'btn-masterlisten-list' ? 'list' : 'grid';
        if (ansicht === this.ansicht) return;
        this.ansicht = ansicht;
        this.renderShell();
        return;
      }
      const ordnerEl = e.target.closest('[data-ordner-id]');
      if (ordnerEl) {
        e.preventDefault();
        const ordner = baueOrdner(this.lists).find(item => item.id === ordnerEl.dataset.ordnerId);
        this.oeffneOrdner(ordner || { id: ordnerEl.dataset.ordnerId, name: ordnerEl.dataset.ordnerName });
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

    this.loaded = true;
    this.failed = Boolean(error);
    if (error) console.error('Masterlisten konnten nicht geladen werden:', error);
    this.lists = error ? [] : (data || []).map(mapListRow);
    const echterOrdner = this.ordner && baueOrdner(this.lists).find(item => item.id === this.ordner.id);
    if (echterOrdner) {
      this.ordner = echterOrdner;
      this.updateBreadcrumb();
    }
    this.updateContent();
  }

  updateContent() {
    const inhalt = document.getElementById('masterlisten-inhalt');
    if (!inhalt) return;
    const suche = this.searchQuery.trim();
    const mitUnternehmen = !this.ordner;

    if (!this.loaded || this.failed || (!this.ordner && !suche)) {
      const leer = this.leerZustand(suche, mitUnternehmen);
      if (leer) {
        inhalt.innerHTML = renderListenTabelle([], { mitUnternehmen, bodyHtml: leer });
        return;
      }
      this.renderOrdner(inhalt);
      return;
    }

    const lists = filterLists(listenImOrdner(this.lists, this.ordner?.id), suche);
    const bodyHtml = lists.length ? null : this.leerZustand(suche, mitUnternehmen, { inOrdner: true });
    inhalt.innerHTML = renderListenTabelle(lists, { mitUnternehmen, canManage: canManageMasterliste(), bodyHtml });
    window.ActionsDropdown?.init?.();
  }

  renderOrdner(inhalt) {
    const ordner = baueOrdner(this.lists);
    if (this.ansicht === 'grid') {
      inhalt.innerHTML = `<div class="folders-grid" id="masterlisten-ordner-grid">${renderOrdnerGrid(ordner)}</div>`;
      fillFoldersGrid(document.getElementById('masterlisten-ordner-grid'));
      return;
    }
    inhalt.innerHTML = renderOrdnerTabelle(ordner);
  }

  /** Zeile für Laden, Fehler oder leere Ergebnisse; null, wenn es etwas zu zeigen gibt. */
  leerZustand(suche, mitUnternehmen, { inOrdner = false } = {}) {
    const cols = listenSpaltenAnzahl({ mitUnternehmen });
    if (!this.loaded) return `<tr><td colspan="${cols}" class="table-state-cell">Lade Masterlisten...</td></tr>`;
    if (this.failed) {
      return renderEmptyStateRow({ icon: 'list', title: 'Masterlisten konnten nicht geladen werden', text: 'Bitte die Seite neu laden.' }, cols);
    }
    if (suche) return renderEmptyStateRow({ icon: 'search', title: 'Keine Treffer', text: 'Keine Masterliste entspricht der Suche.' }, cols);
    if (inOrdner || !this.lists.length) {
      return renderEmptyStateRow({
        icon: 'list',
        title: inOrdner ? 'Keine Masterlisten in diesem Ordner' : 'Keine Masterlisten',
        text: 'Legen Sie eine Liste an, aus der das Team Creator für Kooperationen auswählt.',
        actionsHtml: canManageMasterliste()
          ? '<button type="button" class="mdc-btn" data-action="create-masterliste">Neue Masterliste</button>'
          : ''
      }, cols);
    }
    return null;
  }

  openFormDrawer(list = null) {
    if (!canManageMasterliste()) return;
    const unternehmen = this.ordner && !this.ordner.ohne ? { id: this.ordner.id, name: this.ordner.name } : null;
    openMasterlisteFormDrawer({
      list,
      unternehmen,
      onSubmit: (values) => (list ? this.saveList(list.id, values) : this.createList(values))
    });
  }

  async createList(values) {
    const { data, error } = await window.supabase
      .from('creator_list')
      .insert({
        ...values,
        created_by: window.currentUser?.id || null,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();
    if (error || !data?.id) {
      window.toastSystem?.show('Masterliste konnte nicht erstellt werden.', 'error');
      return false;
    }
    window.toastSystem?.show('Masterliste erstellt.', 'success');
    closeMasterlisteFormDrawer(true);
    window.navigateTo(`/creator-lists/${data.id}`);
    return true;
  }

  async saveList(id, values) {
    const { error } = await window.supabase.from('creator_list').update(values).eq('id', id);
    if (error) {
      window.toastSystem?.show('Speichern fehlgeschlagen.', 'error');
      return false;
    }
    window.toastSystem?.show('Masterliste gespeichert.', 'success');
    await this.load();
    return true;
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
    closeMasterlisteFormDrawer(true);
    this.lists = [];
  }
}

export const creatorListPage = new CreatorListPage();
