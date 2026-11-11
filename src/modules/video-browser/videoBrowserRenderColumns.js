// videoBrowserRenderColumns.js
// Die vier Spalten des Videos-Tabs: Kooperationen, Videos, Ordner, Inhalte (inkl. Upload-Zone).

import { icon } from '../../core/icons/IconSystem.js';
import { escapeHtml as esc } from '../../core/format.js';
import {
  KOOP_GROUPS,
  activeFilterValue,
  creatorAnzahl,
  folderFilters,
  koopEntries,
  kooperationZusatz,
  matchesFilter,
  plural,
  selectionDepth
} from './videoBrowserLogic.js';
import { ALTBESTAND_BADGE, zeigeAltbestandBadge } from '../kampagne/altbestandLinie.js';
import { canMarkFinal, isMarked } from './videoBrowserRenderItem.js';
import { tagMetaText } from './videoBrowserRenderTags.js';
import {
  FOLDER_ICON,
  ITEM_ICON,
  avatar,
  colShell,
  countBadge,
  empty,
  filterChipsHtml,
  filterEmptyHtml,
  iconButton,
  rowButton,
  rowList,
  rowTitles,
  segmentHtml,
  zaehlerText
} from './videoBrowserRenderParts.js';

function koopRow(ctx, activeDepth, koop, { title, meta, lead, nested = false, label = '' }) {
  // Bearbeitungsart steht bewusst nicht in der Liste: "extern" ist nur der Default
  // ohne Rohmaterial und sagt bei jedem Creator dasselbe. Sie steht im Detail.
  return rowButton({
    depth: 0,
    id: koop.id,
    selected: ctx.sel.kooperationId === koop.id,
    active: activeDepth === 0,
    lead,
    title,
    meta,
    label,
    badge: countBadge(`k:${koop.id}`, koop.offeneCount, ctx.team),
    chevron: true,
    extraClass: nested ? 'vb-row--nested' : ''
  });
}

function koopGroupHtml(ctx, activeDepth, group, index) {
  const open = !ctx.collapsed?.has(group.id);
  const bodyId = `vb-kg-${index}`;
  const lead = group.mode === 'linie' ? `<span class="vb-icon-slot">${icon('folder')}</span>` : avatar(group.koop);
  const altbestand = group.mode === 'linie' && group.linie && zeigeAltbestandBadge(group.linie)
    ? `<span class="linien-switch__badge">${esc(ALTBESTAND_BADGE)}</span>`
    : '';
  const rows = group.rows.map(r => koopRow(ctx, activeDepth, r.koop, {
    title: r.title,
    meta: r.meta,
    lead: '',
    nested: true,
    label: `${group.label} · ${r.title}`
  })).join('');
  return `
    <li class="vb-koopgroup${open ? '' : ' is-collapsed'}" data-vb-koopgroup-wrap="${esc(group.id)}">
      <button type="button" class="vb-row vb-koopgroup__head" data-vb-koopgroup="${esc(group.id)}" aria-expanded="${open}" aria-controls="${bodyId}" title="${esc(group.label)}">
        <span class="vb-row__lead">${lead}</span>
        <span class="vb-row__text">
          <span class="vb-row__title"><span class="vb-row__name">${esc(group.label)}</span>${altbestand}</span>
          <span class="vb-row__meta">${esc(group.meta)}</span>
        </span>
        ${countBadge(`g:${group.id}`, group.offeneCount, ctx.team)}
        <span class="vb-koopgroup__chevron" aria-hidden="true">${icon('chevron-down')}</span>
      </button>
      <ul class="vb-rows vb-koopgroup__body" id="${bodyId}" data-vb-koopgroup-body${open ? '' : ' hidden'}>${rows}</ul>
    </li>`;
}

/** "Alle ein-/aufklappen" bei Gruppenköpfen; der Umschalter Creator | Linie nur im Team bei Alle Linien. */
function koopToolbarHtml(ctx, entries) {
  const groups = entries.filter(e => e.kind === 'group');
  const seg = ctx.team && ctx.zeigeLinie
    ? segmentHtml({ id: 'koopgruppe', label: 'Gruppieren', options: KOOP_GROUPS, value: ctx.koopGroup })
    : '';
  const alleZu = groups.length > 0 && groups.every(g => ctx.collapsed?.has(g.id));
  const toggle = groups.length
    ? iconButton(alleZu ? 'arrows-expand' : 'arrows-collapse', alleZu ? 'Alle aufklappen' : 'Alle einklappen', `data-vb-koopgroup-all="${alleZu ? 'open' : 'close'}"`)
    : '';
  if (!seg && !toggle) return '';
  return `<div class="vb-koopbar">${seg}${toggle}</div>`;
}

function colKooperationen(ctx, activeDepth) {
  const { tree, team } = ctx;
  const koops = tree.kooperationen;
  const creators = creatorAnzahl(koops);
  const zaehler = [plural(creators, 'Creator', 'Creator')];
  if (koops.length !== creators) zaehler.push(plural(koops.length, 'Kooperation', 'Kooperationen'));
  const offenGesamt = koops.reduce((sum, k) => sum + k.offeneCount, 0);
  const entries = koopEntries(ctx);
  const rows = entries.map((e, i) => (e.kind === 'group'
    ? koopGroupHtml(ctx, activeDepth, e, i)
    : koopRow(ctx, activeDepth, e.koop, { title: e.title, meta: e.meta, lead: avatar(e.koop) }))).join('');
  return colShell({
    depth: 0,
    title: 'Kooperationen',
    // Der Zähler an den Zeilen zählt Dateien; hier steht, was er bedeutet.
    sub: [ctx.produktionTitel || 'Produktion', ...zaehler, offenGesamt ? zaehlerText(offenGesamt, team) : null].filter(Boolean).join(' · '),
    activeDepth,
    toolbarHtml: koopToolbarHtml(ctx, entries),
    bodyHtml: rows ? rowList(rows) : empty('In diesem Bereich gibt es noch keine Kooperationen.')
  });
}

function colVideos(ctx, activeDepth) {
  const { resolved: { koop }, sel } = ctx;
  // Status als Punkt in der Meta-Zeile, kein Zähler: der Status sagt schon, ob etwas wartet.
  const rows = koop.rows.map((r) => {
    const { title, meta } = rowTitles(r);
    return rowButton({
      depth: 1,
      id: r.id,
      selected: sel.videoId === r.id,
      active: activeDepth === 1,
      lead: `<span class="vb-icon-slot">${icon('film')}</span>`,
      title,
      meta,
      status: r.status,
      chevron: true,
      extraClass: 'vb-row--video'
    });
  }).join('');
  const sub = [kooperationZusatz(koop, { zeigeLinie: ctx.zeigeLinie, kooperationen: ctx.tree.kooperationen }), plural(koop.videoCount, 'Video', 'Videos'), koop.handle].filter(Boolean).join(' · ');
  return colShell({
    depth: 1,
    title: koop.name,
    sub,
    activeDepth,
    zurueck: true,
    bodyHtml: rows ? rowList(rows) : empty('Für diese Kooperation gibt es noch keine Videos.')
  });
}

function colOrdner(ctx, activeDepth) {
  const { resolved: { row }, sel, team } = ctx;
  const rows = row.folders.map((f) => {
    return rowButton({
      depth: 2,
      id: f.id,
      selected: sel.folderId === f.id,
      active: activeDepth === 2,
      lead: `<span class="vb-icon-slot" data-slot="icon">${icon(FOLDER_ICON[f.kind] || 'folder')}</span>`,
      title: f.name,
      meta: f.meta,
      status: f.status,
      chevron: true,
      // Ziel des Fluges beim Markieren als final
      liAttrs: `data-folder-id="${esc(f.id)}"`
    });
  }).join('');

  const body = rows ? rowList(rows) : empty(team
    ? 'Noch nichts abgelegt.'
    : `${row.label} ist noch in Produktion. Sobald die erste Version bereitsteht, erscheint sie hier.`);

  const { title, meta } = rowTitles(row);
  return colShell({
    depth: 2,
    title,
    sub: meta,
    activeDepth,
    zurueck: true,
    bodyHtml: body
  });
}

const GROUP_ORDER = ['Videos', 'Bilder', 'Stories', 'Dateien'];

export function uploadRowHtml(up) {
  const pct = Math.round((up.progress || 0) * 100);
  return `
    <li class="vb-row vb-row--upload${up.error ? ' has-error' : ''}" data-upload-id="${esc(up.id)}">
      <span class="vb-row__lead"><span class="vb-icon-slot">${icon('upload')}</span></span>
      <span class="vb-row__text">
        <span class="vb-row__title"><span class="vb-row__name">${esc(up.name)}</span></span>
        ${up.error
          ? `<span class="vb-row__meta">${esc(up.error)}</span>`
          : `<progress class="upload-progress-bar" max="100" value="${pct}" aria-label="Upload ${esc(up.name)}">${pct}%</progress>`}
      </span>
    </li>`;
}

function uploadZoneHtml(folder) {
  const accept = folder.kind === 'raw' ? 'video/*,.zip' : 'video/*,image/*';
  // Ein Upload ersetzt nichts und startet keine neue Schleife: er legt weitere Dateien
  // (Videos und Bilder) flach in genau diesem Ordner ab. Das sagt der Text.
  let hint = 'Rohmaterial hierher ziehen';
  if (folder.kind === 'final') {
    hint = folder.items.length
      ? 'Weitere finale Datei (z. B. 4:5, 1:1) hierher ziehen'
      : 'Finale Dateien hierher ziehen';
  } else if (folder.kind !== 'raw') {
    hint = folder.items.length
      ? `Weitere Dateien für ${folder.name} hierher ziehen`
      : `Dateien für ${folder.name} hierher ziehen`;
  }
  return `
    <div class="upload-dropzone" data-vb-dropzone data-folder-id="${esc(folder.id)}">
      <div class="dropzone-content">
        <p class="dropzone-text">${esc(hint)} oder <button type="button" class="dropzone-browse-btn">vom Rechner wählen</button></p>
        <input type="file" data-vb-file multiple accept="${accept}" hidden />
      </div>
    </div>`;
}

/** Schnell-Stern an der Zeile (nur Team): markiert die Datei als final, ohne sie zu öffnen. */
function starHtml(item) {
  const on = isMarked(item);
  return `<button type="button" class="vb-row-star${on ? ' is-on' : ''}" data-vb-star="${esc(item.id)}" aria-pressed="${on}" aria-label="${on ? 'Final-Markierung entfernen' : 'Als final markieren'}: ${esc(item.name)}" title="${on ? 'Final markiert' : 'Als final markieren'}" tabindex="-1">${icon('star')}</button>`;
}

function colInhalte(ctx, activeDepth) {
  const { resolved: { folder }, sel, team, canUpload, uploads } = ctx;
  const catalog = ctx.tagCatalog || [];

  // Filter gilt für diesen Ordner. Ein Wert, den es hier nicht mehr gibt (Tag entfernt), zählt nicht.
  const chips = folderFilters(folder, catalog);
  const wanted = activeFilterValue(ctx.filter, folder.id);
  const active = chips.some(c => c.id === wanted) ? wanted : null;
  const visible = folder.items.filter(item => matchesFilter(item, active));

  const groups = new Map();
  for (const item of visible) {
    if (!groups.has(item.group)) groups.set(item.group, []);
    groups.get(item.group).push(item);
  }

  const itemRow = (item) => {
    const tags = tagMetaText(item, catalog);
    return rowButton({
      depth: 3,
      id: item.id,
      selected: sel.itemId === item.id,
      active: activeDepth === 3,
      lead: `<span class="vb-icon-slot">${icon(ITEM_ICON[item.type] || 'document')}</span>`,
      title: item.name,
      // Der Status gilt für die ganze Schleife und steht im Spaltenkopf, nicht an jeder Datei.
      meta: [item.meta, tags].filter(Boolean).join(' · '),
      chevron: true,
      after: canUpload && canMarkFinal(item) ? starHtml(item) : ''
    });
  };

  const uploadRows = (uploads || []).map(uploadRowHtml).join('');
  const orderedItems = GROUP_ORDER.flatMap(g => groups.get(g) || []);
  const groupHtml = orderedItems.length ? rowList(orderedItems.map(itemRow).join('')) : '';

  const leerText = folder.kind === 'raw'
    ? (team ? 'Der Creator hat noch kein Rohmaterial hochgeladen.' : 'Noch nichts vorhanden.')
    : folder.kind === 'final'
      ? (canUpload && folder.upload
        ? 'Noch keine Finale Version. Datei unten ablegen oder eine vorhandene Datei in einer Feedbackschleife freigeben.'
        : 'In diesem Ordner liegt noch nichts.')
      : (canUpload && folder.upload ? 'Noch leer. Lege die geschnittenen Varianten unten ab.' : 'In diesem Ordner liegt noch nichts.');

  const statusZeile = folder.kind === 'raw'
    ? folder.meta
    : [folder.status?.label, plural(folder.items.length, 'Datei', 'Dateien')].filter(Boolean).join(' · ');

  const foot = canUpload && folder.upload ? `<div class="vb-uploads" data-vb-uploads>${uploadZoneHtml(folder)}</div>` : '';

  // Leerer Zustand des Filters statt einer leeren Spalte
  const filtered = active && !visible.length && folder.items.length
    ? filterEmptyHtml()
    : '';

  return colShell({
    depth: 3,
    title: folder.name,
    sub: statusZeile,
    activeDepth,
    zurueck: true,
    toolbarHtml: filterChipsHtml(chips, active),
    bodyHtml: `${uploadRows ? `<ul class="vb-rows" data-vb-upload-list>${uploadRows}</ul>` : ''}${groupHtml}${filtered}${!groupHtml && !uploadRows && !filtered ? empty(leerText) : ''}`,
    footHtml: foot
  });
}

/** Alle Spalten, die die Auswahl hergibt, als HTML-Strings (Index = Tiefe). */
export function renderColumns(ctx) {
  const activeDepth = selectionDepth(ctx.sel);
  const { koop, row, folder } = ctx.resolved;
  const cols = [colKooperationen(ctx, activeDepth)];
  if (koop) cols.push(colVideos(ctx, activeDepth));
  if (koop && row) cols.push(colOrdner(ctx, activeDepth));
  if (koop && row && folder) cols.push(colInhalte(ctx, activeDepth));
  return cols;
}
