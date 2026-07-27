// MarkeDetailRendererPersonas.js
// Personas-Tab der Marke: Tabelle und Empty State. Anlegen und Bearbeiten
// passieren auf einer eigenen Seite, siehe MarkePersonaForm.js.

import { renderEmptyState, renderSectionHeader } from '../../core/components/EmptyState.js';
import { MarkePersonaService } from './services/MarkePersonaService.js';

const CREATE_BTN_HTML = '<button type="button" class="mdc-btn mdc-btn--create persona-create-btn">Persona anlegen</button>';

export function renderPersonas(detail) {
  const isKunde = window.isKunde?.();
  const personas = detail.personas || [];

  if (personas.length === 0) {
    return renderEmptyState({
      icon: 'users',
      title: 'Keine Personas vorhanden',
      text: 'Personas beschreiben die Zielgruppen dieser Marke und werden später in Kampagnen und Briefings ausgewählt.',
      actionsHtml: isKunde ? '' : CREATE_BTN_HTML
    });
  }

  const rows = personas.map(persona => `
    <tr>
      <td>
        <a href="#" class="table-link persona-row-open" data-persona-id="${persona.id}">
          ${detail.sanitize(persona.oberbegriff || '-')}
        </a>
      </td>
      <td>${detail.sanitize(persona.name)}</td>
      <td>${detail.sanitize(MarkePersonaService.alterLabel(persona))}</td>
      <td>${detail.sanitize(persona.geschlecht || '-')}</td>
      <td>${detail.sanitize(persona.wohnort_region || '-')}</td>
      <td>${detail.sanitize(persona.lebenssituation || '-')}</td>
      <td>${detail.formatDate(persona.created_at)}</td>
      <td>
        <button type="button" class="secondary-btn btn-sm persona-row-open" data-persona-id="${persona.id}">Öffnen</button>
      </td>
    </tr>
  `).join('');

  return `
    ${renderSectionHeader({ title: 'Personas', actionsHtml: isKunde ? '' : CREATE_BTN_HTML })}
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Oberbegriff</th>
            <th>Name</th>
            <th>Alter</th>
            <th>Geschlecht</th>
            <th>Region</th>
            <th>Lebenssituation</th>
            <th>Erstellt</th>
            <th>Aktion</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

export function updatePersonasTab(detail) {
  const pane = document.getElementById('tab-personas');
  if (!pane) return;
  pane.innerHTML = renderPersonas(detail);
}
