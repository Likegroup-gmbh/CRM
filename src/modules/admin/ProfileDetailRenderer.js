// ProfileDetailRenderer.js
// Layout der Profilseite: Sidebar-Infos, Tab-Navigation und Tab-Container

import { renderSecondaryNav } from '../../core/TabUtils.js';
import { formatDateOnly, getFirmenhandyDisplayHtml } from './ProfileDetailFormat.js';
import {
  renderUnternehmenTab,
  renderMarkenTab,
  renderAuftraegeTab,
  renderKampagnenTab,
  renderKooperationenTab,
  renderVideosTab
} from './ProfileDetailTabs.js';

export function renderProfilePage(detail) {
  const container = document.getElementById('dashboard-content');
  if (!container) {
    console.error('❌ dashboard-content Container nicht gefunden');
    return;
  }

  const mainWrapper = container.closest('.main-wrapper');
  if (mainWrapper) {
    mainWrapper.classList.remove('main-wrapper');
    mainWrapper.classList.add('profile-page-container');
  }

  const isKunde = detail.user?.rolle === 'kunde';

  const person = {
    name: detail.user?.name || 'Unbekannt',
    email: detail.user?.email || '',
    subtitle: detail.user?.mitarbeiter_klasse?.name || detail.user?.rolle || 'Benutzer',
    avatarUrl: detail.user?.profile_image_url,
    avatarOnly: false,
    lastActivity: detail.user?.updated_at
  };

  container.innerHTML = detail.renderTwoColumnLayout({
    person,
    stats: [],
    quickActions: [],
    sidebarInfo: renderProfileInfo(detail),
    mainContent: renderProfileMainContent(detail, isKunde),
    tabNavigation: renderProfileTabNavigation(detail, isKunde)
  });
}

export function renderProfileInfo(detail) {
  const { user } = detail;
  const rolle = user?.rolle || 'Nicht definiert';
  const mitarbeiterKlasse = user?.mitarbeiter_klasse?.name || 'Nicht zugewiesen';
  const sprachenText = detail.sprachen.length > 0
    ? detail.sprachen.map(s => s.name).join(', ')
    : 'Keine Sprachen';
  const firmenhandyHtml = getFirmenhandyDisplayHtml(user);

  const items = [
    { icon: 'shield', label: 'Rolle', value: rolle, badge: true, badgeType: rolle === 'admin' ? 'primary' : 'secondary' }
  ];

  if (mitarbeiterKlasse !== 'Nicht zugewiesen') {
    items.push({ icon: 'tag', label: 'Klasse', value: mitarbeiterKlasse });
  }

  if (firmenhandyHtml) {
    items.push({ icon: 'phone-mobile', label: 'Firmenhandy', value: '-', rawHtml: firmenhandyHtml });
  }

  const geburtsdatumLabel = formatDateOnly(user?.geburtsdatum);
  items.push({
    icon: 'calendar',
    label: 'Geburtsdatum',
    value: geburtsdatumLabel,
    rawHtml: geburtsdatumLabel === '-' ? '-' : undefined
  });

  items.push({ icon: 'language', label: 'Sprachen', value: sprachenText });
  items.push({ icon: 'clock', label: 'Mitglied seit', value: detail.formatDate(user?.created_at) });

  return detail.renderInfoItems(items);
}

export function renderProfileTabNavigation(detail, isKunde) {
  const active = detail.activeMainTab;
  const tabs = [
    { tab: 'unternehmen', label: 'Unternehmen' },
    { tab: 'marken', label: 'Marken' },
    ...(!isKunde ? [{ tab: 'auftraege', label: 'Aufträge' }] : []),
    { tab: 'kampagnen', label: 'Kampagnen' },
    { tab: 'kooperationen', label: 'Kooperationen' },
    { tab: 'videos', label: 'Videos' }
  ].map(t => ({ ...t, isActive: active === t.tab, showIcon: true }));

  return renderSecondaryNav(tabs, { dataAttr: 'data-main-tab' });
}

export function renderProfileMainContent(detail, isKunde) {
  const pane = (tab, html) => `
    <div class="tab-pane ${detail.activeMainTab === tab ? 'active' : ''}" id="main-${tab}">
      ${html}
    </div>
  `;

  return `
    <div class="tab-content">
      ${pane('unternehmen', renderUnternehmenTab(detail, isKunde))}
      ${pane('marken', renderMarkenTab(detail, isKunde))}
      ${!isKunde ? pane('auftraege', renderAuftraegeTab(detail)) : ''}
      ${pane('kampagnen', renderKampagnenTab(detail, isKunde))}
      ${pane('kooperationen', renderKooperationenTab(detail))}
      ${pane('videos', renderVideosTab(detail))}
    </div>
  `;
}
