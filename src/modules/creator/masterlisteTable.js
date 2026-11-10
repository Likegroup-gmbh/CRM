// Zeilen der Masterliste. Profilzellen sind Text, keine Eingaben.

import { creatorUtils } from './CreatorUtils.js';
import { icon } from '../../core/icons/IconSystem.js';
import { engagementDesEintrags, formatEngagement } from '../creator-auswahl/castingEngagement.js';
import {
  displayHandle,
  escapeHtml,
  socialUrl
} from './masterliste.js';

function tags(names, tagClass) {
  if (!names?.length) return '-';
  return `<div class="tags tags-compact">${names.map(name =>
    `<span class="tag ${tagClass}">${escapeHtml(name)}</span>`
  ).join('')}</div>`;
}

function avatarHtml(creator) {
  const source = creator.profilbild_thumb_url || creator.profilbild_url;
  const safe = source && window.validatorSystem?.sanitizeUrl
    ? window.validatorSystem.sanitizeUrl(source)
    : (/^https?:\/\//i.test(source || '') ? source : '');
  if (safe) {
    return `<img src="${escapeHtml(safe)}" alt="" class="table-avatar table-avatar-img" width="24" height="24" loading="lazy">`;
  }
  const letter = (creator.vorname || creator.name || '?').charAt(0).toUpperCase();
  return `<span class="table-avatar">${escapeHtml(letter)}</span>`;
}

function socialCell(platform, handle) {
  if (!handle) return '-';
  return `<a href="${escapeHtml(socialUrl(platform, handle))}" target="_blank" rel="noopener noreferrer">${escapeHtml(displayHandle(handle))}</a>`;
}

function followerCell(value) {
  const range = creatorUtils.formatFollowerRange(value);
  return escapeHtml(range);
}

function engagementCell(creator) {
  const { rate, clean, showClean } = engagementDesEintrags({ creator });
  const text = formatEngagement(rate);
  const zweit = showClean
    ? `<div class="cpm-auto-reach cpm-auto-reach--clean">${escapeHtml(formatEngagement(clean))} ohne Trials</div>`
    : '';
  return `
    <div class="cell-text-readonly cpm-auto-value">
      <div>${escapeHtml(text || '-')}</div>
      ${zweit}
    </div>
  `;
}

function ort(creator) {
  const text = [creator.lieferadresse_stadt, creator.lieferadresse_land].filter(Boolean).join(', ');
  return escapeHtml(text || '-');
}

function rowMenu(creatorId, listId) {
  return `
    <div class="actions-dropdown-container" data-entity-type="creator">
      <button type="button" class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
        ${icon('dots-grid', { className: 'w-5 h-5' })}
      </button>
      <div class="actions-dropdown">
        <a href="#" class="action-item" data-action="view" data-id="${escapeHtml(creatorId)}">Profil ansehen</a>
        <a href="#" class="action-item" data-action="edit" data-id="${escapeHtml(creatorId)}" data-return-to="/creator-lists/${escapeHtml(listId)}">Bearbeiten</a>
        <div class="action-separator"></div>
        <a href="#" class="action-item action-danger" data-action="remove-masterliste-member" data-creator-id="${escapeHtml(creatorId)}">Von der Liste nehmen</a>
      </div>
    </div>
  `;
}

function cell(col, member, listId) {
  const creator = member.creator;
  switch (col.key) {
    case 'ml-col-drag':
      return `<td class="col-drag drag-handle ${col.key}" title="Reihenfolge ändern"><span aria-hidden="true">⋮⋮</span></td>`;
    case 'ml-col-bild':
      return `<td class="${col.key}">${avatarHtml(creator)}</td>`;
    case 'ml-col-name':
      return `<td class="col-name ${col.key}"><a href="#" class="table-link" data-table="creator" data-id="${escapeHtml(creator.id)}">${escapeHtml(creator.name)}</a></td>`;
    case 'ml-col-ig':
      return `<td class="${col.key}">${socialCell('instagram', creator.instagram)}</td>`;
    case 'ml-col-follower-ig':
      return `<td class="${col.key}">${followerCell(creator.instagram_follower)}</td>`;
    case 'ml-col-engagement':
      return `<td class="${col.key}">${engagementCell(creator)}</td>`;
    case 'ml-col-tt':
      return `<td class="${col.key}">${socialCell('tiktok', creator.tiktok)}</td>`;
    case 'ml-col-follower-tt':
      return `<td class="${col.key}">${followerCell(creator.tiktok_follower)}</td>`;
    case 'ml-col-ort':
      return `<td class="${col.key}">${ort(creator)}</td>`;
    case 'ml-col-branchen':
      return `<td class="${col.key}">${tags(creator.branchen, 'tag--branche')}</td>`;
    case 'ml-col-art':
      return `<td class="${col.key}">${tags(creator.creatorTypes, 'tag--type')}</td>`;
    case 'ml-col-sprachen':
      return `<td class="${col.key}">${tags(creator.sprachen, 'tag--lang')}</td>`;
    case 'ml-col-mail':
      return `<td class="${col.key}">${escapeHtml(creator.mail || '-')}</td>`;
    case 'ml-col-telefon':
      return `<td class="${col.key}">${escapeHtml(creator.telefonnummer || '-')}</td>`;
    case 'ml-col-actions':
      return `<td class="col-actions ${col.key}">${rowMenu(creator.id, listId)}</td>`;
    default:
      return `<td class="${col.key}">-</td>`;
  }
}

export function renderMasterlisteHead(columns, customAt) {
  return columns.map(col => {
    const extra = customAt ? customAt(col.key, 'header') : '';
    return `<th class="${col.key}">${escapeHtml(col.label === 'Reihenfolge' ? '' : col.label)}</th>${extra}`;
  }).join('');
}

export function renderMasterlisteRow(member, columns, listId, customAt) {
  const cells = columns.map(col => {
    const extra = customAt ? customAt(col.key, 'cell', member.memberId) : '';
    return `${cell(col, member, listId)}${extra}`;
  }).join('');
  return `<tr data-member-id="${escapeHtml(member.memberId)}" data-creator-id="${escapeHtml(member.creator.id)}">${cells}</tr>`;
}
