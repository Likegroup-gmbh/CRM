// AuftragList.js (ES6-Modul)
// Auftrags-Liste mit Filter, Verwaltung und Pagination
// Performance-optimierte Version
// Create-Form-Logik wurde nach AuftragCreateHandler.js ausgelagert

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
import { renderAuftragAmpel } from './logic/AuftragStatusUtils.js';
import { auftragCreateHandler } from './AuftragCreateHandler.js';

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
const VIEW_LIST_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" /></svg>`;
const VIEW_CAL_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>`;
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
    this._isKunde = null; // Gecachter Kunden-Status
    this.isDragging = false;
    this.startX = 0;
    this.scrollLeft = 0;
    this.dragScrollContainer = null;
    this._dragToScrollCleanup = null;

    // Suchfeld
    this.searchQuery = '';
    this._searchDebounceTimer = null;
  }

  // Gecachte Admin-Prüfung
  get isAdmin() {
    if (this._isAdmin === null) {
      this._isAdmin = window.currentUser?.rolle === 'admin' ||
                      window.currentUser?.rolle?.toLowerCase() === 'admin';
    }
    return this._isAdmin;
  }

  // Gecachte Kunden-Prüfung
  get isKunde() {
    if (this._isKunde === null) {
      this._isKunde = ['kunde', 'kunde_editor'].includes(
        window.currentUser?.rolle?.toLowerCase()
      );
    }
    return this._isKunde;
  }

  // Admin-Cache invalidieren (z.B. bei User-Wechsel)
  invalidateAdminCache() {
    this._isAdmin = null;
    this._isKunde = null;
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
      profile_image_url: person.profile_image_url || null,
      thumb_url: person.profile_image_thumb_url || null
    }]);
  }

  formatUnternehmenTag(unternehmen) {
    if (!unternehmen?.firmenname) return '-';

    const bubbleData = {
      name: unternehmen.firmenname,
      label: unternehmen.internes_kuerzel || unternehmen.firmenname,
      type: 'org',
      logo_url: unternehmen.logo_url || null,
      thumb_url: unternehmen.logo_thumb_url || null
    };
    if (!this.isKunde) {
      bubbleData.id = unternehmen.id;
      bubbleData.entityType = 'unternehmen';
    }
    return avatarBubbles.renderBubbles([bubbleData], { showLabel: true });
  }

  formatMarkeTag(marke) {
    if (!marke?.markenname) return '-';

    const bubbleData = {
      name: marke.markenname,
      type: 'org',
      logo_url: marke.logo_url || null,
      thumb_url: marke.logo_thumb_url || null
    };
    if (!this.isKunde) {
      bubbleData.id = marke.id;
      bubbleData.entityType = 'marke';
    }
    return avatarBubbles.renderBubbles([bubbleData], { showLabel: true });
  }

  formatMitarbeiterTags(entries) {
    if (!entries || entries.length === 0) return '-';

    const items = entries
      .map(item => {
        const name = item?.mitarbeiter?.name || item?.name;
        const id = item?.mitarbeiter?.id || item?.id;
        const profileImageUrl = item?.mitarbeiter?.profile_image_url || item?.profile_image_url;
        const profileImageThumbUrl = item?.mitarbeiter?.profile_image_thumb_url || item?.profile_image_thumb_url;
        if (!name) return null;
        return {
          name,
          type: 'person',
          id,
          entityType: 'mitarbeiter',
          profile_image_url: profileImageUrl || null,
          thumb_url: profileImageThumbUrl || null
        };
      })
      .filter(Boolean);

    return items.length > 0 ? avatarBubbles.renderBubbles(items) : '-';
  }

  // Initialisiere Auftrags-Liste
  async init() {

    // Pagination initialisieren mit dynamicResize für animiertes Entfernen
    this.pagination.init('pagination-auftrag', {
      itemsPerPage: 25,
      onPageChange: (page) => this.handlePageChange(page),
      onItemsPerPageChange: (limit, page) => this.handleItemsPerPageChange(limit, page),
      dynamicResize: true,
      tbodySelector: '.data-table tbody'
    });

    try {
      window.bulkActionSystem?.registerList('auftrag', this);

      if (this.isKunde && window.supabase) {
        const { count } = await window.supabase
          .from('kunde_marke')
          .select('*', { count: 'exact', head: true })
          .eq('kunde_id', window.currentUser.id);
        this._kundeHasMultipleMarken = (count || 0) > 1;
      } else {
        this._kundeHasMultipleMarken = false;
      }

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
      await this.render();

      // NACH render(): Overlay auf das NEUE tbody setzen
      const tbody = document.querySelector('.data-table tbody');
      TableAnimationHelper.showLoadingOverlay(tbody);

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
        await this.updateTable(auftraege);
        this.pagination.render();
      } else {
        TableAnimationHelper.hideLoadingOverlay(tbody);
      }

    } catch (error) {
      console.error('❌ AUFTRAGLIST: Fehler beim Laden und Rendern:', error);
      const tbodyError = document.querySelector('.data-table tbody');
      TableAnimationHelper.hideLoadingOverlay(tbodyError);
      if (window.ErrorHandler?.handle) {
        window.ErrorHandler.handle(error, 'AuftragList.loadAndRender');
      }
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
              ${!this.isKunde ? '<div id="filter-dropdown-container"></div>' : ''}
            </div>
          </div>
          <div class="table-actions">
            ${this.isAdmin ? '<button id="btn-select-all" class="secondary-btn">Alle auswählen</button>' : ''}
            ${this.isAdmin ? '<button id="btn-deselect-all" class="secondary-btn" style="display:none;">Auswahl aufheben</button>' : ''}
            <span id="selected-count" style="display:none;">0 ausgewählt</span>
            ${this.isAdmin ? '<button id="btn-delete-selected" class="danger-btn" style="display:none;">Ausgewählte löschen</button>' : ''}
            ${!this.isKunde ? '<button id="btn-auftrag-new" class="primary-btn">Neuen Auftrag anlegen</button>' : ''}
          </div>
        </div>
      `;
    }

    const html = `
      <div class="page-header">
        <div class="page-header-right">
          <div class="view-toggle">
            <button id="btn-view-list" class="secondary-btn ${this.currentView === 'list' ? 'active' : ''}">${VIEW_LIST_ICON} Liste</button>
            <button id="btn-view-calendar" class="secondary-btn ${this.currentView === 'calendar' ? 'active' : ''}">${VIEW_CAL_ICON} Kalender</button>
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

    if (this.currentView === 'calendar') {
      await this.initCashFlowCalendar();
    }
  }

  renderCreatedBy(user) {
    if (!user || !user.name) return '-';
    const items = [{
      name: user.name,
      type: 'person',
      id: user.id,
      entityType: 'mitarbeiter',
      profile_image_url: user.profile_image_url,
      thumb_url: user.profile_image_thumb_url || null
    }];
    return avatarBubbles.renderBubbles(items);
  }

  getListColumnCount() {
    if (this.isKunde) {
      return (this._kundeHasMultipleMarken ? 1 : 0) + 14;
    }

    return (this.isAdmin ? 1 : 0) + 19;
  }

  renderAuftragsdetailsLink(auftrag) {
    if (!auftrag.auftragsdetails_id) return '-';
    const name = window.validatorSystem.sanitizeHtml(auftrag.auftragsname || 'Unbekannter Auftrag');
    return `
      <a href="#" onclick="event.preventDefault(); window.navigateTo('/auftragsdetails/${auftrag.auftragsdetails_id}')" class="table-link details-link" title="Auftragsdetails anzeigen">
        ${name}
      </a>
    `;
  }

  // Rendere List-View HTML
  renderListView() {
    return `
      <!-- Daten-Tabelle -->
      <div class="table-container" id="auftrag-table-container">
          <table class="data-table auftrag-table">
            <thead>
              <tr>
                ${this.isAdmin ? `<th class="col-checkbox">
                  <input type="checkbox" id="select-all-auftraege">
                </th>` : ''}
                ${!this.isKunde ? '<th class="col-unternehmen">Unternehmen</th>' : ''}
                ${!this.isKunde || this._kundeHasMultipleMarken ? '<th>Marke</th>' : ''}
                <th>Angebotsnummer</th>
                <th>Rechnungsnummer</th>
                <th>Externe PO</th>
                <th class="col-rechnung-gestellt">Rechnungsdatum</th>
                <th>Zahlungsziel</th>
                <th class="col-re-faelligkeit">Rechnungsfälligkeit</th>
                <th>Betrag netto</th>
                <th>Umsatzsteuer</th>
                <th>Betrag brutto</th>
                <th class="table-cell-center">Rechnung gestellt</th>
                <th class="table-cell-center">Überwiesen</th>
                <th class="col-ueberwiesen">Bezahlt am</th>
                ${!this.isKunde ? '<th>Ansprechpartner</th>' : ''}
                <th class="col-erstellt-von">Erstellt von</th>
                <th>Status</th>
                ${!this.isKunde ? '<th class="table-cell-center col-details">Details</th>' : ''}
                ${!this.isKunde ? '<th class="col-actions">Aktionen</th>' : ''}
              </tr>
            </thead>
            <tbody id="auftraege-table-body">
              <tr>
                <td colspan="${this.getListColumnCount()}" class="loading">Lade Aufträge...</td>
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

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      // Query mit nur benötigten Feldern aufbauen.
      // auftrag_details(id) liefert via FK+Unique-Index die 1:1-Relation direkt mit -
      // daher kein zusätzlicher Fetch nötig.
      // count: 'estimated' nutzt Postgres-Statistiken statt Full-Scan (deutlich schneller).
      let query = window.supabase
        .from('auftrag')
        .select(`
          id,
          auftragsname,
          angebotsnummer,
          status,
          po,
          externe_po,
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
          created_by_id,
          created_at,
          unternehmen:unternehmen_id(id, firmenname, internes_kuerzel, logo_url, logo_thumb_url),
          marke:marke_id(id, markenname, logo_url, logo_thumb_url),
          ansprechpartner:ansprechpartner_id(id, vorname, nachname, email, profile_image_url, profile_image_thumb_url),
          created_by:created_by_id(id, name, profile_image_url, profile_image_thumb_url),
          auftrag_details(id),
          kampagne_arten:auftrag_kampagne_art(art:kampagne_art_id(id, name))
        `, { count: 'estimated' });

      query = AuftragFilterLogic.buildSupabaseQuery(query, filters);

      query = query
        .order('created_at', { ascending: false })
        .order('angebotsnummer', { ascending: false, nullsFirst: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('❌ Fehler beim Laden der Aufträge:', error);
        throw error;
      }

      const createdByFallbacks = await this.loadCreatedByFallbacks(data || []);

      // Daten für Kompatibilität formatieren - Details via Inline-JOIN (1:1 Relation)
      const formattedData = (data || []).map(auftrag => {
        const details = auftrag.auftrag_details;
        const detailsId = Array.isArray(details) ? details[0]?.id : details?.id;

        return {
          ...auftrag,
          has_auftragsdetails: Boolean(detailsId),
          auftragsdetails_id: detailsId || null,
          created_by: auftrag.created_by || createdByFallbacks.get(auftrag.created_by_id) || null,
          unternehmen: auftrag.unternehmen ? {
            id: auftrag.unternehmen.id,
            firmenname: auftrag.unternehmen.firmenname,
            internes_kuerzel: auftrag.unternehmen.internes_kuerzel,
            logo_url: auftrag.unternehmen.logo_url,
            logo_thumb_url: auftrag.unternehmen.logo_thumb_url
          } : null,
          marke: auftrag.marke ? {
            id: auftrag.marke.id,
            markenname: auftrag.marke.markenname,
            logo_url: auftrag.marke.logo_url,
            logo_thumb_url: auftrag.marke.logo_thumb_url
          } : null,
          art_der_kampagne: (auftrag.kampagne_arten || [])
            .map(ka => ka.art?.name)
            .filter(Boolean)
        };
      });

      return { data: formattedData, count: count || 0 };

    } catch (error) {
      console.error('❌ Fehler beim Laden der Aufträge:', error);
      throw error;
    }
  }

  async loadCreatedByFallbacks(auftraege) {
    const missingIds = [...new Set((auftraege || [])
      .filter(auftrag => auftrag.created_by_id && !auftrag.created_by?.name)
      .map(auftrag => auftrag.created_by_id))];

    if (missingIds.length === 0 || !window.supabase) {
      return new Map();
    }

    const fields = 'id, auth_user_id, name, profile_image_url, profile_image_thumb_url';

    try {
      const [{ data: byBenutzerId }, { data: byAuthUserId }] = await Promise.all([
        window.supabase.from('benutzer').select(fields).in('id', missingIds),
        window.supabase.from('benutzer').select(fields).in('auth_user_id', missingIds)
      ]);

      const usersByCreatedById = new Map();
      (byBenutzerId || []).forEach(user => usersByCreatedById.set(user.id, user));
      (byAuthUserId || []).forEach(user => usersByCreatedById.set(user.auth_user_id, user));
      return usersByCreatedById;
    } catch (error) {
      console.warn('⚠️ Erstellt-von-Fallback konnte nicht geladen werden:', error);
      return new Map();
    }
  }

  // Initialisiere Filterbar mit neuem Filtersystem
  async initializeFilterBar() {
    if (this.isKunde) return;
    const filterContainer = document.getElementById('filter-dropdown-container');
    if (filterContainer) {
      await filterDropdown.init('auftrag', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }

  onFiltersApplied(filters) {
    filterSystem.applyFilters('auftrag', filters);
    this.pagination.reset();
    this.loadAndRender();
  }

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

    if (this._dragToScrollCleanup) {
      this._dragToScrollCleanup();
    }

    this.dragScrollContainer = container;

    const handleMouseDown = (e) => {
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
        e.target.closest('.actions-dropdown') ||
        e.target.closest('.actions-dropdown-portal')
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
    this._globalClickHandler = (e) => {
      // View-Toggle Buttons
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

      if (e.target.id === 'btn-auftrag-new' || e.target.id === 'btn-auftrag-new-filter') {
        e.preventDefault();
        window.navigateTo('/auftrag/new');
        return;
      }

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

      if (e.target.classList.contains('table-link') && e.target.dataset.table === 'auftrag') {
        e.preventDefault();
        const auftragId = e.target.dataset.id;
        window.navigateTo(`/auftrag/${auftragId}`);
        return;
      }

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

    this._globalChangeHandler = (e) => {
      if (e.target.classList.contains('auftrag-inline-date-input')) {
        this.handleInlineBillingDateChange(e.target);
        return;
      }

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

    this._entityUpdatedHandler = (e) => {
      const entity = e?.detail?.entity;
      if (entity !== 'auftrag' && entity !== 'auftrag_details' && entity !== 'auftragsdetails') return;

      const isInlineBillingUpdate =
        entity === 'auftrag' &&
        e.detail.action === 'updated' &&
        (e.detail.field === 'rechnung_gestellt_am' || e.detail.field === 'ueberwiesen_am') &&
        e.detail.id;

      if (isInlineBillingUpdate) {
        this.syncInlineBillingUpdate(e.detail.id, e.detail.field, e.detail.value);
        return;
      }

      this.loadAndRender();
    };

    document.addEventListener('click', this._globalClickHandler);
    document.addEventListener('change', this._globalChangeHandler);
    this._inlineDatePickerCleanup = CustomDatePicker.bind(document);
    window.addEventListener('entityUpdated', this._entityUpdatedHandler);
  }

  hasActiveFilters() {
    const filters = window.filterSystem.getFilters('auftrag');
    return Object.keys(filters).length > 0;
  }

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
            <td colspan="${this.getListColumnCount()}" class="no-data">
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
        const paymentStatusClass = auftrag.ueberwiesen
          ? 'auftrag-row--ueberwiesen'
          : auftrag.rechnung_gestellt
            ? 'auftrag-row--rechnung-gestellt'
            : '';
        const rowClasses = paymentStatusClass;
        return `
        <tr data-id="${auftrag.id}" class="${rowClasses}" data-rechnung-gestellt="${Boolean(auftrag.rechnung_gestellt)}" data-ueberwiesen="${Boolean(auftrag.ueberwiesen)}">
          ${this.isAdmin ? `<td class="col-checkbox"><input type="checkbox" class="auftrag-check" data-id="${auftrag.id}"></td>` : ''}
          ${!this.isKunde ? `<td class="col-unternehmen">${this.formatUnternehmenTag(auftrag.unternehmen)}</td>` : ''}
          ${!this.isKunde || this._kundeHasMultipleMarken ? `<td>${this.formatMarkeTag(auftrag.marke)}</td>` : ''}
          <td>${window.validatorSystem.sanitizeHtml(auftrag.angebotsnummer || '-')}</td>
          <td>${window.validatorSystem.sanitizeHtml(auftrag.re_nr || '-')}</td>
          <td>${window.validatorSystem.sanitizeHtml(auftrag.externe_po || '-')}</td>
          <td class="col-rechnung-gestellt">${this.formatDate(auftrag.rechnung_gestellt_am)}</td>
          <td>${this.formatZahlungsziel(auftrag.zahlungsziel_tage)}</td>
          <td>${this.formatDate(auftrag.re_faelligkeit)}</td>
          <td>${this.formatCurrency(auftrag.nettobetrag)}</td>
          <td>${this.formatCurrency(auftrag.ust_betrag)}</td>
          <td>${this.formatCurrency(auftrag.bruttobetrag)}</td>
          <td class="table-cell-center">${this.renderBillingDateCell(auftrag, 'rechnung_gestellt', 'rechnung_gestellt_am')}</td>
          <td class="table-cell-center">${this.renderBillingDateCell(auftrag, 'ueberwiesen', 'ueberwiesen_am')}</td>
          <td class="col-ueberwiesen">${this.formatDate(auftrag.ueberwiesen_am)}</td>
          ${!this.isKunde ? `<td>${this.formatAnsprechpartner(auftrag.ansprechpartner)}</td>` : ''}
          <td class="col-erstellt-von">${this.renderCreatedBy(auftrag.created_by)}</td>
          <td>${renderAuftragAmpel(auftrag.status)}</td>
          ${!this.isKunde ? `<td class="table-cell-center col-details">${this.renderAuftragsdetailsLink(auftrag)}</td>` : ''}
          ${!this.isKunde ? `<td class="col-actions">${actionBuilder.create('auftrag', auftrag.id)}</td>` : ''}
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

  // Show Create Form (für Routing) - delegiert an AuftragCreateHandler
  showCreateForm() {
    auftragCreateHandler.showCreateForm();
  }

  // Cleanup
  destroy() {
    clearTimeout(this._searchDebounceTimer);

    if (this.pagination) {
      this.pagination.destroy();
    }

    this._boundEventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this._boundEventListeners.clear();

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

    this._globalEventsBound = false;
    this._auftragNewBound = false;
    this._isAdmin = null;

    if (this.boundFilterResetHandler) {
      document.removeEventListener('click', this.boundFilterResetHandler);
      this.boundFilterResetHandler = null;
    }
  }
}

const auftragListInstance = new AuftragList();
export { auftragListInstance as auftragList };
