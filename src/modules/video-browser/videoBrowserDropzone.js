// videoBrowserDropzone.js
// Drag & Drop auf die Upload-Zone. Die ganze Spalte mit Upload-Zone ist Ablageziel,
// nicht nur die kleine Fläche am Fuß.

import { startUpload } from './videoBrowserUploadState.js';

const isFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');

function dropTarget(e) {
  const col = e.target.closest('.vb-col');
  const zone = col?.querySelector('[data-vb-dropzone]');
  return zone ? { col, zone } : null;
}

function clearDrop({ col, zone }) {
  col.classList.remove('is-dropping');
  zone.classList.remove('dragover');
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
    target.zone.classList.add('dragover');
  });
  on(vb.root, 'dragleave', (e) => {
    const target = dropTarget(e);
    if (target && !target.col.contains(e.relatedTarget)) clearDrop(target);
  });
  on(vb.root, 'drop', (e) => {
    const target = dropTarget(e);
    if (!target) return;
    e.preventDefault();
    clearDrop(target);
    startUpload(vb, [...(e.dataTransfer?.files || [])]);
  });
}
