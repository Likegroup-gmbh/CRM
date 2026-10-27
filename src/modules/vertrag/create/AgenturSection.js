// AgenturSection.js
// Management-Vertretung in UGC-, Influencer- und Contracting-Verträgen.
// Das Management kommt aus den Stammdaten. Vertreten durch ist ein Ansprechpartner.

import { VertraegeCreate } from './VertraegeCreateCore.js';
import { icon } from '../../../core/icons/IconSystem.js';
import {
  addressComplete,
  legacyFreitextName,
  personLabel
} from './managementVertretung.js';

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function addressFields(address) {
  return `
    <div class="form-two-col">
      <div class="form-field">
        <label for="vertrag_mgmt_strasse">Straße</label>
        <input type="text" id="vertrag_mgmt_strasse" name="influencer_agentur_strasse" value="${escapeAttr(address.strasse || '')}">
      </div>
      <div class="form-field">
        <label for="vertrag_mgmt_hausnummer">Nr.</label>
        <input type="text" id="vertrag_mgmt_hausnummer" name="influencer_agentur_hausnummer" value="${escapeAttr(address.hausnummer || '')}">
      </div>
    </div>
    <div class="form-two-col">
      <div class="form-field">
        <label for="vertrag_mgmt_plz">PLZ</label>
        <input type="text" id="vertrag_mgmt_plz" name="influencer_agentur_plz" value="${escapeAttr(address.plz || '')}">
      </div>
      <div class="form-field">
        <label for="vertrag_mgmt_stadt">Stadt</label>
        <input type="text" id="vertrag_mgmt_stadt" name="influencer_agentur_stadt" value="${escapeAttr(address.stadt || '')}">
      </div>
    </div>
    <div class="form-field">
      <label for="vertrag_mgmt_land">Land</label>
      <input type="text" id="vertrag_mgmt_land" name="influencer_agentur_land" value="${escapeAttr(address.land || 'Deutschland')}">
    </div>
  `;
}

VertraegeCreate.prototype.renderAgenturSection = function() {
  const managements = this.alleManagements || [];
  const selectedId = this.formData._management_id || '';
  const selected = managements.find((item) => item.id === selectedId) || null;
  const creating = !!this.formData._management_anlegen;
  const legacy = legacyFreitextName(this.formData);
  const options = [
    `<option value="">Kein Management</option>`,
    ...managements.map((item) => (
      `<option value="${escapeAttr(item.id)}" ${item.id === selectedId ? 'selected' : ''}>${escapeAttr(item.firmenname || '—')}</option>`
    ))
  ].join('');
  const people = this.vertretungPersonen || [];
  const personOptions = [
    `<option value="">Ansprechpartner wählen</option>`,
    ...people.map((person) => (
      `<option value="${escapeAttr(person.id)}" ${person.id === this.formData._ansprechpartner_id ? 'selected' : ''}>${escapeAttr(personLabel(person))}</option>`
    ))
  ].join('');
  const selectedPerson = people.find((person) => person.id === this.formData._ansprechpartner_id) || null;
  const needsEmail = !!(selectedPerson && !String(selectedPerson.email || '').trim());
  const needsAddress = !!(selected && !addressComplete(selected));
  const address = selected || {};
  const draftAddress = { strasse: '', hausnummer: '', plz: '', stadt: '', land: 'Deutschland' };

  return `
    <div id="agentur-section-container" class="step-section">
      <div class="step-section__header">
        <h3>Management-Vertretung</h3>
      </div>

      ${legacy ? `<p class="form-hint">Bisher als Freitext eingetragen: ${escapeAttr(legacy)}. Bitte ein Management aus den Stammdaten wählen oder neu anlegen.</p>` : ''}

      <div class="form-field">
        <label for="vertrag_management_select">Management</label>
        <select id="vertrag_management_select" name="vertrag_management_select" data-searchable="true">
          ${options}
        </select>
      </div>

      ${creating ? `
        <div class="form-field">
          <label for="vertrag_mgmt_name">Name</label>
          <input type="text" id="vertrag_mgmt_name" value="${escapeAttr(this.formData._neues_management_name || '')}" placeholder="Name des Managements">
          <p class="form-hint hidden" id="vertretung-name-hinweis"></p>
        </div>
        ${addressFields(draftAddress)}
      ` : `
        <div>
          <button type="button" class="btn-inline-action" id="vertrag-management-anlegen">
            ${icon('plus')}
            <span>Management anlegen</span>
          </button>
        </div>
      `}

      ${!creating && selected ? `
        ${addressComplete(selected) ? `<p class="form-hint">${escapeAttr(selected.firmenname || '')} · ${escapeAttr(`${selected.strasse || ''} ${selected.hausnummer || ''}, ${selected.plz || ''} ${selected.stadt || ''}`.replace(/\s+/g, ' ').trim())}</p>` : addressFields(address)}

        <div class="form-field">
          <label for="vertretung_ansprechpartner">Vertreten durch</label>
          <select id="vertretung_ansprechpartner" name="vertretung_ansprechpartner" data-searchable="true">
            ${personOptions}
          </select>
        </div>
        ${needsEmail ? `
          <div class="form-field">
            <label for="vertretung_email_nachtrag">E-Mail</label>
            <input type="email" id="vertretung_email_nachtrag" name="vertretung_email_nachtrag" value="${escapeAttr(this.formData.vertretung_email_nachtrag || '')}" placeholder="E-Mail nachtragen">
          </div>
        ` : ''}

        <p class="form-hint">Oder neu anlegen</p>
        <div class="form-two-col">
          <div class="form-field">
            <label for="vertretung_vorname">Vorname</label>
            <input type="text" id="vertretung_vorname" name="_vertretung_vorname" value="${escapeAttr(this.formData._vertretung_vorname || '')}">
          </div>
          <div class="form-field">
            <label for="vertretung_nachname">Nachname</label>
            <input type="text" id="vertretung_nachname" name="_vertretung_nachname" value="${escapeAttr(this.formData._vertretung_nachname || '')}">
          </div>
        </div>
        <div class="form-two-col">
          <div class="form-field">
            <label for="vertretung_email">E-Mail</label>
            <input type="email" id="vertretung_email" name="_vertretung_email" value="${escapeAttr(this.formData._vertretung_email || '')}">
          </div>
          <div class="form-field">
            <label for="vertretung_telefon">Mobilnummer</label>
            <input type="tel" id="vertretung_telefon" name="_vertretung_telefon" value="${escapeAttr(this.formData._vertretung_telefon || '')}">
          </div>
        </div>
      ` : ''}

      <p class="form-hint form-hint--error hidden" id="vertretung-luecken"></p>
    </div>
  `;
};

VertraegeCreate.prototype.refreshAgenturSection = function() {
  const container = document.getElementById('agentur-section-container');
  if (!container) return;
  const fresh = this.renderAgenturSection();
  const wrapper = document.createElement('div');
  wrapper.innerHTML = fresh;
  const next = wrapper.querySelector('#agentur-section-container');
  if (!next) return;
  container.replaceWith(next);
  this._bindAgenturEvents();
};

VertraegeCreate.prototype._bindSearchable = function(select, options, placeholder) {
  if (!select || !window.formSystem?.createSearchableSelect) return;
  window.formSystem.createSearchableSelect(select, options, {
    name: select.name,
    placeholder
  });
};

VertraegeCreate.prototype._bindAgenturEvents = function() {
  const select = document.getElementById('vertrag_management_select');
  if (select) {
    const options = [
      { value: '', label: 'Kein Management' },
      ...(this.alleManagements || []).map((item) => ({ value: item.id, label: item.firmenname || '—' }))
    ];
    this._bindSearchable(select, options, 'Management suchen...');
    if (this.formData._management_id && typeof this.setSearchableSelectValue === 'function') {
      this.setSearchableSelectValue('vertrag_management_select', this.formData._management_id, options);
    }
    select.addEventListener('change', (event) => {
      this.formData._management_anlegen = false;
      this.selectVertragManagement(event.target.value);
    });
  }

  const personSelect = document.getElementById('vertretung_ansprechpartner');
  if (personSelect) {
    const people = this.vertretungPersonen || [];
    const personOptions = [
      { value: '', label: 'Ansprechpartner wählen' },
      ...people.map((person) => ({ value: person.id, label: personLabel(person) }))
    ];
    this._bindSearchable(personSelect, personOptions, 'Ansprechpartner wählen');
    if (this.formData._ansprechpartner_id && typeof this.setSearchableSelectValue === 'function') {
      this.setSearchableSelectValue('vertretung_ansprechpartner', this.formData._ansprechpartner_id, personOptions);
    }
    personSelect.addEventListener('change', (event) => {
      this.formData._ansprechpartner_id = event.target.value || null;
      this.formData._vertretung_vorname = '';
      this.formData._vertretung_nachname = '';
      this.formData._vertretung_email = '';
      this.formData._vertretung_telefon = '';
      this.refreshAgenturSection();
    });
  }

  document.getElementById('vertrag-management-anlegen')?.addEventListener('click', () => {
    this.openVertragManagementForm();
  });

  document.getElementById('vertrag_mgmt_name')?.addEventListener('input', (event) => {
    this.formData._neues_management_name = event.target.value;
  });
  document.getElementById('vertrag_mgmt_name')?.addEventListener('change', () => {
    this.createVertragManagementFromForm();
  });

  ['vertrag_mgmt_strasse', 'vertrag_mgmt_hausnummer', 'vertrag_mgmt_plz', 'vertrag_mgmt_stadt', 'vertrag_mgmt_land']
    .forEach((id) => {
      document.getElementById(id)?.addEventListener('change', async () => {
        await this.saveVertretungAddress();
        if (!this.formData._management_anlegen && addressComplete(this._selectedManagement())) {
          this.refreshAgenturSection();
        }
      });
    });

  document.getElementById('vertretung_email_nachtrag')?.addEventListener('change', () => {
    this.saveVertretungEmail().then(() => this.refreshAgenturSection());
  });

  ['vertretung_vorname', 'vertretung_nachname', 'vertretung_email', 'vertretung_telefon'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', (event) => {
      this.formData[`_${id}`] = event.target.value;
      if (String(event.target.value || '').trim()) {
        this.formData._ansprechpartner_id = null;
        const node = document.getElementById('vertretung_ansprechpartner');
        if (node) node.value = '';
      }
    });
  });

  if (this._pendingVertretungGaps?.length) {
    this.showVertretungLuecken(this._pendingVertretungGaps);
    this._pendingVertretungGaps = null;
  }
};
