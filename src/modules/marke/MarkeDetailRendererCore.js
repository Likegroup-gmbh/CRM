// MarkeDetailRendererCore.js
// Seiten-Render, Tabs, renderMainContent

import { renderTabButton } from '../../core/TabUtils.js';
import { getBranchenDisplay } from './MarkeDetailRendererHelpers.js';
import { renderKampagnen, renderAuftraege, renderAnsprechpartner, renderBriefings, renderKooperationen, renderRechnungen, renderStrategien } from './MarkeDetailRendererTables.js';
import { renderKickOff } from './MarkeDetailRendererKickOff.js';

export function getTabsConfig(detail) {
  return [
    {
      tab: 'kickoff',
      label: 'Strategiebriefing',
      count: Object.values(detail.kickoffsByType).filter(Boolean).length,
      isActive: detail.activeMainTab === 'kickoff'
    },
    { tab: 'ansprechpartner', label: 'Ansprechpartner', count: detail.ansprechpartner.length, isActive: detail.activeMainTab === 'ansprechpartner' },
    { tab: 'auftraege', label: 'Aufträge', count: detail.auftraege.length, isActive: detail.activeMainTab === 'auftraege' },
    { tab: 'kampagnen', label: 'Kampagnen', count: detail.kampagnen.length, isActive: detail.activeMainTab === 'kampagnen' },
    { tab: 'briefings', label: 'Briefings', count: detail.briefings.length, isActive: detail.activeMainTab === 'briefings' },
    { tab: 'strategien', label: 'Strategien', count: detail.strategien.length, isActive: detail.activeMainTab === 'strategien' },
    { tab: 'kooperationen', label: 'Kooperationen', count: detail.kooperationen.length, isActive: detail.activeMainTab === 'kooperationen' },
    { tab: 'rechnungen', label: 'Rechnungen', count: detail.rechnungen.length, isActive: detail.activeMainTab === 'rechnungen' }
  ];
}

export function renderTabNavigation(detail) {
  const tabs = getTabsConfig(detail);
  return `<div class="tabs-header-container" style="--tab-count: ${tabs.length}"><div class="tabs-left">${tabs.map(t => renderTabButton({ ...t, showIcon: true })).join('')}</div></div>`;
}

export function renderMainContent(detail) {
  return `
    <div class="tab-content">
      <div class="tab-pane ${detail.activeMainTab === 'kickoff' ? 'active' : ''}" id="tab-kickoff">
        ${renderKickOff(detail)}
      </div>

      <div class="tab-pane ${detail.activeMainTab === 'ansprechpartner' ? 'active' : ''}" id="tab-ansprechpartner">
        ${renderAnsprechpartner(detail)}
      </div>

      <div class="tab-pane ${detail.activeMainTab === 'auftraege' ? 'active' : ''}" id="tab-auftraege">
        ${renderAuftraege(detail)}
      </div>

      <div class="tab-pane ${detail.activeMainTab === 'briefings' ? 'active' : ''}" id="tab-briefings">
        ${renderBriefings(detail)}
      </div>

      <div class="tab-pane ${detail.activeMainTab === 'kampagnen' ? 'active' : ''}" id="tab-kampagnen">
        ${renderKampagnen(detail)}
      </div>

      <div class="tab-pane ${detail.activeMainTab === 'kooperationen' ? 'active' : ''}" id="tab-kooperationen">
        ${renderKooperationen(detail)}
      </div>

      <div class="tab-pane ${detail.activeMainTab === 'strategien' ? 'active' : ''}" id="tab-strategien">
        ${renderStrategien(detail)}
      </div>

      <div class="tab-pane ${detail.activeMainTab === 'rechnungen' ? 'active' : ''}" id="tab-rechnungen">
        ${renderRechnungen(detail)}
      </div>
    </div>
  `;
}

export function renderMarkeDetailPage(detail) {
  window.setHeadline(`${detail.marke?.markenname || 'Marke'} - Details`);

  const personConfig = {
    name: detail.marke?.markenname || 'Unbekannt',
    email: '',
    subtitle: detail.marke?.unternehmen?.firmenname || 'Marke',
    avatarUrl: detail.marke?.logo_url,
    avatarOnly: false
  };

  const quickActions = [];

  const sidebarInfo = detail.renderInfoItems([
    { icon: 'building', label: 'Unternehmen', value: detail.marke?.unternehmen?.firmenname || '-' },
    { icon: 'tag', label: 'Branchen', value: getBranchenDisplay(detail) },
    { icon: 'link', label: 'Webseite', rawHtml: detail.marke?.webseite ? `<a href="${detail.marke.webseite}" target="_blank" rel="noopener">${detail.sanitize(detail.marke.webseite)}</a>` : '-' },
    { icon: 'clock', label: 'Erstellt', value: detail.formatDate(detail.marke?.created_at) },
    { icon: 'clock', label: 'Aktualisiert', value: detail.formatDate(detail.marke?.updated_at) }
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
