// videoBrowserComments.js
// Kommentare im Detailbereich: Entwürfe, Zeitstempel-Checkbox, Speichern, Hervorheben.
// Alle Funktionen bekommen den VideoBrowser-Controller (`vb`) und arbeiten im aktiven
// Detailbereich (videoBrowserHost.js): Ordner-Detail oder Vollansicht.

import { saveZeitkommentar } from './VideoBrowserAdapter.js';
import { buildTree, cssEscape, kommentarZiel } from './videoBrowserLogic.js';
import { commentScroller, detailPlayer, detailResolved, detailRoot } from './videoBrowserHost.js';
import { commentHtml } from './videoBrowserRender.js';
import { commentsOf } from './videoBrowserRenderComments.js';

function draftOf(vb, assetId) {
  return vb.drafts[assetId] || { text: '', pinned: false, pinTouched: false };
}

export function setDraftText(vb, assetId, text) {
  const draft = draftOf(vb, assetId);
  draft.text = text;
  vb.drafts[assetId] = draft;
}

export function setDraftPin(vb, assetId, pinned) {
  const draft = draftOf(vb, assetId);
  draft.pinned = pinned;
  draft.pinTouched = true;
  vb.drafts[assetId] = draft;
}

function fmt(sec) {
  const total = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Zeitstempel-Checkbox: an, sobald der Playhead bewegt wurde, solange der Nutzer sie nicht
 * selbst angefasst hat. Bei 0:00 hat noch niemand eine Stelle gewählt.
 */
export function syncPinTime(vb, sec, assetId) {
  const root = detailRoot(vb);
  const label = root?.querySelector('[data-vb-pin-time]');
  if (label) label.textContent = fmt(sec);
  const pin = root?.querySelector('[data-vb-pin]');
  if (!pin || vb.drafts[assetId]?.pinTouched) return;
  pin.checked = sec > 0.05;
}

/**
 * Holt einen Kommentar in den sichtbaren Bereich des Detailbereichs. Bewusst kein scrollIntoView:
 * das scrollt auch overflow:hidden-Vorfahren (Seite, Tab) und schiebt dann den ganzen Inhalt nach oben.
 * Tableiste (oben) und Formular (unten) sind sticky und verdecken Platz.
 */
function revealComment(vb, el) {
  const scroller = commentScroller(vb);
  if (!scroller || !el) return;
  const box = scroller.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const top = box.top + (scroller.querySelector('.vb-tabs__list')?.offsetHeight || 0);
  const bottom = box.bottom - (scroller.querySelector('.vb-comment-form')?.offsetHeight || 0);
  if (r.top < top) scroller.scrollTop -= top - r.top;
  else if (r.bottom > bottom) scroller.scrollTop += r.bottom - bottom;
}

/** 42501 = RLS, 42P01/PGRST205 = Tabelle fehlt (Migration nicht eingespielt). */
function saveErrorText(err) {
  if (err?.code === '42501') return 'Keine Berechtigung, hier zu kommentieren.';
  if (err?.code === '42P01' || err?.code === 'PGRST205') return 'Kommentare sind noch nicht eingerichtet. Bitte Support informieren.';
  return 'Kommentar konnte nicht gespeichert werden.';
}

export async function submitComment(vb, form) {
  if (!form || form.dataset.busy) return;
  const { row, folder, item } = detailResolved(vb);
  if (!row || !folder || !item) return;
  const ziel = kommentarZiel(row, item);
  if (!ziel) return;
  const textEl = form.querySelector('[data-vb-comment-text]');
  const text = textEl.value.trim();
  if (!text) { textEl.focus(); return; }
  const pinned = item.type !== 'still' && !!form.querySelector('[data-vb-pin]')?.checked;
  const timecodeSec = pinned && detailPlayer(vb) ? detailPlayer(vb).getTime() : null;

  form.dataset.busy = '1';
  const send = form.querySelector('[data-vb-comment-send]');
  if (send) send.disabled = true;
  try {
    const saved = await saveZeitkommentar({
      videoId: row.id,
      runde: ziel.runde,
      assetId: ziel.assetId,
      assetType: ziel.type,
      text,
      timecodeSec,
      isKunde: !vb.team
    });
    vb.raw.zeitkommentare = [...(vb.raw.zeitkommentare || []), saved];
    vb.tree = buildTree(vb.raw, { team: vb.team });
    delete vb.drafts[item.id];
    textEl.value = '';

    const neu = detailResolved(vb);
    const comments = commentsOf(neu.row, neu.item);
    const created = comments.find(c => c.id === saved.id);
    const root = detailRoot(vb);
    const player = detailPlayer(vb);
    const list = root?.querySelector('[data-vb-comments]');
    if (created && list) {
      root.querySelector('[data-vb-comments-empty]')?.remove();
      list.insertAdjacentHTML('beforeend', commentHtml(created));
      const el = list.lastElementChild;
      player?.setMarkers(comments);
      vb.motion.commentIn(el, created.timecodeSec !== null ? player?.markerEl(created.id) : null);
      revealComment(vb, el);
    }
    root?.querySelectorAll('[data-vb-tab-count]').forEach((count) => { count.textContent = String(comments.length); });
    if (vb.voll) vb.voll.dirty = true;
    // Zähler der Datei in der Spalte; Detail und Player bleiben stehen
    vb._renderNav();
  } catch (err) {
    console.error('VideoBrowser: Kommentar speichern fehlgeschlagen', err?.code, err?.message || err);
    vb.toast('error', saveErrorText(err));
  } finally {
    delete form.dataset.busy;
    if (send) send.disabled = false;
  }
}

export function highlightComment(vb, commentId) {
  const root = detailRoot(vb);
  if (!root) return;
  root.querySelectorAll('.vb-comment.is-active').forEach(el => el.classList.remove('is-active'));
  const el = root.querySelector(`.vb-comment[data-comment-id="${cssEscape(String(commentId))}"]`);
  el?.classList.add('is-active');
  revealComment(vb, el);
}
