// videoBrowserShowcaseUpload.js
// Upload auf ein Ausstehendes Video (nur Team): Datei auf die Kachel ziehen oder in der Vollansicht
// wählen. Ziel ist die nächste leere Feedbackschleife des Videos. Den Fortschritt zeigen Kachel und
// Upload-Zone der Vollansicht (`[data-vb-aus-upload]`), gespeist aus `vb.uploads`.

const isFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');

/** Nächste leere Feedbackschleife, `null` ohne Upload-Recht oder wenn alle Runden belegt sind. */
export const uploadZiel = (row) => (row?.folders || []).find(f => f.kind === 'schleife' && f.leer && f.upload) || null;

/** @returns {boolean} true, wenn der Upload startet */
export function uploadAusstehend(vb, { koop, row }, files) {
  const folder = uploadZiel(row);
  if (!files?.length || !koop || !folder || !vb.canUpload) return false;
  void vb.uploader.start({ koop, row, folder, files });
  return true;
}

/** Laufende Uploads eines Videos (alle Ordner), Fehlschläge zählen nicht. */
function uploadsOf(vb, koopId, rowId) {
  const prefix = `${koopId}:${rowId}:`;
  const out = [];
  for (const [key, list] of vb.uploads || []) {
    if (key.startsWith(prefix)) out.push(...list.filter(u => !u.error));
  }
  return out;
}

/** Fortschritt auf Kacheln und Upload-Zone nachziehen. Nach jedem Rendern und bei jeder Upload-Meldung. */
export function paintAusstehendUploads(vb) {
  const scopes = [vb.scGridEl, vb.voll?.root].filter(Boolean);
  for (const scope of scopes) {
    scope.querySelectorAll('[data-vb-aus-upload]').forEach((el) => {
      const list = uploadsOf(vb, el.dataset.koopId, el.dataset.vbAusUpload);
      el.classList.toggle('is-uploading', list.length > 0);
      const bar = el.querySelector('[data-vb-aus-progress]');
      if (!bar) return;
      bar.hidden = !list.length;
      const sum = list.reduce((acc, u) => acc + (u.progress || 0), 0);
      bar.value = list.length ? Math.round((sum / list.length) * 100) : 0;
    });
  }
}

const tileOf = (e) => e.target.closest?.('[data-vb-sc-aus]') || null;

/** Ablageziel Kachel: delegiert am Grid. Ein Drop außerhalb fängt bindDropzone am Dokument ab. */
export function bindAusstehendDrop(vb) {
  const grid = vb.scGridEl;
  const over = (e) => {
    const tile = tileOf(e);
    if (!tile || !isFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    tile.classList.add('is-drop');
  };
  const leave = (e) => {
    const tile = tileOf(e);
    if (tile && !tile.contains(e.relatedTarget)) tile.classList.remove('is-drop');
  };
  const drop = (e) => {
    const tile = tileOf(e);
    if (!tile || !isFiles(e)) return;
    e.preventDefault();
    tile.classList.remove('is-drop');
    const entry = vb.scResult?.list?.[Number(tile.dataset.index)];
    if (entry) uploadAusstehend(vb, entry, [...(e.dataTransfer?.files || [])]);
  };
  grid.addEventListener('dragover', over);
  grid.addEventListener('dragleave', leave);
  grid.addEventListener('drop', drop);
  vb.cleanups.push(() => {
    grid.removeEventListener('dragover', over);
    grid.removeEventListener('dragleave', leave);
    grid.removeEventListener('drop', drop);
  });
}
