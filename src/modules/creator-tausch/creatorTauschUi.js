// creatorTauschUi.js
// Einstiege in den Creator-Tausch: Menueintrag in der Casting-Zeile, Button im
// Skript-Kopf, gemeinsamer Oeffner. Haelt die Verdrahtung in den Seiten klein.

import { icon } from '../../core/icons/IconSystem.js';
import { creatorAuswahlService } from '../creator-auswahl/CreatorAuswahlService.js';
import { openCreatorTauschDialog } from './CreatorTauschDialog.js';

export const TAUSCH_ACTION = 'tausch-creator';

/** Menueintrag fuer die Casting-Zeile: nur echte Eintraege mit Creator, nur mit Bearbeiten-Recht. */
export function tauschMenuItemHtml(item, ctx = {}) {
  if (!item?.creator_id || item.isVorschlag || ctx.isKunde || !(ctx.canEdit ?? true)) return '';
  return `
    <a href="#" class="action-item" data-action="${TAUSCH_ACTION}" data-id="${item.id}">
      ${icon('arrows-right-left')}
      Creator tauschen
    </a>`;
}

/** Gemeinsamer Einstieg. Ruft onSuccess nur nach erfolgreichem Tausch. */
export async function openCreatorTausch({ alterItemId, onSuccess } = {}) {
  if (!alterItemId) return false;
  const erfolg = await openCreatorTauschDialog(alterItemId);
  if (erfolg) await onSuccess?.();
  return erfolg;
}

/** Casting-Seite: nach dem Tausch Eintraege neu laden und Tabelle neu zeichnen. */
export function tauscheImCasting(detail, alterItemId) {
  return openCreatorTausch({
    alterItemId,
    onSuccess: async () => {
      detail.items = await creatorAuswahlService.getItems(detail.listeId);
      detail.rerenderTable();
    }
  });
}
