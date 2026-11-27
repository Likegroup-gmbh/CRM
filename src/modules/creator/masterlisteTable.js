// Zeilen der Masterliste. Dieselbe Tabelle wie die Casting-Liste:
// Profil nur lesbar, Instagram und TikTok als gestapelte Plattformzeilen.

import { icon } from '../../core/icons/IconSystem.js';
import { formatCompactNumber, formatExactNumber } from '../../core/format/compactNumber.js';
import { renderTableIdentity } from '../../core/format/tableIdentity.js';
import { engagementDesEintrags, formatEngagement } from '../creator-auswahl/castingEngagement.js';
import { INSTAGRAM_ICON, MAIL_ICON, TIKTOK_ICON } from '../creator-auswahl/sourcingIcons.js';
import {
  displayHandle,
  escapeHtml,
  socialUrl
} from './masterliste.js';

const PLATTFORM = {
  instagram: { icon: INSTAGRAM_ICON, name: 'Instagram' },
  tiktok: { icon: TIKTOK_ICON, name: 'TikTok' }
};

const GRUPPEN = [
  { id: 'link', keys: ['ml-col-ig', 'ml-col-tt'], label: 'Link', cp: 'cp-col-link' },
  { id: 'follower', keys: ['ml-col-follower-ig', 'ml-col-follower-tt'], label: 'Follower', cp: 'cp-col-follower' }
];

const KOPF = {
  'ml-col-engagement': 'Engagement',
  'ml-col-ort': 'Location'
};

function anzeige(columns) {
  const keys = new Set(columns.map(col => col.key));
  const gesehen = new Set();
  const zeilen = [];
  for (const col of columns) {
    const gruppe = GRUPPEN.find(item => item.keys.includes(col.key));
    if (!gruppe) {
      zeilen.push({ type: 'spalte', col });
      continue;
    }
    if (gesehen.has(gruppe.id)) continue;
    gesehen.add(gruppe.id);
    const sichtbar = gruppe.keys.filter(key => keys.has(key));
    zeilen.push({ type: 'gruppe', ...gruppe, sichtbar, label: gruppenLabel(gruppe, sichtbar) });
  }
  return zeilen;
}

function gruppenLabel(gruppe, sichtbar) {
  if (sichtbar.length !== 1) return gruppe.label;
  if (gruppe.id === 'link') return sichtbar[0] === 'ml-col-ig' ? 'Instagram' : 'TikTok';
  return sichtbar[0] === 'ml-col-follower-ig' ? 'Follower Instagram' : 'Follower TikTok';
}

function beidePlattformen(columns) {
  const keys = new Set(columns.map(col => col.key));
  return keys.has('ml-col-tt') || keys.has('ml-col-follower-tt');
}

function nameSticky(columns) {
  return columns.some(col => col.key === 'ml-col-drag') ? 'col-sticky-2' : 'col-sticky-1';
}

function plattformZelle(spalte, zeilen, { mitIcon = true } = {}) {
  const html = zeilen.map(({ plattform, inhalt }) => {
    if (inhalt == null) {
      return `<div class="plattform-zeile plattform-zeile--leer" data-plattform="${plattform}" aria-hidden="true"></div>`;
    }
    const { icon: marke, name } = PLATTFORM[plattform];
    const iconHtml = mitIcon
      ? `<span class="plattform-zeile__icon" title="${name}" role="img" aria-label="${name}">${marke}</span>`
      : '';
    return `<div class="plattform-zeile" data-plattform="${plattform}">${iconHtml}<div class="plattform-zeile__inhalt">${inhalt}</div></div>`;
  }).join('');
  return `<td class="plattform-zelle ${spalte}"><div class="plattform-zeilen">${html}</div></td>`;
}

function linkInhalt(platform, handle) {
  if (!handle) return '<span class="cell-text-readonly">-</span>';
  const label = displayHandle(handle);
  const marke = platform === 'tiktok' ? TIKTOK_ICON : INSTAGRAM_ICON;
  const name = platform === 'tiktok' ? 'TikTok' : 'Instagram';
  return `<div class="links-compact-cell links-compact-cell--readonly"><a href="${escapeHtml(socialUrl(platform, handle))}" target="_blank" rel="noopener noreferrer" class="link-icon-btn" title="${escapeHtml(label)}" aria-label="${name}">${marke}</a></div>`;
}

function followerInhalt(value) {
  const compact = formatCompactNumber(value);
  const exact = formatExactNumber(value);
  return `<div class="cell-number__static" title="${escapeHtml(exact)}">${escapeHtml(compact || '-')}</div>`;
}

function tags(names, tagClass) {
  if (!names?.length) return '<div class="cell-text-readonly">-</div>';
  return `<div class="tags tags-compact">${names.map(name =>
    `<span class="tag ${tagClass}">${escapeHtml(name)}</span>`
  ).join('')}</div>`;
}

function nameCell(member) {
  const creator = member.creator;
  const dot = member.hatDatensatz
    ? '<span class="status-dot status-dot--active sourcing-avatar__dot" title="Als Creator angelegt"></span>'
    : '<span class="status-dot status-dot--inactive sourcing-avatar__dot" title="Noch kein Creator"></span>';
  const nameHtml = member.hatDatensatz
    ? `<a href="#" class="table-link" data-table="creator" data-id="${escapeHtml(creator.id)}">${escapeHtml(creator.name)}</a>`
    : `<span class="table-text">${escapeHtml(creator.name)}</span>`;
  return renderTableIdentity({
    url: creator.profilbild_thumb_url || creator.profilbild_url,
    name: creator.vorname || creator.name,
    nameHtml: `<div class="cell-text-readonly">${nameHtml}</div>`,
    badgeHtml: dot
  });
}

function engagementInhalt(creator) {
  const { rate, clean, showClean } = engagementDesEintrags({ creator });
  const text = formatEngagement(rate);
  const zweit = showClean
    ? `<div class="cpm-auto-reach cpm-auto-reach--clean">${escapeHtml(formatEngagement(clean))} ohne Trials</div>`
    : '';
  return `<div class="cell-text-readonly cpm-auto-value"><div>${escapeHtml(text || '-')}</div>${zweit}</div>`;
}

function ort(creator) {
  const text = [creator.lieferadresse_stadt, creator.lieferadresse_land].filter(Boolean).join(', ');
  return `<div class="cell-text-readonly">${escapeHtml(text || '-')}</div>`;
}

function mailCell(mail) {
  if (!mail) return '<span class="cell-text-readonly">-</span>';
  const safe = escapeHtml(mail);
  return `<a href="mailto:${safe}" class="link-icon-btn" title="${safe}" aria-label="E-Mail">${MAIL_ICON}</a>`;
}

function kopfKlasse(col, columns) {
  if (col.key === 'ml-col-drag') return 'col-drag col-sticky-1 cp-col-drag';
  if (col.key === 'ml-col-name') return `cell-textarea cp-col-name ${nameSticky(columns)}`;
  if (col.key === 'ml-col-actions') return 'col-actions ml-col-actions cp-col-actions';
  if (col.key === 'ml-col-ort') return 'cp-col-location ml-col-ort';
  if (col.key === 'ml-col-engagement') return 'cp-col-engagement-ig ml-col-engagement';
  if (col.key === 'ml-col-mail') return 'cp-col-mail ml-col-mail';
  if (col.key === 'ml-col-telefon') return 'cp-col-telefon ml-col-telefon';
  return col.key;
}

function rowMenu(member, listId) {
  const memberId = escapeHtml(member.memberId);
  const creatorId = escapeHtml(member.creator.id);
  const eintraege = member.hatDatensatz
    ? `
        <a href="#" class="action-item" data-action="view" data-id="${creatorId}">${icon('eye')}Profil ansehen</a>
        <a href="#" class="action-item" data-action="edit" data-id="${creatorId}" data-return-to="/creator-lists/${escapeHtml(listId)}">${icon('pencil-square')}Bearbeiten</a>`
    : `
        <a href="#" class="action-item" data-action="masterliste-creator-anlegen" data-member-id="${memberId}">${icon('user-plus')}Creator anlegen</a>
        ${member.sourcingCreatorId || !member.igUsername ? '' : `<a href="#" class="action-item" data-action="masterliste-instagram-laden" data-member-id="${memberId}">${icon('refresh')}Instagram neu laden</a>`}`;
  return `
    <div class="actions-dropdown-container" data-entity-type="creator">
      <button type="button" class="actions-toggle" aria-expanded="false" aria-label="Aktionen">
        ${icon('dots-grid', { className: 'w-5 h-5' })}
      </button>
      <div class="actions-dropdown">${eintraege}
        <div class="action-separator"></div>
        <a href="#" class="action-item action-danger" data-action="remove-masterliste-member" data-member-id="${memberId}">${icon('trash')}Von der Liste nehmen</a>
      </div>
    </div>
  `;
}

function gruppenZelle(item, member) {
  const creator = member.creator;
  if (item.id === 'link') {
    const zeilen = [];
    if (item.sichtbar.includes('ml-col-ig')) zeilen.push({ plattform: 'instagram', inhalt: linkInhalt('instagram', creator.instagram) });
    if (item.sichtbar.includes('ml-col-tt')) zeilen.push({ plattform: 'tiktok', inhalt: linkInhalt('tiktok', creator.tiktok) });
    return plattformZelle(item.cp, zeilen, { mitIcon: false });
  }
  const zeilen = [];
  if (item.sichtbar.includes('ml-col-follower-ig')) zeilen.push({ plattform: 'instagram', inhalt: followerInhalt(creator.instagram_follower) });
  if (item.sichtbar.includes('ml-col-follower-tt')) zeilen.push({ plattform: 'tiktok', inhalt: followerInhalt(creator.tiktok_follower) });
  return plattformZelle(item.cp, zeilen);
}

function cell(col, member, listId, columns) {
  const creator = member.creator;
  switch (col.key) {
    case 'ml-col-drag':
      return `<td class="${kopfKlasse(col, columns)} drag-handle" title="Reihenfolge ändern"><span class="drag-cell-content" aria-hidden="true">${icon('bars-3')}</span></td>`;
    case 'ml-col-name':
      return `<td class="${kopfKlasse(col, columns)}">${nameCell(member)}</td>`;
    case 'ml-col-engagement': {
      const zeilen = [{ plattform: 'instagram', inhalt: engagementInhalt(creator) }];
      if (beidePlattformen(columns)) zeilen.push({ plattform: 'tiktok', inhalt: null });
      return plattformZelle('cp-col-engagement-ig ml-col-engagement', zeilen);
    }
    case 'ml-col-ort':
      return `<td class="cell-textarea ${kopfKlasse(col, columns)}">${ort(creator)}</td>`;
    case 'ml-col-branchen':
      return `<td class="${col.key}">${tags(creator.branchen, 'tag--branche')}</td>`;
    case 'ml-col-art':
      return `<td class="${col.key}">${tags(creator.creatorTypes, 'tag--type')}</td>`;
    case 'ml-col-sprachen':
      return `<td class="${col.key}">${tags(creator.sprachen, 'tag--lang')}</td>`;
    case 'ml-col-mail':
      return `<td class="cell-textarea ${kopfKlasse(col, columns)} cell-icon-only">${mailCell(creator.mail)}</td>`;
    case 'ml-col-telefon':
      return `<td class="cell-textarea ${kopfKlasse(col, columns)}"><div class="cell-text-readonly">${escapeHtml(creator.telefonnummer || '-')}</div></td>`;
    case 'ml-col-actions':
      return `<td class="${kopfKlasse(col, columns)}">${rowMenu(member, listId)}</td>`;
    default:
      return `<td class="${col.key}">-</td>`;
  }
}

function extras(customAt, keys, kind, memberId) {
  if (!customAt) return '';
  return keys.map(key => customAt(key, kind, memberId) || '').join('');
}

export function renderMasterlisteHead(columns, customAt) {
  return anzeige(columns).map(item => {
    if (item.type === 'gruppe') {
      return `<th class="${item.cp}">${item.label}</th>${extras(customAt, item.sichtbar, 'header')}`;
    }
    const col = item.col;
    const label = col.key === 'ml-col-drag' ? '' : escapeHtml(KOPF[col.key] || col.label);
    const marker = col.key === 'ml-col-actions' ? ' data-col="ml-col-actions"' : '';
    return `<th class="${kopfKlasse(col, columns)}"${marker}>${label}</th>${extras(customAt, [col.key], 'header')}`;
  }).join('');
}

export function renderMasterlisteRow(member, columns, listId, customAt) {
  const cells = anzeige(columns).map(item => {
    if (item.type === 'gruppe') {
      return `${gruppenZelle(item, member)}${extras(customAt, item.sichtbar, 'cell', member.memberId)}`;
    }
    return `${cell(item.col, member, listId, columns)}${extras(customAt, [item.col.key], 'cell', member.memberId)}`;
  }).join('');
  const creatorAttr = member.creator.id ? ` data-creator-id="${escapeHtml(member.creator.id)}"` : '';
  return `<tr class="item-row" data-member-id="${escapeHtml(member.memberId)}"${creatorAttr}>${cells}</tr>`;
}
