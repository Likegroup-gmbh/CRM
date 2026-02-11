// KampagneCalendarView.js - Kalenderansicht für Kampagnen mit Sidebar
// Zeigt Wochenkalender + Sidebar mit "Heute/Diese Woche/Dieser Monat" Gruppierung

import { KampagnePreviewDrawer } from './KampagnePreviewDrawer.js';
import { KampagneUtils } from './KampagneUtils.js';

// Debug-Flag für Logging (Production: false)
const DEBUG_CALENDAR = false;
const debugLog = (...args) => DEBUG_CALENDAR && console.log(...args);

export class KampagneCalendarView {
  constructor() {
    this.container = null;
    this.kampagnen = [];
    this.currentWeekStart = this.getWeekStart(new Date());
    this.currentMonthStart = this.getMonthStart(new Date());
    this.previewDrawer = null;
    this.currentSidebarTab = 'today'; // 'today', 'week', 'month'
    this.currentView = 'week'; // 'week' oder 'month'
    
    // Suchfilter
    this.searchQuery = '';
    
    // Drag & Drop State
    this.draggedEvent = null;
    this.boundDragHandlers = {
      dragStart: (e) => this.onDragStart(e),
      dragEnd: (e) => this.onDragEnd(e),
      dragOver: (e) => this.onDragOver(e),
      drop: (e) => this.onDrop(e),
      dragLeave: (e) => this.onDragLeave(e)
    };
    
    // Deadline-Typ Mapping
    this.deadlineTypes = {
      start: { label: 'Start', color: 'var(--color-info)' },
      deadline_briefing: { label: 'Briefing', color: 'var(--color-accent)' },
      deadline_strategie: { label: 'Strategie', color: 'var(--color-warning)' },
      deadline_skripte: { label: 'Skripte', color: 'var(--color-tertiary)' },
      deadline_creator_sourcing: { label: 'Sourcing', color: 'var(--color-primary)' },
      deadline_video_produktion: { label: 'Video Produktion', color: 'var(--color-success)' },
      deadline_post_produktion: { label: 'Post Produktion', color: 'var(--color-secondary)' }
    };
  }

  async init(containerElement) {
    this.container = containerElement;
    this.previewDrawer = new KampagnePreviewDrawer();
    
    await this.loadKampagnen();
    this.render();
    this.bindEvents();
  }

  async loadKampagnen() {
    try {
      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar');
        this.kampagnen = [];
        return;
      }

      // Nutze zentralisierte Permission-Logik aus KampagneUtils
      const allowedIds = await KampagneUtils.loadAllowedKampagneIds();
      
      // null = keine Filterung (Admin/Kunde), [] = kein Zugriff
      if (allowedIds !== null && allowedIds.length === 0) {
        this.kampagnen = [];
        return;
      }

      // Kampagnen laden
      let query = window.supabase
        .from('kampagne')
        .select(`
          id,
          kampagnenname,
          eigener_name,
          start,
          deadline_strategie,
          deadline_creator_sourcing,
          deadline_video_produktion,
          deadline_post_produktion,
          status_id,
          creatoranzahl,
          videoanzahl,
          unternehmen:unternehmen_id(id, firmenname, logo_url),
          marke:marke_id(id, markenname, logo_url),
          status_ref:status_id(id, name)
        `)
        .order('created_at', { ascending: false });

      // Permission-Filterung anwenden (nur wenn allowedIds ein Array ist)
      if (allowedIds !== null && allowedIds.length > 0) {
        query = query.in('id', allowedIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      this.kampagnen = data || [];

    } catch (error) {
      console.error('❌ CALENDAR: Fehler beim Laden:', error);
      this.kampagnen = [];
    }
  }

  // Hilfsfunktionen für Datums-Berechnungen
  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Montag als Wochenstart
    return new Date(d.setDate(diff));
  }

  getWeekEnd(weekStart) {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return end;
  }

  getMonthStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  getMonthEnd(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  isThisWeek(date) {
    const today = new Date();
    const weekStart = this.getWeekStart(today);
    const weekEnd = this.getWeekEnd(weekStart);
    return date >= weekStart && date <= weekEnd;
  }

  isThisMonth(date) {
    const today = new Date();
    return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  }

  // Lokales Datum als YYYY-MM-DD (ohne UTC-Konvertierung)
  formatDateLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Suchbegriff setzen und View aktualisieren
  setSearchQuery(query) {
    this.searchQuery = (query || '').trim().toLowerCase();
    this.render();
    this.bindEvents();
  }

  // Kampagnen nach Suchbegriff filtern
  getFilteredKampagnen() {
    if (!this.searchQuery) return this.kampagnen;
    const q = this.searchQuery;
    return this.kampagnen.filter(k => {
      const name = (k.kampagnenname || '').toLowerCase();
      const eigenName = (k.eigener_name || '').toLowerCase();
      return name.includes(q) || eigenName.includes(q);
    });
  }

  // Kampagnen nach Deadline-Events gruppieren
  getKampagnenWithDeadlines() {
    const events = [];
    const filteredKampagnen = this.getFilteredKampagnen();

    filteredKampagnen.forEach(kampagne => {
      Object.keys(this.deadlineTypes).forEach(field => {
        if (kampagne[field]) {
          const date = new Date(kampagne[field]);
          events.push({
            kampagne,
            deadlineType: field,
            deadlineLabel: this.deadlineTypes[field].label,
            deadlineColor: this.deadlineTypes[field].color,
            date
          });
        }
      });
    });

    return events.sort((a, b) => a.date - b.date);
  }

  // Sidebar-Daten gruppieren
  getSidebarData() {
    const events = this.getKampagnenWithDeadlines();
    const today = [];
    const thisWeek = [];
    const thisMonth = [];

    events.forEach(event => {
      if (this.isToday(event.date)) {
        today.push(event);
      } else if (this.isThisWeek(event.date)) {
        thisWeek.push(event);
      } else if (this.isThisMonth(event.date)) {
        thisMonth.push(event);
      }
    });

    return { today, thisWeek, thisMonth };
  }

  // Kalender-Daten für die aktuelle Woche
  getWeekData() {
    const events = this.getKampagnenWithDeadlines();
    const weekEnd = this.getWeekEnd(this.currentWeekStart);
    
    const weekEvents = events.filter(event => 
      event.date >= this.currentWeekStart && event.date <= weekEnd
    );

    // Nach Tagen gruppieren
    const days = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(this.currentWeekStart);
      dayDate.setDate(dayDate.getDate() + i);
      
      const dayEvents = weekEvents.filter(event => 
        event.date.toDateString() === dayDate.toDateString()
      );

      days.push({
        date: dayDate,
        events: dayEvents,
        isToday: this.isToday(dayDate)
      });
    }

    return days;
  }

  getMonthData() {
    const events = this.getKampagnenWithDeadlines();
    const monthEnd = this.getMonthEnd(this.currentMonthStart);
    
    const monthEvents = events.filter(event => 
      event.date >= this.currentMonthStart && event.date <= monthEnd
    );

    // Ersten Wochentag des Monats ermitteln (0 = Sonntag, 1 = Montag, ...)
    const firstDayOfMonth = this.currentMonthStart.getDay();
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Montag = 0

    // Alle Tage des Monats + Padding-Tage
    const weeks = [];
    let currentWeek = [];
    
    // Padding-Tage vom Vormonat
    for (let i = 0; i < startOffset; i++) {
      const paddingDate = new Date(this.currentMonthStart);
      paddingDate.setDate(paddingDate.getDate() - (startOffset - i));
      currentWeek.push({
        date: paddingDate,
        events: [],
        isToday: false,
        isCurrentMonth: false
      });
    }

    // Tage des aktuellen Monats
    const daysInMonth = monthEnd.getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(this.currentMonthStart.getFullYear(), this.currentMonthStart.getMonth(), day);
      
      const dayEvents = monthEvents.filter(event => 
        event.date.toDateString() === dayDate.toDateString()
      );

      currentWeek.push({
        date: dayDate,
        events: dayEvents,
        isToday: this.isToday(dayDate),
        isCurrentMonth: true
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Padding-Tage vom Folgemonat
    if (currentWeek.length > 0) {
      let nextDay = 1;
      while (currentWeek.length < 7) {
        const paddingDate = new Date(this.currentMonthStart.getFullYear(), this.currentMonthStart.getMonth() + 1, nextDay++);
        currentWeek.push({
          date: paddingDate,
          events: [],
          isToday: false,
          isCurrentMonth: false
        });
      }
      weeks.push(currentWeek);
    }

    return weeks;
  }

  render() {
    if (!this.container) return;

    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    const sidebarData = this.getSidebarData();
    const weekData = this.getWeekData();
    const monthData = this.getMonthData();

    // Aktuelle Tab-Daten
    const currentTabData = this.currentSidebarTab === 'today' ? sidebarData.today :
                           this.currentSidebarTab === 'week' ? sidebarData.thisWeek :
                           sidebarData.thisMonth;

    const html = `
      <div class="calendar-view-container">
        <!-- Sidebar -->
        <aside class="calendar-sidebar">
          <!-- Tabs - nutzt bestehendes tab-navigation System -->
          <div class="tab-navigation calendar-sidebar-tabs">
            <button class="tab-button ${this.currentSidebarTab === 'today' ? 'active' : ''}" data-tab="today">
              Heute
              <span class="tab-count">${sidebarData.today.length}</span>
            </button>
            <button class="tab-button ${this.currentSidebarTab === 'week' ? 'active' : ''}" data-tab="week">
            Woche
              <span class="tab-count">${sidebarData.thisWeek.length}</span>
            </button>
            <button class="tab-button ${this.currentSidebarTab === 'month' ? 'active' : ''}" data-tab="month">
            Monat
              <span class="tab-count">${sidebarData.thisMonth.length}</span>
            </button>
          </div>

          <!-- Tab Content -->
          <div class="sidebar-content">
            ${this.renderSidebarContent(currentTabData)}
          </div>
        </aside>

        <!-- Kalender Hauptbereich -->
        <main class="calendar-main">
          <div class="calendar-header">
            <button class="calendar-nav-btn" id="btn-prev">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="20" height="20">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <h2 class="calendar-title">${this.currentView === 'week' ? this.formatWeekTitle() : this.formatMonthTitle()}</h2>
            <button class="calendar-nav-btn" id="btn-next">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="20" height="20">
                <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
            <button class="secondary-btn calendar-today-btn" id="btn-today">Heute</button>
            <button class="secondary-btn calendar-view-toggle-btn ${this.currentView === 'month' ? 'active' : ''}" id="btn-toggle-view">
              ${this.currentView === 'week' ? 'Monat' : 'Woche'}
            </button>
          </div>

          ${this.currentView === 'week' ? `
            <div class="calendar-week-grid">
              ${weekData.map(day => this.renderDayColumn(day)).join('')}
            </div>
          ` : `
            <div class="calendar-month-grid">
              <div class="calendar-month-header">
                <span>MO</span><span>DI</span><span>MI</span><span>DO</span><span>FR</span><span>SA</span><span>SO</span>
              </div>
              <div class="calendar-month-body">
                ${monthData.map(week => `
                  <div class="calendar-month-week">
                    ${week.map(day => this.renderMonthDay(day)).join('')}
                  </div>
                `).join('')}
              </div>
            </div>
          `}
        </main>
      </div>
    `;

    this.container.innerHTML = html;
  }

  renderSidebarContent(events) {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;

    if (events.length === 0) {
      return `<div class="sidebar-empty">Keine Deadlines</div>`;
    }

    return `
      <div class="sidebar-items">
        ${events.map(event => `
          <div class="sidebar-item" 
               data-kampagne-id="${event.kampagne.id}"
               data-deadline-type="${event.deadlineType}">
            <div class="sidebar-item-content">
              <div class="sidebar-item-name">${safe(KampagneUtils.getDisplayName(event.kampagne))}</div>
              <div class="sidebar-item-deadline">${event.deadlineLabel}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderOrgBubble(kampagne) {
    const marke = kampagne.marke;
    const unternehmen = kampagne.unternehmen;
    const logoUrl = marke?.logo_url || unternehmen?.logo_url;
    const name = marke?.markenname || unternehmen?.firmenname;

    if (!logoUrl && !name) return '';

    if (logoUrl) {
      return `<img class="sidebar-item-logo" src="${logoUrl}" alt="${name || ''}" />`;
    }

    // Fallback: Initialen
    const initials = (name || '?').substring(0, 2).toUpperCase();
    return `<div class="sidebar-item-avatar">${initials}</div>`;
  }

  renderDayColumn(day) {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    const dayNames = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA'];
    const dayName = dayNames[day.date.getDay()];
    const dayNum = String(day.date.getDate()).padStart(2, '0');
    const dateISO = this.formatDateLocal(day.date); // YYYY-MM-DD lokal (nicht UTC!)

    return `
      <div class="calendar-day ${day.isToday ? 'calendar-day--today' : ''}">
        <div class="calendar-day-header">
          <span class="calendar-day-label">${dayName} ${dayNum}</span>
        </div>
        <div class="calendar-day-events" data-date="${dateISO}">
          ${day.events.map(event => `
            <div class="calendar-event" 
                 draggable="true"
                 data-kampagne-id="${event.kampagne.id}"
                 data-deadline-type="${event.deadlineType}"
                 data-current-date="${this.formatDateLocal(event.date)}">
              <div class="calendar-event-header">
                ${this.renderOrgBubble(event.kampagne)}
                <div class="calendar-event-name">${safe(KampagneUtils.getDisplayName(event.kampagne))}</div>
              </div>
              <div class="calendar-event-type">${event.deadlineLabel}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  formatWeekTitle() {
    const weekEnd = this.getWeekEnd(this.currentWeekStart);
    const startStr = this.currentWeekStart.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
    const endStr = weekEnd.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  }

  formatMonthTitle() {
    return this.currentMonthStart.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  }

  renderMonthDay(day) {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    const dayNum = day.date.getDate();
    const dateISO = this.formatDateLocal(day.date); // YYYY-MM-DD lokal (nicht UTC!)
    
    const classes = ['calendar-month-day'];
    if (day.isToday) classes.push('calendar-month-day--today');
    if (!day.isCurrentMonth) classes.push('calendar-month-day--other');

    // Layout: max 3 links, max 2 rechts, bei >5 Events: "+X"
    const leftEvents = day.events.slice(0, 3);
    const rightEvents = day.events.slice(3, 5);
    const moreCount = day.events.length > 5 ? day.events.length - 5 : 0;
    const hasRightColumn = day.events.length > 3;

    const renderEvent = (event) => `
      <div class="calendar-month-event" 
           draggable="true"
           data-kampagne-id="${event.kampagne.id}"
           data-deadline-type="${event.deadlineType}"
           data-current-date="${this.formatDateLocal(event.date)}">
        <span class="calendar-month-event-name">${safe(KampagneUtils.getDisplayName(event.kampagne))}</span>
        <span class="calendar-month-event-type">${event.deadlineLabel}</span>
      </div>
    `;

    return `
      <div class="${classes.join(' ')}" data-date="${dateISO}">
        <div class="calendar-month-day-num">${dayNum}</div>
        <div class="calendar-month-day-events ${hasRightColumn ? 'calendar-month-day-events--split' : ''}">
          <div class="calendar-month-day-col">
            ${leftEvents.map(renderEvent).join('')}
          </div>
          ${hasRightColumn ? `
            <div class="calendar-month-day-col">
              ${rightEvents.map(renderEvent).join('')}
              ${moreCount > 0 ? `
                <div class="calendar-month-more" data-day-events='${JSON.stringify(day.events.map(e => ({ id: e.kampagne.id, name: KampagneUtils.getDisplayName(e.kampagne), type: e.deadlineType, label: e.deadlineLabel })))}'>
                  +${moreCount}
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  bindEvents() {
    if (!this.container) return;

    // Sidebar Tab-Wechsel (nutzt bestehendes tab-button System)
    this.container.querySelectorAll('.calendar-sidebar-tabs .tab-button').forEach(tab => {
      tab.addEventListener('click', () => {
        const newTab = tab.dataset.tab;
        if (newTab !== this.currentSidebarTab) {
          this.currentSidebarTab = newTab;
          this.render();
          this.bindEvents();
        }
      });
    });

    // Navigation
    this.container.querySelector('#btn-prev')?.addEventListener('click', () => {
      if (this.currentView === 'week') {
        this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
      } else {
        this.currentMonthStart.setMonth(this.currentMonthStart.getMonth() - 1);
      }
      this.render();
      this.bindEvents();
    });

    this.container.querySelector('#btn-next')?.addEventListener('click', () => {
      if (this.currentView === 'week') {
        this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
      } else {
        this.currentMonthStart.setMonth(this.currentMonthStart.getMonth() + 1);
      }
      this.render();
      this.bindEvents();
    });

    this.container.querySelector('#btn-today')?.addEventListener('click', () => {
      this.currentWeekStart = this.getWeekStart(new Date());
      this.currentMonthStart = this.getMonthStart(new Date());
      this.render();
      this.bindEvents();
    });

    // View-Toggle (Woche/Monat)
    this.container.querySelector('#btn-toggle-view')?.addEventListener('click', () => {
      this.currentView = this.currentView === 'week' ? 'month' : 'week';
      this.render();
      this.bindEvents();
    });

    // Klick auf Sidebar-Items
    this.container.querySelectorAll('.sidebar-item').forEach(item => {
      item.addEventListener('click', () => {
        const kampagneId = item.dataset.kampagneId;
        const deadlineType = item.dataset.deadlineType;
        this.openPreviewDrawer(kampagneId, deadlineType);
      });
    });

    // Klick auf Kalender-Events (Wochenansicht)
    this.container.querySelectorAll('.calendar-event').forEach(event => {
      event.addEventListener('click', () => {
        const kampagneId = event.dataset.kampagneId;
        const deadlineType = event.dataset.deadlineType;
        this.openPreviewDrawer(kampagneId, deadlineType);
      });
    });

    // Klick auf Monats-Events
    this.container.querySelectorAll('.calendar-month-event').forEach(event => {
      event.addEventListener('click', () => {
        const kampagneId = event.dataset.kampagneId;
        const deadlineType = event.dataset.deadlineType;
        this.openPreviewDrawer(kampagneId, deadlineType);
      });
    });

    // Klick auf "+X" mehr Events
    this.container.querySelectorAll('.calendar-month-more').forEach(moreBtn => {
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const eventsData = JSON.parse(moreBtn.dataset.dayEvents || '[]');
        this.openDayEventsDrawer(eventsData);
      });
    });

    // Drag & Drop Events binden
    this.bindDragDropEvents();
  }

  openDayEventsDrawer(events) {
    const safe = (str) => window.validatorSystem?.sanitizeHtml?.(str) ?? str;
    
    // Existierenden Drawer entfernen
    document.querySelector('.day-events-drawer-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'day-events-drawer-overlay';
    overlay.innerHTML = `
      <div class="day-events-drawer">
        <div class="day-events-drawer-header">
          <h3>Alle Events an diesem Tag</h3>
          <button class="day-events-drawer-close">&times;</button>
        </div>
        <div class="day-events-drawer-content">
          ${events.map(ev => `
            <div class="day-events-drawer-item" data-kampagne-id="${ev.id}" data-deadline-type="${ev.type}">
              <span class="day-events-drawer-item-name">${safe(ev.name)}</span>
              <span class="day-events-drawer-item-type">${ev.label}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Close-Handler
    overlay.querySelector('.day-events-drawer-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // Klick auf einzelne Items öffnet Preview
    overlay.querySelectorAll('.day-events-drawer-item').forEach(item => {
      item.addEventListener('click', () => {
        const kampagneId = item.dataset.kampagneId;
        const deadlineType = item.dataset.deadlineType;
        overlay.remove();
        this.openPreviewDrawer(kampagneId, deadlineType);
      });
    });
  }

  openPreviewDrawer(kampagneId, deadlineType) {
    const kampagne = this.kampagnen.find(k => k.id === kampagneId);
    if (kampagne && this.previewDrawer) {
      this.previewDrawer.open(kampagne, deadlineType);
    }
  }

  // ==================== DRAG & DROP ====================

  onDragStart(e) {
    const eventEl = e.target.closest('.calendar-event, .calendar-month-event');
    if (!eventEl) return;

    console.log('🎯 CALENDAR DRAG START:', eventEl.dataset.kampagneId, eventEl.dataset.deadlineType);

    this.draggedEvent = {
      kampagneId: eventEl.dataset.kampagneId,
      deadlineType: eventEl.dataset.deadlineType,
      currentDate: eventEl.dataset.currentDate
    };

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.draggedEvent.kampagneId);

    eventEl.classList.add('dragging');
  }

  onDragEnd(e) {
    const eventEl = e.target.closest('.calendar-event, .calendar-month-event');
    if (eventEl) {
      eventEl.classList.remove('dragging');
    }
    this.draggedEvent = null;

    // Alle drag-over Klassen entfernen
    this.container?.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  }

  onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Drop-Zone finden (Woche: calendar-day-events, Monat: calendar-month-day)
    const dropZone = e.target.closest('.calendar-day-events, .calendar-month-day');
    if (dropZone && dropZone.dataset.date) {
      dropZone.classList.add('drag-over');
    }
  }

  onDragLeave(e) {
    const dropZone = e.target.closest('.calendar-day-events, .calendar-month-day');
    if (dropZone) {
      // Nur entfernen wenn wir wirklich die Zone verlassen
      const relatedTarget = e.relatedTarget;
      if (!dropZone.contains(relatedTarget)) {
        dropZone.classList.remove('drag-over');
      }
    }
  }

  async onDrop(e) {
    e.preventDefault();

    // Drop-Zone finden
    const dropZone = e.target.closest('.calendar-day-events, .calendar-month-day');
    if (!dropZone || !dropZone.dataset.date) return;

    dropZone.classList.remove('drag-over');

    if (!this.draggedEvent) return;

    const newDate = dropZone.dataset.date; // YYYY-MM-DD
    const { kampagneId, deadlineType, currentDate } = this.draggedEvent;

    // Datum gleich? Nichts tun
    if (newDate === currentDate) {
      console.log('📅 CALENDAR: Gleiches Datum, kein Update nötig');
      this.draggedEvent = null;
      return;
    }

    console.log(`📅 CALENDAR: Verschiebe ${deadlineType} von ${currentDate} nach ${newDate}`);

    // Deadline aktualisieren
    await this.updateDeadline(kampagneId, deadlineType, newDate);

    this.draggedEvent = null;
  }

  async updateDeadline(kampagneId, deadlineType, newDate) {
    try {
      console.log(`🔄 CALENDAR: Update ${deadlineType} für Kampagne ${kampagneId} auf ${newDate}`);

      if (!window.supabase) {
        console.warn('⚠️ Supabase nicht verfügbar');
        window.notificationSystem?.error?.('Datenbank nicht verfügbar.');
        return;
      }

      // Nur das spezifische Deadline-Feld aktualisieren
      const updateData = {
        [deadlineType]: newDate,
        updated_at: new Date().toISOString()
      };

      const { error } = await window.supabase
        .from('kampagne')
        .update(updateData)
        .eq('id', kampagneId);

      if (error) throw error;

      console.log('✅ CALENDAR: Deadline erfolgreich aktualisiert');

      // Erfolgs-Notification
      const deadlineLabel = this.deadlineTypes[deadlineType]?.label || deadlineType;
      window.notificationSystem?.success?.(`${deadlineLabel} auf ${new Date(newDate).toLocaleDateString('de-DE')} verschoben`);

      // UI aktualisieren
      await this.refresh();

      // Event für andere Komponenten dispatchen
      window.dispatchEvent(new CustomEvent('kampagneUpdated', {
        detail: { kampagneId, field: deadlineType, newValue: newDate }
      }));

    } catch (error) {
      console.error('❌ CALENDAR: Fehler beim Aktualisieren der Deadline:', error);
      window.notificationSystem?.error?.('Fehler beim Verschieben der Deadline.');
    }
  }

  bindDragDropEvents() {
    if (!this.container) return;

    // Wochenansicht: Events in .calendar-event
    this.container.querySelectorAll('.calendar-event').forEach(eventEl => {
      if (eventEl.dataset.dragBound === 'true') return;

      eventEl.addEventListener('dragstart', this.boundDragHandlers.dragStart);
      eventEl.addEventListener('dragend', this.boundDragHandlers.dragEnd);
      eventEl.dataset.dragBound = 'true';
    });

    // Monatsansicht: Events in .calendar-month-event
    this.container.querySelectorAll('.calendar-month-event').forEach(eventEl => {
      if (eventEl.dataset.dragBound === 'true') return;

      eventEl.addEventListener('dragstart', this.boundDragHandlers.dragStart);
      eventEl.addEventListener('dragend', this.boundDragHandlers.dragEnd);
      eventEl.dataset.dragBound = 'true';
    });

    // Drop-Zonen: Wochenansicht (.calendar-day-events)
    this.container.querySelectorAll('.calendar-day-events').forEach(zone => {
      if (zone.dataset.dropBound === 'true') return;

      zone.addEventListener('dragover', this.boundDragHandlers.dragOver);
      zone.addEventListener('drop', this.boundDragHandlers.drop);
      zone.addEventListener('dragleave', this.boundDragHandlers.dragLeave);
      zone.dataset.dropBound = 'true';
    });

    // Drop-Zonen: Monatsansicht (.calendar-month-day)
    this.container.querySelectorAll('.calendar-month-day').forEach(zone => {
      if (zone.dataset.dropBound === 'true') return;

      zone.addEventListener('dragover', this.boundDragHandlers.dragOver);
      zone.addEventListener('drop', this.boundDragHandlers.drop);
      zone.addEventListener('dragleave', this.boundDragHandlers.dragLeave);
      zone.dataset.dropBound = 'true';
    });
  }

  async refresh() {
    await this.loadKampagnen();
    this.render();
    this.bindEvents();
  }

  destroy() {
    this.container = null;
    this.kampagnen = [];
    if (this.previewDrawer) {
      this.previewDrawer.close();
      this.previewDrawer = null;
    }
  }
}

