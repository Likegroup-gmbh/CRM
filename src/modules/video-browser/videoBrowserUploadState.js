// videoBrowserUploadState.js
// Laufende Uploads je Ordner im Controller (`vb.uploads`) und ihre Zeilen in der Inhalte-Spalte.
// Das Hochladen selbst macht VideoBrowserUpload.js.

import { cssEscape, resolveSelection } from './videoBrowserLogic.js';
import { uploadRowHtml } from './videoBrowserRender.js';

function folderKey(resolved) {
  const { koop, row, folder } = resolved;
  if (!koop || !folder) return null;
  return folder.kind === 'raw' ? `${koop.id}:${folder.id}` : `${koop.id}:${row.id}:${folder.id}`;
}

export function currentUploads(vb, resolved) {
  const key = folderKey(resolved);
  return key ? (vb.uploads.get(key) || []) : [];
}

export function startUpload(vb, files) {
  const { koop, row, folder } = resolveSelection(vb.tree, vb.sel);
  if (!files.length || !koop || !folder || !folder.upload || !vb.canUpload) return;
  void vb.uploader.start({ koop, row, folder, files });
}

export function uploadsAdded(vb, list) {
  if (vb.destroyed || !list.length) return;
  const key = list[0].folderKey;
  vb.uploads.set(key, [...list, ...(vb.uploads.get(key) || [])]);
  if (key !== folderKey(resolveSelection(vb.tree, vb.sel))) return;
  const body = vb.colsEl.querySelector('.vb-col--3 [data-vb-body]');
  if (!body) return;
  body.querySelector(':scope > .vb-empty')?.remove();
  let uploadList = body.querySelector(':scope > [data-vb-upload-list]');
  if (!uploadList) {
    uploadList = document.createElement('ul');
    uploadList.className = 'vb-rows';
    uploadList.setAttribute('data-vb-upload-list', '');
    body.prepend(uploadList);
  }
  uploadList.insertAdjacentHTML('afterbegin', list.map(uploadRowHtml).join(''));
  list.forEach((u, i) => {
    const el = body.querySelector(`[data-upload-id="${cssEscape(u.id)}"]`);
    vb.motion.uploadRowIn(el, i);
  });
  body.scrollTop = 0;
}

export function uploadChanged(vb, { id, progress, error }) {
  if (vb.destroyed) return;
  for (const list of vb.uploads.values()) {
    const up = list.find(u => u.id === id);
    if (!up) continue;
    if (progress !== undefined) up.progress = progress;
    if (error !== undefined) up.error = error;
    const el = vb.colsEl.querySelector(`[data-upload-id="${cssEscape(id)}"]`);
    if (!el) return;
    if (up.error) {
      el.outerHTML = uploadRowHtml(up);
    } else {
      const bar = el.querySelector('.upload-progress-bar');
      if (bar) bar.value = Math.round(up.progress * 100);
    }
    return;
  }
}

export async function uploadSettled(vb, { ok, folderKey: key }) {
  if (vb.destroyed) return;
  try {
    await vb.reload();
  } catch (err) {
    console.error('VideoBrowser: Aktualisieren nach Upload fehlgeschlagen', err);
  }
  if (vb.destroyed) return;
  const list = (vb.uploads.get(key) || []).filter(u => u.error);
  if (list.length) vb.uploads.set(key, list);
  else vb.uploads.delete(key);
  if (ok || list.length === 0) vb._render({ restoreFocus: false });
}
