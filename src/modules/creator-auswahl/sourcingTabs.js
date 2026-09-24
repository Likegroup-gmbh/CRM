// sourcingTabs.js
// Status-Reiter der Casting-Tabelle

import { getSourcingStatus } from './sourcingStatusOptions.js';

// "Alle" ist der Einstiegspunkt; die uebrigen Reiter spiegeln den internen
// Prozessstatus. Das Kundenfeedback (Prio/Abgelehnt) hat keinen eigenen
// Reiter - es steht in der eigenen Spalte und im Toolbar-Filter.
export const SOURCING_TABS = [
  { key: 'alle', label: 'Alle' },
  { key: 'offen', label: 'Offen' },
  { key: 'angefragt', label: 'Angefragt' },
  { key: 'on_hold', label: 'On Hold' },
  { key: 'in_verhandlung', label: 'In Verhandlung' },
  { key: 'absage', label: 'Abgesagt' },
  { key: 'zusage', label: 'Zusage' },
  { key: 'gebucht', label: 'Gebucht' }
];

/** Der Reiter eines Items ist sein Prozess-Status; Feedback-Flags spielen keine Rolle. */
export function getSourcingTabForItem(item) {
  return getSourcingStatus(item);
}

export function renderTabNavigation(ctx) {
  const activeTab = ctx.activeTab || 'alle';
  const counts = ctx.tabCounts || {};
  return `
    <div class="tab-navigation sourcing-tab-navigation">
      ${SOURCING_TABS.map(tab => `
        <button type="button" class="tab-button${tab.key === activeTab ? ' active' : ''}" data-sourcing-tab="${tab.key}">
          ${tab.label} <span class="tab-count" data-sourcing-tab-count="${tab.key}">${counts[tab.key] ?? 0}</span>
        </button>
      `).join('')}
    </div>
  `;
}
