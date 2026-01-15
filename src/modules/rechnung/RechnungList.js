// RechnungList.js (ES6-Modul)
// Listenansicht für Rechnungen

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { actionsDropdown } from '../../core/ActionsDropdown.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';

export class RechnungList {
  constructor() {
    this.selectedRechnungen = new Set();
    this.rechnungen = []; // Speichert geladene Rechnungen für Download-Zugriff
    // Statische Status-Optionen für Rechnungen
    this.statusOptions = [
      { id: 'Offen', name: 'Offen' },
      { id: 'Rückfrage', name: 'Rückfrage' },
      { id: 'Bezahlt', name: 'Bezahlt' },
      { id: 'An Qonto gesendet', name: 'An Qonto gesendet' }
    ];
  }

  async init() {
    window.setHeadline('Rechnungen');
    
    // Breadcrumb für Listen-Seite
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Rechnung', url: '/rechnung', clickable: false }
      ]);
    }

    // Registriere beim BulkActionSystem für konsistente Bulk-Löschung
    if (window.bulkActionSystem) {
      window.bulkActionSystem.registerList('rechnung', this);
    }

    await this.loadAndRender();
    // Reload Liste bei Änderungen (z. B. Status geändert, gelöscht)
    window.addEventListener('entityUpdated', (e) => {
      if (e?.detail?.entity === 'rechnung') {
        const { action, id, field, value } = e.detail;
        // Bei Status-Update nur einzelne Zeile aktualisieren
        if (action === 'updated' && field === 'status' && id) {
          this.updateSingleRow(id, value);
        } else {
          // Bei anderen Aktionen (delete, bulk, etc.) komplett neu laden
          this.loadAndRender();
        }
      }
    });
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'btn-rechnung-new') {
        e.preventDefault();
        this.showCreateForm();
      }
    });
    
    // Download-Action Handler
    document.addEventListener('click', (e) => {
      const actionItem = e.target.closest('.action-item[data-action="download"]');
      if (actionItem) {
        e.preventDefault();
        const id = actionItem.dataset.id;
        this.handleDownload(id);
      }
    });
  }
  
  // Rechnung PDF herunterladen
  handleDownload(rechnungId) {
    const rechnung = this.rechnungen.find(r => r.id === rechnungId);
    if (!rechnung) {
      window.toastSystem?.show('Rechnung nicht gefunden', 'error');
      return;
    }
    
    if (!rechnung.pdf_url) {
      window.toastSystem?.show('Keine PDF für diese Rechnung hinterlegt', 'warning');
      return;
    }
    
    // PDF in neuem Tab öffnen / Download starten
    const link = document.createElement('a');
    link.href = rechnung.pdf_url;
    link.target = '_blank';
    link.download = `Rechnung_${rechnung.rechnung_nr || rechnungId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Aktualisiert eine einzelne Zeile im DOM statt die gesamte Liste neu zu laden
   * @param {string} id - Die Rechnungs-ID
   * @param {string} newStatus - Der neue Status
   */
  updateSingleRow(id, newStatus) {
    // 1. Zeile im DOM finden
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) {
      console.warn('⚠️ Zeile nicht gefunden, lade Liste neu');
      this.loadAndRender();
      return;
    }

    // 2. Lokales Rechnungs-Array aktualisieren
    const rechnung = this.rechnungen.find(r => r.id === id);
    if (rechnung) {
      rechnung.status = newStatus;
    }

    // 3. Status-Text in der Zeile aktualisieren (Spalte 9 = Index 8, oder 9 bei Admin mit Checkbox)
    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
    const statusCellIndex = isAdmin ? 9 : 8; // Bei Admin gibt es eine zusätzliche Checkbox-Spalte
    const statusCell = row.cells[statusCellIndex];
    if (statusCell) {
      statusCell.textContent = newStatus || '-';
    }

    // 4. Row-Class für farbliche Hervorhebung aktualisieren
    row.classList.remove('rechnung-row-paid', 'rechnung-row-overdue');
    
    if (newStatus === 'Bezahlt') {
      row.classList.add('rechnung-row-paid');
    } else if (rechnung?.zahlungsziel) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const zahlungsziel = new Date(rechnung.zahlungsziel);
      zahlungsziel.setHours(0, 0, 0, 0);
      if (zahlungsziel < today) {
        row.classList.add('rechnung-row-overdue');
      }
    }

    // 5. Actions-Dropdown aktualisieren (currentStatus für Checkmark)
    const actionsCell = row.cells[row.cells.length - 1];
    if (actionsCell && rechnung) {
      actionsCell.innerHTML = actionBuilder.create('rechnung', id, window.currentUser, {
        statusOptions: this.statusOptions,
        currentStatus: { id: newStatus, name: newStatus }
      });
    }

    console.log(`✅ Zeile ${id} inline aktualisiert: Status → ${newStatus}`);
  }

  async loadAndRender() {
    try {
      // PERFORMANCE: Keine separate loadFilterData() Query mehr!
      await this.render();

      await this.initializeFilterBar();

      const currentFilters = filterSystem.getFilters('rechnung');
      // Sichtbarkeit: Nicht-Admins nur Rechnungen aus ihren Kampagnen/Koops/Marken
      // Neue Logik: Marken-Zuordnung als Zusatzfilter
      // - Nur Unternehmen zugeordnet → Sieht ALLES vom Unternehmen
      // - Unternehmen + bestimmte Marken → Sieht NUR Inhalte der zugewiesenen Marken
      const isAdmin = window.currentUser?.rolle === 'admin';
      let allowedKampagneIds = [];
      let allowedKoopIds = [];
      let allowedUnternehmenIds = []; // Für Rechnungen direkt auf Unternehmen
      if (!isAdmin && window.supabase) {
        try {
          // 1. Direkt zugeordnete Kampagnen
          const { data: assignedKampagnen } = await window.supabase
            .from('kampagne_mitarbeiter')
            .select('kampagne_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          const directKampagnenIds = (assignedKampagnen || []).map(r => r.kampagne_id).filter(Boolean);
          
          // 2. Zugeordnete Marken MIT Unternehmen-Info
          const { data: assignedMarken } = await window.supabase
            .from('marke_mitarbeiter')
            .select('marke_id, marke:marke_id(unternehmen_id)')
            .eq('mitarbeiter_id', window.currentUser?.id);
          
          // Zugeordnete Marken mit ihren Unternehmen
          const markenMitUnternehmen = (assignedMarken || []).map(r => ({
            marke_id: r.marke_id,
            unternehmen_id: r.marke?.unternehmen_id
          })).filter(r => r.marke_id);
          
          // 3. Zugeordnete Unternehmen
          const { data: mitarbeiterUnternehmen } = await window.supabase
            .from('mitarbeiter_unternehmen')
            .select('unternehmen_id')
            .eq('mitarbeiter_id', window.currentUser?.id);
          
          const unternehmenIds = (mitarbeiterUnternehmen || [])
            .map(r => r.unternehmen_id)
            .filter(Boolean);
          
          // Für Rechnungen: Alle zugewiesenen Unternehmen erlauben
          allowedUnternehmenIds = [...unternehmenIds];
          
          // Erstelle Map: Unternehmen-ID → zugeordnete Marken-IDs
          const unternehmenMarkenMap = new Map();
          markenMitUnternehmen.forEach(r => {
            if (r.unternehmen_id) {
              if (!unternehmenMarkenMap.has(r.unternehmen_id)) {
                unternehmenMarkenMap.set(r.unternehmen_id, []);
              }
              unternehmenMarkenMap.get(r.unternehmen_id).push(r.marke_id);
            }
          });
          
          // Für jedes Unternehmen die erlaubten Marken ermitteln
          let allowedMarkenIds = [];
          
          for (const unternehmenId of unternehmenIds) {
            const explicitMarkenIds = unternehmenMarkenMap.get(unternehmenId);
            
            if (explicitMarkenIds && explicitMarkenIds.length > 0) {
              // User hat explizite Marken-Zuordnung → Nur diese Marken erlauben
              allowedMarkenIds.push(...explicitMarkenIds);
            } else {
              // Keine Marken-Zuordnung → ALLE Marken des Unternehmens erlauben
              const { data: alleMarken } = await window.supabase
                .from('marke')
                .select('id')
                .eq('unternehmen_id', unternehmenId);
              
              allowedMarkenIds.push(...(alleMarken || []).map(m => m.id));
            }
          }
          
          // Duplikate entfernen
          allowedMarkenIds = [...new Set(allowedMarkenIds)];
          
          // Kampagnen für erlaubte Marken laden
          let markenKampagnenIds = [];
          if (allowedMarkenIds.length > 0) {
            const { data: kampagnen } = await window.supabase
              .from('kampagne')
              .select('id')
              .in('marke_id', allowedMarkenIds);
            
            markenKampagnenIds = (kampagnen || []).map(k => k.id).filter(Boolean);
          }
          
          // Kombiniere alle Listen und entferne Duplikate
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
            erlaubteMarken: allowedMarkenIds.length,
            markenKampagnen: markenKampagnenIds.length,
            gesamtKampagnen: allowedKampagneIds.length,
            kooperationen: allowedKoopIds.length,
            unternehmen: allowedUnternehmenIds.length
          });
        } catch (error) {
          console.error('❌ Fehler beim Laden der Zuordnungen:', error);
        }
      }

      let rechnungen;
      // Für Mitarbeiter: Filtere nach zugewiesenen Kampagnen/Kooperationen/Unternehmen
      // Für Kunden: RLS-Policies filtern automatisch
      if (!isAdmin && window.currentUser?.rolle !== 'kunde' && (allowedKampagneIds.length || allowedKoopIds.length || allowedUnternehmenIds.length)) {
        const baseFilters = { ...currentFilters };
        rechnungen = await window.dataService.loadEntities('rechnung', baseFilters);
        rechnungen = (rechnungen || []).filter(r => {
          return (r.kampagne_id && allowedKampagneIds.includes(r.kampagne_id)) || 
                 (r.kooperation_id && allowedKoopIds.includes(r.kooperation_id)) ||
                 (r.unternehmen_id && allowedUnternehmenIds.includes(r.unternehmen_id));
        });
      } else {
        rechnungen = await window.dataService.loadEntities('rechnung', currentFilters);
      }
      this.rechnungen = rechnungen; // Speichern für Download-Zugriff
      await this.updateTable(rechnungen);
    } catch (error) {
      window.ErrorHandler?.handle?.(error, 'RechnungList.loadAndRender');
    }
  }

  async render() {
    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
    
    const html = `
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div id="filter-dropdown-container"></div>
        </div>
        <div class="table-actions">
          ${isAdmin ? `<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>
          <button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>
          <span id="selected-count" style="display:none;">0 ausgewählt</span>
          <button id="btn-download-selected" class="secondary-btn" style="display:none;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:16px;height:16px;margin-right:4px;vertical-align:middle;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15M9 12l3 3m0 0 3-3m-3 3V2.25" />
            </svg>
            Ausgewählte herunterladen
          </button>
          <button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>` : ''}
          ${window.currentUser?.permissions?.rechnung?.can_edit ? '<button id="btn-rechnung-new" class="primary-btn">Neue Rechnung anlegen</button>' : ''}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${isAdmin ? `<th><input type="checkbox" id="select-all-rechnungen"></th>` : ''}
              <th>Rechnungsname</th>
              <th>PO-Nummer</th>
              <th>Erstellt am</th>
              <th>Unternehmen</th>
              <th>Auftrag</th>
              <th>Creator</th>
              <th>Gestellt am</th>
              <th>Zahlungsziel</th>
              <th>Status</th>
              <th>Nettobetrag</th>
              <th>Videos</th>
              <th>Preis/Video</th>
              <th>Bruttobetrag</th>
              <th>Beleg</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody id="rechnungen-table-body">
            <tr>
              <td colspan="${isAdmin ? '14' : '13'}" class="loading">Lade Rechnungen...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  async initializeFilterBar() {
    const container = document.getElementById('filter-dropdown-container');
    if (!container) return;
    // Nutze das neue Filter-Dropdown System
    await filterDropdown.init('rechnung', container, {
      onFilterApply: (filters) => this.onFiltersApplied(filters),
      onFilterReset: () => this.onFiltersReset()
    });
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

    const isAdmin = window.currentUser?.rolle === 'admin' || window.currentUser?.rolle?.toLowerCase() === 'admin';
    const formatCurrency = (v) => v == null ? '-' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
    const formatDate = (v) => v ? new Intl.DateTimeFormat('de-DE').format(new Date(v)) : '-';

    await TableAnimationHelper.animatedUpdate(tbody, async () => {
      if (!rechnungen || rechnungen.length === 0) {
        const { renderEmptyState } = await import('../../core/FilterUI.js');
        renderEmptyState(tbody);
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const getRowClass = (rechnung) => {
        if (rechnung.status === 'Bezahlt') return 'rechnung-row-paid';
        if (rechnung.zahlungsziel) {
          const zahlungsziel = new Date(rechnung.zahlungsziel);
          zahlungsziel.setHours(0, 0, 0, 0);
          if (zahlungsziel < today) return 'rechnung-row-overdue';
        }
        return '';
      };

      tbody.innerHTML = rechnungen.map(r => `
        <tr data-id="${r.id}" class="${getRowClass(r)}">
          ${isAdmin ? `<td><input type="checkbox" class="rechnung-check" data-id="${r.id}"></td>` : ''}
          <td>${r.rechnung_nr || '-'}</td>
          <td>${r.po_nummer || '-'}</td>
          <td>${formatDate(r.created_at)}</td>
          <td>${r.unternehmen?.firmenname || '-'}</td>
          <td>${r.auftrag?.auftragsname || '-'}</td>
          <td>${[r.creator?.vorname, r.creator?.nachname].filter(Boolean).join(' ') || '-'}</td>
          <td>${formatDate(r.gestellt_am)}</td>
          <td>${formatDate(r.zahlungsziel)}</td>
          <td>${r.status || '-'}</td>
          <td>${formatCurrency(r.nettobetrag)}</td>
          <td>${r.videoanzahl || '-'}</td>
          <td>${r.videoanzahl && r.nettobetrag ? formatCurrency(r.nettobetrag / r.videoanzahl) : '-'}</td>
          <td>${formatCurrency(r.bruttobetrag)}</td>
          <td>${r.pdf_url ? `<a href="${r.pdf_url}" target="_blank" rel="noopener noreferrer">PDF</a>` : '-'}</td>
          <td>
            ${actionBuilder.create('rechnung', r.id, window.currentUser, { 
              statusOptions: this.statusOptions, 
              currentStatus: { id: r.status, name: r.status } 
            })}
          </td>
        </tr>
      `).join('');
    });

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

    // Buttons - onclick statt addEventListener um doppelte Handler zu vermeiden
    const selectAllBtn = document.getElementById('btn-select-all');
    if (selectAllBtn) {
      selectAllBtn.onclick = (e) => {
        e.preventDefault();
        document.querySelectorAll('.rechnung-check').forEach(cb => { cb.checked = true; this.selectedRechnungen.add(cb.dataset.id); });
        const header = document.getElementById('select-all-rechnungen');
        if (header) { header.indeterminate = false; header.checked = true; }
        this.updateSelectionUI();
      };
    }

    const deselectAllBtn = document.getElementById('btn-deselect-all');
    if (deselectAllBtn) {
      deselectAllBtn.onclick = (e) => {
        e.preventDefault();
        document.querySelectorAll('.rechnung-check').forEach(cb => { cb.checked = false; });
        this.selectedRechnungen.clear();
        const header = document.getElementById('select-all-rechnungen');
        if (header) { header.indeterminate = false; header.checked = false; }
        this.updateSelectionUI();
      };
    }

    const deleteBtn = document.getElementById('btn-delete-selected');
    if (deleteBtn) {
      deleteBtn.onclick = async (e) => {
        e.preventDefault();
        await this.showDeleteSelectedConfirmation();
      };
    }

    const downloadBtn = document.getElementById('btn-download-selected');
    if (downloadBtn) {
      downloadBtn.onclick = async (e) => {
        e.preventDefault();
        await this.downloadSelected();
      };
    }
  }

  // Ausgewählte Rechnungen herunterladen
  async downloadSelected() {
    const selectedIds = Array.from(this.selectedRechnungen);
    if (selectedIds.length === 0) {
      window.toastSystem?.show('Keine Rechnungen ausgewählt', 'warning');
      return;
    }

    // Rechnungen mit PDF-URLs aus gespeicherten Daten filtern
    const rechnungenToDownload = this.rechnungen.filter(r => 
      selectedIds.includes(r.id) && r.pdf_url
    );

    if (rechnungenToDownload.length === 0) {
      window.toastSystem?.show('Keine der ausgewählten Rechnungen hat eine PDF hinterlegt', 'warning');
      return;
    }

    const skipped = selectedIds.length - rechnungenToDownload.length;
    if (skipped > 0) {
      window.toastSystem?.show(`${skipped} Rechnung(en) ohne PDF übersprungen`, 'info');
    }

    window.toastSystem?.show(`Starte Download von ${rechnungenToDownload.length} Rechnung(en)...`, 'info');

    // Downloads nacheinander mit kurzer Verzögerung starten
    for (let i = 0; i < rechnungenToDownload.length; i++) {
      const rechnung = rechnungenToDownload[i];
      
      try {
        // PDF als Blob herunterladen
        const response = await fetch(rechnung.pdf_url);
        if (!response.ok) throw new Error(`Fehler beim Laden von ${rechnung.rechnung_nr}`);
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        // Download-Link erstellen und klicken
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `Rechnung_${rechnung.rechnung_nr || rechnung.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Blob URL freigeben
        URL.revokeObjectURL(blobUrl);
        
        // Kurze Verzögerung zwischen Downloads damit Browser nicht blockiert
        if (i < rechnungenToDownload.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`❌ Fehler beim Download von Rechnung ${rechnung.rechnung_nr}:`, error);
      }
    }

    window.toastSystem?.show(`${rechnungenToDownload.length} Rechnung(en) heruntergeladen`, 'success');
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
    const selectBtn = document.getElementById('btn-select-all');
    const deselectBtn = document.getElementById('btn-deselect-all');
    const downloadBtn = document.getElementById('btn-download-selected');
    const deleteBtn = document.getElementById('btn-delete-selected');
    if (countEl) { countEl.textContent = `${count} ausgewählt`; countEl.style.display = count > 0 ? 'inline' : 'none'; }
    if (selectBtn) selectBtn.style.display = count > 0 ? 'none' : 'inline-block';
    if (deselectBtn) deselectBtn.style.display = count > 0 ? 'inline-block' : 'none';
    if (downloadBtn) downloadBtn.style.display = count > 0 ? 'inline-flex' : 'none';
    if (deleteBtn) deleteBtn.style.display = count > 0 ? 'inline-block' : 'none';
  }

  async showDeleteSelectedConfirmation() {
    if (window.currentUser?.rolle !== 'admin' && window.currentUser?.rolle?.toLowerCase() !== 'admin') return;
    
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


