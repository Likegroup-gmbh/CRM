// videoBrowserRenderShowcase.js
// HTML der Showcase-Ansicht: Ansicht-Umschalter, Leiste, Chips, Abschnitte und Kacheln.
// Reine Funktionen (Zustand rein, String raus). Optik aus video-browser.css, die Bausteine
// (Segment, Chips, Avatar, Tag-Pill, Buttons) sind dieselben wie im Spaltenbrowser.

import { icon } from '../../core/icons/IconSystem.js';
import { escapeHtml as esc } from '../../core/format.js';
import {
  SHOWCASE_GROUPS,
  SHOWCASE_INHALT,
  SHOWCASE_RATIO,
  SHOWCASE_SIZES,
  activeChipIds,
  isAusstehend,
  showcaseStatusOptions
} from './videoBrowserShowcaseLogic.js';
import { formatDatum } from './videoBrowserFormat.js';
import { fristAriaLabel, fristTagHtml } from './videoBrowserDeadline.js';
import { STATUS_LABELS, STATUS_TAG_VARIANT } from '../skripte/SkripteUtils.js';
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
  { value: 'showcase', label: 'Showcase', icon: 'showcase' },
  { value: 'ordner', label: 'Ordner', icon: 'folder' },
  { value: 'kalender', label: 'Kalender', icon: 'calendar' }
];

/** Umschalter "Showcase | Ordner | Kalender" für die Workflow-Tab-Zeile (rechts, in `[data-workflow-liste-slot]`). */
export const viewSwitchHtml = (view) => segmentHtml({ id: 'view', options: VIEW_OPTIONS, value: view });

/** Ohne Tab-Zeile (z. B. Test-Umgebung): eigene Leiste über dem Spaltenbrowser, `before` steht vor dem Umschalter. */
export function toolbarHtml(view, before = '') {
  return `<div class="vb-toolbar" data-vb-toolbar>${before}${viewSwitchHtml(view)}</div>`;
}

/**
 * Die Umschalter der Leiste. Wird nur einmal gerendert, danach schalten sie sich selbst um; die Zähler
 * und die Sperre bei "Nur final" am Status setzt videoBrowserShowcase.js.
 */
export function controlsHtml(state, { team = true } = {}) {
  return [
    segmentHtml({ id: 'inhalt', label: 'Inhalt', options: SHOWCASE_INHALT, value: state.inhalt }),
    segmentHtml({ id: 'group', label: 'Gruppieren', options: SHOWCASE_GROUPS, value: state.group }),
    segmentHtml({ id: 'status', label: 'Status', options: showcaseStatusOptions(team), value: state.status }),
    segmentHtml({ id: 'size', label: 'Größe', options: SHOWCASE_SIZES, value: state.size })
  ].join('');
}

/** Gerüst des Showcase: sticky Leiste und Grid-Bereich. Inhalte füllen `renderShowcaseParts`. */
export function showcaseShellHtml(state, { canDownload, team = true }) {
  return `
    <div class="vb-showcase__scroll" data-vb-sc-scroll>
      <header class="vb-sc-bar" data-vb-sc-barwrap>
        <div class="vb-sc-bar__controls" data-vb-sc-controls>
          ${controlsHtml(state, { team })}
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

function mediaPlaceholder(item) {
  return `<span class="vb-sc-tile__ph" aria-hidden="true">${icon(ITEM_ICON[item.type] || 'document')}</span>`;
}

/** Aktueller Stand: Stern bei Finalen, Status bei allem anderen. */
function markHtml(item) {
  if (item.isFinal) return `<span class="vb-sc-tile__mark vb-sc-tile__mark--final" title="Finale Version">${icon('star')}</span>`;
  return item.status ? `<span class="vb-sc-tile__mark">${statusBadge(item.status)}</span>` : '';
}

/** Hat ein Creator mehrere Kooperationen, nennt die Kachel die Linie statt des Creators (der steht im Kopf). */
const herkunft = (koop, mehrere) => (mehrere ? koop.linieName || koop.kooperationName || koop.name : koop.name);

/** Skript-Status als Pill (Ausstehende Kachel und Details der Vollansicht). */
export function skriptStatusHtml(skript) {
  if (!skript?.status) return '';
  const variant = STATUS_TAG_VARIANT[skript.status] || 'tag--type';
  return `<span class="tag ${esc(variant)}">${esc(STATUS_LABELS[skript.status] || skript.status)}</span>`;
}

/** Hinweis auf einem Ausstehenden Video. Die Kundenseite sieht nur "In Produktion". */
export function ausstehendHinweis(item, team) {
  if (!team) return 'In Produktion';
  return item.hatRohmaterial ? 'Rohmaterial liegt vor' : 'Noch keine Datei';
}

/**
 * Kachel eines Ausstehenden Videos: Video-Nr, Titel, Hinweis, Posting-Datum, beim Team der
 * Skript-Status. Mit Upload-Recht ist sie Ablageziel, der Fortschritt läuft im Rahmen.
 */
export function ausstehendTileHtml({ koop, row, item }, index, { team, canUpload, mehrere }) {
  const datum = formatDatum(row.postingDatum);
  const skript = team ? skriptStatusHtml(row.links?.skript) : '';
  const frist = team ? fristTagHtml(row.contentDeadline) : '';
  const fristLabel = team ? fristAriaLabel(row.contentDeadline) : '';
  const sub = [herkunft(koop, mehrere), 'Ausstehend'].join(' · ');
  const aria = [row.label, 'ausstehend', fristLabel, koop.name].filter(Boolean).join(', ');
  return `
    <button type="button" class="vb-sc-tile vb-sc-tile--aus" data-vb-sc-tile data-index="${index}" data-flip-id="${esc(item.id)}" data-item-id="${esc(item.id)}" data-type="${esc(item.type)}"${canUpload ? ` data-vb-sc-aus data-vb-aus-upload="${esc(row.id)}" data-koop-id="${esc(koop.id)}"` : ''} aria-label="${esc(aria)}">
      <span class="vb-sc-tile__frame vb-sc-aus" style="aspect-ratio: ${ratioCss(SHOWCASE_RATIO)}" data-vb-sc-frame>
        <span class="vb-sc-aus__nr">${esc(row.label)}</span>
        <span class="vb-sc-aus__icon" aria-hidden="true">${icon(canUpload ? 'upload' : 'film')}</span>
        <span class="vb-sc-aus__hint">${esc(ausstehendHinweis(item, team))}</span>
        ${frist ? `<span class="vb-sc-aus__frist">${frist}</span>` : ''}
        ${datum ? `<span class="vb-sc-aus__date">${icon('calendar')}<span>${esc(datum)}</span></span>` : ''}
        ${skript ? `<span class="vb-sc-aus__skript">Skript ${skript}</span>` : ''}
        ${canUpload ? '<span class="vb-sc-aus__drop" aria-hidden="true">Datei hier ablegen</span><progress class="vb-sc-aus__progress" data-vb-aus-progress max="100" value="0" hidden></progress>' : ''}
      </span>
      <span class="vb-sc-tile__title">${esc(item.name)}</span>
      <span class="vb-sc-tile__sub">${esc(sub)}</span>
    </button>`;
}

/** Eine Kachel: Poster (lazy), Tags bei Hover/Fokus, Fortschrittsbalken nur bei Video und Story. */
export function tileHtml({ koop, row, item }, index, catalog, { marks = false, mehrere = false } = {}) {
  const tags = tagsOf(item, catalog).slice(0, 3).map(t => tagChipHtml(t)).join('');
  const timed = item.type !== 'still';
  const sub = [herkunft(koop, mehrere), row.label, timed ? item.ratio : null].filter(Boolean).join(' · ');
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
  const n = group.entries.filter(e => !isAusstehend(e.item)).length;
  const anteil = group.soll ? Math.round((group.hochgeladen / group.soll) * 100) : 0;
  return `
    <header class="vb-sc-group__head" data-vb-sc-grouphead>
      ${group.koop ? avatar(group.koop) : ''}
      <h4 class="vb-sc-group__name">${esc(group.label)}</h4>
      <span class="vb-sc-group__count">${n} ${n === 1 ? 'Inhalt' : 'Inhalte'}</span>
      ${group.soll ? `
        <span class="vb-sc-group__upload${group.hochgeladen >= group.soll ? ' is-complete' : ''}" data-vb-sc-upload-count style="--anteil: ${anteil}%">
          <span class="vb-sc-group__upload-bar" aria-hidden="true"></span>
          <span>${group.hochgeladen} von ${group.soll} hochgeladen</span>
        </span>` : ''}
    </header>`;
}

/**
 * Grid mit Abschnitten oder ein leerer Zustand.
 * @param {{ groups: Array, total: number, state: object }} sc Ergebnis von buildShowcase
 */
export function gridHtml(sc, { catalog, team, canUpload = false }) {
  if (!sc.total) {
    const text = sc.state.inhalt === 'aktuell'
      ? 'Noch keine Videos angelegt.'
      : team
        ? 'Noch keine Finalen Versionen. Markiere Dateien als final oder wechsle zu „Aktueller Stand“.'
        : 'Noch keine Finalen Versionen vorhanden.';
    return `<p class="vb-empty vb-sc-empty">${text}</p>`;
  }
  if (!sc.list.length) return filterEmptyHtml('data-vb-sc-filter-clear');
  let index = 0;
  const marks = sc.state.inhalt === 'aktuell';
  return sc.groups.map((group) => {
    const mehrere = !!group.mehrereKooperationen;
    const tiles = group.entries.map(entry => (isAusstehend(entry.item)
      ? ausstehendTileHtml(entry, index++, { team, canUpload, mehrere })
      : tileHtml(entry, index++, catalog, { marks, mehrere }))).join('');
    return `
    <section class="vb-sc-group" data-vb-sc-group="${esc(group.id)}">
      ${group.head ? groupHeadHtml(group) : ''}
      <div class="vb-sc-grid">${tiles}</div>
    </section>`;
  }).join('');
}
