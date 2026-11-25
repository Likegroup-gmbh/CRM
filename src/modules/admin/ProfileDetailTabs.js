// ProfileDetailTabs.js
// HTML der Tab-Tabellen auf der Profilseite (Unternehmen, Marken, Aufträge, Kampagnen, Kooperationen, Videos)

import { KampagneUtils } from '../kampagne/KampagneUtils.js';
import { actionsDropdown } from '../../core/ActionsDropdown.js';
import { renderEmptyState } from '../../core/components/EmptyState.js';

// ---------- Gemeinsame Bausteine ----------

function th(label, cls = '') {
  return `<th${cls ? ` class="${cls}"` : ''}>${label}</th>`;
}

function actionsTh() {
  return th('Aktionen', 'col-w80-right');
}

function renderTable(headCells, rows) {
  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead><tr>${headCells.join('')}</tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>
  `;
}

function renderDetailLink(path, id) {
  return `<td class="u-text-right">
    <a href="/${path}/${id}" onclick="event.preventDefault(); window.navigateTo('/${path}/${id}')" class="mdc-btn mdc-btn--secondary mdc-btn--sm">Details</a>
  </td>`;
}

function renderEntityWithLogo(detail, logoUrl, name) {
  return `
    <div class="entity-with-logo">
      ${logoUrl ? `<img src="${logoUrl}" alt="${detail.sanitize(name)}" class="entity-logo" />` : ''}
      <span>${detail.sanitize(name)}</span>
    </div>
  `;
}

function renderBadge(detail, value) {
  return `<span class="badge badge-secondary">${detail.sanitize(value || 'Unbekannt')}</span>`;
}

function renderStatusTag(detail, kampagne) {
  const statusName = kampagne.status_ref?.name || kampagne.status;
  if (!statusName) return '-';
  const statusIcon = actionsDropdown?.getStatusIcon?.(statusName) || '';
  return `<div class="tags tags-compact"><span class="tag tag--type">${statusIcon}${detail.sanitize(statusName)}</span></div>`;
}

// ---------- Tabs ----------

export function renderUnternehmenTab(detail, isKunde) {
  if (detail.unternehmen.length === 0) {
    return renderEmptyState({ icon: 'building', title: 'Keine Unternehmen zugeordnet' });
  }

  const head = [th('Firmenname'), th('Website', 'col-webseite'), ...(!isKunde ? [actionsTh()] : [])];
  const rows = detail.unternehmen.map(u => `
    <tr>
      <td>${renderEntityWithLogo(detail, u.logo_url, u.firmenname)}</td>
      <td class="col-webseite">${u.webseite ? `<a href="${u.webseite}" target="_blank" rel="noopener">${detail.sanitize(u.webseite)}</a>` : '-'}</td>
      ${!isKunde ? renderDetailLink('unternehmen', u.id) : ''}
    </tr>
  `);
  return renderTable(head, rows);
}

export function renderMarkenTab(detail, isKunde) {
  if (detail.marken.length === 0) {
    return renderEmptyState({ icon: 'tag', title: 'Keine Marken zugeordnet' });
  }

  const head = [th('Markenname'), th('Unternehmen'), ...(!isKunde ? [actionsTh()] : [])];
  const rows = detail.marken.map(m => `
    <tr>
      <td>${renderEntityWithLogo(detail, m.logo_url, m.markenname)}</td>
      <td>${m.unternehmen?.firmenname ? detail.sanitize(m.unternehmen.firmenname) : '-'}</td>
      ${!isKunde ? renderDetailLink('marke', m.id) : ''}
    </tr>
  `);
  return renderTable(head, rows);
}

export function renderAuftraegeTab(detail) {
  if (detail.auftraege.length === 0) {
    return renderEmptyState({ icon: 'clipboard', title: 'Keine Aufträge zugeordnet' });
  }

  const head = [th('Auftragsname'), th('Marke'), th('Status'), th('Erstellt am'), actionsTh()];
  const rows = detail.auftraege.map(a => `
    <tr>
      <td>${detail.sanitize(a.auftragsname)}</td>
      <td>${a.marke?.markenname ? detail.sanitize(a.marke.markenname) : '-'}</td>
      <td>${renderBadge(detail, a.status)}</td>
      <td>${detail.formatDate(a.created_at)}</td>
      ${renderDetailLink('auftrag', a.id)}
    </tr>
  `);
  return renderTable(head, rows);
}

export function renderKampagnenTab(detail, isKunde) {
  if (detail.kampagnen.length === 0) {
    return renderEmptyState({ icon: 'megaphone', title: 'Keine Kampagnen zugeordnet' });
  }

  const head = [th('Kampagnenname'), th('Marke'), th('Status'), th('Erstellt am'), ...(!isKunde ? [actionsTh()] : [])];
  const rows = detail.kampagnen.map(k => {
    const markeOderUnternehmen = k.marke?.markenname || k.unternehmen?.firmenname;
    return `
      <tr>
        <td>${detail.sanitize(KampagneUtils.getDisplayName(k))}</td>
        <td>${markeOderUnternehmen ? detail.sanitize(markeOderUnternehmen) : '-'}</td>
        <td>${renderStatusTag(detail, k)}</td>
        <td>${detail.formatDate(k.created_at)}</td>
        ${!isKunde ? renderDetailLink('kampagne', k.id) : ''}
      </tr>
    `;
  });
  return renderTable(head, rows);
}

export function renderKooperationenTab(detail) {
  if (detail.kooperationen.length === 0) {
    return renderEmptyState({ icon: 'handshake', title: 'Keine Kooperationen zugeordnet' });
  }

  const head = [th('Name'), th('Kampagne'), th('Status'), th('Erstellt am'), actionsTh()];
  const rows = detail.kooperationen.map(k => `
    <tr>
      <td>${detail.sanitize(k.name)}</td>
      <td>${detail.sanitize(KampagneUtils.getDisplayName(k.kampagne))}</td>
      <td>${renderBadge(detail, k.status)}</td>
      <td>${detail.formatDate(k.created_at)}</td>
      ${renderDetailLink('kooperation', k.id)}
    </tr>
  `);
  return renderTable(head, rows);
}

export function renderVideosTab(detail) {
  if (detail.videos.length === 0) {
    return renderEmptyState({ icon: 'video', title: 'Keine Videos zugeordnet' });
  }

  const head = [th('Videoname'), th('Kooperation'), th('Version'), th('Status'), th('Erstellt am')];
  const rows = detail.videos.map(v => `
    <tr>
      <td>${detail.sanitize(v.videoname || 'Unbenannt')}</td>
      <td>${v.kooperation?.name ? detail.sanitize(v.kooperation.name) : '-'}</td>
      <td><span class="badge badge-outline">V${v.version || 1}</span></td>
      <td>${renderBadge(detail, v.status)}</td>
      <td>${detail.formatDate(v.created_at)}</td>
    </tr>
  `);
  return renderTable(head, rows);
}
