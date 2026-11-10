// videoBrowserRenderComments.js
// Tab "Kommentare" einer Datei: Liste, Eingabe mit Zeitstempel, einzelner Kommentar.

import { escapeHtml as esc } from '../../core/format.js';
import { formatTime } from '../../core/media/mediaPlayerIcons.js';
import { commentsForAsset, formatDatum } from './videoBrowserLogic.js';

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

/** Kommentare, die zu dieser Datei gehören (leer bei Dateien der Finalen Version und Rohmaterial). */
export function commentsOf(row, item) {
  if (!row || !item || item.isFinal || item.type === 'roh') return [];
  return commentsForAsset(row.comments, item.runde, item.id, item.type);
}

/** Inhalt des Tabs. Die Kommentare gehören der Datei, geschrieben wird nur beim Video der offenen Runde. */
export function commentsPanelHtml(ctx) {
  const { row, folder, item } = ctx.resolved;
  const comments = commentsOf(row, item);
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
      <section class="vb-comments">
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
