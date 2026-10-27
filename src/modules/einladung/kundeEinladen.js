// kundeEinladen.js
// Zentraler Einstieg „Kunde einladen“ (ADR 0055, 0057): Drawer-Kontext je Art, Button, Öffnen.
// Briefing-Tab (Registry in KampagneWorkflowCreate) und Produkt-Listen (global und Produkte-Tab
// der Linie) bauen hier ihren Kontext und ihren Button; der Drawer selbst ist EinladungDrawer.

import { renderCreateButton } from '../../core/actions/CreateActionGate.js';
import { openEinladungDialog } from './EinladungDrawer.js';

export const KUNDE_EINLADEN_LABEL = 'Kunde einladen';
export const KUNDE_EINLADEN_ACTION = 'kundeEinladen';

const OHNE_LINIE_HINWEIS = 'Erst ein Briefing (Linie) anlegen, dann kann der Kunde Produkte dafür einreichen.';

/** Drawer-Kontext der Briefing-Einladung: gehört zur Produktion. null ohne Produktion. */
export function briefingEinladungKontext(detail) {
  if (!detail?.produktionId) return null;
  return {
    art: 'briefing',
    produktionId: detail.produktionId,
    kampagneId: detail.kampagneId || null,
    unternehmenId: detail.kampagneData?.unternehmen_id || null,
    markeId: detail.kampagneData?.marke_id || null,
    kontextName: detail.produktion?.name || detail.lineTitle || ''
  };
}

/**
 * Drawer-Kontext der Produkt-Einladung: Marke, sonst Unternehmen; mit `briefingId` zusätzlich
 * an der Linie. null ohne Unternehmen.
 */
export function produktEinladungKontext({ unternehmenId, markeId = null, briefingId = null, kontextName = '' } = {}) {
  if (!unternehmenId) return null;
  return {
    art: 'produkt',
    unternehmenId,
    markeId: markeId || null,
    briefingId: briefingId || null,
    kontextName
  };
}

/**
 * Button „Kunde einladen“ mit dem Gate der anderen Create-Buttons. Nur für Interne und mit
 * Recht `permission`. `reason` (gesetzt) deaktiviert ihn mit diesem Hinweis.
 */
export function renderKundeEinladenButton({ permission, reason = '' } = {}) {
  if (window.isInternal?.() === false) return '';
  const darf = permission ? (window.canCreate?.(permission) ?? false) : true;
  return renderCreateButton({
    action: KUNDE_EINLADEN_ACTION,
    label: KUNDE_EINLADEN_LABEL,
    variant: 'secondary',
    state: { renderable: darf, enabled: darf && !reason, reason }
  });
}

/** Hinweis für den deaktivierten Button auf dem Produkte-Tab ohne Linie. */
export function ohneLinieHinweis() {
  return OHNE_LINIE_HINWEIS;
}

/** Öffnet den Einladungs-Drawer. Ohne Kontext passiert nichts. */
export function oeffneKundeEinladen(kontext, { warnung = '' } = {}) {
  if (!kontext) {
    if (warnung) window.toastSystem?.warning(warnung);
    return;
  }
  openEinladungDialog(kontext);
}
