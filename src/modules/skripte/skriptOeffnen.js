// skriptOeffnen.js
// Ein Skript öffnen. Ein Host (z. B. der Skripte-Tab der Kampagne) fängt das
// Event ab und zeigt das Skript in seinem Interface; sonst geht es auf die Skript-Seite.

import { skriptEditorPath } from './SkripteUtils.js';

export const SKRIPT_OEFFNEN_EVENT = 'skript-oeffnen';

export function oeffneSkript(skriptId) {
  if (!skriptId) return;
  const event = new CustomEvent(SKRIPT_OEFFNEN_EVENT, { detail: { id: skriptId }, cancelable: true });
  const unbehandelt = window.dispatchEvent(event);
  if (unbehandelt) window.navigateTo(skriptEditorPath(skriptId));
}
