// Gebuchte Creator und Videos auf den Auftragsdetails.

import { renderEmptyState } from '../../core/components/EmptyState.js';
import { icon } from '../../core/icons/IconSystem.js';

// Rendere Creator & Videos Tabelle
export function renderCreatorVideosTable(detail) {
  if (!detail.kooperationen || detail.kooperationen.length === 0) {
    return renderEmptyState({
      icon: 'handshake',
      title: 'Keine Kooperationen vorhanden',
      text: 'Für diesen Auftrag wurden noch keine Kooperationen mit Creator und Videos angelegt.'
    });
  }

  // Erstelle eine Liste aller Videos mit Creator-Informationen
  const videoRows = [];
  
  detail.kooperationen.forEach(koop => {
    const creator = koop.creator || {};
    const creatorName = [creator.vorname, creator.nachname].filter(Boolean).join(' ') || 'Unbekannt';
    const creatorId = creator.id;
    
    // Videos für diese Kooperation
    const koopVideos = detail.videos.filter(v => v.kooperation_id === koop.id);
    
    const kampagne = koop.kampagne;

    if (koopVideos.length === 0) {
      videoRows.push({
        creatorName,
        creatorId,
        kategorie: '-',
        videoTitel: '-',
        videoLink: null,
        kooperationId: koop.id,
        kooperationName: koop.name || 'Kooperation',
        kampagneId: kampagne?.id,
        kampagneName: kampagne?.kampagnenname || '-',
        ekNetto: koop.einkaufspreis_netto,
        vkNetto: koop.verkaufspreis_netto,
        extraKostenVk: koop.verkaufspreis_zusatzkosten
      });
    } else {
      koopVideos.forEach(video => {
        const videoLink = video.link_content || video.asset_url || null;
        videoRows.push({
          creatorName,
          creatorId,
          kategorie: video.content_art || '-',
          videoTitel: video.titel || video.thema || '-',
          videoLink,
          videoName: video.video_name || null,
          kooperationId: koop.id,
          kooperationName: koop.name || 'Kooperation',
          videoId: video.id,
          kampagneId: kampagne?.id,
          kampagneName: kampagne?.kampagnenname || '-',
          ekNetto: video.einkaufspreis_netto,
          vkNetto: video.verkaufspreis_netto,
          extraKostenVk: koop.verkaufspreis_zusatzkosten
        });
      });
    }
  });

  if (videoRows.length === 0) {
    return `
      <div class="u-mt-xl">
        <h3 class="u-mb-md">Creator & Videos Übersicht</h3>
        ${renderEmptyState({
          icon: 'video',
          title: 'Keine Videos vorhanden',
          text: 'Für diesen Auftrag wurden noch keine Videos angelegt.'
        })}
      </div>
    `;
  }

  const isKunde = window.isKunde();
  const formatCurrency = (v) => {
    if (v === null || v === undefined) return '-';
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
  };

  const formatCreatorbudgetPct = (pct) => new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: 1,
  }).format(pct ?? 0);

  const renderRechnungStatusBadge = (kooperationId) => {
    const status = detail.rechnungStatusMap[kooperationId];
    if (!status) {
      return '<span class="status-badge status-nicht-erstellt">Nicht erstellt</span>';
    }
    const slug = status.toLowerCase().replace(/\s+/g, '-').replace(/ü/g, 'ue').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ß/g, 'ss');
    return `<span class="status-badge status-${slug}">${status}</span>`;
  };

  const rowsHtml = videoRows.map(row => {
    const sanitize = (v) => window.validatorSystem.sanitizeHtml(v);
    const videoDisplayName = row.videoName || row.videoTitel;
    const videoHtml = row.videoLink
      ? `<a href="${sanitize(row.videoLink)}" target="_blank" rel="noopener noreferrer" class="table-link">
           ${sanitize(videoDisplayName)}
           ${icon('external-link', { className: 'icon-14' })}
         </a>`
      : (videoDisplayName && videoDisplayName !== '-' ? sanitize(videoDisplayName) : '-');
    
    const creatorLinkHtml = isKunde
      ? sanitize(row.creatorName)
      : (row.creatorId
        ? `<a href="#" class="table-link" data-table="creator" data-id="${row.creatorId}">
             ${sanitize(row.creatorName)}
           </a>`
        : sanitize(row.creatorName));

    const kampagneLinkHtml = isKunde
      ? sanitize(row.kampagneName)
      : (row.kampagneId
        ? `<a href="#" class="table-link" data-table="kampagne" data-id="${row.kampagneId}">${sanitize(row.kampagneName)}</a>`
        : sanitize(row.kampagneName));

    return `
      <tr>
        <td>${creatorLinkHtml}</td>
        <td>${kampagneLinkHtml}</td>
        ${!isKunde ? `<td>${sanitize(row.kategorie)}</td>` : ''}
        ${!isKunde ? `<td class="text-right">${formatCurrency(row.ekNetto)}</td>` : ''}
        <td class="text-right">${formatCurrency(row.vkNetto)}</td>
        ${!isKunde ? `<td class="text-right">${formatCurrency(row.extraKostenVk)}</td>` : ''}
        <td>${renderRechnungStatusBadge(row.kooperationId)}</td>
        <td>${videoHtml}</td>
      </tr>
    `;
  }).join('');

  return `
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Creator</th>
              <th>Kampagne</th>
              ${!isKunde ? '<th>Kategorie</th>' : ''}
              ${!isKunde ? '<th class="text-right">EK Netto</th>' : ''}
              <th class="text-right">VK Netto</th>
              ${!isKunde ? '<th class="text-right">Extra Kosten (VK)</th>' : ''}
              <th>Rechnungsstatus</th>
              <th>Video</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          ${!isKunde ? `
          <tfoot>
            <tr>
              <td colspan="3">Gesamt</td>
              <td class="text-right">${formatCurrency(detail.budgetSummary.ekSum || 0)}</td>
              <td class="text-right">${formatCurrency(detail.budgetSummary.vkSum || 0)}</td>
              <td class="text-right">${formatCurrency(detail.budgetSummary.extraKostenVkSum || 0)}</td>
              <td colspan="2"></td>
            </tr>
            ${detail.budgetSummary.ekVkMarginSum ? `
            <tr>
              <td colspan="3">Differenz (VK − EK)</td>
              <td></td>
              <td class="text-right">
                <div class="data-table-footer-value-group">
                  <span>${formatCurrency(detail.budgetSummary.ekVkMarginSum)}</span>
                  <div class="tags tags-compact">
                    <span class="tag tag--branche">${formatCreatorbudgetPct(detail.budgetSummary.ekVkMarginCreatorbudgetPct)}% Creatorbudget</span>
                  </div>
                </div>
              </td>
              <td colspan="3"></td>
            </tr>` : ''}
          </tfoot>
          ` : ''}
        </table>
      </div>
  `;
}
