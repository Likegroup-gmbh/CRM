// sourcingTabs.js
// Reiter der Casting-Tabelle am unteren Tabellenrand (Monatsblatt-Optik)

// "Alle" zeigt die aktiven Eintraege; "Abgelehnt" sammelt Eintraege mit
// Kundenfeedback "Abgelehnt" oder Prozessstatus "Abgesagt".
export const SOURCING_TABS = [
  { key: 'alle', label: 'Alle' },
  { key: 'abgelehnt', label: 'Abgelehnt' }
];

/** Abgelehnt (Kundenfeedback) oder Abgesagt (Prozessstatus). */
export function istAbgelehntOderAbgesagt(item) {
  return Boolean(item?.abgelehnt || item?.absage);
}

/** Ordnet einen Eintrag seinem Reiter zu: aktiv -> "alle", abgelehnt/abgesagt -> "abgelehnt". */
export function getSourcingTabForItem(item) {
  return istAbgelehntOderAbgesagt(item) ? 'abgelehnt' : 'alle';
}

export function renderTabNavigation(ctx) {
  const activeTab = ctx.activeTab || 'alle';
  const counts = ctx.tabCounts || {};
  return `
    <div class="tab-navigation tab-navigation--liste monatsblatt-tabs sourcing-tab-navigation">
      ${SOURCING_TABS.map(tab => `
        <button type="button" class="tab-button${tab.key === activeTab ? ' active' : ''}" data-sourcing-tab="${tab.key}">
          ${tab.label}<span class="tab-count" data-sourcing-tab-count="${tab.key}">${counts[tab.key] ?? 0}</span>
        </button>
      `).join('')}
      ${ctx.isKunde ? '' : `
        <button type="button" class="tab-button${activeTab === 'bewerbung' ? ' active' : ''}" data-sourcing-tab="bewerbung">
          Bewerbung<span class="tab-count" data-sourcing-tab-count="bewerbung">${counts.bewerbung ?? 0}</span>
        </button>
      `}
    </div>
  `;
}
