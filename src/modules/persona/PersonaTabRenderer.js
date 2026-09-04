// PersonaTabRenderer.js
// Personas-Tab: Tabelle und Empty State. Wird von der Marke- und von der
// Unternehmen-Detailseite genutzt - im Unternehmens-Kontext kommt eine Spalte
// mit den zugeordneten Marken dazu. Anlegen und Bearbeiten passieren auf einer
// eigenen Seite, siehe PersonaForm.js.

import { renderEmptyState } from '../../core/components/EmptyState.js';
import { actionBuilder } from '../../core/actions/ActionBuilder.js';
import { PersonaService } from './PersonaService.js';

const CREATE_BTN_HTML = '<button type="button" class="mdc-btn mdc-btn--create persona-create-btn">Persona anlegen</button>';

/** Ohne markeId sind wir auf der Unternehmensseite und zeigen die Marken-Spalte. */
function zeigtMarkenSpalte(detail) {
  return !detail.markeId;
}

function renderMarkenZellen(detail, persona) {
  const namen = PersonaService.markenNamen(persona);
  if (!namen.length) return '<span class="text-muted">Nur Unternehmen</span>';
  return namen.map(name => `<span class="status-badge">${detail.sanitize(name)}</span>`).join(' ');
}

function renderProduktZellen(detail, persona) {
  const namen = PersonaService.produktNamen(persona);
  if (!namen.length) return '<span class="text-muted">-</span>';
  return namen.map(name => `<span class="status-badge">${detail.sanitize(name)}</span>`).join(' ');
}

export function renderPersonas(detail) {
  const isKunde = window.isKunde?.();
  const personas = detail.personas || [];
  const mitMarken = zeigtMarkenSpalte(detail);

  if (personas.length === 0) {
    return renderEmptyState({
      icon: 'users',
      title: 'Keine Personas vorhanden',
      text: mitMarken
        ? 'Personas beschreiben die Zielgruppen dieses Unternehmens und werden später in Kampagnen und Briefings ausgewählt.'
        : 'Personas beschreiben die Zielgruppen dieser Marke und werden später in Kampagnen und Briefings ausgewählt.',
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
      ${mitMarken ? `<td>${renderMarkenZellen(detail, persona)}</td>` : ''}
      <td>${renderProduktZellen(detail, persona)}</td>
      <td>${detail.sanitize(PersonaService.alterLabel(persona))}</td>
      <td>${detail.sanitize(persona.geschlecht || '-')}</td>
      <td>${detail.sanitize(persona.wohnort_region || '-')}</td>
      <td>${detail.sanitize(persona.lebenssituation || '-')}</td>
      <td>${detail.formatDate(persona.created_at)}</td>
      <td class="col-actions">${actionBuilder.create('persona', persona.id)}</td>
    </tr>
  `).join('');

  return `
    <div class="data-table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Oberbegriff</th>
            <th>Name</th>
            ${mitMarken ? '<th>Marken</th>' : ''}
            <th>Produkte</th>
            <th>Alter</th>
            <th>Geschlecht</th>
            <th>Region</th>
            <th>Lebenssituation</th>
            <th>Erstellt</th>
            <th class="col-actions">Aktionen</th>
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
