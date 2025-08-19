// BriefingList.js (ES6-Modul)
// Briefing-Liste mit neuem Filtersystem

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';

export class BriefingList {
  constructor() {
    this.selectedBriefings = new Set();
    this._boundEventListeners = new Set();
  }

  // Initialisiere Briefing-Liste
  async init(id) {
    // Falls eine ID übergeben wurde, leite zu Detail-Modul um (wird in main.js gemappt)
    if (id && id !== 'new' && window.moduleRegistry) {
      // Immer zur Detailseite routen
      return window.navigateTo(`/briefing/${id}`);
    }

    window.setHeadline('Briefings Übersicht');

    const canView = (window.canViewPage && window.canViewPage('briefing')) || await window.checkUserPermission('briefing', 'can_view');
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Briefings anzuzeigen.</p>
        </div>
      `;
      return;
    }

    this.bindEvents();
    await this.loadAndRender();
  }

  async loadAndRender() {
    try {
      const filterData = await window.dataService.loadFilterData('briefing');
      await this.render(filterData);
      await this.initializeFilterBar();

      const currentFilters = filterSystem.getFilters('briefing');
      console.log('🔍 Lade Briefings mit Filter:', currentFilters);
      const briefings = await this.loadBriefingsWithRelations(currentFilters);
      console.log('📊 Briefings geladen:', briefings?.length || 0);
      this.updateTable(briefings);
    } catch (error) {
      window.ErrorHandler.handle(error, 'BriefingList.loadAndRender');
    }
  }

  async loadBriefingsWithRelations(filters = {}) {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar - verwende Mock-Daten');
        return await window.dataService.loadEntities('briefing', filters);
      }

      // Sichtbarkeit: Nicht-Admins nur eigene (assignee_id) ODER über zugewiesene Kooperation/Kampagne
      const isAdmin = window.currentUser?.rolle === 'admin';
      let allowedKampagneIds = [];
      let allowedKoopIds = [];
      if (!isAdmin) {
        try {
          const { data: assignedK } = await window.supabase
            .from('kampagne_mitarbeiter')
            .select('kampagne_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          allowedKampagneIds = (assignedK || []).map(r => r.kampagne_id).filter(Boolean);
          if (allowedKampagneIds.length > 0) {
            const { data: koops } = await window.supabase
              .from('kooperationen')
              .select('id')
              .in('kampagne_id', allowedKampagneIds);
            allowedKoopIds = (koops || []).map(k => k.id);
          }
        } catch (_) {}
      }

      // Basis-Query mit Embeds
      let query = window.supabase
        .from('briefings')
        .select(`
          *,
          unternehmen:unternehmen_id(id, firmenname),
          marke:marke_id(id, markenname),
          assignee:assignee_id(id, name)
        `)
        .order('created_at', { ascending: false });

      if (!isAdmin) {
        const orParts = [`assignee_id.eq.${window.currentUser?.id}`];
        if (allowedKoopIds.length) orParts.push(`kooperation_id.in.(${allowedKoopIds.join(',')})`);
        if (allowedKampagneIds.length) orParts.push(`kampagne_id.in.(${allowedKampagneIds.join(',')})`);
        query = query.or(orParts.join(','));
      }

      // Filters anwenden (einfach, analog DataService.applyFilters)
      if (filters) {
        const apply = (field, val, type = 'string') => {
          if (val == null || val === '' || val === '[object Object]') return;
          const v = String(val);
          switch (type) {
            case 'uuid':
              query = query.eq(field, v);
              break;
            case 'dateRange':
              if (val.from) query = query.gte(field, val.from);
              if (val.to) query = query.lte(field, val.to);
              break;
            case 'stringIlike':
              query = query.ilike(field, `%${v}%`);
              break;
            default:
              query = query.eq(field, v);
          }
        };

        apply('unternehmen_id', filters.unternehmen_id, 'uuid');
        apply('marke_id', filters.marke_id, 'uuid');
        apply('assignee_id', filters.assignee_id, 'uuid');
        apply('status', filters.status);
        if (filters.product_service_offer) apply('product_service_offer', filters.product_service_offer, 'stringIlike');
        if (filters.deadline) apply('deadline', filters.deadline, 'dateRange');
        if (filters.created_at) apply('created_at', filters.created_at, 'dateRange');
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = data || [];

      // Fallback-Maps laden, wenn Embeds fehlen
      const needUnternehmen = rows.filter(r => !r.unternehmen && r.unternehmen_id).map(r => r.unternehmen_id);
      const needMarke = rows.filter(r => !r.marke && r.marke_id).map(r => r.marke_id);

      this._unternehmenMap = {};
      this._markeMap = {};
      try {
        if (needUnternehmen.length > 0) {
          const uniq = Array.from(new Set(needUnternehmen));
          const { data: unternehmen } = await window.supabase
            .from('unternehmen')
            .select('id, firmenname')
            .in('id', uniq);
          (unternehmen || []).forEach(u => { this._unternehmenMap[u.id] = u; });
        }
        if (needMarke.length > 0) {
          const uniq = Array.from(new Set(needMarke));
          const { data: marken } = await window.supabase
            .from('marke')
            .select('id, markenname')
            .in('id', uniq);
          (marken || []).forEach(m => { this._markeMap[m.id] = m; });
        }
      } catch (relErr) {
        console.warn('⚠️ Konnte Fallback-Relationen für Briefings nicht vollständig laden:', relErr);
      }

      return rows.map(b => ({
        ...b,
        unternehmen: b.unternehmen || (b.unternehmen_id ? this._unternehmenMap[b.unternehmen_id] : null) || null,
        marke: b.marke || (b.marke_id ? this._markeMap[b.marke_id] : null) || null,
        assignee: b.assignee ? { name: b.assignee.name } : null
      }));
    } catch (error) {
      console.error('❌ Fehler beim Laden der Briefings mit Beziehungen:', error);
      return await window.dataService.loadEntities('briefing', filters);
    }
  }

  async render(filterData) {
    const canEdit = window.currentUser?.permissions?.briefing?.can_edit || false;

    const filterHtml = `<div class="filter-bar">
      <div class="filter-left">
        <div id="filter-container"></div>
      </div>
      <div class="filter-right">
        <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters() ? 'inline-block' : 'none'};">Filter zurücksetzen</button>
      </div>
    </div>`;

    const html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Briefings</h1>
          <p>Verwalten Sie alle Briefings</p>
        </div>
        <div class="page-header-right">
          <button id="btn-briefing-new" class="primary-btn">Neues Briefing anlegen</button>
        </div>
      </div>

      ${filterHtml}

      <div class="table-actions">
        <div class="table-actions-left">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
        </div>
        <div class="table-actions-right">
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-briefings"></th>
              <th>Produkt/Angebot</th>
              <th>Unternehmen</th>
              <th>Marke</th>
              <th>Status</th>
              <th>Deadline</th>
              <th>Zugewiesen</th>
              <th>Erstellt</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="briefings-table-body">
            <tr>
              <td colspan="9" class="loading">Lade Briefings...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-container');
    if (filterContainer) {
      await filterSystem.renderFilterBar('briefing', filterContainer,
        (filters) => this.onFiltersApplied(filters),
        () => this.onFiltersReset()
      );
    }
  }

  onFiltersApplied(filters) {
    console.log('🔍 BriefingList: Filter angewendet:', filters);
    filterSystem.applyFilters('briefing', filters);
    this.loadAndRender();
  }

  onFiltersReset() {
    console.log('🔄 BriefingList: Filter zurückgesetzt');
    filterSystem.resetFilters('briefing');
    this.loadAndRender();
  }

  bindEvents() {
    this.boundFilterResetHandler = (e) => {
      if (e.target.id === 'btn-filter-reset') {
        this.onFiltersReset();
      }
    };
    document.addEventListener('click', this.boundFilterResetHandler);

    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-briefing-new' || e.target.id === 'btn-briefing-new-filter') {
        e.preventDefault();
        window.navigateTo('/briefing/new');
      }
    });

    // Alle auswählen Button
    document.addEventListener('click', (e) => {
      if (e.target.id === 'btn-select-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.briefing-check');
        checkboxes.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.id) this.selectedBriefings.add(cb.dataset.id);
        });
        const selectAllHeader = document.getElementById('select-all-briefings');
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
        const checkboxes = document.querySelectorAll('.briefing-check');
        checkboxes.forEach(cb => { cb.checked = false; });
        this.selectedBriefings.clear();
        const selectAllHeader = document.getElementById('select-all-briefings');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = false;
        }
        this.updateSelection();
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'briefing') {
        e.preventDefault();
        const id = e.target.dataset.id;
        window.navigateTo(`/briefing/${id}`);
      }
    });

    window.addEventListener('entityUpdated', (e) => {
      if (e.detail.entity === 'briefing') {
        this.loadAndRender();
      }
    });

    document.addEventListener('change', (e) => {
      if (e.target.id === 'select-all-briefings') {
        const checkboxes = document.querySelectorAll('.briefing-check');
        const isChecked = e.target.checked;
        checkboxes.forEach(cb => {
          cb.checked = isChecked;
          if (isChecked) this.selectedBriefings.add(cb.dataset.id);
          else this.selectedBriefings.delete(cb.dataset.id);
        });
        this.updateSelection();
      }
    });

    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('briefing-check')) {
        if (e.target.checked) this.selectedBriefings.add(e.target.dataset.id);
        else this.selectedBriefings.delete(e.target.dataset.id);
        this.updateSelection();
        this.updateSelectAllCheckbox();
      }
    });
  }

  hasActiveFilters() {
    const filters = filterSystem.getFilters('briefing');
    return Object.keys(filters).length > 0;
  }

  updateSelection() {
    const selectedCount = this.selectedBriefings.size;
    const deselectBtn = document.getElementById('btn-deselect-all');
    const deleteBtn = document.getElementById('btn-delete-selected');
    if (deselectBtn) deselectBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    if (deleteBtn) deleteBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
  }

  updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all-briefings');
    const individualCheckboxes = document.querySelectorAll('.briefing-check');
    if (!selectAllCheckbox || individualCheckboxes.length === 0) return;
    const checkedBoxes = document.querySelectorAll('.briefing-check:checked');
    const allChecked = checkedBoxes.length === individualCheckboxes.length;
    const someChecked = checkedBoxes.length > 0;
    selectAllCheckbox.checked = allChecked;
    selectAllCheckbox.indeterminate = someChecked && !allChecked;
  }

  async updateTable(items) {
    const tbody = document.getElementById('briefings-table-body');
    if (!tbody) return;

    if (!items || items.length === 0) {
      const { renderEmptyState } = await import('../../core/FilterUI.js');
      renderEmptyState(tbody);
      return;
    }

    const formatDate = (date) => date ? new Date(date).toLocaleDateString('de-DE') : '-';
    const escapeHtml = (s) => window.validatorSystem.sanitizeHtml(s || '—');

    const rowsHtml = items.map(b => `
      <tr data-id="${b.id}">
        <td><input type="checkbox" class="briefing-check" data-id="${b.id}"></td>
        <td>
          <a href="#" class="table-link" data-table="briefing" data-id="${b.id}">
            ${escapeHtml((b.product_service_offer || '').toString().slice(0, 80))}
          </a>
        </td>
        <td>${escapeHtml(b.unternehmen?.firmenname || (this._unternehmenMap?.[b.unternehmen_id]?.firmenname))}</td>
        <td>${escapeHtml(b.marke?.markenname || (this._markeMap?.[b.marke_id]?.markenname))}</td>
        <td>
          <span class="status-badge status-${(b.status || 'unknown').toLowerCase()}">
            ${escapeHtml(b.status)}
          </span>
        </td>
        <td>${formatDate(b.deadline)}</td>
        <td>${escapeHtml(b.assignee?.name)}</td>
        <td>${formatDate(b.created_at)}</td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="briefing">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z"/></svg>
            </button>
            <div class="actions-dropdown">
              <a href="#" class="action-item" data-action="view" data-id="${b.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/><path fill-rule="evenodd" d="M.661 10c1.743-2.372 4.761-5 9.339-5 4.578 0 7.601 2.628 9.339 5-1.738 2.372-4.761 5-9.339 5-4.578 0-7.601-2.628-9.339-5zM10 15a5 5 0 100-10 5 5 0 000 10z" clip-rule="evenodd"/></svg>
                Details anzeigen
              </a>
              <a href="#" class="action-item" data-action="edit" data-id="${b.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path d="M5.433 13.917l-1.523 1.523a.75.75 0 001.06 1.06l1.523-1.523L5.433 13.917zM11.206 6.106L13.917 3.4a.75.75 0 011.06 1.06l-2.711 2.711-.693-.693z"/><path fill-rule="evenodd" d="M1.334 10.606a1.5 1.5 0 011.06-1.06l10.38-10.38a1.5 1.5 0 012.122 0l1.523 1.523a1.5 1.5 0 010 2.122l-10.38 10.38a1.5 1.5 0 01-1.06 1.06H1.334v-3.182z" clip-rule="evenodd"/></svg>
                Bearbeiten
              </a>
              <div class="action-separator"></div>
              <a href="#" class="action-item action-danger" data-action="delete" data-id="${b.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.368.298a.75.75 0 10.232 1.482l.175-.027c.572-.089 1.14-.19 1.706-.302A3.75 3.75 0 019.75 3h.5a3.75 3.75 0 013.657 3.234c.566.112 1.134.213 1.706.302l.175.027a.75.75 0 10.232-1.482A41.203 41.203 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM2.5 7.75a.75.75 0 01.75-.75h13.5a.75.75 0 010 1.5H3.25a.75.75 0 01-.75-.75zM7.25 9.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5H8a.75.75 0 01-.75-.75zM6 12.25a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM4.75 14.75a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5a.75.75 0 01-.75-.75z" clip-rule="evenodd"/></svg>
                Löschen
              </a>
            </div>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.innerHTML = rowsHtml;
  }

  // Optionales Formular (Platzhalter, bis echtes Formular existiert)
  showCreateForm() {
    window.setHeadline('Neues Briefing anlegen');

    const formHtml = window.formSystem.renderFormOnly('briefing');
    window.content.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Neues Briefing anlegen</h1>
          <p>Erstellen Sie ein neues Briefing</p>
        </div>
        <div class="page-header-right">
          <button onclick="window.navigateTo('/briefing')" class="secondary-btn">Zurück zur Übersicht</button>
        </div>
      </div>
      <div class="form-page">
        ${formHtml}
      </div>
    `;

    // Formular-Events binden (Validierung, dynamische Optionen etc.)
    window.formSystem.bindFormEvents('briefing', null);

    // Seiten-Submit an FormSystem delegieren
    const form = document.getElementById('briefing-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await window.formSystem.handleFormSubmit('briefing', null);
        // Nach Erfolg: zurück zur Liste
        setTimeout(() => window.navigateTo('/briefing'), 300);
      };
    }
  }

  destroy() {
    this._boundEventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this._boundEventListeners.clear();
    if (this.boundFilterResetHandler) {
      document.removeEventListener('click', this.boundFilterResetHandler);
      this.boundFilterResetHandler = null;
    }
  }
}

export const briefingList = new BriefingList();


