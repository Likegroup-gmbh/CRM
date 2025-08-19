// CreatorListPage.js (ES6-Modul)
// Listenübersicht für Creator-Listen mit konsistentem Look & Feel

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { actionsDropdown } from '../../core/ActionsDropdown.js';

export class CreatorListPage {
  constructor() {
    this.lists = [];
  }

  async init() {
    window.setHeadline('Listen');
    await this.render();
    await this.load();
    await this.initFilters();
  }

  async render() {
    const html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Listen</h1>
          <p>Gespeicherte Creator-Listen</p>
        </div>
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
      // Minimaler Erstellen-Flow: leere Liste anlegen, dann Detailseite öffnen (falls vorhanden)
      (async () => {
        const { data, error } = await window.supabase
          .from('creator_list')
          .insert({ name: 'Neue Liste', created_by: window.currentUser?.id, created_at: new Date().toISOString() })
          .select('id')
          .single();
        if (!error && data?.id) {
          window.navigateTo(`/creator-lists/${data.id}`);
        } else {
          alert('Liste konnte nicht erstellt werden.');
        }
      })();
    });
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
    tbody.innerHTML = lists.map(l => `
      <tr>
        <td><a href="/creator-lists/${l.id}" onclick="event.preventDefault(); window.navigateTo('/creator-lists/${l.id}')">${window.validatorSystem.sanitizeHtml(l.name || l.id)}</a></td>
        <td>${l.count}</td>
        <td>${formatDate(l.created_at)}</td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="creator_list">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item" data-action="view" data-id="${l.id}" onclick="event.preventDefault(); window.navigateTo('/creator/${l.id}')">Details anzeigen</a>
              <a href="#" class="action-item action-danger" data-action="delete" data-id="${l.id}" onclick="event.preventDefault(); (async()=>{ try{ await window.supabase.from('creator_list').delete().eq('id','${l.id}'); window.dispatchEvent(new CustomEvent('entityUpdated',{detail:{entity:'creator_list',action:'deleted',id:'${l.id}'}})); }catch(e){ alert('Löschen fehlgeschlagen'); } })()">Löschen</a>
            </div>
          </div>
        </td>
      </tr>
    `).join('');
    actionsDropdown.normalizeIcons(document);
  }

  destroy() {}
}

export const creatorListPage = new CreatorListPage();


