// RechnungList.js (ES6-Modul)
// Listenansicht für Rechnungen

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { actionsDropdown } from '../../core/ActionsDropdown.js';

export class RechnungList {
  constructor() {
    this.selectedRechnungen = new Set();
  }

  async init() {
    window.setHeadline('Rechnungen');

    await this.loadAndRender();
    // Reload Liste bei Änderungen (z. B. Status geändert, gelöscht)
    window.addEventListener('entityUpdated', (e) => {
      if (e?.detail?.entity === 'rechnung') {
        this.loadAndRender();
      }
    });
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'btn-rechnung-new') {
        e.preventDefault();
        this.showCreateForm();
      }
    });
  }

  async loadAndRender() {
    try {
      const filterData = await window.dataService.loadFilterData('rechnung');
      await this.render(filterData);

      await this.initializeFilterBar();

      const currentFilters = filterSystem.getFilters('rechnung');
      // Sichtbarkeit: Nicht-Admins nur Rechnungen aus ihren Kampagnen/Koops/Marken
      const isAdmin = window.currentUser?.rolle === 'admin';
      let allowedKampagneIds = [];
      let allowedKoopIds = [];
      if (!isAdmin && window.supabase) {
        try {
          // 1. Direkt zugeordnete Kampagnen
          const { data: assignedKampagnen } = await window.supabase
            .from('kampagne_mitarbeiter')
            .select('kampagne_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          const directKampagnenIds = (assignedKampagnen || []).map(r => r.kampagne_id).filter(Boolean);
          
          // 2. Kampagnen über zugeordnete Marken
          const { data: assignedMarken } = await window.supabase
            .from('marke_mitarbeiter')
            .select('marke_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          const markenIds = (assignedMarken || []).map(r => r.marke_id).filter(Boolean);
          
          let markenKampagnenIds = [];
          if (markenIds.length > 0) {
            const { data: markenKampagnen } = await window.supabase
              .from('kampagne')
              .select('id')
              .in('marke_id', markenIds);
            markenKampagnenIds = (markenKampagnen || []).map(k => k.id).filter(Boolean);
          }
          
          // Kombiniere beide Listen und entferne Duplikate
          allowedKampagneIds = [...new Set([...directKampagnenIds, ...markenKampagnenIds])];
          
          // Kooperationen aus erlaubten Kampagnen laden
          if (allowedKampagneIds.length > 0) {
            const { data: koops } = await window.supabase
              .from('kooperationen')
              .select('id')
              .in('kampagne_id', allowedKampagneIds);
            allowedKoopIds = (koops || []).map(k => k.id);
          }
          
          console.log(`🔍 RECHNUNGLIST: Mitarbeiter ${window.currentUser?.id} hat Zugriff auf:`, {
            direkteKampagnen: directKampagnenIds.length,
            markenKampagnen: markenKampagnenIds.length,
            gesamtKampagnen: allowedKampagneIds.length,
            kooperationen: allowedKoopIds.length
          });
        } catch (error) {
          console.error('❌ Fehler beim Laden der Zuordnungen:', error);
        }
      }

      let rechnungen;
      // Für Mitarbeiter: Filtere nach zugewiesenen Kampagnen
      // Für Kunden: RLS-Policies filtern automatisch
      if (!isAdmin && window.currentUser?.rolle !== 'kunde' && (allowedKampagneIds.length || allowedKoopIds.length)) {
        const baseFilters = { ...currentFilters };
        // DataService.applyFilters wird später angewandt; wir schränken Query manuell in dataService.loadEntities ein → einfacher hier direkt mit RPC ersetzen ist nicht nötig.
        // Also: hole initial alle und filter clientseitig minimal, falls Supabase-Filter nicht einfach addierbar ist.
        rechnungen = await window.dataService.loadEntities('rechnung', baseFilters);
        rechnungen = (rechnungen || []).filter(r => {
          return (r.kampagne_id && allowedKampagneIds.includes(r.kampagne_id)) || (r.kooperation_id && allowedKoopIds.includes(r.kooperation_id));
        });
      } else {
        rechnungen = await window.dataService.loadEntities('rechnung', currentFilters);
      }
      this.updateTable(rechnungen);
    } catch (error) {
      window.ErrorHandler?.handle?.(error, 'RechnungList.loadAndRender');
    }
  }

  async render() {
    const html = `
      <div class="page-header">
        <div class="page-header-left">
          <h1>Rechnungen</h1>
          <p>Alle Rechnungen im Überblick</p>
        </div>
        <div class="page-header-right">
          ${window.currentUser?.permissions?.rechnung?.can_edit ? '<button id="btn-rechnung-new" class="primary-btn">Neue Rechnung anlegen</button>' : ''}
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-left">
          <div id="filter-container"></div>
        </div>
        <div class="filter-right">
          <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters() ? 'inline-block' : 'none'};">Filter zurücksetzen</button>
        </div>
      </div>

      <div class="table-actions">
        <div class="table-actions-left">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
        </div>
        <div class="table-actions-right">
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>
        </div>
      </div>

      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-rechnungen"></th>
              <th>Rechnungs-Nr</th>
              <th>Unternehmen</th>
              <th>Auftrag</th>
              <th>Creator</th>
              <th>Gestellt am</th>
              <th>Zahlungsziel</th>
              <th>Status</th>
              <th>Nettobetrag</th>
              <th>Bruttobetrag</th>
              <th>Beleg</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="rechnungen-table-body">
            <tr>
              <td colspan="9" class="loading">Lade Rechnungen...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  async initializeFilterBar() {
    const container = document.getElementById('filter-container');
    if (!container) return;
    await filterSystem.renderFilterBar('rechnung', container, 
      (filters) => this.onFiltersApplied(filters),
      () => this.onFiltersReset()
    );
  }

  onFiltersApplied(filters) {
    filterSystem.applyFilters('rechnung', filters);
    this.loadAndRender();
  }

  onFiltersReset() {
    filterSystem.resetFilters('rechnung');
    this.loadAndRender();
  }

  hasActiveFilters() {
    const filters = filterSystem.getFilters('rechnung');
    return Object.keys(filters).length > 0;
  }

  async updateTable(rechnungen) {
    const tbody = document.getElementById('rechnungen-table-body');
    if (!tbody) return;

    if (!rechnungen || rechnungen.length === 0) {
      const { renderEmptyState } = await import('../../core/FilterUI.js');
      renderEmptyState(tbody);
      return;
    }

    const formatCurrency = (v) => v == null ? '-' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
    const formatDate = (v) => v ? new Intl.DateTimeFormat('de-DE').format(new Date(v)) : '-';

    const rows = rechnungen.map(r => `
      <tr data-id="${r.id}">
        <td><input type="checkbox" class="rechnung-check" data-id="${r.id}"></td>
        <td>${r.rechnung_nr || '-'}</td>
        <td>${r.unternehmen?.firmenname || '-'}</td>
        <td>${r.auftrag?.auftragsname || '-'}</td>
        <td>${[r.creator?.vorname, r.creator?.nachname].filter(Boolean).join(' ') || '-'}</td>
        <td>${formatDate(r.gestellt_am)}</td>
        <td>${formatDate(r.zahlungsziel)}</td>
        <td>${r.status || '-'}</td>
        <td>${formatCurrency(r.nettobetrag)}</td>
        <td>${formatCurrency(r.bruttobetrag)}</td>
        <td>${r.pdf_url ? `<a href="${r.pdf_url}" target="_blank" rel="noopener noreferrer">PDF</a>` : '-'}</td>
        <td>
          <div class="actions-dropdown-container" data-entity-type="rechnung">
            <button class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
                <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
              </svg>
            </button>
            <div class="actions-dropdown">
              <div class="action-submenu">
                <a href="#" class="action-item has-submenu" data-submenu="status">${actionsDropdown.getHeroIcon('invoice')}<span>Status ändern</span></a>
                <div class="submenu" data-submenu="status">
                  ${[ 
                    { label: 'Offen', icon: 'status-offen' },
                    { label: 'Rückfrage', icon: 'status-rueckfrage' },
                    { label: 'Bezahlt', icon: 'status-bezahlt' },
                    { label: 'An Qonto gesendet', icon: 'status-qonto' }
                  ].map(item => `
                    <a href="#" class="submenu-item" data-action="set-field" data-field="status" data-value="${item.label}" data-id="${r.id}">
                      ${actionsDropdown.getHeroIcon(item.icon)}
                      <span>${item.label}</span>
                      ${r.status === item.label ? '<span class="submenu-check">'+actionsDropdown.getHeroIcon('check')+'</span>' : ''}
                    </a>
                  `).join('')}
                </div>
              </div>
              <a href="#" class="action-item" data-action="view" data-id="${r.id}">Details ansehen</a>
              <a href="#" class="action-item" data-action="edit" data-id="${r.id}">Bearbeiten</a>
              <div class="action-separator"></div>
              <a href="#" class="action-item action-danger" data-action="delete" data-id="${r.id}">Löschen</a>
            </div>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.innerHTML = rows;

    // Checkbox Events
    document.querySelectorAll('.rechnung-check').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        if (e.target.checked) {
          this.selectedRechnungen.add(id);
        } else {
          this.selectedRechnungen.delete(id);
        }
        this.updateSelectionUI();
        this.updateHeaderSelectAll();
      });
    });

    // Select-All Header
    const headerCb = document.getElementById('select-all-rechnungen');
    if (headerCb) {
      headerCb.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        document.querySelectorAll('.rechnung-check').forEach(cb => {
          cb.checked = isChecked;
          if (isChecked) this.selectedRechnungen.add(cb.dataset.id); else this.selectedRechnungen.delete(cb.dataset.id);
        });
        this.updateSelectionUI();
      });
    }

    // Buttons
    document.getElementById('btn-select-all')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.rechnung-check').forEach(cb => { cb.checked = true; this.selectedRechnungen.add(cb.dataset.id); });
      const header = document.getElementById('select-all-rechnungen');
      if (header) { header.indeterminate = false; header.checked = true; }
      this.updateSelectionUI();
    });

    document.getElementById('btn-deselect-all')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.rechnung-check').forEach(cb => { cb.checked = false; });
      this.selectedRechnungen.clear();
      const header = document.getElementById('select-all-rechnungen');
      if (header) { header.indeterminate = false; header.checked = false; }
      this.updateSelectionUI();
    });

    document.getElementById('btn-delete-selected')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await this.deleteSelected();
    });
  }

  updateHeaderSelectAll() {
    const header = document.getElementById('select-all-rechnungen');
    const all = document.querySelectorAll('.rechnung-check');
    if (!header || all.length === 0) return;
    const checked = document.querySelectorAll('.rechnung-check:checked').length;
    header.checked = checked === all.length;
    header.indeterminate = checked > 0 && checked < all.length;
  }

  updateSelectionUI() {
    const count = this.selectedRechnungen.size;
    const countEl = document.getElementById('selected-count');
    const deselectBtn = document.getElementById('btn-deselect-all');
    const deleteBtn = document.getElementById('btn-delete-selected');
    if (countEl) { countEl.textContent = `${count} ausgewählt`; countEl.style.display = count > 0 ? 'inline' : 'none'; }
    if (deselectBtn) deselectBtn.style.display = count > 0 ? 'inline-block' : 'none';
    if (deleteBtn) deleteBtn.style.display = count > 0 ? 'inline-block' : 'none';
  }

  async deleteSelected() {
    const ids = Array.from(this.selectedRechnungen);
    if (ids.length === 0) return;
    const ok = confirm(ids.length === 1 ? 'Ausgewählte Rechnung löschen?' : `${ids.length} Rechnungen löschen?`);
    if (!ok) return;
    let success = 0, fail = 0;
    for (const id of ids) {
      try {
        const res = await window.dataService.deleteEntity('rechnung', id);
        if (res.success) success++; else fail++;
      } catch { fail++; }
    }
    alert(`Löschvorgang abgeschlossen: ${success} erfolgreich${fail ? `, ${fail} fehlgeschlagen` : ''}.`);
    this.selectedRechnungen.clear();
    await this.loadAndRender();
  }

  // Erstellungsformular aus der Liste heraus
  showCreateForm() {
    window.navigateTo('/rechnung/new');
  }
}

export const rechnungList = new RechnungList();


