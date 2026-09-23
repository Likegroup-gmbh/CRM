// Listenwerte einer Produktion aus dem Briefing.
// Paid und Organic werden UGC ohne Reichweiten-Spalten.
// Influencer übernimmt Instagram/TikTok und Reel/Story, sonst die weite Vorgabe.

function channelGewaehlt(channels, key) {
  const value = channels?.[key];
  if (Array.isArray(value)) return value.length > 0;
  return value === true;
}

function influencerTkp(value) {
  if (value === '' || value === null || value === undefined) return 25;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 25;
}

/**
 * @param {object} briefing bereich, publish_channels, tkp
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

  const channels = briefing.publish_channels || {};
  const hatInstagram = channelGewaehlt(channels, 'instagram');
  const hatTiktok = channelGewaehlt(channels, 'tiktok');
  let plattformen;
  if (hatInstagram && hatTiktok) plattformen = 'instagram,tiktok';
  else if (hatInstagram) plattformen = 'instagram';
  else if (hatTiktok) plattformen = 'tiktok';
  else plattformen = 'instagram,tiktok';

  const formate = Array.isArray(channels.instagram) ? channels.instagram : [];
  const hatReel = formate.includes('reel');
  const hatStory = formate.includes('story');
  const instagramDabei = plattformen.includes('instagram');
  let igFormate = null;
  if (instagramDabei) {
    if (hatReel && hatStory) igFormate = 'reel,story';
    else if (hatReel) igFormate = 'reel';
    else if (hatStory) igFormate = 'story';
    else igFormate = 'reel,story';
  }

  return {
    liste_typ: 'influencer',
    plattformen,
    ig_formate: igFormate,
    tkp: influencerTkp(briefing.tkp)
  };
}
