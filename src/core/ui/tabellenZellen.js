// tabellenZellen.js
// Gemeinsame Zellen der Tabellen: Werte als Tag (Alter, Preis, Erstellt ...)
// und die Marken einer Junction (persona_marke, produkt_marke) als Bubbles mit Label.

import { avatarBubbles } from '../components/AvatarBubbles.js';
import { escapeHtml } from '../format.js';
import { NUR_UNTERNEHMEN_LABEL } from '../folderListNav.js';

/** Wert als Tag ohne Umbruch (28–45 bleibt in einer Zeile); leer oder '-' bleibt der schlichte Strich. */
export function renderTabellenTag(wert, sanitize = escapeHtml) {
  const text = String(wert ?? '').trim();
  if (!text || text === '-') return '-';
  return `<div class="tags tags-compact"><span class="tag tag--type tag--nowrap">${sanitize(text)}</span></div>`;
}

/**
 * Marken aus dem Junction-Select (`marken: [{ marke: { id, markenname, logo_url } }]`)
 * als Bubble mit Label, nach Name sortiert. Ohne Marke "Nur Unternehmen".
 */
export function renderMarkenBubbles(eintraege) {
  const items = (eintraege || [])
    .map(eintrag => eintrag?.marke)
    .filter(marke => marke?.markenname)
    .sort((a, b) => a.markenname.localeCompare(b.markenname, 'de'))
    .map(marke => ({
      name: marke.markenname,
      type: 'org',
      id: marke.id,
      entityType: 'marke',
      logo_url: marke.logo_url || null
    }));
  if (!items.length) return `<span class="text-muted">${escapeHtml(NUR_UNTERNEHMEN_LABEL)}</span>`;
  return avatarBubbles.renderBubbles(items, { showLabel: true });
}
