// videoBrowserRender.js
// HTML-Renderer des Videos-Tabs: Ablauf-Leiste, Pfadleiste, Spalten, Detailbereich.
// Reine Funktionen (Zustand rein, String raus). Optik kommt ausschließlich aus
// assets/styles/video-browser.css (Design-Variablen und vorhandene Badge-Klassen).

import { icon } from '../../core/icons/IconSystem.js';
import { escapeHtml as esc } from '../../core/format.js';
import { formatTime } from '../../core/media/mediaPlayerIcons.js';
import {
  FORMATE,
  FINAL_ID,
  collectDownloadItems,
  commentsForAsset,
  formatDatum,
  plural,
  renditionFor,
  schleifeName,
  selectionDepth,
  verlaufFor,
  wartetText
} from './videoBrowserLogic.js';

const isoOf = (value) => {
  const t = new Date(value);
  return Number.isNaN(t.getTime()) ? '' : t.toISOString();
};

const ratioCss = (ratio) => String(ratio || '9:16').replace(':', ' / ');

export function statusBadge(status) {
  if (!status) return '';
  return `<span class="status-badge ${esc(status.tone)} vb-status" data-status="${esc(status.key)}">${esc(status.label)}</span>`;
}

/** Was der Zähler zählt: Dateien der aktuellen Feedbackschleifen, die auf den Kunden warten. */
const zaehlerLabel = (team) => (team ? 'beim Kunden' : 'zu prüfen');
const zaehlerText = (n, team) => `${plural(n, 'Datei', 'Dateien')} ${zaehlerLabel(team)}`;

function countBadge(key, n, team) {
  if (!n) return '';
  return `<span class="vb-count" data-badge-key="${esc(key)}" title="${esc(zaehlerText(n, team))}">${n}<span class="vb-visually-hidden"> ${esc(zaehlerLabel(team))}</span></span>`;
}

/** Überschrift einer Video-Zeile: der Konzeptname, wenn es einen gibt. Die Video-Nr bleibt als Meta. */
function rowTitles(r) {
  return r.title
    ? { title: r.title, meta: r.label }
    : { title: r.label, meta: 'Ohne Titel' };
}

function avatar(koop) {
  if (koop.avatarUrl) {
    const url = window.validatorSystem?.sanitizeUrl?.(koop.avatarUrl) ?? koop.avatarUrl;
    if (url) return `<img class="vb-avatar" src="${esc(url)}" alt="" loading="lazy" />`;
  }
  return `<span class="vb-avatar vb-avatar--initial" aria-hidden="true">${esc((koop.name || '?').trim().charAt(0).toUpperCase())}</span>`;
}

/* ------------------------------------------------------------------ */
/* Pfadleiste                                                          */
/* ------------------------------------------------------------------ */

export function pfadSegmente(ctx) {
  const { koop, row, folder, item } = ctx.resolved;
  const segments = [{ label: 'Alle Kooperationen', keep: 0 }];
  if (koop) segments.push({ label: koop.name, keep: 1 });
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
/* Spalten                                                             */
/* ------------------------------------------------------------------ */

/** Statuspunkt plus Text in der Meta-Zeile: so bleibt der Titel auch in schmalen Spalten lesbar. */
function metaHtml(meta, status) {
  if (!status) return `<span class="vb-row__meta">${esc(meta)}</span>`;
  return `<span class="vb-row__meta"><span class="vb-dot vb-dot--${esc(status.key)}" aria-hidden="true"></span>${esc(status.label)}${meta ? ` · ${esc(meta)}` : ''}</span>`;
}

function rowButton({ depth, id, selected, active, lead, title, titleExtra = '', meta = '', status = null, badge = '', chevron = false, label = '', extraClass = '' }) {
  const cls = ['vb-row', extraClass, selected ? (active ? 'is-selected is-active' : 'is-selected') : '']
    .filter(Boolean).join(' ');
  return `
    <li>
      <button type="button" class="${cls}" data-depth="${depth}" data-id="${esc(id)}" title="${esc(title)}"${selected ? ' aria-current="true"' : ''}${label ? ` aria-label="${esc(label)}"` : ''}>
        <span class="vb-row__lead">${lead}</span>
        <span class="vb-row__text">
          <span class="vb-row__title"><span class="vb-row__name">${esc(title)}</span>${titleExtra}</span>
          ${metaHtml(meta, status)}
        </span>
        ${badge}
        ${chevron ? `<span class="vb-row__chevron" aria-hidden="true">${icon('chevron-right')}</span>` : ''}
      </button>
    </li>`;
}

const rowList = (html) => `<ul class="vb-rows">${html}</ul>`;

function colShell({ depth, title, sub, activeDepth, bodyHtml, footHtml = '', headExtra = '', zurueck = false }) {
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
      <div class="vb-col__body" data-vb-body>${bodyHtml}</div>
      ${footHtml ? `<footer class="vb-col__foot">${footHtml}</footer>` : ''}
    </section>`;
}

const empty = (text) => `<p class="vb-empty">${esc(text)}</p>`;

/** Download-Button je Umfang (item | folder | koop). Leer, wenn nichts herunterladbar ist. */
function downloadButton(ctx, scope, label, { primary = false } = {}) {
  if (!ctx.canDownload) return '';
  const count = collectDownloadItems(scope, ctx.resolved).length;
  if (!count) return '';
  const text = count > 1 ? `${label} (${count})` : label;
  return `<button type="button" class="mdc-btn${primary ? '' : ' mdc-btn--secondary'} vb-download" data-vb-download="${scope}">${icon('download')}<span>${esc(text)}</span></button>`;
}

function iconButton(name, label, attrs, extraClass = '') {
  return `<button type="button" class="vb-icon-btn${extraClass}" ${attrs} aria-label="${esc(label)}" title="${esc(label)}">${icon(name)}</button>`;
}

/** Herunterladen für alle mit Download-Recht, Titel bearbeiten und Löschen nur fürs Team. */
function assetActions(ctx) {
  const buttons = [];
  if (ctx.canDownload && collectDownloadItems('item', ctx.resolved).length) {
    buttons.push(iconButton('download', 'Herunterladen', 'data-vb-download="item"'));
  }
  if (ctx.canUpload) {
    buttons.push(iconButton('pencil-square', 'Titel bearbeiten', 'data-vb-edit'));
    buttons.push(iconButton('trash', 'Löschen', 'data-vb-delete', ' vb-icon-btn--danger'));
  }
  return buttons.length ? `<div class="vb-asset-head__actions">${buttons.join('')}</div>` : '';
}

/** Titel oben, darunter Feedbackschleife und Status, daneben die Aktionen. */
function assetHead(ctx, item, infoHtml) {
  return `
    <section class="vb-block vb-asset-head">
      <h4 class="vb-detail__title vb-asset-head__title" data-vb-asset-title>${esc(item.name)}</h4>
      <div class="vb-asset-head__row">
        <div class="vb-asset-head__info">${infoHtml}</div>
        ${assetActions(ctx)}
      </div>
    </section>`;
}

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

const FOLDER_ICON = { raw: 'folder', schleife: 'chat-bubble-left-ellipsis', final: 'check' };

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
const ITEM_ICON = { video: 'film', story: 'phone-mobile', still: 'photo', roh: 'document' };

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

function uploadZoneHtml(folder, row) {
  const accept = folder.kind === 'raw' ? 'video/*,.zip' : 'video/*';
  // Ein Upload ersetzt nichts und startet keine neue Schleife: er legt eine weitere
  // Variante in genau diesem Ordner ab. Das sagt der Text.
  let hint = 'Rohmaterial hierher ziehen';
  if (folder.kind !== 'raw') {
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
  const { resolved: { row, folder }, sel, team, canUpload, uploads } = ctx;
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
    : (canUpload && folder.upload ? 'Noch leer. Lege die geschnittenen Varianten unten ab.' : 'In diesem Ordner liegt noch nichts.');

  const statusZeile = folder.kind === 'raw'
    ? folder.meta
    : [folder.status?.label, plural(folder.items.length, 'Datei', 'Dateien')].filter(Boolean).join(' · ');

  const foot = canUpload && folder.upload ? `<div class="vb-uploads" data-vb-uploads>${uploadZoneHtml(folder, row)}</div>` : '';

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

/* ------------------------------------------------------------------ */
/* Detailbereich                                                       */
/* ------------------------------------------------------------------ */

export function naechsterSchritt(row, team) {
  const loop = row.folders.find(f => f.kind === 'schleife' && f.current && !f.leer);
  if (team) {
    if (row.stage === null) return { text: 'Noch kein Upload. Lege Rohmaterial oder ein fertiges Video ab.', ziel: row.folders[0]?.id || null, label: 'Zum Ordner' };
    if (row.stage === 2) return { text: 'Das Rohmaterial liegt vor. Als Nächstes folgt der Schnitt der ersten Feedbackschleife.', ziel: row.folders.find(f => f.kind === 'schleife')?.id || null, label: 'Zur Feedbackschleife' };
    if (row.stage === 4) return { text: `${loop?.name || 'Die Feedbackschleife'} liegt beim Kunden. Es fehlt noch das Feedback.`, ziel: loop?.id || null, label: 'Zur Feedbackschleife' };
    return { text: 'Die Finale Version liegt vor.', ziel: FINAL_ID, label: 'Zur Finalen Version' };
  }
  if (row.stage === 4) return { text: `Bitte prüfe die Dateien in ${loop?.name || 'der Feedbackschleife'} und hinterlasse dein Feedback.`, ziel: loop?.id || null, label: 'Zur Prüfung' };
  if (row.stage === 5) return { text: 'Freigegeben. Die Finale Version steht bereit.', ziel: FINAL_ID, label: 'Zur Finalen Version' };
  return { text: `${row.label} ist noch in Produktion. Sobald die erste Version bereitsteht, erscheint sie hier.`, ziel: null, label: '' };
}

function detailAnstehend(ctx) {
  const { tree, team } = ctx;
  if (!team) {
    return `
      <section class="vb-block">
        <h4 class="vb-detail__title">So funktioniert die Prüfung</h4>
        <ol class="vb-howto">
          <li>Wähle links eine Kooperation und ein Video.</li>
          <li>Öffne die aktuelle Feedbackschleife und sieh dir die Dateien an.</li>
          <li>Hinterlasse dein Feedback direkt an der Stelle im Video.</li>
        </ol>
        <button type="button" class="mdc-btn" data-vb-first-open${ctx.hatOffenes ? '' : ' disabled'}>Ersten offenen Inhalt prüfen</button>
      </section>`;
  }
  const eintraege = [];
  for (const k of tree.kooperationen) {
    for (const r of k.rows) {
      let text = null;
      let ordner = null;
      if (r.stage === null) text = 'Noch kein Upload';
      else if (r.stage === 2) { text = 'Rohmaterial wartet auf Schnitt'; ordner = r.folders.find(f => f.kind === 'schleife')?.id || null; }
      else if (r.stage === 4) {
        const loop = r.folders.find(f => f.kind === 'schleife' && f.current && !f.leer);
        text = `${plural(r.offeneCount, 'Datei', 'Dateien')} beim Kunden (${loop?.name || 'Feedbackschleife'})`;
        ordner = loop?.id || null;
      }
      if (text) eintraege.push({ k, r, text, ordner });
    }
  }
  const liste = eintraege.slice(0, 30).map(e => `
    <li>
      <button type="button" class="vb-todo" data-goto-koop="${esc(e.k.id)}" data-goto-video="${esc(e.r.id)}"${e.ordner ? ` data-goto-folder="${esc(e.ordner)}"` : ''}>
        <span class="vb-todo__title">${esc(e.k.name)} · ${esc(e.r.label)}</span>
        <span class="vb-todo__meta">${esc(e.text)}</span>
      </button>
    </li>`).join('');
  return `
    <section class="vb-block">
      <h4 class="vb-detail__title">Was gerade ansteht</h4>
      ${liste ? `<ul class="vb-todos">${liste}</ul>` : empty('Aktuell steht nichts an.')}
    </section>`;
}

function detailKooperation(ctx) {
  const { koop } = ctx.resolved;
  const list = koop.rows.map((r) => {
    const { title, meta } = rowTitles(r);
    return `
    <li>
      <button type="button" class="vb-row vb-row--detail" data-goto-video="${esc(r.id)}">
        <span class="vb-row__lead"><span class="vb-icon-slot">${icon('film')}</span></span>
        <span class="vb-row__text">
          <span class="vb-row__title"><span class="vb-row__name">${esc(title)}</span>${r.status ? statusBadge(r.status) : ''}</span>
          <span class="vb-row__meta">${esc(meta)}</span>
        </span>
      </button>
    </li>`;
  }).join('');
  const dlKoop = downloadButton(ctx, 'koop', 'Alle aktuellen Videos herunterladen');
  // Die Bearbeitungsart wird aus dem Rohmaterial abgeleitet. Ohne Rohmaterial heißt das nicht,
  // dass extern geschnitten wird, nur dass noch keins da ist.
  const info = ctx.team
    ? `<p class="vb-info">${koop.mode === 'intern'
      ? 'Bearbeitung intern: Der Creator liefert Rohmaterial, der Cutter schneidet.'
      : 'Noch kein Rohmaterial: Wir gehen von einem fertigen Video des Creators aus, das wir sichten und fein schneiden.'}</p>`
    : '';
  return `
    <section class="vb-block vb-person">
      ${avatar(koop)}
      <div>
        <h4 class="vb-detail__title">${esc(koop.name)}</h4>
        <p class="vb-detail__sub">${esc([koop.handle, plural(koop.videoCount, 'Video', 'Videos')].filter(Boolean).join(' · '))}</p>
      </div>
    </section>
    ${info}
    ${dlKoop ? `<div class="vb-block vb-actions">${dlKoop}<p class="vb-actions__hint">Pro Video die Finale Version, sonst die jüngste Feedbackschleife.</p></div>` : ''}
    <div class="vb-block">${list ? `<ul class="vb-list" aria-label="Videos">${list}</ul>` : empty('Noch keine Videos.')}</div>`;
}

function folderRowDetail(row, f) {
  return `
    <li>
      <button type="button" class="vb-row vb-row--detail" data-goto-folder="${esc(f.id)}">
        <span class="vb-row__lead"><span class="vb-icon-slot">${icon(FOLDER_ICON[f.kind] || 'folder')}</span></span>
        <span class="vb-row__text">
          <span class="vb-row__title"><span class="vb-row__name">${esc(f.name)}</span></span>
          <span class="vb-row__meta">${esc(f.meta)}</span>
        </span>
        <span class="vb-row__chevron" aria-hidden="true">${icon('chevron-right')}</span>
      </button>
    </li>`;
}

function detailVideo(ctx) {
  const { row } = ctx.resolved;
  const next = naechsterSchritt(row, ctx.team);
  const hinweis = row.folders.length
    ? `<ul class="vb-list" aria-label="Ordner">${row.folders.map(f => folderRowDetail(row, f)).join('')}</ul>`
    : empty(ctx.team ? 'Noch nichts abgelegt.' : next.text);
  return `
    <section class="vb-block vb-next">
      <h4 class="vb-detail__eyebrow">Nächster Schritt</h4>
      <p>${esc(next.text)}</p>
      ${next.ziel ? `<button type="button" class="mdc-btn mdc-btn--secondary" data-goto-folder="${esc(next.ziel)}">${esc(next.label)}</button>` : ''}
    </section>
    <div class="vb-block">${hinweis}</div>`;
}

function tile(item) {
  return `
    <li>
      <button type="button" class="vb-tile" data-goto-item="${esc(item.id)}">
        <span class="vb-tile__thumb" style="--vb-ratio: ${ratioCss(item.ratio)}">${icon(ITEM_ICON[item.type] || 'document')}</span>
        <span class="vb-tile__name">${esc(item.name)}</span>
      </button>
    </li>`;
}

/** Eine Zeile dazu, wie es mit dieser Feedbackschleife steht (aus dem Status abgeleitet). */
function schleifenText(ctx, folder) {
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

function detailOrdner(ctx) {
  const { row, folder, koop } = ctx.resolved;
  const kommentare = folder.kind === 'schleife'
    ? row.comments.filter(c => c.runde === folder.number).length
    : 0;
  const erklaerung = folder.kind === 'raw'
    ? (koop.mode === 'intern'
      ? 'Der Creator liefert Rohmaterial, der Cutter schneidet daraus die Feedbackschleifen. Rohmaterial ist nur intern sichtbar.'
      : 'Der Creator liefert ein fertiges Video. Wir sichten es und machen den Feinschliff.')
    : folder.kind === 'final'
      ? 'Die Finale Version liegt je Seitenverhältnis als eigene Datei vor. Die Dateien sind freigegeben.'
      : schleifenText(ctx, folder);
  const stats = `
    <dl class="vb-stats">
      <div><dt>Dateien</dt><dd>${folder.items.length}</dd></div>
      ${folder.kind === 'schleife' ? `<div><dt>Kommentare</dt><dd>${kommentare}</dd></div>` : ''}
    </dl>`;
  const sheet = folder.items.length
    ? `<ul class="vb-sheet" aria-label="Dateien">${folder.items.map(tile).join('')}</ul>`
    : empty(folder.kind === 'raw' ? 'Der Creator hat noch kein Rohmaterial hochgeladen.' : 'Noch leer.');
  return `
    <section class="vb-block">
      <h4 class="vb-detail__title">${esc(folder.name)}</h4>
      <p class="vb-detail__sub">${folder.status ? statusBadge(folder.status) : ''} ${esc(row.label)}</p>
      <p class="vb-info">${esc(erklaerung)}</p>
      ${stats}
      <div class="vb-slot" data-slot="folder-detail-actions">${downloadButton(ctx, 'folder', 'Alle Dateien herunterladen')}</div>
    </section>
    <div class="vb-block">${sheet}</div>`;
}

export function formatHint(ratio, hatEigeneDatei) {
  return hatEigeneDatei
    ? `Eigene Datei im Seitenverhältnis ${ratio}.`
    : `Beschnitt der Vorschau auf ${ratio}. Dafür liegt keine eigene Datei vor.`;
}

function formatSwitch(item, row) {
  const finals = row.folders.find(f => f.kind === 'final')?.items.filter(i => i.type === 'video' || i.type === 'story') || [];
  const buttons = FORMATE.map(r => `
    <label class="vb-formats__btn"><input type="radio" class="vb-visually-hidden" name="vb-ratio" value="${r}"${r === item.ratio ? ' checked' : ''} />${r}</label>`).join('');
  return `
    <div class="vb-formats-wrap">
      <fieldset class="view-toggle vb-formats" data-vb-formats>
        <legend class="vb-visually-hidden">Seitenverhältnis</legend>
        <span class="vb-formats__thumb" data-vb-thumb aria-hidden="true"></span>
        ${buttons}
      </fieldset>
      <p class="vb-formats__hint" data-vb-format-hint>${esc(formatHint(item.ratio, !!renditionFor(finals, item.ratio)))}</p>
    </div>`;
}

export function commentHtml(c) {
  const rolle = c.author.role === 'kunde' ? 'Kunde' : 'Team';
  const zeit = c.timecodeSec !== null && c.timecodeSec !== undefined
    ? `<button type="button" class="vb-timecode" data-seek="${c.timecodeSec}" aria-label="Zu ${formatTime(c.timecodeSec)} springen">${formatTime(c.timecodeSec)}</button>`
    : '';
  const iso = isoOf(c.createdAt);
  const datum = iso
    ? `<time class="vb-comment__date" datetime="${iso}">${esc(formatDatum(c.createdAt))}</time>`
    : `<span class="vb-comment__date">${esc(formatDatum(c.createdAt))}</span>`;
  return `
    <li class="vb-comment vb-comment--${c.author.role}" data-comment-id="${esc(c.id)}">
      <header class="vb-comment__head">
        <span class="vb-comment__author">${esc(c.author.name)}</span>
        <span class="tag vb-comment__role">${rolle}</span>
        ${datum}
      </header>
      <div class="vb-comment__body">${zeit}<p class="vb-comment__text">${esc(c.text)}</p></div>
    </li>`;
}

function decisionText(ctx, item, folder) {
  if (item.isFinal) return 'Freigegeben als Finale Version.';
  // Kunden brauchen für die offene Schleife keinen Hinweis: dort steht der Kommentarbereich.
  if (folder.status?.key === 'wartet' && !ctx.team) return '';
  return schleifenText(ctx, folder);
}

function detailItem(ctx) {
  const { row, folder, item } = ctx.resolved;

  if (item.type === 'roh') {
    return `
      ${assetHead(ctx, item, item.meta ? `<span class="vb-version">${esc(item.meta)}</span>` : '')}
      <div class="vb-player-host" data-vb-player-host data-asset-id="${esc(item.id)}"></div>`;
  }

  const comments = commentsForAsset(row.comments, item.runde, item.id, item.type);
  const verlauf = verlaufFor(row, item);
  const verlaufHtml = verlauf.length > 1 ? `
    <section class="vb-block">
      <h5 class="vb-detail__eyebrow">Verlauf dieser Variante</h5>
      <ul class="vb-chips">
        ${verlauf.map(v => `<li><button type="button" class="vb-chip${v.current ? ' is-current' : ''}" data-goto-folder="${esc(v.folderId)}" data-goto-item="${esc(v.itemId)}"${v.current ? ' aria-current="true"' : ''}><span class="vb-dot vb-dot--${esc(v.status || 'wartet')}" aria-hidden="true"></span>${esc(v.label)}</button></li>`).join('')}
      </ul>
    </section>` : '';

  const decision = decisionText(ctx, item, folder);
  const canWrite = ctx.canComment && item.type === 'video' && !item.isFinal && folder.current && !folder.closed && row.kannKommentieren;
  // Zeitstempel: erst an, wenn der Playhead bewegt wurde (macht der Controller über onTime).
  // Nur eine bewusste Wahl des Nutzers bleibt über ein Neu-Rendern erhalten.
  const draft = ctx.drafts?.[item.id] || { text: '', pinned: false, pinTouched: false };
  const pinned = draft.pinTouched && draft.pinned;

  let commentSection = '';
  if (!item.isFinal) {
    // Feedback schreibt man am Video der Runde. Bilder und Stories zeigen die Notizen der Runde.
    const readonlyHint = item.type === 'video'
      ? 'Kommentare abgeschlossener Feedbackschleifen sind nur noch lesbar.'
      : `Feedback zu ${item.type === 'still' ? 'Bildern' : 'Stories'} dieser Runde steht hier, geschrieben wird beim Video.`;
    commentSection = `
      <section class="vb-block vb-comments">
        <h5 class="vb-detail__eyebrow">Kommentare</h5>
        <ul class="vb-comment-list" data-vb-comments>${comments.map(commentHtml).join('')}</ul>
        ${comments.length ? '' : '<p class="vb-empty" data-vb-comments-empty>Noch keine Kommentare.</p>'}
        ${canWrite ? `
        <form class="vb-comment-form" data-vb-comment-form data-asset-id="${esc(item.id)}">
          <label class="vb-visually-hidden" for="vb-comment-text">Kommentar</label>
          <textarea class="form-input vb-comment-form__text" id="vb-comment-text" rows="3" placeholder="Feedback schreiben ..." aria-describedby="vb-comment-hint" data-vb-comment-text>${esc(draft.text)}</textarea>
          <label class="vb-comment-form__pin"><input type="checkbox" data-vb-pin${pinned ? ' checked' : ''} /> Zeitstempel anhängen <span class="vb-comment-form__pin-time" data-vb-pin-time>0:00</span></label>
          <div class="vb-comment-form__actions">
            <span class="vb-comment-form__hint" id="vb-comment-hint"><kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>Enter</kbd></span>
            <button type="submit" class="mdc-btn" data-vb-comment-send>Senden</button>
          </div>
        </form>` : `<p class="vb-info">${esc(readonlyHint)}</p>`}
      </section>`;
  }

  // Kein Kontext-Pfad über dem Titel: den tragen Spaltenköpfe und Pfadleiste.
  // "Version" heißt hier wie überall Feedbackschleife (Glossar).
  const info = item.isFinal
    ? ''
    : `<span class="vb-version" data-vb-asset-version>${esc(schleifeName(item.version || 1))}</span>${statusBadge(item.status)}`;

  // Video, Hinweis und Verlauf oben, Kommentare darunter.
  return `
    ${assetHead(ctx, item, info)}
    ${item.isFinal && item.type !== 'still' ? formatSwitch(item, row) : ''}
    <div class="vb-item${commentSection ? ' has-side' : ''}">
      <div class="vb-item__media">
        <div class="vb-player-host" data-vb-player-host data-asset-id="${esc(item.id)}"></div>
        ${decision ? `<p class="vb-decision" data-slot="decision">${esc(decision)}</p>` : '<div class="vb-slot" data-slot="decision"></div>'}
        ${verlaufHtml}
      </div>
      ${commentSection ? `<div class="vb-item__side">${commentSection}</div>` : ''}
    </div>`;
}

/** Inhalt des Detailbereichs je tiefster Auswahl. */
export function renderDetail(ctx) {
  const { koop, row, folder, item } = ctx.resolved;
  if (koop && row && folder && item) return detailItem(ctx);
  if (koop && row && folder) return detailOrdner(ctx);
  if (koop && row) return detailVideo(ctx);
  if (koop) return detailKooperation(ctx);
  return detailAnstehend(ctx);
}
