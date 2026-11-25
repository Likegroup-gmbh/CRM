// kampagneCalendarSidebar.js
// Seitenleiste des Kampagnen-Kalenders: Deadlines von heute, dieser Woche und diesem Monat.
// Jede Deadline steht in genau einer Gruppe (heute vor Woche vor Monat).

import { renderEmptyState } from '../../core/components/EmptyState.js';
import { escapeHtml as esc } from '../../core/format.js';
import { formatDateLocal, isInPeriod, parseDateOnly } from '../../core/calendarDates.js';

const SIDEBAR_TABS = [
  { id: 'today', label: 'Heute' },
  { id: 'week', label: 'Woche' },
  { id: 'month', label: 'Monat' }
];

/** @returns {{ today: object[], week: object[], month: object[] }} */
export function sidebarGroups(events, now = new Date()) {
  const today = parseDateOnly(now);
  const todayIso = formatDateLocal(today);
  const groups = { today: [], week: [], month: [] };
  (events || []).forEach((ev) => {
    const d = parseDateOnly(ev.date);
    if (!d) return;
    if (formatDateLocal(d) === todayIso) groups.today.push(ev);
    else if (isInPeriod(d, today, 'week')) groups.week.push(ev);
    else if (isInPeriod(d, today, 'month')) groups.month.push(ev);
  });
  return groups;
}

function itemsHtml(events) {
  if (!events.length) {
    return renderEmptyState({ icon: 'calendar', title: 'Keine Deadlines', size: 'small' });
  }
  return `
    <div class="sidebar-items">
      ${events.map(ev => `
        <div class="sidebar-item" data-kampagne-id="${esc(ev.kampagne.id)}" data-deadline-type="${esc(ev.deadlineType)}">
          <div class="sidebar-item-content">
            <div class="sidebar-item-name">${esc(ev.title)}</div>
            <div class="sidebar-item-deadline">${esc(ev.sub)}</div>
          </div>
        </div>`).join('')}
    </div>`;
}

/** Tabs (nutzt das bestehende tab-navigation-System) und die Einträge des gewählten Tabs. */
export function sidebarHtml(groups, tab) {
  const tabs = SIDEBAR_TABS.map(t => `
    <button class="tab-button${t.id === tab ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('');
  return `
    <div class="tab-navigation calendar-sidebar-tabs">${tabs}</div>
    <div class="sidebar-content">${itemsHtml(groups[tab] || [])}</div>`;
}
