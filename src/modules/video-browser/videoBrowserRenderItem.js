// videoBrowserRenderItem.js
// Detailbereich einer einzelnen Datei: Kopf mit Aktionen, Player-Host, Format-Umschalter,
// Verlauf der Variante und Kommentare.

import { escapeHtml as esc } from '../../core/format.js';
import { icon } from '../../core/icons/IconSystem.js';
import { formatTime } from '../../core/media/mediaPlayerIcons.js';
import {
  FINAL_FORMATE,
  FINAL_NAME,
  collectDownloadItems,
  commentsForAsset,
  formatDatum,
  schleifeName,
  verlaufFor
} from './videoBrowserLogic.js';
import { iconButton, schleifenText, statusBadge } from './videoBrowserRenderParts.js';

const isoOf = (value) => {
  const t = new Date(value);
  return Number.isNaN(t.getTime()) ? '' : t.toISOString();
};

/** Finale Dateien dieses Videos, die aus der gewählten Datei entstanden sind (Verweis über source_asset_id). */
function markedFinals(row, item) {
  return (row.folders.find(f => f.kind === 'final')?.items || [])
    .filter(f => f.asset?.source_asset_id === item.id && f.type === item.type);
}

/**
 * Der Weg zur Finalen Version, nur fürs Team:
 *  - Datei einer Feedbackschleife: Primär-Button "Als finale Version freigeben" (Format erkennt
 *    das System aus der Datei; nur wenn es keins findet, fragt das Menü danach).
 *  - schon freigegeben: Badge mit Format und "Final aufheben".
 *  - freigegebene Datei im Ordner Finale Version: "Final aufheben" (nur, wenn sie aus einer
 *    Feedbackschleife stammt; hochgeladene Finale löscht man).
 */
function promoteControl(ctx, row, item) {
  if (!ctx.canUpload || item.type === 'roh') return '';

  if (item.isFinal) {
    if (!item.asset?.source_asset_id) return '';
    return `<button type="button" class="mdc-btn mdc-btn--secondary" data-vb-unmark="${esc(item.id)}">${icon('x-mark')}<span>Final aufheben</span></button>`;
  }

  const marked = markedFinals(row, item);
  if (marked.length) {
    const label = item.type === 'still' ? 'Final' : `Final · ${marked.map(m => m.ratio).join(', ')}`;
    return `
      <span class="status-badge success vb-status">${esc(label)}</span>
      <button type="button" class="mdc-btn mdc-btn--secondary" data-vb-unmark="${esc(marked[0].id)}">${icon('x-mark')}<span>Final aufheben</span></button>`;
  }

  const menu = item.type === 'still' ? '' : `
      <div class="vb-promote__menu" data-vb-promote-menu role="menu" hidden>
        <p class="vb-promote__hint">Format nicht erkannt. Welches Seitenverhältnis hat die Datei?</p>
        ${FINAL_FORMATE.map(r => `<button type="button" class="vb-promote__slot" role="menuitem" data-vb-promote-slot="${r}">${r}</button>`).join('')}
      </div>`;
  return `
    <div class="vb-promote" data-vb-promote-wrap>
      <button type="button" class="mdc-btn" data-vb-promote>${icon('check')}<span>Als finale Version freigeben</span></button>${menu}
    </div>`;
}

/** Herunterladen für alle mit Download-Recht, Titel bearbeiten und Löschen nur fürs Team. */
function assetActions(ctx, row, item) {
  const buttons = [];
  if (ctx.canDownload && collectDownloadItems('item', ctx.resolved).length) {
    buttons.push(iconButton('download', 'Herunterladen', 'data-vb-download="item"'));
  }
  if (ctx.canUpload) {
    buttons.push(iconButton('pencil-square', 'Titel bearbeiten', 'data-vb-edit'));
    buttons.push(iconButton('trash', 'Löschen', 'data-vb-delete', ' vb-icon-btn--danger'));
  }
  const promote = row ? promoteControl(ctx, row, item) : '';
  const icons = buttons.length ? `<div class="vb-asset-head__actions">${buttons.join('')}</div>` : '';
  if (!promote) return icons;
  // Die Freigabe steht links der Icons, damit sie ohne Suchen ins Auge fällt
  return `<div class="vb-asset-head__actions vb-asset-head__actions--main">${promote}${buttons.join('')}</div>`;
}

/** Titel oben, darunter Feedbackschleife und Status, daneben die Aktionen. */
function assetHead(ctx, item, infoHtml) {
  return `
    <section class="vb-block vb-asset-head">
      <h4 class="vb-detail__title vb-asset-head__title" data-vb-asset-title>${esc(item.name)}</h4>
      <div class="vb-asset-head__row">
        <div class="vb-asset-head__info">${infoHtml}</div>
        ${assetActions(ctx, ctx.resolved.row, item)}
      </div>
    </section>`;
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

function verlaufSection(row, item) {
  const verlauf = verlaufFor(row, item);
  if (verlauf.length <= 1) return '';
  return `
    <section class="vb-block">
      <h5 class="vb-detail__eyebrow">Verlauf dieser Variante</h5>
      <ul class="vb-chips">
        ${verlauf.map(v => `<li><button type="button" class="vb-chip${v.current ? ' is-current' : ''}" data-goto-folder="${esc(v.folderId)}" data-goto-item="${esc(v.itemId)}"${v.current ? ' aria-current="true"' : ''}><span class="vb-dot vb-dot--${esc(v.status || 'wartet')}" aria-hidden="true"></span>${esc(v.label)}</button></li>`).join('')}
      </ul>
    </section>`;
}

function commentSection(ctx, row, folder, item) {
  if (item.isFinal) return '';
  const comments = commentsForAsset(row.comments, item.runde, item.id, item.type);
  const canWrite = ctx.canComment && item.type === 'video' && !item.isFinal && folder.current && !folder.closed && row.kannKommentieren;
  // Zeitstempel: erst an, wenn der Playhead bewegt wurde (macht der Controller über onTime).
  // Nur eine bewusste Wahl des Nutzers bleibt über ein Neu-Rendern erhalten.
  const draft = ctx.drafts?.[item.id] || { text: '', pinned: false, pinTouched: false };
  const pinned = draft.pinTouched && draft.pinned;
  // Feedback schreibt man am Video der Runde. Bilder und Stories zeigen die Notizen der Runde.
  const readonlyHint = item.type === 'video'
    ? 'Kommentare abgeschlossener Feedbackschleifen sind nur noch lesbar.'
    : `Feedback zu ${item.type === 'still' ? 'Bildern' : 'Stories'} dieser Runde steht hier, geschrieben wird beim Video.`;
  return `
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

export function detailItem(ctx) {
  const { row, folder, item } = ctx.resolved;

  if (item.type === 'roh') {
    return `
      ${assetHead(ctx, item, item.meta ? `<span class="vb-version">${esc(item.meta)}</span>` : '')}
      <div class="vb-player-host" data-vb-player-host data-asset-id="${esc(item.id)}"></div>`;
  }

  const decision = decisionText(ctx, item, folder);
  const comments = commentSection(ctx, row, folder, item);

  // Kein Kontext-Pfad über dem Titel: den tragen Spaltenköpfe und Pfadleiste.
  // "Version" heißt hier wie überall Feedbackschleife (Glossar).
  const finalLabel = item.type === 'still' ? FINAL_NAME : `${FINAL_NAME} · ${item.ratio}`;
  const info = item.isFinal
    ? `<span class="vb-version" data-vb-asset-version>${esc(finalLabel)}</span>${statusBadge(item.status)}`
    : `<span class="vb-version" data-vb-asset-version>${esc(schleifeName(item.version || 1))}</span>${statusBadge(item.status)}`;

  // Video, Hinweis und Verlauf oben, Kommentare darunter.
  return `
    ${assetHead(ctx, item, info)}
    <div class="vb-item${comments ? ' has-side' : ''}">
      <div class="vb-item__media">
        <div class="vb-player-host" data-vb-player-host data-asset-id="${esc(item.id)}"></div>
        ${decision ? `<p class="vb-decision" data-slot="decision">${esc(decision)}</p>` : '<div class="vb-slot" data-slot="decision"></div>'}
        ${verlaufSection(row, item)}
      </div>
      ${comments ? `<div class="vb-item__side">${comments}</div>` : ''}
    </div>`;
}
