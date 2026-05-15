// MitarbeiterDetailRendererCore.js
// Seiten-Render, Tabs, Lazy panes, TabContent-Dispatch

import { renderTabButton } from '../../core/TabUtils.js';
import { PhoneDisplay } from '../../core/components/PhoneDisplay.js';
import { renderRechteTab } from './MitarbeiterDetailRendererRechte.js';
import { renderKampagnenTable, renderKooperationenTable, renderBriefingsTable, renderAuftragsdetailsTable, renderUnternehmenTable, renderBudget } from './MitarbeiterDetailRendererTables.js';

export function getDisplayName(detail) {
  if (detail.user?.vorname && detail.user?.nachname) {
    return `${detail.user.vorname} ${detail.user.nachname}`;
  }
  return detail.user?.name || 'Unbekannt';
}

export function getFirmenhandyDisplayHtml(detail) {
  const nummer = detail.user?.telefonnummer_firmenhandy;
  if (!nummer) return '';
  const land = detail.user?.telefonnummer_firmenhandy_land;
  const cleanNumber = String(nummer).replace(/[^\d+\s()/.-]/g, '');
  return PhoneDisplay.renderClickable(land?.iso_code, land?.vorwahl, cleanNumber);
}

export function getTabsConfig(detail) {
  return [
    { tab: 'unternehmen', label: 'Unternehmen', count: detail.zugeordnet.unternehmen.length, isActive: detail.activeMainTab === 'unternehmen' },
    { tab: 'auftragsdetails', label: 'Auftragsdetails', count: detail.assignments.auftragsdetails.length, isActive: detail.activeMainTab === 'auftragsdetails' },
    { tab: 'kampagnen', label: 'Kampagnen', count: detail.assignments.kampagnen.length, isActive: detail.activeMainTab === 'kampagnen' },
    { tab: 'briefings', label: 'Briefings', count: detail.assignments.briefings.length, isActive: detail.activeMainTab === 'briefings' },
    { tab: 'kooperationen', label: 'Kooperationen', count: detail.assignments.kooperationen.length, isActive: detail.activeMainTab === 'koops' },
    { tab: 'cashflow', label: 'Budget', isActive: detail.activeMainTab === 'budget' },
    { tab: 'rechte', label: 'Rechte', isActive: detail.activeMainTab === 'rechte' }
  ];
}

export function renderTabNavigation(detail) {
  const tabs = getTabsConfig(detail);
  const tabsHtml = tabs.map(t => renderTabButton({ ...t, showIcon: true, tab: t.tab === 'kooperationen' ? 'koops' : (t.tab === 'cashflow' ? 'budget' : t.tab) })).join('');
  return `<div class="tabs-header-container" style="--tab-count: ${tabs.length}"><div class="tabs-left">${tabsHtml}</div></div>`;
}

export function renderTabContent(detail, tab) {
  switch (tab) {
    case 'rechte':
      return renderRechteTab(detail);
    case 'unternehmen':
      return `
        <div class="detail-section">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div></div>
            <button class="primary-btn" id="btn-add-unternehmen">+ Unternehmen zuordnen</button>
          </div>
          ${renderUnternehmenTable(detail)}
        </div>
      `;
    case 'kampagnen':
      return `<div class="detail-section">${renderKampagnenTable(detail)}</div>`;
    case 'koops':
      return `<div class="detail-section">${renderKooperationenTable(detail)}</div>`;
    case 'budget':
      return `<div class="detail-section">${renderBudget(detail)}</div>`;
    case 'briefings':
      return `<div class="detail-section">${renderBriefingsTable(detail)}</div>`;
    case 'auftragsdetails':
      return `<div class="detail-section">${renderAuftragsdetailsTable(detail)}</div>`;
    default:
      return '';
  }
}

export function renderMainContent(detail) {
  const tabs = ['rechte', 'unternehmen', 'kampagnen', 'koops', 'budget', 'briefings', 'auftragsdetails'];
  detail._renderedTabs = new Set();
  if (detail.activeMainTab && tabs.includes(detail.activeMainTab)) {
    detail._renderedTabs.add(detail.activeMainTab);
  }

  const panes = tabs.map(t => {
    const isActive = detail.activeMainTab === t;
    const content = isActive ? renderTabContent(detail, t) : '';
    return `<div class="tab-pane ${isActive ? 'active' : ''}" id="tab-${t}">${content}</div>`;
  }).join('');

  return `<div class="tab-content">${panes}</div>`;
}

export function renderMitarbeiterDetailPage(detail) {
  const personConfig = {
    name: getDisplayName(detail),
    avatarUrl: detail.user?.profile_image_url,
    avatarOnly: false
  };

  const quickActions = [];

  const sidebarInfo = detail.renderInfoItems([
    { icon: 'shield', label: 'Rolle', value: detail.user?.rolle || '-', badge: true, badgeType: detail.user?.rolle === 'admin' ? 'primary' : 'secondary' },
    { icon: 'tag', label: 'Klasse', value: detail.user?.mitarbeiter_klasse_name || 'Nicht zugewiesen' },
    { icon: 'phone', label: 'Firmenhandy', value: '-', rawHtml: getFirmenhandyDisplayHtml(detail) },
    { icon: 'check', label: 'Freigeschaltet', value: detail.user?.freigeschaltet ? 'Ja' : 'Nein', badge: true, badgeType: detail.user?.freigeschaltet ? 'success' : 'warning' },
    { icon: 'clock', label: 'Erstellt', value: detail.formatDate(detail.user?.created_at) }
  ]);

  const tabNavigation = renderTabNavigation(detail);
  const mainContent = renderMainContent(detail);

  const html = detail.renderTwoColumnLayout({
    person: personConfig,
    stats: [],
    quickActions,
    sidebarInfo,
    tabNavigation,
    mainContent
  });

  window.setContentSafely(window.content, html);
}
