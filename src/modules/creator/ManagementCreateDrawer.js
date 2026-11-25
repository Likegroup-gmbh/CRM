import { icon } from '../../core/icons/IconSystem.js';
import { normalizeUrl } from '../../core/UrlHelper.js';
import { DRAWER_EXIT_MS } from '../../core/animation/drawer.js';
import { managementConfig } from '../../core/form/config/ManagementFormConfig.js';
import { normalizeFirmenname } from './creatorProfil.js';
import {
  bindManagementPersonRows,
  renderManagementPersonRows,
  saveManagementPersons,
  toggleBetreuung
} from '../ansprechpartner/betreuung.js';

// Drawer zum Anlegen eines Managements aus dem Creator-Formular.
// Felder wie das Management-Formular; die Zuordnung läuft über den Creator.
// Ansprechpartner im Drawer werden danach in der Betreuung des Creators auswählbar.

const SKIP_FIELDS = new Set(['creator_ids']);

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function trim(value) {
  return String(value ?? '').trim();
}

export function unmatchedManagementQuery(formField) {
  const typed = trim(formField?.querySelector('.searchable-select-input')?.value);
  if (typed.length < 2) return '';
  let options = [];
  try {
    options = JSON.parse(formField.querySelector('.tag-based-select')?.dataset.options || '[]');
  } catch (_) {
    options = [];
  }
  const known = options.some((option) => normalizeFirmenname(option.label) === normalizeFirmenname(typed));
  return known ? '' : typed;
}

export function buildManagementRecord(input) {
  const firmenname = trim(input.firmenname);
  if (firmenname.length < 2) {
    return { error: 'Bitte einen Firmennamen (mind. 2 Zeichen) angeben.' };
  }

  const data = { firmenname };
  for (const field of managementConfig.fields) {
    if (SKIP_FIELDS.has(field.name) || field.name === 'firmenname') continue;
    let value = trim(input[field.name]);
    if (field.name === 'land' && !value) value = 'Deutschland';
    if (field.type === 'url' && value) {
      const url = normalizeUrl(value);
      if (!url) return { error: `${field.label} ist keine gültige Webseite.` };
      value = url;
    }
    if (value) data[field.name] = value;
  }
  return { data };
}

function renderField(field, value) {
  const id = `mgmt_${field.name}`;
  const placeholder = field.placeholder ? ` placeholder="${escapeAttr(field.placeholder)}"` : '';
  const required = field.required ? ' required' : '';
  const control = field.type === 'textarea'
    ? `<textarea id="${id}" name="${field.name}" class="form-input drawer-form-input" rows="3">${escapeAttr(value)}</textarea>`
    : `<input type="${field.type === 'url' ? 'text' : field.type}" id="${id}" name="${field.name}" class="form-input drawer-form-input" value="${escapeAttr(value)}"${placeholder}${required} />`;
  return `
    <div class="form-field">
      <label for="${id}" class="drawer-form-label">${escapeAttr(field.label)}${field.required ? ' *' : ''}</label>
      ${control}
    </div>
  `;
}

export function renderManagementFields(initialName = '') {
  const fields = managementConfig.fields.filter((field) => !SKIP_FIELDS.has(field.name));
  const sections = [];
  for (const field of fields) {
    let section = sections.find((item) => item.id === (field.section || ''));
    if (!section) {
      section = { id: field.section || '', title: field.sectionTitle || '', rows: [] };
      sections.push(section);
    }
    if (!section.title && field.sectionTitle) section.title = field.sectionTitle;
    const rowKey = field.row || field.name;
    let row = section.rows.find((item) => item.key === rowKey);
    if (!row) {
      row = { key: rowKey, fields: [] };
      section.rows.push(row);
    }
    row.fields.push(field);
  }

  return sections.map((section) => `
    <div class="form-section">
      ${section.title ? `<h3 class="drawer-section-title">${escapeAttr(section.title)}</h3>` : ''}
      ${section.rows.map((row) => {
        const cells = row.fields.map((field) => renderField(
          field,
          field.name === 'firmenname' ? initialName : (field.name === 'land' ? 'Deutschland' : '')
        )).join('');
        return row.fields.length > 1 ? `<div class="drawer-form-grid">${cells}</div>` : cells;
      }).join('')}
    </div>
  `).join('');
}

function addTag(select, item) {
  const formField = select.closest('.form-field');
  const container = formField?.querySelector('.tag-based-select');
  const tagsContainer = container?.querySelector('.tags-container');
  const hiddenSelect = document.getElementById(`${select.id}_hidden`);

  const addSelectedOption = (target) => {
    if (!target || target.querySelector(`option[value="${item.id}"]`)) return;
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.label;
    option.selected = true;
    target.appendChild(option);
  };
  addSelectedOption(hiddenSelect);
  addSelectedOption(select);

  if (container) {
    try {
      const options = JSON.parse(container.dataset.options || '[]');
      if (!options.some((option) => option.value === item.id)) {
        options.push({ value: item.id, label: item.label });
        container.dataset.options = JSON.stringify(options);
      }
    } catch (_) { /* Suchliste bleibt unverändert */ }
  }

  if (!tagsContainer || tagsContainer.querySelector(`.tag[data-value="${item.id}"]`)) {
    hiddenSelect?.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  tagsContainer.querySelector('.tags-placeholder')?.remove();
  tagsContainer.classList.remove('tags-container--empty');

  const tag = document.createElement('div');
  tag.className = 'tag';
  tag.dataset.value = item.id;
  const text = document.createElement('span');
  text.textContent = item.label;
  const remove = document.createElement('span');
  remove.className = 'tag-remove';
  remove.textContent = '×';
  remove.addEventListener('click', () => {
    tag.remove();
    hiddenSelect?.querySelector(`option[value="${item.id}"]`)?.remove();
    select.querySelector(`option[value="${item.id}"]`)?.remove();
    hiddenSelect?.dispatchEvent(new Event('change', { bubbles: true }));
  });
  tag.append(text, remove);
  tagsContainer.appendChild(tag);
  hiddenSelect?.dispatchEvent(new Event('change', { bubbles: true }));
}

function checkNewPersons(form, personIds) {
  for (const id of personIds) {
    const box = form.querySelector(`.creator-ap-check[value="${CSS.escape(id)}"]`);
    if (box) box.checked = true;
  }
}

export class ManagementCreateDrawer {
  constructor() {
    this.drawerId = 'management-create-drawer';
    this.creatorId = null;
    this.initialName = '';
    this.onCreated = null;
  }

  open(options = {}) {
    this.creatorId = options.creatorId || null;
    this.initialName = trim(options.initialName);
    this.onCreated = options.onCreated || null;
    this.createDrawer();
    this.renderForm();
    this.bindFormEvents();
  }

  createDrawer() {
    this.removeDrawer();

    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.id = `${this.drawerId}-overlay`;
    overlay.style.zIndex = '1800';

    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.className = 'drawer-panel drawer-panel--wide';
    panel.id = this.drawerId;
    panel.style.zIndex = '1900';

    const header = document.createElement('div');
    header.className = 'drawer-header';
    const headerLeft = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'drawer-title';
    title.textContent = 'Neues Management anlegen';
    const subtitle = document.createElement('p');
    subtitle.className = 'drawer-subtitle';
    subtitle.textContent = 'Management anlegen und diesem Creator zuordnen';
    headerLeft.append(title, subtitle);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close-btn';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Schließen');
    closeBtn.innerHTML = '&times;';
    header.append(headerLeft, closeBtn);

    const body = document.createElement('div');
    body.className = 'drawer-body';
    body.id = `${this.drawerId}-body`;
    panel.append(header, body);

    overlay.addEventListener('click', () => this.close());
    closeBtn.addEventListener('click', () => this.close());
    document.body.append(overlay, panel);
    requestAnimationFrame(() => panel.classList.add('show'));
  }

  renderForm() {
    const body = document.getElementById(`${this.drawerId}-body`);
    if (!body) return;
    body.innerHTML = `
      <form id="management-create-form" class="drawer-form" novalidate>
        <div id="management-create-error" class="form-hint form-hint--error" hidden></div>
        ${renderManagementFields(this.initialName)}
        ${renderManagementPersonRows()}
        <div class="drawer-actions">
          <button type="button" id="management-create-cancel" class="mdc-btn mdc-btn--cancel">
            <span class="mdc-btn__label">Abbrechen</span>
          </button>
          <button type="submit" class="mdc-btn mdc-btn--create">
            <span class="mdc-btn__icon mdc-btn__icon--check" aria-hidden="true">${icon('check-filled')}</span>
            <span class="mdc-btn__spinner" aria-hidden="true">
              <svg class="mdc-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="16" height="16">
                <circle class="mdc-spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="5"/>
              </svg>
            </span>
            <span class="mdc-btn__label">Speichern</span>
          </button>
        </div>
      </form>
    `;
    bindManagementPersonRows(body);
    setTimeout(() => document.getElementById('mgmt_firmenname')?.focus(), 100);
  }

  bindFormEvents() {
    document.getElementById('management-create-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await this.handleSubmit(new FormData(event.currentTarget));
    });
    document.getElementById('management-create-cancel')?.addEventListener('click', () => this.close());
  }

  showError(message) {
    const error = document.getElementById('management-create-error');
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
  }

  async handleSubmit(formData) {
    const submitBtn = document.querySelector(`#${this.drawerId} button[type="submit"]`);
    const management = buildManagementRecord(Object.fromEntries(formData.entries()));
    if (management.error) {
      this.showError(management.error);
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');
    }

    try {
      const saved = await this._saveManagement(management.data);
      const form = document.getElementById('management-create-form');
      const personIds = await saveManagementPersons(saved.id, form);
      if (this.creatorId) {
        await this._linkManagement(saved.id);
        for (const personId of personIds) {
          await toggleBetreuung(this.creatorId, personId, true);
        }
      } else {
        const creatorForm = document.getElementById('creator-form');
        const select = creatorForm?.querySelector('select[name="management_ids"]');
        if (select) addTag(select, { id: saved.id, label: saved.firmenname });
        if (creatorForm && typeof creatorForm._refreshBetreuung === 'function') {
          await creatorForm._refreshBetreuung();
        }
        if (creatorForm) checkNewPersons(creatorForm, personIds);
      }

      if (saved.created) {
        window.toastSystem?.success?.(`Management "${saved.firmenname}" angelegt!`);
      }
      if (this.onCreated) await this.onCreated(saved);
      this.close();
    } catch (error) {
      console.error('ManagementCreateDrawer: Fehler beim Anlegen:', error);
      this.showError(error.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
      }
    }
  }

  async _saveManagement(data) {
    const { data: existing, error: lookupError } = await window.supabase
      .from('management')
      .select('id, firmenname');
    if (lookupError) throw lookupError;
    const match = (existing || []).find((item) => normalizeFirmenname(item.firmenname) === normalizeFirmenname(data.firmenname));
    if (match) {
      window.toastSystem?.show?.(`${match.firmenname} gibt es schon und ist ausgewählt.`, 'info');
      return { ...match, created: false };
    }

    const result = await window.dataService.createEntity('management', data);
    if (!result?.success) throw new Error(result?.error || 'Management konnte nicht angelegt werden');
    window.duplicateChecker?.clearCache?.('management');
    return { id: result.id, ...data, ...(result.data || {}), created: true };
  }

  async _linkManagement(managementId) {
    const { data: existing, error: readError } = await window.supabase
      .from('creator_management')
      .select('id')
      .eq('creator_id', this.creatorId)
      .eq('management_id', managementId)
      .maybeSingle();
    if (readError) throw readError;
    const write = existing
      ? window.supabase.from('creator_management').update({ ist_aktiv: true, updated_at: new Date().toISOString() }).eq('id', existing.id)
      : window.supabase.from('creator_management').insert([{ creator_id: this.creatorId, management_id: managementId, ist_aktiv: true }]);
    const { error } = await write;
    if (error) throw new Error('Management angelegt, aber Zuordnung fehlgeschlagen: ' + error.message);
  }

  close() {
    const panel = document.getElementById(this.drawerId);
    if (!panel) {
      this.removeDrawer();
      return;
    }
    panel.classList.remove('show');
    setTimeout(() => this.removeDrawer(), DRAWER_EXIT_MS);
  }

  removeDrawer() {
    document.getElementById(this.drawerId)?.remove();
    document.getElementById(`${this.drawerId}-overlay`)?.remove();
  }
}

export const managementCreateDrawer = new ManagementCreateDrawer();

export function injectManagementCreateButton() {
  const form = document.getElementById('creator-form');
  const select = form?.querySelector('select[name="management_ids"]');
  if (!select) return;

  const formField = select.closest('.form-field');
  if (!formField || formField.querySelector('.btn-add-management-inline')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary-btn btn-sm btn-add-management-inline';
  button.style.marginTop = '6px';
  button.textContent = '+ Neues Management anlegen';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    managementCreateDrawer.open({
      initialName: unmatchedManagementQuery(formField)
    });
  });
  formField.appendChild(button);
}
