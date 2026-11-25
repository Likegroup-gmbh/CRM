// PromoteFinalControl
// "Als finale Version markieren": Menue-HTML fuer Video/Still und der Klick-
// Handler samt Seiteneffekten (Asset-Cache, Drawer-Refresh, Bilder-Reload,
// Tabellen-Refilter). Einziger Pfad des Players nach PromoteFinalAsset.
// host = VideoPlayerLightbox: session, assetLoader, lightbox, table.

import { promoteAssetToFinal, unmarkFinalSlot, markedSlotsForSource } from '../../PromoteFinalAsset.js';
import { FINAL_VARIANTS } from '../../VideoUploadUtils.js';
import { finalStills } from '../../stills/stillAssets.js';
import { selectedVideoAsset } from './selection/video.js';
import { stillImages, currentStillAsset } from './selection/still.js';

export class PromoteFinalControl {
  constructor(host) {
    this.host = host;
  }

  /** HTML des Menues (leer fuer Kunden, Storys, bereits finale Assets). */
  html() {
    const { session, assetLoader } = this.host;
    const item = session.current;
    if (!item || session.table?.isKundeRole?.()) return '';

    if (item.type === 'video') {
      if (session.video.version === 'final') return '';
      const asset = selectedVideoAsset(session, assetLoader);
      if (!asset || asset.is_final) return '';
      const marked = markedSlotsForSource(assetLoader.finalVariants(session.assets), asset.id);
      const buttons = FINAL_VARIANTS.map(slot => {
        const on = marked.includes(slot);
        const title = on
          ? `Finale Version ${slot} aufheben`
          : `Als finale Version auswählen (${slot})`;
        return `<button type="button" class="promote-final-btn${on ? ' is-active' : ''}" data-kind="video" data-slot="${slot}" title="${title}" ${on ? 'data-unmark="1"' : ''}>${on ? `Final ${slot}` : `Als ${slot}`}</button>`;
      }).join('');
      return `<div class="media-viewer-control vpl-promote"><span class="promote-final-label">Finale Version</span>${buttons}</div>`;
    }

    if (item.type === 'bild') {
      if (session.still.version === 'final') return '';
      const asset = currentStillAsset(session);
      if (!asset || asset.is_final) return '';
      const marked = markedSlotsForSource(finalStills(stillImages(session)), asset.id);
      const on = marked.length > 0;
      return `<div class="media-viewer-control vpl-promote">
        <button type="button" class="promote-final-btn${on ? ' is-active' : ''}" data-kind="still" title="${on ? 'Finale Version aufheben' : 'Als finale Version auswählen'}" ${on ? 'data-unmark="1"' : ''}>${on ? 'Final aufheben' : 'Als final markieren'}</button>
      </div>`;
    }
    return '';
  }

  /** Klick-Handler an die Menue-Buttons im Body binden. */
  bind(root) {
    root.querySelectorAll('.promote-final-btn').forEach(btn => {
      btn.addEventListener('click', () => this._onClick(btn));
    });
  }

  _source(kind) {
    const { session, assetLoader } = this.host;
    if (kind !== 'still') return selectedVideoAsset(session, assetLoader);
    const still = currentStillAsset(session);
    return {
      ...still,
      video_id: still?.video_id || session.current?.video?.id,
      kooperation_id: still?.kooperation_id || session.current?.koop?.id,
    };
  }

  async _onClick(btn) {
    const { session, assetLoader, lightbox, table } = this.host;
    const kind = btn.dataset.kind;
    const slot = btn.dataset.slot;
    const unmark = btn.dataset.unmark === '1';
    const source = this._source(kind);
    if (!source) return;

    btn.disabled = true;
    try {
      if (unmark) {
        await unmarkFinalSlot(kind, source.video_id || session.current?.video?.id, slot, kind === 'video' ? source.id : undefined);
      } else {
        await promoteAssetToFinal(kind, source, slot);
      }
      if (kind === 'video') {
        session.assets = await assetLoader.reload(source.video_id);
        table?._drawerActions?.refreshFinalAssetsForVideo(source.video_id, session.current?.koop?.id);
      } else {
        const koopId = source.kooperation_id || session.current?.koop?.id;
        if (koopId) await table?.dataLoader?.loadBilder([koopId]);
        table?.refilter?.();
      }
      await lightbox.update();
    } catch (err) {
      window.toastSystem?.show(err.message || 'Markieren fehlgeschlagen', 'error');
      btn.disabled = false;
    }
  }
}
