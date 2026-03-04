// AuftragList.js (ES6-Modul)
// Auftrags-Liste mit Filter, Verwaltung und Pagination
// Performance-optimierte Version

import { modularFilterSystem as filterSystem } from '../../core/filters/ModularFilterSystem.js';
import { filterDropdown } from '../../core/filters/FilterDropdown.js';
import { SearchInput } from '../../core/components/SearchInput.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { PaginationSystem } from '../../core/PaginationSystem.js';
import { AuftragFilterLogic } from './filters/AuftragFilterLogic.js';
import { AuftragCashFlowCalendar } from './AuftragCashFlowCalendar.js';
import { TableAnimationHelper } from '../../core/TableAnimationHelper.js';
import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';

// Statische Formatter (einmalig definiert, nicht bei jedem Render)
const currencyFormatter = new Intl.NumberFormat('de-DE', { 
  style: 'currency', currency: 'EUR',
  minimumFractionDigits: 0, maximumFractionDigits: 0
});

const numberFormatter = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 0, maximumFractionDigits: 0
});

// Kampagne-Art Abkürzungen (statisch)
const KAMPAGNE_ART_ABBR = {
  'UGC Pro Paid': 'UPP',
  'UGC Pro Organic': 'UPO',
  'UGC Video Paid': 'UVP',
  'UGC Video Organic': 'UVO',
  'Influencer Kampagne': 'IK',
  'Vor Ort Produktionen': 'VOP',
  'UGC Kampagne': 'UVO',
  'UGC': 'UVO',
  'IGC': 'UPO',
  'Influencer': 'IN',
  'Content Creation': 'CC'
};

// SVG Icons (statisch, einmalig definiert)
const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: var(--icon-xs); height: var(--icon-xs); display: inline-block; vertical-align: middle;"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>`;
const CROSS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: var(--icon-xs); height: var(--icon-xs); display: inline-block; vertical-align: middle;"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>`;

export class AuftragList {
  constructor() {
    this.selectedAuftraege = new Set();
    this._boundEventListeners = new Set();
    this.boundFilterResetHandler = null;
    this.pagination = new PaginationSystem();
    this.currentView = 'list'; // 'list' oder 'calendar'
    this.cashFlowCalendar = null;
    this._auftragNewBound = false;
    this._globalEventsBound = false;
    this._inlineDatePickerCleanup = null;
    this._isAdmin = null; // Gecachter Admin-Status
    this.isDragging = false;
    this.startX = 0;
    this.scrollLeft = 0;
    this.dragScrollContainer = null;
    this._dragToScrollCleanup = null;
    
    // Suchfeld
    this.searchQuery = '';
    this._searchDebounceTimer = null;
    
    // Finanzdaten
    this.monthlyRevenue = { total: 0, auftraege: [] };
    this.monthlyExpenses = { total: 0, rechnungen: [] };
    this.financialsHidden = localStorage.getItem('auftrag-financials-hidden') === 'true';
    
    // Farben für Umsatz-Balken
    this.revenueColors = [
      '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444',
      '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
    ];
    
    // Farben für Ausgaben-Balken
    this.expenseColors = [
      '#ef4444', '#f97316', '#f59e0b', '#dc2626', '#ea580c',
      '#d97706', '#b91c1c', '#c2410c', '#b45309', '#991b1b'
    ];
  }

  // Gecachte Admin-Prüfung
  get isAdmin() {
    if (this._isAdmin === null) {
      this._isAdmin = window.currentUser?.rolle === 'admin' || 
                      window.currentUser?.rolle?.toLowerCase() === 'admin';
    }
    return this._isAdmin;
  }

  // Admin-Cache invalidieren (z.B. bei User-Wechsel)
  invalidateAdminCache() {
    this._isAdmin = null;
  }

  // Formatierungs-Hilfsmethoden (einmalig definiert)
  formatCurrency(value) {
    return value ? currencyFormatter.format(value) : '-';
  }

  formatNumber(value) {
    return numberFormatter.format(value);
  }

  formatDate(date) {
    return date ? new Date(date).toLocaleDateString('de-DE') : '-';
  }

  formatZahlungsziel(tage) {
    if (tage === null || tage === undefined) return '-';
    if (tage === 0) return 'Sofort';
    return `${tage} Tage`;
  }

  formatBoolean(value) {
    return value ? CHECK_ICON : CROSS_ICON;
  }

  renderBillingDateCell(auftrag, boolField, dateField) {
    if (!this.isAdmin) {
      return this.formatBoolean(Boolean(auftrag[boolField]));
    }
    const label = boolField === 'rechnung_gestellt' ? 'Rechnung gestellt am' : 'Ueberwiesen am';
    return CustomDatePicker.render({
      id: auftrag.id,
      field: boolField,
      dateField,
      value: auftrag[dateField],
      label,
      inputClass: 'auftrag-inline-date-input'
    });
  }

  updateAuftragRowStatusClass(row) {
    if (!row) return;
    const isUeberwiesen = row.dataset.ueberwiesen === 'true';
    const isRechnungGestellt = row.dataset.rechnungGestellt === 'true';
    row.classList.remove('auftrag-row--ueberwiesen', 'auftrag-row--rechnung-gestellt');
    if (isUeberwiesen) {
      row.classList.add('auftrag-row--ueberwiesen');
    } else if (isRechnungGestellt) {
      row.classList.add('auftrag-row--rechnung-gestellt');
    }
  }

  syncInlineBillingUpdate(auftragId, dateField, value) {
    const row = document.querySelector(`.data-table tr[data-id="${auftragId}"]`);
    if (!row) {
      this.loadAndRender();
      return;
    }

    if (dateField === 'rechnung_gestellt_am') {
      row.dataset.rechnungGestellt = String(Boolean(value));
    } else if (dateField === 'ueberwiesen_am') {
      row.dataset.ueberwiesen = String(Boolean(value));
    }
    this.updateAuftragRowStatusClass(row);

    const inputSelector = dateField === 'rechnung_gestellt_am'
      ? '.col-rechnung-gestellt .auftrag-inline-date-input'
      : '.col-ueberwiesen .auftrag-inline-date-input';
    const input = row.querySelector(inputSelector);
    if (!input) return;

    CustomDatePicker.setValue(input, value || '');
    input.dataset.previousValue = value || '';
  }

  async handleInlineBillingDateChange(input) {
    if (!this.isAdmin || !input) return;

    const auftragId = input.dataset.id;
    const boolField = input.dataset.field;
    const dateField = input.dataset.dateField;
    if (!auftragId || !boolField || !dateField) return;

    const previousValue = input.dataset.previousValue || '';
    const nextValue = CustomDatePicker.getValue(input);
    if (nextValue === previousValue) return;

    const payload = nextValue
      ? { [dateField]: nextValue, [boolField]: true }
      : { [dateField]: null, [boolField]: false };

    CustomDatePicker.setDisabled(input, true);
    try {
      const result = await window.dataService.updateEntity('auftrag', auftragId, payload);
      if (!result?.success) {
        throw new Error(result?.error || 'Update fehlgeschlagen');
      }

      input.dataset.previousValue = nextValue;

      const row = input.closest('tr');
      if (row) {
        if (boolField === 'rechnung_gestellt') {
          row.dataset.rechnungGestellt = String(Boolean(nextValue));
        } else if (boolField === 'ueberwiesen') {
          row.dataset.ueberwiesen = String(Boolean(nextValue));
        }
        this.updateAuftragRowStatusClass(row);
      }

      window.dispatchEvent(new CustomEvent('entityUpdated', {
        detail: {
          entity: 'auftrag',
          action: 'updated',
          id: auftragId,
          field: dateField,
          value: nextValue || null
        }
      }));
    } catch (error) {
      console.error('❌ Fehler beim Inline-Update des Datums:', error);
      CustomDatePicker.setValue(input, previousValue);
      window.toastSystem?.show('Aktualisierung fehlgeschlagen', 'error');
    } finally {
      CustomDatePicker.setDisabled(input, false);
    }
  }

  formatKampagneArtTags(arten) {
    if (!arten || !Array.isArray(arten) || arten.length === 0) return '-';
    
    const tags = arten.map(art => {
      const abbr = KAMPAGNE_ART_ABBR[art] || art.substring(0, 2).toUpperCase();
      return `<span class="tag tag--kampagne-art" title="${art}">${abbr}</span>`;
    }).join('');
    
    return `<div class="tags tags-compact">${tags}</div>`;
  }

  formatAnsprechpartner(person) {
    if (!person) return '-';
    const fullName = [person.vorname, person.nachname].filter(Boolean).join(' ');
    if (!fullName) return '-';
    
    return avatarBubbles.renderBubbles([{
      name: fullName,
      type: 'person',
      id: person.id,
      entityType: 'ansprechpartner',
      profile_image_url: person.profile_image_url || null
    }]);
  }

  formatUnternehmenTag(unternehmen) {
    if (!unternehmen?.firmenname) return '-';
    
    return avatarBubbles.renderBubbles([{
      name: unternehmen.firmenname,
      label: unternehmen.internes_kuerzel || unternehmen.firmenname,
      type: 'org',
      id: unternehmen.id,
      entityType: 'unternehmen',
      logo_url: unternehmen.logo_url || null
    }], { showLabel: true });
  }

  formatMarkeTag(marke) {
    if (!marke?.markenname) return '-';
    
    return avatarBubbles.renderBubbles([{
      name: marke.markenname,
      type: 'org',
      id: marke.id,
      entityType: 'marke',
      logo_url: marke.logo_url || null
    }], { showLabel: true });
  }

  formatMitarbeiterTags(entries) {
    if (!entries || entries.length === 0) return '-';
    
    const items = entries
      .map(item => {
        const name = item?.mitarbeiter?.name || item?.name;
        const id = item?.mitarbeiter?.id || item?.id;
        const profileImageUrl = item?.mitarbeiter?.profile_image_url || item?.profile_image_url;
        if (!name) return null;
        return {
          name,
          type: 'person',
          id,
          entityType: 'mitarbeiter',
          profile_image_url: profileImageUrl || null
        };
      })
      .filter(Boolean);
    
    return items.length > 0 ? avatarBubbles.renderBubbles(items) : '-';
  }

  // Initialisiere Auftrags-Liste
  async init() {
    // Breadcrumb für Listen-Seite
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Auftrag', url: '/auftrag', clickable: false }
      ]);
    }
    
    // Pagination initialisieren mit dynamicResize für animiertes Entfernen
    this.pagination.init('pagination-auftrag', {
      itemsPerPage: 25,
      onPageChange: (page) => this.handlePageChange(page),
      onItemsPerPageChange: (limit, page) => this.handleItemsPerPageChange(limit, page),
      dynamicResize: true,
      tbodySelector: '.data-table tbody'
      // Kein rowRenderer/dataLoader → Bei Erhöhung wird normaler Callback genutzt
    });
    
    try {
      // BulkActionSystem für Auftrag registrieren
      window.bulkActionSystem?.registerList('auftrag', this);
      
      await this.loadAndRender();
      this.bindEvents();
    } catch (error) {
      console.error('❌ AUFTRAGLIST: Fehler bei der Initialisierung:', error);
      window.ErrorHandler.handle(error, 'AuftragList.init');
    }
  }

  // Lade und rendere Aufträge
  async loadAndRender() {
    try {
      // Finanzdaten für Admins laden
      if (this.isAdmin) {
        await Promise.all([
          this.loadMonthlyRevenue(),
          this.loadMonthlyExpenses()
        ]);
      }
      
      // Seite rendern (ersetzt HTML komplett)
      await this.render();
      
      // NACH render(): Overlay auf das NEUE tbody setzen
      const tbody = document.querySelector('.data-table tbody');
      TableAnimationHelper.showLoadingOverlay(tbody);
      
      // Event-Listener neu binden
      this.bindEvents();
      
      // Nur in List-View: Filter initialisieren und Daten laden
      if (this.currentView === 'list') {
        await this.initializeFilterBar();
        
        const filters = filterSystem.getFilters('auftrag');
        
        // Suchbegriff als name-Filter hinzufügen
        if (this.searchQuery && this.searchQuery.trim().length > 0) {
          filters.auftragsname = this.searchQuery.trim();
        }
        
        const { data: auftraege, count } = await this.loadAuftraegeWithPagination(
          filters,
          this.pagination.currentPage,
          this.pagination.itemsPerPage
        );
        
        this.pagination.updateTotal(count);
        // (animatedUpdate entfernt Overlay automatisch)
        await this.updateTable(auftraege);
        this.pagination.render();
      } else {
        // Kein List-View: Overlay manuell entfernen
        TableAnimationHelper.hideLoadingOverlay(tbody);
      }
      
    } catch (error) {
      console.error('❌ AUFTRAGLIST: Fehler beim Laden und Rendern:', error);
      // Loading-Overlay bei Fehler ausblenden
      const tbodyError = document.querySelector('.data-table tbody');
      TableAnimationHelper.hideLoadingOverlay(tbodyError);
      if (window.ErrorHandler?.handle) {
        window.ErrorHandler.handle(error, 'AuftragList.loadAndRender');
      }
    }
  }

  // Lade Monatsumsatz
  async loadMonthlyRevenue() {
    try {
      if (!window.supabase) {
        this.monthlyRevenue = { total: 0, auftraege: [] };
        return;
      }

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      
      const firstDayStr = firstDayOfMonth.toISOString().split('T')[0];
      const lastDayStr = lastDayOfMonth.toISOString().split('T')[0];

      const { data: auftraege, error } = await window.supabase
        .from('auftrag')
        .select(`
          id, auftragsname, nettobetrag, ueberwiesen_am,
          unternehmen:unternehmen_id(firmenname),
          marke:marke_id(markenname)
        `)
        .not('ueberwiesen_am', 'is', null)
        .gte('ueberwiesen_am', firstDayStr)
        .lte('ueberwiesen_am', lastDayStr)
        .order('nettobetrag', { ascending: false });

      if (error) {
        this.monthlyRevenue = { total: 0, auftraege: [] };
        return;
      }

      const total = (auftraege || []).reduce((sum, a) => sum + (parseFloat(a.nettobetrag) || 0), 0);
      this.monthlyRevenue = {
        total,
        auftraege: auftraege || [],
        month: now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
      };
    } catch (error) {
      console.error('❌ Fehler beim Laden des Monatsumsatzes:', error);
      this.monthlyRevenue = { total: 0, auftraege: [] };
    }
  }

  // Lade Monatsausgaben
  async loadMonthlyExpenses() {
    try {
      if (!window.supabase) {
        this.monthlyExpenses = { total: 0, rechnungen: [] };
        return;
      }

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      
      const firstDayStr = firstDayOfMonth.toISOString().split('T')[0];
      const lastDayStr = lastDayOfMonth.toISOString().split('T')[0];

      const { data: rechnungen, error } = await window.supabase
        .from('rechnung')
        .select(`
          id, rechnung_nr, nettobetrag, bruttobetrag, bezahlt_am,
          creator:creator_id(vorname, nachname),
          kooperation:kooperation_id(name)
        `)
        .not('bezahlt_am', 'is', null)
        .gte('bezahlt_am', firstDayStr)
        .lte('bezahlt_am', lastDayStr)
        .order('nettobetrag', { ascending: false });

      if (error) {
        this.monthlyExpenses = { total: 0, rechnungen: [] };
        return;
      }

      const total = (rechnungen || []).reduce((sum, r) => sum + (parseFloat(r.nettobetrag) || 0), 0);
      this.monthlyExpenses = {
        total,
        rechnungen: rechnungen || [],
        month: now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
      };
    } catch (error) {
      console.error('❌ Fehler beim Laden der Monatsausgaben:', error);
      this.monthlyExpenses = { total: 0, rechnungen: [] };
    }
  }

  // Handler für Seiten-Wechsel
  handlePageChange(page) {
    this.loadAndRender();
  }

  // Handler für Items-Per-Page-Wechsel
  handleItemsPerPageChange(limit, page) {
    this.loadAndRender();
  }

  // Rendere Auftrags-Liste
  async render() {
    window.setHeadline('Aufträge');
    
    // Filter-Bar nur in List-View anzeigen
    let filterHtml = '';
    
    if (this.currentView === 'list') {
      filterHtml = `
        <div class="table-filter-wrapper">
          <div class="filter-bar">
            <div class="filter-left">
              ${SearchInput.render('auftrag', { 
                placeholder: 'Auftrag suchen...', 
                currentValue: this.searchQuery 
              })}
              <div id="filter-dropdown-container"></div>
            </div>
          </div>
          <div class="table-actions">
            ${this.isAdmin ? '<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>' : ''}
            ${this.isAdmin ? '<button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>' : ''}
            <span id="selected-count" style="display:none;">0 ausgewählt</span>
            ${this.isAdmin ? '<button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>' : ''}
            <button id="btn-auftrag-new" class="primary-btn">Neuen Auftrag anlegen</button>
          </div>
        </div>
      `;
    }
    
    // Finanzkacheln nur für Admins
    const financialsHtml = this.isAdmin ? this.renderFinancialsSection() : '';
    
    const html = `
      ${financialsHtml}

      <div class="page-header">
        <div class="page-header-right">
          <div class="view-toggle">
            <button id="btn-view-list" class="secondary-btn ${this.currentView === 'list' ? 'active' : ''}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
              </svg>
              Liste
            </button>
            <button id="btn-view-calendar" class="secondary-btn ${this.currentView === 'calendar' ? 'active' : ''}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              Kalender
            </button>
          </div>
        </div>
      </div>

      ${filterHtml}

      <!-- Content Container für beide Views -->
      <div id="auftrag-content-container">
        ${this.currentView === 'list' ? this.renderListView() : '<div id="calendar-container"></div>'}
      </div>
    `;

    window.setContentSafely(window.content, html);
    
    // Wenn Calendar-View, initialisiere Calendar
    if (this.currentView === 'calendar') {
      await this.initCashFlowCalendar();
    }
  }

  // Render Finanzkacheln mit Toggle
  renderFinancialsSection() {
    const eyeOpenIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`;
    const eyeClosedIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>`;

    return `
      <div class="auftrag-financials-section">
        <div class="auftrag-financials-header">
          <button id="btn-toggle-financials" class="icon-btn" title="${this.financialsHidden ? 'Zahlen anzeigen' : 'Zahlen verbergen'}">
            ${this.financialsHidden ? eyeClosedIcon : eyeOpenIcon}
          </button>
        </div>
        <div class="auftrag-financials-cards">
          ${this.renderRevenueCard()}
          ${this.renderExpensesCard()}
        </div>
      </div>
    `;
  }

  // Render Umsatz-Kachel
  renderRevenueCard() {
    const revenue = this.monthlyRevenue;
    const total = revenue.total || 0;
    const auftraege = revenue.auftraege || [];
    const month = revenue.month || new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    const hiddenValue = '• • •';
    
    let barsHtml = '';
    let legendHtml = '';
    
    if (auftraege.length > 0 && total > 0) {
      auftraege.forEach((auftrag, index) => {
        const betrag = parseFloat(auftrag.nettobetrag) || 0;
        const percentage = (betrag / total) * 100;
        const color = this.revenueColors[index % this.revenueColors.length];
        const name = auftrag.auftragsname || auftrag.marke?.markenname || auftrag.unternehmen?.firmenname || 'Auftrag';
        
        if (percentage > 0.5) {
          barsHtml += `<div class="revenue-bar" style="width: ${percentage}%; background-color: ${color};" title="${this.financialsHidden ? '' : name + ': ' + this.formatCurrency(betrag)}"></div>`;
        }
        
        if (index < 5) {
          legendHtml += `
            <div class="revenue-legend-item">
              <span class="revenue-legend-color" style="background-color: ${color};"></span>
              <span class="revenue-legend-value">${this.financialsHidden ? hiddenValue : this.formatCurrency(betrag)}</span>
              <span class="revenue-legend-name">${name.length > 20 ? name.substring(0, 20) + '...' : name}</span>
            </div>
          `;
        }
      });
      
      if (auftraege.length > 5) {
        const weitereAnzahl = auftraege.length - 5;
        const weitereBetrag = auftraege.slice(5).reduce((sum, a) => sum + (parseFloat(a.nettobetrag) || 0), 0);
        legendHtml += `
          <div class="revenue-legend-item revenue-legend-item--more">
            <span class="revenue-legend-color" style="background-color: var(--gray-400);"></span>
            <span class="revenue-legend-value">${this.financialsHidden ? hiddenValue : this.formatCurrency(weitereBetrag)}</span>
            <span class="revenue-legend-name">+${weitereAnzahl} weitere</span>
          </div>
        `;
      }
    } else {
      barsHtml = '<div class="revenue-bar revenue-bar--empty"></div>';
      legendHtml = '<div class="revenue-legend-empty">Keine Umsätze in diesem Monat</div>';
    }

    return `
      <div class="stats-card stats-card--revenue">
        <div class="revenue-content">
          <span class="revenue-title">Umsatz ${month}</span>
          <div class="revenue-total">
            <span class="revenue-currency">€</span>
            <span class="revenue-amount">${this.financialsHidden ? hiddenValue : this.formatNumber(total)}</span>
          </div>
          <div class="revenue-bars">
            ${barsHtml}
          </div>
          <div class="revenue-legend">
            ${legendHtml}
          </div>
        </div>
      </div>
    `;
  }

  // Render Ausgaben-Kachel
  renderExpensesCard() {
    const expenses = this.monthlyExpenses;
    const total = expenses.total || 0;
    const rechnungen = expenses.rechnungen || [];
    const month = expenses.month || new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    const hiddenValue = '• • •';
    
    let barsHtml = '';
    let legendHtml = '';
    
    if (rechnungen.length > 0 && total > 0) {
      rechnungen.forEach((rechnung, index) => {
        const betrag = parseFloat(rechnung.nettobetrag) || 0;
        const percentage = (betrag / total) * 100;
        const color = this.expenseColors[index % this.expenseColors.length];
        const creatorName = rechnung.creator ? `${rechnung.creator.vorname || ''} ${rechnung.creator.nachname || ''}`.trim() : null;
        const name = creatorName || rechnung.kooperation?.name || rechnung.rechnung_nr || 'Rechnung';
        
        if (percentage > 0.5) {
          barsHtml += `<div class="expense-bar" style="width: ${percentage}%; background-color: ${color};" title="${this.financialsHidden ? '' : name + ': ' + this.formatCurrency(betrag)}"></div>`;
        }
        
        if (index < 5) {
          legendHtml += `
            <div class="expense-legend-item">
              <span class="expense-legend-color" style="background-color: ${color};"></span>
              <span class="expense-legend-value">${this.financialsHidden ? hiddenValue : this.formatCurrency(betrag)}</span>
              <span class="expense-legend-name">${name.length > 20 ? name.substring(0, 20) + '...' : name}</span>
            </div>
          `;
        }
      });
      
      if (rechnungen.length > 5) {
        const weitereAnzahl = rechnungen.length - 5;
        const weitereBetrag = rechnungen.slice(5).reduce((sum, r) => sum + (parseFloat(r.nettobetrag) || 0), 0);
        legendHtml += `
          <div class="expense-legend-item expense-legend-item--more">
            <span class="expense-legend-color" style="background-color: var(--gray-400);"></span>
            <span class="expense-legend-value">${this.financialsHidden ? hiddenValue : this.formatCurrency(weitereBetrag)}</span>
            <span class="expense-legend-name">+${weitereAnzahl} weitere</span>
          </div>
        `;
      }
    } else {
      barsHtml = '<div class="expense-bar expense-bar--empty"></div>';
      legendHtml = '<div class="expense-legend-empty">Keine Ausgaben in diesem Monat</div>';
    }

    return `
      <div class="stats-card stats-card--expenses">
        <div class="expense-content">
          <span class="expense-title">Ausgaben ${month}</span>
          <div class="expense-total">
            <span class="expense-currency">€</span>
            <span class="expense-amount">${this.financialsHidden ? hiddenValue : this.formatNumber(total)}</span>
          </div>
          <div class="expense-bars">
            ${barsHtml}
          </div>
          <div class="expense-legend">
            ${legendHtml}
          </div>
        </div>
      </div>
    `;
  }

  // Toggle Finanzen anzeigen/verbergen
  toggleFinancials() {
    this.financialsHidden = !this.financialsHidden;
    localStorage.setItem('auftrag-financials-hidden', this.financialsHidden.toString());
    
    // Nur die Finanzkacheln neu rendern
    const financialsSection = document.querySelector('.auftrag-financials-section');
    if (financialsSection) {
      financialsSection.outerHTML = this.renderFinancialsSection();
      // Toggle-Button Event neu binden
      this.bindFinancialsToggle();
    }
  }

  // Bind Toggle Event
  bindFinancialsToggle() {
    const toggleBtn = document.getElementById('btn-toggle-financials');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleFinancials());
    }
  }

  // Rendere List-View HTML
  renderListView() {
    return `
      <!-- Daten-Tabelle -->
      <div class="table-container" id="auftrag-table-container">
          <table class="data-table">
            <thead>
              <tr>
                ${this.isAdmin ? `<th class="col-checkbox">
                  <input type="checkbox" id="select-all-auftraege">
                </th>` : ''}
                <th>Angebotsnummer</th>
                <th>Rechnungsnummer</th>
                <th>Company</th>
                <th>Brand</th>
                <th>Interne PO</th>
                <th class="col-rechnung-gestellt">Rechnungsdatum</th>
                <th>Zahlungsziel</th>
                <th class="col-re-faelligkeit">Rechnungsfälligkeit</th>
                <th>Betrag netto</th>
                <th>Umsatzsteuer</th>
                <th>Betrag brutto</th>
                <th>Rechnungsart</th>
                <th>Rechnung gestellt</th>
                <th>Überwiesen</th>
                <th class="col-ueberwiesen">Bezahlt am</th>
                <th>Ansprechpartner</th>
                <th class="col-actions">Aktionen</th>
              </tr>
            </thead>
            <tbody id="auftraege-table-body">
              <tr>
                <td colspan="19" class="loading">Lade Aufträge...</td>
              </tr>
            </tbody>
          </table>
      </div>
      
      <!-- Pagination (außerhalb des scrollbaren Containers) -->
      <div class="pagination-container" id="pagination-auftrag"></div>
    `;
  }

  // Lade Aufträge mit Beziehungen und Pagination
  async loadAuftraegeWithPagination(filters = {}, page = 1, limit = 25) {
    try {
      if (!window.supabase) {
        const mockData = await window.dataService.loadEntities('auftrag');
        return { data: mockData, count: mockData.length };
      }

      // Berechne Range für Pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      // Query mit nur benötigten Feldern aufbauen
      let query = window.supabase
        .from('auftrag')
        .select(`
          id,
          auftragsname,
          angebotsnummer,
          status,
          po,
          re_nr,
          re_faelligkeit,
          zahlungsziel_tage,
          start,
          ende,
          nettobetrag,
          ust_betrag,
          bruttobetrag,
          rechnung_gestellt,
          rechnung_gestellt_am,
          ueberwiesen,
          ueberwiesen_am,
          created_at,
          unternehmen:unternehmen_id(id, firmenname, internes_kuerzel, logo_url),
          marke:marke_id(id, markenname, logo_url),
          ansprechpartner:ansprechpartner_id(id, vorname, nachname, email, profile_image_url),
          kampagne_arten:auftrag_kampagne_art(art:kampagne_art_id(id, name))
        `, { count: 'exact' });

      // Filter anwenden
      query = AuftragFilterLogic.buildSupabaseQuery(query, filters);

      // Sortierung und Pagination
      query = query
        .order('angebotsnummer', { ascending: false, nullsFirst: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('❌ Fehler beim Laden der Aufträge:', error);
        throw error;
      }

      // Daten für Kompatibilität formatieren
      const formattedData = data.map(auftrag => ({
        ...auftrag,
        unternehmen: auftrag.unternehmen ? { 
          id: auftrag.unternehmen.id,
          firmenname: auftrag.unternehmen.firmenname,
          internes_kuerzel: auftrag.unternehmen.internes_kuerzel,
          logo_url: auftrag.unternehmen.logo_url
        } : null,
        marke: auftrag.marke ? { 
          id: auftrag.marke.id,
          markenname: auftrag.marke.markenname,
          logo_url: auftrag.marke.logo_url
        } : null,
        art_der_kampagne: (auftrag.kampagne_arten || [])
          .map(ka => ka.art?.name)
          .filter(Boolean)
      }));

      return { data: formattedData, count: count || 0 };

    } catch (error) {
      console.error('❌ Fehler beim Laden der Aufträge:', error);
      throw error;
    }
  }

  // Initialisiere Filterbar mit neuem Filtersystem
  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      await filterDropdown.init('auftrag', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }

  // Filter angewendet
  onFiltersApplied(filters) {
    filterSystem.applyFilters('auftrag', filters);
    this.pagination.reset();
    this.loadAndRender();
  }

  // Filter zurückgesetzt
  onFiltersReset() {
    filterSystem.resetFilters('auftrag');
    this.pagination.reset();
    this.loadAndRender();
  }

  // Suche Handler (debounced)
  handleSearch(query) {
    if (this._searchDebounceTimer) {
      clearTimeout(this._searchDebounceTimer);
    }
    
    this._searchDebounceTimer = setTimeout(() => {
      this.searchQuery = query.trim();
      this.pagination.reset();
      this.loadAndRender();
    }, 300);
  }

  // Binde Events
  bindEvents() {
    // Finanzen Toggle Event
    this.bindFinancialsToggle();

    // Suchfeld Events über globale Komponente (nur in List-View)
    if (this.currentView === 'list') {
      SearchInput.bind('auftrag', (value) => this.handleSearch(value));
    }

    // Drag-to-Scroll für Tabelle initialisieren (nur in List-View)
    if (this.currentView === 'list') {
      this.initDragToScroll();
    } else if (this._dragToScrollCleanup) {
      this._dragToScrollCleanup();
      this._dragToScrollCleanup = null;
    }

    // Globale delegierte Events nur EINMAL binden
    if (!this._globalEventsBound) {
      this.bindGlobalDelegatedEvents();
      this._globalEventsBound = true;
    }
  }

  // Drag-to-Scroll für horizontales Scrollen der Tabelle
  initDragToScroll() {
    const container = document.getElementById('auftrag-table-container');
    if (!container) return;
    
    // Cleanup vorherige Handler falls vorhanden
    if (this._dragToScrollCleanup) {
      this._dragToScrollCleanup();
    }
    
    this.dragScrollContainer = container;
    
    const handleMouseDown = (e) => {
      // Ignoriere wenn auf interaktive Elemente geklickt wird
      if (
        e.target.tagName === 'INPUT' || 
        e.target.tagName === 'TEXTAREA' || 
        e.target.tagName === 'SELECT' ||
        e.target.tagName === 'BUTTON' ||
        e.target.closest('input') ||
        e.target.closest('textarea') ||
        e.target.closest('select') ||
        e.target.tagName === 'A' ||
        e.target.closest('a') ||
        e.target.closest('button') ||
        e.target.closest('.actions-dropdown')
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
    
    const handleMouseMove = (e) => {
      if (!this.isDragging) return;
      e.preventDefault();
      
      const x = e.pageX - container.offsetLeft;
      const walk = (x - this.startX) * 1.5;
      container.scrollLeft = this.scrollLeft - walk;
    };
    
    const handleMouseUp = () => {
      if (this.isDragging) {
        this.isDragging = false;
        container.style.cursor = 'grab';
        container.style.userSelect = '';
      }
    };
    
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mouseleave', handleMouseUp);
    
    // Cleanup-Handler speichern
    this._dragToScrollCleanup = () => {
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mouseleave', handleMouseUp);
      container.style.cursor = '';
      container.style.userSelect = '';
      this.isDragging = false;
      this.dragScrollContainer = null;
    };

    container.style.cursor = 'grab';
  }

  // Globale delegierte Events - nur EINMAL gebunden (Performance)
  bindGlobalDelegatedEvents() {
    // Ein einziger Click-Handler für alle delegierten Click-Events
    this._globalClickHandler = (e) => {
      // View-Toggle Buttons (Event-Delegation statt cloneNode)
      if (e.target.id === 'btn-view-list' || e.target.closest('#btn-view-list')) {
        e.preventDefault();
        if (this.currentView === 'list') return;
        
        if (this.cashFlowCalendar) {
          this.cashFlowCalendar.destroy();
          this.cashFlowCalendar = null;
        }
        
        this.currentView = 'list';
        this.loadAndRender();
        return;
      }

      if (e.target.id === 'btn-view-calendar' || e.target.closest('#btn-view-calendar')) {
        e.preventDefault();
        if (this.currentView === 'calendar') return;
        
        this.currentView = 'calendar';
        this.loadAndRender();
        return;
      }

      // Neuen Auftrag anlegen Button
      if (e.target.id === 'btn-auftrag-new' || e.target.id === 'btn-auftrag-new-filter') {
        e.preventDefault();
        window.navigateTo('/auftrag/new');
        return;
      }

      // Alle auswählen Button
      if (e.target.id === 'btn-select-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.auftrag-check');
        checkboxes.forEach(cb => {
          cb.checked = true;
          if (cb.dataset.id) this.selectedAuftraege.add(cb.dataset.id);
        });
        const selectAllHeader = document.getElementById('select-all-auftraege');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = true;
        }
        this.updateSelection();
        return;
      }

      // Auswahl aufheben Button
      if (e.target.id === 'btn-deselect-all') {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('.auftrag-check');
        checkboxes.forEach(cb => { cb.checked = false; });
        this.selectedAuftraege.clear();
        const selectAllHeader = document.getElementById('select-all-auftraege');
        if (selectAllHeader) {
          selectAllHeader.indeterminate = false;
          selectAllHeader.checked = false;
        }
        this.updateSelection();
        return;
      }

      // Auftrag Detail Links
      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'auftrag') {
        e.preventDefault();
        const auftragId = e.target.dataset.id;
        window.navigateTo(`/auftrag/${auftragId}`);
        return;
      }

      // Filter-Tag X-Buttons
      if (e.target.classList.contains('tag-x')) {
        e.preventDefault();
        e.stopPropagation();
        
        const tagElement = e.target.closest('.filter-tag');
        const key = tagElement?.dataset?.key;
        
        if (key) {
          const currentFilters = window.filterSystem.getFilters('auftrag');
          delete currentFilters[key];
          window.filterSystem.applyFilters('auftrag', currentFilters);
          this.loadAndRender();
        }
        return;
      }
    };

    // Ein einziger Change-Handler für alle delegierten Change-Events
    this._globalChangeHandler = (e) => {
      // Inline Datepicker für Rechnungs-/Ueberweisungsstatus
      if (e.target.classList.contains('auftrag-inline-date-input')) {
        this.handleInlineBillingDateChange(e.target);
        return;
      }

      // Select-All Checkbox
      if (e.target.id === 'select-all-auftraege') {
        const checkboxes = document.querySelectorAll('.auftrag-check');
        checkboxes.forEach(cb => {
          cb.checked = e.target.checked;
          if (e.target.checked) {
            this.selectedAuftraege.add(cb.dataset.id);
          } else {
            this.selectedAuftraege.delete(cb.dataset.id);
          }
        });
        this.updateSelection();
        return;
      }

      // Auftrag Checkboxes
      if (e.target.classList.contains('auftrag-check')) {
        if (e.target.checked) {
          this.selectedAuftraege.add(e.target.dataset.id);
        } else {
          this.selectedAuftraege.delete(e.target.dataset.id);
        }
        this.updateSelection();
        return;
      }
    };

    // Entity Updated Event Handler
    this._entityUpdatedHandler = (e) => {
      if (e.detail.entity !== 'auftrag') return;

      const isInlineBillingUpdate =
        e.detail.action === 'updated' &&
        (e.detail.field === 'rechnung_gestellt_am' || e.detail.field === 'ueberwiesen_am') &&
        e.detail.id;

      if (isInlineBillingUpdate) {
        this.syncInlineBillingUpdate(e.detail.id, e.detail.field, e.detail.value);
        return;
      }

      this.loadAndRender();
    };

    // Events registrieren
    document.addEventListener('click', this._globalClickHandler);
    document.addEventListener('change', this._globalChangeHandler);
    this._inlineDatePickerCleanup = CustomDatePicker.bind(document);
    window.addEventListener('entityUpdated', this._entityUpdatedHandler);
  }

  // Prüfe ob aktive Filter vorhanden
  hasActiveFilters() {
    const filters = window.filterSystem.getFilters('auftrag');
    return Object.keys(filters).length > 0;
  }

  // Update Selection
  updateSelection() {
    const selectedCount = this.selectedAuftraege.size;
    const selectedCountElement = document.getElementById('selected-count');
    const selectBtn = document.getElementById('btn-select-all');
    const deselectBtn = document.getElementById('btn-deselect-all');
    const deleteBtn = document.getElementById('btn-delete-selected');
    
    if (selectedCountElement) {
      selectedCountElement.textContent = `${selectedCount} ausgewählt`;
      selectedCountElement.style.display = selectedCount > 0 ? 'inline' : 'none';
    }
    
    if (selectBtn) {
      selectBtn.style.display = selectedCount > 0 ? 'none' : 'inline-block';
    }
    
    if (deselectBtn) {
      deselectBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    }
    
    if (deleteBtn) {
      deleteBtn.style.display = selectedCount > 0 ? 'inline-block' : 'none';
    }
  }

  // Update Tabelle (CSS-only Animation, kein setTimeout-Blocking)
  async updateTable(auftraege) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    await TableAnimationHelper.animatedUpdate(tbody, () => {
      if (!auftraege || auftraege.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="19" class="no-data">
              <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; color: #ccc; margin-bottom: 16px;">📋</div>
                <h3 style="color: #666; margin-bottom: 8px;">Keine Aufträge vorhanden</h3>
                <p style="color: #999; margin-bottom: 20px;">Es wurden noch keine Aufträge erstellt.</p>
                <button id="btn-create-first-auftrag" class="primary-btn">
                  Ersten Auftrag anlegen
                </button>
              </div>
            </td>
          </tr>
        `;
        
        // Event für den "Ersten Auftrag anlegen" Button
        const createBtn = document.getElementById('btn-create-first-auftrag');
        if (createBtn) {
          createBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.navigateTo('/auftrag/new');
          });
        }
        return;
      }

      tbody.innerHTML = auftraege.map(auftrag => {
        // Farbklasse basierend auf Zahlungsstatus: Überwiesen > Rechnung gestellt
        const statusClass = auftrag.ueberwiesen
          ? 'auftrag-row--ueberwiesen'
          : auftrag.rechnung_gestellt
            ? 'auftrag-row--rechnung-gestellt'
            : '';
        return `
        <tr data-id="${auftrag.id}" class="${statusClass}" data-rechnung-gestellt="${Boolean(auftrag.rechnung_gestellt)}" data-ueberwiesen="${Boolean(auftrag.ueberwiesen)}">
          ${this.isAdmin ? `<td class="col-checkbox"><input type="checkbox" class="auftrag-check" data-id="${auftrag.id}"></td>` : ''}
          <td>${window.validatorSystem.sanitizeHtml(auftrag.angebotsnummer || '-')}</td>
          <td>${window.validatorSystem.sanitizeHtml(auftrag.re_nr || '-')}</td>
          <td>${this.formatUnternehmenTag(auftrag.unternehmen)}</td>
          <td>${this.formatMarkeTag(auftrag.marke)}</td>
          <td>${window.validatorSystem.sanitizeHtml(auftrag.po || '-')}</td>
          <td class="col-rechnung-gestellt">${this.formatDate(auftrag.rechnung_gestellt_am)}</td>
          <td>${this.formatZahlungsziel(auftrag.zahlungsziel_tage)}</td>
          <td>${this.formatDate(auftrag.re_faelligkeit)}</td>
          <td>${this.formatCurrency(auftrag.nettobetrag)}</td>
          <td>${this.formatCurrency(auftrag.ust_betrag)}</td>
          <td>${this.formatCurrency(auftrag.bruttobetrag)}</td>
          <td>${window.validatorSystem.sanitizeHtml(auftrag.status || '-')}</td>
          <td>${this.renderBillingDateCell(auftrag, 'rechnung_gestellt', 'rechnung_gestellt_am')}</td>
          <td>${this.renderBillingDateCell(auftrag, 'ueberwiesen', 'ueberwiesen_am')}</td>
          <td class="col-ueberwiesen">${this.formatDate(auftrag.ueberwiesen_am)}</td>
          <td>${this.formatAnsprechpartner(auftrag.ansprechpartner)}</td>
          <td class="col-actions">
            ${actionBuilder.create('auftrag', auftrag.id)}
          </td>
        </tr>
      `}).join('');
    });
  }

  // Initialisiere Cash Flow Calendar
  async initCashFlowCalendar() {
    const container = document.getElementById('calendar-container');
    if (!container) {
      console.error('❌ Calendar-Container nicht gefunden');
      return;
    }
    
    this.cashFlowCalendar = new AuftragCashFlowCalendar();
    await this.cashFlowCalendar.init(container);
  }

  // Cleanup
  destroy() {
    // Pagination cleanup
    if (this.pagination) {
      this.pagination.destroy();
    }

    this._boundEventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this._boundEventListeners.clear();

    // Globale Event-Listener entfernen
    if (this._globalClickHandler) {
      document.removeEventListener('click', this._globalClickHandler);
      this._globalClickHandler = null;
    }
    if (this._globalChangeHandler) {
      document.removeEventListener('change', this._globalChangeHandler);
      this._globalChangeHandler = null;
    }
    if (this._entityUpdatedHandler) {
      window.removeEventListener('entityUpdated', this._entityUpdatedHandler);
      this._entityUpdatedHandler = null;
    }
    if (this._inlineDatePickerCleanup) {
      this._inlineDatePickerCleanup();
      this._inlineDatePickerCleanup = null;
    }
    if (this._dragToScrollCleanup) {
      this._dragToScrollCleanup();
      this._dragToScrollCleanup = null;
    }
    
    // Flags zurücksetzen
    this._globalEventsBound = false;
    this._auftragNewBound = false;
    this._isAdmin = null;

    // Legacy Filter-Handler entfernen
    if (this.boundFilterResetHandler) {
      document.removeEventListener('click', this.boundFilterResetHandler);
      this.boundFilterResetHandler = null;
    }
  }

  // Show Create Form (für Routing)
  showCreateForm() {
    window.setHeadline('Neuen Auftrag anlegen');
    
    // Breadcrumb aktualisieren
    if (window.breadcrumbSystem) {
      window.breadcrumbSystem.updateBreadcrumb([
        { label: 'Aufträge', url: '/auftrag', clickable: true },
        { label: 'Neuer Auftrag', url: '/auftrag/new', clickable: false }
      ]);
    }

    const formHtml = window.formSystem.renderFormOnly('auftrag');
    const html = `
      <div class="form-split-container">
        <div class="form-split-left">
          <div class="form-page">
            ${formHtml}
          </div>
        </div>
        <div class="form-split-right hidden" id="auftragsdetails-split-container">
          <div class="form-split-header">
            <h2>Auftragsdetails</h2>
            <p class="form-hint">Die Auftragsdetails werden zusammen mit dem Auftrag gespeichert.</p>
          </div>
          <div id="auftragsdetails-embedded-form"></div>
        </div>
      </div>
    `;

    window.content.innerHTML = html;
    
    // Debug: Prüfen ob Split-Container nach innerHTML gesetzt wurde
    console.log('🔍 Nach innerHTML - Split-Container:', document.getElementById('auftragsdetails-split-container'));
    console.log('🔍 Nach innerHTML - form-split-container:', document.querySelector('.form-split-container'));
    
    window.formSystem.bindFormEvents('auftrag', null);
    
    // Debug: Prüfen ob Split-Container nach bindFormEvents noch existiert
    console.log('🔍 Nach bindFormEvents - Split-Container:', document.getElementById('auftragsdetails-split-container'));
    
    // Toggle Event-Handler für Auftragsdetails Split-View
    // Mit kurzem Delay, damit das FormSystem das DOM fertig aufgebaut hat
    setTimeout(() => {
      this.bindAuftragsdetailsToggle();
      this.setupFieldSynchronization();
    }, 100);
    
    // Custom Submit Handler für Seiten-Formular
    const form = document.getElementById('auftrag-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      };
    }
  }
  
  /**
   * Bindet den Toggle Event-Handler für das Auftragsdetails Split-View
   */
  bindAuftragsdetailsToggle() {
    console.log('🎯 bindAuftragsdetailsToggle wird aufgerufen...');
    
    // FormSystem verwendet "field-" Prefix für IDs
    const toggle = document.getElementById('field-create_auftragsdetails');
    const splitContainer = document.getElementById('auftragsdetails-split-container');
    
    console.log('🔍 Toggle gefunden:', toggle);
    console.log('🔍 SplitContainer gefunden:', splitContainer);
    
    if (!toggle || !splitContainer) {
      console.warn('⚠️ Auftragsdetails Toggle oder Split-Container nicht gefunden');
      // Debug: Alle Checkboxen im DOM
      const allInputs = document.querySelectorAll('input[type="checkbox"]');
      console.log('📋 Alle Checkboxen im DOM:', Array.from(allInputs).map(i => ({ id: i.id, name: i.name })));
      return;
    }
    
    // Toggle initial deaktivieren - erst aktivieren wenn Unternehmen gewählt
    toggle.disabled = true;
    const toggleContainer = toggle.closest('.form-field');
    if (toggleContainer) {
      toggleContainer.style.opacity = '0.5';
      toggleContainer.title = 'Bitte zuerst ein Unternehmen auswählen';
      
      // Hinweis-Text hinzufügen (nur wenn noch nicht vorhanden)
      if (!document.getElementById('auftragsdetails-toggle-hint')) {
        const hint = document.createElement('small');
        hint.className = 'form-hint auftragsdetails-toggle-hint';
        hint.id = 'auftragsdetails-toggle-hint';
        hint.textContent = 'Erst Unternehmen auswählen, um Auftragsdetails direkt zu erstellen.';
        hint.style.color = 'var(--gray-500)';
        toggleContainer.appendChild(hint);
      }
    }
    
    console.log('✅ Toggle Setup abgeschlossen, disabled:', toggle.disabled);
    
    // Handler-Funktion für Toggle-Änderung
    const handleToggleChange = async () => {
      const isActive = toggle.checked;
      console.log('🔄 Auftragsdetails Toggle geändert:', isActive);
      
      // Prüfen ob Unternehmen ausgewählt
      // IDs haben "field-" Prefix vom FormSystem
      const unternehmenHidden = document.getElementById('field-unternehmen_id_value');
      const unternehmenSelect = document.getElementById('field-unternehmen_id');
      const unternehmenId = unternehmenHidden?.value || unternehmenSelect?.value;
      
      const markeHidden = document.getElementById('field-marke_id_value');
      const markeSelect = document.getElementById('field-marke_id');
      const markeId = markeHidden?.value || markeSelect?.value;
      
      // Prüfen ob Marken verfügbar sind (mehr als nur Placeholder-Option)
      const hatMarkenOptionen = markeSelect && markeSelect.options.length > 1;
      
      console.log('🔍 Unternehmen-ID:', unternehmenId, ', Marke-ID:', markeId, ', Hat Marken:', hatMarkenOptionen);
      
      // Validierung: Unternehmen muss gewählt sein
      if (isActive && !unternehmenId) {
        window.toastSystem?.show('Bitte zuerst ein Unternehmen auswählen', 'warning');
        toggle.checked = false;
        return;
      }
      
      // Validierung: Wenn Marken verfügbar, muss eine gewählt sein
      if (isActive && hatMarkenOptionen && !markeId) {
        window.toastSystem?.show('Bitte zuerst eine Marke auswählen', 'warning');
        toggle.checked = false;
        return;
      }
      
      if (isActive) {
        console.log('📋 Aktiviere Split-View...');
        // Split-View anzeigen
        splitContainer.classList.remove('hidden');
        
        // Embedded Form rendern
        try {
          await this.renderEmbeddedAuftragsdetailsForm();
          console.log('✅ Embedded Form gerendert');
        } catch (err) {
          console.error('❌ Fehler beim Rendern des Embedded Forms:', err);
        }
        
        // Initiale Synchronisation
        this.syncToAuftragsdetails();
        
        // Smooth scroll nach oben zum Split-Container
        setTimeout(() => {
          const formContainer = document.querySelector('.form-split-container');
          if (formContainer) {
            formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }, 100);
      } else {
        console.log('📋 Deaktiviere Split-View...');
        // Split-View ausblenden
        splitContainer.classList.add('hidden');
      }
    };
    
    // Event-Listener auf das Input-Element
    toggle.addEventListener('change', (e) => {
      console.log('🎯 Toggle change Event gefeuert, checked:', e.target.checked);
      handleToggleChange();
    });
    
    // Speichere Handler für Unternehmen-Change
    this._auftragsdetailsToggleHandler = handleToggleChange;
  }
  
  /**
   * Setup der Feld-Synchronisation zwischen Auftrag und Auftragsdetails
   */
  setupFieldSynchronization() {
    console.log('🔧 setupFieldSynchronization wird aufgerufen...');
    
    // Gemeinsamer Handler für Unternehmen- und Marken-Änderungen
    const updateToggleState = () => {
      // IDs haben "field-" Prefix vom FormSystem
      const unternehmenHidden = document.getElementById('field-unternehmen_id_value');
      const unternehmenSelect = document.getElementById('field-unternehmen_id');
      const unternehmenId = unternehmenHidden?.value || unternehmenSelect?.value;
      
      const markeHidden = document.getElementById('field-marke_id_value');
      const markeSelect = document.getElementById('field-marke_id');
      const markeId = markeHidden?.value || markeSelect?.value;
      
      // Prüfen ob Marken verfügbar sind (mehr als nur Placeholder-Option)
      const hatMarkenOptionen = markeSelect && markeSelect.options.length > 1;
      
      console.log('🔄 updateToggleState:', { unternehmenId, markeId, hatMarkenOptionen });
      
      // Toggle aktivieren/deaktivieren
      const toggle = document.getElementById('field-create_auftragsdetails');
      const toggleContainer = toggle?.closest('.form-field');
      const hint = document.getElementById('auftragsdetails-toggle-hint');
      
      if (!toggle) {
        console.warn('⚠️ Toggle nicht gefunden');
        return;
      }
      
      // Logik: Toggle aktivieren wenn:
      // 1. Unternehmen gewählt UND keine Marken verfügbar, ODER
      // 2. Unternehmen gewählt UND Marke gewählt
      const kannAktivieren = unternehmenId && (!hatMarkenOptionen || markeId);
      
      if (kannAktivieren) {
        // Toggle aktivieren
        toggle.disabled = false;
        if (toggleContainer) {
          toggleContainer.style.opacity = '1';
          toggleContainer.title = '';
        }
        if (hint) {
          hint.textContent = 'Auftragsdetails können jetzt erstellt werden.';
          hint.style.color = 'var(--primary-600)';
        }
        console.log('✅ Toggle aktiviert');
      } else if (unternehmenId && hatMarkenOptionen && !markeId) {
        // Unternehmen gewählt aber Marke fehlt
        toggle.disabled = true;
        toggle.checked = false;
        if (toggleContainer) {
          toggleContainer.style.opacity = '0.5';
          toggleContainer.title = 'Bitte zuerst eine Marke auswählen';
        }
        if (hint) {
          hint.textContent = 'Erst Marke auswählen, um Auftragsdetails direkt zu erstellen.';
          hint.style.color = 'var(--gray-500)';
        }
        // Split-View ausblenden
        const splitContainer = document.getElementById('auftragsdetails-split-container');
        if (splitContainer) splitContainer.classList.add('hidden');
        console.log('⏳ Toggle deaktiviert (Marke fehlt)');
      } else {
        // Kein Unternehmen gewählt
        toggle.disabled = true;
        toggle.checked = false;
        if (toggleContainer) {
          toggleContainer.style.opacity = '0.5';
          toggleContainer.title = 'Bitte zuerst ein Unternehmen auswählen';
        }
        if (hint) {
          hint.textContent = 'Erst Unternehmen auswählen, um Auftragsdetails direkt zu erstellen.';
          hint.style.color = 'var(--gray-500)';
        }
        // Split-View ausblenden
        const splitContainer = document.getElementById('auftragsdetails-split-container');
        if (splitContainer) splitContainer.classList.add('hidden');
        console.log('⏳ Toggle deaktiviert (Unternehmen fehlt)');
      }
      
      // Synchronisation
      this.syncToAuftragsdetails();
    };
    
    // Event-Listener für Unternehmen
    const unternehmenSelect = document.getElementById('field-unternehmen_id');
    if (unternehmenSelect) {
      unternehmenSelect.addEventListener('change', updateToggleState);
      console.log('✅ Unternehmen Select Listener registriert');
      
      // Hidden Input beobachten (für Searchable Select)
      const unternehmenHidden = document.getElementById('field-unternehmen_id_value');
      if (unternehmenHidden) {
        const observer = new MutationObserver(updateToggleState);
        observer.observe(unternehmenHidden, { attributes: true, attributeFilter: ['value'] });
        unternehmenHidden.addEventListener('input', updateToggleState);
        console.log('✅ Unternehmen Hidden Input Observer registriert');
      }
    } else {
      console.warn('⚠️ Unternehmen Select nicht gefunden');
    }
    
    // Event-Listener für Marke
    const markeSelect = document.getElementById('field-marke_id');
    if (markeSelect) {
      markeSelect.addEventListener('change', updateToggleState);
      console.log('✅ Marke Select Listener registriert');
      
      // Hidden Input beobachten (für Searchable Select)
      const markeHidden = document.getElementById('field-marke_id_value');
      if (markeHidden) {
        const observer = new MutationObserver(updateToggleState);
        observer.observe(markeHidden, { attributes: true, attributeFilter: ['value'] });
        markeHidden.addEventListener('input', updateToggleState);
        console.log('✅ Marke Hidden Input Observer registriert');
      }
    }
    
    // Synchronisation bei kampagnenanzahl Änderung
    const kampagnenanzahlInput = document.getElementById('field-kampagnenanzahl');
    if (kampagnenanzahlInput) {
      kampagnenanzahlInput.addEventListener('input', () => {
        this.syncToAuftragsdetails();
      });
    }
    
    // Speichere Handler für externen Zugriff
    this._updateToggleState = updateToggleState;
  }
  
  /**
   * Synchronisiert Werte vom Auftragsformular zum Auftragsdetails-Formular
   */
  syncToAuftragsdetails() {
    const splitContainer = document.getElementById('auftragsdetails-split-container');
    if (!splitContainer || splitContainer.classList.contains('hidden')) return;
    
    // Unternehmen synchronisieren (IDs haben "field-" Prefix)
    const unternehmenHidden = document.getElementById('field-unternehmen_id_value');
    const unternehmenSelect = document.getElementById('field-unternehmen_id');
    const unternehmenId = unternehmenHidden?.value || unternehmenSelect?.value;
    
    // Firmenname aus dem Select holen
    let firmenname = 'Kein Unternehmen ausgewählt';
    if (unternehmenSelect && unternehmenId) {
      const selectedOption = unternehmenSelect.querySelector(`option[value="${unternehmenId}"]`);
      firmenname = selectedOption?.textContent || firmenname;
    }
    
    // Marke synchronisieren
    const markeHidden = document.getElementById('field-marke_id_value');
    const markeSelect = document.getElementById('field-marke_id');
    const markeId = markeHidden?.value || markeSelect?.value;
    
    let markenname = '';
    if (markeSelect && markeId) {
      const selectedOption = markeSelect.querySelector(`option[value="${markeId}"]`);
      markenname = selectedOption?.textContent || '';
    }
    
    // Unternehmen-Anzeige im Auftragsdetails-Formular aktualisieren
    const unternehmenDisplay = document.getElementById('auftragsdetails-unternehmen-display');
    if (unternehmenDisplay) {
      const displayText = markenname ? `${firmenname} (${markenname})` : firmenname;
      unternehmenDisplay.textContent = displayText;
      unternehmenDisplay.dataset.unternehmenId = unternehmenId || '';
      unternehmenDisplay.dataset.markeId = markeId || '';
    }
    
    // Kampagnenanzahl synchronisieren
    const kampagnenanzahlInput = document.getElementById('field-kampagnenanzahl');
    const kampagnenanzahlDisplay = document.getElementById('auftragsdetails-kampagnenanzahl');
    if (kampagnenanzahlDisplay && kampagnenanzahlInput) {
      kampagnenanzahlDisplay.value = kampagnenanzahlInput.value || '';
    }
    
    console.log('🔄 Felder synchronisiert:', { unternehmenId, firmenname, markeId, markenname, kampagnenanzahl: kampagnenanzahlInput?.value });
  }
  
  /**
   * Rendert das Embedded Auftragsdetails-Formular
   */
  async renderEmbeddedAuftragsdetailsForm() {
    const container = document.getElementById('auftragsdetails-embedded-form');
    if (!container) return;
    
    // Lade Kampagnenart-Typen
    let kampagnenartTypen = [];
    try {
      const { data, error } = await window.supabase
        .from('kampagne_art_typen')
        .select('id, name')
        .order('sort_order, name');
      
      if (!error && data) {
        kampagnenartTypen = data;
      }
    } catch (e) {
      console.warn('⚠️ Kampagnenart-Typen konnten nicht geladen werden:', e);
    }
    
    // Aktuelles Unternehmen holen (IDs haben "field-" Prefix)
    const unternehmenHidden = document.getElementById('field-unternehmen_id_value');
    const unternehmenSelect = document.getElementById('field-unternehmen_id');
    const unternehmenId = unternehmenHidden?.value || unternehmenSelect?.value;
    let firmenname = 'Kein Unternehmen ausgewählt';
    if (unternehmenSelect && unternehmenId) {
      const selectedOption = unternehmenSelect.querySelector(`option[value="${unternehmenId}"]`);
      firmenname = selectedOption?.textContent || firmenname;
    }
    
    // Aktuelle Marke holen
    const markeHidden = document.getElementById('field-marke_id_value');
    const markeSelect = document.getElementById('field-marke_id');
    const markeId = markeHidden?.value || markeSelect?.value;
    let markenname = '';
    if (markeSelect && markeId) {
      const selectedOption = markeSelect.querySelector(`option[value="${markeId}"]`);
      markenname = selectedOption?.textContent || '';
    }
    
    // Display-Text für Unternehmen/Marke
    const displayText = markenname ? `${firmenname} (${markenname})` : firmenname;
    
    // Kampagnenanzahl holen
    const kampagnenanzahl = document.getElementById('field-kampagnenanzahl')?.value || '';
    
    // Embedded Form HTML
    const formHtml = `
      <div class="auftragsdetails-embedded">
        <!-- Synchronisierte Info-Box -->
        <div class="auftragsdetails-sync-info">
          <div class="sync-info-item">
            <span class="sync-info-label">Unternehmen:</span>
            <span class="sync-info-value" id="auftragsdetails-unternehmen-display" data-unternehmen-id="${unternehmenId || ''}" data-marke-id="${markeId || ''}">${displayText}</span>
          </div>
          <div class="sync-info-item">
            <span class="sync-info-label">Kampagnenanzahl:</span>
            <input type="number" id="auftragsdetails-kampagnenanzahl" class="sync-info-input" value="${kampagnenanzahl}" readonly>
          </div>
        </div>
        
        <!-- Kampagnenart-Auswahl -->
        <div class="form-field">
          <label for="auftragsdetails-kampagnenart">Art der Kampagne</label>
          <select id="auftragsdetails-kampagnenart" 
                  name="auftragsdetails_art_der_kampagne" 
                  multiple 
                  data-searchable="true" 
                  data-tag-based="true" 
                  data-placeholder="Kampagnenart suchen und auswählen...">
            ${kampagnenartTypen.map(typ => `<option value="${typ.id}">${typ.name}</option>`).join('')}
          </select>
          <small class="form-hint">Wählen Sie die Kampagnenarten und klicken Sie auf "Aktivieren".</small>
        </div>
        
        <div class="kampagnenart-activate-actions">
          <button type="button" id="auftragsdetails-activate-btn" class="mdc-btn mdc-btn--secondary">
            <span class="mdc-btn__label">Aktivieren</span>
          </button>
        </div>
        
        <!-- Container für dynamische Budget-Sections -->
        <div id="auftragsdetails-budget-sections">
          <div class="alert alert-info">
            <p>Wählen Sie oben die Kampagnenarten aus und klicken Sie auf "Aktivieren", um die Budget-Felder anzuzeigen.</p>
          </div>
        </div>
      </div>
    `;
    
    container.innerHTML = formHtml;
    
    // TagBased-Multiselect initialisieren
    const selectElement = document.getElementById('auftragsdetails-kampagnenart');
    if (selectElement && window.formSystem?.optionsManager?.createTagBasedSelect) {
      const options = kampagnenartTypen.map(typ => ({
        value: typ.id,
        label: typ.name,
        selected: false
      }));
      
      const field = {
        name: 'auftragsdetails_art_der_kampagne',
        tagBased: true,
        placeholder: 'Kampagnenart suchen und auswählen...'
      };
      
      window.formSystem.optionsManager.createTagBasedSelect(selectElement, options, field);
      console.log('✅ TagBased-Multiselect für embedded Auftragsdetails initialisiert');
    }
    
    // Aktivieren-Button Event
    const activateBtn = document.getElementById('auftragsdetails-activate-btn');
    if (activateBtn) {
      activateBtn.addEventListener('click', async () => {
        await this.activateEmbeddedKampagnenarten();
      });
    }
    
    // Speichere Kampagnenart-Typen für späteren Zugriff
    this.embeddedKampagnenartTypen = kampagnenartTypen;
  }
  
  /**
   * Aktiviert die ausgewählten Kampagnenarten im Embedded Form
   */
  async activateEmbeddedKampagnenarten() {
    const activateBtn = document.getElementById('auftragsdetails-activate-btn');
    if (activateBtn) {
      activateBtn.disabled = true;
      const labelEl = activateBtn.querySelector('.mdc-btn__label');
      if (labelEl) labelEl.textContent = 'Aktiviere...';
    }
    
    try {
      // Sammle ausgewählte Kampagnenart-IDs
      const selectedIds = this.getEmbeddedSelectedKampagnenartIds();
      
      if (selectedIds.length === 0) {
        window.toastSystem?.show('Bitte wählen Sie mindestens eine Kampagnenart aus.', 'warning');
        return;
      }
      
      // Hole die Namen der ausgewählten Kampagnenarten
      const selectedArten = this.embeddedKampagnenartTypen
        .filter(typ => selectedIds.includes(typ.id))
        .map(typ => typ.name);
      
      // Dynamisches Import der KampagnenartenMapping
      const { KAMPAGNENARTEN_MAPPING, generateBudgetOnlyFieldsHtml } = await import('./logic/KampagnenartenMapping.js');
      
      // Rendere Budget-Sections
      const container = document.getElementById('auftragsdetails-budget-sections');
      if (container) {
        let sectionsHtml = '';
        selectedArten.forEach(artName => {
          const config = KAMPAGNENARTEN_MAPPING[artName];
          if (config) {
            sectionsHtml += generateBudgetOnlyFieldsHtml(artName, {});
          } else {
            console.warn(`⚠️ Unbekannte Kampagnenart: "${artName}"`);
          }
        });
        
        if (sectionsHtml) {
          container.innerHTML = sectionsHtml;
          const { kampagnenartenService } = await import('./services/KampagnenartenService.js');
          kampagnenartenService.bindVideoToggleEvents(container);
        } else {
          container.innerHTML = `
            <div class="alert alert-warning">
              <p>Keine Budget-Felder für die ausgewählten Kampagnenarten verfügbar.</p>
            </div>
          `;
        }
      }
      
      // Speichere aktivierte Kampagnenarten
      this.embeddedSelectedKampagnenarten = selectedArten;
      this.embeddedSelectedKampagnenartIds = selectedIds;
      
      window.toastSystem?.show(`${selectedArten.length} Kampagnenart(en) aktiviert.`, 'success');
      
    } catch (error) {
      console.error('❌ Fehler beim Aktivieren der Kampagnenarten:', error);
      window.toastSystem?.show('Fehler beim Aktivieren der Kampagnenarten.', 'error');
    } finally {
      if (activateBtn) {
        activateBtn.disabled = false;
        const labelEl = activateBtn.querySelector('.mdc-btn__label');
        if (labelEl) labelEl.textContent = 'Aktivieren';
      }
    }
  }
  
  /**
   * Holt die ausgewählten Kampagnenart-IDs aus dem Embedded Multiselect
   */
  getEmbeddedSelectedKampagnenartIds() {
    const selectedIds = [];
    
    // Versuche das versteckte Select zu finden (TagBased-Multiselect)
    const hiddenSelect = document.getElementById('auftragsdetails-kampagnenart_hidden');
    if (hiddenSelect) {
      Array.from(hiddenSelect.selectedOptions).forEach(option => {
        if (option.value) selectedIds.push(option.value);
      });
    }
    
    // Fallback: Normales Select
    if (selectedIds.length === 0) {
      const selectElement = document.getElementById('auftragsdetails-kampagnenart');
      if (selectElement) {
        Array.from(selectElement.selectedOptions).forEach(option => {
          if (option.value) selectedIds.push(option.value);
        });
      }
    }
    
    // Fallback: Aus Tags lesen
    if (selectedIds.length === 0) {
      const tags = document.querySelectorAll('#auftragsdetails-embedded-form .tag[data-value]');
      tags.forEach(tag => {
        const value = tag.dataset?.value;
        if (value) selectedIds.push(value);
      });
    }
    
    console.log('📋 Embedded ausgewählte Kampagnenart-IDs:', selectedIds);
    return selectedIds;
  }

  // Handle Form Submit für Seiten-Formular
  async handleFormSubmit() {
    const form = document.getElementById('auftrag-form');
    const btn = form?.querySelector('.mdc-btn.mdc-btn--create');
    
    // Guard: Mehrfachklick verhindern
    if (btn?.dataset.locked === 'true') return;
    if (btn) {
      btn.dataset.locked = 'true';
      btn.classList.add('is-loading');
      const labelEl = btn.querySelector('.mdc-btn__label');
      if (labelEl) labelEl.textContent = 'Wird angelegt…';
    }
    
    try {
      const formData = new FormData(form);
      const submitData = {};

      // Tag-basierte Multi-Selects aus Hidden-Selects sammeln
      const processedFields = new Set();
      const tagBasedSelects = form.querySelectorAll('select[data-tag-based="true"]');
      tagBasedSelects.forEach(select => {
        const fieldName = select.name;
        const selectId = select.id;
        
        if (processedFields.has(fieldName)) {
          return;
        }
        processedFields.add(fieldName);
        
        let hiddenSelect = document.getElementById(`${selectId}_hidden`);
        
        if (!hiddenSelect) {
          hiddenSelect = form.querySelector(`select[name="${fieldName}[]"]`);
        }
        
        if (!hiddenSelect) {
          const tagContainer = select.closest('.form-field')?.querySelector('.tag-based-select');
          if (tagContainer) {
            hiddenSelect = tagContainer.querySelector('select[multiple]');
          }
        }
        
        if (!hiddenSelect) {
          const tagContainer = select.closest('.form-field')?.querySelector('.tag-based-select');
          if (tagContainer) {
            const tags = tagContainer.querySelectorAll('.tag[data-value]');
            const tagValues = [...new Set(Array.from(tags).map(tag => tag.dataset.value).filter(Boolean))];
            if (tagValues.length > 0) {
              submitData[fieldName] = tagValues;
              return;
            }
          }
        }
        
        if (hiddenSelect) {
          const values = [...new Set(Array.from(hiddenSelect.selectedOptions).map(opt => opt.value).filter(Boolean))];
          if (values.length > 0) {
            submitData[fieldName] = values;
          }
        }
      });

      // FormData zu Objekt konvertieren (bei doppelten Keys z. B. marke_id: nicht-leeren Wert bevorzugen)
      const isEmpty = (v) => v === undefined || v === null || v === '' || (typeof v === 'string' && v.trim() === '');
      for (const [key, value] of formData.entries()) {
        if (key.includes('[]')) {
          const cleanKey = key.replace('[]', '');
          if (!submitData.hasOwnProperty(cleanKey)) {
            submitData[cleanKey] = [];
          }
          if (!submitData[cleanKey].includes(value)) {
            submitData[cleanKey].push(value);
          }
        } else {
          if (!submitData.hasOwnProperty(key) || !Array.isArray(submitData[key])) {
            const existing = submitData[key];
            if (existing === undefined) {
              submitData[key] = value;
            } else if (isEmpty(existing) && !isEmpty(value)) {
              submitData[key] = value;
            }
            // sonst: existing behalten (leerer Wert überschreibt keinen gültigen)
          }
        }
      }

      // Deduplizierung
      for (const key of Object.keys(submitData)) {
        if (Array.isArray(submitData[key])) {
          submitData[key] = [...new Set(submitData[key])];
        }
      }

      // Validierung
      const validationResult = window.validatorSystem.validateForm(submitData, {
        auftragsname: { type: 'text', minLength: 2, required: true },
        angebotsnummer: { type: 'text', required: true },
        erwarteter_monat_zahlungseingang: { required: true }
      });
      
      if (!validationResult.isValid) {
        window.toastSystem?.show('Bitte füllen Sie alle Pflichtfelder aus', 'error');
        window.unlockSubmit?.();
        return;
      }

      // PO-Nummer automatisch generieren (Format: PO-Kürzel-Jahr-AufträgeKunde-GesamtPO)
      const poResult = await this.generatePoNummer(submitData.unternehmen_id);
      if (!poResult.success) {
        // Fehlermeldung anzeigen und Speichern verhindern
        if (btn) {
          btn.classList.remove('is-loading');
          btn.dataset.locked = 'false';
          btn.dataset.submitLocked = 'false';
          btn.classList.remove('is-submit-locked');
          const labelEl = btn.querySelector('.mdc-btn__label');
          if (labelEl) labelEl.textContent = 'Erstellen';
        }
        // SubmitGuard freigeben
        window.unlockSubmit?.();
        window.toastSystem?.show(poResult.error, 'error');
        return;
      }
      submitData.po = poResult.poNummer;
      console.log('📋 Generierte PO-Nummer:', poResult.poNummer);

      // Erstelle Auftrag
      const result = await window.dataService.createEntity('auftrag', submitData);
      
      if (result.success) {
        // Success UI
        if (btn) {
          btn.classList.remove('is-loading');
          btn.classList.add('is-success');
          const labelEl = btn.querySelector('.mdc-btn__label');
          if (labelEl) labelEl.textContent = 'Auftrag angelegt';
        }
        
        // Nach Erstellung: Many-to-Many Beziehungen über RelationTables verarbeiten
        try {
          const auftragId = result.id;
          await window.formSystem.relationTables.handleRelationTables('auftrag', auftragId, submitData, form);
        } catch (e) {
          console.warn('⚠️ Many-to-Many Zuordnungen konnten nicht gespeichert werden', e);
        }

        // Auftragsbestätigung Upload
        try {
          const auftragId = result.id;
          await this.handleAuftragsbestaetigungUpload(auftragId, form);
        } catch (e) {
          console.warn('⚠️ Auftragsbestätigung Upload fehlgeschlagen', e);
        }

        // Auftragsdetails erstellen (wenn Toggle aktiv)
        const createDetailsToggle = document.getElementById('field-create_auftragsdetails');
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/ef7c4a93-6b3c-4f97-afd6-79f1e3285bc3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1da93c'},body:JSON.stringify({sessionId:'1da93c',location:'AuftragList.js:2052',message:'Toggle state before handleAuftragsdetailsCreation',data:{toggleExists:!!createDetailsToggle,toggleChecked:createDetailsToggle?.checked,auftragId:result.id,embeddedKampagnenartIds:this.embeddedSelectedKampagnenartIds},timestamp:Date.now(),hypothesisId:'H-A,H-B'})}).catch(()=>{});
        // #endregion
        const detailsCreated = await this.handleAuftragsdetailsCreation(result.id, createDetailsToggle?.checked);
        
        // Toast-Erfolgsmeldung
        if (detailsCreated) {
          window.toastSystem?.show('Auftrag und Auftragsdetails erfolgreich angelegt', 'success');
        } else {
          window.toastSystem?.show('Auftrag erfolgreich angelegt', 'success');
        }
        
        // Event auslösen für Listen-Update
        window.dispatchEvent(new CustomEvent('entityUpdated', {
          detail: { entity: 'auftrag', action: 'created', id: result.id }
        }));
        
        if (detailsCreated) {
          window.dispatchEvent(new CustomEvent('entityUpdated', {
            detail: { entity: 'auftrag_details', action: 'created' }
          }));
        }
        
        // Zurück zur Liste
        setTimeout(() => {
          window.navigateTo('/auftrag');
        }, 1500);
      } else {
        // Error UI
        if (btn) {
          btn.classList.remove('is-loading');
          btn.dataset.locked = 'false';
          btn.dataset.submitLocked = 'false';
          btn.classList.remove('is-submit-locked');
          const labelEl = btn.querySelector('.mdc-btn__label');
          if (labelEl) labelEl.textContent = 'Erstellen';
        }
        window.unlockSubmit?.();
        window.toastSystem?.show(`Fehler beim Erstellen: ${result.error}`, 'error');
      }

    } catch (error) {
      console.error('❌ Fehler beim Erstellen des Auftrags:', error);
      // Reset Button bei Fehler
      if (btn) {
        btn.classList.remove('is-loading');
        btn.dataset.locked = 'false';
        btn.dataset.submitLocked = 'false';
        btn.classList.remove('is-submit-locked');
        const labelEl = btn.querySelector('.mdc-btn__label');
        if (labelEl) labelEl.textContent = 'Erstellen';
      }
      window.unlockSubmit?.();
      window.toastSystem?.show('Ein unerwarteter Fehler ist aufgetreten', 'error');
    }
  }

  /**
   * Erstellt Auftragsdetails wenn der Toggle aktiv ist
   * @param {string} auftragId - ID des gerade erstellten Auftrags
   * @param {boolean} shouldCreate - Ob Auftragsdetails erstellt werden sollen (Toggle-Status)
   * @returns {Promise<boolean>} - True wenn Auftragsdetails erstellt wurden
   */
  async handleAuftragsdetailsCreation(auftragId, shouldCreate) {
    if (!shouldCreate || !auftragId) {
      return false;
    }
    
    console.log('📋 Erstelle Auftragsdetails für Auftrag:', auftragId);
    
    try {
      // Prüfe ob Kampagnenarten aktiviert wurden
      if (!this.embeddedSelectedKampagnenartIds || this.embeddedSelectedKampagnenartIds.length === 0) {
        console.log('ℹ️ Keine Kampagnenarten aktiviert, überspringe Auftragsdetails');
        return false;
      }
      
      // 1. Sammle Daten aus dem Embedded Form
      const detailsData = {
        auftrag_id: auftragId,
        kampagnenanzahl: parseInt(document.getElementById('auftragsdetails-kampagnenanzahl')?.value) || null
      };
      
      // Sammle alle Budget-Felder aus dem Embedded Form
      const budgetContainer = document.getElementById('auftragsdetails-budget-sections');
      if (budgetContainer) {
        const inputs = budgetContainer.querySelectorAll('input, textarea');
        inputs.forEach(input => {
          const name = input.name;
          if (!name) return;
          
          let value = input.value;
          
          // Leere Werte als null
          if (value === '' || value === null) {
            detailsData[name] = null;
          } else if (name.endsWith('_anzahl') || name.includes('_preis_') || name.includes('preis_netto')) {
            // Zahlen konvertieren
            detailsData[name] = parseFloat(value) || null;
          } else {
            detailsData[name] = value;
          }
        });

        // Toggle-Hilfsfelder nicht persistieren; bei deaktiviertem Toggle Zahl explizit nullen
        const videoToggleInputs = budgetContainer.querySelectorAll('input[data-video-toggle="true"]');
        videoToggleInputs.forEach(toggleInput => {
          const toggleName = toggleInput.name;
          if (toggleName && Object.prototype.hasOwnProperty.call(detailsData, toggleName)) {
            delete detailsData[toggleName];
          }
          const videoFieldName = toggleInput.dataset.target;
          if (!videoFieldName) return;
          if (!toggleInput.checked) {
            detailsData[videoFieldName] = null;
          }
        });
      }
      
      console.log('📤 Auftragsdetails-Daten:', detailsData);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/ef7c4a93-6b3c-4f97-afd6-79f1e3285bc3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1da93c'},body:JSON.stringify({sessionId:'1da93c',location:'AuftragList.js:2170',message:'detailsData before insert',data:{fieldKeys:Object.keys(detailsData),fieldCount:Object.keys(detailsData).length,detailsData:detailsData},timestamp:Date.now(),hypothesisId:'H-A,H-C'})}).catch(()=>{});
      // #endregion
      
      // 2. Auftragsdetails in Datenbank speichern
      const { data: createdDetails, error: detailsError } = await window.supabase
        .from('auftrag_details')
        .insert([detailsData])
        .select()
        .single();
      
      if (detailsError) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/ef7c4a93-6b3c-4f97-afd6-79f1e3285bc3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1da93c'},body:JSON.stringify({sessionId:'1da93c',location:'AuftragList.js:2180',message:'INSERT FAILED',data:{error:detailsError,errorMessage:detailsError?.message,errorDetails:detailsError?.details,errorHint:detailsError?.hint,errorCode:detailsError?.code},timestamp:Date.now(),hypothesisId:'H-A,H-C'})}).catch(()=>{});
        // #endregion
        console.error('❌ Fehler beim Erstellen der Auftragsdetails:', detailsError);
        window.toastSystem?.show('Auftrag erstellt, aber Auftragsdetails konnten nicht gespeichert werden.', 'warning');
        return false;
      }
      
      console.log('✅ Auftragsdetails erstellt:', createdDetails);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/ef7c4a93-6b3c-4f97-afd6-79f1e3285bc3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1da93c'},body:JSON.stringify({sessionId:'1da93c',location:'AuftragList.js:2190',message:'INSERT SUCCESS',data:{createdDetailsId:createdDetails?.id},timestamp:Date.now(),hypothesisId:'H-A'})}).catch(()=>{});
      // #endregion
      
      // 3. Kampagnenarten in Junction-Tabelle speichern
      if (this.embeddedSelectedKampagnenartIds.length > 0) {
        const junctionData = this.embeddedSelectedKampagnenartIds.map(kampagneArtId => ({
          auftrag_id: auftragId,
          kampagne_art_id: kampagneArtId
        }));
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/ef7c4a93-6b3c-4f97-afd6-79f1e3285bc3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1da93c'},body:JSON.stringify({sessionId:'1da93c',location:'AuftragList.js:2200',message:'Junction insert data',data:{junctionData:junctionData,count:junctionData.length},timestamp:Date.now(),hypothesisId:'H-D'})}).catch(()=>{});
        // #endregion
        
        const { error: junctionError } = await window.supabase
          .from('auftrag_kampagne_art')
          .insert(junctionData);
        
        if (junctionError) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/ef7c4a93-6b3c-4f97-afd6-79f1e3285bc3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1da93c'},body:JSON.stringify({sessionId:'1da93c',location:'AuftragList.js:2208',message:'Junction INSERT FAILED',data:{error:junctionError,errorMessage:junctionError?.message,errorCode:junctionError?.code},timestamp:Date.now(),hypothesisId:'H-D'})}).catch(()=>{});
          // #endregion
          console.error('❌ Fehler beim Speichern der Kampagnenarten:', junctionError);
        } else {
          console.log('✅ Kampagnenarten in Junction-Tabelle gespeichert');
        }
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Fehler bei handleAuftragsdetailsCreation:', error);
      window.toastSystem?.show('Auftrag erstellt, aber Auftragsdetails konnten nicht gespeichert werden.', 'warning');
      return false;
    }
  }

  // Generiert eine PO-Nummer im Format: PO-Kürzel-Jahr-AufträgeKunde-GesamtPO
  // Beispiel: PO-ABC-2025-3-42 (ABC=Kürzel, 2025=Jahr, 3=dritter Auftrag des Kunden, 42=42. PO insgesamt)
  async generatePoNummer(unternehmenId) {
    const currentYear = new Date().getFullYear();
    
    try {
      // 1. Unternehmen mit internem Kürzel laden
      if (!unternehmenId) {
        return { success: false, error: 'Bitte wählen Sie ein Unternehmen aus.' };
      }
      
      const { data: unternehmen, error: unternehmenError } = await window.supabase
        .from('unternehmen')
        .select('*')
        .eq('id', unternehmenId)
        .single();
      
      if (unternehmenError || !unternehmen) {
        console.error('❌ Fehler beim Laden des Unternehmens:', unternehmenError);
        return { success: false, error: 'Unternehmen konnte nicht geladen werden.' };
      }
      
      // 2. Prüfen ob internes Kürzel vorhanden ist
      const kuerzel = unternehmen.internes_kuerzel;
      if (!kuerzel || kuerzel.trim() === '') {
        return { 
          success: false, 
          error: `Das Unternehmen "${unternehmen.firmenname}" hat kein internes Kürzel. Bitte zuerst das Kürzel beim Unternehmen hinterlegen.` 
        };
      }
      
      // 3. Anzahl der Aufträge dieses Kunden zählen (+1 für den neuen)
      const { count: kundenAuftraegeCount, error: kundenError } = await window.supabase
        .from('auftrag')
        .select('id', { count: 'exact', head: true })
        .eq('unternehmen_id', unternehmenId);
      
      if (kundenError) {
        console.error('❌ Fehler beim Zählen der Kunden-Aufträge:', kundenError);
        return { success: false, error: 'Kundenaufträge konnten nicht gezählt werden.' };
      }
      
      const kundenAuftragNummer = (kundenAuftraegeCount || 0) + 1;
      
      // 4. GesamtPO-Nummer ermitteln (Primär: DB-Zähler, Fallback: Regex-basiert)
      let gesamtPoNummer;
      
      // Primär: Atomarer DB-Zähler via RPC-Funktion
      const { data: counterData, error: counterError } = await window.supabase
        .rpc('increment_po_counter');
      
      if (!counterError && counterData) {
        gesamtPoNummer = counterData;
        console.log(`✅ PO-Zähler aus DB: ${gesamtPoNummer}`);
      } else {
        // Fallback: Regex-basierte Ermittlung aus bestehenden POs
        console.warn('⚠️ DB-Zähler nicht verfügbar, nutze Fallback:', counterError?.message);
        gesamtPoNummer = await this.getMaxPoFromExistingData();
      }
      
      // 5. PO-Nummer generieren: PO-Kürzel-Jahr-AufträgeKunde-GesamtPO
      const poNummer = `PO-${kuerzel.trim()}-${currentYear}-${kundenAuftragNummer}-${gesamtPoNummer}`;
      console.log(`✅ Neue PO-Nummer generiert: ${poNummer}`);
      
      return { success: true, poNummer };
      
    } catch (e) {
      console.error('❌ Fehler bei PO-Nummer Generierung:', e);
      return { success: false, error: 'Ein unerwarteter Fehler bei der PO-Generierung ist aufgetreten.' };
    }
  }

  /**
   * Fallback-Methode: Ermittelt die höchste GesamtPO aus bestehenden Daten
   * Nur korrekt formatierte POs (PO-XXX-JJJJ-N-N) werden berücksichtigt
   * @returns {Promise<number>} Nächste verfügbare GesamtPO-Nummer
   */
  async getMaxPoFromExistingData() {
    try {
      const { data: auftraegeMitPo, error } = await window.supabase
        .from('auftrag')
        .select('po')
        .not('po', 'is', null);
      
      if (error) {
        console.error('❌ Fehler beim Laden der PO-Nummern:', error);
        return 1; // Fallback auf 1
      }
      
      // Regex für korrektes PO-Format: PO-Kürzel-Jahr-AufträgeKunde-GesamtPO
      // Erlaubt: Buchstaben, Zahlen, Leerzeichen und Sonderzeichen im Kürzel
      const poRegex = /^PO-.+-\d{4}-\d+-(\d+)$/;
      let maxGesamtPo = 0;
      
      for (const auftrag of auftraegeMitPo || []) {
        if (auftrag.po) {
          const match = auftrag.po.match(poRegex);
          if (match) {
            const gesamtPo = parseInt(match[1], 10);
            if (gesamtPo > maxGesamtPo) {
              maxGesamtPo = gesamtPo;
            }
          } else {
            // Log ungültige PO-Nummern zur Analyse
            console.warn(`⚠️ Ungültiges PO-Format ignoriert: "${auftrag.po}"`);
          }
        }
      }
      
      console.log(`📊 Höchste gültige GesamtPO aus Daten: ${maxGesamtPo}`);
      return maxGesamtPo + 1;
      
    } catch (e) {
      console.error('❌ Fehler bei Fallback PO-Ermittlung:', e);
      return 1; // Absoluter Fallback
    }
  }

  /**
   * Auftragsbestätigung Upload Handling
   * @param {string} auftragId - ID des Auftrags
   * @param {HTMLFormElement} form - Das Formular
   */
  async handleAuftragsbestaetigungUpload(auftragId, form) {
    const uploaderRoot = form.querySelector('.uploader[data-name="auftragsbestaetigung_file"]');
    
    if (!uploaderRoot || !uploaderRoot.__uploaderInstance || !uploaderRoot.__uploaderInstance.files.length) {
      console.log('📁 Keine Auftragsbestätigung zum Hochladen');
      return;
    }

    if (!window.supabase) {
      console.warn('⚠️ Supabase nicht verfügbar');
      return;
    }

    const file = uploaderRoot.__uploaderInstance.files[0];
    const bucket = 'auftragsbestaetigung';
    
    // Sicherer Dateiname
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.{2,}/g, '_')
      .substring(0, 200);
    
    const path = `${auftragId}/${Date.now()}_${sanitizedName}`;

    console.log(`📤 Uploading Auftragsbestätigung: ${file.name} -> ${path}`);

    // Upload zu Storage
    const { error: upErr } = await window.supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });

    if (upErr) {
      console.error('❌ Upload-Fehler:', upErr);
      throw upErr;
    }

    // Permanente Public URL generieren
    const { data: urlData } = window.supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    // URL in DB speichern
    const { error: dbErr } = await window.supabase
      .from('auftrag')
      .update({
        auftragsbestaetigung_url: urlData?.publicUrl || '',
        auftragsbestaetigung_path: path
      })
      .eq('id', auftragId);

    if (dbErr) {
      console.error('❌ DB-Fehler beim Speichern der URL:', dbErr);
      throw dbErr;
    }

    console.log('✅ Auftragsbestätigung erfolgreich hochgeladen');
  }
}

const auftragListInstance = new AuftragList();
export { auftragListInstance as auftragList };
