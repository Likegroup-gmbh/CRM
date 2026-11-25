// kundeEinladen.js
// Zentraler Einstieg „Kunde einladen“ (ADR 0055, 0057): Drawer-Kontext je Art, Button, Öffnen.
// Briefing-Tab (Registry in KampagneWorkflowCreate) und Produkt-Listen (global und Produkte-Tab
// der Linie) bauen hier ihren Kontext und ihren Button; der Drawer selbst ist EinladungDrawer.

import { renderCreateButton } from '../../core/actions/CreateActionGate.js';
import { openEinladungDialog } from './EinladungDrawer.js';
import { openKonzeptEinladung } from './KonzeptEinladungDrawer.js';

export const KUNDE_EINLADEN_LABEL = 'Kunde einladen';
export const KUNDE_EINLADEN_ACTION = 'kundeEinladen';

export const KONZEPT_EINHOLEN_LABEL = 'Konzept einholen';
export const KONZEPT_EINHOLEN_ACTION = 'konzept-einholen';

/**
 * Gate der Konzept-Einladung (ADR 0059): Casting-Einträge, die weder vom Kunden abgelehnt noch
 * abgesagt noch unter „Nicht umsetzen“ stehen. Gleiche Regel wie in der Edge Function.
 */
export function konzeptEinladbar(item) {
  if (!item || item.isVorschlag) return false;
  if (item.abgelehnt || item.absage || item.nicht_umsetzen) return false;
  return item.kategorie !== 'Nicht umsetzen';
}

/**
 * Drawer-Kontext der Konzept-Einladung für markierte Casting-Einträge. Nicht einladbare Einträge
 * werden gezählt und übersprungen. null, wenn keiner einladbar ist.
 */
export function konzeptEinladungKontext({ items = [], kontextName = '', onFertig } = {}) {
  const einladbar = items.filter(konzeptEinladbar);
  if (!einladbar.length) return null;
  return {
    art: 'konzept',
    itemIds: einladbar.map((i) => i.id),
    uebersprungen: items.length - einladbar.length,
    kontextName,
    onFertig
  };
}

/** Eintrag im Zeilenmenü des Castings. Nur für Interne mit Recht und einladbare Einträge. */
export function konzeptEinholenMenuItemHtml(item, ctx = {}, iconHtml = '') {
  if (ctx.isKunde || window.isInternal?.() === false || !ctx.canCreate || !konzeptEinladbar(item)) return '';
  return `
    <a href="#" class="action-item" data-action="${KONZEPT_EINHOLEN_ACTION}" data-id="${item.id}">
      ${iconHtml}
      ${KONZEPT_EINHOLEN_LABEL}
    </a>`;
}

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
  if (kontext.art === 'konzept') {
    void openKonzeptEinladung(kontext);
    return;
  }
  openEinladungDialog(kontext);
}
