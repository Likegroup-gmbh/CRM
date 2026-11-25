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

/**
 * Textarea auf die volle Inhaltshoehe ziehen.
 * field-sizing:content fehlt in Safari vor 26.2 und Firefox vor 152.
 * Ohne feste Hoehe bleibt der Text im Feld selbst abgeschnitten, der Clip
 * zeigt nur eine Zeile statt der Vorschau bis zur Bildhoehe.
 * Messen bei geloestem Clamp, damit scrollHeight nicht die Bildhoehe liefert.
 */
function sizeClipTextarea(clip) {
  const textarea = clip.querySelector('textarea');
  if (!textarea) return;

  const body = clip.querySelector('.strategie-text-clip__body');
  const nodes = body ? [clip, body] : [clip];
  const saved = nodes.map(el => ({
    el,
    maxHeight: el.style.maxHeight,
    height: el.style.height,
    overflow: el.style.overflow,
  }));

  try {
    for (const { el } of saved) {
      el.style.maxHeight = 'none';
      el.style.height = 'auto';
      el.style.overflow = 'visible';
    }
    textarea.style.height = 'auto';
    const full = textarea.scrollHeight;
    if (full > 0) textarea.style.height = `${full}px`;
  } finally {
    for (const { el, maxHeight, height, overflow } of saved) {
      el.style.maxHeight = maxHeight;
      el.style.height = height;
      el.style.overflow = overflow;
    }
  }
}

export function syncRowTextClips(row) {
  if (!row) return;
  row.classList.remove('has-expanded-text');
  row.querySelectorAll(CLIP_SELECTOR).forEach((clip) => {
    clip.classList.remove('is-expanded');
    sizeClipTextarea(clip);
    clip.classList.toggle(TRUNCATED_CLASS, clipNeedsToggle(clip));
  });
}

export function syncAllTextClips(root = document) {
  root.querySelectorAll('.strategie-items-table tr.item-row').forEach(syncRowTextClips);
}

export function bindTextClipEvents(detail) {
  const table = detail._q?.('.strategie-items-table') || document.querySelector('.strategie-items-table');
  if (!table) return;

  const onInput = (e) => {
    const textarea = e.target.closest?.(`${CLIP_SELECTOR} textarea`);
    if (!textarea || !table.contains(textarea)) return;
    syncRowTextClips(textarea.closest('tr'));
  };
  table.addEventListener('input', onInput);
  detail._tableEventListeners?.add(() => table.removeEventListener('input', onInput));

  requestAnimationFrame(() => syncAllTextClips(table));
}
