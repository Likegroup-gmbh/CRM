// Liest FLOW-Felder aus campaign_briefings und faellt auf v1-Prefix-Spalten
// zurueck, wenn das neue Feld leer ist. Nur fuer Detail/PDF, nicht Edit.

const PREFIX = {
  influencer_marketing: 'im_',
  paid_creator_ads: 'pa_',
  owned_social: 'os_'
};

const FLOW_TO_SUFFIX = {
  aufgabe: 'umsetzung',
  setting: 'situationen',
  learnings_text: 'learnings_text',
  umsetzungsideen: 'ideen_text',
  produkt_erfahrung: 'voraussetzungen_custom',
  nischen: 'nischen',
  creator_groessen: 'creator_groessen',
  creator_merkmale: 'creator_merkmale',
  voraussetzungen: 'voraussetzungen'
};

function isEmpty(value) {
  if (value == null || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
    return true;
  }
  return false;
}

export function resolveBriefingFieldValue(briefing, fieldName) {
  const current = briefing?.[fieldName];
  if (!isEmpty(current)) return current;

  const prefix = PREFIX[briefing?.bereich];

  if (fieldName === 'publish_channels') {
    if (briefing?.bereich === 'paid_creator_ads') return current ?? null;
    if (prefix) return briefing[`${prefix}channels`] ?? null;
    return briefing?.im_channels ?? briefing?.os_channels ?? null;
  }
  if (fieldName === 'ad_channels') return briefing?.pa_channels ?? null;
  if (fieldName === 'funnel_stufen') return briefing?.pa_funnel_stufen ?? null;
  if (fieldName === 'paid_objectives') return briefing?.pa_objectives ?? null;
  if (fieldName === 'videolaengen') return briefing?.pa_videolaengen ?? null;
  if (fieldName === 'ziel_url') return briefing?.pa_ziel_url ?? briefing?.im_ziel_url ?? null;
  if (fieldName === 'content_ziele') return briefing?.os_content_ziele ?? null;

  const suffix = FLOW_TO_SUFFIX[fieldName];
  if (!suffix || !prefix) return current ?? null;
  return briefing[`${prefix}${suffix}`] ?? null;
}
