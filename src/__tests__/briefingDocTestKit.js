// briefingDocTestKit.js
// Gemeinsamer Detail-Fake für Dokument, Creator-PDF und Legacy-Ansicht.

import { escapeHtml } from '../core/format.js';
import { formatBriefingWert } from '../modules/briefing/briefingWertAnzeige.js';

export function makeDetail(briefing) {
  const escape = (s) => escapeHtml(String(s ?? ''));
  const formatDate = (d) => (d ? new Date(d).toLocaleDateString('de-DE') : '-');
  return {
    briefing,
    escape,
    formatDate,
    formatValue: (field, value) => formatBriefingWert(field, value, { escape, formatDate })
  };
}
