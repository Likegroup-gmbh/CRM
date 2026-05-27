// CustomColumnRenderer.js
// Rendert Custom Column Header und Zellen fuer alle 6 Feldtypen.
// Nutzt exakt die gleichen CSS-Klassen und Patterns wie die bestehenden Felder.

import { isColumnVisible } from './ColumnRegistry.js';
import { CustomDatePicker } from '../../../core/components/CustomDatePicker.js';

const EXTERNAL_LINK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`;

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function renderCustomHeader(col, hiddenColumns, isKunde) {
  const vis = isColumnVisible(col.id, hiddenColumns, isKunde) ? '' : 'style="display:none;"';
  return `<th class="col-header ${col.id}" ${vis} data-col="${col.dataCol}" draggable="true">
    ${escapeHtml(col.label)}
    <div class="resize-handle resize-handle-col" data-col="${col.dataCol}"></div>
  </th>`;
}

export function renderCustomCell(col, koop, videos, store, table) {
  const hiddenColumns = table.hiddenColumns || [];
  const isKunde = table.isKundeRole();
  const vis = isColumnVisible(col.id, hiddenColumns, isKunde) ? '' : 'style="display:none;"';

  if (isKunde && !col.visibleForKunden) {
    return `<td class="grid-cell" ${vis}></td>`;
  }

  const isEditable = !isKunde;

  if (col.entityType === 'video') {
    return renderVideoLevelCell(col, koop, videos, store, vis, isEditable, table);
  }
  return renderKooperationLevelCell(col, koop, store, vis, isEditable);
}

function renderKooperationLevelCell(col, koop, store, vis, isEditable) {
  const value = store?.getCustomColumnValue(koop.id, col.uuid) ?? '';
  const content = renderFieldByType(col, koop.id, value, isEditable);
  const extraClass = col.fieldType === 'boolean' ? ' checkbox-stack' : '';
  return `<td class="grid-cell${extraClass}" ${vis}>${content}</td>`;
}

function renderVideoLevelCell(col, koop, videos, store, vis, isEditable, table) {
  if (!videos || videos.length === 0) {
    return `<td class="grid-cell video-stack-cell" ${vis}><span class="text-muted">-</span></td>`;
  }

  const stack = videos.map(video => {
    const value = store?.getCustomColumnValue(video.id, col.uuid) ?? '';
    const content = renderFieldByType(col, video.id, value, isEditable);
    const approvedClass = video.freigabe ? 'video-field-wrapper--approved' : '';
    return `<div class="video-field-wrapper ${approvedClass}" data-video-id="${video.id}">${content}</div>`;
  }).join('');

  const extraClass = col.fieldType === 'boolean' ? ' checkbox-stack' : '';
  return `<td class="grid-cell video-stack-cell${extraClass}" ${vis}><div class="video-fields-stack">${stack}</div></td>`;
}

function renderFieldByType(col, entityId, value, isEditable) {
  const attrs = `data-custom-column-id="${col.uuid}" data-entity-id="${entityId}"`;

  switch (col.fieldType) {
    case 'text':
      return renderTextField(attrs, value, isEditable, col.label);
    case 'link':
      return renderLinkField(attrs, value, isEditable);
    case 'date':
      return renderDateField(col, entityId, value, isEditable);
    case 'boolean':
      return renderBooleanField(attrs, value, isEditable);
    case 'dropdown':
      return renderDropdownField(attrs, value, isEditable, col);
    case 'number':
      return renderNumberField(attrs, value, isEditable, col.label);
    default:
      return renderTextField(attrs, value, isEditable, col.label);
  }
}

function renderTextField(attrs, value, isEditable, placeholder) {
  return `<input type="text" class="grid-input stacked-video-input custom-col-input" 
    ${attrs} value="${escapeHtml(value)}" 
    ${!isEditable ? 'readonly' : ''} 
    placeholder="${escapeHtml(placeholder)}"/>`;
}

function renderLinkField(attrs, value, isEditable) {
  if (!isEditable) {
    return value
      ? `<a href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer" class="external-link-btn stacked-video-link-btn" title="Link öffnen">${EXTERNAL_LINK_ICON}</a>`
      : `<span class="stacked-video-empty">-</span>`;
  }

  return `<input type="text" class="grid-input stacked-video-input custom-col-input" 
    ${attrs} value="${escapeHtml(value)}" 
    placeholder="Link"/>`;
}

function renderDateField(col, entityId, value, isEditable) {
  const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(d + 'T00:00:00');
    if (isNaN(date)) return '—';
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (!isEditable) {
    return `<div class="video-deadline-text">${formatDate(value)}</div>`;
  }

  const pickerHtml = CustomDatePicker.render({
    id: entityId,
    entity: 'custom',
    field: col.uuid,
    value: value || '',
    label: col.label,
    inputClass: 'video-date-picker-input custom-col-input custom-col-date'
  });
  const displayText = formatDate(value);
  return `<div class="video-date-cell">${pickerHtml}<span class="video-date-display">${displayText}</span></div>`;
}

function renderBooleanField(attrs, value, isEditable) {
  const checked = value === 'true' || value === true;
  return `<div class="stacked-video-checkbox-wrapper">
    <input type="checkbox" class="grid-checkbox stacked-video-checkbox custom-col-input custom-col-checkbox" 
      ${attrs} ${checked ? 'checked' : ''} 
      ${!isEditable ? 'disabled' : ''}/>
  </div>`;
}

function renderDropdownField(attrs, value, isEditable, col) {
  const options = col.dropdownOptions || [];

  if (!isEditable) {
    return `<span class="custom-col-dropdown-value">${escapeHtml(value || '—')}</span>`;
  }

  const optionHtml = options.map(opt =>
    `<option value="${escapeHtml(opt.label)}" ${opt.label === value ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`
  ).join('');

  return `<select class="grid-select stacked-video-select custom-col-input custom-col-select" ${attrs}>
    <option value="">– wählen –</option>
    ${optionHtml}
  </select>`;
}

function renderNumberField(attrs, value, isEditable, placeholder) {
  return `<input type="number" class="grid-input stacked-video-input custom-col-input custom-col-number" 
    ${attrs} value="${escapeHtml(value != null ? String(value) : '')}" 
    ${!isEditable ? 'readonly' : ''} 
    placeholder="${escapeHtml(placeholder)}" step="any"/>`;
}
