// FieldRenderer.js
// HTML für das Briefing-Formular aus fieldConfig.js (Creator-Briefing-PDF).
// Einfache Typen: fieldRendererBasis.js, zusammengesetzte: fieldRendererListen.js.
// Die Zuordnung (Unternehmen bis Produktion) verschwindet ganz, wenn alles bekannt ist.

import { escapeHtml } from '../../../core/format.js';
import {
  renderTextLike,
  renderTextarea,
  renderDate,
  renderCheckbox,
  renderCheckboxes,
  renderEntitySelect,
  istBekannt
} from './fieldRendererBasis.js';
import { renderVideolaenge, renderProduktListe, renderIdeenListe } from './fieldRendererListen.js';
import { flattenFields } from './fieldConfig.js';

export { escapeHtml };

function classList(...parts) {
  return parts.filter(Boolean).join(' ');
}

function renderFieldGroup(field, formData, context) {
  const layout = field.layout || 'stack';
  const id = field.id || '';
  const classes = classList('bf-field-group', `bf-field-group--${layout}`, id && `bf-field-group--${id}`);
  const inner = (field.fields || []).map(f => renderField(f, formData, context)).join('');
  const label = field.label ? `<div class="bf-field-group__label">${escapeHtml(field.label)}</div>` : '';
  const body = label ? `${label}<div class="bf-field-group__body">${inner}</div>` : inner;
  return `<div class="${classes}"${id ? ` data-group="${escapeHtml(id)}"` : ''}>${body}</div>`;
}

export function renderField(field, formData, context) {
  switch (field.type) {
    case 'text': return renderTextLike(field, formData, 'text');
    case 'url': return renderTextLike(field, formData, 'url');
    case 'number': return renderTextLike(field, formData, 'number');
    case 'date': return renderDate(field, formData);
    case 'textarea': return renderTextarea(field, formData);
    case 'checkbox': return renderCheckbox(field, formData, context);
    case 'checkboxes': return renderCheckboxes(field, formData);
    case 'entitySelect': return renderEntitySelect(field, formData, context);
    case 'videolaenge': return renderVideolaenge(field, formData);
    case 'produktListe': return renderProduktListe(field, formData, context);
    case 'ideenListe': return renderIdeenListe(field, formData);
    case 'fieldGroup': return renderFieldGroup(field, formData, context);
    default: return renderTextLike(field, formData, 'text');
  }
}

/**
 * Zuordnung ausblenden, wenn Unternehmen, Kampagne und Produktion feststehen.
 * Die Produktion gilt als bekannt, wenn der Kontext sie bindet (aus der Produktion angelegt).
 */
function zuordnungBekannt(section, formData, context) {
  if (!section.hideWhenKnown) return false;
  return flattenFields(section.fields).every(f => {
    if (f.name === 'produktion_id') return !!context?.produktionGebunden;
    if (!f.required) return true;
    return istBekannt(f, formData, context);
  });
}

export function renderSection(section, formData, context, stepId = '') {
  const fields = section.fields.map(f => renderField(f, formData, context)).join('');
  const header = (section.title || section.description) ? `
      <div class="step-section__header">
        ${section.title ? `<h3>${escapeHtml(section.title)}</h3>` : ''}
        ${section.description ? `<p class="step-description">${escapeHtml(section.description)}</p>` : ''}
      </div>` : '';
  const sectionId = section.id || '';
  const hidden = zuordnungBekannt(section, formData, context);
  const classes = classList('step-section', sectionId && `step-section--${sectionId}`, hidden && 'hidden');
  const dataAttrs = classList(
    sectionId && `data-section="${escapeHtml(sectionId)}"`,
    stepId && `data-step="${escapeHtml(stepId)}"`
  );
  return `
    <div class="${classes}"${dataAttrs ? ` ${dataAttrs}` : ''}>${header}
      <div class="step-section__body">${fields}</div>
    </div>
  `;
}

export function renderStep(stepDef, formData, context) {
  const stepId = stepDef.id || '';
  const sections = stepDef.sections.map(s => renderSection(s, formData, context, stepId)).join('');
  const classes = classList('bf-step', stepId && `bf-step--${stepId}`);
  return `<div class="${classes}"${stepId ? ` data-step="${escapeHtml(stepId)}"` : ''}>${sections}</div>`;
}
