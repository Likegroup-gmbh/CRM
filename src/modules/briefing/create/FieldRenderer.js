// FieldRenderer.js
// Generische HTML-Renderer fuer die Feldtypen aus fieldConfig.js.
// Nutzt dieselben CSS-Klassen wie der Vertragsgenerator
// (form-field, radio-group, radio-option, checkbox-label, ...).
//
// Conditional Fields: Wrapper mit data-condition-* Attributen;
// das Ein-/Ausblenden uebernimmt FormEvents.js (Live) bzw. wird
// beim Rendern ueber evaluateCondition vorberechnet.

import { evaluateCondition } from './fieldConfig.js';
import { icon } from '../../../core/icons/IconSystem.js';

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function conditionAttrs(condition) {
  if (!condition) return '';
  const parts = [`data-condition-field="${escapeHtml(condition.field)}"`];
  if (condition.equals !== undefined) parts.push(`data-condition-equals="${escapeHtml(condition.equals)}"`);
  if (condition.in) parts.push(`data-condition-in="${escapeHtml(condition.in.join(','))}"`);
  if (condition.includes !== undefined) parts.push(`data-condition-includes="${escapeHtml(condition.includes)}"`);
  if (condition.includesAny) parts.push(`data-condition-includes-any="${escapeHtml(condition.includesAny.join(','))}"`);
  return parts.join(' ');
}

// Wrapper: blendet Felder/Sections mit Condition abhaengig von formData ein/aus
function wrapConditional(html, condition, formData) {
  if (!condition) return html;
  const visible = evaluateCondition(condition, formData);
  return `<div class="bf-conditional ${visible ? '' : 'hidden'}" ${conditionAttrs(condition)}>${html}</div>`;
}

function renderLabel(field) {
  const required = field.required ? ' <span class="required">*</span>' : '';
  return `<label ${field.type === 'text' || field.type === 'url' || field.type === 'date' ? `for="${field.name}"` : ''}>${escapeHtml(field.label)}${required}</label>`;
}

function renderHelper(field) {
  return field.helper ? `<p class="field-helper">${escapeHtml(field.helper)}</p>` : '';
}

// ---------------------------------------------------------------
// Einzelne Feldtypen
// ---------------------------------------------------------------

function renderTextLike(field, formData, inputType) {
  const value = formData[field.name] ?? '';
  return `
    <div class="form-field">
      ${renderLabel(field)}
      <input type="${inputType}" id="${field.name}" name="${field.name}"
             value="${escapeHtml(value)}"
             ${field.placeholder ? `placeholder="${escapeHtml(field.placeholder)}"` : ''}
             ${field.required ? 'required' : ''}>
      ${renderHelper(field)}
    </div>
  `;
}

function renderTextarea(field, formData) {
  const value = formData[field.name] ?? '';
  return `
    <div class="form-field">
      ${renderLabel(field)}
      <textarea id="${field.name}" name="${field.name}" rows="${field.rows || 3}"
                ${field.placeholder ? `placeholder="${escapeHtml(field.placeholder)}"` : ''}
                ${field.required ? 'required' : ''}>${escapeHtml(value)}</textarea>
      ${renderHelper(field)}
    </div>
  `;
}

function renderDate(field, formData) {
  const value = formData[field.name] ?? '';
  return `
    <div class="form-field">
      ${renderLabel(field)}
      <input type="date" id="${field.name}" name="${field.name}" value="${escapeHtml(value)}">
      ${renderHelper(field)}
    </div>
  `;
}

function renderRadio(field, formData) {
  const current = formData[field.name];
  const options = field.options.map(opt => {
    // Boolean-Radios: formData speichert echte Booleans, DOM liefert Strings
    const checked = String(current) === String(opt.value) && current !== null && current !== undefined && current !== '';
    return `
      <label class="radio-option">
        <input type="radio" name="${field.name}" value="${escapeHtml(opt.value)}" ${checked ? 'checked' : ''}>
        <span>${escapeHtml(opt.label)}</span>
      </label>
    `;
  }).join('');
  return `
    <div class="form-field">
      ${renderLabel(field)}
      <div class="radio-group">${options}</div>
      ${renderHelper(field)}
    </div>
  `;
}

function renderCheckbox(field, formData) {
  const checked = formData[field.name] === true;
  return `
    <div class="form-field">
      <label class="checkbox-label">
        <input type="checkbox" name="${field.name}" value="true" ${checked ? 'checked' : ''}>
        <span>${escapeHtml(field.label)}</span>
      </label>
      ${renderHelper(field)}
    </div>
  `;
}

function renderCheckboxes(field, formData) {
  const selected = Array.isArray(formData[field.name]) ? formData[field.name] : [];
  const options = field.options.map(opt => `
    <label class="checkbox-label">
      <input type="checkbox" name="${field.name}" value="${escapeHtml(opt.value)}" ${selected.includes(opt.value) ? 'checked' : ''}>
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

// Feste Optionen als Checkboxen + Freitext fuer zusaetzliche Werte (alles -> text[])
function renderCustomMulti(field, formData) {
  const all = Array.isArray(formData[field.name]) ? formData[field.name] : [];
  const knownValues = field.options.map(o => o.value);
  const selectedKnown = all.filter(v => knownValues.includes(v));
  const customValues = all.filter(v => !knownValues.includes(v));

  const options = field.options.map(opt => `
    <label class="checkbox-label">
      <input type="checkbox" name="${field.name}" value="${escapeHtml(opt.value)}" ${selectedKnown.includes(opt.value) ? 'checked' : ''}>
      <span>${escapeHtml(opt.label)}</span>
    </label>
  `).join('');

  return `
    <div class="form-field">
      ${renderLabel(field)}
      ${field.options.length ? `<div class="checkbox-group">${options}</div>` : ''}
      <input type="text" name="${field.name}__custom" class="bf-custom-multi-input"
             value="${escapeHtml(customValues.join(', '))}"
             placeholder="${escapeHtml(field.customPlaceholder || 'Weitere (kommagetrennt)...')}">
      ${renderHelper(field)}
    </div>
  `;
}

// Flache Sub-Felder -> jsonb-Spalte (name="feld__sub")
function renderGroup(field, formData) {
  const groupValue = (formData[field.name] && typeof formData[field.name] === 'object') ? formData[field.name] : {};
  const subFields = field.fields.map(sub => {
    const subName = `${field.name}__${sub.name}`;
    const subValue = groupValue[sub.name] ?? '';
    if (sub.type === 'textarea') {
      return `
        <div class="form-field">
          <label for="${subName}">${escapeHtml(sub.label)}</label>
          <textarea id="${subName}" name="${subName}" rows="${sub.rows || 2}"
                    ${sub.placeholder ? `placeholder="${escapeHtml(sub.placeholder)}"` : ''}>${escapeHtml(subValue)}</textarea>
        </div>
      `;
    }
    return `
      <div class="form-field">
        <label for="${subName}">${escapeHtml(sub.label)}</label>
        <input type="text" id="${subName}" name="${subName}" value="${escapeHtml(subValue)}"
               ${sub.placeholder ? `placeholder="${escapeHtml(sub.placeholder)}"` : ''}>
      </div>
    `;
  }).join('');

  return `
    <div class="form-field">
      ${renderLabel(field)}
      <div class="bf-group">${subFields}</div>
      ${renderHelper(field)}
    </div>
  `;
}

// Plattform -> Formate -> jsonb { instagram: [...], tiktok: true, weitere: '...' }
function renderChannelGroup(field, formData) {
  const value = (formData[field.name] && typeof formData[field.name] === 'object') ? formData[field.name] : {};

  const blocks = field.channels.map(channel => {
    const channelValue = value[channel.key];
    if (!channel.formats) {
      // Toggle-Plattform ohne Unterformate
      return `
        <div class="bf-channel">
          <label class="checkbox-label bf-channel__title">
            <input type="checkbox" name="${field.name}__${channel.key}" value="true" ${channelValue === true ? 'checked' : ''}>
            <span>${escapeHtml(channel.label)}</span>
          </label>
        </div>
      `;
    }
    const selected = Array.isArray(channelValue) ? channelValue : [];
    const formats = channel.formats.map(fmt => `
      <label class="checkbox-label">
        <input type="checkbox" name="${field.name}__${channel.key}" value="${escapeHtml(fmt.value)}" ${selected.includes(fmt.value) ? 'checked' : ''}>
        <span>${escapeHtml(fmt.label)}</span>
      </label>
    `).join('');
    return `
      <div class="bf-channel">
        <div class="bf-channel__title">${escapeHtml(channel.label)}</div>
        <div class="checkbox-group checkbox-group--compact">${formats}</div>
      </div>
    `;
  }).join('');

  const customBlock = field.customLabel ? `
    <div class="bf-channel">
      <div class="bf-channel__title">${escapeHtml(field.customLabel)}</div>
      <input type="text" name="${field.name}__weitere" value="${escapeHtml(value.weitere || '')}"
             placeholder="${escapeHtml(field.customPlaceholder || '')}">
    </div>
  ` : '';

  return `
    <div class="form-field">
      ${renderLabel(field)}
      <div class="bf-channels">${blocks}${customBlock}</div>
      ${renderHelper(field)}
    </div>
  `;
}

// [{ kpi, zielwert }] -> jsonb
function renderRepeatableKpi(field, formData) {
  const rows = Array.isArray(formData[field.name]) ? formData[field.name] : [];
  const optionsHtml = (selected) => `
    <option value="">KPI waehlen...</option>
    ${field.kpiOptions.map(o => `<option value="${escapeHtml(o.value)}" ${selected === o.value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
  `;

  const rowHtml = (entry = {}) => `
    <div class="bf-repeatable-row" data-repeatable-row>
      <select data-kpi class="bf-repeatable-row__select">${optionsHtml(entry.kpi)}</select>
      <input type="text" data-zielwert placeholder="Zielwert" value="${escapeHtml(entry.zielwert || '')}">
      <button type="button" class="mdc-btn mdc-btn--icon bf-repeatable-remove" title="Entfernen">${icon('trash')}</button>
    </div>
  `;

  return `
    <div class="form-field">
      ${renderLabel(field)}
      <div class="bf-repeatable" data-repeatable="${field.name}" data-repeatable-type="kpi">
        ${rows.map(rowHtml).join('')}
      </div>
      <button type="button" class="mdc-btn mdc-btn--secondary bf-repeatable-add" data-repeatable-add="${field.name}">
        ${icon('plus')} KPI hinzufuegen
      </button>
      ${renderHelper(field)}
    </div>
  `;
}

// ["...", ...] -> jsonb
function renderRepeatableText(field, formData) {
  const rows = Array.isArray(formData[field.name]) ? formData[field.name] : [];
  const rowHtml = (entry = '') => `
    <div class="bf-repeatable-row" data-repeatable-row>
      <input type="text" data-item placeholder="${escapeHtml(field.itemLabel || 'Eintrag')}" value="${escapeHtml(entry)}">
      <button type="button" class="mdc-btn mdc-btn--icon bf-repeatable-remove" title="Entfernen">${icon('trash')}</button>
    </div>
  `;

  return `
    <div class="form-field">
      ${renderLabel(field)}
      <div class="bf-repeatable" data-repeatable="${field.name}" data-repeatable-type="text" data-max="${field.max || 10}">
        ${rows.map(rowHtml).join('')}
      </div>
      <button type="button" class="mdc-btn mdc-btn--secondary bf-repeatable-add" data-repeatable-add="${field.name}">
        ${icon('plus')} ${escapeHtml(field.itemLabel || 'Eintrag')} hinzufuegen
      </button>
      ${renderHelper(field)}
    </div>
  `;
}

// [{ typ: 'url'|'upload', value, label? }] -> jsonb
function renderRepeatableUpload(field, formData) {
  const rows = Array.isArray(formData[field.name]) ? formData[field.name] : [];

  const rowHtml = (entry = {}, index) => {
    const isUpload = entry.typ === 'upload';
    return `
      <div class="bf-repeatable-row bf-upload-row" data-repeatable-row>
        <span class="bf-upload-row__index">${index + 1}</span>
        <select data-typ class="bf-repeatable-row__select">
          <option value="url" ${!isUpload ? 'selected' : ''}>URL</option>
          <option value="upload" ${isUpload ? 'selected' : ''}>Upload</option>
        </select>
        <input type="url" data-url placeholder="https://..." value="${!isUpload ? escapeHtml(entry.value || '') : ''}" class="${isUpload ? 'hidden' : ''}">
        <span class="bf-upload-row__file ${isUpload ? '' : 'hidden'}" data-file-zone>
          <input type="file" data-file class="hidden">
          <button type="button" class="mdc-btn mdc-btn--secondary" data-file-trigger>${icon('upload')} Datei</button>
          <span data-file-label>${isUpload ? escapeHtml(entry.label || 'Datei hochgeladen') : ''}</span>
        </span>
        <input type="hidden" data-value value="${escapeHtml(entry.value || '')}">
        <input type="hidden" data-label value="${escapeHtml(entry.label || '')}">
        <button type="button" class="mdc-btn mdc-btn--icon bf-repeatable-remove" title="Entfernen">${icon('trash')}</button>
      </div>
    `;
  };

  return `
    <div class="form-field">
      ${renderLabel(field)}
      <div class="bf-repeatable" data-repeatable="${field.name}" data-repeatable-type="upload" data-max="${field.max || 3}">
        ${rows.map(rowHtml).join('')}
      </div>
      <button type="button" class="mdc-btn mdc-btn--secondary bf-repeatable-add" data-repeatable-add="${field.name}">
        ${icon('plus')} Beispiel hinzufuegen
      </button>
      ${renderHelper(field)}
    </div>
  `;
}

// Entity-Select (Unternehmen/Marke/Benutzer), Optionen kommen aus context
function renderEntitySelect(field, formData, context) {
  const current = formData[field.name] ?? '';
  let options = context?.[field.table] || [];
  let disabled = false;
  let emptyLabel = field.placeholder || 'Auswaehlen...';

  if (field.dependsOn) {
    const parentValue = formData[field.dependsOn];
    if (!parentValue) {
      disabled = true;
      emptyLabel = 'Bitte zuerst Unternehmen waehlen...';
      options = [];
    } else {
      options = options.filter(o => o[field.dependsOn] === parentValue || o.unternehmen_id === parentValue);
    }
  }

  const opts = options.map(o => `
    <option value="${o.id}" ${current === o.id ? 'selected' : ''}>${escapeHtml(o[field.displayField] || o.id)}</option>
  `).join('');

  return `
    <div class="form-field">
      ${renderLabel(field)}
      <select id="${field.name}" name="${field.name}" data-searchable="true"
              ${field.dependsOn ? `data-depends-on="${field.dependsOn}"` : ''}
              ${disabled ? 'disabled' : ''} ${field.required ? 'required' : ''}>
        <option value="">${escapeHtml(emptyLabel)}</option>
        ${opts}
      </select>
      ${renderHelper(field)}
    </div>
  `;
}

// ---------------------------------------------------------------
// Public API
// ---------------------------------------------------------------

export function renderField(field, formData, context) {
  let html;
  switch (field.type) {
    case 'text': html = renderTextLike(field, formData, 'text'); break;
    case 'url': html = renderTextLike(field, formData, 'url'); break;
    case 'date': html = renderDate(field, formData); break;
    case 'textarea': html = renderTextarea(field, formData); break;
    case 'radio': html = renderRadio(field, formData); break;
    case 'checkbox': html = renderCheckbox(field, formData); break;
    case 'checkboxes': html = renderCheckboxes(field, formData); break;
    case 'customMulti': html = renderCustomMulti(field, formData); break;
    case 'group': html = renderGroup(field, formData); break;
    case 'channelGroup': html = renderChannelGroup(field, formData); break;
    case 'repeatableKpi': html = renderRepeatableKpi(field, formData); break;
    case 'repeatableText': html = renderRepeatableText(field, formData); break;
    case 'repeatableUpload': html = renderRepeatableUpload(field, formData); break;
    case 'entitySelect': html = renderEntitySelect(field, formData, context); break;
    default: html = renderTextLike(field, formData, 'text');
  }
  return wrapConditional(html, field.condition, formData);
}

export function renderSection(section, formData, context) {
  const fields = section.fields.map(f => renderField(f, formData, context)).join('');
  const header = (section.title || section.description) ? `
      <div class="step-section__header">
        ${section.title ? `<h3>${escapeHtml(section.title)}</h3>` : ''}
        ${section.description ? `<p class="step-description">${escapeHtml(section.description)}</p>` : ''}
      </div>` : '';
  const html = `
    <div class="step-section">${header}
      ${fields}
    </div>
  `;
  return wrapConditional(html, section.condition, formData);
}

export function renderStep(stepDef, formData, context) {
  return stepDef.sections.map(s => renderSection(s, formData, context)).join('');
}
