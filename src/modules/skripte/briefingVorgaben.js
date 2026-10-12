// briefingVorgaben.js
// Briefing-Felder -> Generator (Videolänge).
// Die Videolänge ist das exakte Sekundenintervall, kein 15er-Eimer.
// Die Funnel-Stufe kommt nicht mehr aus dem Briefing: sie sitzt an der Videoidee
// im Konzept und schlägt das Briefing (siehe strategieFunnelOptions.js).
// Bei Paid hängt die Videolänge an dieser Stufe (videolaenge_funnel), sonst
// gilt die allgemeine Videolänge des Briefings.

import { skriptSchluessel, videolaengeFuerStufe } from '../briefing/videolaenge.js';

/**
 * @param {object} briefing
 * @param {string|null} stufe Stufe im Briefing-Vokabular (upper/mid/lower), nicht top/mid/bottom
 */
export function briefingVideoLaenge(briefing, stufe = null) {
  const iv = videolaengeFuerStufe(briefing, stufe);
  if (!iv) return null;
  return skriptSchluessel(iv.von, iv.bis);
}

export function briefingVorgaben(briefing, stufe = null) {
  return {
    video_laenge: briefingVideoLaenge(briefing, stufe)
  };
}
