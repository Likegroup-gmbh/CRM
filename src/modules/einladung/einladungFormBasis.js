// einladungFormBasis.js
// Gemeinsamer Ablauf der öffentlichen Einladungsformulare (Briefing und Produkt, ADR 0055):
// Fehleranzeige und Absenden mit Knopf-Zustand, Sitzungsablauf und Rückmeldung. Die Felder
// bleiben je Art im jeweiligen Formular.
//
// Ein Formular muss tragen: root, token, sitzung, onFertig, onSitzungAbgelaufen, sendet und im
// Root `[data-fehler]` sowie `[data-aktion="senden"]`.

import { einladungSubmit } from './einladungApi.js';

const SENDEN_TEXT = 'Absenden';

/** Fehlertext im Formular zeigen oder (leer) verbergen. */
export function zeigeFormFehler(root, text) {
  const el = root?.querySelector('[data-fehler]');
  if (!el) return;
  el.textContent = text || '';
  el.hidden = !text;
}

/**
 * Schickt `formData` ab. Doppelklick wird ignoriert. Bei Erfolg `nachErfolg`, dann `onFertig`;
 * bei abgelaufener Sitzung `onSitzungAbgelaufen`; sonst steht der Fehler im Formular.
 */
export async function sendeEinreichung(formular, formData, { nachErfolg } = {}) {
  if (formular.sendet) return;
  formular.sendet = true;
  const knopf = formular.root.querySelector('[data-aktion="senden"]');
  knopf.disabled = true;
  knopf.textContent = 'Wird gesendet …';
  zeigeFormFehler(formular.root, '');

  const antwort = await einladungSubmit(formular.token, formular.sitzung, formData);

  formular.sendet = false;
  knopf.disabled = false;
  knopf.textContent = SENDEN_TEXT;

  if (antwort.ok) {
    nachErfolg?.();
    formular.onFertig();
    return;
  }
  if (antwort.sitzungAbgelaufen) {
    formular.onSitzungAbgelaufen();
    return;
  }
  zeigeFormFehler(formular.root, antwort.fehler);
}
