// videoBrowserDropzone.js
// Drag & Drop auf die Upload-Zone. Die ganze Spalte mit Upload-Zone ist Ablageziel,
// nicht nur die kleine Fläche am Fuß. Im Rohmaterial ist ein Unterordner (mit item_id)
// ein eigenes Ziel: die Dateien landen dann in diesem Ordner (ADR 0070).

import { startUpload } from './videoBrowserUploadState.js';

const isFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');

function dropTarget(e) {
  const col = e.target.closest('.vb-col');
  const zone = col?.querySelector('[data-vb-dropzone]');
  if (!zone) return null;
  const ordner = e.target.closest('.vb-rohgroup[data-item-id]');
  return { col, zone, ordner };
}

function clearDrop({ col, zone }) {
  col.classList.remove('is-dropping');
  zone.classList.remove('dragover');
  col.querySelectorAll('.vb-rohgroup.is-file-drop').forEach(el => el.classList.remove('is-file-drop'));
}

/** @param {(target: EventTarget, type: string, handler: Function) => void} on registriert mit Aufräumen */
export function bindDropzone(vb, on) {
  // Drop außerhalb der Zone darf die Datei nicht im Browser öffnen.
  on(document, 'dragover', (e) => { if (isFiles(e)) e.preventDefault(); });
  on(document, 'drop', (e) => { if (isFiles(e)) e.preventDefault(); });

  on(vb.root, 'dragover', (e) => {
    const target = dropTarget(e);
    if (!target || !isFiles(e)) return;
    e.preventDefault();
    target.col.classList.add('is-dropping');
    // Innerster Ordner unter dem Zeiger leuchtet, die Zone am Fuß nur ohne Ordner
    target.col.querySelectorAll('.vb-rohgroup.is-file-drop').forEach(el => { if (el !== target.ordner) el.classList.remove('is-file-drop'); });
    target.ordner?.classList.add('is-file-drop');
    target.zone.classList.toggle('dragover', !target.ordner);
  });
  on(vb.root, 'dragleave', (e) => {
    const target = dropTarget(e);
    if (target && !target.col.contains(e.relatedTarget)) clearDrop(target);
  });
  on(vb.root, 'drop', (e) => {
    const target = dropTarget(e);
    if (!target || !isFiles(e)) return;
    e.preventDefault();
    clearDrop(target);
    startUpload(vb, [...(e.dataTransfer?.files || [])], { ordnerItemId: target.ordner?.dataset.itemId || null });
  });
}
