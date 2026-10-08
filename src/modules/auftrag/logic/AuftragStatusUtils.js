// AuftragStatusUtils.js
// Ampelsystem: Beauftragt (Grün) / Abgeschlossen (Rot) / Storniert (Grau)
// Der Wechsel Beauftragt <-> Abgeschlossen läuft in der Datenbank
// (refresh_auftrag_budget_status, Migration 20261018), nicht im Client.

import { escapeHtml } from '../../../core/format.js';

const AMPEL_MAP = {
  'Beauftragt':     { color: '#22c55e', label: 'Aktiv',          cssClass: 'beauftragt' },
  'Abgeschlossen':  { color: '#ef4444', label: 'Abgeschlossen',  cssClass: 'abgeschlossen' },
  'Storniert':      { color: '#9ca3af', label: 'Storniert',       cssClass: 'storniert' }
};

const AMPEL_UNBEKANNT = { color: '#9ca3af', cssClass: 'unbekannt' };

/**
 * Leerer Status gilt als Beauftragt (Aktiv). Ein unbekannter Status zeigt seinen
 * Rohwert in Grau, damit er nicht als Aktiv durchgeht.
 */
export function renderAuftragAmpel(status) {
  const known = AMPEL_MAP[status];
  const s = known
    || (status ? { ...AMPEL_UNBEKANNT, label: String(status) } : AMPEL_MAP['Beauftragt']);
  return `<span class="auftrag-ampel auftrag-ampel--${s.cssClass}" title="${escapeHtml(status || 'Beauftragt')}">
    <span class="auftrag-ampel__dot" style="background:${s.color};"></span>
    ${escapeHtml(s.label)}
  </span>`;
}
