// briefingVorgaben.js
// Briefing-Felder -> Generator (Videolänge, Funnel-Stufe).
// Die Videolänge ist das exakte Sekundenintervall, kein 15er-Eimer.

import { skriptSchluessel, videolaengeAusBriefing } from '../briefing/videolaenge.js';

const FUNNEL_MAP = { upper: 'top', mid: 'mid', lower: 'bottom' };

function erstesItem(val) {
  if (Array.isArray(val)) return val[0] ?? null;
  if (typeof val === 'string' && val.trim()) return val.trim();
  return null;
}

export function briefingFunnelStufe(briefing) {
  if (!briefing) return null;
  const raw = briefing.bereich === 'influencer_marketing'
    ? briefing.im_funnel_stufen
    : briefing.bereich === 'paid_creator_ads'
      ? briefing.pa_funnel_stufen
      : null;
  const first = erstesItem(raw);
  return FUNNEL_MAP[first] || null;
}

export function briefingVideoLaenge(briefing) {
  const iv = videolaengeAusBriefing(briefing);
  if (!iv) return null;
  return skriptSchluessel(iv.von, iv.bis);
}

export function briefingVorgaben(briefing) {
  return {
    video_laenge: briefingVideoLaenge(briefing),
    funnel_stufe: briefingFunnelStufe(briefing)
  };
}
