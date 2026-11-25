// kooperationFlowZiel.js
// Kooperation in der offenen Produktion zeigen: Tab Kooperationen, Zeile bzw. Karte angesprungen
// (ADR 0079). Gäste und wer den Tab nicht sieht, öffnen die Detailseite /kooperation/:id.

import { canViewTab } from '../../core/TabUtils.js';
import { flowUrl } from './produktionFlowZiele.js';

function darfKooperationImFlow() {
  if (window.guestShare || window.permissionSystem?.isGast || window.isGast?.()) return false;
  return canViewTab('kooperationen');
}

/**
 * @param {{ produktionId: string|null, linieId?: string|null, kooperationId: string }} ziel
 *   linieId: Linie der Kooperationstabelle, 'alle' oder null (Produktion ohne Linien)
 */
export function kooperationFlowUrl({ produktionId, linieId = null, kooperationId }) {
  if (!kooperationId) return null;
  if (!produktionId || !darfKooperationImFlow()) return `/kooperation/${kooperationId}`;
  return flowUrl({ produktionId, tab: 'kooperationen', linieId, fokus: kooperationId });
}
