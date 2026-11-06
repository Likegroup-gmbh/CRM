// videoBrowserEvents.js
// Event-Verdrahtung des Videos-Tabs: delegierte Listener am Wurzelelement, Klick-Routing und
// Tastatur-Navigation in den Spalten. Alle Funktionen bekommen den Controller (`vb`).

import { clearFrom, ersterOffenerInhalt, selectLevel } from './videoBrowserLogic.js';
import { deleteItem, download, promoteItem, unmarkItem } from './videoBrowserActions.js';
import { highlightComment, setDraftPin, setDraftText, submitComment } from './videoBrowserComments.js';
import { bindDropzone } from './videoBrowserDropzone.js';
import { commitRename, endRename, startRename } from './videoBrowserRename.js';
import { startUpload } from './videoBrowserUploadState.js';

export function bindEvents(vb) {
  const on = (target, type, handler, opts) => {
    target.addEventListener(type, handler, opts);
    vb.cleanups.push(() => target.removeEventListener(type, handler, opts));
  };

  on(vb.root, 'click', (e) => onClick(vb, e));
  on(vb.colsEl, 'keydown', (e) => onColsKey(vb, e));
  on(vb.root, 'submit', (e) => {
    const form = e.target.closest('[data-vb-comment-form]');
    if (!form) return;
    e.preventDefault();
    void submitComment(vb, form);
  });
  on(vb.root, 'input', (e) => {
    const text = e.target.closest('[data-vb-comment-text]');
    if (!text) return;
    setDraftText(vb, text.closest('[data-vb-comment-form]').dataset.assetId, text.value);
  });
  on(vb.root, 'change', (e) => {
    const pin = e.target.closest('[data-vb-pin]');
    if (pin) {
      setDraftPin(vb, pin.closest('[data-vb-comment-form]').dataset.assetId, pin.checked);
      return;
    }
    const input = e.target.closest('[data-vb-file]');
    if (input) {
      startUpload(vb, [...input.files]);
      input.value = '';
    }
  });
  on(vb.root, 'keydown', (e) => {
    if (e.target.closest('[data-vb-title-input]')) {
      if (e.key === 'Enter') {
        e.preventDefault();
        void commitRename(vb);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        endRename(vb);
      }
      return;
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.target.closest('[data-vb-comment-text]')) {
      e.preventDefault();
      void submitComment(vb, e.target.closest('[data-vb-comment-form]'));
    }
  });
  // Der Haken speichert per Klick: das Feld darf vorher nicht durch Blur speichern.
  on(vb.root, 'mousedown', (e) => {
    if (vb.renaming && e.target.closest('[data-vb-edit]')) e.preventDefault();
  });
  on(vb.root, 'focusout', (e) => {
    if (e.target.closest('[data-vb-title-input]')) void commitRename(vb);
  });
  on(vb.root, 'dblclick', (e) => {
    if (e.target.closest('[data-vb-asset-title]') && !vb.renaming) startRename(vb);
  });

  bindDropzone(vb, on);
}

function onClick(vb, e) {
  const rowBtn = e.target.closest('.vb-col .vb-row[data-depth]');
  if (rowBtn && !rowBtn.classList.contains('vb-row--upload')) {
    const depth = Number(rowBtn.dataset.depth);
    vb._select(selectLevel(vb.sel, depth, rowBtn.dataset.id), { focus: { depth, id: rowBtn.dataset.id }, autoItem: depth === 2 });
    return;
  }

  const slotBtn = e.target.closest('[data-vb-promote-slot]');
  if (slotBtn) {
    const mainBtn = slotBtn.closest('[data-vb-promote-wrap]')?.querySelector('[data-vb-promote]');
    if (mainBtn) void promoteItem(vb, mainBtn, slotBtn.dataset.vbPromoteSlot);
    return;
  }

  const promoteBtn = e.target.closest('[data-vb-promote]');
  if (promoteBtn) {
    void promoteItem(vb, promoteBtn);
    return;
  }

  const unmarkBtn = e.target.closest('[data-vb-unmark]');
  if (unmarkBtn) {
    void unmarkItem(vb, unmarkBtn);
    return;
  }

  const downloadBtn = e.target.closest('[data-vb-download]');
  if (downloadBtn) {
    void download(vb, downloadBtn);
    return;
  }

  if (e.target.closest('[data-vb-edit]')) {
    if (vb.renaming) void commitRename(vb);
    else startRename(vb);
    return;
  }

  const remove = e.target.closest('[data-vb-delete]');
  if (remove) {
    void deleteItem(vb, remove);
    return;
  }

  const keep = e.target.closest('[data-path-keep]');
  if (keep) {
    vb._select(clearFrom(vb.sel, Number(keep.dataset.pathKeep)));
    return;
  }

  const back = e.target.closest('[data-vb-back]');
  if (back) {
    const depth = Number(back.closest('.vb-col').dataset.depth);
    vb._select(clearFrom(vb.sel, depth - 1));
    return;
  }

  if (e.target.closest('[data-vb-first-open]')) {
    const first = ersterOffenerInhalt(vb.tree);
    if (first) vb._select(first);
    return;
  }

  const seek = e.target.closest('.vb-comment [data-seek]');
  if (seek && vb.player) {
    vb.player.seek(Number(seek.dataset.seek));
    highlightComment(vb, seek.closest('.vb-comment').dataset.commentId);
    return;
  }

  const zone = e.target.closest('[data-vb-dropzone]');
  if (zone && !e.target.closest('[data-vb-file]')) {
    zone.querySelector('[data-vb-file]')?.click();
    return;
  }

  const goto = e.target.closest('[data-goto-koop], [data-goto-video], [data-goto-folder], [data-goto-item]');
  if (goto) gotoFromAttrs(vb, goto);
}

function gotoFromAttrs(vb, el) {
  const { gotoKoop, gotoVideo, gotoFolder, gotoItem } = el.dataset;
  let next = { ...vb.sel };
  if (gotoKoop) next = selectLevel(next, 0, gotoKoop);
  if (gotoVideo) next = selectLevel(next, 1, gotoVideo);
  if (gotoFolder) next = selectLevel(next, 2, gotoFolder);
  if (gotoItem) next = selectLevel(next, 3, gotoItem);
  vb._select(next, { autoItem: !!gotoFolder && !gotoItem });
}

function onColsKey(vb, e) {
  const rowEl = e.target.closest('.vb-row[data-depth]');
  if (!rowEl || rowEl.classList.contains('vb-row--upload')) return;
  const col = rowEl.closest('.vb-col');
  const depth = Number(rowEl.dataset.depth);
  const rows = [...col.querySelectorAll('.vb-row[data-depth]:not(.vb-row--upload)')];
  const idx = rows.indexOf(rowEl);

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    rows[idx + (e.key === 'ArrowDown' ? 1 : -1)]?.focus();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    const selectedAlready = rowEl.getAttribute('aria-current') === 'true';
    if (selectedAlready) {
      vb.colsEl.querySelector(`.vb-col[data-depth="${depth + 1}"] .vb-row:not(.vb-row--upload)`)?.focus();
    } else {
      vb._select(selectLevel(vb.sel, depth, rowEl.dataset.id), { focus: { depth: depth + 1 }, autoItem: depth === 2 });
    }
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    vb.colsEl.querySelector(`.vb-col[data-depth="${depth - 1}"] .vb-row.is-selected`)?.focus();
  }
}
