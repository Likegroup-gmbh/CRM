// castingFreigabeLogik.js
// Kooperationsfreigabe (CONTEXT.md): reine Regeln ohne DOM und Supabase.
// Zustand des Buttons: 'locked' | 'ready' | 'done'.

import { getKundenFeedback, getSourcingStatus } from './sourcingStatusOptions.js';

const FREIGABE_FEEDBACK = new Set(['prio_1', 'prio_2']);
const FREIGABE_STATUS = new Set(['zusage', 'gebucht']);

/** Kundenfeedback Prio 1/2 und Status Zusage oder Gebucht, so wie die Selects es anzeigen. */
export function istFreigabeBereit(item) {
  if (!item || item.isVorschlag) return false;
  return FREIGABE_FEEDBACK.has(getKundenFeedback(item)) && FREIGABE_STATUS.has(getSourcingStatus(item));
}

/** Ohne Kampagne und Produktion hat die Kooperation keine Linie. */
export function hatProduktionsKontext(liste) {
  return !!(liste?.kampagne_id && liste?.produktion_id);
}

/** Spalte und Button nur intern und mit Recht auf Kooperation anlegen. */
export function zeigtFreigabeSpalte(ctx) {
  return !ctx?.isKunde && !!ctx?.canCreateKooperation;
}

/**
 * Freigegeben ist, wessen Creator in der Linie schon eine Kooperation hat,
 * egal auf welchem Weg sie entstand.
 * @param {object} item
 * @param {{ freigegebeneCreatorIds?: Set<string>, kontextOk?: boolean }} opts
 */
export function freigabeZustand(item, { freigegebeneCreatorIds, kontextOk = true } = {}) {
  if (item?.creator_id && freigegebeneCreatorIds?.has(item.creator_id)) return 'done';
  if (!kontextOk) return 'locked';
  return istFreigabeBereit(item) ? 'ready' : 'locked';
}

export const FREIGABE_LABEL = Object.freeze({ offen: 'Freigeben', fertig: 'Freigegeben' });

export function freigabeTitel(zustand, { kontextOk = true } = {}) {
  if (zustand === 'done') return 'Kooperation ist angelegt';
  if (zustand === 'ready') return 'Kooperation anlegen';
  if (!kontextOk) return 'Das Casting hängt an keiner Produktion';
  return 'Ab Kundenfeedback Prio 1 oder 2 und Status Zusage oder Gebucht';
}

/**
 * Kooperationsname wie im Formular (AutoGeneration): "Vorname Nachname n/max".
 * n ist die hoechste vorhandene Nummer der Kampagne plus 1.
 */
export function buildKooperationsName(creator, vorhandeneNamen = [], creatoranzahl = 1) {
  const nummern = vorhandeneNamen
    .map(name => Number(String(name || '').match(/(\d+)\/\d+$/)?.[1] || 0))
    .filter(n => n > 0);
  const nummer = nummern.length ? Math.max(...nummern) + 1 : vorhandeneNamen.length + 1;
  const voll = `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim();
  const anzeige = voll || (creator?.instagram ? `@${creator.instagram}` : 'Creator');
  return `${anzeige} ${nummer}/${creatoranzahl || 1}`;
}
