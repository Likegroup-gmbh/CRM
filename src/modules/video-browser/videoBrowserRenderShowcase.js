// videoBrowserRenderShowcase.js
// HTML der Showcase-Ansicht: Ansicht-Umschalter, Leiste, Chips, Abschnitte und Kacheln.
// Reine Funktionen (Zustand rein, String raus). Optik aus video-browser.css, die Bausteine
// (Segment, Chips, Avatar, Tag-Pill, Buttons) sind dieselben wie im Spaltenbrowser.

import { icon } from '../../core/icons/IconSystem.js';
import { escapeHtml as esc } from '../../core/format.js';
import {
  SHOWCASE_GROUPS,
  SHOWCASE_INHALT,
  SHOWCASE_RATIOS,
  SHOWCASE_SIZES,
  activeChipIds,
  showcaseSummary
} from './videoBrowserShowcaseLogic.js';
import { tagChipHtml, tagsOf } from './videoBrowserRenderTags.js';
import {
  ITEM_ICON,
  avatar,
  filterChipsHtml,
  filterEmptyHtml,
  statusBadge,
  ratioCss,
  segmentHtml
} from './videoBrowserRenderParts.js';

export const VIEW_OPTIONS = [
  { value: 'ordner', label: 'Ordner', icon: 'folder' },
  { value: 'showcase', label: 'Showcase', icon: 'showcase' }
];

/** Umschalter "Ordner | Showcase" für die Workflow-Tab-Zeile (rechts, in `[data-workflow-liste-slot]`). */
export const viewSwitchHtml = (view) => segmentHtml({ id: 'view', options: VIEW_OPTIONS, value: view });

/** Ohne Tab-Zeile (z. B. Test-Umgebung): eigene Leiste über dem Spaltenbrowser. */
export function toolbarHtml(view) {
  return `<div class="vb-toolbar" data-vb-toolbar>${viewSwitchHtml(view)}</div>`;
}

/** Die drei Umschalter der Leiste. Wird nur einmal gerendert, danach schalten sie sich selbst um. */
export function controlsHtml(state) {
  return [
    segmentHtml({ id: 'inhalt', label: 'Inhalt', options: SHOWCASE_INHALT, value: state.inhalt }),
    segmentHtml({ id: 'group', label: 'Gruppieren', options: SHOWCASE_GROUPS, value: state.group }),
    segmentHtml({ id: 'fmt', label: 'Seitenverhältnis', options: SHOWCASE_RATIOS, value: state.fmt }),
    segmentHtml({ id: 'size', label: 'Größe', options: SHOWCASE_SIZES, value: state.size })
  ].join('');
}

/** Gerüst des Showcase: sticky Leiste und Grid-Bereich. Inhalte füllen `renderShowcaseParts`. */
export function showcaseShellHtml(state, { canDownload }) {
  return `
    <div class="vb-showcase__scroll" data-vb-sc-scroll>
      <header class="vb-sc-bar" data-vb-sc-barwrap>
        <div class="vb-sc-bar__controls" data-vb-sc-controls>
          ${controlsHtml(state)}
          <div class="vb-sc-bar__actions">
            <p class="vb-sc-bar__sub" data-vb-sc-summary aria-live="polite"></p>
            ${canDownload ? `<button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm vb-download" data-vb-sc-download>${icon('download')}<span>Alle herunterladen</span></button>` : ''}
          </div>
        </div>
        <div data-vb-sc-chips></div>
      </header>
      <div class="vb-sc-body" data-vb-sc-grid></div>
    </div>`;
}

export function chipsHtml(sc) {
  return filterChipsHtml(sc.chips, activeChipIds(sc.state), { attr: 'data-vb-sc-filter', label: 'Filter' });
}

export const summaryText = (sc) => showcaseSummary(sc.list);

function mediaPlaceholder(item) {
  return `<span class="vb-sc-tile__ph" aria-hidden="true">${icon(ITEM_ICON[item.type] || 'document')}</span>`;
}

/** Aktueller Stand: Stern bei Finalen, Status bei allem anderen. */
function markHtml(item) {
  if (item.isFinal) return `<span class="vb-sc-tile__mark vb-sc-tile__mark--final" title="Finale Version">${icon('star')}</span>`;
  return item.status ? `<span class="vb-sc-tile__mark">${statusBadge(item.status)}</span>` : '';
}

/** Eine Kachel: Poster (lazy), Tags bei Hover/Fokus, Fortschrittsbalken nur bei Video und Story. */
export function tileHtml({ koop, row, item }, index, catalog, { marks = false } = {}) {
  const tags = tagsOf(item, catalog).slice(0, 3).map(t => tagChipHtml(t)).join('');
  const timed = item.type !== 'still';
  const sub = [koop.name, row.label, timed ? item.ratio : null].filter(Boolean).join(' · ');
  return `
    <button type="button" class="vb-sc-tile" data-vb-sc-tile data-index="${index}" data-flip-id="${esc(item.id)}" data-item-id="${esc(item.id)}" data-type="${esc(item.type)}" aria-label="${esc(`${item.name}, ${koop.name}, ${row.label}`)}">
      <span class="vb-sc-tile__frame" style="aspect-ratio: ${ratioCss(item.ratio)}" data-vb-sc-frame>
        <span class="vb-sc-tile__media" data-vb-sc-media>${mediaPlaceholder(item)}</span>
        ${marks ? markHtml(item) : ''}
        ${tags ? `<span class="vb-sc-tile__tags">${tags}</span>` : ''}
        ${timed ? '<span class="vb-sc-tile__bar" data-vb-sc-progress aria-hidden="true"></span>' : ''}
      </span>
      <span class="vb-sc-tile__title">${esc(item.name)}</span>
      <span class="vb-sc-tile__sub">${esc(sub)}</span>
    </button>`;
}

function groupHeadHtml(group) {
  const lead = group.koop
    ? avatar(group.koop)
    : `<span class="vb-icon-slot" aria-hidden="true">${icon('tag')}</span>`;
  const n = group.entries.length;
  return `
    <header class="vb-sc-group__head" data-vb-sc-grouphead>
      ${lead}
      <h4 class="vb-sc-group__name">${esc(group.label)}</h4>
      <span class="vb-sc-group__count">${n} ${n === 1 ? 'Inhalt' : 'Inhalte'}</span>
    </header>`;
}

/**
 * Grid mit Abschnitten oder ein leerer Zustand.
 * @param {{ groups: Array, total: number, state: object }} sc Ergebnis von buildShowcase
 */
export function gridHtml(sc, { catalog, team }) {
  if (!sc.total) {
    const text = sc.state.inhalt === 'aktuell'
      ? 'Noch keine Inhalte vorhanden.'
      : team
        ? 'Noch keine Finalen Versionen. Markiere Dateien als final oder wechsle zu „Aktueller Stand“.'
        : 'Noch keine Finalen Versionen vorhanden.';
    return `<p class="vb-empty vb-sc-empty">${text}</p>`;
  }
  if (!sc.list.length) return filterEmptyHtml('data-vb-sc-filter-clear');
  let index = 0;
  return sc.groups.map(group => `
    <section class="vb-sc-group" data-vb-sc-group="${esc(group.id)}">
      ${group.head ? groupHeadHtml(group) : ''}
      <div class="vb-sc-grid">${group.entries.map(entry => tileHtml(entry, index++, catalog, { marks: sc.state.inhalt === 'aktuell' })).join('')}</div>
    </section>`).join('');
}
