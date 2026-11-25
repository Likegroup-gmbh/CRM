// videoBrowserRenderComments.js
// Tab "Kommentare" einer Datei: Kopf mit Zähler, Eingabe mit Zeitstempel, Liste (neueste zuerst).

import { icon } from '../../core/icons/IconSystem.js';
import { escapeHtml as esc } from '../../core/format.js';
import { formatTime } from '../../core/media/mediaPlayerIcons.js';
import { commentsForAsset, formatDatumZeit, kommentarZeit, kommentarZiel } from './videoBrowserLogic.js';

const isoOf = (value) => {
  const t = new Date(value);
  return Number.isNaN(t.getTime()) ? '' : t.toISOString();
};

const initiale = (name) => (String(name || '').trim().charAt(0) || '?').toUpperCase();

export function commentHtml(c) {
  const rolle = c.author.role === 'kunde' ? 'Kunde' : 'Team';
  const zeit = c.timecodeSec !== null && c.timecodeSec !== undefined
    ? `<button type="button" class="vb-timecode" data-seek="${c.timecodeSec}" aria-label="Zu ${formatTime(c.timecodeSec)} springen">${formatTime(c.timecodeSec)}</button>`
    : '';
  const iso = isoOf(c.createdAt);
  const datum = iso
    ? `<time class="vb-comment__date" datetime="${iso}" title="${esc(formatDatumZeit(c.createdAt))}">${esc(kommentarZeit(c.createdAt))}</time>`
    : '';
  return `
    <li class="vb-comment vb-comment--${c.author.role}" data-comment-id="${esc(c.id)}">
      <span class="vb-comment__avatar" aria-hidden="true">${esc(initiale(c.author.name))}</span>
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

function leerHtml(canWrite, mitZeit) {
  const text = !canWrite
    ? 'Zu dieser Datei wurde nichts kommentiert.'
    : (mitZeit ? 'Mit Zeitstempel landet das Feedback direkt an der Stelle im Video.' : 'Das erste Feedback erscheint hier.');
  return `
        <div class="vb-comments__empty" data-vb-comments-empty>
          ${icon('chat-bubble')}
          <p class="vb-comments__empty-title">Noch kein Feedback</p>
          <p class="vb-comments__empty-text">${esc(text)}</p>
        </div>`;
}

function formHtml(item, draft, { id, mitZeit, pinned }) {
  const pin = mitZeit
    ? `<label class="vb-comment-form__pin" title="Kommentar an die aktuelle Stelle im Video heften"><input type="checkbox" data-vb-pin${pinned ? ' checked' : ''} />${icon('clock')}<span>Zeitstempel anhängen</span> <span class="vb-comment-form__pin-time" data-vb-pin-time>0:00</span></label>`
    : '';
  return `
        <form class="vb-comment-form" data-vb-comment-form data-asset-id="${esc(item.id)}">
          <label class="vb-visually-hidden" for="${id}-comment-text">Kommentar</label>
          <textarea class="form-input vb-comment-form__text" id="${id}-comment-text" rows="3" placeholder="Feedback schreiben ..." aria-describedby="${id}-comment-hint" data-vb-comment-text>${esc(draft.text)}</textarea>
          <div class="vb-comment-form__actions">
            ${pin}
            <span class="vb-visually-hidden" id="${id}-comment-hint">Senden mit Cmd oder Strg und Enter</span>
            <button type="submit" class="mdc-btn mdc-btn--sm" title="Senden (⌘/Ctrl + Enter)" data-vb-comment-send>Senden</button>
          </div>
        </form>`;
}

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
  // Ordner-Detail und Vollansicht können gleichzeitig im DOM stehen: eigene Ids je Bereich
  const id = ctx.idPrefix || 'vb';
  return `
      <section class="vb-comments">
        <h5 class="vb-detail__eyebrow vb-comments__head">Kommentare <span class="vb-comments__count" data-vb-tab-count>${comments.length}</span></h5>
        ${canWrite ? formHtml(item, draft, { id, mitZeit, pinned }) : '<p class="vb-info">Kommentare abgeschlossener Feedbackschleifen sind nur noch lesbar.</p>'}
        <ul class="vb-comment-list" data-vb-comments>${comments.slice().reverse().map(commentHtml).join('')}</ul>
        ${comments.length ? '' : leerHtml(canWrite, mitZeit)}
      </section>`;
}
