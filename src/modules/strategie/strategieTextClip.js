// strategieTextClip.js
// Clamp + Augen-Toggle fuer Beschreibung, Transkript und Caption.
// Eine offene Zelle zieht die Row hoch; geschlossene Geschwister fuellen
// die Hoehe und bleiben nur geclampt, wenn ihr Text immer noch laenger ist.

import { icon } from '../../core/icons/IconSystem.js';
import { isSliding, slideHeight } from '../../core/animation/slideHeight.js';

const CLIP_SELECTOR = '.strategie-text-clip';
const EXPANDED_CLASS = 'is-expanded';
const TRUNCATED_CLASS = 'is-truncated';
const ROW_EXPANDED_CLASS = 'has-expanded-text';

function clipBody(clip) {
  return clip.querySelector('.strategie-text-clip__body') || clip;
}

function clipContent(clip) {
  return clip.querySelector('.strategie-textarea, .cell-text-readonly');
}

/** Inhalt ragt ueber die sichtbare Clip-Flaeche hinaus. */
export function clipNeedsToggle(clip) {
  if (!clip || clip.classList.contains(EXPANDED_CLASS)) return false;
  const content = clipContent(clip);
  const box = clipBody(clip);
  if (!content || !box) return false;
  return content.scrollHeight > box.clientHeight + 1;
}

function setClipButtonState(btn, { expanded, overflowing }) {
  const showMore = !expanded;
  btn.hidden = !expanded && !overflowing;
  btn.innerHTML = icon(expanded ? 'eye-closed' : 'eye');
  btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  btn.setAttribute('aria-label', showMore ? 'Mehr anzeigen' : 'Weniger anzeigen');
  btn.title = showMore ? 'Mehr anzeigen' : 'Weniger anzeigen';
}

/**
 * Textarea auf die volle Inhaltshoehe ziehen.
 * field-sizing:content fehlt in Safari vor 26.2 und Firefox vor 152, und auch
 * wo es existiert rechnet es oft nicht neu, wenn der Clip die max-height
 * verliert. Ohne feste Hoehe bleibt der Text in der Textarea selbst
 * abgeschnitten — das Auge schaltet um, sichtbar passiert nichts.
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

function syncClipButton(clip) {
  const btn = clip.querySelector('.strategie-text-more');
  if (!btn) return;

  const expanded = clip.classList.contains(EXPANDED_CLASS);
  if (expanded) {
    clip.classList.remove(TRUNCATED_CLASS);
    setClipButtonState(btn, { expanded: true, overflowing: false });
    return;
  }

  const overflowing = clipNeedsToggle(clip);
  clip.classList.toggle(TRUNCATED_CLASS, overflowing);
  setClipButtonState(btn, { expanded: false, overflowing });
}

function updateRowClipState(row) {
  if (!row) return;
  const clips = [...row.querySelectorAll(CLIP_SELECTOR)];
  row.classList.toggle(
    ROW_EXPANDED_CLASS,
    clips.some(clip => clip.classList.contains(EXPANDED_CLASS))
  );
  clips.forEach(syncClipButton);
}

export function syncRowTextClips(row) {
  if (!row) return;
  row.querySelectorAll(CLIP_SELECTOR).forEach(sizeClipTextarea);
  updateRowClipState(row);
}

function clearInlineHeight(clip) {
  clip.style.height = '';
  clip.style.maxHeight = '';
  clip.style.overflow = '';
}

function thumbHeightPx(clip) {
  const img = clip.closest('tr')?.querySelector(
    '.strategie-screenshot, .strategie-screenshot-placeholder, .idea-placeholder'
  );
  if (img?.offsetHeight) return img.offsetHeight;
  const maxH = getComputedStyle(clip).maxHeight;
  const px = parseFloat(maxH);
  if (Number.isFinite(px) && String(maxH).endsWith('px')) return px;
  return 178;
}

function collapseTargetPx(clip, row) {
  const other = [...row.querySelectorAll(`${CLIP_SELECTOR}.${EXPANDED_CLASS}`)]
    .find(c => c !== clip);
  if (other) return Math.max(other.offsetHeight, thumbHeightPx(clip));
  return thumbHeightPx(clip);
}

function runSlide(clip, opts) {
  const done = slideHeight(clip, opts);
  if (!isSliding(clip)) {
    clearInlineHeight(clip);
    return Promise.resolve();
  }
  return done.then(() => clearInlineHeight(clip));
}

function openClip(clip) {
  if (!clip || clip.classList.contains(EXPANDED_CLASS)) return Promise.resolve();
  const row = clip.closest('tr');
  // Hoehe ziehen, solange der Clip noch zu ist. Sonst ist offsetHeight schon
  // die volle Hoehe und der Slide hat keinen Weg mehr.
  sizeClipTextarea(clip);
  const done = runSlide(clip, { open: true });
  clip.classList.remove(TRUNCATED_CLASS);
  clip.classList.add(EXPANDED_CLASS);
  updateRowClipState(row);
  return done;
}

export function toggleTextClip(clip) {
  if (!clip) return Promise.resolve();
  const row = clip.closest('tr');
  const opening = !clip.classList.contains(EXPANDED_CLASS);

  if (opening) return openClip(clip);

  clip.classList.add(TRUNCATED_CLASS);
  const collapsedPx = collapseTargetPx(clip, row);
  const done = runSlide(clip, { open: false, collapsedPx });
  const finishClose = () => {
    clip.classList.remove(EXPANDED_CLASS);
    clearInlineHeight(clip);
    syncRowTextClips(row);
  };
  if (!isSliding(clip)) {
    finishClose();
    return Promise.resolve();
  }
  return done.then(finishClose);
}

export function expandTextClip(clip) {
  return openClip(clip);
}

export function syncAllTextClips(root = document) {
  root.querySelectorAll('.strategie-items-table tr.item-row').forEach(syncRowTextClips);
}

export function bindTextClipEvents(detail) {
  const table = document.querySelector('.strategie-items-table');
  if (!table) return;

  const onClick = (e) => {
    const btn = e.target.closest('.strategie-text-more');
    if (!btn || !table.contains(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    toggleTextClip(btn.closest(CLIP_SELECTOR));
  };

  const onFocusIn = (e) => {
    const textarea = e.target.closest(`${CLIP_SELECTOR} textarea`);
    if (!textarea || !table.contains(textarea)) return;
    expandTextClip(textarea.closest(CLIP_SELECTOR));
  };

  const onInput = (e) => {
    const textarea = e.target.closest?.(`${CLIP_SELECTOR} textarea`);
    if (!textarea || !table.contains(textarea)) return;
    syncRowTextClips(textarea.closest('tr'));
  };

  table.addEventListener('click', onClick);
  table.addEventListener('focusin', onFocusIn);
  table.addEventListener('input', onInput);
  detail._tableEventListeners.add(() => {
    table.removeEventListener('click', onClick);
    table.removeEventListener('focusin', onFocusIn);
    table.removeEventListener('input', onInput);
  });

  requestAnimationFrame(() => syncAllTextClips(table));
}
