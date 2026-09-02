// PersonaList.js
// Top-Level-Liste aller Personas. Selbe Tabelle und derselbe Create-Button wie
// der Produkte-Tab, nur hier mit Unternehmens-Spalte und eigenem Empty State.
// Anlegen und Bearbeiten laufen ueber das Persona-Formular (/persona/new,
// /persona/:id), der nested Flow unter Unternehmen/Marke bleibt unangetastet.

import { renderEmptyState, renderSectionHeader } from '../../core/components/EmptyState.js';
import { avatarBubbles } from '../../core/components/AvatarBubbles.js';
import { PersonaService } from './PersonaService.js';

const CREATE_BTN_HTML = '<button type="button" class="mdc-btn mdc-btn--create persona-create-btn">Persona anlegen</button>';

export class PersonaList {
  constructor() {
    this.personas = [];
    this._abortController = null;
  }

  async init() {
    window.setHeadline('Personas Übersicht');

    const canView = (window.canViewPage && window.canViewPage('persona')) ||
                    (window.isAdmin() || window.currentUser?.permissions?.persona?.can_view);
    if (!canView) {
      window.content.innerHTML = `
        <div class="error-message">
          <p>Sie haben keine Berechtigung, Personas anzuzeigen.</p>
        </div>
      `;
      return;
    }

    await this.loadAndRender();
    this.bindEvents();
  }

  async loadAndRender() {
    try {
      this.personas = await PersonaService.loadAll();
      this.render();
    } catch (error) {
      window.ErrorHandler?.handle?.(error, 'PersonaList.loadAndRender');
      window.content.innerHTML = `
        <div class="error-message">
          <p>Personas konnten nicht geladen werden.</p>
        </div>
      `;
    }
  }

  _renderUnternehmen(persona) {
    const u = persona.unternehmen;
    if (!u?.firmenname) return '-';

    return avatarBubbles.renderBubbles([{
      name: u.firmenname,
      label: u.firmenname,
      type: 'org',
      id: u.id,
      entityType: 'unternehmen',
      logo_url: u.logo_url || null
    }], { showLabel: true });
  }

  _renderMarken(persona) {
    const namen = PersonaService.markenNamen(persona);
    if (!namen.length) return '<span class="text-muted">Nur Unternehmen</span>';
    return namen.map(name => `<span class="status-badge">${window.validatorSystem.sanitizeHtml(name)}</span>`).join(' ');
  }

  render() {
    const isKunde = window.isKunde?.();

    if (this.personas.length === 0) {
      window.content.innerHTML = renderEmptyState({
        icon: 'users',
        title: 'Keine Personas vorhanden',
        text: 'Personas beschreiben die Zielgruppen der Unternehmen und werden in Kampagnen, Briefings und Skripten ausgewählt.',
        actionsHtml: isKunde ? '' : CREATE_BTN_HTML
      });
      return;
    }

    const rows = this.personas.map(persona => `
      <tr class="table-row-clickable persona-row-open" data-persona-id="${persona.id}">
        <td>${window.validatorSystem.sanitizeHtml(persona.oberbegriff || '-')}</td>
        <td>
          <a href="#" class="table-link persona-row-open" data-persona-id="${persona.id}">
            ${window.validatorSystem.sanitizeHtml(persona.name)}
          </a>
        </td>
        <td>${this._renderUnternehmen(persona)}</td>
        <td>${this._renderMarken(persona)}</td>
        <td>${window.validatorSystem.sanitizeHtml(PersonaService.alterLabel(persona))}</td>
        <td>${window.validatorSystem.sanitizeHtml(persona.geschlecht || '-')}</td>
        <td>${window.validatorSystem.sanitizeHtml(persona.wohnort_region || '-')}</td>
        <td>${persona.created_at ? new Date(persona.created_at).toLocaleDateString('de-DE') : '-'}</td>
        <td>
          <button type="button" class="mdc-btn mdc-btn--secondary mdc-btn--sm persona-row-open" data-persona-id="${persona.id}">Öffnen</button>
        </td>
      </tr>
    `).join('');

    window.content.innerHTML = `
      ${renderSectionHeader({ title: 'Personas', actionsHtml: isKunde ? '' : CREATE_BTN_HTML })}
      <div class="data-table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Oberbegriff</th>
              <th>Name</th>
              <th>Unternehmen</th>
              <th>Marken</th>
              <th>Alter</th>
              <th>Geschlecht</th>
              <th>Region</th>
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

  bindEvents() {
    this._abortController?.abort();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    document.addEventListener('click', (e) => {
      if (e.target.closest('.persona-create-btn')) {
        e.preventDefault();
        window.navigateTo('/persona/new');
        return;
      }

      const personaRow = e.target.closest('.persona-row-open');
      if (personaRow) {
        e.preventDefault();
        window.navigateTo(`/persona/${personaRow.dataset.personaId}`);
      }
    }, { signal });

    window.addEventListener('entityUpdated', (e) => {
      if (e.detail?.entity === 'persona') {
        this.loadAndRender();
      }
    }, { signal });
  }

  destroy() {
    this._abortController?.abort();
    this._abortController = null;
  }
}

export const personaList = new PersonaList();
