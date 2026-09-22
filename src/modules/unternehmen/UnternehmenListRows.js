// UnternehmenListRows.js
// Zeilen-HTML der Unternehmen-Liste. Kein Fetch.

import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { icon } from '../../core/icons/IconSystem.js';
import { testunternehmenBadgeHtml } from '../../core/budget/testunternehmen.js';
import { UnternehmenService } from './services/UnternehmenService.js';

export function renderBrancheTags(branchen, sanitize) {
  if (!branchen || (Array.isArray(branchen) && branchen.length === 0)) return '-';

  if (typeof branchen === 'object' && !Array.isArray(branchen) && branchen.name) {
    return `<div class="tags tags-compact"><span class="tag tag--branche">${sanitize(branchen.name)}</span></div>`;
  }

  if (typeof branchen === 'string') {
    const parts = branchen.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return '-';
    const inner = parts.map(label => `<span class="tag tag--branche">${sanitize(label)}</span>`).join('');
    return `<div class="tags tags-compact">${inner}</div>`;
  }

  if (Array.isArray(branchen)) {
    const inner = branchen.map(b => {
      const label = typeof b === 'object' ? (b.name || b.label || b) : b;
      return `<span class="tag tag--branche">${sanitize(String(label).trim())}</span>`;
    }).join('');
    return `<div class="tags tags-compact">${inner}</div>`;
  }

  if (typeof branchen === 'object') {
    const label = branchen.name || branchen.label;
    return label ? `<div class="tags tags-compact"><span class="tag tag--branche">${sanitize(label)}</span></div>` : '-';
  }

  return '-';
}

export function renderMitarbeiterByRole(list) {
  if (!list || list.length === 0) return '-';

  const items = list
    .filter(m => m && m.name)
    .map(m => ({
      name: m.name,
      type: 'person',
      id: m.id,
      entityType: 'mitarbeiter',
      profile_image_url: m.profile_image_url || null
    }));

  return avatarBubbles.renderBubbles(items);
}

export function renderAnsprechpartnerList(list) {
  if (!list || list.length === 0) return '-';

  const items = list
    .filter(ap => ap && ap.vorname && ap.nachname)
    .map(ap => ({
      name: `${ap.vorname} ${ap.nachname}`,
      type: 'person',
      id: ap.id,
      entityType: 'ansprechpartner',
      profile_image_url: ap.profile_image_url || null
    }));

  return avatarBubbles.renderBubbles(items);
}

export function renderUnternehmenRow(u, ctx) {
  const { sanitize, canBulkDelete, expandedIds } = ctx;

  const allMitarbeiter = u._mitarbeiter || [];
  const management = allMitarbeiter.filter(m => m.role === 'management');
  const leads = allMitarbeiter.filter(m => m.role === 'lead_mitarbeiter');
  const mitarbeiter = allMitarbeiter.filter(m => m.role === 'mitarbeiter');
  const marken = u._marken || [];
  const expanded = expandedIds.has(u.id);
  const chevron = marken.length > 0
    ? `<button type="button" class="unternehmen-marken-toggle" data-id="${u.id}" aria-expanded="${expanded ? 'true' : 'false'}" aria-label="Marken ${expanded ? 'einklappen' : 'aufklappen'}">${icon('chevron-down')}</button>`
    : '';

  return `
    <tr data-id="${u.id}">
      ${canBulkDelete ? `<td class="col-checkbox"><input type="checkbox" class="unternehmen-check" data-id="${u.id}"></td>` : ''}
      <td class="col-name">
        ${chevron}
        ${u.logo_url ? `<img src="${u.logo_url}" class="table-logo" width="24" height="24" alt="" />` : ''}
        <a href="#" class="table-link" data-table="unternehmen" data-id="${u.id}">
          ${sanitize(u.internes_kuerzel || u.firmenname || '')}
        </a>
        ${u.ist_test ? ` ${testunternehmenBadgeHtml()}` : ''}
      </td>
      <td class="col-stadt">${sanitize(u.rechnungsadresse_stadt || '-')}</td>
      <td class="col-land">${sanitize(u.rechnungsadresse_land || '-')}</td>
      <td class="col-webseite table-cell-center">${u.webseite ? `<a href="${UnternehmenService.sanitizeUrl(u.webseite)}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="${sanitize(u.webseite)}">${icon('external-link')}</a>` : '-'}</td>
      <td class="col-branche">${renderBrancheTags(u.branchen, sanitize)}</td>
      <td class="col-ansprechpartner">${renderAnsprechpartnerList(u._ansprechpartner)}</td>
      <td class="col-mitarbeiter">${renderMitarbeiterByRole(management)}</td>
      <td class="col-mitarbeiter">${renderMitarbeiterByRole(leads)}</td>
      <td class="col-mitarbeiter">${renderMitarbeiterByRole(mitarbeiter)}</td>
      <td class="col-actions">
        ${actionBuilder.create('unternehmen', u.id)}
      </td>
    </tr>
  `;
}

export function renderNestedMarkeRow(marke, parentId = marke.unternehmen_id, ctx) {
  const { sanitize, canBulkDelete, matchedMarkeIds } = ctx;
  const name = sanitize(marke.markenname || '');
  const avatar = marke.logo_url
    ? `<img src="${marke.logo_url}" class="table-logo" width="24" height="24" alt="" />`
    : `<span class="table-avatar">${(marke.markenname || '?')[0].toUpperCase()}</span>`;
  const allMitarbeiter = marke._mitarbeiter || [];
  const management = allMitarbeiter.filter(m => m.role === 'management');
  const leads = allMitarbeiter.filter(m => m.role === 'lead_mitarbeiter');
  const mitarbeiter = allMitarbeiter.filter(m => m.role !== 'management' && m.role !== 'lead_mitarbeiter');
  const website = marke.webseite
    ? `<a href="${UnternehmenService.sanitizeUrl(marke.webseite)}" target="_blank" rel="noopener noreferrer" class="external-link-btn" title="${sanitize(marke.webseite)}">${icon('external-link')}</a>`
    : '-';
  const matchClass = matchedMarkeIds.has(marke.id) ? ' is-search-match' : '';

  return `
    <tr class="nested-marke-row${matchClass}" data-id="${marke.id}" data-parent-id="${parentId || ''}">
      ${canBulkDelete ? `<td class="col-checkbox"></td>` : ''}
      <td class="col-name col-name-with-icon">
        ${avatar}
        <a href="#" class="table-link" data-table="marke" data-id="${marke.id}">
          ${name}
        </a>
      </td>
      <td class="col-stadt"></td>
      <td class="col-land"></td>
      <td class="col-webseite table-cell-center">${website}</td>
      <td class="col-branche">${renderBrancheTags(marke.branchen, sanitize)}</td>
      <td class="col-ansprechpartner">${renderAnsprechpartnerList(marke.ansprechpartner)}</td>
      <td class="col-mitarbeiter">${renderMitarbeiterByRole(management)}</td>
      <td class="col-mitarbeiter">${renderMitarbeiterByRole(leads)}</td>
      <td class="col-mitarbeiter">${renderMitarbeiterByRole(mitarbeiter)}</td>
      <td class="col-actions">
        ${actionBuilder.create('marke', marke.id)}
      </td>
    </tr>
  `;
}

export function renderRowGroup(u, ctx) {
  const expanded = ctx.expandedIds.has(u.id);
  const marken = expanded ? (u._marken || []) : [];
  return renderUnternehmenRow(u, ctx) + marken.map(m => renderNestedMarkeRow(m, u.id, ctx)).join('');
}
