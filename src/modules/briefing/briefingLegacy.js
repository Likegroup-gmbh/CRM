// briefingLegacy.js
// Ältere Briefings lesen: Felder des Creator-Briefings mit Fallback auf die Präfix-Spalten
// (resolveBriefingFieldValue) und reine v1-Briefings erkennen (isLegacyBriefing).
// v1 liest Aufgabe und Setting weiter aus den Präfix-Spalten, daher mirrorLegacyColumns.

import { anzeigeWert } from './videolaenge.js';
import { briefingPlattformen, umsetzungsideenEintraege } from './briefingAltfelder.js';
import { LEGACY_MODULE_FIELDS, fmtBriefingValue, isEmpty } from './briefingLegacyKatalog.js';

export { LEGACY_MODULE_FIELDS, fmtBriefingValue } from './briefingLegacyKatalog.js';

const PREFIX = {
  influencer_marketing: 'im_',
  paid_creator_ads: 'pa_',
  owned_social: 'os_'
};

// Ein befülltes Feld hieraus heißt: das Briefing kommt aus dem V2-Formular.
const FLOW_MARKERS = [
  'aufgabe', 'beschreibung', 'setting', 'kernbotschaft', 'nutzungsrechte', 'plattformen',
  'vorgabe_pflicht', 'vorgabe_dos', 'vorgabe_donts', 'umsetzungsideen_eintraege',
  'nischen', 'pflichtinhalte', 'wichtige_vorgaben'
];

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

function hasFlowContent(briefing) {
  return FLOW_MARKERS.some(name => !isEmpty(briefing?.[name]));
}

function hasPrefixContent(briefing) {
  const catalog = LEGACY_MODULE_FIELDS[briefing?.bereich] || [];
  return catalog.some(field => fmtBriefingValue(briefing?.[field.name]) != null);
}

export function isLegacyBriefing(briefing) {
  if (!briefing) return false;
  if (hasFlowContent(briefing)) return false;
  return hasPrefixContent(briefing);
}

export function resolveBriefingFieldValue(briefing, fieldName) {
  if (fieldName === 'videolaenge') return anzeigeWert(briefing);
  if (fieldName === 'plattformen') {
    const liste = briefingPlattformen(briefing);
    return liste.length ? liste : null;
  }
  if (fieldName === 'umsetzungsideen_eintraege') {
    const liste = umsetzungsideenEintraege(briefing);
    return liste.length ? liste : null;
  }
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

/** Aufgabe und Setting zusätzlich in die Präfix-Spalten schreiben (nur Keys, die in data stehen). */
export function mirrorLegacyColumns(data, bereich) {
  const prefix = PREFIX[bereich];
  if (!prefix) return;
  if ('aufgabe' in data) data[`${prefix}umsetzung`] = data.aufgabe || null;
  if ('setting' in data) data[`${prefix}situationen`] = data.setting || null;
}

/** Befüllte Felder eines v1-Briefings als Zeilen für „Frühere Angaben“. */
export function legacyAngaben(briefing, escape = (s) => String(s ?? '')) {
  const catalog = LEGACY_MODULE_FIELDS[briefing?.bereich] || [];
  const rows = [];
  for (const field of catalog) {
    const formatted = fmtBriefingValue(briefing?.[field.name]);
    if (formatted) rows.push({ name: field.name, label: field.label, html: escape(formatted) });
  }
  return rows;
}
