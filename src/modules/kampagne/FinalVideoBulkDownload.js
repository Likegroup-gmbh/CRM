// FinalVideoBulkDownload.js
// Checkbox-Auswahl von Kooperationen in der Kooperationstabelle + Bulk-Download
// aller finalen Video-Assets (is_final, alle Varianten wie 9:16/4:5).
// Auswahl ist ephemeral (Set im Speicher), kein BulkActionSystem (das ist Delete).

import { downloadMediaAsset } from '../../core/media/downloadMediaAsset.js';
import { buildAssetDownloadName } from '../../core/VideoUploadUtils.js';

const FINAL_SELECT = 'id, video_id, file_url, file_path, variant_name, is_final';
const DOWNLOAD_DELAY_MS = 500;

export class FinalVideoBulkDownload {
  constructor(table) {
    this.table = table;
    this.selected = new Set();
    this._running = false;
  }

  get enabled() {
    return window.canFeature?.('mediaDownload') ?? false;
  }

  isSelected(kooperationId) {
    return this.selected.has(kooperationId);
  }

  /** Change-Events der Checkboxen an den Tabelle-Container binden. */
  bind(container, signal) {
    if (!this.enabled) return;

    container.addEventListener('change', (e) => {
      if (e.target.classList.contains('koop-final-check')) {
        const id = e.target.dataset.kooperationId;
        if (!id) return;
        if (e.target.checked) this.selected.add(id);
        else this.selected.delete(id);
        this._syncHeaderCheckbox(container);
        return;
      }
      if (e.target.id === 'select-all-koop-finals') {
        const checked = e.target.checked;
        container.querySelectorAll('.koop-final-check').forEach(cb => {
          cb.checked = checked;
          if (checked) this.selected.add(cb.dataset.kooperationId);
          else this.selected.delete(cb.dataset.kooperationId);
        });
        this._syncHeaderCheckbox(container);
      }
    }, { signal });
  }

  /** Nach jedem Re-Render: Haken aus dem Set wiederherstellen. */
  syncAfterRender() {
    if (!this.enabled) return;
    const container = document.querySelector('.kooperation-video-grid');
    if (!container) return;
    container.querySelectorAll('.koop-final-check').forEach(cb => {
      cb.checked = this.selected.has(cb.dataset.kooperationId);
    });
    this._syncHeaderCheckbox(container);
  }

  _syncHeaderCheckbox(container) {
    const header = container.querySelector('#select-all-koop-finals');
    if (!header) return;
    const boxes = [...container.querySelectorAll('.koop-final-check')];
    const checkedCount = boxes.filter(cb => cb.checked).length;
    header.checked = boxes.length > 0 && checkedCount === boxes.length;
    header.indeterminate = checkedCount > 0 && checkedCount < boxes.length;
  }

  _metaFor(koop) {
    const info = this.table.kampagneInfo || {};
    return {
      creatorName: `${koop.creator?.vorname || ''} ${koop.creator?.nachname || ''}`.trim(),
      unternehmen: info.unternehmen || '',
      kampagne: info.name || '',
    };
  }

  /**
   * Laedt nacheinander alle finalen Video-Assets der markierten Kooperationen.
   * Frisch aus der DB gelesen (finalAssets im Store koennen veraltet sein).
   */
  async downloadSelected() {
    if (this._running) return;
    if (this.selected.size === 0) {
      window.toastSystem?.show('Bitte zuerst Kooperationen markieren.', 'warning');
      return;
    }

    const koops = this.table.kooperationen.filter(k => this.selected.has(k.id));
    const videoById = new Map();
    for (const koop of koops) {
      for (const v of (this.table.videos[koop.id] || [])) {
        videoById.set(v.id, { video: v, koop });
      }
    }

    if (videoById.size === 0) {
      window.toastSystem?.show('Die markierten Kooperationen haben keine Videos.', 'warning');
      return;
    }

    this._running = true;
    try {
      const { data, error } = await window.supabase
        .from('kooperation_video_asset')
        .select(FINAL_SELECT)
        .in('video_id', [...videoById.keys()])
        .eq('is_final', true);

      if (error) throw error;

      const downloadable = (data || []).filter(a => a.file_path || a.file_url);
      if (downloadable.length === 0) {
        window.toastSystem?.show('Keine finalen Videos in der Auswahl.', 'info');
        return;
      }

      window.toastSystem?.show(`Starte Download von ${downloadable.length} finalen Video(s)...`, 'info');

      let done = 0;
      let failed = 0;
      for (const asset of downloadable) {
        const ctx = videoById.get(asset.video_id);
        const filename = ctx
          ? buildAssetDownloadName(this._metaFor(ctx.koop), ctx.video, asset)
          : undefined;
        try {
          const ok = await downloadMediaAsset(asset, filename, { silent: true });
          if (ok) done++;
          else failed++;
        } catch (err) {
          console.error('[FinalVideoBulkDownload] Download fehlgeschlagen:', err);
          failed++;
        }
        if (asset !== downloadable[downloadable.length - 1]) {
          await new Promise(resolve => setTimeout(resolve, DOWNLOAD_DELAY_MS));
        }
      }

      const videosMitFinal = new Set(downloadable.map(a => a.video_id)).size;
      const skipped = videoById.size - videosMitFinal;
      const parts = [`${done}/${downloadable.length} finale Videos heruntergeladen`];
      if (failed > 0) parts.push(`${failed} fehlgeschlagen`);
      if (skipped > 0) parts.push(`${skipped} Video(s) ohne Final übersprungen`);
      window.toastSystem?.show(parts.join(' · '), failed > 0 ? 'warning' : 'success');
    } catch (err) {
      console.error('[FinalVideoBulkDownload]', err);
      window.toastSystem?.show(err.message || 'Bulk-Download fehlgeschlagen', 'error');
    } finally {
      this._running = false;
    }
  }
}
