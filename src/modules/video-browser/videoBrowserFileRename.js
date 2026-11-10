// videoBrowserFileRename.js
// Ad-Manager-Dateiname im Tab "Ad Manager" bearbeiten (nur Team), eine Zeile je Format. Zustand liegt in
// `vb.renamingFile`. Der Anzeigetitel läuft getrennt über videoBrowserRename.js.
//
// Die Endung ist gesperrt (steht neben dem Feld), beim Tippen zeigt die Vorschau "Wird zu: ...", sobald
// der Name für den Ad Manager bereinigt werden muss. Gespeichert wird per Enter oder beim Verlassen.

import { escapeHtml as esc } from '../../core/format.js';
import { previewAdManagerStem, renamedFilePath, splitFileName } from '../../core/videoFileNames.js';
import { TITEL_MAX, renameAdManagerFile } from './VideoBrowserAdapter.js';
import { cssEscape, resolveSelection } from './videoBrowserLogic.js';
import { adManagerItems } from './videoBrowserRenderTabs.js';
import { setEditButton as toggleEditButton } from './videoBrowserRenderParts.js';
import { setDetailTab } from './videoBrowserTabs.js';

const SANITIZE_TOAST = 'Leerzeichen, Umlaute und Sonderzeichen wurden für den Ad Manager ersetzt.';
const LABELS = { edit: 'Dateinamen für den Ad Manager bearbeiten', save: 'Dateinamen speichern' };
const setEditButton = (button, editing) => toggleEditButton(button, editing, LABELS);

/** Videos der gewählten Ansicht, deren Name der Ad Manager bekommt (Finale Version: alle Formate). */
function formatItems(vb) {
  return adManagerItems({ resolved: resolveSelection(vb.tree, vb.sel) });
}

export const adRowOf = (vb, itemId) =>
  vb.detailInner?.querySelector(`[data-vb-adm-row="${cssEscape(String(itemId))}"]`) || null;

const nameHtml = (stem, ext) => `<span class="vb-admrow__stem">${esc(stem)}</span><span class="vb-admrow__ext">${esc(ext)}</span>`;

function paintPreview(state) {
  const { stem, changed } = previewAdManagerStem(state.input.value, state.ext);
  const el = state.preview;
  if (!el) return;
  if (changed && stem) {
    el.textContent = `Wird zu: ${stem}${state.ext}`;
    el.hidden = false;
  } else {
    el.textContent = '';
    el.hidden = true;
  }
}

/** Bearbeitung der Zeile starten. Ohne `itemId` die gewählte Datei. */
export function startFileRename(vb, itemId = null) {
  if (!vb.canUpload || vb.renamingFile) return;
  const items = formatItems(vb);
  const selected = resolveSelection(vb.tree, vb.sel).item;
  const item = items.find(i => i.id === (itemId || selected?.id)) || items[0];
  if (!item) return;

  // Der Tab muss sichtbar sein, sonst landet der Fokus im versteckten Panel
  setDetailTab(vb, 'admanager', { animate: false });
  const rowEl = adRowOf(vb, item.id);
  const nameEl = rowEl?.querySelector('[data-vb-file-name]');
  const path = item.asset?.file_path;
  if (!rowEl || !nameEl || !path) return;

  const { stem, ext } = splitFileName(path);
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'form-input vb-admrow__input';
  input.value = stem;
  input.maxLength = TITEL_MAX;
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Dateiname für den Ad Manager');
  input.setAttribute('data-vb-file-input', '');
  nameEl.replaceChildren(input, Object.assign(document.createElement('span'), { className: 'vb-admrow__ext', textContent: ext }));

  const button = rowEl.querySelector('[data-vb-edit-file]');
  setEditButton(button, true);
  const state = {
    itemId: item.id, stem, ext, input, nameEl, rowEl, button,
    preview: rowEl.querySelector('[data-vb-adm-preview]'), busy: false
  };
  input.addEventListener('input', () => paintPreview(state));
  vb.renamingFile = state;
  input.focus();
  input.select();
}

export function endFileRename(vb, fullName) {
  const state = vb.renamingFile;
  if (!state) return;
  vb.renamingFile = null;
  const stem = fullName != null && fullName.endsWith(state.ext) ? fullName.slice(0, fullName.length - state.ext.length) : state.stem;
  state.nameEl.innerHTML = nameHtml(stem, state.ext);
  if (state.preview) { state.preview.textContent = ''; state.preview.hidden = true; }
  setEditButton(state.button, false);
}

export async function commitFileRename(vb) {
  const state = vb.renamingFile;
  if (!state || state.busy) return;
  const item = formatItems(vb).find(i => i.id === state.itemId);
  const target = item ? renamedFilePath(`/${state.stem}${state.ext}`, state.input.value, { adManager: true }) : null;
  const neuerStem = target ? splitFileName(target).stem : '';
  if (!neuerStem || neuerStem === state.stem) {
    endFileRename(vb);
    return;
  }

  const bereinigt = previewAdManagerStem(state.input.value, state.ext).changed;
  state.busy = true;
  state.input.disabled = true;
  try {
    const saved = await renameAdManagerFile(item, state.input.value);
    vb.toast('success', 'Dateiname geändert.');
    if (bereinigt) vb.toast('info', SANITIZE_TOAST);
    endFileRename(vb, `${saved.stem}${state.ext}`);
  } catch (err) {
    console.error('VideoBrowser: Dateiname speichern fehlgeschlagen', err);
    vb.toast('error', 'Dateiname konnte nicht geändert werden.');
    if (vb.renamingFile !== state) return;
    state.busy = false;
    state.input.disabled = false;
    state.input.focus();
    return;
  }
  // Feedbackschleife und Finale Versionen teilen sich die Datei: neu laden, damit jede Zeile
  // den neuen Pfad trägt. Danach blinkt die Zeile kurz.
  try {
    await vb.reload();
  } catch (err) {
    console.error('VideoBrowser: Aktualisieren nach Umbenennen fehlgeschlagen', err);
    return;
  }
  if (!vb.destroyed) vb.motion?.savedFlash(adRowOf(vb, state.itemId));
}

/** Namen der Zeile in die Zwischenablage legen. */
export async function copyFileName(vb, itemId) {
  const item = formatItems(vb).find(i => i.id === itemId);
  if (!item) return;
  const { stem, ext } = splitFileName(item.asset.file_path);
  try {
    await navigator.clipboard.writeText(`${stem}${ext}`);
    vb.toast('success', 'Dateiname kopiert');
  } catch (err) {
    console.error('VideoBrowser: Kopieren fehlgeschlagen', err);
    vb.toast('error', 'Dateiname konnte nicht kopiert werden.');
  }
}
