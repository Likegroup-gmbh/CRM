// videoBrowserActions.js
// Aktionen an der gewählten Datei: als Finale Version freigeben bzw. aufheben, herunterladen, löschen.
// Alle Funktionen bekommen den VideoBrowser-Controller (`vb`).

import { confirmationModal } from '../../core/ConfirmationModal.js';
import { escapeHtml } from '../../core/format.js';
import { promoteAssetToFinal, unmarkFinalSlot } from '../../core/PromoteFinalAsset.js';
import { deleteAsset } from './VideoBrowserAdapter.js';
import { downloadItems } from './videoBrowserDownload.js';
import {
  clearFrom,
  collectDownloadItems,
  commentsForAsset,
  detectRatio,
  plural,
  resolveSelection
} from './videoBrowserLogic.js';
import { ratioOfItem } from './videoBrowserRatio.js';

/* ---- Finale Version freigeben und aufheben ---- */

const PROMOTE_KIND = { video: 'video', story: 'story', still: 'still' };

function setBusy(button, busy) {
  if (!button) return;
  button.disabled = busy;
  if (busy) button.setAttribute('aria-busy', 'true');
  else button.removeAttribute('aria-busy');
}

/** Format der gewählten Datei: erst aus dem laufenden Player, sonst aus den Metadaten der Datei. */
async function formatOfSelected(vb, item) {
  const dims = vb.player?.getDimensions?.();
  const direct = dims ? detectRatio(dims.width, dims.height) : null;
  return direct || ratioOfItem(item);
}

function openSlotMenu(button) {
  const menu = button.closest('[data-vb-promote-wrap]')?.querySelector('[data-vb-promote-menu]');
  if (!menu) return;
  menu.hidden = false;
  menu.querySelector('[data-vb-promote-slot]')?.focus();
}

/** Die Ansicht springt zum neuen Final-Item, damit man sieht, wo die Datei gelandet ist. */
function selectFinalOf(vb, sourceId) {
  const { koop, row } = resolveSelection(vb.tree, vb.sel);
  const folder = row?.folders.find(f => f.kind === 'final');
  const target = folder?.items.find(i => i.asset?.source_asset_id === sourceId);
  if (!koop || !row || !folder || !target) return;
  vb._select({ kooperationId: koop.id, videoId: row.id, folderId: folder.id, itemId: target.id });
}

/**
 * Datei einer Feedbackschleife als Finale Version freigeben. Ein Klick: Format kommt aus der Datei.
 * Erkennt das System keins, öffnet sich das Menü, und ein Klick darin (`slot`) löst die Freigabe aus.
 */
export async function promoteItem(vb, button, slot = null) {
  if (!vb.canUpload || button.disabled) return;
  const { row, item } = resolveSelection(vb.tree, vb.sel);
  const kind = PROMOTE_KIND[item?.type];
  if (!row || !item || item.isFinal || !kind || !item.asset) return;

  setBusy(button, true);
  try {
    let format = slot;
    if (kind !== 'still' && !format) {
      format = await formatOfSelected(vb, item);
      if (vb.destroyed) return;
      if (!format) {
        setBusy(button, false);
        openSlotMenu(button);
        return;
      }
    }
    await promoteAssetToFinal(kind, item.asset, format);
  } catch (err) {
    console.error('VideoBrowser: Freigabe als Finale Version fehlgeschlagen', err);
    vb.toast('error', 'Freigabe als Finale Version fehlgeschlagen.');
    setBusy(button, false);
    return;
  }

  vb.toast('success', 'Als Finale Version freigegeben.');
  if (vb.destroyed) return;
  try {
    await vb.reload();
  } catch (err) {
    console.error('VideoBrowser: Aktualisieren nach Freigabe fehlgeschlagen', err);
    return;
  }
  if (!vb.destroyed) selectFinalOf(vb, item.id);
}

/** Freigabe zurücknehmen. Trifft nur den Verweis, die Feedbackschleife und ihre Datei bleiben. */
export async function unmarkItem(vb, button) {
  if (!vb.canUpload || button.disabled) return;
  const { row } = resolveSelection(vb.tree, vb.sel);
  const finalItem = row?.folders.find(f => f.kind === 'final')?.items.find(i => i.id === button.dataset.vbUnmark);
  const kind = PROMOTE_KIND[finalItem?.type];
  if (!row || !finalItem || !kind || !finalItem.asset?.source_asset_id) return;

  setBusy(button, true);
  const sourceId = finalItem.asset.source_asset_id;
  try {
    await unmarkFinalSlot(kind, row.id, finalItem.asset.variant_name, sourceId);
  } catch (err) {
    console.error('VideoBrowser: Final aufheben fehlgeschlagen', err);
    vb.toast('error', 'Finale Version konnte nicht aufgehoben werden.');
    setBusy(button, false);
    return;
  }

  vb.toast('success', 'Finale Version aufgehoben.');
  if (vb.destroyed) return;
  // Die Auswahl merken: nach dem Neuladen ist die aufgehobene Datei aus ihr verschwunden
  const koopId = vb.sel.kooperationId;
  const warAufFinal = vb.sel.itemId === finalItem.id;
  try {
    await vb.reload();
  } catch (err) {
    console.error('VideoBrowser: Aktualisieren nach Aufheben fehlgeschlagen', err);
    return;
  }
  if (vb.destroyed || !warAufFinal) return;
  // Aus dem Final-Ordner zurück zur Quelle statt auf eine verschwundene Datei
  const source = vb.tree.kooperationen.find(k => k.id === koopId)?.rows.find(r => r.id === row.id)
    ?.folders.find(f => f.kind === 'schleife' && f.items.some(i => i.id === sourceId));
  if (source) vb._select({ kooperationId: koopId, videoId: row.id, folderId: source.id, itemId: sourceId });
}

/* ---- Download ---- */

function downloadMeta(vb, koop) {
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
  try {
    await deleteAsset(item);
  } catch (err) {
    console.error('VideoBrowser: Löschen fehlgeschlagen', err);
    vb.toast('error', 'Datei konnte nicht gelöscht werden.');
    button.disabled = false;
    return;
  }
  vb.toast('success', 'Datei gelöscht.');
  if (vb.destroyed) return;
  if (vb.sel.itemId === item.id) vb._setSel(clearFrom(vb.sel, 3));
  try {
    await vb.reload();
  } catch (err) {
    console.error('VideoBrowser: Aktualisieren nach Löschen fehlgeschlagen', err);
  }
}
