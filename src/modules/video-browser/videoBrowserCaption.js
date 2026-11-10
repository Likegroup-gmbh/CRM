// videoBrowserCaption.js
// Caption des Kooperationsvideos im Videos-Tab (kooperation_videos.caption, dieselbe Spalte wie im
// Kooperationstab). Eigener Inhaltsblock in voller Breite unter den Eigenschaften:
//   Lesen      Text ohne Rahmen, nach 5 Zeilen gekürzt ("Mehr anzeigen"), #Hashtags und @Mentions gedämpft
//   Bearbeiten Klick (Team) macht den Text zur mitwachsenden Textarea; Blur speichert, Esc bricht ab
//   Kopfzeile  Label, Geltungsbereich, "Gespeichert", Kopieren (Haken + "Kopiert")
// Kunden lesen nur. Zustand liegt in `vb.captionEdit` und `vb.captionOpen`.

import { icon } from '../../core/icons/IconSystem.js';
import { escapeHtml as esc } from '../../core/format.js';
import { saveVideoCaption } from './VideoBrowserAdapter.js';
import { cssEscape } from './videoBrowserLogic.js';

/** Instagram-Limit, der Zähler zeigt es nur beim Bearbeiten. */
export const CAPTION_MAX = 2200;
const SAVED_MS = 1800;
const COPIED_MS = 1600;

const TAG_RE = /(^|[\s(])([#@][\p{L}\p{N}_]+(?:\.[\p{L}\p{N}_]+)*)/gu;

/** Text escapen und Hashtags/@-Mentions dezent auszeichnen. Zeilenumbrüche bleiben über pre-wrap. */
export function captionTextHtml(text) {
  return esc(text || '').replace(TAG_RE, '$1<span class="vb-caption__tag">$2</span>');
}

export function captionCount(value) {
  return `${[...String(value || '')].length.toLocaleString('de-DE')} / ${CAPTION_MAX.toLocaleString('de-DE')}`;
}

function copyButtonHtml(hasText) {
  return `<button type="button" class="vb-caption__copy" data-vb-caption-copy aria-label="Caption kopieren" title="Caption kopieren"${hasText ? '' : ' hidden'}>
    <span class="vb-caption__copy-icon" aria-hidden="true">${icon('clipboard-document')}</span>
    <span class="vb-caption__copy-check" aria-hidden="true">${icon('check')}</span>
    <span class="vb-caption__copy-label" aria-live="polite"></span>
  </button>`;
}

/** Inhalt im Lesemodus: Text bzw. Platzhalter, dazu "Mehr anzeigen". */
export function captionViewHtml(caption, { editable, open = false }) {
  const value = String(caption || '');
  const filled = !!value.trim();
  const more = `<button type="button" class="vb-caption__more" data-vb-caption-more aria-expanded="${open}" hidden>${open ? 'Weniger anzeigen' : 'Mehr anzeigen'}</button>`;
  const text = filled
    ? `<div class="vb-caption__text" data-vb-caption-text>${captionTextHtml(value)}</div>`
    : '<div class="vb-caption__text vb-caption__text--empty">Caption hinzufügen…</div>';
  if (!editable) return `${text}${filled ? more : ''}`;
  return `<div class="vb-caption__view" role="button" tabindex="0" data-vb-caption-view title="Caption bearbeiten">${text}</div>${filled ? more : ''}`;
}

function captionEditHtml(value) {
  return `
    <textarea class="vb-caption__input" data-vb-caption rows="1" aria-label="Caption" placeholder="Caption hinzufügen…">${esc(value)}</textarea>
    <div class="vb-caption__foot">
      <span class="vb-caption__hint">Esc bricht ab</span>
      <span class="vb-caption__count" data-vb-caption-count>${captionCount(value)}</span>
    </div>`;
}

/**
 * Block: Kopfzeile plus Inhalt. Fürs Team immer da (leer mit Platzhalter), für Kunden nur mit Text.
 * @param {{ editable: boolean, open?: boolean, scope?: string }} opts
 */
export function captionFieldHtml(row, { editable, open = false, scope = '' }) {
  const value = row?.caption || '';
  if (!editable && !value.trim()) return '';
  return `
    <section class="vb-caption${open ? ' is-open' : ''}" data-vb-caption-block data-video-id="${esc(row.id)}" aria-label="Caption">
      <header class="vb-caption__head">
        <h5 class="vb-caption__label">Caption</h5>
        ${scope ? `<span class="vb-caption__scope">${esc(scope)}</span>` : ''}
        <span class="vb-caption__saved" data-vb-caption-saved role="status" hidden>Gespeichert</span>
        ${copyButtonHtml(!!value.trim())}
      </header>
      <div class="vb-caption__content" data-vb-caption-content>${captionViewHtml(value, { editable, open })}</div>
    </section>`;
}

/* ---- Hilfen ---- */

function rowById(vb, videoId) {
  for (const koop of vb.tree?.kooperationen || []) {
    const row = koop.rows.find(r => r.id === videoId);
    if (row) return row;
  }
  return null;
}

const blockOf = (vb, videoId) =>
  vb.detailInner?.querySelector(`[data-vb-caption-block][data-video-id="${cssEscape(videoId)}"]`) || null;

function grow(field) {
  field.style.height = 'auto';
  field.style.height = `${field.scrollHeight}px`;
}

function setCopyVisible(block, hasText) {
  const btn = block?.querySelector('[data-vb-caption-copy]');
  if (btn) btn.hidden = !hasText;
}

/** Gekürzt wird per CSS. Ob etwas fehlt, weiß nur das Layout: Knopf und Fade erst dann zeigen. */
function measureClamp(block) {
  const text = block?.querySelector('[data-vb-caption-text]');
  const more = block?.querySelector('[data-vb-caption-more]');
  if (!text || !more) return;
  if (block.classList.contains('is-open')) { more.hidden = false; return; }
  const overflow = text.scrollHeight > text.clientHeight + 1;
  block.classList.toggle('is-overflow', overflow);
  more.hidden = !overflow;
}

/** Nach jedem Render: Kürzung messen, auch wenn der Tab erst später sichtbar wird. */
export function syncCaptionClamp(vb) {
  vb._captionRO?.disconnect();
  vb._captionRO = null;
  const block = vb.detailInner?.querySelector('[data-vb-caption-block]');
  if (!block) return;
  measureClamp(block);
  if (typeof ResizeObserver === 'undefined') return;
  const text = block.querySelector('[data-vb-caption-text]');
  if (!text) return;
  vb._captionRO = new ResizeObserver(() => measureClamp(block));
  vb._captionRO.observe(text);
}

function showView(vb, videoId, { focus = false } = {}) {
  const block = blockOf(vb, videoId);
  const row = rowById(vb, videoId);
  if (!block || !row) return;
  const open = vb.captionOpen?.has(videoId) || false;
  block.classList.toggle('is-open', open);
  block.classList.remove('is-editing', 'is-overflow');
  block.querySelector('[data-vb-caption-content]').innerHTML = captionViewHtml(row.caption, { editable: vb.canEditCaption, open });
  setCopyVisible(block, !!(row.caption || '').trim());
  syncCaptionClamp(vb);
  if (focus) block.querySelector('[data-vb-caption-view]')?.focus({ preventScroll: true });
}

function flashSaved(vb, videoId) {
  const label = blockOf(vb, videoId)?.querySelector('[data-vb-caption-saved]');
  if (!label) return;
  label.hidden = false;
  clearTimeout(vb._captionSavedTimer);
  vb._captionSavedTimer = setTimeout(() => { label.hidden = true; }, SAVED_MS);
}

/** Rohdaten, Baum, Kooperationstabelle und deren Store auf dem neuen Text halten. */
function rememberCaption(vb, videoId, value) {
  const stored = value || '';
  const raw = (vb.raw?.videos || []).find(v => v.id === videoId);
  if (raw) raw.caption = stored || null;
  const row = rowById(vb, videoId);
  if (row) row.caption = stored;
  vb.detail?.store?.updateVideo?.(videoId, { caption: stored || null });
  const cell = document.querySelector(
    `textarea[data-entity="video"][data-id="${cssEscape(videoId)}"][data-field="caption"]`
  );
  if (cell && document.activeElement !== cell) cell.value = stored;
}

/* ---- Bearbeiten ---- */

export function startCaptionEdit(vb) {
  if (!vb.canEditCaption || vb.captionEdit) return;
  if (window.getSelection?.()?.toString()) return; // Text markiert (zum Kopieren): nicht ins Bearbeiten springen
  const block = vb.detailInner?.querySelector('[data-vb-caption-block]');
  if (!block) return;
  const videoId = block.dataset.videoId;
  const row = rowById(vb, videoId);
  if (!row) return;
  const value = row.caption || '';
  block.classList.add('is-editing');
  block.querySelector('[data-vb-caption-content]').innerHTML = captionEditHtml(value);
  const field = block.querySelector('[data-vb-caption]');
  vb.captionEdit = { videoId, field, original: value, busy: false };
  grow(field);
  field.focus();
  field.setSelectionRange(value.length, value.length);
}

export function onCaptionInput(vb, field) {
  const block = field.closest('[data-vb-caption-block]');
  grow(field);
  const count = block?.querySelector('[data-vb-caption-count]');
  if (count) {
    count.textContent = captionCount(field.value);
    count.classList.toggle('is-over', [...field.value].length > CAPTION_MAX);
  }
  setCopyVisible(block, !!field.value.trim());
}

/** Esc: Entwurf verwerfen, Lesemodus mit dem gespeicherten Text. */
export function cancelCaptionEdit(vb) {
  const edit = vb.captionEdit;
  if (!edit) return;
  vb.captionEdit = null;
  showView(vb, edit.videoId, { focus: true });
}

/** Blur: unveränderter Text schreibt nichts, sonst speichern und zurück in den Lesemodus. */
export async function commitCaption(vb, field) {
  const edit = vb.captionEdit;
  if (!edit || edit.field !== field || edit.busy) return;
  const { videoId } = edit;
  const value = field.value.trim();
  const before = (rowById(vb, videoId)?.caption || '').trim();

  if (value === before) {
    vb.captionEdit = null;
    showView(vb, videoId);
    return;
  }

  edit.busy = true;
  field.readOnly = true;
  field.classList.remove('has-error');
  try {
    const saved = await saveVideoCaption(videoId, value);
    rememberCaption(vb, videoId, saved || '');
    if (vb.destroyed) return;
    if (vb.captionEdit === edit) {
      vb.captionEdit = null;
      showView(vb, videoId);
    }
    flashSaved(vb, videoId);
  } catch (err) {
    console.error('VideoBrowser: Caption speichern fehlgeschlagen', err);
    vb.toast('error', 'Caption konnte nicht gespeichert werden.');
    // Der Text bleibt im Feld, der nächste Blur versucht es erneut
    edit.busy = false;
    field.readOnly = false;
    field.classList.add('has-error');
  }
}

/* ---- Kürzung und Kopieren ---- */

export function toggleCaptionOpen(vb) {
  const block = vb.detailInner?.querySelector('[data-vb-caption-block]');
  if (!block) return;
  const videoId = block.dataset.videoId;
  if (!vb.captionOpen) vb.captionOpen = new Set();
  const open = !vb.captionOpen.has(videoId);
  if (open) vb.captionOpen.add(videoId); else vb.captionOpen.delete(videoId);
  block.classList.toggle('is-open', open);
  const more = block.querySelector('[data-vb-caption-more]');
  if (more) {
    more.textContent = open ? 'Weniger anzeigen' : 'Mehr anzeigen';
    more.setAttribute('aria-expanded', String(open));
  }
  measureClamp(block);
}

export async function copyCaption(vb) {
  const block = vb.detailInner?.querySelector('[data-vb-caption-block]');
  if (!block) return;
  const field = block.querySelector('[data-vb-caption]');
  const text = (field ? field.value : rowById(vb, block.dataset.videoId)?.caption || '').trim();
  if (!text) return;
  const btn = block.querySelector('[data-vb-caption-copy]');
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error('VideoBrowser: Caption kopieren fehlgeschlagen', err);
    vb.toast('error', 'Caption konnte nicht kopiert werden.');
    return;
  }
  if (!btn) return;
  btn.classList.add('is-copied');
  btn.querySelector('.vb-caption__copy-label').textContent = 'Kopiert';
  clearTimeout(vb._captionCopiedTimer);
  vb._captionCopiedTimer = setTimeout(() => {
    btn.classList.remove('is-copied');
    btn.querySelector('.vb-caption__copy-label').textContent = '';
  }, COPIED_MS);
}
