// entityIcons.js
// Einzige Stelle, an der Fachbegriffe (Entities/Routen) auf Icon-Keys treffen.
// Neue Icons kommen in iconDefs.js, fachliche Zuordnung ausschliesslich hier.

import { icon, hasIcon } from './IconSystem.js';

export const ENTITY_ICONS = {
  dashboard: 'home',
  'projekt-erstellen': 'plus-sign',
  unternehmen: 'unternehmen',
  management: 'management',
  marke: 'tag',
  ansprechpartner: 'user-circle',
  creator: 'creator',
  creators: 'creator',
  sourcing: 'sourcing',
  mitarbeiter: 'users',
  'kunden-admin': 'user-circle',
  auftrag: 'auftrag',
  auftragsdetails: 'auftragsdetails',
  kampagne: 'campaign',
  strategie: 'strategy',
  vertrag: 'contract',
  vertraege: 'contract',
  video: 'video',
  videos: 'video',
  rechnung: 'rechnung',
  ausgangsrechnungen: 'rechnung',
  kooperation: 'users',
  briefing: 'briefing',
  briefings: 'briefing',
  tasks: 'clipboard-check',
  aufgaben: 'clipboard-check',
  listen: 'list-bullet',
  'creator-lists': 'list-bullet',
  shares: 'shared-list',
  tabellen: 'table-cells',
  feedback: 'chat-bubble',
  produkt: 'cube',
  produkte: 'cube',
  skripte: 'skripte',
  'ki-usage': 'document-currency',
  education: 'home',
  profile: 'user-circle',
  stakeholder: 'home',
  transcribe: 'video',
  kunden: 'home',
  adresse: 'map-pin',
  dateien: 'folder',
  files: 'folder',
  emails: 'envelope',
  versand: 'truck',
  einstellungen: 'cog',
  settings: 'cog',
  rechte: 'shield',
  aktivitaeten: 'chart-bar',
  activity: 'chart-bar',
  overview: 'squares-2x2',
  stammdaten: 'user-circle',
  info: 'information-circle',
  informationen: 'information-circle',
  marken: 'tag',
  personas: 'user',
  kampagnen: 'campaign',
  kooperationen: 'users',
  auftraege: 'auftrag',
  details: 'queue-list',
  cashflow: 'cash',
  search: 'search',
  rechnungen: 'rechnung',
  'koops-videos': 'video',
  strategien: 'strategy',
};

/**
 * Rendert das Icon fuer eine fachliche Entity (z.B. 'kampagne').
 * Faellt auf den uebergebenen Key selbst zurueck, wenn kein Entity-Mapping
 * existiert, dann auf 'missing'.
 */
export function entityIcon(entity, options = {}) {
  if (!entity) return icon('missing', options);
  const key = String(entity).toLowerCase();
  const mapped = ENTITY_ICONS[key];
  if (mapped && hasIcon(mapped)) return icon(mapped, options);
  if (hasIcon(key)) return icon(key, options);
  return icon('missing', options);
}

export function entityIconKey(entity) {
  if (!entity) return null;
  const key = String(entity).toLowerCase();
  return ENTITY_ICONS[key] || key;
}
