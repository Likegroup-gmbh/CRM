// skripteTabelleDrag.js
// Zeilen der Skripte-Tabelle am Griff ziehen, wie in Casting und Konzept.
// Gespeichert wird die sichtbare Reihenfolge der Linie (sortierung ab 0).

import { skripteService } from '../skripte/SkripteService.js';

const SKRIPTE_TAB = 'skripte';

function paneVon(detail) {
  return document.getElementById(`workflow-pane-${SKRIPTE_TAB}`);
}

function zeilenIds(pane) {
  return [...pane.querySelectorAll('tr.skripte-row')].map((row) => row.dataset.id).filter(Boolean);
}

function setzeDomReihenfolge(pane, ids) {
  const tbody = pane.querySelector('tbody');
  if (!tbody) return;
  const zeilen = new Map([...tbody.querySelectorAll('tr.skripte-row')].map((row) => [row.dataset.id, row]));
  ids.forEach((id) => {
    const row = zeilen.get(id);
    if (row) tbody.appendChild(row);
  });
}

async function speichereReihenfolge(detail, pane) {
  const liste = detail._workflowData?.[SKRIPTE_TAB];
  const ids = zeilenIds(pane);
  if (!ids.length || !liste?.length) return;
  if (ids.join('|') === liste.map((s) => s.id).join('|')) return;
  if (detail._skriptSortBusy) {
    detail._skriptSortNochmal = true;
    return;
  }

  const vorher = liste.map((s) => s.id);
  const nachId = new Map(liste.map((s) => [s.id, s]));

  detail._skriptSortBusy = true;
  try {
    do {
      detail._skriptSortNochmal = false;
      const aktuell = zeilenIds(pane);
      detail._workflowData[SKRIPTE_TAB] = aktuell
        .map((id, index) => (nachId.has(id) ? { ...nachId.get(id), sortierung: index } : null))
        .filter(Boolean);
      await skripteService.updateSkripteSortierung(aktuell);
    } while (detail._skriptSortNochmal);
    window.toastSystem?.show('Sortierung gespeichert', 'success');
  } catch (error) {
    console.error('Skript-Reihenfolge speichern fehlgeschlagen:', error);
    detail._workflowData[SKRIPTE_TAB] = vorher.map((id) => nachId.get(id)).filter(Boolean);
    setzeDomReihenfolge(pane, vorher);
    window.toastSystem?.show('Fehler beim Speichern der Sortierung', 'error');
  } finally {
    detail._skriptSortBusy = false;
  }
}

/** Griff zieht die Zeile. Hängt am Pane, damit ein Neutext der Tabelle die Bindung behält. */
export function bindSkripteReihenfolge(detail) {
  const pane = paneVon(detail);
  if (!pane) return;
  detail._skripteDragAbort?.abort();
  const abort = new AbortController();
  detail._skripteDragAbort = abort;
  const { signal } = abort;

  pane.addEventListener('mousedown', (e) => {
    const handle = e.target.closest?.('.drag-handle');
    if (!handle || !pane.contains(handle)) return;
    const row = handle.closest('tr.skripte-row');
    if (row) row.draggable = true;
  }, { signal });

  document.addEventListener('mouseup', () => {
    pane.querySelectorAll('tr.skripte-row').forEach((row) => { row.draggable = false; });
  }, { signal });

  pane.addEventListener('dragstart', (e) => {
    const row = e.target.closest?.('tr.skripte-row');
    if (!row || !pane.contains(row) || !row.draggable) return;
    detail._skriptDragRow = row;
    row.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.dataset.id || '');
  }, { signal });

  pane.addEventListener('dragover', (e) => {
    const row = e.target.closest?.('tr.skripte-row');
    const gezogen = detail._skriptDragRow;
    if (!row || !gezogen || row === gezogen || !pane.contains(row)) return;
    e.preventDefault();
    const kinder = [...row.parentNode.children];
    const von = kinder.indexOf(gezogen);
    const nach = kinder.indexOf(row);
    if (von < 0 || nach < 0) return;
    row.parentNode.insertBefore(gezogen, von < nach ? row.nextSibling : row);
  }, { signal });

  pane.addEventListener('dragend', () => {
    const row = detail._skriptDragRow;
    detail._skriptDragRow = null;
    if (row) {
      row.classList.remove('is-dragging');
      row.draggable = false;
    }
    void speichereReihenfolge(detail, pane);
  }, { signal });
}

export function loeseSkripteReihenfolge(detail) {
  detail?._skripteDragAbort?.abort();
  if (!detail) return;
  detail._skripteDragAbort = null;
  detail._skriptDragRow = null;
}
