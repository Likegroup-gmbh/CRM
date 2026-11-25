// videoBrowserDetailEvents.js
// Events im Detailbereich einer Datei: Caption, Titel, Tags, Final-Leiste, Kunden-Freigabe, Download,
// Kommentare und Sprung an einen Timecode. Dieselben Handler hängen am Ordner (videoBrowserEvents.js)
// und an der Vollansicht; sie wirken über videoBrowserHost.js im jeweils aktiven Detailbereich.
// Jeder Handler liefert true, wenn das Ereignis ihm gehörte.

import { download, promoteWithSlot, toggleFinal } from './videoBrowserActions.js';
import { freigabeAusfuehren } from './videoBrowserFreigabe.js';
import { highlightComment, setDraftPin, setDraftText, submitComment } from './videoBrowserComments.js';
import { openTagField } from './videoBrowserTagField.js';
import { removeTag } from './videoBrowserTags.js';
import {
  cancelCaptionEdit, commitCaption, copyCaption, onCaptionInput, startCaptionEdit, toggleCaptionOpen
} from './videoBrowserCaption.js';
import { commitRename, endRename, startRename } from './videoBrowserRename.js';
import { detailPlayer } from './videoBrowserHost.js';

export function onDetailClick(vb, e) {
  const t = e.target;
  if (t.closest('[data-vb-caption-copy]')) { void copyCaption(vb); return true; }
  if (t.closest('[data-vb-caption-more]')) { toggleCaptionOpen(vb); return true; }
  if (t.closest('[data-vb-caption-view]')) { startCaptionEdit(vb); return true; }

  const slotBtn = t.closest('[data-vb-promote-slot]');
  if (slotBtn) {
    void promoteWithSlot(vb, slotBtn.closest('[data-vb-promote-wrap]')?.querySelector('[data-vb-final-toggle]'), slotBtn.dataset.vbPromoteSlot);
    return true;
  }
  const finalToggle = t.closest('[data-vb-final-toggle]');
  if (finalToggle) {
    void toggleFinal(vb, { button: finalToggle, source: 'bar' });
    return true;
  }
  const kundenFreigabe = t.closest('[data-vb-kunde-freigeben]');
  if (kundenFreigabe) {
    void freigabeAusfuehren(vb, kundenFreigabe);
    return true;
  }

  if (t.closest('[data-vb-tag-open]')) { openTagField(vb); return true; }
  const tagRemove = t.closest('[data-vb-tag-remove]');
  if (tagRemove) {
    void removeTag(vb, tagRemove.dataset.vbTagRemove);
    return true;
  }

  const downloadBtn = t.closest('[data-vb-download]');
  if (downloadBtn) {
    void download(vb, downloadBtn);
    return true;
  }

  // Der Titel ist selbst klickbar (Team), wie das Stift-Icon
  if (t.closest('[data-vb-asset-title]') && vb.canUpload && !vb.renaming) {
    startRename(vb);
    return true;
  }
  if (t.closest('[data-vb-edit]')) {
    if (vb.renaming) void commitRename(vb);
    else startRename(vb);
    return true;
  }

  const seek = t.closest('.vb-comment [data-seek]');
  const player = detailPlayer(vb);
  if (seek && player) {
    player.seek(Number(seek.dataset.seek));
    highlightComment(vb, seek.closest('.vb-comment').dataset.commentId);
    return true;
  }
  return false;
}

export function onDetailSubmit(vb, e) {
  const form = e.target.closest('[data-vb-comment-form]');
  if (!form) return false;
  e.preventDefault();
  void submitComment(vb, form);
  return true;
}

export function onDetailInput(vb, e) {
  const caption = e.target.closest('[data-vb-caption]');
  if (caption) {
    onCaptionInput(vb, caption);
    return true;
  }
  const text = e.target.closest('[data-vb-comment-text]');
  if (!text) return false;
  setDraftText(vb, text.closest('[data-vb-comment-form]').dataset.assetId, text.value);
  return true;
}

export function onDetailChange(vb, e) {
  const pin = e.target.closest('[data-vb-pin]');
  if (!pin) return false;
  setDraftPin(vb, pin.closest('[data-vb-comment-form]').dataset.assetId, pin.checked);
  return true;
}

/** Titel, Caption und Kommentar per Tastatur. Esc in diesen Feldern bricht nur das Feld ab. */
export function onDetailKeydown(vb, e) {
  if (e.target.closest('[data-vb-title-input]')) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void commitRename(vb);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      endRename(vb);
    }
    return true;
  }
  const captionField = e.target.closest('[data-vb-caption]');
  if (captionField) {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelCaptionEdit(vb);
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      captionField.blur();
    }
    return true;
  }
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.target.closest('[data-vb-comment-text]')) {
    e.preventDefault();
    void submitComment(vb, e.target.closest('[data-vb-comment-form]'));
    return true;
  }
  return false;
}

/** Der Haken speichert per Klick: das Feld darf vorher nicht durch Blur speichern. */
export function onDetailMousedown(vb, e) {
  if (vb.renaming && e.target.closest('[data-vb-edit]')) e.preventDefault();
}

export function onDetailFocusout(vb, e) {
  if (e.target.closest('[data-vb-title-input]')) void commitRename(vb);
  const caption = e.target.closest('[data-vb-caption]');
  if (caption) void commitCaption(vb, caption);
}
