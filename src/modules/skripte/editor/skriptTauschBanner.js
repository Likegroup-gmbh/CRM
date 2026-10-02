// skriptTauschBanner.js
// Creator-Tausch im Skript-Editor: Button im Doc-Kopf und Hinweis-Banner, bis
// er quittiert wird. Der Vermerk (skripte.creator_tausch) kommt aus der RPC creator_tausch.

import { escapeHtml } from '../SkripteUtils.js';
import { skripteService } from '../SkripteService.js';
import { icon } from '../../../core/icons/IconSystem.js';

/** Button im Doc-Kopf, neben dem Creator-Chip. */
export function tauschSkriptButtonHtml() {
  return `
    <button type="button" class="mdc-btn mdc-btn--secondary skripte-editor-share-btn" id="ed-creator-tauschen"
      title="Creator tauschen">
      <span class="mdc-btn__icon">${icon('arrows-right-left')}</span>
      <span class="mdc-btn__label">Tauschen</span>
    </button>`;
}

export function tauschBannerHtml(skript) {
  const t = skript?.creator_tausch;
  if (!t || t.quittiert || !window.isInternal?.()) return '';
  return `
    <div class="skripte-editor-tausch-banner" role="status">
      <span>Creator getauscht: vorher <strong>${escapeHtml(t.vorher_name || 'Creator')}</strong>,
        jetzt <strong>${escapeHtml(t.jetzt_name || 'Creator')}</strong>.
        Prüfe Ansprache und Besetzung im Skript.</span>
      <button type="button" class="mdc-btn mdc-btn--secondary" id="ed-tausch-quittieren">
        <span class="mdc-btn__label">Passt so</span>
      </button>
    </div>`;
}

/** Quittieren: Vermerk bleibt als Historie am Skript, nur das Banner verschwindet. */
export async function quittiereTausch(view) {
  const skript = view?.skript;
  if (!skript?.id || !skript.creator_tausch) return;
  const vermerk = { ...skript.creator_tausch, quittiert: true };
  try {
    await skripteService.updateSkript(skript.id, { creator_tausch: vermerk });
    skript.creator_tausch = vermerk;
    view.renderDoc();
  } catch (err) {
    window.toastSystem?.error(err.message);
  }
}
