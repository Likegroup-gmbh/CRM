// DocPage.js
// Generischer Worksheet-Renderer fuer Detail-Formulare: mittig ein
// Schreibdokument mit festen Ueberschriften und frei beschreibbaren
// Abschnitten, rechts eine Seitenspalte (z.B. Liky-Chat). Produkt und
// Persona teilen sich dieses Layout, damit beide Seiten gleich aussehen
// und funktionieren (siehe docs/adr/0003-doc-layout.md).
//
// Die Felder kommen unveraendert aus den FormConfigs - hier entsteht nur
// anderes Markup. Bewusst echte <input>/<textarea> innerhalb des <form>,
// damit FormSystem.collectSubmitData(), ExtractReviewLayer und die
// Select-/Multiselect-Bindings weiter greifen. Kein contenteditable:
// gespeichert wird reiner Text, kein Markup.
//
// Der Wrapper jedes Feldes behaelt die Klasse .form-field mit direktem
// <label>, weil ExtractReviewLayer.mark() darin das "Vorschlag"-Tag ablegt.
//
// Gesteuert wird ueber die doc*-Angaben in der Feld-Config:
//   docSlot   'side' holt das Feld aus dem Dokument in die rechte Spalte
//   docRole   'title' = Dokumenttitel, 'inline' = Karten-Zeile (row buendelt),
//             'select'/'owner' = Select-Abschnitt, 'relations' = Tag-Multiselect,
//             'uploader' = Datei-Tabelle, 'slot' = Panel-Slot (slotId),
//             sonst frei beschreibbarer Textabschnitt
//   docLabel  kuerzere Ueberschrift fuers Dokument, falls label zu technisch ist
//   docHint   kurze Erlaeuterung unter dem Feld
//   docUnit   Einheit bei inline-Zahlenfeldern (z.B. '€')
//   docList   ein Eintrag pro Zeile - setzt die Zeilen enger als Fliesstext
//   docGroup  buendelt Felder in eine Sektion (Hairline-Band)
//   docHidden rendert den Abschnitt versteckt (z.B. Marken vor Unternehmenswahl)

import { icon } from '../icons/IconSystem.js';

const ICONS = {
  check: icon('check-bold'),
  cancel: icon('x-mark'),
  spinner: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" stroke-opacity="0.25"/><path d="M21 12a9 9 0 0 0-9-9" stroke-linecap="round"/></svg>'
};

/** Nur fuer Attributwerte aus der Config - Feldinhalte werden per JS gesetzt. */
export function attr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function text(value) {
  const div = document.createElement('div');
  div.textContent = value ?? '';
  return div.innerHTML;
}

/**
 * Baut das komplette Formular-Markup.
 * @param {Object} opts
 * @param {string} opts.formId - id des <form> (z.B. 'produkt-form')
 * @param {string} opts.entity - data-entity (z.B. 'produkt', 'persona')
 * @param {string} opts.entityLabel - fuer den Submit-Button (z.B. 'Produkt')
 * @param {Array} opts.fields - Feld-Config (bereits kontext-gefiltert)
 * @param {Object|null} [opts.data] - Daten im Edit-Modus, sonst null
 * @param {Object|null} [opts.hidden] - zusaetzliche Hidden-Inputs { name: value }
 * @param {string|Function} [opts.side] - HTML der rechten Spalte oder
 *   (sideFields) => html; leer lassen fuer einspaltige Docs
 * @returns {string}
 */
export function renderDocPage({
  formId,
  entity,
  entityLabel = '',
  fields,
  data = null,
  hidden = null,
  side = ''
}) {
  const isEdit = !!data?._isEditMode;
  const sideFields = fields.filter(f => f.docSlot === 'side');
  const docFields = fields.filter(f => f.docSlot !== 'side');
  const sideHtml = typeof side === 'function' ? side(sideFields) : side;

  const hiddenInputs = Object.entries(hidden || {})
    .map(([name, value]) => `<input type="hidden" name="${attr(name)}" value="${attr(value)}">`)
    .join('');

  return `
    <form id="${attr(formId)}" class="doc" data-entity="${attr(entity)}"
          data-entity-id="${attr(data?.id || data?._entityId || '')}"
          data-is-edit-mode="${isEdit ? 'true' : 'false'}">
      ${hiddenInputs}
      <div class="doc__shell">
        <main class="doc__main">
          <div class="doc__scroll">
            <article class="doc__paper">
              ${renderDocFields(docFields)}
            </article>
          </div>
          ${renderActions(isEdit, entityLabel)}
        </main>
        ${sideHtml ? `<aside class="doc__side">${sideHtml}</aside>` : ''}
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
      `<div class="doc__group" data-doc-group="${attr(openGroup)}">${groupParts.join('')}</div>`
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

    if (field.docRole === 'slot') {
      push(renderSlot(field), field.docGroup);
      return;
    }

    if (field.docRole === 'inline') {
      const rowFields = fields.filter(f => f.row && f.row === field.row);
      rowFields.forEach(f => handled.add(f.name));
      push(renderInlineRow(field, rowFields), field.docGroup);
      return;
    }

    if (field.docRole === 'owner' || field.docRole === 'select' || field.type === 'select') {
      push(renderSelectSection(field), field.docGroup);
      return;
    }

    if (field.docRole === 'relations') {
      push(renderRelationsBlock(field), field.docGroup);
      return;
    }

    if (field.docRole === 'uploader') {
      push(renderUploaderBlock(field), field.docGroup);
      return;
    }

    push(renderTextSection(field), field.docGroup);
  });

  flushGroup();
  return parts.join('');
}

/** Panel-Slot: leerer Container, den das Modul nach dem Mount fuellt. */
function renderSlot(field) {
  return `<div id="${attr(field.slotId)}"></div>`;
}

/** Dokumenttitel ohne Label - das Vorschlag-Tag positioniert das CSS. */
function renderTitle(field) {
  return `
    <div class="form-field doc__title-field" data-doc-field="${attr(field.name)}">
      <input type="text" id="field-${attr(field.name)}" name="${attr(field.name)}"
             class="doc__title" autocomplete="off" spellcheck="false"
             placeholder="${attr(field.docLabel || field.placeholder || '')}"
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
  const cls = field.docList ? 'doc__text doc__text--list' : 'doc__text';
  const control = field.type === 'textarea'
    ? `<textarea id="${attr(id)}" name="${attr(field.name)}" rows="1"
                class="${cls}" spellcheck="true"
                placeholder="${attr(field.placeholder || '')}"></textarea>`
    : `<input type="text" id="${attr(id)}" name="${attr(field.name)}"
              class="${cls}" autocomplete="off" spellcheck="false"
              placeholder="${attr(field.placeholder || '')}">`;
  return `
    <section class="form-field doc__section" data-doc-field="${attr(field.name)}"${field.docHidden ? ' hidden' : ''}>
      <label for="${attr(id)}">${text(field.docLabel || field.label)}</label>
      ${control}
      ${field.docHint ? `<p class="doc__hint">${text(field.docHint)}</p>` : ''}
    </section>
  `;
}

/**
 * Schmale Felder als Karten nebeneinander: je Feld eine umrandete Kachel mit
 * kleinem Label und grossem Wert. Der Wrapper bleibt ein .form-field mit
 * direktem <label>, weil ExtractReviewLayer.mark() dort das Vorschlag-Tag
 * ablegt. Die Zeilen-Ueberschrift kommt vom sectionTitle des ersten Felds.
 */
function renderInlineRow(first, rowFields) {
  const cards = rowFields.map(field => renderInlineCard(field)).join('');

  return `
    <section class="doc__section doc__section--inline" data-doc-row="${attr(first.row || 'inline')}">
      ${first.sectionTitle ? `<h3 class="doc__heading">${text(first.sectionTitle)}</h3>` : ''}
      ${first.sectionDescription ? `<p class="doc__hint">${text(first.sectionDescription)}</p>` : ''}
      <div class="doc__inline-cards">${cards}</div>
    </section>
  `;
}

function renderInlineCard(field) {
  const id = `field-${field.name}`;
  let control;

  if (field.type === 'number') {
    const min = field.validation?.min !== undefined ? ` min="${attr(field.validation.min)}"` : '';
    const max = field.validation?.max !== undefined ? ` max="${attr(field.validation.max)}"` : '';
    const step = field.validation?.step !== undefined ? ` step="${attr(field.validation.step)}"` : ' step="0.01"';
    control = `
      <div class="doc__inline-value">
        ${field.docUnit ? `<span class="doc__unit" aria-hidden="true">${text(field.docUnit)}</span>` : ''}
        <input type="number" id="${attr(id)}" name="${attr(field.name)}"
               class="doc__number" placeholder="${attr(field.placeholder || '')}"
               aria-label="${attr(field.label)}"${min}${max}${step}>
      </div>
    `;
  } else if (field.type === 'select') {
    control = `<div class="doc__inline-value doc__inline-value--select">${renderSelectControl(field)}</div>`;
  } else {
    control = `
      <div class="doc__inline-value">
        <input type="text" id="${attr(id)}" name="${attr(field.name)}"
               class="doc__input" autocomplete="off" spellcheck="false"
               placeholder="${attr(field.placeholder || '')}"
               aria-label="${attr(field.label)}">
      </div>
    `;
  }

  return `
    <div class="form-field doc__inline-card" data-doc-field="${attr(field.name)}"${field.docHidden ? ' hidden' : ''}>
      <label for="${attr(id)}">${text(field.docLabel || field.label)}</label>
      ${control}
      ${field.docHint ? `<p class="doc__inline-note">${text(field.docHint)}</p>` : ''}
    </div>
  `;
}

/**
 * Select mit statischen Optionen oder als searchable Select: das leere
 * <select> wird von FormSystem.bindFormEvents() ueber die Feld-Config
 * befuellt und danach durch das Auto-Suggestion-Widget ersetzt - die
 * Attribute muessen deshalb exakt zu denen aus dem FormRenderer passen.
 */
function renderSelectControl(field) {
  const id = `field-${field.name}`;
  const dynamic = field.dynamic || field.searchable;
  const dataAttrs = dynamic
    ? ` data-searchable="true"
              data-table="${attr(field.table || '')}"
              data-display-field="${attr(field.displayField || '')}"
              data-value-field="${attr(field.valueField || 'id')}"`
    : '';
  const staticOptions = (field.options || [])
    .map(o => `<option value="${attr(o.value)}">${text(o.label)}</option>`)
    .join('');

  return `<select id="${attr(id)}" name="${attr(field.name)}"${field.required ? ' required' : ''}${dataAttrs}
              data-placeholder="${attr(field.placeholder || 'Bitte wählen...')}">
        <option value="">${attr(field.placeholder || 'Bitte wählen...')}</option>${staticOptions}
      </select>`;
}

function renderSelectSection(field) {
  const id = `field-${field.name}`;
  return `
    <section class="form-field doc__section" data-doc-field="${attr(field.name)}"${field.docHidden ? ' hidden' : ''}>
      <label for="${attr(id)}">${text(field.docLabel || field.label)}</label>
      ${renderSelectControl(field)}
      ${field.docHint ? `<p class="doc__hint">${text(field.docHint)}</p>` : ''}
    </section>
  `;
}

/**
 * Tag-Multiselect im Dokument. Gleiches Binding-Spiel wie beim Select:
 * FormSystem.bindFormEvents() befuellt und ersetzt das leere <select>.
 */
function renderRelationsBlock(field) {
  const id = `field-${field.name}`;
  return `
    <section class="form-field doc__section" data-doc-field="${attr(field.name)}"${field.docHidden ? ' hidden' : ''}>
      <label for="${attr(id)}">${text(field.docLabel || field.label)}</label>
      <select id="${attr(id)}" name="${attr(field.name)}" multiple
              data-searchable="true" data-tag-based="true"
              data-placeholder="${attr(field.placeholder || 'Bitte wählen...')}"
              data-table="${attr(field.table || '')}"
              data-display-field="${attr(field.displayField || '')}"
              data-value-field="${attr(field.valueField || 'id')}"></select>
      ${field.docHint ? `<p class="doc__hint">${text(field.docHint)}</p>` : ''}
    </section>
  `;
}

/**
 * Bilder-Block. Der Container traegt data-name, weil das Modul darueber an
 * die Uploader-Instanz kommt.
 */
function renderUploaderBlock(field) {
  return `
    <section class="form-field doc__block" data-doc-field="${attr(field.name)}"${field.docHidden ? ' hidden' : ''}>
      <label>${text(field.docLabel || field.label)}</label>
      <div class="uploader uploader--table" data-name="${attr(field.name)}"></div>
    </section>
  `;
}

function renderActions(isEdit, entityLabel) {
  return `
    <div class="form-actions doc__actions">
      <button type="button" class="mdc-btn mdc-btn--cancel">
        <span class="mdc-btn__icon" aria-hidden="true">${ICONS.cancel}</span>
        <span class="mdc-btn__label">Abbrechen</span>
      </button>
      <button type="submit" class="mdc-btn mdc-btn--create"
              data-entity-label="${attr(entityLabel)}" data-mode="${isEdit ? 'update' : 'create'}">
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
 * @param {Array} fields - Feld-Config (zum Befuellen)
 * @param {Object|null} data
 * @param {{ onSave?: Function }} [hooks]
 */
export function bindDocPage(form, fields, data = null, hooks = {}) {
  if (!form) return;

  fillValues(form, fields, data);
  bindAutogrow(form);
  bindClickToWrite(form);
  bindShortcuts(form, hooks.onSave);
}

function fillValues(form, fields, data) {
  if (!data) return;

  fields.forEach(field => {
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
  const areas = form.querySelectorAll('textarea.doc__text');
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
  form.querySelectorAll('.doc__section').forEach(section => {
    section.addEventListener('mousedown', (e) => {
      if (e.target.closest('textarea, input, label, a, button, select')) return;
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
  form?.querySelectorAll('textarea.doc__text').forEach(autogrow);
}
