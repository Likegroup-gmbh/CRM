// exportHinweis.js
// Warnhinweis an den Team-Upload-Stellen für Videos und Storys. HEVC/H.265 spielen
// Chrome und Edge unter Windows ohne Zusatzerweiterung nur als Ton mit Standbild ab.

/**
 * @param {{ id?: string, hidden?: boolean }} [opts]
 * @returns {string}
 */
export function exportHinweisHtml({ id, hidden = false } = {}) {
  const idAttr = id ? ` id="${id}"` : '';
  const style = hidden ? ' style="display:none"' : '';
  return `
    <div class="notice-box notice-warning export-hinweis" data-export-hinweis role="note"${idAttr}${style}>
      <strong>Videos bitte als MP4 mit H.264 exportieren</strong>
      Nicht HEVC / H.265 („High Efficiency“). Sonst sehen Kunden auf Windows nur ein Standbild mit Ton.
      Premiere, Final Cut, CapCut: Codec „H.264“ wählen.
    </div>`;
}
