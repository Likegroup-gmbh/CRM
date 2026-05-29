// EntityCustomColumnRenderer.js
// Rendert Custom-Column Header + Zellen fuer einstufige Tabellen (Sourcing/Strategie).
// Nutzt die data-Attribute / CSS-Klassen, die EntityCustomColumnFieldHandler erkennt.

import { CustomDatePicker } from '../components/CustomDatePicker.js';
import { escapeHtml, makeCustomColumnId } from './entityColumnUtils.js';

const EXTERNAL_LINK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`;
const FOLDER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;

function isHidden(col, hiddenColumns) {
  return Array.isArray(hiddenColumns) && hiddenColumns.includes(makeCustomColumnId(col.id));
}

/**
 * @param {Array} orderedCols  Custom-Spalten in Anzeigereihenfolge
 * @param {Array} hiddenColumns  Array mit "custom:{uuid}" der versteckten Spalten
 * @param {boolean} isKunde
 * @returns {string} aneinandergereihte <th>
 */
export function renderCustomHeaders(orderedCols, hiddenColumns, isKunde) {
  return (orderedCols || []).map(col => {
    if (isKunde && !col.visible_for_kunden) return '';
    const hide = isHidden(col, hiddenColumns) ? ' style="display:none;"' : '';
    const colId = makeCustomColumnId(col.id);
    const dragAttrs = isKunde ? '' : ' draggable="true"';
    return `<th class="entity-custom-col-header" data-custom-col-id="${colId}"${dragAttrs}${hide}>${escapeHtml(col.name)}</th>`;
  }).join('');
}

/**
 * @param {Array} orderedCols
 * @param {string} entityId
 * @param {(entityId:string, uuid:string)=>string} getValue
 * @param {Array} hiddenColumns
 * @param {boolean} isKunde
 * @returns {string} aneinandergereihte <td>
 */
export function renderCustomCells(orderedCols, entityId, getValue, hiddenColumns, isKunde) {
  return (orderedCols || []).map(col => {
    if (isKunde && !col.visible_for_kunden) return '';
    const hide = isHidden(col, hiddenColumns) ? ' style="display:none;"' : '';
    const value = getValue(entityId, col.id) ?? '';
    const isEditable = !isKunde;
    const content = renderFieldByType(col, entityId, value, isEditable);
    return `<td class="entity-custom-cell cell-textarea" data-custom-col-id="${makeCustomColumnId(col.id)}"${hide}>${content}</td>`;
  }).join('');
}

function renderFieldByType(col, entityId, value, isEditable) {
  const attrs = `data-custom-column-id="${col.id}" data-entity-id="${entityId}"`;
  switch (col.field_type) {
    case 'text': return renderTextField(attrs, value, isEditable, col.name);
    case 'link': return renderLinkField(attrs, value, isEditable);
    case 'date': return renderDateField(col, entityId, value, isEditable);
    case 'boolean': return renderBooleanField(attrs, value, isEditable);
    case 'dropdown': return renderDropdownField(attrs, value, isEditable, col);
    case 'number': return renderNumberField(attrs, value, isEditable, col.name);
    case 'upload': return renderUploadField(col, entityId, value, isEditable);
    default: return renderTextField(attrs, value, isEditable, col.name);
  }
}

function renderTextField(attrs, value, isEditable, placeholder) {
  if (!isEditable) return `<div class="cell-text-readonly">${escapeHtml(value) || '-'}</div>`;
  return `<textarea class="strategie-textarea custom-col-input" ${attrs} placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>`;
}

function renderLinkField(attrs, value, isEditable) {
  if (!isEditable) {
    return value
      ? `<a href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer" class="link-icon-btn" title="${escapeHtml(value)}">${EXTERNAL_LINK_ICON}</a>`
      : `<div class="cell-text-readonly">-</div>`;
  }
  return `<input type="text" class="strategie-textarea custom-col-input" ${attrs} value="${escapeHtml(value)}" placeholder="Link..."/>`;
}

function renderDateField(col, entityId, value, isEditable) {
  const formatDate = (d) => {
    if (!d) return '-';
    const date = new Date(d + 'T00:00:00');
    if (isNaN(date)) return '-';
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  if (!isEditable) return `<div class="cell-text-readonly">${formatDate(value)}</div>`;

  return CustomDatePicker.render({
    id: entityId,
    entity: 'custom',
    field: col.id,
    value: value || '',
    label: col.name,
    inputClass: 'custom-col-input custom-col-date'
  });
}

function renderBooleanField(attrs, value, isEditable) {
  const checked = value === 'true' || value === true;
  return `<input type="checkbox" class="cp-checkbox custom-col-input custom-col-checkbox" ${attrs} ${checked ? 'checked' : ''} ${!isEditable ? 'disabled' : ''}/>`;
}

function renderDropdownField(attrs, value, isEditable, col) {
  const options = col._dropdownOptions || [];
  if (!isEditable) return `<div class="cell-text-readonly">${escapeHtml(value || '-')}</div>`;

  const optionHtml = options
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map(opt => `<option value="${escapeHtml(opt.label)}" ${opt.label === value ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`)
    .join('');

  return `<select class="strategie-textarea custom-col-input custom-col-select" ${attrs} style="border:none;background:transparent;cursor:pointer;">
    <option value="">– wählen –</option>
    ${optionHtml}
  </select>`;
}

function renderNumberField(attrs, value, isEditable, placeholder) {
  if (!isEditable) return `<div class="cell-text-readonly">${escapeHtml(value) || '-'}</div>`;
  return `<input type="number" class="strategie-textarea custom-col-input custom-col-number" ${attrs} value="${escapeHtml(value != null ? String(value) : '')}" placeholder="${escapeHtml(placeholder)}" step="any"/>`;
}

function renderUploadField(col, entityId, value, isEditable) {
  if (value) {
    return `<a href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer" class="link-icon-btn custom-upload-folder-link" title="Ordner öffnen">${FOLDER_ICON}</a>`;
  }
  if (!isEditable) return `<div class="cell-text-readonly">-</div>`;

  return `<button type="button" class="secondary-btn btn-sm custom-upload-btn" data-custom-column-id="${col.id}" data-entity-id="${entityId}" data-column-name="${escapeHtml(col.name)}" title="Dateien hochladen">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:16px;height:16px;"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/></svg>
    Upload
  </button>`;
}
