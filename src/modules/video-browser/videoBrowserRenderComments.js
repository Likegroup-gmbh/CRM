// videoBrowserRenderComments.js
// Tab "Kommentare" einer Datei: Liste, Eingabe mit Zeitstempel, einzelner Kommentar.

import { escapeHtml as esc } from '../../core/format.js';
import { formatTime } from '../../core/media/mediaPlayerIcons.js';
import { commentsForAsset, formatDatum, kommentarZiel } from './videoBrowserLogic.js';

const isoOf = (value) => {
  const t = new Date(value);
  return Number.isNaN(t.getTime()) ? '' : t.toISOString();
};

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

/** Kommentare, die zu dieser Datei gehören (bei finalen Dateien die ihrer Quelle, leer bei Rohmaterial). */
export function commentsOf(row, item) {
  const ziel = kommentarZiel(row, item);
  return ziel ? commentsForAsset(row.comments, ziel.runde, ziel.assetId, ziel.type) : [];
}

const KOMMENTIERBAR = new Set(['video', 'story', 'still']);

/**
 * Inhalt des Tabs. Die Kommentare gehören der Datei, geschrieben wird in der offenen Runde.
 * Finale Dateien bleiben immer kommentierbar, auch wenn ihre Quelle in einer älteren Schleife liegt.
 */
export function commentsPanelHtml(ctx) {
  const { row, folder, item } = ctx.resolved;
  const comments = commentsOf(row, item);
  const canWrite = ctx.canComment && KOMMENTIERBAR.has(item.type) && !!kommentarZiel(row, item)
    && (item.isFinal || folder.offen) && row.kannKommentieren;
  // Bilder haben keine Zeitleiste, also keinen Zeitstempel
  const mitZeit = item.type !== 'still';
  // Zeitstempel: erst an, wenn der Playhead bewegt wurde (macht der Controller über onTime).
  // Nur eine bewusste Wahl des Nutzers bleibt über ein Neu-Rendern erhalten.
  const draft = ctx.drafts?.[item.id] || { text: '', pinned: false, pinTouched: false };
  const pinned = draft.pinTouched && draft.pinned;
  return `
      <section class="vb-comments">
        <h5 class="vb-detail__eyebrow">Kommentare</h5>
        <ul class="vb-comment-list" data-vb-comments>${comments.map(commentHtml).join('')}</ul>
        ${comments.length ? '' : '<p class="vb-empty" data-vb-comments-empty>Noch keine Kommentare.</p>'}
        ${canWrite ? `
        <form class="vb-comment-form" data-vb-comment-form data-asset-id="${esc(item.id)}">
          <label class="vb-visually-hidden" for="vb-comment-text">Kommentar</label>
          <textarea class="form-input vb-comment-form__text" id="vb-comment-text" rows="3" placeholder="Feedback schreiben ..." aria-describedby="vb-comment-hint" data-vb-comment-text>${esc(draft.text)}</textarea>
          ${mitZeit ? `<label class="vb-comment-form__pin"><input type="checkbox" data-vb-pin${pinned ? ' checked' : ''} /> Zeitstempel anhängen <span class="vb-comment-form__pin-time" data-vb-pin-time>0:00</span></label>` : ''}
          <div class="vb-comment-form__actions">
            <span class="vb-comment-form__hint" id="vb-comment-hint"><kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>Enter</kbd></span>
            <button type="submit" class="mdc-btn" data-vb-comment-send>Senden</button>
          </div>
        </form>` : '<p class="vb-info">Kommentare abgeschlossener Feedbackschleifen sind nur noch lesbar.</p>'}
      </section>`;
}
