// Listenwerte einer Produktion aus dem Briefing (nur beim ersten Anlegen des Castings).
// Paid und Organic werden UGC ohne Reichweiten-Spalten.
// Influencer übernimmt Instagram/TikTok aus den Plattformen des Briefings, sonst beide.
// Das Briefing fragt weder IG-Formate noch TKP ab (ADR 0073): Formate nur aus
// älteren Briefings, sonst Reel und Story; TKP startet mit 25.

import { briefingPlattformen } from '../briefing/briefingAltfelder.js';

const TKP_START = 25;

/**
 * @param {object} briefing bereich, plattformen (ältere: publish_channels)
 * @returns {{liste_typ: string|null, plattformen: string|null, ig_formate: string|null, tkp: number|null}}
 */
export function castingPresetFromBriefing(briefing = {}) {
  const bereich = briefing.bereich;
  if (bereich === 'paid_creator_ads' || bereich === 'owned_social') {
    return { liste_typ: 'ugc', plattformen: null, ig_formate: null, tkp: null };
  }
  if (bereich !== 'influencer_marketing') {
    return { liste_typ: null, plattformen: null, ig_formate: null, tkp: null };
  }

  const imBriefing = briefingPlattformen(briefing);
  const gewaehlt = ['instagram', 'tiktok'].filter((p) => imBriefing.includes(p));
  const plattformen = gewaehlt.length ? gewaehlt.join(',') : 'instagram,tiktok';

  const formate = Array.isArray(briefing.publish_channels?.instagram) ? briefing.publish_channels.instagram : [];
  const auswahl = ['reel', 'story'].filter((f) => formate.includes(f));
  const igFormate = plattformen.includes('instagram') ? (auswahl.length ? auswahl.join(',') : 'reel,story') : null;

  return {
    liste_typ: 'influencer',
    plattformen,
    ig_formate: igFormate,
    tkp: TKP_START
  };
}
