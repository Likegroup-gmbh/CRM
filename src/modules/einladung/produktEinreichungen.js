// produktEinreichungen.js
// Produkt-Seite des zentralen Eingangs (EinreichungInbox, ADR 0055, 0057): „Kunde einladen“ und
// Eingang der offenen Produkt-Einreichungen in der Produktliste.
//  - Globale Liste: Kontext ist Marke, sonst Unternehmen; der Eingang zeigt alle offenen dieses
//    Kontexts (Linien-Einreichungen mit Hinweis „für Linie X“), ohne Kontext alle.
//  - Produkte-Tab einer Linie (embedScope): die Einladung hängt zusätzlich an der Linie, der
//    Eingang zeigt nur deren Einreichungen und der Tab bekommt den Zähler.

import { mountEinreichungInbox, istStaff } from './EinreichungInbox.js';
import {
  KUNDE_EINLADEN_ACTION,
  ohneLinieHinweis,
  oeffneKundeEinladen,
  produktEinladungKontext,
  renderKundeEinladenButton
} from './kundeEinladen.js';

/** Kontext der Liste: Linie (Produkte-Tab), sonst Marke vor Unternehmen. */
export function einladungsKontext(list) {
  const scope = list.embedScope;
  if (scope) {
    return {
      unternehmenId: scope.unternehmenId || null,
      markeId: scope.markeId || null,
      briefingId: scope.briefingId || null,
      name: scope.briefingName || ''
    };
  }
  const unternehmenId = list.currentUnternehmenId || null;
  const markeId = (list._ohneMarke ? null : list.currentMarkeId) || null;
  const name = markeId
    ? [list.currentUnternehmenName, list.currentMarkeName].filter(Boolean).join(' · ')
    : (list.currentUnternehmenName || '');
  return { unternehmenId, markeId, briefingId: null, name };
}

/** Filter des Eingangs: Linie auf dem Produkte-Tab (ohne Linie nichts), sonst Marke/Unternehmen. */
export function produktEinreichungFilter(list, kontext = einladungsKontext(list)) {
  if (list.embedScope) return kontext.briefingId ? { briefingId: kontext.briefingId } : null;
  return { markeId: kontext.markeId, unternehmenId: kontext.unternehmenId };
}

/**
 * Nach dem Rendern der Produktliste aufrufen (Grid und Liste).
 * Setzt den Button in `.table-actions` und den Eingang unter die Filterleiste. Idempotent.
 */
export async function mountProduktEinladung(list, root = list.mountRoot || document) {
  if (!istStaff() || !list.canEdit) return;
  const kontext = einladungsKontext(list);
  const embed = !!list.embedScope;

  const actions = root.querySelector('.table-actions');
  if (actions && kontext.unternehmenId && !actions.querySelector(`[data-create-action="${KUNDE_EINLADEN_ACTION}"]`)) {
    // Auf dem Produkte-Tab braucht die Einladung eine Linie, an die das Produkt kommt.
    const reason = embed && !kontext.briefingId ? ohneLinieHinweis() : '';
    actions.insertAdjacentHTML('afterbegin', renderKundeEinladenButton({ reason }));
    actions.querySelector(`[data-create-action="${KUNDE_EINLADEN_ACTION}"]`)?.addEventListener('click', () => {
      oeffneKundeEinladen(produktEinladungKontext({
        unternehmenId: kontext.unternehmenId,
        markeId: kontext.markeId,
        briefingId: kontext.briefingId,
        kontextName: kontext.name
      }));
    });
  }

  const anker = root.querySelector('.table-filter-wrapper');
  if (!anker) return;
  let host = root.querySelector('[data-produkt-einreichungen]');
  if (!host) {
    host = document.createElement('div');
    host.className = 'einreichung-inbox';
    host.dataset.produktEinreichungen = '';
    host.hidden = true;
    anker.insertAdjacentElement('afterend', host);
  }
  await mountEinreichungInbox({
    art: 'produkt',
    host,
    filter: produktEinreichungFilter(list, kontext),
    tabBadge: embed
  });
}
