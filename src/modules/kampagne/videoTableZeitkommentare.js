// videoTableZeitkommentare.js
// Kommentare aus dem Videos-Tab (mit oder ohne Zeitstempel) stehen in eigener Tabelle.
// Die Feedback-Zelle ihrer Runde zeigt sie schreibgeschützt unter dem Text, ein Klick
// öffnet die Datei im Videos-Tab.

import { VIDEO_FEEDBACK_FIELDS, VIDEO_FEEDBACK_MAX_RUNDE } from '../../core/VideoFeedbackBuckets.js';
import { selectionToSearch } from '../video-browser/videoBrowserSelection.js';

export const ZEITKOMMENTAR_SELECT = 'id, video_id, runde, feedback_typ, text, timecode_sec, asset_id, story_asset_id, still_asset_id, author_name, created_at, deleted_at';

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Ab Version 3 legt der Videos-Tab weitere Schleifen an, die Tabelle hat drei Runden.
function slotRunde(runde) {
  return Math.min(Math.max(Number(runde) || 1, 1), VIDEO_FEEDBACK_MAX_RUNDE);
}

function isLive(c) {
  return !c?.deleted_at && !!String(c?.text || '').trim();
}

export function formatTimecode(sec) {
  if (sec === null || sec === undefined || sec === '') return '';
  const total = Math.max(0, Math.floor(Number(sec) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function zeitkommentareFuerSlot(list, slot) {
  return (list || [])
    .filter(c => isLive(c) && c.feedback_typ === slot.feedback_typ && slotRunde(c.runde) === slot.runde)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

/** Gruppiert geladene Zeilen nach Video. */
export function groupZeitkommentare(rows) {
  const byVideo = {};
  for (const row of rows || []) {
    if (!row?.video_id || !isLive(row)) continue;
    (byVideo[row.video_id] ||= []).push(row);
  }
  return byVideo;
}

/** Liste eines Videos nach einem Realtime-Event (INSERT, UPDATE, Soft-Delete, DELETE). */
export function applyZeitkommentarChange(list, row, { removed = false } = {}) {
  const rest = (list || []).filter(c => c.id !== row?.id);
  if (removed || !isLive(row)) return rest;
  return [...rest, row];
}

/** Datei, an der ein Kommentar hängt (Video, Story oder Bild), sonst null. */
export function zeitkommentarAssetId(c) {
  return c?.asset_id || c?.story_asset_id || c?.still_asset_id || null;
}

/** "Bild" bzw. "Story", wenn der Kommentar nicht am Video hängt. */
export function zeitkommentarArt(c) {
  if (c?.still_asset_id) return 'Bild';
  if (c?.story_asset_id) return 'Story';
  return '';
}

export function renderZeitkommentarList(list, video, slot) {
  const items = zeitkommentareFuerSlot(list, slot).map(c => {
    const tc = formatTimecode(c.timecode_sec);
    const art = zeitkommentarArt(c);
    return `<button type="button" class="feedback-zeit-item" data-action="open-zeitkommentar"
        data-video-id="${escapeHtml(video.id)}" data-kooperation-id="${escapeHtml(video.kooperation_id || '')}"
        data-runde="${escapeHtml(c.runde)}" data-asset-id="${escapeHtml(zeitkommentarAssetId(c) || '')}"
        title="Im Videos-Tab öffnen">
        ${art ? `<span class="feedback-zeit-art">${art}</span>` : ''}
        ${tc ? `<span class="feedback-zeit-tc">${tc}</span>` : ''}
        <span class="feedback-zeit-text">${escapeHtml(String(c.text).trim())}</span>
        <span class="feedback-zeit-author">${escapeHtml(c.author_name || '')}</span>
      </button>`;
  }).join('');
  return `<div class="feedback-zeit-list" data-zeit-video-id="${escapeHtml(video.id)}" data-zeit-field="${slot.field}">${items}</div>`;
}

/** Tauscht die Listen eines Videos im DOM aus, ohne die Textareas anzufassen. */
export function patchZeitkommentarLists(root, video, list) {
  if (!root || !video?.id) return;
  for (const slot of VIDEO_FEEDBACK_FIELDS) {
    root.querySelectorAll(`.feedback-zeit-list[data-zeit-video-id="${video.id}"][data-zeit-field="${slot.field}"]`).forEach(el => {
      el.outerHTML = renderZeitkommentarList(list, video, slot);
    });
  }
}

export function zeitkommentarSelection(btn) {
  const { kooperationId, videoId, runde, assetId } = btn?.dataset || {};
  if (!kooperationId || !videoId) return null;
  return {
    kooperationId,
    videoId,
    folderId: `s${Number(runde) || 1}`,
    itemId: assetId || null
  };
}

/** Videos-Tab mit der Datei des Kommentars öffnen. */
export async function openZeitkommentar(detail, btn) {
  const sel = zeitkommentarSelection(btn);
  if (!detail || !sel) return;
  const search = selectionToSearch(window.location.search, sel);
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${search}${window.location.hash}`);
  const { activateWorkflowTab } = await import('./KampagneDetailWorkflow.js');
  await activateWorkflowTab(detail, 'videos');
}
