// videoBrowserActions.js
// Aktionen an der gewählten Datei: final markieren bzw. aufheben, herunterladen, löschen.
// Alle Funktionen bekommen den VideoBrowser-Controller (`vb`).

import { confirmationModal } from '../../core/ConfirmationModal.js';
import { escapeHtml } from '../../core/format.js';
import { icon } from '../../core/icons/IconSystem.js';
import { promoteAssetToFinal, unmarkFinalSlot } from '../../core/PromoteFinalAsset.js';
import { ablageVonQuelle } from '../../core/ablage/ablageUpload.js';
import { STILL_FINAL_VARIANT } from '../../core/stills/stillAssets.js';
import { deleteAsset } from './VideoBrowserAdapter.js';
import { downloadItems } from './videoBrowserDownload.js';
import {
  buildTree,
  clearFrom,
  collectDownloadItems,
  commentsForAsset,
  cssEscape,
  detectRatio,
  plural,
  resolveSelection,
  selectionEquals,
  validateSelection
} from './videoBrowserLogic.js';
import { canMarkFinal, isMarked } from './videoBrowserRenderItem.js';
import { ratioOfItem } from './videoBrowserRatio.js';

/* ---- Final markieren ---- */

const KIND = { video: 'video', story: 'story', still: 'still' };
const RAW_KEY = { video: 'videoAssets', story: 'storyAssets', still: 'stillAssets' };

/** Nur aria-busy: ein disabled-Button verliert den Fokus, und der soll beim Umschalten bleiben. */
function setBusy(button, busy) {
  if (!button) return;
  if (busy) button.setAttribute('aria-busy', 'true');
  else button.removeAttribute('aria-busy');
}

/** Format der Datei: erst aus dem laufenden Player (nur die gewählte), sonst aus den Metadaten der Datei. */
async function formatOf(vb, item) {
  if (vb.sel.itemId === item.id) {
    const dims = vb.player?.getDimensions?.();
    const direct = dims ? detectRatio(dims.width, dims.height) : null;
    if (direct) return direct;
  }
  return ratioOfItem(item);
}

/** Datei samt Zeile und Ordner im ganzen Baum (nicht nur in der Auswahl). */
function findItem(vb, itemId) {
  for (const koop of vb.tree.kooperationen) {
    for (const row of koop.rows) {
      for (const folder of row.folders) {
        const item = folder.items.find(i => i.id === itemId);
        if (item) return { koop, row, folder, item };
      }
    }
  }
  return null;
}

function rowLi(vb, itemId) {
  return vb.colsEl?.querySelector(`.vb-col--3 .vb-row[data-id="${cssEscape(String(itemId))}"]`)?.closest('li') || null;
}

/** Menü für das Format ist nötig, wenn das System keins erkennt: Datei wählen und Menü öffnen. */
function askFormat(vb, item) {
  if (vb.sel.itemId !== item.id) {
    const found = findItem(vb, item.id);
    if (found) vb._select({ kooperationId: found.koop.id, videoId: found.row.id, folderId: found.folder.id, itemId: item.id });
  }
  const menu = vb.detailInner.querySelector('[data-vb-promote-menu]');
  if (!menu) return;
  menu.hidden = false;
  menu.querySelector('[data-vb-promote-slot]')?.focus();
}

function tempFinal(kind, source, slot) {
  return {
    id: `tmp-${source.id}-${slot}`,
    video_id: source.video_id,
    story_id: source.story_id ?? null,
    kooperation_id: source.kooperation_id,
    file_url: source.file_url,
    file_path: source.file_path,
    file_name: source.file_name,
    file_size: source.file_size || 0,
    version_number: 1,
    variant_name: kind === 'still' ? STILL_FINAL_VARIANT : slot,
    titel: source.titel || null,
    is_current: false,
    is_final: true,
    source_asset_id: source.id,
    ...ablageVonQuelle(source),
    created_at: new Date().toISOString()
  };
}

/** Baum neu bauen und die Ansicht angleichen, ohne den Player neu zu starten. */
function refreshView(vb, { selectSource = null } = {}) {
  vb.tree = buildTree(vb.raw, { team: vb.team });
  const valid = validateSelection(vb.sel, vb.tree);
  if (selectSource) {
    vb._select(selectSource);
    return;
  }
  if (!selectionEquals(valid, vb.sel)) vb._setSel(valid);
  vb._render({ restoreFocus: false, patch: true });
}

/** Zurück zur Quelle, wenn die gewählte finale Datei verschwindet. */
function sourceSelection(vb, found, sourceId) {
  const source = found.row.folders.find(f => f.kind === 'schleife' && f.items.some(i => i.id === sourceId));
  if (!source) return null;
  return { kooperationId: found.koop.id, videoId: found.row.id, folderId: source.id, itemId: sourceId };
}

function undoToast(vb, text, onUndo) {
  vb.toast('success', text, { action: { label: 'Rückgängig', onClick: onUndo } });
}

/**
 * Datei final markieren bzw. die Markierung aufheben. Ein Weg für Schnell-Stern, Final-Leiste,
 * Taste F und "Aus Finale Version entfernen". Der Zustand wechselt sofort, ein Fehler rollt zurück.
 * Ein Toast mit "Rückgängig" nimmt den Wechsel zurück.
 * @param {{ itemId?: string, slots?: string[], source?: 'bar'|'row'|'key'|'undo', collapse?: boolean, button?: HTMLElement }} opts
 */
export async function toggleFinal(vb, { itemId = null, slots = null, source = 'bar', collapse = false, button = null } = {}) {
  if (!vb.canUpload) return;
  const id = itemId || vb.sel.itemId;
  const found = id ? findItem(vb, id) : null;
  if (!found || !canMarkFinal(found.item)) return;
  const { item } = found;
  const kind = KIND[item.type];
  if (!kind || !item.asset) return;

  vb._finalBusy = vb._finalBusy || new Set();
  if (vb._finalBusy.has(item.id)) return;

  const sourceId = item.isFinal ? item.asset.source_asset_id : item.id;
  const marked = isMarked(item);

  const key = RAW_KEY[kind];
  const before = vb.raw[key];
  vb._finalBusy.add(item.id);
  setBusy(button, true);

  try {
    if (marked) {
      await unmarkFlow(vb, { found, kind, key, before, sourceId, source, collapse });
    } else {
      const ok = await promoteFlow(vb, { found, kind, key, before, slots, source, button });
      if (!ok) return;
    }
  } finally {
    vb._finalBusy.delete(item.id);
    setBusy(button, false);
  }
}

async function promoteFlow(vb, { found, kind, key, before, slots, source, button }) {
  const { item } = found;
  let formats = slots;
  if (kind !== 'still' && !formats) {
    const format = await formatOf(vb, item);
    if (vb.destroyed) return false;
    if (!format) {
      setBusy(button, false);
      askFormat(vb, item);
      return false;
    }
    formats = [format];
  }
  const useSlots = kind === 'still' ? [STILL_FINAL_VARIANT] : formats;

  // Der Flug startet an der Vorschau bzw. am Stern der Zeile, bevor sich die Ansicht ändert
  const fromRect = source === 'row'
    ? rowLi(vb, item.id)?.querySelector('.vb-icon-slot')?.getBoundingClientRect()
    : vb.detailInner.querySelector('[data-vb-frame]')?.getBoundingClientRect();

  const temps = useSlots.map(slot => tempFinal(kind, item.asset, slot));
  vb.raw[key] = [
    ...(before || []).filter(a => !(a.is_final && (kind === 'still' ? a.video_id === item.asset.video_id : a.source_asset_id === item.id && useSlots.includes(a.variant_name)))),
    ...temps
  ];
  refreshView(vb);
  if (fromRect) flyGhost(vb, fromRect);

  try {
    const saved = [];
    for (const slot of useSlots) saved.push(await promoteAssetToFinal(kind, item.asset, slot));
    if (vb.destroyed) return true;
    vb.raw[key] = vb.raw[key].map((a) => {
      const index = temps.findIndex(t => t.id === a.id);
      return index >= 0 && saved[index]?.id ? { ...a, ...saved[index], version_number: a.version_number } : a;
    });
    vb.tree = buildTree(vb.raw, { team: vb.team });
    vb._renderNav();
  } catch (err) {
    console.error('VideoBrowser: Final markieren fehlgeschlagen', err);
    if (vb.destroyed) return false;
    vb.raw[key] = before;
    refreshView(vb);
    vb.toast('error', 'Final markieren fehlgeschlagen.');
    return false;
  }

  if (source === 'undo') vb.toast('success', 'Rückgängig gemacht.');
  else {
    undoToast(vb, 'Als final markiert.', () => { void toggleFinal(vb, { itemId: item.id, source: 'undo' }); });
  }
  return true;
}

async function unmarkFlow(vb, { found, kind, key, before, sourceId, source, collapse }) {
  const { row, item } = found;
  const finals = item.isFinal ? [item] : (row.folders.find(f => f.kind === 'final')?.items || [])
    .filter(f => f.asset?.source_asset_id === item.id && f.type === item.type);
  if (!finals.length) return;
  const finalIds = new Set(finals.map(f => f.id));
  const formerSlots = finals.map(f => f.asset.variant_name).filter(Boolean);
  const wasSelected = vb.sel.itemId === item.id;

  // Aus dem Ordner "Finale Version" heraus klappt die Zeile zu, bevor sie verschwindet
  if (collapse) {
    await vb.motion.rowCollapse(rowLi(vb, item.id), vb.detailInner);
    if (vb.destroyed) return;
  }

  vb.raw[key] = (before || []).filter(a => !finalIds.has(a.id));
  vb.tree = buildTree(vb.raw, { team: vb.team });
  const back = item.isFinal && wasSelected ? sourceSelection(vb, found, sourceId) : null;
  // Die Quelle muss im neuen Baum vorkommen, sonst bleibt die Auswahl auf dem Ordner
  refreshView(vb, { selectSource: back });

  try {
    for (const f of finals) await unmarkFinalSlot(kind, row.id, f.asset.variant_name, sourceId);
  } catch (err) {
    console.error('VideoBrowser: Final aufheben fehlgeschlagen', err);
    if (vb.destroyed) return;
    vb.raw[key] = before;
    refreshView(vb);
    vb.motion.rowRestore(rowLi(vb, item.id), vb.detailInner);
    vb.toast('error', 'Finale Version konnte nicht aufgehoben werden.');
    return;
  }

  if (source === 'undo') vb.toast('success', 'Rückgängig gemacht.');
  else {
    undoToast(vb, 'Final-Markierung entfernt.', () => {
      void toggleFinal(vb, { itemId: sourceId, slots: kind === 'still' ? null : formerSlots, source: 'undo' });
    });
  }
}

/** Ghost am body, der in den Ordner "Finale Version" fliegt. Ohne sichtbares Ziel passiert nichts. */
function flyGhost(vb, rect) {
  const ghost = document.createElement('div');
  ghost.className = 'vb-fly-ghost';
  ghost.innerHTML = icon('star');
  vb.motion?.flyToFinal(rect, ghost);
}

/** Alte Namen für die Final-Leiste: Klick auf den Slot im Menü. */
export function promoteWithSlot(vb, button, slot) {
  return toggleFinal(vb, { itemId: vb.sel.itemId, slots: [slot], button });
}

/* ---- Download ---- */

export function downloadMeta(vb, koop) {
  const k = vb.detail.kampagneData || {};
  return {
    creatorName: koop?.name || '',
    unternehmen: k.unternehmen?.firmenname || '',
    kampagne: k.kampagnenname || k.eigener_name || ''
  };
}

export async function download(vb, button) {
  if (!vb.canDownload || button.disabled) return;
  const resolved = resolveSelection(vb.tree, vb.sel);
  const entries = collectDownloadItems(button.dataset.vbDownload, resolved);
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try {
    await downloadItems(entries, downloadMeta(vb, resolved.koop));
  } catch (err) {
    console.error('VideoBrowser: Download fehlgeschlagen', err);
    vb.toast('error', 'Download fehlgeschlagen.');
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

/* ---- Löschen ---- */

export async function deleteItem(vb, button) {
  if (!vb.canUpload || button.disabled) return;
  const { row, item } = resolveSelection(vb.tree, vb.sel);
  if (!row || !item) return;
  const kommentare = item.type === 'video' && !item.isFinal
    ? commentsForAsset(row.comments, item.runde, item.id).filter(c => c.assetId === item.id).length
    : 0;
  const hinweis = kommentare ? ` ${plural(kommentare, 'Kommentar', 'Kommentare')} zu dieser Datei werden ebenfalls entfernt.` : '';
  const { confirmed } = await confirmationModal.open({
    title: 'Datei löschen',
    message: `„${escapeHtml(item.name)}“ wird endgültig gelöscht, auch die Datei in Dropbox.${hinweis}`,
    confirmText: 'Löschen'
  });
  if (!confirmed || vb.destroyed) return;

  button.disabled = true;
  // Die Zeile klappt zu, das Detail blendet ab. Erst danach wird gelöscht, bei einem Fehler kommt alles zurück.
  const li = rowLi(vb, item.id);
  await vb.motion?.rowCollapse(li, vb.detailInner);
  if (vb.destroyed) return;
  try {
    await deleteAsset(item);
  } catch (err) {
    console.error('VideoBrowser: Löschen fehlgeschlagen', err);
    vb.toast('error', 'Datei konnte nicht gelöscht werden.');
    vb.motion?.rowRestore(li, vb.detailInner);
    button.disabled = false;
    return;
  }
  vb.toast('success', 'Datei gelöscht.');
  if (vb.destroyed) return;
  if (vb.sel.itemId === item.id) vb._setSel(clearFrom(vb.sel, 3));
  vb.motion?.rowRestore(null, vb.detailInner);
  try {
    await vb.reload({ detailAnimate: true });
  } catch (err) {
    console.error('VideoBrowser: Aktualisieren nach Löschen fehlgeschlagen', err);
  }
}
