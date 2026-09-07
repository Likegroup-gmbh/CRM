// ProduktDoc.js
// Produkt-Huelle ueber dem geteilten Worksheet-Renderer (core/doc/DocPage.js):
// Feldfilter fuer den Kontext (Marken/Unternehmen), die rechte Spalte mit
// Shop-URL und Liky-Verlauf. Das Layout selbst - Paper, Gruppen, Slots -
// kommt aus dem DocPage, damit Produkt- und Persona-Seite gleich aussehen.

import { renderDocPage, bindDocPage, refreshDocHeights, attr, text } from '../../core/doc/DocPage.js';
import { produktConfig } from '../../core/form/config/ProduktFormConfig.js';
import { icon } from '../../core/icons/IconSystem.js';

const FORM_ID = 'produkt-form';

const ICONS = {
  send: icon('paper-airplane')
};

/**
 * Baut das komplette Formular-Markup.
 * @param {Object|null} data - Produktdaten im Edit-Modus, sonst null
 * @param {Object} [ctx]
 * @param {boolean} [ctx.mitMarkenFeld] - Marken-Multiselect zeigen (Unternehmens-Kontext)
 * @param {boolean} [ctx.mitUnternehmenFeld] - Unternehmenswahl auf /produkt/new
 * @param {string|null} [ctx.unternehmenId] - Besitzer, geht als Hidden-Feld mit
 * @returns {string}
 */
export function renderProduktDoc(data = null, { mitMarkenFeld = false, mitUnternehmenFeld = false, unternehmenId = null } = {}) {
  // Im Standalone ohne gewaehltes Unternehmen bleibt das Marken-Feld versteckt,
  // bis applyUnternehmenScope/syncMarkenFeldSichtbarkeit es einblendet.
  const markenPending = mitUnternehmenFeld && mitMarkenFeld;

  const fields = produktConfig.fields
    .filter(f => {
      if (f.docRole === 'relations' && !mitMarkenFeld) return false;
      if (f.docRole === 'owner' && !mitUnternehmenFeld) return false;
      return true;
    })
    .map(f => (f.docRole === 'relations' && markenPending) ? { ...f, docHidden: true } : f);

  return renderDocPage({
    formId: FORM_ID,
    entity: 'produkt',
    entityLabel: 'Produkt',
    fields,
    data,
    hidden: mitUnternehmenFeld ? null : { unternehmen_id: unternehmenId || '' },
    side: renderExtractPanel
  });
}

/**
 * Rechte Spalte: die Eingabekarte fuer die Shop-URL und darunter der Verlauf.
 * Aufbau bewusst wie das Chat-Input im Skript-Editor - Feld oben, darunter ein
 * Footer mit den Kosten links und dem runden Absende-Button rechts.
 *
 * Der Verlauf bleibt leer, ihn fuellt ProduktExtractPanel.
 */
function renderExtractPanel(sideFields) {
  const urlField = sideFields.find(f => f.type === 'url') || sideFields[0];
  if (!urlField) return '';

  const id = `field-${urlField.name}`;

  return `
    <div class="doc-chat__composer">
      <div class="form-field doc-chat__field" data-doc-field="${attr(urlField.name)}">
        <label for="${attr(id)}">${text(urlField.docLabel || 'URL')}</label>
        <div class="url-input-field doc-chat__input">
          <input type="text" id="${attr(id)}" name="${attr(urlField.name)}" class="url-input"
                 data-url-field="true" autocomplete="off" spellcheck="false"
                 placeholder="${attr(urlField.placeholder || '')}">
        </div>
        <div class="doc-chat__footer">
          <div class="doc-chat__meta" data-extract-meta-slot></div>
          <button type="button" class="url-extract-btn doc-chat__send"
                  data-ai-extract="${attr(urlField.name)}"
                  title="Produktseite auslesen" aria-label="Produktseite auslesen">
            ${ICONS.send}
            <span class="spinner-small url-extract-btn__spinner"></span>
          </button>
        </div>
      </div>
    </div>
    <div class="doc-chat__feed" id="produkt-extract-feed"></div>
  `;
}

/**
 * Setzt die Werte und haengt das Word-Verhalten an.
 * @param {HTMLFormElement} form
 * @param {Object|null} data
 * @param {{ onSave?: Function }} [hooks]
 */
export function bindProduktDoc(form, data = null, hooks = {}) {
  bindDocPage(form, produktConfig.fields, data, hooks);
}

export { refreshDocHeights };
