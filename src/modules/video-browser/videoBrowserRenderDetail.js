// videoBrowserRenderDetail.js
// Detailbereich je tiefster Auswahl: Was ansteht, Kooperation, Video, Ordner (Datei: videoBrowserRenderItem).

import { icon } from '../../core/icons/IconSystem.js';
import { escapeHtml as esc } from '../../core/format.js';
import { FINAL_ID, kooperationLabels, kooperationTitel, kooperationZusatz, plural, weitereKooperationen } from './videoBrowserLogic.js';
import {
  FOLDER_ICON,
  ITEM_ICON,
  avatar,
  downloadButton,
  empty,
  ratioCss,
  rowTitles,
  schleifenText,
  statusBadge
} from './videoBrowserRenderParts.js';
import { detailItem } from './videoBrowserRenderItem.js';
import { captionFieldHtml } from './videoBrowserCaption.js';
import { freieOrdnerSlot, ordnerLinkButton } from './videoBrowserAblage.js';

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
        <span class="vb-todo__title">${esc([kooperationTitel(e.k, { zeigeLinie: ctx.zeigeLinie, kooperationen: ctx.tree.kooperationen }), e.r.label].join(' · '))}</span>
        <span class="vb-todo__meta">${esc(e.text)}</span>
      </button>
    </li>`).join('');
  return `
    <section class="vb-block">
      <h4 class="vb-detail__title">Was gerade ansteht</h4>
      ${liste ? `<ul class="vb-todos">${liste}</ul>` : empty('Aktuell steht nichts an.')}
    </section>`;
}

/** Team: dieselbe Person in ihren anderen Kooperationen der Produktion, ein Klick wechselt dorthin. */
function weitereKooperationenHtml(ctx, koop) {
  if (!ctx.team) return '';
  const andere = weitereKooperationen(ctx.tree.kooperationen, koop);
  if (!andere.length) return '';
  const labels = kooperationLabels([koop, ...andere]);
  const list = andere.map(k => `
    <li>
      <button type="button" class="vb-row vb-row--detail" data-goto-koop="${esc(k.id)}">
        <span class="vb-row__lead">${avatar(k)}</span>
        <span class="vb-row__text">
          <span class="vb-row__title"><span class="vb-row__name">${esc(labels.get(k.id).title)}</span></span>
          <span class="vb-row__meta">${esc(plural(k.videoCount, 'Video', 'Videos'))}</span>
        </span>
        <span class="vb-row__chevron" aria-hidden="true">${icon('chevron-right')}</span>
      </button>
    </li>`).join('');
  return `
    <section class="vb-block">
      <h4 class="vb-detail__eyebrow">Weitere Kooperationen von ${esc(koop.vorname || koop.name)}</h4>
      <ul class="vb-list" aria-label="Weitere Kooperationen">${list}</ul>
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
  const ordnerLink = ordnerLinkButton(koop);
  const actions = [
    dlKoop && `${dlKoop}<p class="vb-actions__hint">Pro Video die Finale Version, sonst die jüngste Feedbackschleife.</p>`,
    ordnerLink && `${ordnerLink}<p class="vb-actions__hint">Lesezugriff auf den Videos-Ordner in SharePoint, ohne Anmeldung.</p>`
  ].filter(Boolean).join('');
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
        <p class="vb-detail__sub">${esc([kooperationZusatz(koop, { zeigeLinie: ctx.zeigeLinie, kooperationen: ctx.tree.kooperationen }), koop.handle, plural(koop.videoCount, 'Video', 'Videos')].filter(Boolean).join(' · '))}</p>
      </div>
    </section>
    ${info}
    ${actions ? `<div class="vb-block vb-actions">${actions}</div>` : ''}
    <div class="vb-block">${list ? `<ul class="vb-list" aria-label="Videos">${list}</ul>` : empty('Noch keine Videos.')}</div>
    ${weitereKooperationenHtml(ctx, koop)}
    ${freieOrdnerSlot(ctx, koop)}`;
}

function folderRowDetail(f) {
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
    ? `<ul class="vb-list" aria-label="Ordner">${row.folders.map(folderRowDetail).join('')}</ul>`
    : empty(ctx.team ? 'Noch nichts abgelegt.' : next.text);
  const caption = captionFieldHtml(row, { editable: ctx.canEditCaption, open: ctx.captionOpen?.has(row.id) });
  return `
    <section class="vb-block vb-next">
      <h4 class="vb-detail__eyebrow">Nächster Schritt</h4>
      <p>${esc(next.text)}</p>
      ${next.ziel ? `<button type="button" class="mdc-btn mdc-btn--secondary" data-goto-folder="${esc(next.ziel)}">${esc(next.label)}</button>` : ''}
    </section>
    ${caption ? `<div class="vb-block">${caption}</div>` : ''}
    <div class="vb-block">${hinweis}</div>`;
}

function tile(item) {
  return `
    <li>
      <button type="button" class="vb-tile" data-goto-item="${esc(item.id)}" title="${esc(item.name)}">
        <span class="vb-tile__thumb" style="--vb-ratio: ${ratioCss(item.ratio)}">${icon(ITEM_ICON[item.type] || 'document')}</span>
        <span class="vb-tile__name">${esc(item.name)}</span>
      </button>
    </li>`;
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
      ? (folder.items.length
        ? 'Jedes Seitenverhältnis liegt als eigene Datei vor. Die Dateien sind freigegeben.'
        : 'Hier liegen die freigegebenen Dateien. Lege eine finale Datei ab oder gib eine Datei aus einer Feedbackschleife frei.')
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

/** Inhalt des Detailbereichs je tiefster Auswahl. */
export function renderDetail(ctx) {
  const { koop, row, folder, item } = ctx.resolved;
  if (koop && row && folder && item) return detailItem(ctx);
  if (koop && row && folder) return detailOrdner(ctx);
  if (koop && row) return detailVideo(ctx);
  if (koop) return detailKooperation(ctx);
  return detailAnstehend(ctx);
}
