// fieldRendererBasis.js
// Einfache Feldtypen des Briefing-Formulars (Text, Datum, Checkboxen, Entity-Select).
// Gleiche CSS-Klassen wie der Vertragsgenerator (form-field, checkbox-label, ...).

import { escapeHtml } from '../../../core/format.js';
import { CustomDatePicker } from '../../../core/components/CustomDatePicker.js';

export function renderLabel(field) {
  const required = field.required ? ' <span class="required">*</span>' : '';
  const withFor = ['text', 'url', 'date', 'number', 'textarea'].includes(field.type);
  return `<label ${withFor ? `for="${escapeHtml(field.name)}"` : ''}>${escapeHtml(field.label)}${required}</label>`;
}

export function renderHelper(field) {
  return field.helper ? `<p class="field-helper">${escapeHtml(field.helper)}</p>` : '';
}

function placeholderAttr(field) {
  return field.placeholder ? `placeholder="${escapeHtml(field.placeholder)}"` : '';
}

export function renderTextLike(field, formData, inputType) {
  const value = formData[field.name] ?? '';
  return `
    <div class="form-field">
      ${renderLabel(field)}
      <input type="${inputType}" id="${escapeHtml(field.name)}" name="${escapeHtml(field.name)}"
             value="${escapeHtml(value)}" ${placeholderAttr(field)} ${field.required ? 'required' : ''}>
      ${renderHelper(field)}
    </div>
  `;
}

export function renderTextarea(field, formData) {
  const value = formData[field.name] ?? '';
  return `
    <div class="form-field">
      ${renderLabel(field)}
      <textarea id="${escapeHtml(field.name)}" name="${escapeHtml(field.name)}" rows="${field.rows || 3}"
                ${placeholderAttr(field)} ${field.required ? 'required' : ''}>${escapeHtml(value)}</textarea>
      ${renderHelper(field)}
    </div>
  `;
}

// „bis“-Datum (nachDatum): optional, nie vor dem Startdatum. min wird live nachgezogen (FormEvents).
export function renderDate(field, formData) {
  const value = formData[field.name] ?? '';
  const start = field.nachDatum ? formData[field.nachDatum] : null;
  const picker = CustomDatePicker.render({
    inputId: escapeHtml(field.name),
    name: escapeHtml(field.name),
    field: escapeHtml(field.name),
    label: escapeHtml(field.label),
    value,
    min: start || '',
    variant: 'text',
    required: !!field.required,
    inputAttrs: field.nachDatum ? `data-nach-datum="${escapeHtml(field.nachDatum)}"` : ''
  });
  return `
    <div class="form-field${field.nachDatum ? ' form-field--bis' : ''}">
      ${renderLabel(field)}
      ${picker}
      ${renderHelper(field)}
    </div>
  `;
}

/** Content-Verwendung: der gewählte Typ ist immer angehakt und gesperrt. */
export function istGesperrt(field, context) {
  return !!field.lockForBereich && context?.bereich === field.lockForBereich;
}

export function renderCheckbox(field, formData, context) {
  const gesperrt = istGesperrt(field, context);
  const checked = gesperrt || formData[field.name] === true;
  return `
    <div class="form-field form-field--checkbox">
      <label class="checkbox-label${gesperrt ? ' checkbox-label--gesperrt' : ''}"${gesperrt ? ' title="Folgt aus dem Briefing-Typ"' : ''}>
        <input type="checkbox" name="${escapeHtml(field.name)}" value="true" ${checked ? 'checked' : ''} ${gesperrt ? 'disabled data-gesperrt="true"' : ''}>
        <span>${escapeHtml(field.label)}</span>
      </label>
      ${renderHelper(field)}
    </div>
  `;
}

export function renderCheckboxes(field, formData) {
  const selected = Array.isArray(formData[field.name]) ? formData[field.name] : [];
  const options = (field.options || []).map(opt => `
    <label class="checkbox-label">
      <input type="checkbox" name="${escapeHtml(field.name)}" value="${escapeHtml(opt.value)}" ${selected.includes(opt.value) ? 'checked' : ''}>
      <span>${escapeHtml(opt.label)}</span>
    </label>
  `).join('');
  return `
    <div class="form-field">
      ${renderLabel(field)}
      <div class="checkbox-group ${field.compact ? 'checkbox-group--compact' : ''}">${options}</div>
      ${renderHelper(field)}
    </div>
  `;
}

/** Zuordnungsfeld ist bekannt (aus Produktion/Kampagne) und wird nur im Hintergrund gesetzt. */
export function istBekannt(field, formData, context) {
  return !!field.hideWhenKnown && !!context?.linieGesperrt && !!formData[field.name];
}

// Entity-Select (Unternehmen, Marke, Kampagne, Produktion). Optionen kommen aus context.
export function renderEntitySelect(field, formData, context) {
  const current = formData[field.name] ?? '';
  const bekannt = istBekannt(field, formData, context);
  let options = context?.[field.table] || [];
  let disabled = false;
  let emptyLabel = field.placeholder || 'Auswählen...';

  if (field.dependsOn) {
    const parentValue = formData[field.dependsOn];
    if (!parentValue) {
      disabled = true;
      emptyLabel = 'Bitte zuerst Unternehmen wählen...';
      options = [];
    } else {
      options = options.filter(o => o[field.dependsOn] === parentValue || o.unternehmen_id === parentValue);
    }
  }
  if (field.scopeMarke && formData.marke_id) {
    options = options.filter(o => !o.marke_id || o.marke_id === formData.marke_id);
  }
  if (field.hideWhenKnown && context?.linieGesperrt) {
    disabled = true;
    if (current && !options.some(o => o.id === current)) {
      const kept = (context?.[field.table] || []).find(o => o.id === current);
      if (kept) options = [kept, ...options];
    }
    if (!current) emptyLabel = '–';
  }

  const opts = options.map(o => `
    <option value="${escapeHtml(o.id)}" ${current === o.id ? 'selected' : ''}>${escapeHtml(o[field.displayField] || o.id)}</option>
  `).join('');

  return `
    <div class="form-field${bekannt ? ' hidden' : ''}"${bekannt ? ' data-bekannt="true"' : ''}>
      ${renderLabel(field)}
      <select id="${escapeHtml(field.name)}" name="${escapeHtml(field.name)}" data-searchable="true"
              ${field.dependsOn ? `data-depends-on="${escapeHtml(field.dependsOn)}"` : ''}
              ${disabled ? 'disabled' : ''} ${field.required && !bekannt ? 'required' : ''}>
        <option value="">${escapeHtml(emptyLabel)}</option>
        ${opts}
      </select>
      ${renderHelper(field)}
    </div>
  `;
}
