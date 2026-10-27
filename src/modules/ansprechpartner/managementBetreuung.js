// Ansicht der Ansprechpartner auf der Management-Detailseite:
// Tabelle mit Creator-Zuordnung und Drawer zum Anlegen.

import { bindFilterSelects, readFilterSelectValues, renderFilterSelect } from '../../core/filters/FilterSelect.js';
import { openDrawer } from '../creator/creatorDrawer.js';
import { renderEmptyState, renderSectionHeader } from '../../core/components/EmptyState.js';
import { PhoneDisplay } from '../../core/components/PhoneDisplay.js';
import { PhoneNumberField } from '../../core/form/fields/PhoneNumberField.js';
import { icon } from '../../core/icons/IconSystem.js';

function text(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function personName(person) {
  return `${person?.vorname || ''} ${person?.nachname || ''}`.trim();
}

function addAnsprechpartnerButton() {
  return `
    <button type="button" class="mdc-btn mdc-btn--sm" id="mgmt-ap-add">
      <span class="mdc-btn__icon" aria-hidden="true">${icon('plus-lg', { className: 'icon-16' })}</span>
      <span class="mdc-btn__label">Ansprechpartner hinzufügen</span>
    </button>
  `;
}

function creatorOptions(creators) {
  return [...(creators || [])]
    .map((creator) => ({
      value: creator.id,
      label: personName(creator) || 'Creator'
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'de'));
}

export function renderManagementBetreuung({ people, creators, links }) {
  const addButton = addAnsprechpartnerButton();
  if (!people?.length) {
    return renderEmptyState({
      icon: 'users',
      title: 'Keine Ansprechpartner',
      text: 'Diesem Management sind noch keine Ansprechpartner zugeordnet.',
      actionsHtml: addButton
    });
  }

  const options = creatorOptions(creators);
  const creatorIds = new Set(options.map((option) => option.value));
  const rows = people.map((person) => {
    const name = personName(person) || 'Ansprechpartner';
    const initial = text((person.vorname || name || '?')[0].toUpperCase());
    const avatar = person.profile_image_url
      ? `<img src="${text(person.profile_image_url)}" class="table-avatar table-avatar-img" width="24" height="24" alt="" />`
      : `<span class="table-avatar">${initial}</span>`;
    const mail = person.email
      ? `<a href="mailto:${text(person.email)}" class="info-mailto-link">${text(person.email)}</a>`
      : '<span class="betreuung-creator-empty">–</span>';
    const phone = PhoneDisplay.renderClickable(
      person.telefonnummer_land?.iso_code,
      person.telefonnummer_land?.vorwahl,
      person.telefonnummer
    );
    const selected = (links || [])
      .filter((link) => link.ansprechpartner_id === person.id && creatorIds.has(link.creator_id))
      .map((link) => link.creator_id);
    const assignment = options.length
      ? renderFilterSelect({
          id: `betreuung-${person.id}`,
          label: `Creator für ${name}`,
          type: 'multiSelect',
          emptyLabel: 'Creator zuordnen',
          placeholder: 'Creator suchen...',
          searchable: true,
          portal: true
        }, selected, options)
      : '<span class="betreuung-creator-empty">Noch keine Creator zugeordnet</span>';

    return `
      <tr>
        <td class="col-name-with-icon">
          ${avatar}
          <a href="#" class="table-link" data-table="ansprechpartner" data-id="${text(person.id)}">${text(name)}</a>
        </td>
        <td>${mail}</td>
        <td class="ap-col-nowrap">${phone}</td>
        <td class="betreuung-creator-cell" data-betreuung-ap="${text(person.id)}">${assignment}</td>
      </tr>
    `;
  }).join('');

  return `
    ${renderSectionHeader({ title: 'Ansprechpartner', actionsHtml: addButton })}
    <div class="data-table-container betreuung-table-wrap">
      <table class="data-table betreuung-table">
        <colgroup>
          <col class="betreuung-col-name" />
          <col class="betreuung-col-mail" />
          <col class="betreuung-col-phone" />
          <col class="betreuung-col-creators" />
        </colgroup>
        <thead>
          <tr>
            <th>Ansprechpartner</th>
            <th>E-Mail</th>
            <th>Rufnummer</th>
            <th>Betreute Creator</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function openAddAnsprechpartnerDrawer({ creators = [], subtitle = '', onSubmit }) {
  const options = creatorOptions(creators);
  const creatorField = options.length
    ? renderFilterSelect({
        id: 'mgmt-ap-creators',
        label: 'Betreute Creator',
        type: 'multiSelect',
        emptyLabel: 'Creator zuordnen',
        placeholder: 'Creator suchen...',
        searchable: true,
        portal: true
      }, [], options)
    : '<p class="form-hint">Diesem Management sind noch keine Creator zugeordnet.</p>';

  const phone = new PhoneNumberField({
    name: 'telefonnummer',
    nameCountry: 'telefonnummer_land_id',
    label: 'Rufnummer',
    phoneType: 'mobile',
    required: false
  }).render();

  const abort = new AbortController();
  const { panel, close } = openDrawer({
    id: 'mgmt-ap-drawer',
    title: 'Ansprechpartner hinzufügen',
    subtitle: text(subtitle),
    panelClass: 'mgmt-ap-drawer',
    onClose: () => abort.abort(),
    body: `
      <section class="anschreiben-section">
        <h4 class="drawer-section-title">Person</h4>
        <div class="form-row-group">
          <div class="form-field form-field--grow">
            <label class="form-label" for="mgmt-ap-vorname">Vorname</label>
            <input type="text" id="mgmt-ap-vorname" class="form-input" autocomplete="off" />
          </div>
          <div class="form-field form-field--grow">
            <label class="form-label" for="mgmt-ap-nachname">Nachname</label>
            <input type="text" id="mgmt-ap-nachname" class="form-input" autocomplete="off" />
          </div>
        </div>
      </section>
      <section class="anschreiben-section">
        <h4 class="drawer-section-title">Kontakt</h4>
        <div class="form-field">
          <label class="form-label" for="mgmt-ap-email">E-Mail</label>
          <input type="email" id="mgmt-ap-email" class="form-input" autocomplete="off" />
        </div>
        ${phone}
      </section>
      <section class="anschreiben-section">
        <h4 class="drawer-section-title">Betreute Creator</h4>
        ${creatorField}
      </section>
      <p class="form-hint hidden" id="mgmt-ap-hint"></p>
    `
  });

  const footer = document.createElement('div');
  footer.className = 'drawer-footer';
  footer.innerHTML = `
    <button type="button" class="mdc-btn mdc-btn--secondary" data-close-drawer>
      <span class="mdc-btn__label">Abbrechen</span>
    </button>
    <button type="button" class="mdc-btn" id="mgmt-ap-save">
      <span class="mdc-btn__label">Hinzufügen</span>
    </button>
  `;
  panel.appendChild(footer);
  footer.querySelector('[data-close-drawer]').addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.defaultPrevented) close();
  }, { signal: abort.signal });

  bindFilterSelects(panel, { signal: abort.signal });
  window.formSystem?.dataLoader?.loadPhoneFieldCountries(panel);

  const save = panel.querySelector('#mgmt-ap-save');
  save.addEventListener('click', async () => {
    const hint = panel.querySelector('#mgmt-ap-hint');
    const select = panel.querySelector('#filter-select-mgmt-ap-creators');
    save.disabled = true;
    const result = await onSubmit({
      vorname: panel.querySelector('#mgmt-ap-vorname').value,
      nachname: panel.querySelector('#mgmt-ap-nachname').value,
      email: panel.querySelector('#mgmt-ap-email').value,
      telefonnummer: panel.querySelector('#field-telefonnummer')?.value,
      telefonnummer_land_id: panel.querySelector('#field-telefonnummer_land_id')?.value,
      creatorIds: select ? readFilterSelectValues(select) : []
    });
    if (!panel.isConnected) return;
    if (!result?.ok) {
      hint.textContent = result?.message || 'Speichern fehlgeschlagen';
      hint.classList.remove('hidden');
      save.disabled = false;
      return;
    }
    close();
  });

  panel.querySelector('#mgmt-ap-vorname')?.focus();
  return panel;
}
