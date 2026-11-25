// videoBrowserVollansichtEvents.js
// Events der Vollansicht, delegiert am Overlay (es liegt außerhalb von `vb.root`). Die Handler des
// Detailbereichs kommen aus videoBrowserDetailEvents.js, dazu Blättern, Tabs der mittleren Breite,
// Verknüpfungen, Posting-Datum und der Upload auf ein Ausstehendes Video. Esc in einem Feld bricht
// nur das Feld ab und schließt die Vollansicht nicht.

import { CustomDatePicker } from '../../core/components/CustomDatePicker.js';
import { buildTree, resolveSelection } from './videoBrowserLogic.js';
import { mitPostingDatum, savePostingDatum } from './videoBrowserKalenderData.js';
import { uploadAusstehend } from './videoBrowserShowcaseUpload.js';
import {
  onDetailChange, onDetailClick, onDetailFocusout, onDetailInput, onDetailKeydown, onDetailMousedown, onDetailSubmit
} from './videoBrowserDetailEvents.js';
import { isActivationKey } from './videoBrowserKeys.js';
import { VOLL_TABS } from './videoBrowserVollansichtRender.js';

const isFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
const isField = (el) => /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName || '') || !!el?.isContentEditable
  || el?.getAttribute?.('role') === 'combobox';

/** Link in den Details: Vollansicht zu, dann navigiert die App. Mit Modifier öffnet der Browser einen Tab. */
function followLink(api, a, e) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
  e.preventDefault();
  e.stopPropagation();
  const href = a.getAttribute('href');
  void api.close().then(() => {
    if (window.navigateTo) window.navigateTo(href);
    else window.location.assign(href);
  });
}

function setPosting(vb, videoId, iso) {
  vb.raw.videos = mitPostingDatum(vb.raw.videos, videoId, iso);
  vb.tree = buildTree(vb.raw, { team: vb.team });
  vb._renderNav();
  if (vb.voll) vb.voll.dirty = true;
}

async function savePosting(vb, input) {
  const videoId = input.dataset.id;
  const iso = input.dataset.isoValue || null;
  const video = (vb.raw?.videos || []).find(v => v.id === videoId);
  if (!video || (video.posting_datum || null) === iso) return;
  const before = video.posting_datum || null;
  setPosting(vb, videoId, iso);
  try {
    await savePostingDatum(videoId, iso);
  } catch (err) {
    console.error('VideoBrowser: Posting-Datum speichern fehlgeschlagen', err);
    if (vb.destroyed) return;
    setPosting(vb, videoId, before);
    vb.voll?.refresh();
    vb.toast('error', 'Posting-Datum konnte nicht gespeichert werden.');
  }
}

const upload = (vb, st, files) => uploadAusstehend(vb, resolveSelection(vb.tree, st.sel), files);

function onClick(vb, st, api, e) {
  const t = e.target;
  const a = t.closest('[data-vb-voll-link]');
  if (a) { followLink(api, a, e); return; }
  const stepBtn = t.closest('[data-vb-voll-step]');
  if (stepBtn) { api.step(Number(stepBtn.dataset.vbVollStep)); return; }
  if (t.closest('[data-vb-voll-folder]')) { void api.openInFolder(); return; }
  const tab = t.closest('[data-vb-voll-tab]');
  if (tab) { api.showTab(tab.dataset.vbVollTab); return; }
  if (t.closest('[data-vb-voll-browse]')) {
    st.root?.querySelector('[data-vb-voll-file]')?.click();
    return;
  }
  // Verlauf einer Variante: eine andere Version im selben Video
  const goto = t.closest('[data-goto-item]');
  if (goto) {
    void api.goto({ ...st.sel, folderId: goto.dataset.gotoFolder || st.sel.folderId, itemId: goto.dataset.gotoItem });
    return;
  }
  onDetailClick(vb, e);
}

function onKeydown(vb, st, api, e) {
  if (e.key === 'Escape') {
    if (CustomDatePicker._activePicker) {
      CustomDatePicker.closeActivePicker();
      e.stopPropagation();
      return;
    }
    if (isField(e.target) || vb.renaming || vb.captionEdit || vb.tagField) {
      onDetailKeydown(vb, e);
      e.stopPropagation();
      return;
    }
  }
  const tab = e.target.closest?.('[data-vb-voll-tab]');
  if (tab && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault();
    e.stopPropagation();
    const i = VOLL_TABS.findIndex(x => x.id === tab.dataset.vbVollTab);
    const next = VOLL_TABS[(i + (e.key === 'ArrowRight' ? 1 : -1) + VOLL_TABS.length) % VOLL_TABS.length].id;
    api.showTab(next);
    st.root?.querySelector(`[data-vb-voll-tab="${next}"]`)?.focus();
    return;
  }
  if (onDetailKeydown(vb, e)) return;
  if (!e.defaultPrevented && isActivationKey(e) && e.target.closest?.('[role="button"]:not(button)')) {
    e.preventDefault();
    e.target.closest('[role="button"]').click();
  }
}

function onChange(vb, st, e) {
  const file = e.target.closest('[data-vb-voll-file]');
  if (file) {
    upload(vb, st, [...(file.files || [])]);
    file.value = '';
    return;
  }
  const date = e.target.closest('.custom-date-picker__input[data-field="posting_datum"]');
  if (date) { void savePosting(vb, date); return; }
  onDetailChange(vb, e);
}

/** @param {{ step, goto, openInFolder, showTab, close }} api Funktionen des Controllers */
export function bindVollansichtEvents(vb, st, api) {
  const overlay = st.box.overlay;
  const offs = [];
  const on = (type, handler) => {
    overlay.addEventListener(type, handler);
    offs.push(() => overlay.removeEventListener(type, handler));
  };
  const zone = (e) => e.target.closest?.('[data-vb-voll-drop]') || null;

  on('click', (e) => onClick(vb, st, api, e));
  on('keydown', (e) => onKeydown(vb, st, api, e));
  on('submit', (e) => { onDetailSubmit(vb, e); });
  on('input', (e) => { onDetailInput(vb, e); });
  on('change', (e) => onChange(vb, st, e));
  on('mousedown', (e) => { onDetailMousedown(vb, e); });
  on('focusout', (e) => { onDetailFocusout(vb, e); });
  on('dragover', (e) => {
    const el = zone(e);
    if (!el || !isFiles(e) || !vb.canUpload) return;
    e.preventDefault();
    el.classList.add('is-drop');
  });
  on('dragleave', (e) => {
    const el = zone(e);
    if (el && !el.contains(e.relatedTarget)) el.classList.remove('is-drop');
  });
  on('drop', (e) => {
    const el = zone(e);
    if (!el || !isFiles(e)) return;
    e.preventDefault();
    el.classList.remove('is-drop');
    upload(vb, st, [...(e.dataTransfer?.files || [])]);
  });
  const unbindPicker = CustomDatePicker.bind(overlay);
  return () => {
    offs.forEach(fn => fn());
    unbindPicker?.();
  };
}
