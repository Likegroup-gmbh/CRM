// videoBrowserEvents.js
// Event-Verdrahtung des Videos-Tabs: delegierte Listener am Wurzelelement, Klick-Routing und
// Tastatur-Navigation in den Spalten. Alle Funktionen bekommen den Controller (`vb`).

import { clearFrom, ersterOffenerInhalt, selectLevel } from './videoBrowserLogic.js';
import { deleteItem, download, promoteWithSlot, toggleFinal } from './videoBrowserActions.js';
import { freieDateiOeffnen, ordnerLinkErstellen } from './videoBrowserAblage.js';
import { highlightComment, setDraftPin, setDraftText, submitComment } from './videoBrowserComments.js';
import { bindDropzone } from './videoBrowserDropzone.js';
import { commitFileRename, copyFileName, endFileRename, startFileRename } from './videoBrowserFileRename.js';
import { clearFolderFilter, toggleFolderFilter } from './videoBrowserFilter.js';
import { isActivationKey, onShortcut } from './videoBrowserKeys.js';
import { onTabKeydown, setDetailTab } from './videoBrowserTabs.js';
import { openTagField } from './videoBrowserTagField.js';
import { removeTag } from './videoBrowserTags.js';
import {
  cancelCaptionEdit, commitCaption, copyCaption, onCaptionInput, startCaptionEdit, toggleCaptionOpen
} from './videoBrowserCaption.js';
import { commitRename, endRename, startRename } from './videoBrowserRename.js';
import { startUpload } from './videoBrowserUploadState.js';
import { onSegmentKeydown, onShowcaseClick } from './videoBrowserShowcase.js';
import { onKoopGroupClick, toggleKoopGroup } from './videoBrowserKoopState.js';
import {
  bindRohDrag, rohCheck, rohEinzelnVerschieben, rohMarkierungAufheben, rohMenuUmschalten,
  rohNeuAnlegen, rohNeuOeffnen, rohNeuSchliessen, rohToggle, rohVerschieben
} from './videoBrowserRoh.js';

export function bindEvents(vb) {
  const on = (target, type, handler, opts) => {
    target.addEventListener(type, handler, opts);
    vb.cleanups.push(() => target.removeEventListener(type, handler, opts));
  };

  on(vb.root, 'click', (e) => onClick(vb, e));
  on(vb.colsEl, 'keydown', (e) => onColsKey(vb, e));
  on(vb.root, 'submit', (e) => {
    const rohForm = e.target.closest('[data-vb-roh-neu-form]');
    if (rohForm) {
      e.preventDefault();
      void rohNeuAnlegen(vb, rohForm);
      return;
    }
    const form = e.target.closest('[data-vb-comment-form]');
    if (!form) return;
    e.preventDefault();
    void submitComment(vb, form);
  });
  on(vb.root, 'input', (e) => {
    const caption = e.target.closest('[data-vb-caption]');
    if (caption) {
      onCaptionInput(vb, caption);
      return;
    }
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
      // Upload-Knopf an einem Rohmaterial-Unterordner trägt dessen item_id
      startUpload(vb, [...input.files], { ordnerItemId: input.dataset.ordnerItemId || null });
      input.value = '';
    }
  });
  on(document, 'keydown', (e) => { onShortcut(vb, e); });
  on(vb.root, 'keydown', (e) => {
    if (onTabKeydown(vb, e) || onSegmentKeydown(vb, e)) return;
    if (e.key === 'Escape' && e.target.closest('[data-vb-roh-neu-input]')) {
      e.preventDefault();
      rohNeuSchliessen(vb);
      return;
    }
    if (e.key === 'Escape' && vb.rohMenu && e.target.closest('[data-vb-rohbar], [data-vb-roh-menu-list]')) {
      e.preventDefault();
      rohMenuUmschalten(vb, false);
      return;
    }
    if (e.target.closest('[data-vb-file-input]')) {
      if (e.key === 'Enter') {
        e.preventDefault();
        void commitFileRename(vb);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        endFileRename(vb);
      }
      return;
    }
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
    const captionField = e.target.closest('[data-vb-caption]');
    if (captionField) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelCaptionEdit(vb);
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        captionField.blur();
      }
      return;
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.target.closest('[data-vb-comment-text]')) {
      e.preventDefault();
      void submitComment(vb, e.target.closest('[data-vb-comment-form]'));
      return;
    }
    // Enter und Leertaste auf klickbaren Zeilen (Titel, Eigenschaft, Dateiname) wie ein Klick
    if (isActivationKey(e) && e.target.closest('[role="button"]:not(button)')) {
      e.preventDefault();
      e.target.closest('[role="button"]').click();
    }
  });
  // Der Haken speichert per Klick: das Feld darf vorher nicht durch Blur speichern.
  on(vb.root, 'mousedown', (e) => {
    if (vb.renaming && e.target.closest('[data-vb-edit]')) e.preventDefault();
    if (vb.renamingFile && e.target.closest('[data-vb-edit-file]')) e.preventDefault();
  });
  on(vb.root, 'focusout', (e) => {
    if (e.target.closest('[data-vb-title-input]')) void commitRename(vb);
    if (e.target.closest('[data-vb-file-input]')) void commitFileRename(vb);
    const caption = e.target.closest('[data-vb-caption]');
    if (caption) void commitCaption(vb, caption);
    // Leeres "Neuer Ordner"-Feld schließt beim Verlassen, nicht beim Klick auf Anlegen/Abbrechen
    const rohInput = e.target.closest('[data-vb-roh-neu-input]');
    if (rohInput && !rohInput.value.trim() && !rohInput.form?.contains(e.relatedTarget)) rohNeuSchliessen(vb);
  });

  bindDropzone(vb, on);
  bindRohDrag(vb, on);
}

/** Klicks im Rohmaterial (Ordner, Markieren, Verschieben). true = erledigt. */
function onRohClick(vb, e) {
  const check = e.target.closest('[data-vb-roh-check]');
  if (check) {
    rohCheck(vb, check, { shift: e.shiftKey });
    return true;
  }
  const toggle = e.target.closest('[data-vb-roh-toggle]');
  if (toggle) {
    rohToggle(vb, toggle.dataset.vbRohToggle);
    return true;
  }
  const neu = e.target.closest('[data-vb-roh-neu]');
  if (neu) {
    rohNeuOeffnen(vb, neu.dataset.vbRohNeu || '');
    return true;
  }
  if (e.target.closest('[data-vb-roh-neu-abbrechen]')) {
    rohNeuSchliessen(vb);
    return true;
  }
  if (e.target.closest('[data-vb-roh-menu]')) {
    rohMenuUmschalten(vb);
    return true;
  }
  if (e.target.closest('[data-vb-roh-clear]')) {
    rohMarkierungAufheben(vb);
    return true;
  }
  const ziel = e.target.closest('[data-vb-roh-ziel]');
  if (ziel) {
    void rohVerschieben(vb, [...vb.rohAuswahl], { videoId: ziel.dataset.vbRohZiel, version: Number(ziel.dataset.version) });
    return true;
  }
  const einzeln = e.target.closest('[data-vb-roh-move-item]');
  if (einzeln) {
    rohEinzelnVerschieben(vb, einzeln.dataset.vbRohMoveItem);
    return true;
  }
  return false;
}

function onClick(vb, e) {
  if (e.target.closest('[data-vb-caption-copy]')) {
    void copyCaption(vb);
    return;
  }
  if (e.target.closest('[data-vb-caption-more]')) {
    toggleCaptionOpen(vb);
    return;
  }
  if (e.target.closest('[data-vb-caption-view]')) {
    startCaptionEdit(vb);
    return;
  }

  // Spalte 0: Gruppenkopf, Umschalter Creator | Linie, Alle ein-/aufklappen (vor dem Showcase,
  // der sonst jeden Segment-Umschalter für sich beansprucht)
  if (onKoopGroupClick(vb, e)) return;
  // Umschalter Ordner|Showcase und alles im Showcase
  if (onShowcaseClick(vb, e)) return;
  if (onRohClick(vb, e)) return;

  const rowBtn = e.target.closest('.vb-col .vb-row[data-depth]');
  if (rowBtn && !rowBtn.classList.contains('vb-row--upload')) {
    const depth = Number(rowBtn.dataset.depth);
    vb._select(selectLevel(vb.sel, depth, rowBtn.dataset.id), { focus: { depth, id: rowBtn.dataset.id }, autoItem: depth === 2 });
    return;
  }

  const star = e.target.closest('[data-vb-star]');
  if (star) {
    void toggleFinal(vb, { itemId: star.dataset.vbStar, source: 'row' });
    return;
  }

  const slotBtn = e.target.closest('[data-vb-promote-slot]');
  if (slotBtn) {
    void promoteWithSlot(vb, slotBtn.closest('[data-vb-promote-wrap]')?.querySelector('[data-vb-final-toggle]'), slotBtn.dataset.vbPromoteSlot);
    return;
  }

  const finalToggle = e.target.closest('[data-vb-final-toggle]');
  if (finalToggle) {
    void toggleFinal(vb, { button: finalToggle, source: 'bar' });
    return;
  }

  const finalRemove = e.target.closest('[data-vb-final-remove]');
  if (finalRemove) {
    void toggleFinal(vb, { button: finalRemove, source: 'bar', collapse: true });
    return;
  }

  const tab = e.target.closest('[data-vb-tab]');
  if (tab) {
    setDetailTab(vb, tab.dataset.vbTab);
    return;
  }

  const filter = e.target.closest('[data-vb-filter]');
  if (filter) {
    toggleFolderFilter(vb, filter.dataset.vbFilter);
    return;
  }
  if (e.target.closest('[data-vb-filter-clear]')) {
    clearFolderFilter(vb);
    return;
  }

  if (e.target.closest('[data-vb-tag-open]')) {
    openTagField(vb);
    return;
  }
  const tagRemove = e.target.closest('[data-vb-tag-remove]');
  if (tagRemove) {
    void removeTag(vb, tagRemove.dataset.vbTagRemove);
    return;
  }

  // Eigenschaftszeile "Dateiname": springt in den Ad Manager und startet die Bearbeitung sofort
  if (e.target.closest('[data-vb-prop-action="filename"]')) {
    startFileRename(vb);
    return;
  }

  const copy = e.target.closest('[data-vb-adm-copy]');
  if (copy) {
    void copyFileName(vb, copy.dataset.vbAdmCopy);
    return;
  }

  const downloadBtn = e.target.closest('[data-vb-download]');
  if (downloadBtn) {
    void download(vb, downloadBtn);
    return;
  }

  const ordnerLink = e.target.closest('[data-vb-ordnerlink]');
  if (ordnerLink) {
    void ordnerLinkErstellen(vb, ordnerLink);
    return;
  }

  const freieDatei = e.target.closest('[data-vb-freie-datei]');
  if (freieDatei) {
    void freieDateiOeffnen(vb, freieDatei);
    return;
  }

  const editFile = e.target.closest('[data-vb-edit-file]');
  if (editFile) {
    if (vb.renamingFile) void commitFileRename(vb);
    else startFileRename(vb, editFile.dataset.vbEditFile);
    return;
  }

  // Klick auf den Namen selbst öffnet die Bearbeitung, im Eingabefeld passiert nichts
  const nameEdit = e.target.closest('[data-vb-adm-edit]');
  if (nameEdit) {
    if (!vb.renamingFile && !e.target.closest('[data-vb-file-input]')) startFileRename(vb, nameEdit.dataset.vbAdmEdit);
    return;
  }

  // Der Titel ist selbst klickbar (Team), wie das Stift-Icon
  if (e.target.closest('[data-vb-asset-title]') && vb.canUpload && !vb.renaming) {
    startRename(vb);
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

/** Zeilen und Gruppenköpfe einer Spalte in Anzeigereihenfolge, ohne die in zugeklappten Gruppen. */
function navigableRows(col) {
  return [...col.querySelectorAll('.vb-row[data-depth]:not(.vb-row--upload), .vb-koopgroup__head, .vb-rohgroup__toggle')]
    .filter(el => !el.closest('.vb-koopgroup.is-collapsed .vb-koopgroup__body, .vb-rohgroup__body[hidden]'));
}

/** Rohmaterial-Ordnerkopf: wie ein Gruppenkopf, links auf einem zugeklappten Ordner zurück in Spalte 2. */
function onRohHeadKey(vb, head, e) {
  const group = head.closest('.vb-rohgroup');
  const open = head.getAttribute('aria-expanded') === 'true';
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const rows = navigableRows(head.closest('.vb-col'));
    rows[rows.indexOf(head) + (e.key === 'ArrowDown' ? 1 : -1)]?.focus();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    if (!open) rohToggle(vb, head.dataset.vbRohToggle);
    else group.querySelector(':scope > .vb-rohgroup__body .vb-row')?.focus();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    if (open) rohToggle(vb, head.dataset.vbRohToggle);
    else vb.colsEl.querySelector('.vb-col[data-depth="2"] .vb-row.is-selected')?.focus();
  }
}

/** Gruppenkopf: hoch/runter wie eine Zeile, rechts auf bzw. in die erste Zeile, links zu. Enter/Leertaste klickt. */
function onKoopHeadKey(vb, head, e) {
  const id = head.dataset.vbKoopgroup;
  const open = head.getAttribute('aria-expanded') === 'true';
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const rows = navigableRows(head.closest('.vb-col'));
    rows[rows.indexOf(head) + (e.key === 'ArrowDown' ? 1 : -1)]?.focus();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    if (!open) toggleKoopGroup(vb, id, true);
    else head.closest('[data-vb-koopgroup-wrap]')?.querySelector('.vb-koopgroup__body .vb-row[data-depth]')?.focus();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    if (open) toggleKoopGroup(vb, id, false);
  }
}

function onColsKey(vb, e) {
  const head = e.target.closest('.vb-koopgroup__head');
  if (head) {
    onKoopHeadKey(vb, head, e);
    return;
  }
  const rohHead = e.target.closest('.vb-rohgroup__toggle');
  if (rohHead) {
    onRohHeadKey(vb, rohHead, e);
    return;
  }
  const rowEl = e.target.closest('.vb-row[data-depth]');
  if (!rowEl || rowEl.classList.contains('vb-row--upload')) return;
  const col = rowEl.closest('.vb-col');
  const depth = Number(rowEl.dataset.depth);
  const rows = navigableRows(col);
  const idx = rows.indexOf(rowEl);

  if (e.key === 'ArrowLeft' && depth === 0) {
    // Kooperationszeile unter einem Kopf: zurück auf den Kopf
    e.preventDefault();
    rowEl.closest('[data-vb-koopgroup-wrap]')?.querySelector('.vb-koopgroup__head')?.focus();
    return;
  }
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
