// RechnungList.js (ES6-Modul)
// Listenansicht für Rechnungen

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { actionsDropdown } from '../../core/ActionsDropdown.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';

export class RechnungList {
  constructor() {
    this.selectedRechnungen = new Set();
  }

  async init() {
    window.setHeadline('Rechnungen');
    
    // Breadcrumb für Listen-Seite
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Rechnung', url: '/rechnung', clickable: false }
      ]);
    }

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
      // PERFORMANCE: Keine separate loadFilterData() Query mehr!
      await this.render();

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

      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div id="filter-container"></div>
          <button id="btn-filter-reset" class="secondary-btn" style="display:${this.hasActiveFilters() ? 'inline-block' : 'none'};">Filter zurücksetzen</button>
        </div>
        <div class="table-actions">
          <button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
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
          ${actionBuilder.create('rechnung', r.id)}
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
    const selectedIds = Array.from(this.selectedRechnungen);
    if (selectedIds.length === 0) {
      alert('Keine Rechnungen ausgewählt.');
      return;
    }
    
    const message = selectedIds.length === 1 
      ? 'Möchten Sie die ausgewählte Rechnung wirklich löschen?' 
      : `Möchten Sie die ${selectedIds.length} ausgewählten Rechnungen wirklich löschen?`;

    const res = await window.confirmationModal.open({
      title: 'Löschvorgang bestätigen',
      message: message,
      confirmText: 'Endgültig löschen',
      cancelText: 'Abbrechen',
      danger: true
    });

    if (!res?.confirmed) return;

    console.log(`🗑️ Lösche ${selectedIds.length} Rechnungen...`);
    
    // Optimistisches UI-Update: Zeilen ausblenden
    selectedIds.forEach(id => {
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) row.style.opacity = '0.5';
    });

    try {
      // Batch-Delete für bessere Performance
      const result = await window.dataService.deleteEntities('rechnung', selectedIds);
      
      if (result.success) {
        // Entferne Zeilen aus DOM
        selectedIds.forEach(id => {
          document.querySelector(`tr[data-id="${id}"]`)?.remove();
        });
        
        alert(`✅ ${result.deletedCount} Rechnungen erfolgreich gelöscht.`);
        
        this.selectedRechnungen.clear();
        
        // Nur neu laden wenn Liste leer ist
        const tbody = document.querySelector('.data-table tbody');
        if (tbody && tbody.children.length === 0) {
          await this.loadAndRender();
        }
        
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'rechnung', action: 'bulk-deleted', count: result.deletedCount }
        }));
      } else {
        throw new Error(result.error || 'Löschen fehlgeschlagen');
      }
    } catch (error) {
      // Bei Fehler: Zeilen wiederherstellen
      selectedIds.forEach(id => {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) row.style.opacity = '1';
      });
      
      console.error('❌ Fehler beim Löschen:', error);
      alert(`❌ Fehler beim Löschen: ${error.message}`);
      
      // Liste neu laden um konsistenten Zustand herzustellen
      await this.loadAndRender();
    }
  }

  // Erstellungsformular aus der Liste heraus
  showCreateForm() {
    window.navigateTo('/rechnung/new');
  }
}

export const rechnungList = new RechnungList();


