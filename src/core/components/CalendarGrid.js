// CalendarGrid.js
// Kalendergitter: Kopf (Zurück, Titel, Weiter, Heute, Woche/Monat), Wochen- und Monatsansicht und der
// Drawer für "+X". Die Daten kommen vom Aufrufer (`getEvents`), die Optik aus domain-calendar.css.
// Genutzt vom Kampagnen-Kalender und vom Kalender im Videos-Tab. Drag & Drop: calendarGridDnd.js.

import { icon } from '../icons/IconSystem.js';
import { escapeHtml as esc } from '../format.js';
import {
  WEEKDAY_LABELS,
  addDays,
  addMonths,
  buildMonth,
  buildWeek,
  dayLabel,
  formatDateLocal,
  formatMonthTitle,
  formatWeekTitle,
  isSameMonth,
  parseDateOnly
} from '../calendarDates.js';
import { installCalendarDnd } from './calendarGridDnd.js';

// Monatsansicht: drei Karten links, zwei rechts, ab der sechsten "+X"
const MONTH_LEFT = 3;
const MONTH_SHOWN = 5;

/**
 * Kalendergitter in `container` (wird selbst zu `.calendar-main`).
 *
 * Event: `{ id, date, title, sub?, tooltip?, leadHtml?, draggable? }`. `leadHtml` ist fertiges Markup
 * (z. B. Logo) vor dem Titel in der Wochenansicht, alles andere wird escaped.
 * `headerExtraEl` gehört dem Aufrufer und wird bei jedem render() in den Kopf umgehängt, nicht neu
 * gebaut: Zustand darin (Segment-Indikator, Fokus) bleibt erhalten.
 *
 * @param {HTMLElement} container
 * @param {{
 *   view?: 'week'|'month', anchor?: Date|string,
 *   getEvents: () => object[],
 *   headerExtraEl?: HTMLElement,
 *   onMove?: (id: string, isoDate: string) => (void|Promise<void>),
 *   onSelect?: (id: string) => void,
 *   onStateChange?: (state: { view: string, anchor: Date }) => void,
 *   drawerTitle?: string
 * }} opts
 */
export class CalendarGrid {
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = { drawerTitle: 'Alle Events an diesem Tag', ...opts };
    this.view = opts.view === 'week' ? 'week' : 'month';
    this.anchor = parseDateOnly(opts.anchor) || parseDateOnly(new Date());
    this._eventById = new Map();
    this._dayEvents = new Map();
    this._drawer = null;
    this._cleanups = [];

    container.classList.add('calendar-main');
    const click = (e) => this._onClick(e);
    const key = (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('[data-cal-more]')) {
        e.preventDefault();
        this._openDayDrawer(e.target.closest('[data-cal-more]').dataset.calMore);
      }
    };
    container.addEventListener('click', click);
    container.addEventListener('keydown', key);
    this._cleanups.push(() => {
      container.removeEventListener('click', click);
      container.removeEventListener('keydown', key);
    });
    this._bindDnd();
  }

  render() {
    if (!this.container) return;
    const events = (this.opts.getEvents?.() || []).map((ev) => {
      const day = parseDateOnly(ev.date);
      return { ...ev, iso: day ? formatDateLocal(day) : null };
    });
    this._eventById = new Map(events.map(ev => [ev.id, ev]));
    this._dayEvents = new Map();
    const today = new Date();
    const body = this.view === 'week'
      ? this._weekHtml(buildWeek(this.anchor, events, today))
      : this._monthHtml(buildMonth(this.anchor, events, today));
    const extra = this.opts.headerExtraEl;
    const focused = extra?.contains(document.activeElement) ? document.activeElement : null;
    this.container.innerHTML = `${this._headerHtml()}${body}`;
    if (extra) this.container.querySelector('[data-cal-extra]')?.appendChild(extra);
    focused?.focus({ preventScroll: true });
  }

  setView(view) {
    const next = view === 'week' ? 'week' : 'month';
    if (next === this.view) return;
    // Von Monat zu Woche: im laufenden Monat die aktuelle Woche, sonst die Woche des Ankers
    const today = parseDateOnly(new Date());
    if (next === 'week' && isSameMonth(today, this.anchor)) this.anchor = today;
    this.view = next;
    this._changed();
  }

  setAnchor(date) {
    const d = parseDateOnly(date);
    if (!d) return;
    this.anchor = d;
    this._changed();
  }

  destroy() {
    this._closeDrawer();
    this._cleanups.forEach(fn => fn());
    this._cleanups = [];
    if (this.container) this.container.innerHTML = '';
    this.container = null;
  }

  /* ---- Markup ---- */

  _headerHtml() {
    const title = this.view === 'week' ? formatWeekTitle(this.anchor) : formatMonthTitle(this.anchor);
    return `
      <div class="calendar-header">
        <button type="button" class="calendar-nav-btn" data-cal-nav="prev" aria-label="Zurück">${icon('chevron-left')}</button>
        <h2 class="calendar-title">${esc(title)}</h2>
        <button type="button" class="calendar-nav-btn" data-cal-nav="next" aria-label="Weiter">${icon('chevron-right')}</button>
        ${this.opts.headerExtraEl ? '<div class="calendar-header-extra" data-cal-extra></div>' : ''}
        <button type="button" class="mdc-btn mdc-btn--secondary calendar-today-btn" data-cal-nav="today">Heute</button>
        <button type="button" class="mdc-btn mdc-btn--secondary calendar-view-toggle-btn${this.view === 'month' ? ' active' : ''}" data-cal-nav="toggle">${this.view === 'week' ? 'Monat' : 'Woche'}</button>
      </div>`;
  }

  _eventAttrs(ev) {
    const draggable = ev.draggable && this.opts.onMove;
    const attrs = [`data-cal-event="${esc(ev.id)}"`];
    if (draggable) attrs.push('draggable="true"');
    if (ev.tooltip) attrs.push(`title="${esc(ev.tooltip)}"`);
    return attrs.join(' ');
  }

  /** Karte ohne Klick und ohne Ziehen: kein Hand-Cursor. */
  _staticClass(ev) {
    return !this.opts.onSelect && !(ev.draggable && this.opts.onMove) ? ' is-static' : '';
  }

  _weekHtml(days) {
    return `
      <div class="calendar-week-grid">
        ${days.map(day => `
          <div class="calendar-day${day.isToday ? ' calendar-day--today' : ''}">
            <div class="calendar-day-header">
              <span class="calendar-day-label">${dayLabel(day.date)}</span>
            </div>
            <div class="calendar-day-events" data-cal-drop="${day.iso}">
              ${day.events.map(ev => `
                <div class="calendar-event${this._staticClass(ev)}" ${this._eventAttrs(ev)}>
                  <div class="calendar-event-header">
                    ${ev.leadHtml || ''}
                    <div class="calendar-event-name">${esc(ev.title)}</div>
                  </div>
                  ${ev.sub ? `<div class="calendar-event-type">${esc(ev.sub)}</div>` : ''}
                </div>`).join('')}
            </div>
          </div>`).join('')}
      </div>`;
  }

  _monthHtml(weeks) {
    return `
      <div class="calendar-month-grid">
        <div class="calendar-month-header">${WEEKDAY_LABELS.map(l => `<span>${l}</span>`).join('')}</div>
        <div class="calendar-month-body">
          ${weeks.map(week => `<div class="calendar-month-week">${week.map(day => this._monthDayHtml(day)).join('')}</div>`).join('')}
        </div>
      </div>`;
  }

  _monthDayHtml(day) {
    const classes = ['calendar-month-day'];
    if (day.isToday) classes.push('calendar-month-day--today');
    if (!day.isCurrentMonth) classes.push('calendar-month-day--other');

    const left = day.events.slice(0, MONTH_LEFT);
    const right = day.events.slice(MONTH_LEFT, MONTH_SHOWN);
    const more = Math.max(0, day.events.length - MONTH_SHOWN);
    const split = day.events.length > MONTH_LEFT;
    if (more) this._dayEvents.set(day.iso, day.events);

    const card = (ev) => `
      <div class="calendar-month-event${this._staticClass(ev)}" ${this._eventAttrs(ev)}>
        <span class="calendar-month-event-name">${esc(ev.title)}</span>
        ${ev.sub ? `<span class="calendar-month-event-type">${esc(ev.sub)}</span>` : ''}
      </div>`;

    return `
      <div class="${classes.join(' ')}" data-cal-drop="${day.iso}">
        <div class="calendar-month-day-num">${day.date.getDate()}</div>
        <div class="calendar-month-day-events${split ? ' calendar-month-day-events--split' : ''}">
          <div class="calendar-month-day-col">${left.map(card).join('')}</div>
          ${split ? `
            <div class="calendar-month-day-col">
              ${right.map(card).join('')}
              ${more ? `<div class="calendar-month-more" role="button" tabindex="0" data-cal-more="${day.iso}">+${more}</div>` : ''}
            </div>` : ''}
        </div>
      </div>`;
  }

  /* ---- Bedienung ---- */

  _onClick(e) {
    const nav = e.target.closest('[data-cal-nav]');
    if (nav) {
      this._navigate(nav.dataset.calNav);
      return;
    }
    const more = e.target.closest('[data-cal-more]');
    if (more) {
      e.stopPropagation();
      this._openDayDrawer(more.dataset.calMore);
      return;
    }
    const ev = e.target.closest('[data-cal-event]');
    if (ev && this.opts.onSelect) this.opts.onSelect(ev.dataset.calEvent);
  }

  _navigate(action) {
    if (action === 'toggle') {
      this.setView(this.view === 'week' ? 'month' : 'week');
      return;
    }
    if (action === 'today') {
      this.anchor = parseDateOnly(new Date());
    } else {
      const step = action === 'prev' ? -1 : 1;
      this.anchor = this.view === 'week' ? addDays(this.anchor, 7 * step) : addMonths(this.anchor, step);
    }
    this._changed();
  }

  _changed() {
    this.render();
    this.opts.onStateChange?.({ view: this.view, anchor: this.anchor });
  }

  _openDayDrawer(iso) {
    const events = this._dayEvents.get(iso) || [];
    this._closeDrawer();
    document.querySelector('.day-events-drawer-overlay')?.remove();

    const title = esc(this.opts.drawerTitle);
    const overlay = document.createElement('div');
    overlay.className = 'day-events-drawer-overlay';
    overlay.innerHTML = `
      <div class="day-events-drawer" role="dialog" aria-label="${title}">
        <div class="day-events-drawer-header">
          <h3>${title}</h3>
          <button type="button" class="day-events-drawer-close" aria-label="Schließen">&times;</button>
        </div>
        <div class="day-events-drawer-content">
          ${events.map(ev => `
            <div class="day-events-drawer-item" data-cal-event="${esc(ev.id)}"${ev.tooltip ? ` title="${esc(ev.tooltip)}"` : ''}>
              <span class="day-events-drawer-item-name">${esc(ev.title)}</span>
              <span class="day-events-drawer-item-type">${esc(ev.sub || '')}</span>
            </div>`).join('')}
        </div>
      </div>`;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('.day-events-drawer-close')) {
        this._closeDrawer();
        return;
      }
      const item = e.target.closest('[data-cal-event]');
      if (!item || !this.opts.onSelect) return;
      const id = item.dataset.calEvent;
      this._closeDrawer();
      this.opts.onSelect(id);
    });
    const onKey = (e) => { if (e.key === 'Escape') this._closeDrawer(); };
    document.addEventListener('keydown', onKey);
    this._drawerKey = onKey;
    document.body.appendChild(overlay);
    this._drawer = overlay;
  }

  _closeDrawer() {
    if (this._drawerKey) document.removeEventListener('keydown', this._drawerKey);
    this._drawerKey = null;
    this._drawer?.remove();
    this._drawer = null;
  }
}

installCalendarDnd(CalendarGrid.prototype);
