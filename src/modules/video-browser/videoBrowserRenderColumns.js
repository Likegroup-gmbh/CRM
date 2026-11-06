// videoBrowserRenderColumns.js
// Die vier Spalten des Videos-Tabs: Kooperationen, Videos, Ordner, Inhalte (inkl. Upload-Zone).

import { icon } from '../../core/icons/IconSystem.js';
import { escapeHtml as esc } from '../../core/format.js';
import { plural, selectionDepth } from './videoBrowserLogic.js';
import {
  FOLDER_ICON,
  ITEM_ICON,
  avatar,
  colShell,
  countBadge,
  empty,
  rowButton,
  rowList,
  rowTitles,
  zaehlerText
} from './videoBrowserRenderParts.js';

function colKooperationen(ctx, activeDepth) {
  const { tree, team, sel } = ctx;
  const koops = tree.kooperationen;
  const creatorCount = plural(koops.length, 'Creator', 'Creator');
  const offenGesamt = koops.reduce((sum, k) => sum + k.offeneCount, 0);
  const rows = koops.map((k) => {
    // Bearbeitungsart steht bewusst nicht in der Liste: "extern" ist nur der Default
    // ohne Rohmaterial und sagt bei jedem Creator dasselbe. Sie steht im Detail.
    const meta = [
      plural(k.videoCount, 'Video', 'Videos'),
      ctx.zeigeLinie && k.linie ? k.linie.name : null
    ].filter(Boolean).join(' · ');
    return rowButton({
      depth: 0,
      id: k.id,
      selected: sel.kooperationId === k.id,
      active: activeDepth === 0,
      lead: avatar(k),
      title: k.name,
      meta,
      badge: countBadge(`k:${k.id}`, k.offeneCount, team),
      chevron: true
    });
  }).join('');
  return colShell({
    depth: 0,
    title: 'Kooperationen',
    // Der Zähler an den Zeilen zählt Dateien; hier steht, was er bedeutet.
    sub: [ctx.produktionTitel || 'Produktion', creatorCount, offenGesamt ? zaehlerText(offenGesamt, team) : null].filter(Boolean).join(' · '),
    activeDepth,
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
  const sub = [plural(koop.videoCount, 'Video', 'Videos'), koop.handle].filter(Boolean).join(' · ');
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
      lead: `<span class="vb-icon-slot">${icon(FOLDER_ICON[f.kind] || 'folder')}</span>`,
      title: f.name,
      meta: f.meta,
      status: f.status,
      chevron: true
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
  const accept = folder.kind === 'raw' ? 'video/*,.zip' : 'video/*';
  // Ein Upload ersetzt nichts und startet keine neue Schleife: er legt eine weitere
  // Variante in genau diesem Ordner ab. Das sagt der Text.
  let hint = 'Rohmaterial hierher ziehen';
  if (folder.kind === 'final') {
    hint = folder.items.length
      ? 'Weitere finale Datei (z. B. 4:5, 1:1) hierher ziehen'
      : 'Finale Dateien hierher ziehen';
  } else if (folder.kind !== 'raw') {
    hint = folder.items.length
      ? `Weitere Variante zu ${folder.name} hierher ziehen`
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

function colInhalte(ctx, activeDepth) {
  const { resolved: { folder }, sel, team, canUpload, uploads } = ctx;
  const groups = new Map();
  for (const item of folder.items) {
    if (!groups.has(item.group)) groups.set(item.group, []);
    groups.get(item.group).push(item);
  }

  const itemRow = (item) => rowButton({
    depth: 3,
    id: item.id,
    selected: sel.itemId === item.id,
    active: activeDepth === 3,
    lead: `<span class="vb-icon-slot">${icon(ITEM_ICON[item.type] || 'document')}</span>`,
    title: item.name,
    // Der Status gilt für die ganze Schleife und steht im Spaltenkopf, nicht an jeder Datei.
    meta: item.meta,
    chevron: true
  });

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

  return colShell({
    depth: 3,
    title: folder.name,
    sub: statusZeile,
    activeDepth,
    zurueck: true,
    bodyHtml: `${uploadRows ? `<ul class="vb-rows" data-vb-upload-list>${uploadRows}</ul>` : ''}${groupHtml}${!groupHtml && !uploadRows ? empty(leerText) : ''}`,
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
