// briefingSpalten.js
// Spalten von campaign_briefings für Dokument, Creator-PDF und Formular. Kunden lesen nur diese
// Liste: die Felder des Creator-Briefings plus die alten Spalten, aus denen ältere Briefings
// diese Felder füllen. Altfelder wie verhandlungshinweis oder tkp sind nicht dabei.

import { getAllFields } from './create/fieldConfig.js';

const BASIS = [
  'id', 'aktivierung_name', 'bereich', 'is_draft', 'ist_altbestand', 'created_at', 'updated_at',
  'unternehmen_id', 'marke_id', 'kampagne_id', 'produktion_id', 'produkt_id', 'persona_ids'
];

// Quellen von resolveBriefingFieldValue, briefingPlattformen, videolaengeAusBriefing, umsetzungsideenEintraege
const FALLBACK = [
  'umsetzungsideen',
  ...['im_', 'pa_', 'os_'].flatMap(p => [`${p}umsetzung`, `${p}situationen`, `${p}ideen_text`]),
  'publish_channels', 'ad_channels', 'im_channels', 'os_channels', 'pa_channels',
  'videolaengen', 'pa_videolaengen', 'videolaenge_text', 'im_formatvorgaben', 'os_formatvorgaben'
];

export const BRIEFING_SPALTEN = [...new Set([
  ...BASIS,
  ...getAllFields().flatMap(f => f.columns || [f.name]),
  ...FALLBACK
])].join(', ');
