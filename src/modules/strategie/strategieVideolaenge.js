// strategieVideolaenge.js
// Dauer an der Videoidee (strategie_items.videolaenge_von/bis): Source of Truth
// fuer das Skript. Das Briefing nennt die Videolaenge global, die Videoidee im
// Konzept ist die heruntergebrochene, finale Angabe. Sekunden, von und bis
// inklusive; leer heisst: keine Vorgabe an der Videoidee.
// Bedient wird sie ueber denselben Slider wie im Briefing (core/components/SekundenSpanne.js).

import { intervallOderNull, formatVideolaenge } from '../briefing/videolaenge.js';

/** Intervall der Videoidee oder null. Ungueltige Werte zaehlen als leer. */
export function getStrategieVideolaenge(item) {
  if (!item) return null;
  return intervallOderNull(item.videolaenge_von, item.videolaenge_bis);
}

/** Anzeige "15–20 Sek." bzw. "15 Sek."; leer ist ein leerer String. */
export function formatStrategieVideolaenge(item) {
  const iv = getStrategieVideolaenge(item);
  return iv ? formatVideolaenge(iv.von, iv.bis) : '';
}

/** Update-Objekt fuer ein Intervall. null leert beide Felder. */
export function buildStrategieVideolaengeUpdates(iv) {
  const gueltig = iv ? intervallOderNull(iv.von, iv.bis) : null;
  return {
    videolaenge_von: gueltig ? gueltig.von : null,
    videolaenge_bis: gueltig ? gueltig.bis : null
  };
}
