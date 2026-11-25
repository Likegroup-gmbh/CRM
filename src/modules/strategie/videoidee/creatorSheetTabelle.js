// creatorSheetTabelle.js
// Creator-Sheet (ADR 0059) als Label/Wert-Tabelle, dieselbe Optik wie die strukturierte Beschreibung
// der Videoidee (Label links, Wert rechts, eine Zeile je Block). Reine Funktion, kein DOM-Zugriff.
// Genutzt vom Videoidee-Drawer und vom Konzept-Review, damit beide gleich aussehen.

import { escapeAttr } from '../../../core/VideoUploadUtils.js';
import { escapeHtml } from '../../../core/format.js';

function eintragHtml(eintrag, mitLabel) {
  const wert = eintrag.link
    ? `<a href="${escapeAttr(eintrag.wert)}" target="_blank" rel="noopener noreferrer">${escapeHtml(eintrag.wert)}</a>`
    : escapeHtml(eintrag.wert).replace(/\n/g, '<br>');
  return `<div class="creator-sheet-eintrag">${mitLabel ? `<div class="creator-sheet-eintrag__label">${escapeHtml(eintrag.label)}</div>` : ''}<div class="videoidee-doc__prose">${wert}</div></div>`;
}

/**
 * @param {Array<{ nr: string, titel: string, eintraege: Array<{ label: string, wert: string, link: boolean }> }>} bloecke
 * @returns {string} leer, wenn es nichts anzuzeigen gibt
 */
export function renderCreatorSheetTabelle(bloecke) {
  if (!bloecke?.length) return '';
  const rows = bloecke.map((b) => `
    <tr class="videoidee-struktur__row" data-creator-sheet-block="${escapeAttr(b.nr || b.titel)}">
      <th scope="row" class="videoidee-struktur__label">${escapeHtml(b.titel)}</th>
      <td class="videoidee-struktur__value">${b.eintraege.map((e) => eintragHtml(e, b.eintraege.length > 1)).join('')}</td>
    </tr>`).join('');
  return `<table class="videoidee-struktur" data-creator-sheet><tbody>${rows}</tbody></table>`;
}
