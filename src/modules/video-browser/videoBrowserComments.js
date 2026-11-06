// videoBrowserComments.js
// Kommentare im Detailbereich: Entwürfe, Zeitstempel-Checkbox, Speichern, Hervorheben.
// Alle Funktionen bekommen den VideoBrowser-Controller (`vb`).

import { saveZeitkommentar } from './VideoBrowserAdapter.js';
import { buildTree, commentsForAsset, cssEscape, resolveSelection } from './videoBrowserLogic.js';
import { commentHtml } from './videoBrowserRender.js';

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
  const label = vb.detailInner?.querySelector('[data-vb-pin-time]');
  if (label) label.textContent = fmt(sec);
  const pin = vb.detailInner?.querySelector('[data-vb-pin]');
  if (!pin || vb.drafts[assetId]?.pinTouched) return;
  pin.checked = sec > 0.05;
}

/** 42501 = RLS, 42P01/PGRST205 = Tabelle fehlt (Migration nicht eingespielt). */
function saveErrorText(err) {
  if (err?.code === '42501') return 'Keine Berechtigung, hier zu kommentieren.';
  if (err?.code === '42P01' || err?.code === 'PGRST205') return 'Kommentare sind noch nicht eingerichtet. Bitte Support informieren.';
  return 'Kommentar konnte nicht gespeichert werden.';
}

export async function submitComment(vb, form) {
  if (!form || form.dataset.busy) return;
  const { row, folder, item } = resolveSelection(vb.tree, vb.sel);
  if (!row || !folder || !item) return;
  const textEl = form.querySelector('[data-vb-comment-text]');
  const text = textEl.value.trim();
  if (!text) { textEl.focus(); return; }
  const pinned = form.querySelector('[data-vb-pin]')?.checked;
  const timecodeSec = pinned && vb.player ? vb.player.getTime() : null;

  form.dataset.busy = '1';
  const send = form.querySelector('[data-vb-comment-send]');
  if (send) send.disabled = true;
  try {
    const saved = await saveZeitkommentar({
      videoId: row.id,
      runde: folder.number,
      assetId: item.id,
      text,
      timecodeSec,
      isKunde: !vb.team
    });
    vb.raw.zeitkommentare = [...(vb.raw.zeitkommentare || []), saved];
    vb.tree = buildTree(vb.raw, { team: vb.team });
    delete vb.drafts[item.id];
    textEl.value = '';

    const comments = commentsForAsset(resolveSelection(vb.tree, vb.sel).row.comments, folder.number, item.id);
    const created = comments.find(c => c.id === saved.id);
    const list = vb.detailInner.querySelector('[data-vb-comments]');
    if (created && list) {
      vb.detailInner.querySelector('[data-vb-comments-empty]')?.remove();
      list.insertAdjacentHTML('beforeend', commentHtml(created));
      const el = list.lastElementChild;
      vb.player?.setMarkers(comments);
      vb.motion.commentIn(el, created.timecodeSec !== null ? vb.player?.markerEl(created.id) : null);
      el.scrollIntoView?.({ block: 'nearest' });
    }
  } catch (err) {
    console.error('VideoBrowser: Kommentar speichern fehlgeschlagen', err?.code, err?.message || err);
    vb.toast('error', saveErrorText(err));
  } finally {
    delete form.dataset.busy;
    if (send) send.disabled = false;
  }
}

export function highlightComment(vb, commentId) {
  vb.detailInner.querySelectorAll('.vb-comment.is-active').forEach(el => el.classList.remove('is-active'));
  const el = vb.detailInner.querySelector(`.vb-comment[data-comment-id="${cssEscape(String(commentId))}"]`);
  el?.classList.add('is-active');
  el?.scrollIntoView?.({ block: 'nearest' });
}
