// videoBrowserRename.js
// Titel einer Datei inline im Detailkopf bearbeiten. Zustand liegt in `vb.renaming`.

import { icon } from '../../core/icons/IconSystem.js';
import { TITEL_MAX, renameAsset } from './VideoBrowserAdapter.js';
import { buildTree, resolveSelection } from './videoBrowserLogic.js';

function setEditButton(button, editing) {
  if (!button) return;
  const label = editing ? 'Titel speichern' : 'Titel bearbeiten';
  button.innerHTML = icon(editing ? 'check' : 'pencil-square');
  button.setAttribute('aria-label', label);
  button.title = label;
  button.classList.toggle('is-active', editing);
}

export function startRename(vb) {
  if (!vb.canUpload || vb.renaming) return;
  const { item } = resolveSelection(vb.tree, vb.sel);
  const title = vb.detailInner.querySelector('[data-vb-asset-title]');
  if (!item || !title) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'form-input vb-asset-head__input';
  input.value = item.name;
  input.maxLength = TITEL_MAX;
  input.setAttribute('aria-label', 'Titel');
  input.setAttribute('data-vb-title-input', '');
  title.replaceChildren(input);
  const button = vb.detailInner.querySelector('[data-vb-edit]');
  setEditButton(button, true);
  vb.renaming = { itemId: item.id, name: item.name, input, title, button, busy: false };
  input.focus();
  input.select();
}

export function endRename(vb, name) {
  const state = vb.renaming;
  if (!state) return;
  vb.renaming = null;
  state.title.textContent = name ?? state.name;
  setEditButton(state.button, false);
}

export async function commitRename(vb) {
  const state = vb.renaming;
  if (!state || state.busy) return;
  const value = state.input.value.trim();
  const { item } = resolveSelection(vb.tree, vb.sel);
  if (!value || value === state.name || item?.id !== state.itemId) {
    endRename(vb);
    return;
  }
  state.busy = true;
  state.input.disabled = true;
  try {
    const saved = await renameAsset(item, value);
    item.asset.titel = saved;
    vb.tree = buildTree(vb.raw, { team: vb.team });
    endRename(vb, saved);
    // Detail und Player bleiben stehen, nur Spalten und Pfad tragen den neuen Namen.
    vb._renderNav();
  } catch (err) {
    console.error('VideoBrowser: Titel speichern fehlgeschlagen', err);
    vb.toast('error', 'Titel konnte nicht gespeichert werden.');
    if (vb.renaming !== state) return;
    state.busy = false;
    state.input.disabled = false;
    state.input.focus();
  }
}
