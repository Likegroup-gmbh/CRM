// videoBrowserRenderParts.js
// Gemeinsame HTML-Bausteine des Videos-Tabs: Badges, Zeilen-Buttons, Spaltengerüst, Pfadleiste.

import { icon } from '../../core/icons/IconSystem.js';
import { escapeHtml as esc } from '../../core/format.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { collectDownloadItems, kooperationTitel, plural, schleifeName, wartetText } from './videoBrowserLogic.js';

export const FOLDER_ICON = { raw: 'folder', schleife: 'chat-bubble-left-ellipsis', final: 'check' };
export const ITEM_ICON = { video: 'film', story: 'phone-mobile', still: 'photo', roh: 'document' };

export const ratioCss = (ratio) => String(ratio || '9:16').replace(':', ' / ');

export function statusBadge(status) {
  if (!status) return '';
  return `<span class="status-badge ${esc(status.tone)} vb-status" data-status="${esc(status.key)}">${esc(status.label)}</span>`;
}

/** Was der Zähler zählt: Dateien der aktuellen Feedbackschleifen, die auf den Kunden warten. */
const zaehlerLabel = (team) => (team ? 'beim Kunden' : 'zu prüfen');
export const zaehlerText = (n, team) => `${plural(n, 'Datei', 'Dateien')} ${zaehlerLabel(team)}`;

export function countBadge(key, n, team) {
  if (!n) return '';
  return `<span class="vb-count" data-badge-key="${esc(key)}" title="${esc(zaehlerText(n, team))}">${n}<span class="vb-visually-hidden"> ${esc(zaehlerLabel(team))}</span></span>`;
}

/** Überschrift einer Video-Zeile: der Konzeptname, wenn es einen gibt. Die Video-Nr bleibt als Meta. */
export function rowTitles(r) {
  return r.title
    ? { title: r.title, meta: r.label }
    : { title: r.label, meta: 'Ohne Titel' };
}

export function avatar(koop) {
  if (koop.avatarUrl) {
    const url = window.validatorSystem?.sanitizeUrl?.(koop.avatarUrl) ?? koop.avatarUrl;
    if (url) return `<img class="vb-avatar" src="${esc(url)}" alt="" loading="lazy" />`;
  }
  return `<span class="vb-avatar vb-avatar--initial" aria-hidden="true">${esc((koop.name || '?').trim().charAt(0).toUpperCase())}</span>`;
}

export const empty = (text) => `<p class="vb-empty">${esc(text)}</p>`;

/** Eine Zeile dazu, wie es mit dieser Feedbackschleife steht (aus dem Status abgeleitet). */
export function schleifenText(ctx, folder) {
  switch (folder.status?.key) {
    case 'wartet':
      return ctx.team ? wartetText(folder.since) : 'Bitte prüfe die Dateien und hinterlasse dein Feedback.';
    case 'aenderungen':
      return `Änderungen angefordert. Die Überarbeitung steht in ${schleifeName(folder.number + 1)}.`;
    case 'freigegeben':
      return 'Diese Feedbackschleife wurde freigegeben.';
    default:
      return '';
  }
}

/* ------------------------------------------------------------------ */
/* Pfadleiste                                                          */
/* ------------------------------------------------------------------ */

export function pfadSegmente(ctx) {
  const { koop, row, folder, item } = ctx.resolved;
  const segments = [{ label: 'Alle Kooperationen', keep: 0 }];
  if (koop) segments.push({ label: kooperationTitel(koop, { zeigeLinie: ctx.zeigeLinie, kooperationen: ctx.tree?.kooperationen }), keep: 1 });
  if (row) segments.push({ label: row.label, keep: 2 });
  if (folder) segments.push({ label: folder.name, keep: 3 });
  if (item) segments.push({ label: item.name, keep: 4 });
  return segments;
}

export function renderPath(ctx) {
  const segments = pfadSegmente(ctx);
  const html = segments.map((s, i) => {
    const last = i === segments.length - 1;
    const body = last
      ? `<span class="vb-path__current" aria-current="location">${esc(s.label)}</span>`
      : `<button type="button" class="vb-path__link" data-path-keep="${s.keep}">${esc(s.label)}</button>`;
    return `<li class="vb-path__item">${body}</li>`;
  }).join('');
  return `<ol class="vb-path__list">${html}</ol>`;
}

/* ------------------------------------------------------------------ */
/* Zeilen und Spaltengerüst                                            */
/* ------------------------------------------------------------------ */

/** Statuspunkt plus Text in der Meta-Zeile: so bleibt der Titel auch in schmalen Spalten lesbar. */
function metaHtml(meta, status) {
  if (!status) return `<span class="vb-row__meta">${esc(meta)}</span>`;
  return `<span class="vb-row__meta"><span class="vb-dot vb-dot--${esc(status.key)}" aria-hidden="true"></span>${esc(status.label)}${meta ? ` · ${esc(meta)}` : ''}</span>`;
}

/**
 * `liAttrs`: Attribute am Listeneintrag (z. B. data-folder-id als Flugziel), `after`: HTML hinter dem
 * Button im selben Eintrag (Schnell-Stern, ein Button darf keinen Button enthalten).
 */
export function rowButton({ depth, id, selected, active, lead, title, titleExtra = '', meta = '', status = null, badge = '', chevron = false, label = '', extraClass = '', liAttrs = '', after = '' }) {
  const cls = ['vb-row', extraClass, selected ? (active ? 'is-selected is-active' : 'is-selected') : '', after ? 'has-star' : '']
    .filter(Boolean).join(' ');
  return `
    <li${after ? ' class="vb-rowwrap"' : ''}${liAttrs ? ` ${liAttrs}` : ''}>
      <button type="button" class="${cls}" data-depth="${depth}" data-id="${esc(id)}" title="${esc(title)}"${selected ? ' aria-current="true"' : ''}${label ? ` aria-label="${esc(label)}"` : ''}>
        <span class="vb-row__lead">${lead}</span>
        <span class="vb-row__text">
          <span class="vb-row__title"><span class="vb-row__name">${esc(title)}</span>${titleExtra}</span>
          ${metaHtml(meta, status)}
        </span>
        ${badge}
        ${chevron ? `<span class="vb-row__chevron" aria-hidden="true">${icon('chevron-right')}</span>` : ''}
      </button>${after}
    </li>`;
}

export const rowList = (html) => `<ul class="vb-rows">${html}</ul>`;

/**
 * Filter-Chips (Inhalte-Spalte und Showcase). `active` ist eine Chip-Id oder eine Liste davon.
 * Einträge mit `kind: 'sep'` werden zum Trenner. `attr` ist das data-Attribut, an dem der Klick erkannt wird.
 * @param {Array<{ id?: string, label?: string, kind?: string }>} chips
 */
export function filterChipsHtml(chips, active, { attr = 'data-vb-filter', label = 'Filter' } = {}) {
  if (!chips.length) return '';
  const on = (id) => (Array.isArray(active) ? active.includes(id) : active === id);
  const html = chips.map((c) => {
    if (c.kind === 'sep') return '<span class="vb-filter__sep" aria-hidden="true"></span>';
    return `<button type="button" class="vb-filter__chip${on(c.id) ? ' is-active' : ''}${c.kind === 'final' ? ' vb-filter__chip--final' : ''}" ${attr}="${esc(c.id)}" aria-pressed="${on(c.id)}">${c.kind === 'final' ? icon('star') : ''}<span>${esc(c.label)}</span></button>`;
  }).join('');
  return `
      <div class="vb-filter" data-vb-filter-bar role="group" aria-label="${esc(label)}">
        ${html}
      </div>`;
}

/** Leerer Zustand eines Filters mit Link zum Aufheben (`clearAttr` erkennt den Klick). */
export function filterEmptyHtml(clearAttr = 'data-vb-filter-clear') {
  return `<div class="vb-empty vb-empty--filter"><p>Keine Inhalte mit diesem Filter.</p><button type="button" class="mdc-btn mdc-btn--secondary" ${clearAttr}>Filter aufheben</button></div>`;
}

/**
 * Umschalter als Radiogruppe: das vorhandene ViewModeToggle (Liste/Grid/Kalender-Optik) mit gleitendem
 * Indikator hinter dem aktiven Button. Der Indikator ist `[data-vb-tab-indicator]`, das gewählte Element
 * `aria-checked`, siehe motion.tabIndicator.
 * @param {{ id: string, label?: string, options: Array<{ value: string, label: string, icon?: string }>, value: string }} cfg
 */
export function segmentHtml({ id, label = '', options, value }) {
  const labelId = `vb-seg-${id}`;
  const group = ViewModeToggle.render(
    options.map(o => ({
      label: esc(o.label),
      icon: o.icon,
      active: o.value === value,
      attrs: `type="button" role="radio" data-vb-seg-opt data-value="${esc(o.value)}" aria-checked="${o.value === value}" tabindex="${o.value === value ? 0 : -1}"`
    })),
    {
      className: 'vb-glide view-toggle--sm',
      groupAttrs: `role="radiogroup" data-vb-seg="${esc(id)}" ${label ? `aria-labelledby="${labelId}"` : `aria-label="${esc(id)}"`}`,
      extraHtml: '<span class="vb-glide__thumb" data-vb-tab-indicator aria-hidden="true"></span>'
    }
  );
  if (!label) return group;
  return `<div class="vb-seg-field"><span class="vb-seg-field__label" id="${labelId}">${esc(label)}</span>${group}</div>`;
}

export function colShell({ depth, title, sub, activeDepth, bodyHtml, footHtml = '', headExtra = '', toolbarHtml = '', zurueck = false }) {
  return `
    <section class="vb-col vb-col--${depth}${depth === activeDepth ? ' is-active-col' : ''}" data-depth="${depth}" aria-labelledby="vb-col-title-${depth}">
      <header class="vb-col__head">
        ${zurueck ? `<button type="button" class="vb-col__back" data-vb-back aria-label="Zurück">${icon('arrow-left')}</button>` : ''}
        <hgroup class="vb-col__titles">
          <h3 class="vb-col__title" id="vb-col-title-${depth}">${esc(title)}</h3>
          <p class="vb-col__sub">${esc(sub)}</p>
        </hgroup>
        ${headExtra}
      </header>
      ${toolbarHtml}
      <div class="vb-col__body" data-vb-body>${bodyHtml}</div>
      ${footHtml ? `<footer class="vb-col__foot">${footHtml}</footer>` : ''}
    </section>`;
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

/** Download-Button je Umfang (item | folder | koop). Leer, wenn nichts herunterladbar ist. */
export function downloadButton(ctx, scope, label, { primary = false } = {}) {
  if (!ctx.canDownload) return '';
  const count = collectDownloadItems(scope, ctx.resolved).length;
  if (!count) return '';
  const text = count > 1 ? `${label} (${count})` : label;
  return `<button type="button" class="mdc-btn${primary ? '' : ' mdc-btn--secondary'} vb-download" data-vb-download="${scope}">${icon('download')}<span>${esc(text)}</span></button>`;
}

export function iconButton(name, label, attrs, extraClass = '') {
  return `<button type="button" class="vb-icon-btn${extraClass}" ${attrs} aria-label="${esc(label)}" title="${esc(label)}">${icon(name)}</button>`;
}

/** Bearbeiten-Knopf zwischen Stift (bearbeiten) und Haken (speichern) umschalten, z. B. beim Umbenennen. */
export function setEditButton(button, editing, { edit, save }) {
  if (!button) return;
  const label = editing ? save : edit;
  button.innerHTML = icon(editing ? 'check' : 'pencil-square');
  button.setAttribute('aria-label', label);
  button.title = label;
  button.classList.toggle('is-active', editing);
}
