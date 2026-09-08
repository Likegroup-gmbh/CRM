// PersonaDoc.js
// Persona-Huelle ueber dem geteilten Worksheet-Renderer (core/doc/DocPage.js):
// gleiches Layout wie das Produkt - Paper mit Gruppen in der Mitte, Liky in
// der rechten Spalte, Produkte-Band als Slot ganz unten (gefuellt vom
// PersonaProduktPanel).

import { renderDocPage, bindDocPage } from '../../core/doc/DocPage.js';
import { personaConfig } from '../../core/form/config/PersonaFormConfig.js';
import { renderPersonaLikySlot } from './PersonaLikySlot.js';

const FORM_ID = 'persona-form';

/**
 * Baut das komplette Formular-Markup.
 * @param {Object|null} data - Personadaten im Edit-Modus, sonst null
 * @param {Object} [ctx]
 * @param {boolean} [ctx.mitMarkenFeld] - Marken-Multiselect zeigen (Unternehmens-Kontext/Standalone)
 * @param {boolean} [ctx.mitUnternehmenFeld] - Unternehmenswahl im Standalone
 * @param {string|null} [ctx.unternehmenId] - Besitzer, geht als Hidden-Feld mit
 * @returns {string}
 */
export function renderPersonaDoc(data = null, { mitMarkenFeld = false, mitUnternehmenFeld = false, unternehmenId = null } = {}) {
  const fields = personaConfig.fields.filter(f => {
    if (f.name === 'marke_ids' && !mitMarkenFeld) return false;
    if (f.docRole === 'owner' && !mitUnternehmenFeld) return false;
    return true;
  });

  return renderDocPage({
    formId: FORM_ID,
    entity: 'persona',
    entityLabel: 'Persona',
    fields,
    data,
    hidden: mitUnternehmenFeld ? null : { unternehmen_id: unternehmenId || '' },
    side: () => renderPersonaLikySlot()
  });
}

/**
 * Setzt die Werte und haengt das Word-Verhalten an.
 * @param {HTMLFormElement} form
 * @param {Object|null} data
 */
export function bindPersonaDoc(form, data = null) {
  bindDocPage(form, personaConfig.fields, data);
}
