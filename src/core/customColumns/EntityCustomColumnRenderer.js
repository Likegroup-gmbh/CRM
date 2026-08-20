// EntityCustomColumnRenderer.js
// Rendert Custom-Column Header + Zellen fuer einstufige Tabellen (Sourcing/Strategie).
// Nutzt die data-Attribute / CSS-Klassen, die EntityCustomColumnFieldHandler erkennt.

import { CustomDatePicker } from '../components/CustomDatePicker.js';
import { escapeHtml, makeCustomColumnId } from './entityColumnUtils.js';
import { icon } from '../../core/icons/IconSystem.js';

const EXTERNAL_LINK_ICON = `${icon('arrow-top-right')}`;
const FOLDER_ICON = `${icon('folder')}`;
const GEAR_ICON = `${icon('cog')}`;
/** Phosphor Hand – Griff zum Verschieben eigener Spalten */
const COLUMN_GRIP_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true"><path d="M188,80a27.79,27.79,0,0,0-13.36,3.4,28,28,0,0,0-46.64-11A28,28,0,0,0,80,92v20H68a28,28,0,0,0-28,28v12a88,88,0,0,0,176,0V108A28,28,0,0,0,188,80Zm12,72a72,72,0,0,1-144,0V140a12,12,0,0,1,12-12H80v24a8,8,0,0,0,16,0V92a12,12,0,0,1,24,0v28a8,8,0,0,0,16,0V92a12,12,0,0,1,24,0v28a8,8,0,0,0,16,0V108a12,12,0,0,1,24,0Z"></path></svg>`;

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
    // Nur der Hand-Griff ist draggable – der Spaltenname bleibt normal klickbar.
    const grip = isKunde ? '' : `<span class="entity-custom-col-grip" draggable="true"
      data-custom-col-grip="${colId}" title="Spalte verschieben" aria-label="Spalte verschieben" role="button">${COLUMN_GRIP_ICON}</span>`;
    return `<th class="entity-custom-col-header" data-custom-col-id="${colId}"${hide}>` +
      `<div class="entity-custom-col-header-inner">` +
      `${grip}<span class="entity-custom-col-title">${escapeHtml(col.name)}</span>` +
      `</div></th>`;
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

  return `<select class="strategie-textarea custom-col-input custom-col-select entity-custom-col-select" ${attrs}>
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
    const folderLink = `<a href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer" class="link-icon-btn custom-upload-folder-link" title="Ordner öffnen">${FOLDER_ICON}</a>`;
    if (!isEditable) return folderLink;
    return `${folderLink}<button type="button" class="custom-upload-btn custom-upload-settings-btn" data-custom-column-id="${col.id}" data-entity-id="${entityId}" data-column-name="${escapeHtml(col.name)}" title="Dateien verwalten">${GEAR_ICON}</button>`;
  }
  if (!isEditable) return `<div class="cell-text-readonly">-</div>`;

  return `<button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm custom-upload-btn" data-custom-column-id="${col.id}" data-entity-id="${entityId}" data-column-name="${escapeHtml(col.name)}" title="Dateien hochladen">
    ${icon('upload', { className: 'icon-16' })}
    Upload
  </button>`;
}
