// videoBrowserDownload.js
// Downloads im Videos-Tab: einzelne Datei, alle Dateien eines Ordners oder die
// aktuellen Videos einer Kooperation. Was zu welchem Umfang gehört, steht in
// videoBrowserLogic.collectDownloadItems. Hier: Dateinamen und das Herunterladen,
// Datei für Datei über downloadMediaAsset.

import { downloadMediaAsset } from '../../core/media/downloadMediaAsset.js';
import { buildAssetDownloadName } from '../../core/VideoUploadUtils.js';

const DOWNLOAD_DELAY_MS = 500;

function extensionOf(asset, fallback) {
  const path = asset?.file_path || asset?.file_url || asset?.file_name || '';
  const match = /\.([a-zA-Z0-9]{2,5})(?:\?|#|$)/.exec(path);
  return match ? match[1] : fallback;
}

/** Dateiname wie beim Upload, damit Varianten und Versionen unterscheidbar bleiben. */
export function downloadFileName({ item, row }, meta) {
  const asset = item.asset;
  if (item.type === 'video') {
    const name = buildAssetDownloadName(meta, { position: row.number }, asset);
    const variant = !asset.is_final && asset.variant_name
      ? String(asset.variant_name).trim().replace(/[\\/:*?"<>|\s]+/g, '_')
      : '';
    if (!variant) return name;
    const dot = name.lastIndexOf('.');
    return dot > 0 ? `${name.slice(0, dot)}_${variant}${name.slice(dot)}` : `${name}_${variant}`;
  }
  const ext = extensionOf(asset, item.type === 'story' ? 'mp4' : 'jpg');
  const base = asset.file_name || `${row.label}_v${item.version || 1}`;
  return /\.[a-zA-Z0-9]{2,5}$/.test(base) ? base : `${base}.${ext}`;
}

/**
 * Lädt die Einträge nacheinander herunter. Einzelne Datei: eigene Toasts von
 * downloadMediaAsset. Mehrere: eine Sammelmeldung am Ende.
 * @param {Array<{ item: object, row: object }>} entries
 * @param {{ creatorName?: string, unternehmen?: string, kampagne?: string }} meta
 * @returns {Promise<{ done: number, failed: number }>}
 */
export async function downloadItems(entries, meta, { toast } = {}) {
  const notify = toast || ((type, text) => window.toastSystem?.show?.(text, type));
  if (!entries.length) {
    notify('warning', 'Keine Dateien zum Herunterladen.');
    return { done: 0, failed: 0 };
  }

  if (entries.length === 1) {
    const ok = await downloadMediaAsset(entries[0].item.asset, downloadFileName(entries[0], meta));
    return { done: ok ? 1 : 0, failed: ok ? 0 : 1 };
  }

  notify('info', `Starte Download von ${entries.length} Dateien...`);
  let done = 0;
  let failed = 0;
  for (let i = 0; i < entries.length; i++) {
    try {
      const ok = await downloadMediaAsset(entries[i].item.asset, downloadFileName(entries[i], meta), { silent: true });
      if (ok) done++; else failed++;
    } catch (err) {
      console.error('VideoBrowser: Download fehlgeschlagen', err);
      failed++;
    }
    if (i < entries.length - 1) await new Promise(resolve => setTimeout(resolve, DOWNLOAD_DELAY_MS));
  }
  const parts = [`${done}/${entries.length} Dateien heruntergeladen`];
  if (failed) parts.push(`${failed} fehlgeschlagen`);
  notify(failed ? 'warning' : 'success', parts.join(' · '));
  return { done, failed };
}
