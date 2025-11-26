// AuftragCashFlowCalendar.js (ES6-Modul)
// Cash Flow Kalender-Ansicht für Aufträge mit monatlicher Übersicht

import { filterDropdown } from '../../core/filters/FilterDropdown.js';

export class AuftragCashFlowCalendar {
  constructor() {
    this.currentYear = new Date().getFullYear();
    this.auftraege = [];
    this.groupedData = [];
    this.container = null;
    this.months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    this.currentFilters = {};
  }

  // Initialisiere Kalender
  async init(container) {
    console.log('📅 CASHFLOW: Initialisiere Cash Flow Calendar');
    this.container = container;
    
    await this.loadData();
    this.render();
    this.bindEvents();
    await this.initializeFilterBar();
    this.initFloatingScrollbar();
    this.bindDragToScroll();
  }

  // Lade Daten für das gewählte Jahr
  async loadData() {
    console.log(`🔍 CASHFLOW: Lade Aufträge für Jahr ${this.currentYear}`);
    
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar');
        this.auftraege = [];
        return;
      }

      // Lade ALLE Aufträge (nicht nur die mit Datums-Feldern)
      let query = window.supabase
        .from('auftrag')
        .select(`
          *,
          unternehmen:unternehmen_id(id, firmenname, logo_url),
          marke:marke_id(id, markenname, logo_url)
        `);

      // Filter anwenden
      if (this.currentFilters.unternehmen_id) {
        query = query.eq('unternehmen_id', this.currentFilters.unternehmen_id);
      }

      if (this.currentFilters.marke_id) {
        query = query.eq('marke_id', this.currentFilters.marke_id);
      }

      query = query.order('unternehmen_id', { ascending: true })
                   .order('marke_id', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('❌ Fehler beim Laden der Cash Flow Daten:', error);
        this.auftraege = [];
        return;
      }

      this.auftraege = data || [];
      console.log(`✅ ${this.auftraege.length} Aufträge geladen`);
      
      // Daten gruppieren
      this.groupData();
      
    } catch (error) {
      console.error('❌ Fehler beim Laden:', error);
      this.auftraege = [];
    }
  }

  // Gruppiere Daten nach Unternehmen > Marke
  groupData() {
    console.log('📊 CASHFLOW: Gruppiere Daten');
    
    const grouped = new Map();
    
    this.auftraege.forEach(auftrag => {
      const unternehmenId = auftrag.unternehmen?.id || 'unbekannt';
      const markeId = auftrag.marke?.id || 'unbekannt';
      const key = `${unternehmenId}-${markeId}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          unternehmen: auftrag.unternehmen,
          marke: auftrag.marke,
          auftraege: [],
          months: Array(12).fill(null).map(() => ({ auftraege: [], total: 0, status: null }))
        });
      }
      
      const group = grouped.get(key);
      group.auftraege.push(auftrag);
      
      // Zuordnung zu Monaten
      this.assignToMonths(auftrag, group.months);
    });
    
    // Konvertiere Map zu Array
    this.groupedData = Array.from(grouped.values());
    
    // Sortiere nach Unternehmen > Marke
    this.groupedData.sort((a, b) => {
      const unternehmenA = a.unternehmen?.firmenname || '';
      const unternehmenB = b.unternehmen?.firmenname || '';
      if (unternehmenA !== unternehmenB) return unternehmenA.localeCompare(unternehmenB);
      
      const markeA = a.marke?.markenname || '';
      const markeB = b.marke?.markenname || '';
      return markeA.localeCompare(markeB);
    });
    
    console.log(`✅ ${this.groupedData.length} Gruppen erstellt`);
  }

  // Ordne Auftrag zu Monaten zu
  assignToMonths(auftrag, months) {
    const rechnungDatum = auftrag.rechnung_gestellt_am ? new Date(auftrag.rechnung_gestellt_am) : null;
    const ueberweisenDatum = auftrag.ueberwiesen_am ? new Date(auftrag.ueberwiesen_am) : null;
    const betrag = parseFloat(auftrag.nettobetrag) || 0;
    
    // Füge Auftrag im Rechnungsmonat hinzu (wenn Rechnung gestellt wurde)
    if (rechnungDatum && rechnungDatum.getFullYear() === this.currentYear) {
      const monthIndex = rechnungDatum.getMonth();
      
      // Prüfe ob bereits ein Eintrag für diesen Auftrag existiert
      const existingEntry = months[monthIndex].auftraege.find(a => a.id === auftrag.id);
      
      if (!existingEntry) {
        months[monthIndex].auftraege.push({
          id: auftrag.id,
          auftragsname: auftrag.auftragsname,
          betrag: betrag,
          status: 'invoiced',
          datum: rechnungDatum
        });
        months[monthIndex].total += betrag;
        
        // Setze Status auf invoiced wenn noch nicht paid
        if (!months[monthIndex].status || months[monthIndex].status === 'invoiced') {
          months[monthIndex].status = 'invoiced';
        }
      }
    }
    
    // Füge Auftrag im Überweisungsmonat hinzu (wenn überwiesen wurde)
    if (ueberweisenDatum && ueberweisenDatum.getFullYear() === this.currentYear) {
      const monthIndex = ueberweisenDatum.getMonth();
      
      // Prüfe ob bereits ein Eintrag für diesen Auftrag existiert
      const existingEntry = months[monthIndex].auftraege.find(a => a.id === auftrag.id);
      
      if (!existingEntry) {
        months[monthIndex].auftraege.push({
          id: auftrag.id,
          auftragsname: auftrag.auftragsname,
          betrag: betrag,
          status: 'paid',
          datum: ueberweisenDatum
        });
        months[monthIndex].total += betrag;
      }
      
      // Setze Status auf paid (überschreibt invoiced)
      months[monthIndex].status = 'paid';
    }
    
    // Wenn kein Datum vorhanden ist, wird der Auftrag nicht in einem Monat angezeigt
    // Er erscheint aber in der Gruppenliste (wird bei groupData() hinzugefügt)
  }

  // Rendere Kalender
  render() {
    if (!this.container) return;
    
    // Erstelle Jahr-Optionen (aktuelles Jahr ±5 Jahre)
    const currentYear = new Date().getFullYear();
    const yearOptions = [];
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
      yearOptions.push(`<option value="${i}" ${i === this.currentYear ? 'selected' : ''}>${i}</option>`);
    }
    
    const html = `
      <div class="cash-flow-calendar">
        <!-- Jahr-Auswahl und Filter -->
        <div class="cash-flow-header">
          <select id="cash-flow-year-select" class="form-select">
            ${yearOptions.join('')}
          </select>
          <div class="filter-bar">
            <div id="filter-dropdown-container-cashflow"></div>
          </div>
        </div>

        <!-- Tabelle -->
        <div class="cash-flow-table-container">
          <table class="cash-flow-table">
            <thead>
              <tr>
                <th class="sticky-col">Unternehmen</th>
                <th class="sticky-col-2">Marke</th>
                ${this.months.map(m => `<th>${m}</th>`).join('')}
                <th class="total-col">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${this.renderRows()}
            </tbody>
            <tfoot>
              ${this.renderFooter()}
            </tfoot>
          </table>
        </div>
      </div>
    `;
    
    this.container.innerHTML = html;
  }

  // Rendere Tabellenzeilen
  renderRows() {
    if (this.groupedData.length === 0) {
      return `
        <tr>
          <td colspan="${14}" class="empty-state-cell">
            <div class="empty-state">
              <div class="empty-icon">📅</div>
              <h3>Keine Daten für ${this.currentYear}</h3>
              <p>Für dieses Jahr gibt es noch keine Aufträge mit Rechnungs- oder Überweisungsdaten.</p>
            </div>
          </td>
        </tr>
      `;
    }
    
    let rows = [];
    
    this.groupedData.forEach((group, index) => {
      const unternehmenName = group.unternehmen?.firmenname || 'Unbekanntes Unternehmen';
      const markeName = group.marke?.markenname || '';
      
      // Jahres-Total für diese Marke berechnen
      const yearTotal = group.months.reduce((sum, m) => sum + m.total, 0);
      
      // Datenzeile (ohne Gruppierungs-Header)
      rows.push(`
        <tr class="cash-flow-data-row" data-group-index="${index}">
          <td class="sticky-col unternehmen-cell">${this.escapeHtml(unternehmenName)}</td>
          <td class="sticky-col-2 marke-cell">${markeName ? this.escapeHtml(markeName) : ''}</td>
          ${group.months.map((month, monthIndex) => this.renderCell(month, index, monthIndex)).join('')}
          <td class="total-cell">${this.formatCurrency(yearTotal)}</td>
        </tr>
      `);
    });
    
    return rows.join('');
  }

  // Rendere einzelne Zelle
  renderCell(month, groupIndex, monthIndex) {
    if (month.auftraege.length === 0) {
      return '<td class="cash-flow-cell empty-cell"></td>';
    }
    
    const statusClass = month.status === 'paid' ? 'paid' : 'invoiced';
    const tooltip = this.generateTooltip(month.auftraege);
    
    return `
      <td class="cash-flow-cell ${statusClass}" 
          data-group="${groupIndex}" 
          data-month="${monthIndex}"
          title="${tooltip}">
        ${this.formatCurrency(month.total)}
      </td>
    `;
  }

  // Rendere Footer mit Summen
  renderFooter() {
    const monthTotals = Array(12).fill(0);
    let grandTotal = 0;
    
    this.groupedData.forEach(group => {
      group.months.forEach((month, i) => {
        monthTotals[i] += month.total;
        grandTotal += month.total;
      });
    });
    
    return `
      <tr class="cash-flow-totals">
        <td class="sticky-col">SUMME</td>
        <td class="sticky-col-2"></td>
        ${monthTotals.map(total => `<td>${total > 0 ? this.formatCurrency(total) : ''}</td>`).join('')}
        <td class="total-cell grand-total">${this.formatCurrency(grandTotal)}</td>
      </tr>
    `;
  }

  // Generiere Tooltip für Zelle
  generateTooltip(auftraege) {
    if (auftraege.length === 0) return '';
    
    const items = auftraege.map(a => 
      `${a.auftragsname}: ${this.formatCurrency(a.betrag)}`
    ).join('\n');
    
    return `${auftraege.length} Auftrag/Aufträge:\n${items}`;
  }

  // Event-Handler binden
  bindEvents() {
    // Jahr-Dropdown
    const yearSelect = document.getElementById('cash-flow-year-select');
    
    if (yearSelect) {
      yearSelect.addEventListener('change', async (e) => {
        this.currentYear = parseInt(e.target.value);
        await this.loadData();
        this.render();
        this.bindEvents();
        // Re-initialisiere Floating Scrollbar und Drag-to-Scroll
        this.initFloatingScrollbar();
        this.bindDragToScroll();
      });
    }
    
    // Zellen-Klick für Details
    const cells = this.container.querySelectorAll('.cash-flow-cell:not(.empty-cell)');
    cells.forEach(cell => {
      cell.addEventListener('click', (e) => {
        const groupIndex = parseInt(e.currentTarget.dataset.group);
        const monthIndex = parseInt(e.currentTarget.dataset.month);
        this.showCellDetails(groupIndex, monthIndex);
      });
    });
  }

  // Zeige Details für Zelle mit Drawer
  async showCellDetails(groupIndex, monthIndex) {
    const group = this.groupedData[groupIndex];
    if (!group) return;
    
    const month = group.months[monthIndex];
    if (!month || month.auftraege.length === 0) return;
    
    const monthName = this.months[monthIndex];
    const unternehmenName = group.unternehmen?.firmenname || 'Unbekannt';
    const markeName = group.marke?.markenname || '';
    
    // Lade vollständige Auftrags-Details aus der Datenbank
    const auftragIds = month.auftraege.map(a => a.id);
    
    try {
      const { data: auftraege, error } = await window.supabase
        .from('auftrag')
        .select('*')
        .in('id', auftragIds);
      
      if (error) {
        console.error('❌ Fehler beim Laden der Auftrags-Details:', error);
        if (window.notificationSystem && typeof window.notificationSystem.showNotification === 'function') {
          window.notificationSystem.showNotification('Fehler beim Laden der Auftrags-Details', 'error');
        }
        return;
      }
      
      // Öffne den Details-Drawer
      const { CashFlowDetailsDrawer } = await import('./CashFlowDetailsDrawer.js');
      const drawer = new CashFlowDetailsDrawer();
      await drawer.open(auftraege, unternehmenName, markeName, monthName, this.currentYear);
      
    } catch (error) {
      console.error('❌ Fehler beim Öffnen des Details-Drawers:', error);
      if (window.notificationSystem && typeof window.notificationSystem.showNotification === 'function') {
        window.notificationSystem.showNotification('Fehler beim Öffnen der Details', 'error');
      }
    }
  }

  // Hilfsfunktionen
  formatCurrency(value) {
    if (!value || value === 0) return '';
    return new Intl.NumberFormat('de-DE', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  escapeHtml(text) {
    if (!text) return '';
    if (window.validatorSystem?.sanitizeHtml) {
      return window.validatorSystem.sanitizeHtml(text);
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Cleanup
  destroy() {
    console.log('🧹 CASHFLOW: Cleanup');
    
    // Entferne Floating Scrollbar
    const floatingScrollbar = document.getElementById('floating-scrollbar-cashflow');
    if (floatingScrollbar) {
      floatingScrollbar.remove();
    }
    
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.auftraege = [];
    this.groupedData = [];
  }

  // Initialisiere Floating Scrollbar
  initFloatingScrollbar() {
    console.log('📊 CASHFLOW: Initialisiere Floating Scrollbar');
    
    // Entferne vorhandene Scrollbar falls vorhanden
    let floatingScrollbar = document.getElementById('floating-scrollbar-cashflow');
    if (floatingScrollbar) {
      floatingScrollbar.remove();
    }

    const tableContainer = document.querySelector('.cash-flow-table-container');
    const table = document.querySelector('.cash-flow-table');
    
    if (!tableContainer || !table) {
      console.warn('⚠️ CASHFLOW: Tabelle oder Container nicht gefunden');
      return;
    }

    // Erstelle Floating Scrollbar
    floatingScrollbar = document.createElement('div');
    floatingScrollbar.id = 'floating-scrollbar-cashflow';
    floatingScrollbar.className = 'floating-scrollbar-kampagne'; // Nutze bestehende Klasse
    
    const scrollbarInner = document.createElement('div');
    scrollbarInner.className = 'floating-scrollbar-inner';
    floatingScrollbar.appendChild(scrollbarInner);
    
    document.body.appendChild(floatingScrollbar);

    // Funktion zum Aktualisieren der Scrollbar-Position und -Breite
    const updateScrollbarPosition = () => {
      const containerRect = tableContainer.getBoundingClientRect();
      scrollbarInner.style.width = table.scrollWidth + 'px';
      floatingScrollbar.style.left = containerRect.left + 'px';
      floatingScrollbar.style.width = containerRect.width + 'px';
    };

    // ResizeObserver für automatische Größenanpassung
    const resizeObserver = new ResizeObserver(() => {
      updateScrollbarPosition();
      toggleFloatingScrollbar();
    });

    resizeObserver.observe(table);
    resizeObserver.observe(tableContainer);
    
    // Synchronisiere Scrolling zwischen Floating-Scrollbar und Tabelle
    let isSyncingFromFloating = false;
    let isSyncingFromTable = false;
    
    // Floating -> Table
    const handleFloatingScroll = () => {
      if (isSyncingFromTable) return;
      isSyncingFromFloating = true;
      tableContainer.scrollLeft = floatingScrollbar.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingFromFloating = false;
      });
    };
    floatingScrollbar.addEventListener('scroll', handleFloatingScroll);
    
    // Table -> Floating
    const handleTableScroll = () => {
      if (isSyncingFromFloating) return;
      isSyncingFromTable = true;
      floatingScrollbar.scrollLeft = tableContainer.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingFromTable = false;
      });
    };
    tableContainer.addEventListener('scroll', handleTableScroll);
    
    // Zeige/Verstecke Floating-Scrollbar basierend auf Sichtbarkeit der Tabelle
    const toggleFloatingScrollbar = () => {
      const tableRect = tableContainer.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // Zeige Floating-Scrollbar nur wenn:
      // 1. Wir auf der Aufträge-Seite sind
      // 2. Tabelle breiter als Viewport ist (horizontales Scrollen nötig)
      // 3. Tabelle teilweise oder ganz sichtbar ist
      const isOnAuftragPage = window.location.pathname.includes('/auftraege') || window.location.pathname.includes('/auftrag');
      const needsHorizontalScroll = table.scrollWidth > tableContainer.clientWidth;
      const tableIsVisible = tableRect.top < viewportHeight && tableRect.bottom > 0;
      
      if (isOnAuftragPage && needsHorizontalScroll && tableIsVisible) {
        updateScrollbarPosition();
        floatingScrollbar.classList.add('visible');
      } else {
        floatingScrollbar.classList.remove('visible');
      }
    };
    
    // Initial check
    toggleFloatingScrollbar();
    
    // Bei Scroll und Resize prüfen
    window.addEventListener('scroll', toggleFloatingScrollbar);
    window.addEventListener('resize', toggleFloatingScrollbar);
    
    // Bei Route-Change verstecken
    window.addEventListener('popstate', () => {
      floatingScrollbar.classList.remove('visible');
    });

    console.log('✅ CASHFLOW: Floating Scrollbar initialisiert');
  }

  // Drag-to-Scroll für horizontales Scrollen der Tabelle
  bindDragToScroll() {
    const container = document.querySelector('.cash-flow-table-container');
    if (!container) {
      console.warn('⚠️ CASHFLOW: Container für Drag-to-Scroll nicht gefunden');
      return;
    }
    
    console.log('🖱️ CASHFLOW: Initialisiere Drag-to-Scroll');
    
    let isDragging = false;
    let startX;
    let scrollLeft;
    
    // Entferne alte Event-Listener, falls vorhanden
    if (this._dragMouseDown) {
      container.removeEventListener('mousedown', this._dragMouseDown);
      document.removeEventListener('mousemove', this._dragMouseMove);
      document.removeEventListener('mouseup', this._dragMouseUp);
      document.removeEventListener('mouseleave', this._dragMouseUp);
    }
    
    // Mousedown - Starte Dragging
    this._dragMouseDown = (e) => {
      // Ignoriere wenn auf klickbare Elemente geklickt wird
      if (
        e.target.tagName === 'BUTTON' ||
        e.target.tagName === 'A' ||
        e.target.closest('a') ||
        e.target.classList.contains('cash-flow-cell') ||
        e.target.closest('.cash-flow-cell')
      ) {
        return;
      }
      
      isDragging = true;
      startX = e.pageX - container.offsetLeft;
      scrollLeft = container.scrollLeft;
      
      container.style.cursor = 'grabbing';
      container.style.userSelect = 'none';
      
      e.preventDefault();
    };
    
    // Mousemove - Scrolle wenn dragging aktiv ist
    this._dragMouseMove = (e) => {
      if (!isDragging) return;
      
      e.preventDefault();
      
      const x = e.pageX - container.offsetLeft;
      const walk = (x - startX) * 1.5; // Multiplikator für Scroll-Geschwindigkeit
      container.scrollLeft = scrollLeft - walk;
    };
    
    // Mouseup - Beende Dragging
    this._dragMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        container.style.cursor = 'grab';
        container.style.userSelect = '';
      }
    };
    
    container.addEventListener('mousedown', this._dragMouseDown);
    document.addEventListener('mousemove', this._dragMouseMove);
    document.addEventListener('mouseup', this._dragMouseUp);
    document.addEventListener('mouseleave', this._dragMouseUp);
    
    // Setze initialen Cursor
    container.style.cursor = 'grab';
    
    console.log('✅ CASHFLOW: Drag-to-Scroll initialisiert');
  }

  // Initialisiere Filter-Bar
  async initializeFilterBar() {
    const filterContainer = document.getElementById('filter-dropdown-container-cashflow');
    if (filterContainer) {
      await filterDropdown.init('auftrag_cashflow', filterContainer, {
        onFilterApply: (filters) => this.onFiltersApplied(filters),
        onFilterReset: () => this.onFiltersReset()
      });
    }
  }

  // Filter angewendet
  async onFiltersApplied(filters) {
    console.log('🔍 CASHFLOW: Filter angewendet:', filters);
    this.currentFilters = filters;
    await this.loadData();
    this.render();
    this.bindEvents();
    this.initFloatingScrollbar();
    this.bindDragToScroll();
  }

  // Filter zurückgesetzt
  async onFiltersReset() {
    console.log('🔄 CASHFLOW: Filter zurückgesetzt');
    this.currentFilters = {};
    await this.loadData();
    this.render();
    this.bindEvents();
    this.initFloatingScrollbar();
    this.bindDragToScroll();
  }
}

