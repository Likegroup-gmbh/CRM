// likyComposer.js
// Die eine Liky-Eingabekarte fuer alle Seiten: Feld oben, Footer mit Meta
// links und rundem Absende-Button rechts. renderLikyColumn setzt die Karte
// an den unteren Rand der Spalte, den Verlauf darueber. Produkt (URL),
// Persona (URL oder Chat) und Briefing (PDF) rendern denselben Rahmen, damit
// Liky ueberall gleich aussieht. Styles: .doc__side .doc-chat__* in doc.css.

import { icon } from '../icons/IconSystem.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Ganze Zeile, Dateiname, endet auf .pdf. */
export function isLikyPdfName(text) {
  const t = String(text || '').trim();
  return t.length > 0 && !/\n/.test(t) && /\.pdf$/i.test(t);
}

/**
 * Pill wie die Thinking-Steps: PDF-Icon + Dateiname.
 * @param {string} name
 * @param {{ remove?: boolean }} [opts] - ×-Button fuer den Composer-Chip
 */
export function likyPdfTagHtml(name, { remove = false } = {}) {
  const label = escapeHtml(String(name || '').trim());
  const btn = remove
    ? '<button type="button" aria-label="Datei entfernen">&times;</button>'
    : '';
  return `<span class="doc-chat__file">${icon('pdf', { className: 'doc-chat__file-icon' })}<span class="doc-chat__file-name">${label}</span>${btn}</span>`;
}

/**
 * Die eine Chat-Eingabe: Textarea, die umbricht und mitwaechst.
 * Hosts haengen sie in inputHtml (Briefing mit Chips darueber, Persona blank).
 * @param {Object} opts
 * @param {string} opts.id
 * @param {string} [opts.placeholder]
 * @param {boolean} [opts.disabled]
 * @param {string} [opts.extraAttrs] - z.B. 'spellcheck="false"'
 */
export function renderLikyEingabe({
  id,
  placeholder = '',
  disabled = false,
  extraAttrs = ''
}) {
  return `
    <div class="doc-chat__input">
      <textarea id="${id}" class="doc-chat__eingabe" rows="1"
                autocomplete="off"${disabled ? ' disabled' : ''}${extraAttrs ? ` ${extraAttrs}` : ''}
                placeholder="${placeholder}"></textarea>
    </div>
  `;
}

/**
 * @param {Object} opts
 * @param {string} [opts.composerId] - id auf der Karte (Drop-Ziel etc.)
 * @param {string} [opts.label] - Labeltext ueber dem Feld
 * @param {string} [opts.labelFor] - for-Attribut des Labels
 * @param {string} [opts.fieldAttrs] - zusaetzliche Attribute auf .doc-chat__field
 * @param {string} opts.inputHtml - das eigentliche Eingabefeld (Seiten-spezifisch)
 * @param {string} opts.sendHtml - der Absende-Button (siehe renderLikySend)
 * @param {boolean} [opts.metaSlot] - data-extract-meta-slot fuer Kosten-Badges
 * @param {boolean} [opts.disabled] - optisch abgesenkter Slot
 */
export function renderLikyComposer({
  composerId = null,
  label = null,
  labelFor = null,
  fieldAttrs = '',
  inputHtml,
  sendHtml,
  metaSlot = true,
  disabled = false
}) {
  return `
    <div class="doc-chat__composer${disabled ? ' doc-chat__composer--bald' : ''}"${composerId ? ` id="${composerId}"` : ''}>
      <div class="form-field doc-chat__field"${fieldAttrs ? ` ${fieldAttrs}` : ''}>
        ${label ? `<label${labelFor ? ` for="${labelFor}"` : ''}>${label}</label>` : ''}
        ${inputHtml}
        <div class="doc-chat__footer">
          <div class="doc-chat__meta"${metaSlot ? ' data-extract-meta-slot' : ''}></div>
          ${sendHtml}
        </div>
      </div>
    </div>
  `;
}

/**
 * Die eine Liky-Spalte fuer alle Seiten: Verlauf oben (scrollt), Composer
 * unten (gepinnt). Produkt, Persona und Briefing bauen ihre Spalte nur noch
 * ueber diese Funktion - die Reihenfolge gibt es genau einmal.
 * @param {Object} opts
 * @param {string} [opts.feedId] - id auf dem Verlauf (Panel mounten darauf)
 * @param {string} [opts.feedHtml] - vorgerenderter Inhalt des Verlaufs
 * @param {string} opts.composer - HTML aus renderLikyComposer
 * @param {string} [opts.feedClass] - zusaetzliche Klassen auf dem Feed
 * @returns {string}
 */
export function renderLikyColumn({
  feedId = null,
  feedHtml = '',
  composer,
  feedClass = ''
}) {
  return `
    <div class="doc-chat__feed${feedClass ? ` ${feedClass}` : ''}"${feedId ? ` id="${feedId}"` : ''}>${feedHtml}</div>
    ${composer}
  `;
}

/**
 * Runder Absende-Button mit Spinner (is-loading tauscht Icon gegen Kreis).
 * @param {Object} opts
 * @param {string} [opts.id]
 * @param {string} opts.title - title + aria-label
 * @param {string} [opts.extraClasses] - z.B. 'url-extract-btn'
 * @param {string} [opts.attrs] - z.B. 'data-ai-extract="url"'
 * @param {string} [opts.spinnerClass] - z.B. 'url-extract-btn__spinner'
 * @param {boolean} [opts.disabled]
 */
export function renderLikySend({
  id = null,
  title,
  extraClasses = '',
  attrs = '',
  spinnerClass = '',
  disabled = false
}) {
  return `
    <button type="button"${id ? ` id="${id}"` : ''}
            class="doc-chat__send${extraClasses ? ` ${extraClasses}` : ''}"
            title="${title}" aria-label="${title}"${attrs ? ` ${attrs}` : ''}${disabled ? ' disabled' : ''}>
      ${icon('paper-airplane')}
      <span class="spinner-small${spinnerClass ? ` ${spinnerClass}` : ''}"></span>
    </button>
  `;
}
