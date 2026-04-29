// RechnungList.js (ES6-Modul)
// Listenansicht für Rechnungen

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { actionsDropdown } from '../../core/ActionsDropdown.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { renderVertragCell } from './RechnungVertragColumn.js';
import { renderBezahltToggle } from './RechnungBezahltToggle.js';
import { renderTabButton } from '../../core/TabUtils.js';

export class RechnungList {
  _abortController = null;

  constructor() {
    this.selectedRechnungen = new Set();
    this.rechnungen = [];
    this._bezahltUpdateInFlight = new Set();
    this.activeStatusTab = 'alle';
    this.searchQuery = '';
    this._searchDebounceTimer = null;
    this.statusOptions = [
      { id: 'Offen', name: 'Offen' },
      { id: 'Rückfrage', name: 'Rückfrage' },
      { id: 'Bezahlt', name: 'Bezahlt' },
      { id: 'An Qonto gesendet', name: 'An Qonto gesendet' }
    ];
    this.statusTabs = [
      { id: 'alle', label: 'Alle' },
      { id: 'Offen', label: 'Offen' },
      { id: 'Rückfrage', label: 'Rückfrage' },
      { id: 'Bezahlt', label: 'Bezahlt' },
      { id: 'An Qonto gesendet', label: 'An Qonto gesendet' }
    ];
  }

  async init() {
    window.setHeadline('Rechnungen');

    // Registriere beim BulkActionSystem für konsistente Bulk-Löschung
    if (window.bulkActionSystem) {
      window.bulkActionSystem.registerList('rechnung', this);
    }

    await this.loadAndRender();

    this._abortController?.abort();
    this._abortController = new AbortController();
    const { signal } = this._abortController;

    // Reload Liste bei Änderungen (z. B. Status geändert, gelöscht)
    window.addEventListener('entityUpdated', (e) => {
      if (e?.detail?.entity === 'rechnung') {
        const { action, id, field, value } = e.detail;
        if (action === 'updated' && field === 'status' && id) {
          this.updateSingleRow(id, value);
        } else {
          this.loadAndRender();
        }
      }
    }, { signal });
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'btn-rechnung-new') {
        e.preventDefault();
        this.showCreateForm();
      }
    }, { signal });
    
    // Download-Action Handler
    document.addEventListener('click', (e) => {
      const actionItem = e.target.closest('.action-item[data-action="download"]');
      if (actionItem) {
        e.preventDefault();
        const id = actionItem.dataset.id;
        this.handleDownload(id);
      }
    }, { signal });
    
    // Bezahlt-Toggle direkt in der Tabelle
    document.addEventListener('change', async (e) => {
      const target = e.target;
      if (!target?.classList?.contains('rechnung-bezahlt-toggle')) return;

      const id = target.dataset.id;
      if (!id || this._bezahltUpdateInFlight.has(id)) return;

      const newStatus = target.checked ? 'Bezahlt' : 'Offen';
      this._bezahltUpdateInFlight.add(id);
      target.disabled = true;

      try {
        const result = await window.dataService.updateEntity('rechnung', id, { status: newStatus });
        if (result?.error) throw new Error(result.error);

        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'rechnung', id, action: 'updated', field: 'status', value: newStatus }
        }));
      } catch (err) {
        target.checked = !target.checked;
        window.toastSystem?.show?.('Fehler beim Ändern des Status', 'error');
        console.error('❌ Bezahlt-Toggle Fehler:', err);
      } finally {
        this._bezahltUpdateInFlight.delete(id);
        const isAdmin = window.isAdmin();
        target.disabled = !isAdmin;
      }
    }, { signal });

    // Status-Tab Klicks
    document.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.rechnung-status-tabs .tab-button');
      if (!tabBtn) return;
      e.preventDefault();
      const tab = tabBtn.dataset.tab;
      if (tab && tab !== this.activeStatusTab) {
        this.activeStatusTab = tab;
        document.querySelectorAll('.rechnung-status-tabs .tab-button').forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');
        this.updateTable(this.getFilteredRechnungen());
      }
    }, { signal });

    // Tabellen-Links in Rechnungstabelle
    document.addEventListener('click', (e) => {
      const link = e.target.closest('.table-link[data-table][data-id]');
      if (!link) return;
      e.preventDefault();
      const table = link.dataset.table;
      const id = link.dataset.id;
      if (table && id) {
        window.navigateTo(`/${table}/${id}`);
      }
    }, { signal });

    // Unternehmen-Quickfilter: Toggle, Reset, Click-Outside
    document.addEventListener('click', (e) => {
      const container = document.getElementById('rechnung-unternehmen-filter-container');
      const dropdown = document.getElementById('rechnung-unternehmen-filter-dropdown');
      const toggleButton = document.getElementById('rechnung-unternehmen-filter-toggle');
      if (!container || !dropdown || !toggleButton) return;

      const clickedToggle = e.target.closest('#rechnung-unternehmen-filter-toggle');
      if (clickedToggle) {
        e.preventDefault();
        e.stopPropagation();
        const willOpen = !dropdown.classList.contains('show');
        dropdown.classList.toggle('show', willOpen);
        toggleButton.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        return;
      }

      const clickedReset = e.target.closest('#rechnung-unternehmen-filter-reset');
      if (clickedReset) {
        e.preventDefault();
        this.applyUnternehmenQuickFilter([]);
        return;
      }

      if (!e.target.closest('#rechnung-unternehmen-filter-container')) {
        dropdown.classList.remove('show');
        toggleButton.setAttribute('aria-expanded', 'false');
      }
    }, { signal });

    // Unternehmen-Quickfilter: Checkbox-Toggles
    document.addEventListener('change', (e) => {
      if (!e.target.classList.contains('rechnung-unternehmen-filter-toggle-input')) return;

      const selectedIds = Array.from(
        document.querySelectorAll('.rechnung-unternehmen-filter-toggle-input:checked')
      ).map(input => input.value).filter(Boolean);

      this.applyUnternehmenQuickFilter(selectedIds);
    }, { signal });
  }
  
  // Rechnung PDF herunterladen
  handleDownload(rechnungId) {
    const rechnung = this.rechnungen.find(r => r.id === rechnungId);
    if (!rechnung) {
      window.toastSystem?.show('Rechnung nicht gefunden', 'error');
      return;
    }

    const pdfs = rechnung.rechnung_pdfs || [];
    if (pdfs.length === 0 && !rechnung.pdf_url) {
      window.toastSystem?.show('Keine PDF für diese Rechnung hinterlegt', 'warning');
      return;
    }

    const urls = pdfs.length > 0 ? pdfs.map(p => ({ url: p.open_url, name: p.file_name })) : [{ url: rechnung.pdf_url, name: `Rechnung_${rechnung.rechnung_nr || rechnungId}.pdf` }];
    for (const { url, name } of urls) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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

    // 3. Status-Text robust aktualisieren (unabhängig von Spaltenreihenfolge)
    let statusCell = row.querySelector('td[data-col="status"]');
    if (!statusCell) {
      const table = row.closest('table');
      const headerCells = table ? Array.from(table.querySelectorAll('thead th')) : [];
      const statusCellIndex = headerCells.findIndex((th) => th.textContent?.trim() === 'Status');
      if (statusCellIndex >= 0) {
        statusCell = row.cells[statusCellIndex];
      }
    }
    if (!statusCell) {
      console.warn('⚠️ Status-Zelle nicht gefunden, lade Liste neu');
      this.loadAndRender();
      return;
    }
    statusCell.textContent = newStatus || '-';

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

    // 5. Bezahlt-Toggle synchronisieren
    const toggle = row.querySelector('.rechnung-bezahlt-toggle');
    if (toggle) {
      toggle.checked = (newStatus === 'Bezahlt');
    }

    // 6. Actions-Dropdown aktualisieren (currentStatus für Checkmark)
    const actionsCell = row.cells[row.cells.length - 1];
    if (actionsCell && rechnung) {
      const isAdminRow = window.isAdmin();
      actionsCell.innerHTML = actionBuilder.create('rechnung', id, window.currentUser, {
        statusOptions: this.statusOptions,
        currentStatus: { id: newStatus, name: newStatus },
        restrictToPaid: (newStatus === 'Bezahlt') && !isAdminRow
      });
    }

    // 7. Tab-Counts aktualisieren + Zeile ggf. ausblenden wenn Tab aktiv
    this.updateStatusTabCounts();
    if (this.activeStatusTab !== 'alle' && newStatus !== this.activeStatusTab) {
      row.remove();
    }

    console.log(`✅ Zeile ${id} inline aktualisiert: Status → ${newStatus}`);
  }

  async loadAndRender() {
    try {
      // PERFORMANCE: Keine separate loadFilterData() Query mehr!
      await this.render();

      await this.initializeFilterBar();

      const rawFilters = filterSystem.getFilters('rechnung');
      const { unternehmen_ids: _uqf, ...currentFilters } = rawFilters;
      // Sichtbarkeit: Nicht-Admins nur Rechnungen aus ihren Kampagnen/Koops/Marken
      // Neue Logik: Marken-Zuordnung als Zusatzfilter
      // - Nur Unternehmen zugeordnet → Sieht ALLES vom Unternehmen
      // - Unternehmen + bestimmte Marken → Sieht NUR Inhalte der zugewiesenen Marken
      const isAdmin = window.isAdmin();
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
      const isMitarbeiter = window.isMitarbeiter();
      if (isMitarbeiter) {
        if (allowedKampagneIds.length || allowedKoopIds.length || allowedUnternehmenIds.length) {
          const baseFilters = { ...currentFilters };
          rechnungen = await window.dataService.loadEntities('rechnung', baseFilters);
          rechnungen = (rechnungen || []).filter(r => {
            return (r.kampagne_id && allowedKampagneIds.includes(r.kampagne_id)) || 
                   (r.kooperation_id && allowedKoopIds.includes(r.kooperation_id)) ||
                   (r.unternehmen_id && allowedUnternehmenIds.includes(r.unternehmen_id));
          });
        } else {
          console.log('ℹ️ Mitarbeiter ohne Zuordnungen – keine Rechnungen sichtbar');
          rechnungen = [];
        }
      } else {
        rechnungen = await window.dataService.loadEntities('rechnung', currentFilters);
      }
      // Unternehmen-Quickfilter clientseitig anwenden
      const quickFilterIds = this.getSelectedUnternehmenFilterIds();
      if (quickFilterIds.length > 0) {
        rechnungen = (rechnungen || []).filter(r => quickFilterIds.includes(r.unternehmen_id));
      }

      this.rechnungen = rechnungen;
      await this.enrichRechnungPdfs(rechnungen);
      await this.enrichKampagnenNames(rechnungen);
      this.updateStatusTabCounts();
      await this.updateTable(this.getFilteredRechnungen());
    } catch (error) {
      window.ErrorHandler?.handle?.(error, 'RechnungList.loadAndRender');
    }
  }

  async enrichKampagnenNames(rechnungen) {
    try {
      const ids = [...new Set((rechnungen || []).map(r => r.kampagne_id).filter(Boolean))];
      if (ids.length === 0) return;
      const { data, error } = await window.supabase
        .from('kampagne')
        .select('id, kampagnenname, eigener_name')
        .in('id', ids);
      if (error || !data) return;
      const map = new Map(data.map(k => [k.id, k]));
      rechnungen.forEach(r => {
        if (r.kampagne_id && map.has(r.kampagne_id)) {
          r.kampagne = map.get(r.kampagne_id);
        }
      });
    } catch (e) {
      console.warn('⚠️ Kampagnennamen konnten nicht nachgeladen werden:', e);
    }
  }

  async enrichRechnungPdfs(rechnungen) {
    try {
      const ids = (rechnungen || []).map(r => r.id).filter(Boolean);
      if (ids.length === 0) return;
      const { data, error } = await window.supabase
        .from('rechnung_pdfs')
        .select('id, rechnung_id, file_name, file_path, file_url')
        .in('rechnung_id', ids);
      if (error || !data) return;
      const map = new Map();
      for (const row of data) {
        if (!map.has(row.rechnung_id)) map.set(row.rechnung_id, []);
        const { data: urlData } = window.supabase.storage.from('rechnungen').getPublicUrl(row.file_path);
        map.get(row.rechnung_id).push({ ...row, open_url: urlData?.publicUrl || row.file_url || '' });
      }
      rechnungen.forEach(r => {
        r.rechnung_pdfs = map.get(r.id) || [];
      });
    } catch (e) {
      console.warn('⚠️ Rechnungs-PDFs konnten nicht nachgeladen werden:', e);
    }
  }

  renderCreatedBy(user) {
    if (!user || !user.name) return '-';
    const items = [{
      name: user.name,
      type: 'person',
      id: user.id,
      entityType: 'mitarbeiter',
      profile_image_url: user.profile_image_url
    }];
    return avatarBubbles.renderBubbles(items);
  }

  async render() {
    const isAdmin = window.isAdmin();
    
    const html = `
      <div class="table-filter-wrapper">
        <div class="filter-bar">
          <div class="filter-left">
            ${SearchInput.render('rechnung', {
              placeholder: 'Rechnung suchen...',
              currentValue: this.searchQuery
            })}
            <div id="filter-dropdown-container"></div>
            <div id="rechnung-unternehmen-filter-container"></div>
          </div>
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

      ${this.renderStatusTabs()}

      <div class="data-table-container rechnung-table-container">
        <table class="data-table data-table--nowrap data-table--rechnung">
          <thead>
            <tr>
              ${isAdmin ? `<th class="col-checkbox"><input type="checkbox" id="select-all-rechnungen"></th>` : ''}
              <th class="col-name">Rechnungsname</th>
              <th class="col-auftrag">Auftrag</th>
              <th class="col-po">PO-Nummer</th>
              <th class="col-created-at">Erstellt am</th>
              <th class="col-unternehmen">Unternehmen</th>
              <th class="col-kampagne">Kampagne</th>
              <th class="col-land">Land</th>
              <th class="col-creator">Creator</th>
              <th class="col-gestellt-am">Gestellt am</th>
              <th class="col-zahlungsziel">Zahlungsziel</th>
              <th class="col-netto">Nettobetrag</th>
              <th class="col-videos">Videos</th>
              <th class="col-preis-video">Preis/Video</th>
              <th class="col-brutto">Bruttobetrag</th>
              <th class="col-beleg">Beleg</th>
              <th class="col-vertrag">Vertrag</th>
              <th class="col-status">Status</th>
              <th class="col-erstellt-von">Erstellt von</th>
              <th class="table-cell-center col-bezahlt">Bezahlt</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody id="rechnungen-table-body">
            <tr>
              <td colspan="${isAdmin ? '21' : '20'}" class="loading">Lade Rechnungen...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  renderStatusTabs() {
    const tabs = this.statusTabs.map(t => renderTabButton({
      tab: t.id,
      label: `${t.label}<span class="tab-count" data-status-count="${t.id}">0</span>`,
      isActive: t.id === this.activeStatusTab,
      skipPermissionCheck: true
    })).join('');
    return `<div class="tab-navigation rechnung-status-tabs">${tabs}</div>`;
  }

  getFilteredRechnungen() {
    const searchFiltered = this.getSearchFilteredRechnungen();
    if (this.activeStatusTab === 'alle') return searchFiltered;
    return searchFiltered.filter(r => r.status === this.activeStatusTab);
  }

  getSearchFilteredRechnungen() {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) return this.rechnungen;

    return this.rechnungen.filter(r => {
      const searchableValues = [
        r.rechnung_nr,
        r.po_nummer,
        r.auftrag?.auftragsname,
        r.unternehmen?.firmenname,
        r.kampagne?.eigener_name,
        r.kampagne?.kampagnenname,
        r.land,
        [r.creator?.vorname, r.creator?.nachname].filter(Boolean).join(' '),
        r.status
      ];

      return searchableValues.some(value => String(value || '').toLowerCase().includes(query));
    });
  }

  updateStatusTabCounts() {
    const searchFiltered = this.getSearchFilteredRechnungen();
    const counts = { alle: searchFiltered.length };
    this.statusTabs.forEach(t => {
      if (t.id !== 'alle') {
        counts[t.id] = searchFiltered.filter(r => r.status === t.id).length;
      }
    });
    this.statusTabs.forEach(t => {
      const el = document.querySelector(`[data-status-count="${t.id}"]`);
      if (el) el.textContent = counts[t.id] || 0;
    });
  }

  handleSearch(query) {
    if (this._searchDebounceTimer) {
      clearTimeout(this._searchDebounceTimer);
    }

    this._searchDebounceTimer = setTimeout(async () => {
      this.searchQuery = query.trim();
      this.updateStatusTabCounts();
      await this.updateTable(this.getFilteredRechnungen());
    }, 300);
  }

  async initializeFilterBar() {
    const container = document.getElementById('filter-dropdown-container');
    if (!container) return;
    SearchInput.bind('rechnung', (value) => this.handleSearch(value));

    await filterDropdown.init('rechnung', container, {
      onFilterApply: (filters) => this.onFiltersApplied(filters),
      onFilterReset: () => this.onFiltersReset()
    });

    await this.initializeUnternehmenQuickFilter();
  }

  onFiltersApplied(filters) {
    const selectedUnternehmenIds = this.getSelectedUnternehmenFilterIds();
    const mergedFilters = { ...(filters || {}) };
    if (selectedUnternehmenIds.length > 0) {
      mergedFilters.unternehmen_ids = selectedUnternehmenIds;
    }
    filterSystem.applyFilters('rechnung', mergedFilters);
    this.loadAndRender();
    this.syncUnternehmenQuickFilterUI();
  }

  onFiltersReset() {
    filterSystem.resetFilters('rechnung');
    this.loadAndRender();
    this.syncUnternehmenQuickFilterUI();
  }

  hasActiveFilters() {
    const filters = filterSystem.getFilters('rechnung');
    return Object.keys(filters).length > 0;
  }

  async updateTable(rechnungen) {
    const tbody = document.getElementById('rechnungen-table-body');
    if (!tbody) return;

    const isAdmin = window.isAdmin();
    const canEdit = !window.isKunde();
    const canToggleBezahlt = isAdmin;
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
          ${isAdmin ? `<td class="col-checkbox"><input type="checkbox" class="rechnung-check" data-id="${r.id}"></td>` : ''}
          <td class="col-name">${r.rechnung_nr || '-'}</td>
          <td class="col-auftrag">${r.auftrag_id ? `<a href="#" class="table-link" data-table="auftragsdetails" data-id="${r.auftrag?.auftrag_details?.[0]?.id || r.auftrag_id}">${r.auftrag?.auftragsname || '-'}</a>` : '-'}</td>
          <td class="col-po">${r.po_nummer || '-'}</td>
          <td class="col-created-at">${formatDate(r.created_at)}</td>
          <td class="col-unternehmen">${r.unternehmen?.firmenname || '-'}</td>
          <td class="col-kampagne">${r.kampagne_id ? `<a href="#" class="table-link" data-table="kampagne" data-id="${r.kampagne_id}">${r.kampagne?.eigener_name || r.kampagne?.kampagnenname || '-'}</a>` : '-'}</td>
          <td class="col-land">${r.land || '-'}</td>
          <td class="col-creator">${[r.creator?.vorname, r.creator?.nachname].filter(Boolean).join(' ') || '-'}</td>
          <td class="col-gestellt-am">${formatDate(r.gestellt_am)}</td>
          <td class="col-zahlungsziel">${formatDate(r.zahlungsziel)}</td>
          <td class="col-netto">${formatCurrency(r.nettobetrag)}</td>
          <td class="col-videos">${r.videoanzahl || '-'}</td>
          <td class="col-preis-video">${r.videoanzahl && r.nettobetrag ? formatCurrency(r.nettobetrag / r.videoanzahl) : '-'}</td>
          <td class="col-brutto">${formatCurrency(r.bruttobetrag)}</td>
          <td class="col-beleg">${r.rechnung_pdfs && r.rechnung_pdfs.length > 0 ? r.rechnung_pdfs.map((p, i) => `<a href="${p.open_url}" target="_blank" rel="noopener noreferrer">PDF${r.rechnung_pdfs.length > 1 ? ' ' + (i + 1) : ''}</a>`).join(' ') : (r.pdf_url ? `<a href="${r.pdf_url}" target="_blank" rel="noopener noreferrer">PDF</a>` : '-')}</td>
          <td class="col-vertrag">${renderVertragCell(r)}</td>
          <td class="col-status" data-col="status">${r.status || '-'}</td>
          <td class="col-erstellt-von">${this.renderCreatedBy(r.created_by)}</td>
          <td class="table-cell-center col-bezahlt">${renderBezahltToggle(r, canToggleBezahlt)}</td>
          <td class="col-actions">
            ${actionBuilder.create('rechnung', r.id, window.currentUser, { 
              statusOptions: this.statusOptions, 
              currentStatus: { id: r.status, name: r.status },
              restrictToPaid: (r.status === 'Bezahlt') && !isAdmin
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

    this.bindDragToScroll();
  }

  // Drag-to-Scroll für horizontales Scrollen der Rechnungstabelle
  bindDragToScroll() {
    const container = document.querySelector('.rechnung-table-container');
    if (!container) return;

    this.dragScrollContainer = container;
    container.classList.add('drag-scroll-enabled');

    // Alte Event-Listener entfernen, falls vorhanden
    if (this._dragMouseDown) {
      container.removeEventListener('mousedown', this._dragMouseDown);
      container.removeEventListener('mousemove', this._dragMouseMove);
      container.removeEventListener('mouseup', this._dragMouseUp);
      container.removeEventListener('mouseleave', this._dragMouseUp);
    }

    this._dragMouseDown = (e) => {
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'BUTTON' ||
        e.target.closest('a') ||
        e.target.closest('button') ||
        e.target.closest('.actions-dropdown-container')
      ) {
        return;
      }

      this.isDragging = true;
      this.startX = e.pageX - container.offsetLeft;
      this.scrollLeft = container.scrollLeft;

      container.style.cursor = 'grabbing';
      container.style.userSelect = 'none';
      e.preventDefault();
    };

    this._dragMouseMove = (e) => {
      if (!this.isDragging) return;
      e.preventDefault();

      const x = e.pageX - container.offsetLeft;
      const walk = (x - this.startX) * 1.5;
      container.scrollLeft = this.scrollLeft - walk;
    };

    this._dragMouseUp = () => {
      if (this.isDragging) {
        this.isDragging = false;
        container.style.cursor = 'grab';
        container.style.userSelect = '';
      }
    };

    container.addEventListener('mousedown', this._dragMouseDown);
    container.addEventListener('mousemove', this._dragMouseMove);
    container.addEventListener('mouseup', this._dragMouseUp);
    container.addEventListener('mouseleave', this._dragMouseUp);
    container.style.cursor = 'grab';
  }

  // Ausgewählte Rechnungen herunterladen
  async downloadSelected() {
    const selectedIds = Array.from(this.selectedRechnungen);
    if (selectedIds.length === 0) {
      window.toastSystem?.show('Keine Rechnungen ausgewählt', 'warning');
      return;
    }

    // Rechnungen mit PDFs aus gespeicherten Daten filtern
    const rechnungenToDownload = this.rechnungen.filter(r => 
      selectedIds.includes(r.id) && ((r.rechnung_pdfs && r.rechnung_pdfs.length > 0) || r.pdf_url)
    );

    if (rechnungenToDownload.length === 0) {
      window.toastSystem?.show('Keine der ausgewählten Rechnungen hat eine PDF hinterlegt', 'warning');
      return;
    }

    const skipped = selectedIds.length - rechnungenToDownload.length;
    if (skipped > 0) {
      window.toastSystem?.show(`${skipped} Rechnung(en) ohne PDF übersprungen`, 'info');
    }

    // Alle PDF-URLs sammeln
    const allPdfs = [];
    for (const rechnung of rechnungenToDownload) {
      const pdfs = rechnung.rechnung_pdfs && rechnung.rechnung_pdfs.length > 0
        ? rechnung.rechnung_pdfs.map(p => ({ url: p.open_url, name: p.file_name || `Rechnung_${rechnung.rechnung_nr}.pdf` }))
        : [{ url: rechnung.pdf_url, name: `Rechnung_${rechnung.rechnung_nr || rechnung.id}.pdf` }];
      allPdfs.push(...pdfs);
    }

    window.toastSystem?.show(`Starte Download von ${allPdfs.length} PDF(s)...`, 'info');

    for (let i = 0; i < allPdfs.length; i++) {
      const pdf = allPdfs[i];

      try {
        const response = await fetch(pdf.url);
        if (!response.ok) throw new Error(`Fehler beim Laden von ${pdf.name}`);

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = pdf.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(blobUrl);

        if (i < allPdfs.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`❌ Fehler beim Download von ${pdf.name}:`, error);
      }
    }

    window.toastSystem?.show(`${allPdfs.length} PDF(s) heruntergeladen`, 'success');
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
    if (!window.isAdmin()) return;
    
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

  // ══════════════════════════════════════════════════════════════════════════
  // UNTERNEHMEN-QUICKFILTER
  // ══════════════════════════════════════════════════════════════════════════

  async initializeUnternehmenQuickFilter() {
    const container = document.getElementById('rechnung-unternehmen-filter-container');
    if (!container) return;

    this._unternehmenQuickFilterOptions = await this.loadUnternehmenQuickFilterOptions();
    container.innerHTML = this.renderUnternehmenQuickFilterHtml();
  }

  async loadUnternehmenQuickFilterOptions() {
    try {
      const { data, error } = await window.supabase
        .from('unternehmen')
        .select('id, firmenname')
        .order('firmenname');

      if (error) {
        console.warn('⚠️ RECHNUNGLIST: Unternehmen-Quickfilter konnte nicht geladen werden:', error);
        return [];
      }

      return (data || [])
        .filter(u => u?.id && u?.firmenname)
        .map(u => ({ id: u.id, name: u.firmenname }));
    } catch (error) {
      console.warn('⚠️ RECHNUNGLIST: Fehler bei Unternehmen-Quickfilter-Optionen:', error);
      return [];
    }
  }

  getSelectedUnternehmenFilterIds() {
    const currentFilters = filterSystem.getFilters('rechnung');
    const ids = currentFilters?.unternehmen_ids;
    if (!Array.isArray(ids)) return [];
    return ids.map(id => String(id).trim()).filter(Boolean);
  }

  renderUnternehmenQuickFilterHtml() {
    const selectedIds = this.getSelectedUnternehmenFilterIds();
    const selectedSet = new Set(selectedIds);
    const selectedCount = selectedIds.length;
    const hasOptions = this._unternehmenQuickFilterOptions?.length > 0;
    const optionsHtml = hasOptions
      ? this._unternehmenQuickFilterOptions.map((u, index) => {
          const inputId = `rechnung-unternehmen-filter-${index}`;
          const checked = selectedSet.has(u.id) ? 'checked' : '';
          const safeLabel = u.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');

          return `
            <label class="filter-checkbox-option" for="${inputId}">
              <span class="toggle-text">${safeLabel}</span>
              <span class="toggle-switch">
                <input type="checkbox"
                       id="${inputId}"
                       class="rechnung-unternehmen-filter-toggle-input"
                       value="${u.id}"
                       aria-label="${safeLabel}"
                       ${checked}>
                <span class="toggle-slider"></span>
              </span>
            </label>
          `;
        }).join('')
      : '<div class="filter-dropdown-empty">Keine Unternehmen gefunden</div>';

    return `
      <div class="filter-dropdown-container">
        <button id="rechnung-unternehmen-filter-toggle"
                class="filter-dropdown-toggle"
                aria-expanded="false"
                aria-label="Unternehmen filtern">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
            <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
            <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
            <path d="M10 6h4"/>
            <path d="M10 10h4"/>
            <path d="M10 14h4"/>
            <path d="M10 18h4"/>
          </svg>
          <span>Unternehmen</span>
          ${selectedCount > 0 ? `<span class="filter-count-badge">${selectedCount}</span>` : ''}
        </button>

        <div id="rechnung-unternehmen-filter-dropdown" class="filter-dropdown">
          <div class="filter-dropdown-header">
            <span class="filter-dropdown-title">Unternehmen filtern</span>
            <button id="rechnung-unternehmen-filter-reset" class="secondary-btn" ${selectedCount === 0 ? 'disabled' : ''}>
              Zurücksetzen
            </button>
          </div>
          <div class="filter-submenu-body">
            <div class="filter-submenu-checkboxes">
              ${optionsHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  applyUnternehmenQuickFilter(selectedIds) {
    const normalizedIds = Array.isArray(selectedIds)
      ? selectedIds.map(id => String(id).trim()).filter(Boolean)
      : [];

    const currentFilters = filterSystem.getFilters('rechnung') || {};
    const nextFilters = { ...currentFilters };

    if (normalizedIds.length > 0) {
      nextFilters.unternehmen_ids = normalizedIds;
    } else {
      delete nextFilters.unternehmen_ids;
    }

    filterSystem.applyFilters('rechnung', nextFilters);
    this.loadAndRender();
    this.updateUnternehmenQuickFilterMeta(normalizedIds.length);
  }

  syncUnternehmenQuickFilterUI() {
    const container = document.getElementById('rechnung-unternehmen-filter-container');
    if (!container) return;
    container.innerHTML = this.renderUnternehmenQuickFilterHtml();
  }

  updateUnternehmenQuickFilterMeta(selectedCount) {
    const toggleButton = document.getElementById('rechnung-unternehmen-filter-toggle');
    const resetButton = document.getElementById('rechnung-unternehmen-filter-reset');
    if (!toggleButton) return;

    let badge = toggleButton.querySelector('.filter-count-badge');
    if (selectedCount > 0) {
      if (!badge) {
        toggleButton.insertAdjacentHTML('beforeend', `<span class="filter-count-badge">${selectedCount}</span>`);
      } else {
        badge.textContent = String(selectedCount);
      }
    } else if (badge) {
      badge.remove();
    }

    if (resetButton) {
      resetButton.disabled = selectedCount === 0;
    }
  }

  destroy() {
    clearTimeout(this._searchDebounceTimer);
    this._abortController?.abort();
    this._abortController = null;

    if (this.dragScrollContainer) {
      this.dragScrollContainer.removeEventListener('mousedown', this._dragMouseDown);
      this.dragScrollContainer.removeEventListener('mousemove', this._dragMouseMove);
      this.dragScrollContainer.removeEventListener('mouseup', this._dragMouseUp);
      this.dragScrollContainer.removeEventListener('mouseleave', this._dragMouseUp);
      this.dragScrollContainer.classList.remove('drag-scroll-enabled');
      this.dragScrollContainer.style.cursor = '';
      this.dragScrollContainer.style.userSelect = '';
      this.isDragging = false;
      this.dragScrollContainer = null;
    }
  }
}

export const rechnungList = new RechnungList();


