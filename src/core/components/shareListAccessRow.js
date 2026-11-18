// HTML einer Zugangszeile im Teilen-Drawer: Avatar, Name, Meta, Rechte, Link, Menü und frischer Code.

import { escapeHtml } from '../format.js';
import { icon } from '../icons/IconSystem.js';
import { renderTableSelect } from './TableSelect.js';

export const ROW_RECHTE_FIELD = 'share-row-rechte';

export function gastLink(token, origin) {
  return `${origin}/share/${token}`;
}

export function initialen(label) {
  const woerter = String(label || '').trim().split(/[\s._-]+/).filter((wort) => /^\p{L}/u.test(wort));
  if (!woerter.length) return '?';
  const zeichen = woerter.length > 1 ? woerter[0][0] + woerter[1][0] : woerter[0][0];
  return zeichen.toLocaleUpperCase('de-DE');
}

function datum(iso) {
  return new Date(iso).toLocaleDateString('de-DE');
}

export function zugangsMeta(share) {
  const teile = [
    share.last_access_at ? `Zuletzt ${datum(share.last_access_at)}` : 'Noch nicht geöffnet',
    share.expires_at
      ? `Bis ${datum(share.expires_at)}`
      : (share.ends_with_kampagne ? 'Endet mit Kampagne' : 'Ohne Ablauf'),
  ];
  const namen = (share.share_participants || []).map((p) => p.name).filter(Boolean);
  if (namen.length) teile.push(namen.join(', '));
  return teile.join(' · ');
}

/** Text zum Weiterleiten (Mail, Chat): Listenname, Gast-Link und Code. */
export function einladungsText({ entityName, link, code }) {
  return [entityName, `Link: ${link}`, `Code: ${code}`].filter(Boolean).join('\n');
}

export function codeBlockHtml(code, text) {
  return `
    <div class="share-access-code">
      <div class="share-access-code-kopf">
        <span class="share-code-value">${escapeHtml(code)}</span>
        <span class="share-access-code-hinweis">Code nur jetzt sichtbar</span>
      </div>
      <div class="share-access-code-aktionen">
        <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm" data-copy="${escapeHtml(text)}">
          ${icon('document-duplicate')}<span data-copy-label>Link + Code kopieren</span>
        </button>
        <button type="button" class="share-inline-btn" data-copy="${escapeHtml(code)}"><span data-copy-label>Code kopieren</span></button>
      </div>
    </div>`;
}

function menueHtml(id) {
  const eintrag = (action, iconName, label, danger = false) => `
    <a href="#" class="action-item${danger ? ' action-danger' : ''}" data-action="${action}" data-id="${id}">
      ${icon(iconName)}${label}
    </a>`;
  return `
    <div class="actions-dropdown-container" data-entity-type="list_share">
      <button type="button" class="actions-toggle" aria-expanded="false" aria-label="Weitere Aktionen" title="Weitere Aktionen">
        ${icon('dots-vertical-filled')}
      </button>
      <div class="actions-dropdown">
        ${eintrag('share-mail', 'envelope', 'Per Mail senden')}
        ${eintrag('share-rotate', 'refresh', 'Neuen Code erzeugen')}
        <div class="action-separator"></div>
        ${eintrag('share-revoke', 'trash', 'Widerrufen', true)}
      </div>
    </div>`;
}

/**
 * Eine Zeile. `code` nur, solange der Klartext in dieser Sitzung bekannt ist.
 * `rechteOptionen`: [[value, label]].
 */
export function accessRowHtml(share, { code = '', origin, entityName = '', rechteOptionen, neu = false }) {
  const label = share.label || 'Zugang';
  const meta = zugangsMeta(share);
  const link = gastLink(share.token, origin);
  return `
    <div class="share-access-row${neu ? ' is-neu' : ''}" data-share-id="${escapeHtml(share.id)}">
      <div class="share-access-main">
        <span class="share-recipient-avatar" aria-hidden="true">${escapeHtml(initialen(label))}</span>
        <div class="share-recipient-info">
          <span class="share-recipient-email" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
          <span class="share-recipient-meta" title="${escapeHtml(meta)}">${escapeHtml(meta)}</span>
        </div>
        <div class="share-access-actions">
          <div class="share-access-rechte">
            ${renderTableSelect({
              field: ROW_RECHTE_FIELD,
              itemId: share.id,
              value: share.rechte,
              options: rechteOptionen.map(([value, text]) => ({ value, label: text })),
              input: ROW_RECHTE_FIELD,
            })}
          </div>
          <button type="button" class="share-icon-btn" data-copy-link="${escapeHtml(link)}"
                  title="Gast-Link kopieren" aria-label="Gast-Link kopieren">${icon('link')}</button>
          ${menueHtml(escapeHtml(share.id))}
        </div>
      </div>
      <div class="share-access-code-slot">${code ? codeBlockHtml(code, einladungsText({ entityName, link, code })) : ''}</div>
      <div class="share-row-mail" data-row-mail="${escapeHtml(share.id)}" hidden></div>
    </div>`;
}
