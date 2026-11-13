// videoBrowserRenderRoh.js
// Rohmaterial in der Inhalte-Spalte (ADR 0070): Unterordner als einklappbare Köpfe (auch leere),
// darunter die Dateien der Wurzel. Team: Ordner anlegen, in einen Ordner hochladen, Dateien
// markieren und über die Leiste oder per Drag & Drop in eine Feedbackschleife verschieben.

import { icon } from '../../core/icons/IconSystem.js';
import { escapeHtml as esc } from '../../core/format.js';
import { plural } from './videoBrowserFormat.js';
import { iconButton, rowTitles } from './videoBrowserRenderParts.js';

// Server erlaubt 5 Ebenen unter Rohmaterial/: Unterordner nur bis Tiefe 3 (0-basiert) anlegen
const MAX_ELTERN_TIEFE = 3;
const ACCEPT = 'video/*,image/*,.zip';

export const rohKey = (koopId, pfad) => `${koopId}:${String(pfad || '').toLowerCase()}`;
const lower = (s) => String(s || '').toLowerCase();

/** Rohmaterial-Zustand des Controllers; fehlt er (Tests, Kunde), ist alles leer. */
function zustand(ctx) {
  const r = ctx.roh || {};
  return { zu: r.zu || new Set(), auswahl: r.auswahl || new Set(), neu: r.neu || null, menu: !!r.menu };
}

/** Checkbox an der Zeile (Team, nur verschiebbare Dateien). Liegt über dem Icon, sichtbar bei Hover oder Auswahl. */
export function rohCheckHtml(item, ctx) {
  if (!ctx.canUpload || !item.verschiebbar) return '';
  const on = zustand(ctx).auswahl.has(item.id);
  return `<label class="vb-rohcheck" title="Markieren"><input type="checkbox" data-vb-roh-check="${esc(item.id)}"${on ? ' checked' : ''} aria-label="Markieren: ${esc(item.name)}" /></label>`;
}

function neuFormHtml(parentPfad, tiefe) {
  return `
    <li class="vb-rohneu" style="--vb-roh-tiefe:${tiefe}">
      <form class="vb-rohneu__form" data-vb-roh-neu-form data-parent="${esc(parentPfad)}">
        <span class="vb-icon-slot">${icon('folder-add')}</span>
        <input type="text" class="vb-rohneu__input" data-vb-roh-neu-input maxlength="100" placeholder="Ordnername" aria-label="Name des neuen Ordners" autocomplete="off" />
        <button type="submit" class="vb-icon-btn" aria-label="Ordner anlegen" title="Ordner anlegen">${icon('check')}</button>
        <button type="button" class="vb-icon-btn" data-vb-roh-neu-abbrechen aria-label="Abbrechen" title="Abbrechen">${icon('x-mark')}</button>
      </form>
    </li>`;
}

function ordnerAktionen(ctx, o) {
  if (!ctx.canUpload || !o.itemId) return '';
  const unter = o.tiefe <= MAX_ELTERN_TIEFE
    ? iconButton('folder-add', 'Unterordner anlegen', `data-vb-roh-neu="${esc(o.pfad)}"`)
    : '';
  return `
        <span class="vb-rohgroup__actions">
          ${unter}
          <label class="vb-icon-btn" title="In „${esc(o.name)}“ hochladen" aria-label="In ${esc(o.name)} hochladen">${icon('upload')}<input type="file" data-vb-file data-ordner-item-id="${esc(o.itemId)}" multiple accept="${ACCEPT}" hidden /></label>
        </span>`;
}

/**
 * Inhalt der Spalte für den Rohmaterial-Ordner.
 * @param {object} ctx Render-Kontext
 * @param {{ visible: object[], itemRow: (item: object) => string }} opts
 * @returns {string} Listen-HTML oder '' (dann zeigt die Spalte den Leer-Text)
 */
export function rohInhalteHtml(ctx, { visible, itemRow }) {
  const { koop, folder } = ctx.resolved;
  const st = zustand(ctx);
  const unterordner = folder.unterordner || [];
  const byOrdner = new Map();
  for (const item of visible) {
    const k = lower(item.ordner);
    if (!byOrdner.has(k)) byOrdner.set(k, []);
    byOrdner.get(k).push(item);
  }
  const neuIn = (pfad, tiefe) => (st.neu && st.neu.koopId === koop.id && lower(st.neu.parent) === lower(pfad) ? neuFormHtml(pfad, tiefe) : '');
  const kinder = (pfad) => unterordner.filter(o => lower(o.eltern) === lower(pfad));

  const gruppe = (o) => {
    const offen = !st.zu.has(rohKey(koop.id, o.pfad));
    const dateien = byOrdner.get(lower(o.pfad)) || [];
    const innen = [neuIn(o.pfad, o.tiefe + 1), ...kinder(o.pfad).map(gruppe), ...dateien.map(itemRow)].join('');
    const meta = o.gesamt ? plural(o.gesamt, 'Datei', 'Dateien') : 'Leer';
    return `
    <li class="vb-rohgroup${offen ? '' : ' is-collapsed'}" data-vb-roh-ordner="${esc(o.pfad)}"${o.itemId ? ` data-item-id="${esc(o.itemId)}"` : ''} style="--vb-roh-tiefe:${o.tiefe}">
      <div class="vb-rohgroup__head">
        <button type="button" class="vb-row vb-rohgroup__toggle" data-vb-roh-toggle="${esc(o.pfad)}" aria-expanded="${offen}" title="${esc(o.name)}">
          <span class="vb-rohgroup__chevron" aria-hidden="true">${icon('chevron-down')}</span>
          <span class="vb-row__lead"><span class="vb-icon-slot">${icon('folder')}</span></span>
          <span class="vb-row__text">
            <span class="vb-row__title"><span class="vb-row__name">${esc(o.name)}</span></span>
            <span class="vb-row__meta">${esc(meta)}</span>
          </span>
        </button>${ordnerAktionen(ctx, o)}
      </div>
      <ul class="vb-rows vb-rohgroup__body"${offen ? '' : ' hidden'}>${innen || '<li class="vb-rohgroup__leer">Noch leer</li>'}</ul>
    </li>`;
  };

  const html = [neuIn('', 0), ...kinder('').map(gruppe), ...(byOrdner.get('') || []).map(itemRow)].join('');
  return html ? `<ul class="vb-rows vb-rohlist">${html}</ul>` : '';
}

/** Ziele im Menü: die Feedbackschleifen jedes Videos der Kooperation, das gewählte Video zuerst. */
export function rohZiele(koop, videoId) {
  const rows = [...(koop?.rows || [])].sort((a, b) => (a.id === videoId ? -1 : b.id === videoId ? 1 : 0));
  return rows
    .map(row => ({ row, schleifen: row.folders.filter(f => f.kind === 'schleife') }))
    .filter(z => z.schleifen.length);
}

function zielMenuHtml(ctx) {
  const ziele = rohZiele(ctx.resolved.koop, ctx.sel.videoId);
  if (!ziele.length) return '<p class="vb-rohmenu__leer">Kein Video mit offener Feedbackschleife.</p>';
  return ziele.map(({ row, schleifen }) => `
      <div class="vb-rohmenu__video" role="group" aria-label="${esc(rowTitles(row).title)}">
        <p class="vb-rohmenu__label">${esc(row.label)}${row.title ? ` · ${esc(row.title)}` : ''}</p>
        ${schleifen.map(f => `<button type="button" class="vb-rohmenu__ziel" role="menuitem" data-vb-roh-ziel="${esc(row.id)}" data-version="${f.number}">
          <span>${esc(f.name)}</span><span class="vb-rohmenu__meta">${esc(f.meta || '')}</span>
        </button>`).join('')}
      </div>`).join('');
}

/** Leiste über der Liste: "Neuer Ordner", bei markierten Dateien Anzahl, Verschieben und Aufheben. */
export function rohToolbarHtml(ctx) {
  const { folder } = ctx.resolved;
  if (!ctx.canUpload) return '';
  const st = zustand(ctx);
  const markiert = folder.items.filter(i => st.auswahl.has(i.id)).length;
  if (markiert) {
    return `
      <div class="vb-rohbar is-auswahl" data-vb-rohbar>
        <span class="vb-rohbar__count">${esc(`${markiert} markiert`)}</span>
        <button type="button" class="mdc-btn mdc-btn--secondary vb-rohbar__btn" data-vb-roh-menu aria-haspopup="menu" aria-expanded="${st.menu}">${icon('arrow-right')}<span>In Feedbackschleife</span></button>
        ${iconButton('x-mark', 'Markierung aufheben', 'data-vb-roh-clear')}
      </div>
      ${st.menu ? `<div class="vb-rohmenu" role="menu" data-vb-roh-menu-list aria-label="Ziel wählen">${zielMenuHtml(ctx)}</div>` : ''}`;
  }
  if (!folder.wurzelItemId) return '';
  return `
      <div class="vb-rohbar" data-vb-rohbar>
        <button type="button" class="vb-rohbar__neu" data-vb-roh-neu="">${icon('folder-add')}<span>Neuer Ordner</span></button>
        ${folder.items.some(i => i.verschiebbar) ? '<span class="vb-rohbar__hint">Dateien auf eine Feedbackschleife ziehen</span>' : ''}
      </div>`;
}
