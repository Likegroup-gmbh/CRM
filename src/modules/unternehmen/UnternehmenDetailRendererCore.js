// UnternehmenDetailRendererCore.js
// Seitenhülle, Tab-Navigation, Main-Content-Verdrahtung, Marken, Adresse

import { renderTabButton } from '../../core/TabUtils.js';
import { UnternehmenService } from './services/UnternehmenService.js';
import { renderAuftraege, renderAuftragsdetails, renderBriefings, renderKampagnen } from './UnternehmenDetailRendererBusiness.js';
import { renderStrategien, renderCreatorAuswahl, renderKooperationen, renderCreators, renderAnsprechpartner, renderRechnungen, renderVertraege, renderKickOff } from './UnternehmenDetailRendererRelations.js';

export function renderUnternehmenDetailPage(detail) {
  if (!detail.activeMainTab) {
    detail.activeMainTab = 'informationen';
  }

  window.setHeadline(`${detail.unternehmen?.firmenname || 'Unternehmen'} - Details`);

  const personConfig = {
    name: detail.unternehmen?.firmenname || 'Unbekannt',
    email: '',
    subtitle: detail.unternehmen?.branchen_names?.join(', ') || 'Unternehmen',
    avatarUrl: detail.unternehmen?.logo_url,
    avatarOnly: false
  };

  const quickActions = [];

  const webseiteLinkHtml = detail.unternehmen?.webseite
    ? `<a href="${UnternehmenService.sanitizeUrl(detail.unternehmen.webseite)}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="${detail.sanitize(detail.unternehmen.webseite)}"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg></a>`
    : null;

  const sidebarInfo = detail.renderInfoItems([
    ...(detail.unternehmen?.internes_kuerzel ? [{ icon: 'info', label: 'Internes Kürzel', value: detail.unternehmen.internes_kuerzel }] : []),
    { icon: 'tag', label: 'Branchen', value: detail.unternehmen?.branchen_names?.join(', ') || '-' },
    ...(webseiteLinkHtml ? [{ icon: 'link', label: 'Webseite', rawHtml: webseiteLinkHtml }] : []),
    { icon: 'mail', label: 'E-Mail', value: detail.unternehmen?.mail, mailto: true },
    { icon: 'mail', label: 'Rechnungs-E-Mail', value: detail.unternehmen?.invoice_email, mailto: true },
    { icon: 'home', label: 'Rechnungsadresse', rawHtml: renderAdresseBlock(detail, 'rechnungsadresse') },
    { icon: 'clock', label: 'Erstellt', value: detail.formatDate(detail.unternehmen?.created_at) },
    { icon: 'clock', label: 'Aktualisiert', value: detail.formatDate(detail.unternehmen?.updated_at) }
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

export function getAdresseDisplay(detail) {
  const parts = [
    [detail.unternehmen?.rechnungsadresse_strasse, detail.unternehmen?.rechnungsadresse_hausnummer].filter(Boolean).join(' '),
    [detail.unternehmen?.rechnungsadresse_plz, detail.unternehmen?.rechnungsadresse_stadt].filter(Boolean).join(' '),
    detail.unternehmen?.rechnungsadresse_land
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '-';
}

export function renderAdresseBlock(detail, prefix) {
  const strasse = detail.unternehmen?.[`${prefix}_strasse`];
  const hausnr = detail.unternehmen?.[`${prefix}_hausnummer`];
  const plz = detail.unternehmen?.[`${prefix}_plz`];
  const stadt = detail.unternehmen?.[`${prefix}_stadt`];
  const land = detail.unternehmen?.[`${prefix}_land`];

  const line1 = [strasse, hausnr].filter(Boolean).join(' ');
  const line2 = [plz, stadt].filter(Boolean).join(' ');
  const line3 = land || '';

  const lines = [line1, line2, line3].filter(Boolean);
  if (lines.length === 0) return '-';

  return `<span class="info-address">${lines.map(l => detail.sanitize(l)).join('<br>')}</span>`;
}

export function renderTabNavigation(detail) {
  const showKickOffTab = detail.marken.length === 0;

  const tabs = [
    { tab: 'informationen', label: 'Informationen', isActive: detail.activeMainTab === 'informationen' },
    ...(showKickOffTab ? [{
      tab: 'kickoff',
      label: 'Kick-Off',
      count: Object.values(detail.kickoffsByType).filter(Boolean).length,
      isActive: detail.activeMainTab === 'kickoff'
    }] : []),
    { tab: 'marken', label: 'Marken', count: detail.marken.length, isActive: detail.activeMainTab === 'marken' },
    { tab: 'ansprechpartner', label: 'Ansprechpartner', count: detail.ansprechpartner.length, isActive: detail.activeMainTab === 'ansprechpartner' },
    { tab: 'auftraege', label: 'Aufträge', count: detail.auftraege.length, isActive: detail.activeMainTab === 'auftraege' },
    { tab: 'auftragsdetails', label: 'Auftragsdetails', count: detail.auftragsdetails.length, isActive: detail.activeMainTab === 'auftragsdetails' },
    { tab: 'kampagnen', label: 'Kampagnen', count: detail.kampagnen.length, isActive: detail.activeMainTab === 'kampagnen' },
    { tab: 'briefings', label: 'Briefings', count: detail.briefings.length, isActive: detail.activeMainTab === 'briefings' },
    { tab: 'strategien', label: 'Strategien', count: detail.strategien.length, isActive: detail.activeMainTab === 'strategien' },
    { tab: 'creatorauswahl', label: 'Creator-Auswahl', count: detail.creatorAuswahlen.length, isActive: detail.activeMainTab === 'creatorauswahl' },
    { tab: 'kooperationen', label: 'Kooperationen', count: detail.kooperationen.length, isActive: detail.activeMainTab === 'kooperationen' },
    { tab: 'creators', label: 'Creator', count: detail.creators.length, isActive: detail.activeMainTab === 'creators' },
    { tab: 'rechnungen', label: 'Rechnungen', count: detail.rechnungen.length, isActive: detail.activeMainTab === 'rechnungen' },
    { tab: 'vertraege', label: 'Verträge', count: detail.vertraege.length, isActive: detail.activeMainTab === 'vertraege' }
  ];

  return tabs.map(t => renderTabButton({ ...t, showIcon: true })).join('');
}

export function renderMainContent(detail) {
  return `
    <div class="tab-content secondary-tab-content">
      <div class="tab-pane ${detail.activeMainTab === 'kickoff' ? 'active' : ''}" id="tab-kickoff">
        ${renderKickOff(detail)}
      </div>
      <div class="tab-pane ${detail.activeMainTab === 'marken' ? 'active' : ''}" id="tab-marken">
        ${renderMarken(detail)}
      </div>
      <div class="tab-pane ${detail.activeMainTab === 'ansprechpartner' ? 'active' : ''}" id="tab-ansprechpartner">
        ${renderAnsprechpartner(detail)}
      </div>
      <div class="tab-pane ${detail.activeMainTab === 'auftraege' ? 'active' : ''}" id="tab-auftraege">
        ${renderAuftraege(detail)}
      </div>
      <div class="tab-pane ${detail.activeMainTab === 'auftragsdetails' ? 'active' : ''}" id="tab-auftragsdetails">
        ${renderAuftragsdetails(detail)}
      </div>
      <div class="tab-pane ${detail.activeMainTab === 'kampagnen' ? 'active' : ''}" id="tab-kampagnen">
        ${renderKampagnen(detail)}
      </div>
      <div class="tab-pane ${detail.activeMainTab === 'briefings' ? 'active' : ''}" id="tab-briefings">
        ${renderBriefings(detail)}
      </div>
      <div class="tab-pane ${detail.activeMainTab === 'strategien' ? 'active' : ''}" id="tab-strategien">
        ${renderStrategien(detail)}
      </div>
      <div class="tab-pane ${detail.activeMainTab === 'creatorauswahl' ? 'active' : ''}" id="tab-creatorauswahl">
        ${renderCreatorAuswahl(detail)}
      </div>
      <div class="tab-pane ${detail.activeMainTab === 'kooperationen' ? 'active' : ''}" id="tab-kooperationen">
        ${renderKooperationen(detail)}
      </div>
      <div class="tab-pane ${detail.activeMainTab === 'creators' ? 'active' : ''}" id="tab-creators">
        ${renderCreators(detail)}
      </div>
      <div class="tab-pane ${detail.activeMainTab === 'rechnungen' ? 'active' : ''}" id="tab-rechnungen">
        ${renderRechnungen(detail)}
      </div>
      <div class="tab-pane ${detail.activeMainTab === 'vertraege' ? 'active' : ''}" id="tab-vertraege">
        ${renderVertraege(detail)}
      </div>
    </div>
  `;
}

export function renderMarken(detail) {
  if (!detail.marken || detail.marken.length === 0) {
    return `
      <div class="empty-state">
        <h3>Keine Marken vorhanden</h3>
        <p>Es wurden noch keine Marken für dieses Unternehmen erstellt.</p>
      </div>
    `;
  }

  const rows = detail.marken.map(marke => `
    <tr>
      <td class="col-name-with-icon">
        ${marke.logo_url
          ? `<img src="${marke.logo_url}" class="table-logo" width="24" height="24" alt="" />`
          : `<span class="table-avatar">${(marke.markenname || '?')[0].toUpperCase()}</span>`}
        <a href="#" class="table-link" data-table="marke" data-id="${marke.id}">
          ${detail.sanitize(marke.markenname) || 'Unbekannte Marke'}
        </a>
      </td>
      <td class="col-webseite">${marke.webseite ? `<a href="${UnternehmenService.sanitizeUrl(marke.webseite)}" target="_blank" rel="noopener">${detail.sanitize(marke.webseite)}</a>` : '-'}</td>
      <td>${detail.sanitize(marke.branche) || '-'}</td>
      <td>${detail.formatDate(marke.created_at)}</td>
    </tr>
  `).join('');

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Marke</th>
            <th class="col-webseite">Webseite</th>
            <th>Branche</th>
            <th>Erstellt</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}
