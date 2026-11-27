// HTML der Masterlisten-Übersicht: Ordner als Karten oder Zeilen, Listen als Tabelle.

import { icon } from '../../core/icons/IconSystem.js';
import { renderFolderAvatar } from '../../core/format/folderAvatar.js';
import { renderTableIdentity } from '../../core/format/tableIdentity.js';
import { escapeHtml, formatDate } from './masterliste.js';

function ordnerAttrs(ordner) {
  return `data-ordner-id="${escapeHtml(ordner.id)}" data-ordner-name="${escapeHtml(ordner.name)}"`;
}

function anzahl(count) {
  return `${count} ${count === 1 ? 'Liste' : 'Listen'}`;
}

export function renderOrdnerGrid(ordnerListe) {
  return ordnerListe.map(ordner => `
    <div class="folder-card" ${ordnerAttrs(ordner)}>
      <div class="folder-icon">
        ${renderFolderAvatar({ url: ordner.logoUrl, name: ordner.name })}
      </div>
      <div class="folder-info">
        <span class="folder-name">${escapeHtml(ordner.name)}</span>
        <span class="folder-count">${anzahl(ordner.count)}</span>
      </div>
    </div>
  `).join('');
}

export function renderOrdnerTabelle(ordnerListe) {
  const rows = ordnerListe.map(ordner => `
    <tr class="table-row-clickable" ${ordnerAttrs(ordner)}>
      <td class="col-name">
        ${renderTableIdentity({
          url: ordner.logoUrl,
          logo: true,
          iconHtml: icon('folder-open'),
          nameHtml: `<a href="#" class="table-link" ${ordnerAttrs(ordner)}>${escapeHtml(ordner.name)}</a>`
        })}
      </td>
      <td>${ordner.count}</td>
    </tr>
  `).join('');
  return `
    <table class="data-table">
      <thead><tr><th>Unternehmen</th><th>Masterlisten</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function rowMenu(list, canManage) {
  const id = escapeHtml(list.id);
  if (!canManage) return `<a href="#" class="table-link" data-table="creator-lists" data-id="${id}">Öffnen</a>`;
  return `
    <div class="actions-dropdown-container" data-entity-type="creator_list">
      <button type="button" class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
        ${icon('dots-grid', { className: 'w-5 h-5' })}
      </button>
      <div class="actions-dropdown">
        <a href="#" class="action-item" data-action="view-masterliste" data-id="${id}">${icon('eye')}Öffnen</a>
        <a href="#" class="action-item" data-action="rename-masterliste" data-id="${id}">${icon('pencil-square')}Bearbeiten</a>
        <div class="action-separator"></div>
        <a href="#" class="action-item action-danger" data-action="delete-masterliste" data-id="${id}">${icon('trash')}Löschen</a>
      </div>
    </div>
  `;
}

function unternehmenZelle(list) {
  if (!list.unternehmenName) return '-';
  return renderTableIdentity({
    url: list.unternehmenLogo,
    logo: true,
    name: list.unternehmenName,
    nameHtml: `<span class="table-text">${escapeHtml(list.unternehmenName)}</span>`
  });
}

function listenZeile(list, { mitUnternehmen, canManage }) {
  const beschreibung = list.beschreibung
    ? `<div class="masterliste-listen-beschreibung">${escapeHtml(list.beschreibung)}</div>`
    : '';
  const unternehmen = mitUnternehmen ? `<td class="col-unternehmen">${unternehmenZelle(list)}</td>` : '';
  return `
    <tr class="table-row-clickable" data-list-id="${escapeHtml(list.id)}">
      <td class="col-name">
        <a href="#" class="table-link" data-table="creator-lists" data-id="${escapeHtml(list.id)}">${escapeHtml(list.name || 'Ohne Namen')}</a>
        ${beschreibung}
      </td>
      ${unternehmen}
      <td class="ml-list-count">${list.count}</td>
      <td class="col-erstellt-von">${escapeHtml(list.autor || '-')}</td>
      <td class="ml-list-datum">${formatDate(list.createdAt)}</td>
      <td class="col-actions">${rowMenu(list, canManage)}</td>
    </tr>
  `;
}

export function listenSpaltenAnzahl({ mitUnternehmen }) {
  return mitUnternehmen ? 6 : 5;
}

/** bodyHtml ersetzt die Zeilen, z. B. durch einen Leerzustand. */
export function renderListenTabelle(lists, { mitUnternehmen = false, canManage = false, bodyHtml = null } = {}) {
  const rows = bodyHtml ?? lists.map(list => listenZeile(list, { mitUnternehmen, canManage })).join('');
  return `
    <table class="data-table">
      <thead>
        <tr>
          <th class="col-name">Name</th>
          ${mitUnternehmen ? '<th class="col-unternehmen">Unternehmen</th>' : ''}
          <th class="ml-list-count">Creator</th>
          <th class="col-erstellt-von">Erstellt von</th>
          <th class="ml-list-datum">Erstellt am</th>
          <th class="col-actions">Aktionen</th>
        </tr>
      </thead>
      <tbody id="creator-lists-body">${rows}</tbody>
    </table>
  `;
}
