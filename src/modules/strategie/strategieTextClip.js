// strategieTextClip.js
// Schneidet Beschreibung, Transkript und Caption auf die Bildhoehe.

const CLIP_SELECTOR = '.strategie-text-clip';
const TRUNCATED_CLASS = 'is-truncated';

function clipBody(clip) {
  return clip.querySelector('.strategie-text-clip__body') || clip;
}

function clipContent(clip) {
  return clip.querySelector('.strategie-textarea, .cell-text-readonly');
}

/** Inhalt ragt ueber die sichtbare Clip-Flaeche hinaus. */
export function clipNeedsToggle(clip) {
  if (!clip) return false;
  const content = clipContent(clip);
  const box = clipBody(clip);
  if (!content || !box) return false;
  return content.scrollHeight > box.clientHeight + 1;
}

export function syncRowTextClips(row) {
  if (!row) return;
  row.classList.remove('has-expanded-text');
  row.querySelectorAll(CLIP_SELECTOR).forEach((clip) => {
    clip.classList.remove('is-expanded');
    clip.classList.toggle(TRUNCATED_CLASS, clipNeedsToggle(clip));
  });
}

export function syncAllTextClips(root = document) {
  root.querySelectorAll('.strategie-items-table tr.item-row').forEach(syncRowTextClips);
}

export function bindTextClipEvents(detail) {
  const table = detail._q?.('.strategie-items-table') || document.querySelector('.strategie-items-table');
  if (!table) return;
  requestAnimationFrame(() => syncAllTextClips(table));
}
