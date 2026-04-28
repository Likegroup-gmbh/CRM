// AgencyServicesBlock.js
// Render + Interaktion fuer den Agenturleistungen-Block in Step 2.
// Kapselt: Toggle, Retainer, Zusatzleistungen, Agentur Fee, KSK.

import { RETAINER_TYPES } from '../constants.js';

export class AgencyServicesBlock {
  constructor({ hostId, data, onChange }) {
    this.hostId = hostId;
    this.data = this.normalize(data);
    this.onChange = onChange || (() => {});
  }

  normalize(d) {
    const extraServices = Array.isArray(d.extra_services) ? d.extra_services.slice() : [];
    return {
      agency_services_enabled: !!d.agency_services_enabled,
      retainer_type: d.retainer_type || 'none',
      retainer_amount: d.retainer_amount ?? 0,
      extra_services_enabled: d.extra_services_enabled != null ? !!d.extra_services_enabled : extraServices.length > 0,
      extra_services: extraServices,
      percentage_fee_enabled: !!d.percentage_fee_enabled,
      percentage_fee_value: d.percentage_fee_value ?? 0,
      percentage_fee_base: d.percentage_fee_base || 'total_budget',
      ksk_enabled: !!d.ksk_enabled,
      ksk_type: 'fixed',
      ksk_value: d.ksk_value ?? 0
    };
  }

  render() {
    const host = document.getElementById(this.hostId);
    if (!host) return;

    const d = this.data;

    host.innerHTML = `
      <div class="form-section">
        <div class="projekt-erstellen-agency-header">
          <div class="projekt-erstellen-agency-toggle-label">Agenturleistungen aktivieren</div>
          <label class="toggle-switch">
            <input type="checkbox" id="field-pe-agency_services_enabled" ${d.agency_services_enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div id="pe-agency-body" style="${d.agency_services_enabled ? '' : 'display:none;'}">
          ${this.renderRetainer()}
          ${this.renderExtras()}
          ${this.renderPercentage()}
          ${this.renderKsk()}
        </div>
      </div>
    `;

    this.bind();
  }

  renderRetainer() {
    const d = this.data;
    return `
      <div class="projekt-erstellen-subsection">
        <h5 class="section-subtitle">Retainer</h5>
        <div class="form-two-col">
          <div class="form-field form-field--half">
            <label for="field-pe-retainer_type">Retainer-Typ</label>
            <select id="field-pe-retainer_type" name="retainer_type">
              ${RETAINER_TYPES.map(r => `<option value="${r.value}" ${d.retainer_type === r.value ? 'selected' : ''}>${r.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-field form-field--half" id="pe-retainer-amount-field" style="${d.retainer_type !== 'none' ? '' : 'display:none;'}">
            <label for="field-pe-retainer_amount">Betrag (€ / Monat)</label>
            <input type="number" id="field-pe-retainer_amount" name="retainer_amount" step="0.01" min="0" value="${d.retainer_amount || ''}">
          </div>
        </div>
      </div>
    `;
  }

  renderExtras() {
    const d = this.data;
    const rows = (d.extra_services || []).map((ex, idx) => this.renderExtraRow(ex, idx)).join('');
    return `
      <div class="projekt-erstellen-subsection">
        <div class="projekt-erstellen-subsection-header">
          <h5 class="section-subtitle">Zusatzleistungen</h5>
          <label class="toggle-switch">
            <input type="checkbox" id="field-pe-extra_services_enabled" ${d.extra_services_enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div id="pe-extras-body" style="${d.extra_services_enabled ? '' : 'display:none;'}">
          <div class="projekt-erstellen-extras-toolbar">
            <button type="button" class="secondary-btn" id="pe-extra-add-btn">+ Leistung hinzufügen</button>
          </div>
          <div id="pe-extra-list">
            ${rows || '<small class="projekt-erstellen-empty-note">Noch keine Zusatzleistung angelegt.</small>'}
          </div>
        </div>
      </div>
    `;
  }

  renderExtraRow(ex, idx) {
    const name = this.escape(ex?.name ?? '');
    const amount = ex?.amount ?? '';
    return `
      <div class="projekt-erstellen-extra-row" data-extra-idx="${idx}">
        <div class="form-field">
          <label>Leistung</label>
          <input type="text" data-extra-field="name" value="${name}" placeholder="z.B. Grafikdesign">
        </div>
        <div class="form-field">
          <label>Betrag (€)</label>
          <input type="number" data-extra-field="amount" step="0.01" min="0" value="${amount}">
        </div>
        <button type="button" class="projekt-erstellen-remove-btn" data-extra-remove="${idx}" title="Entfernen">✕</button>
      </div>
    `;
  }

  renderPercentage() {
    const d = this.data;
    return `
      <div class="projekt-erstellen-subsection">
        <div class="projekt-erstellen-subsection-header">
          <h5 class="section-subtitle">Agentur Fee</h5>
          <label class="toggle-switch">
            <input type="checkbox" id="field-pe-percentage_fee_enabled" ${d.percentage_fee_enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div id="pe-percentage-body" style="${d.percentage_fee_enabled ? '' : 'display:none;'}">
          <div class="form-field">
            <label for="field-pe-percentage_fee_value">Betrag (€)</label>
            <input type="number" id="field-pe-percentage_fee_value" step="0.01" min="0" value="${d.percentage_fee_value || ''}">
          </div>
        </div>
      </div>
    `;
  }

  renderKsk() {
    const d = this.data;
    return `
      <div class="projekt-erstellen-subsection">
        <div class="projekt-erstellen-subsection-header">
          <h5 class="section-subtitle">KSK (Künstlersozialkasse)</h5>
          <label class="toggle-switch">
            <input type="checkbox" id="field-pe-ksk_enabled" ${d.ksk_enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div id="pe-ksk-body" style="${d.ksk_enabled ? '' : 'display:none;'}">
          <div class="form-field">
            <label for="field-pe-ksk_value">Betrag (€)</label>
            <input type="number" id="field-pe-ksk_value" step="0.01" min="0" value="${d.ksk_value || ''}">
          </div>
        </div>
      </div>
    `;
  }

  bind() {
    const toggle = document.getElementById('field-pe-agency_services_enabled');
    const body = document.getElementById('pe-agency-body');

    toggle?.addEventListener('change', (e) => {
      this.data.agency_services_enabled = !!e.target.checked;
      if (body) body.style.display = e.target.checked ? '' : 'none';
      this.emit();
    });

    const retainerType = document.getElementById('field-pe-retainer_type');
    const retainerAmountField = document.getElementById('pe-retainer-amount-field');
    const retainerAmount = document.getElementById('field-pe-retainer_amount');

    retainerType?.addEventListener('change', (e) => {
      this.data.retainer_type = e.target.value || 'none';
      if (retainerAmountField) retainerAmountField.style.display = this.data.retainer_type !== 'none' ? '' : 'none';
      this.emit();
    });
    retainerAmount?.addEventListener('input', (e) => {
      this.data.retainer_amount = parseFloat(e.target.value) || 0;
      this.emit();
    });

    const extrasToggle = document.getElementById('field-pe-extra_services_enabled');
    const extrasBody = document.getElementById('pe-extras-body');
    extrasToggle?.addEventListener('change', (e) => {
      this.data.extra_services_enabled = !!e.target.checked;
      if (extrasBody) extrasBody.style.display = e.target.checked ? '' : 'none';
      this.emit();
    });

    document.getElementById('pe-extra-add-btn')?.addEventListener('click', () => {
      this.data.extra_services.push({ name: '', amount: 0 });
      this.rerenderExtras();
      this.emit();
    });

    const extraList = document.getElementById('pe-extra-list');
    extraList?.addEventListener('input', (e) => {
      const row = e.target.closest('[data-extra-idx]');
      if (!row) return;
      const idx = parseInt(row.dataset.extraIdx, 10);
      const field = e.target.dataset.extraField;
      if (Number.isNaN(idx) || !field) return;
      const item = this.data.extra_services[idx];
      if (!item) return;
      if (field === 'name') item.name = e.target.value;
      if (field === 'amount') item.amount = parseFloat(e.target.value) || 0;
      this.emit();
    });
    extraList?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-extra-remove]');
      if (!btn) return;
      const idx = parseInt(btn.dataset.extraRemove, 10);
      if (Number.isNaN(idx)) return;
      this.data.extra_services.splice(idx, 1);
      this.rerenderExtras();
      this.emit();
    });

    const pctToggle = document.getElementById('field-pe-percentage_fee_enabled');
    const pctBody = document.getElementById('pe-percentage-body');
    pctToggle?.addEventListener('change', (e) => {
      this.data.percentage_fee_enabled = !!e.target.checked;
      if (pctBody) pctBody.style.display = e.target.checked ? '' : 'none';
      this.emit();
    });
    document.getElementById('field-pe-percentage_fee_value')?.addEventListener('input', (e) => {
      this.data.percentage_fee_value = parseFloat(e.target.value) || 0;
      this.emit();
    });

    const kskToggle = document.getElementById('field-pe-ksk_enabled');
    const kskBody = document.getElementById('pe-ksk-body');
    kskToggle?.addEventListener('change', (e) => {
      this.data.ksk_enabled = !!e.target.checked;
      this.data.ksk_type = 'fixed';
      if (!e.target.checked) this.data.ksk_value = 0;
      if (kskBody) kskBody.style.display = e.target.checked ? '' : 'none';
      this.emit();
    });
    document.getElementById('field-pe-ksk_value')?.addEventListener('input', (e) => {
      this.data.ksk_value = parseFloat(e.target.value) || 0;
      this.data.ksk_type = 'fixed';
      this.emit();
    });
  }

  rerenderExtras() {
    const list = document.getElementById('pe-extra-list');
    if (!list) return;
    if (this.data.extra_services.length === 0) {
      list.innerHTML = '<small class="projekt-erstellen-empty-note">Noch keine Zusatzleistung angelegt.</small>';
    } else {
      list.innerHTML = this.data.extra_services.map((ex, idx) => this.renderExtraRow(ex, idx)).join('');
    }
  }

  escape(v) {
    if (v == null) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  emit() {
    this.onChange(this.getValue());
  }

  getValue() {
    return { ...this.data, extra_services: this.data.extra_services.slice() };
  }
}
