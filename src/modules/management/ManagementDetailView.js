// Darstellung der Management-Detailseite: Sidebar, Tabs, Creator, Ansprechpartner, Rechnungen.

import { renderCreatorTable } from '../creator/CreatorTable.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { renderSecondaryNav } from '../../core/TabUtils.js';
import { renderEmptyState, renderSectionHeader } from '../../core/components/EmptyState.js';
import { icon, renderPdfLinks } from '../../core/icons/IconSystem.js';
import { renderManagementBetreuung } from '../ansprechpartner/managementBetreuung.js';

export function renderManagementPage(detail) {
  if (!detail.activeMainTab) detail.activeMainTab = 'creators';

  window.setHeadline(`${detail.management?.firmenname || 'Management'} - Details`);

  const personConfig = {
    name: detail.management?.firmenname || 'Unbekannt',
    email: '',
    subtitle: 'Management',
    avatarUrl: detail.management?.logo_url,
    avatarOnly: false
  };

  const webseiteLinkHtml = detail.management?.webseite
    ? `<a href="${sanitizeUrl(detail.management.webseite)}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="${detail.sanitize(detail.management.webseite)}">${icon('external-link')}</a>`
    : null;

  const sidebarInfo = detail.renderInfoItems([
    { icon: 'home', label: 'Adresse', rawHtml: renderAdresseBlock(detail) },
    { icon: 'mail', label: 'E-Mail', value: detail.management?.email, mailto: true },
    { icon: 'phone', label: 'Telefon', value: detail.management?.telefonnummer },
    ...(webseiteLinkHtml ? [{ icon: 'link', label: 'Webseite', rawHtml: webseiteLinkHtml }] : []),
    ...(detail.management?.instagram ? [{ icon: 'instagram', label: 'Instagram', rawHtml: instagramLink(detail) }] : []),
    ...(detail.management?.linkedin ? [{ icon: 'linkedin', label: 'LinkedIn', rawHtml: `<a href="${sanitizeUrl(detail.management.linkedin)}" target="_blank" rel="noopener">${detail.sanitize(detail.management.linkedin)}</a>` }] : []),
    ...(detail.management?.status ? [{ icon: 'check', label: 'Status', value: detail.management.status, badge: true, badgeType: detail.management.status === 'aktiv' ? 'success' : 'secondary' }] : []),
    { icon: 'clock', label: 'Erstellt', value: detail.formatDate(detail.management?.created_at) },
    { icon: 'clock', label: 'Aktualisiert', value: detail.formatDate(detail.management?.updated_at) }
  ]);

  const html = detail.renderTwoColumnLayout({
    person: personConfig,
    stats: [],
    quickActions: [],
    sidebarInfo,
    tabNavigation: renderTabNavigation(detail),
    mainContent: renderMainContent(detail)
  });

  window.setContentSafely(window.content, html);
}

function instagramLink(detail) {
  const handle = detail.management.instagram;
  const href = handle.startsWith('http')
    ? detail.sanitize(handle)
    : `https://instagram.com/${detail.sanitize(handle.replace('@', ''))}`;
  return `<a href="${href}" target="_blank" rel="noopener">@${detail.sanitize(handle)}</a>`;
}

function renderAdresseBlock(detail) {
  const m = detail.management;
  const line1 = [m?.strasse, m?.hausnummer].filter(Boolean).join(' ');
  const line2 = [m?.plz, m?.stadt].filter(Boolean).join(' ');
  const lines = [line1, line2, m?.land || ''].filter(Boolean);
  if (lines.length === 0) return '-';
  return `<span class="info-address">${lines.map(l => detail.sanitize(l)).join('<br>')}</span>`;
}

function renderTabNavigation(detail) {
  const tabs = [
    { tab: 'creators', label: 'Creator', count: detail.creators.length, isActive: detail.activeMainTab === 'creators' },
    { tab: 'ansprechpartner', label: 'Ansprechpartner', count: detail.ansprechpartner.length, isActive: detail.activeMainTab === 'ansprechpartner' },
    { tab: 'rechnungen', label: 'Rechnungen', count: detail.rechnungen.length, isActive: detail.activeMainTab === 'rechnungen' }
  ];
  return renderSecondaryNav(tabs.map(t => ({ ...t, showIcon: true })));
}

function renderMainContent(detail) {
  return `
    <div class="tab-content secondary-tab-content management-tab-inset">
      <div class="tab-pane ${detail.activeMainTab === 'creators' ? 'active' : ''}" id="tab-creators">
        ${renderCreators(detail)}
      </div>
      <div class="tab-pane ${detail.activeMainTab === 'ansprechpartner' ? 'active' : ''}" id="tab-ansprechpartner">
        ${renderManagementBetreuung({
          people: detail.ansprechpartner,
          creators: detail.creators,
          links: detail.betreuungLinks
        })}
      </div>
      <div class="tab-pane ${detail.activeMainTab === 'rechnungen' ? 'active' : ''}" id="tab-rechnungen">
        ${renderRechnungen(detail)}
      </div>
    </div>
  `;
}

function renderCreators(detail) {
  const addBtn = `
    <button class="mdc-btn mdc-btn--sm" id="btn-add-creator-to-management">
      ${icon('plus-lg', { className: 'icon-16' })}
      Creator hinzufügen
    </button>
  `;

  if (!detail.creators || detail.creators.length === 0) {
    return renderEmptyState({
      icon: 'creator',
      title: 'Keine Creator vorhanden',
      text: 'Diesem Management sind noch keine aktiven Creator zugeordnet.',
      actionsHtml: addBtn
    });
  }
  return `
    ${renderSectionHeader({ title: 'Creator', actionsHtml: addBtn })}
    ${renderCreatorTable(detail.creators, { showRemoveAction: true, managementId: detail.managementId })}
  `;
}

function renderRechnungen(detail) {
  if (!detail.rechnungen || detail.rechnungen.length === 0) {
    return renderEmptyState({
      icon: 'invoice',
      title: 'Keine Rechnungen vorhanden',
      text: 'Für die Creator dieses Managements wurden noch keine Rechnungen erfasst.'
    });
  }

  const isKunde = window.isKunde();
  const rows = detail.rechnungen.map(r => {
    const kampagneName = r.kampagne ? (r.kampagne.eigener_name || r.kampagne.kampagnenname || '-') : '-';
    const preisProVideo = r.videoanzahl && r.nettobetrag ? detail.formatCurrency(r.nettobetrag / r.videoanzahl) : '-';
    const creatorBubble = r.creator ? avatarBubbles.renderBubbles([{
      name: [r.creator.vorname, r.creator.nachname].filter(Boolean).join(' '),
      type: 'person', id: r.creator.id, entityType: 'creator'
    }]) : '-';
    return `
      <tr>
        <td><a href="/rechnung/${r.id}" class="table-link" onclick="event.preventDefault(); window.navigateTo('/rechnung/${r.id}')">${detail.sanitize(r.rechnung_nr || '—')}</a></td>
        <td><span class="status-badge ${r.rechnungstyp === 'contracting' ? 'status-gestellt' : 'status-beauftragt'}">${r.rechnungstyp === 'contracting' ? 'Contracting' : 'Kampagne'}</span></td>
        <td>${r.auftrag ? `<a href="#" class="table-link" data-table="auftrag" data-id="${r.auftrag.id}">${detail.sanitize(r.auftrag.auftragsname || '-')}</a>` : '-'}</td>
        <td>${detail.sanitize(r.po_nummer) || '-'}</td>
        <td>${detail.formatDate(r.created_at)}</td>
        <td>${r.kampagne ? `<a href="#" class="table-link" data-table="kampagne" data-id="${r.kampagne.id}">${detail.sanitize(kampagneName)}</a>` : '-'}</td>
        <td>${detail.sanitize(r.land) || '-'}</td>
        <td>${creatorBubble}</td>
        <td>${detail.formatDate(r.gestellt_am)}</td>
        <td>${detail.formatDate(r.zahlungsziel)}</td>
        <td>${detail.formatCurrency(r.nettobetrag)}</td>
        <td>${r.videoanzahl || '-'}</td>
        <td>${preisProVideo}</td>
        <td>${detail.formatCurrency(r.bruttobetrag)}</td>
        <td>${renderPdfLinks(r.rechnung_pdfs, r.pdf_url)}</td>
        <td>${r.status || '-'}</td>
        ${!isKunde ? `<td>${renderPersonBubble(r.created_by)}</td>` : ''}
        ${!isKunde ? `<td>${actionBuilder.create('rechnung', r.id)}</td>` : ''}
      </tr>
    `;
  }).join('');

  return `
    ${renderSectionHeader({ title: 'Rechnungen' })}
    <div class="data-table-container">
      <table class="data-table data-table--nowrap">
        <thead>
          <tr>
            <th>Rechnungsname</th>
            <th>Typ</th>
            <th>Auftrag</th>
            <th>PO-Nummer</th>
            <th>Erstellt am</th>
            <th>Kampagne / Contract</th>
            <th>Land</th>
            <th>Creator</th>
            <th>Gestellt am</th>
            <th>Zahlungsziel</th>
            <th>Nettobetrag</th>
            <th>Videos</th>
            <th>Preis/Video</th>
            <th>Bruttobetrag</th>
            <th>Beleg</th>
            <th>Status</th>
            ${!isKunde ? '<th>Erstellt von</th>' : ''}
            ${!isKunde ? '<th>Aktionen</th>' : ''}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderPersonBubble(person, entityType = 'mitarbeiter') {
  if (!person) return '-';
  const name = person.name || [person.vorname, person.nachname].filter(Boolean).join(' ');
  if (!name) return '-';
  return avatarBubbles.renderBubbles([{
    name, type: 'person', id: person.id,
    entityType, profile_image_url: person.profile_image_url || null
  }]);
}

function sanitizeUrl(url) {
  if (!url) return '#';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
