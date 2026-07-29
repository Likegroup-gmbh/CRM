// paragraphZusatz.js
// "Extra Bestimmung hinzufügen" pro Paragraph:
// - Formular-Baustein (Button + Textarea)
// - Sammeln der flachen Formularfelder in das JSONB-Objekt paragraph_zusaetze
// - Expandieren des JSONB-Objekts zurück in flache Formularfelder (Draft-Load)

const FIELD_PREFIX = 'paragraph_zusatz_';

const PLUS_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"></path></svg>';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Rendert Button + (initial versteckte) Textarea für die Zusatz-Bestimmung
 * eines Paragraphen. Ist bereits Text vorhanden (Draft / Zurück-Navigation),
 * wird die Textarea direkt offen angezeigt.
 *
 * @param {object} formData aktuelle Formulardaten
 * @param {string} key Paragraph-Key (z.B. 'p2')
 * @param {string} paragraphLabel Anzeige-Label (z.B. '§2 Leistungsumfang')
 * @returns {string} HTML
 */
export function renderParagraphZusatz(formData, key, paragraphLabel) {
  const fieldName = `${FIELD_PREFIX}${key}`;
  const value = typeof formData?.[fieldName] === 'string' ? formData[fieldName] : '';
  const hatText = value.trim().length > 0;

  return `
        <div class="paragraph-zusatz" data-paragraph="${key}">
          <button type="button" class="btn-inline-action btn-paragraph-zusatz ${hatText ? 'hidden' : ''}">
            ${PLUS_ICON_SVG}
            <span>Extra Bestimmung hinzufügen</span>
          </button>
          <div class="form-field paragraph-zusatz-field ${hatText ? '' : 'hidden'}">
            <label for="${fieldName}">Zusätzliche Bestimmung zu ${paragraphLabel} (optional)</label>
            <textarea id="${fieldName}" name="${fieldName}" rows="3"
                      placeholder="Zusätzliche Vereinbarung zu diesem Paragraphen...">${escapeHtml(value)}</textarea>
          </div>
        </div>`;
}

/**
 * Sammelt alle paragraph_zusatz_*-Felder aus den (flachen) Formulardaten
 * in das JSONB-Objekt für die DB. Leere Texte werden weggelassen.
 *
 * @param {object} formData
 * @returns {object|null} z.B. { p2: 'Text' } oder null wenn keine Zusätze
 */
export function collectParagraphZusaetze(formData) {
  const result = {};
  Object.keys(formData || {}).forEach((key) => {
    if (!key.startsWith(FIELD_PREFIX)) return;
    const value = formData[key];
    const text = typeof value === 'string' ? value.trim() : '';
    if (text) {
      result[key.slice(FIELD_PREFIX.length)] = text;
    }
  });
  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Expandiert das JSONB-Objekt aus der DB zurück in flache Formularfelder.
 *
 * @param {object|null} zusaetze z.B. { p2: 'Text' }
 * @returns {object} z.B. { paragraph_zusatz_p2: 'Text' }
 */
export function expandParagraphZusaetze(zusaetze) {
  const result = {};
  Object.entries(zusaetze || {}).forEach(([key, text]) => {
    if (typeof text === 'string' && text.trim()) {
      result[`${FIELD_PREFIX}${key}`] = text;
    }
  });
  return result;
}
