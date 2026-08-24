// briefingVorgaben.js
// Briefing-Felder -> Generator-Selects (Video-Laenge, Funnel-Stufe).
// Mapping ist bewusst einseitig: Formular-Werte fliessen so ins Payload/Wort-Budget.

import { VIDEO_LAENGEN } from './skripteKonstanten.js';

const FUNNEL_MAP = { upper: 'top', mid: 'mid', lower: 'bottom' };

const PAID_SEKUNDEN = {
  '6s': 6, '10s': 10, '15s': 15, '20s': 20, '30s': 30, '60s': 60
};

const LAENGE_VON = Object.keys(VIDEO_LAENGEN).map((k) => parseInt(k.split('-')[0], 10));
const MAX_VON = Math.max(...LAENGE_VON);

/** Sekunden n -> VIDEO_LAENGEN-Key. von = floor((n-1)/15)*15, geclamppt. */
export function sekundenZuLaenge(n) {
  if (!Number.isFinite(n) || n <= 0) return null;
  const von = Math.min(MAX_VON, Math.max(0, Math.floor((n - 1) / 15) * 15));
  return `${von}-${von + 15}`;
}

function erstesItem(val) {
  if (Array.isArray(val)) return val[0] ?? null;
  if (typeof val === 'string' && val.trim()) return val.trim();
  return null;
}

/** Paid-Token oder Freitext ("30-60 Sek.", "max. 45") -> VIDEO_LAENGEN-Key. */
export function parseVideolaengeText(text) {
  if (text == null) return null;
  const raw = String(text).trim();
  if (!raw || raw === 'individuell' || raw === 'agenturempfehlung') return null;
  if (PAID_SEKUNDEN[raw] != null) return sekundenZuLaenge(PAID_SEKUNDEN[raw]);
  const nums = raw.match(/\d+/g);
  if (!nums) return null;
  return sekundenZuLaenge(Math.max(...nums.map((n) => parseInt(n, 10))));
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
  if (!briefing) return null;
  if (briefing.bereich === 'paid_creator_ads') {
    return parseVideolaengeText(erstesItem(briefing.pa_videolaengen));
  }
  const fmt = briefing.bereich === 'influencer_marketing'
    ? briefing.im_formatvorgaben
    : briefing.bereich === 'owned_social'
      ? briefing.os_formatvorgaben
      : null;
  return parseVideolaengeText(fmt?.videolaenge);
}

export function briefingVorgaben(briefing) {
  return {
    video_laenge: briefingVideoLaenge(briefing),
    funnel_stufe: briefingFunnelStufe(briefing)
  };
}
