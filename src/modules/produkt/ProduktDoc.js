// ProduktDoc.js
// Rendert das Produkt-Formular als Schreibdokument: mittig ein Worksheet mit
// festen Ueberschriften und frei beschreibbaren Abschnitten, rechts das
// Extract-Panel mit der Shop-URL.
//
// Die Felder kommen unveraendert aus ProduktFormConfig.js - hier entsteht nur
// anderes Markup. Bewusst echte <input>/<textarea> innerhalb des <form>, damit
// FormSystem.collectSubmitData(), ExtractReviewLayer, setupSiteExtract() und
// normalizeFormUrlFields() weiter greifen. Kein contenteditable: gespeichert
// wird reiner Text, kein Markup.
//
// Der Wrapper jedes Feldes behaelt die Klasse .form-field mit direktem <label>,
// weil ExtractReviewLayer.mark() darin das "Vorschlag"-Tag ablegt.

import { produktConfig } from '../../core/form/config/ProduktFormConfig.js';
import { icon } from '../../core/icons/IconSystem.js';

const FORM_ID = 'produkt-form';

/** Nur fuer Attributwerte aus der Config - Feldinhalte werden per JS gesetzt. */
function attr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function text(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

const ICONS = {
  send: icon('paper-airplane'),
  check: icon('check-bold'),
  cancel: icon('x-mark'),
  spinner: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" stroke-opacity="0.25"/><path d="M21 12a9 9 0 0 0-9-9" stroke-linecap="round"/></svg>'
};

/**
 * Baut das komplette Formular-Markup.
 * @param {Object|null} data - Produktdaten im Edit-Modus, sonst null
 * @param {Object} [ctx]
 * @param {boolean} [ctx.mitMarkenFeld] - Marken-Multiselect zeigen (Unternehmens-Kontext)
 * @param {string|null} [ctx.unternehmenId] - Besitzer, geht als Hidden-Feld mit
 * @returns {string}
 */
export function renderProduktDoc(data = null, { mitMarkenFeld = false, unternehmenId = null } = {}) {
  const fields = produktConfig.fields
    .filter(f => mitMarkenFeld || f.docRole !== 'relations');
  const isEdit = !!data?._isEditMode;

  const sideFields = fields.filter(f => f.docSlot === 'side');
  const docFields = fields.filter(f => f.docSlot !== 'side');

  return `
    <form id="${FORM_ID}" class="produkt-doc" data-entity="produkt"
          data-entity-id="${attr(data?.id || data?._entityId || '')}"
          data-is-edit-mode="${isEdit ? 'true' : 'false'}">
      <input type="hidden" name="unternehmen_id" value="${attr(unternehmenId || '')}">
      <div class="produkt-doc__shell">
        <main class="produkt-doc__main">
          <div class="produkt-doc__scroll">
            <article class="produkt-doc__paper">
              ${renderDocFields(docFields)}
            </article>
          </div>
          ${renderActions(isEdit)}
        </main>
        <aside class="produkt-doc__side">
          ${renderExtractPanel(sideFields)}
        </aside>
      </div>
    </form>
  `;
}

function renderDocFields(fields) {
  const parts = [];
  const handled = new Set();
  let openGroup = null;
  let groupParts = [];

  const flushGroup = () => {
    if (!openGroup) return;
    parts.push(
      `<div class="produkt-doc__group" data-doc-group="${attr(openGroup)}">${groupParts.join('')}</div>`
    );
    openGroup = null;
    groupParts = [];
  };

  /** Ohne docGroup direkt auf paper, mit docGroup in die passende Sektion. */
  const push = (html, group = null) => {
    if (!group) {
      flushGroup();
      parts.push(html);
      return;
    }
    if (openGroup && openGroup !== group) flushGroup();
    openGroup = group;
    groupParts.push(html);
  };

  fields.forEach((field) => {
    if (handled.has(field.name)) return;

    if (field.docRole === 'title') {
      push(renderTitle(field), field.docGroup);
      return;
    }

    if (field.docRole === 'inline') {
      const rowFields = fields.filter(f => f.row && f.row === field.row);
      rowFields.forEach(f => handled.add(f.name));
      push(renderInlineRow(field, rowFields), field.docGroup);
      return;
    }

    if (field.docRole === 'relations') {
      push(renderRelationsBlock(field), field.docGroup);
      return;
    }

    if (field.docRole === 'uploader') {
      push(renderUploaderBlock(field), field.docGroup || 'bilder');
      // Eigene Sektion: Abstand zu Bildern unabhaengig vom Inhaltsblock.
      // Gefuellt wird der Slot von ProduktVariantenPanel.
      push(
        '<section class="produkt-doc__block" id="produkt-varianten-panel"></section>',
        'varianten'
      );
      return;
    }

    push(renderTextSection(field), field.docGroup);
  });

  flushGroup();
  return parts.join('');
}

/** Dokumenttitel ohne Label - das Vorschlag-Tag positioniert das CSS. */
function renderTitle(field) {
  return `
    <div class="form-field produkt-doc__title-field" data-doc-field="${attr(field.name)}">
      <input type="text" id="field-${attr(field.name)}" name="${attr(field.name)}"
             class="produkt-doc__title" autocomplete="off" spellcheck="false"
             placeholder="${attr(field.docLabel || 'Produktname')}"
             aria-label="${attr(field.label)}"${field.required ? ' required' : ''}>
    </div>
  `;
}

/**
 * Frei beschreibbarer Abschnitt: feste Ueberschrift, darunter Text ohne
 * Rahmen. rows="1" plus Autogrow laesst den Block mitwachsen.
 *
 * docList-Felder tragen einen Eintrag pro Zeile. Der Zeilenabstand fuer
 * Fliesstext laesst solche Listen wie einzelne Absaetze wirken, deshalb der
 * eigene Modifier.
 */
function renderTextSection(field) {
  const id = `field-${field.name}`;
  const cls = field.docList ? 'produkt-doc__text produkt-doc__text--list' : 'produkt-doc__text';
  return `
    <section class="form-field produkt-doc__section" data-doc-field="${attr(field.name)}">
      <label for="${attr(id)}">${text(field.docLabel || field.label)}</label>
      <textarea id="${attr(id)}" name="${attr(field.name)}" rows="1"
                class="${cls}" spellcheck="true"
                placeholder="${attr(field.placeholder || '')}"></textarea>
    </section>
  `;
}

/**
 * Preis-Zeile als Karten nebeneinander: je Betrag eine umrandete Kachel mit
 * kleinem Label und grosser Zahl. Der Wrapper bleibt ein .form-field mit
 * direktem <label>, weil ExtractReviewLayer.mark() dort das Vorschlag-Tag
 * ablegt.
 */
function renderInlineRow(first, rowFields) {
  const cards = rowFields.map(field => {
    const id = `field-${field.name}`;
    const min = field.validation?.min !== undefined ? ` min="${attr(field.validation.min)}"` : '';
    const step = field.validation?.step !== undefined ? ` step="${attr(field.validation.step)}"` : ' step="0.01"';
    return `
      <div class="form-field produkt-doc__price-card" data-doc-field="${attr(field.name)}">
        <label for="${attr(id)}">${text(field.docLabel || field.label)}</label>
        <div class="produkt-doc__price-value">
          <span class="produkt-doc__unit" aria-hidden="true">€</span>
          <input type="number" id="${attr(id)}" name="${attr(field.name)}"
                 class="produkt-doc__number" placeholder="${attr(field.placeholder || '')}"
                 aria-label="${attr(field.label)}"${min}${step}>
        </div>
        ${field.docHint ? `<p class="produkt-doc__price-note">${text(field.docHint)}</p>` : ''}
      </div>
    `;
  }).join('');

  return `
    <section class="produkt-doc__section produkt-doc__section--inline" data-doc-row="${attr(first.row || 'inline')}">
      <h3 class="produkt-doc__heading">${text(first.sectionTitle || 'Preis')}</h3>
      ${first.sectionDescription ? `<p class="produkt-doc__hint">${text(first.sectionDescription)}</p>` : ''}
      <div class="produkt-doc__price-cards">${cards}</div>
    </section>
  `;
}

/**
 * Tag-Multiselect im Dokument. Das leere <select> wird von
 * FormSystem.bindFormEvents() ueber die Feld-Config befuellt und danach durch
 * das Auto-Suggestion-Widget ersetzt - die Attribute muessen deshalb exakt zu
 * denen aus dem FormRenderer passen.
 */
function renderRelationsBlock(field) {
  const id = `field-${field.name}`;
  return `
    <section class="form-field produkt-doc__section" data-doc-field="${attr(field.name)}">
      <label for="${attr(id)}">${text(field.docLabel || field.label)}</label>
      <select id="${attr(id)}" name="${attr(field.name)}" multiple
              data-searchable="true" data-tag-based="true"
              data-placeholder="${attr(field.placeholder || 'Bitte wählen...')}"
              data-table="${attr(field.table || '')}"
              data-display-field="${attr(field.displayField || '')}"
              data-value-field="${attr(field.valueField || 'id')}"></select>
      ${field.docHint ? `<p class="produkt-doc__hint">${text(field.docHint)}</p>` : ''}
    </section>
  `;
}

/**
 * Bilder-Block. Der Container traegt data-name, weil
 * ProduktForm.getBilderUploader() darueber an die Instanz kommt.
 */
function renderUploaderBlock(field) {
  return `
    <section class="form-field produkt-doc__block" data-doc-field="${attr(field.name)}">
      <label>${text(field.docLabel || field.label)}</label>
      <div class="uploader uploader--table" data-name="${attr(field.name)}"></div>
    </section>
  `;
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
    <div class="produkt-chat__composer">
      <div class="form-field produkt-chat__field" data-doc-field="${attr(urlField.name)}">
        <label for="${attr(id)}">${text(urlField.docLabel || 'URL')}</label>
        <div class="url-input-field produkt-chat__input">
          <input type="text" id="${attr(id)}" name="${attr(urlField.name)}" class="url-input"
                 data-url-field="true" autocomplete="off" spellcheck="false"
                 placeholder="${attr(urlField.placeholder || '')}">
        </div>
        <div class="produkt-chat__footer">
          <div class="produkt-chat__meta" data-extract-meta-slot></div>
          <button type="button" class="url-extract-btn produkt-chat__send"
                  data-ai-extract="${attr(urlField.name)}"
                  title="Produktseite auslesen" aria-label="Produktseite auslesen">
            ${ICONS.send}
            <span class="spinner-small url-extract-btn__spinner"></span>
          </button>
        </div>
      </div>
    </div>
    <div class="produkt-chat__feed" id="produkt-extract-feed"></div>
  `;
}

function renderActions(isEdit) {
  return `
    <div class="form-actions produkt-doc__actions">
      <button type="button" class="mdc-btn mdc-btn--cancel">
        <span class="mdc-btn__icon" aria-hidden="true">${ICONS.cancel}</span>
        <span class="mdc-btn__label">Abbrechen</span>
      </button>
      <button type="submit" class="mdc-btn mdc-btn--create"
              data-entity-label="Produkt" data-mode="${isEdit ? 'update' : 'create'}">
        <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">${ICONS.check}</span>
        <span class="mdc-btn__spinner" aria-hidden="true">${ICONS.spinner}</span>
        <span class="mdc-btn__label">${isEdit ? 'Aktualisieren' : 'Erstellen'}</span>
      </button>
    </div>
  `;
}

// ===== Verhalten =====

/** Textarea auf Inhaltshoehe bringen, damit nie eine Scrollbar entsteht. */
function autogrow(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

/**
 * Setzt die Werte und haengt das Word-Verhalten an. Werte werden per
 * Property gesetzt statt ins Markup gerendert - so kann kein Inhalt aus der
 * DB als HTML interpretiert werden.
 *
 * @param {HTMLFormElement} form
 * @param {Object|null} data
 * @param {{ onSave?: Function }} [hooks]
 */
export function bindProduktDoc(form, data = null, hooks = {}) {
  if (!form) return;

  fillValues(form, data);
  bindAutogrow(form);
  bindClickToWrite(form);
  bindShortcuts(form, hooks.onSave);
}

function fillValues(form, data) {
  if (!data) return;

  produktConfig.fields.forEach(field => {
    const input = form.querySelector(`[name="${field.name}"]`);
    if (!input || input.type === 'file') return;
    // Multiselects befuellt der DynamicDataLoader ueber die Relationstabelle
    if (input.multiple) return;

    let value = data[field.name];
    if (value === null || value === undefined) value = '';

    input.value = value;
  });
}

function bindAutogrow(form) {
  const areas = form.querySelectorAll('textarea.produkt-doc__text');
  areas.forEach(area => {
    // Auch das synthetische input-Event aus ExtractReviewLayer.mark() greift hier
    area.addEventListener('input', () => autogrow(area));
    autogrow(area);
  });

  // Nach dem ersten Layout noch einmal: vorher stimmt scrollHeight nicht,
  // wenn die Schrift erst mit dem Stylesheet ankommt.
  requestAnimationFrame(() => areas.forEach(autogrow));
}

/** Klick neben den Text setzt den Cursor ans Ende - wie in einem Dokument. */
function bindClickToWrite(form) {
  form.querySelectorAll('.produkt-doc__section').forEach(section => {
    section.addEventListener('mousedown', (e) => {
      if (e.target.closest('textarea, input, label, a, button')) return;
      const area = section.querySelector('textarea, input');
      if (!area) return;
      e.preventDefault();
      area.focus();
      const end = area.value.length;
      area.setSelectionRange?.(end, end);
    });
  });
}

function bindShortcuts(form, onSave) {
  form.addEventListener('keydown', (e) => {
    const isSaveCombo = (e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'Enter');
    if (!isSaveCombo) return;
    e.preventDefault();
    if (typeof onSave === 'function') onSave();
    else form.requestSubmit?.();
  });
}

/** Nach dem Auslesen sind die Textblocks laenger geworden. */
export function refreshDocHeights(form) {
  form?.querySelectorAll('textarea.produkt-doc__text').forEach(autogrow);
}
