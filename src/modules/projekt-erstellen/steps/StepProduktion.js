// Schritt Produktion: Anzahl und Budgets von Hand, Decke ist das Volumen der Kampagne.
// Jede Zeile wird beim Speichern eine Produktion, auch ohne Budget (ADR 0045).
// Gespeicherte Zeilen bleiben: die Anzahl lässt sich nur erhöhen.

import { icon } from '../../../core/icons/IconSystem.js';
import { parseCurrencyInput } from '../../../core/utils/parseCurrency.js';
import { bindMoneyInputs, renderMoneyInput } from '../../../core/form/moneyInput.js';
import {
  budgetOrNull,
  roundMoney,
  sumBudgets
} from '../../produktion/produktionsbudget.js';
import { geistProduktionName } from '../../produktion/produktionNames.js';
import { kampagneDisplayName } from '../logic/kampagnenSplit.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function formatMoney(value) {
  return roundMoney(value).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function nextKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class StepProduktion {
  constructor(wizard) {
    this.wizard = wizard;
    this.host = null;
  }

  render(host) {
    this.host = host;
    const groups = this._groups();
    host.innerHTML = `
      <div class="form-section projekt-erstellen-section-stack">
        ${groups.map(group => this._renderGroup(group)).join('')}
      </div>
    `;
  }

  _groups() {
    const slots = Array.isArray(this.wizard.formData.kampagnen) && this.wizard.formData.kampagnen.length
      ? this.wizard.formData.kampagnen
      : [{ kampagnen_nummer: 1, volumen: this.wizard.formData.auftrag?.nettobetrag || 0 }];
    const rows = Array.isArray(this.wizard.formData.produktionen)
      ? this.wizard.formData.produktionen
      : [];

    return slots.map((slot, index) => {
      const nummer = slot.kampagnen_nummer || index + 1;
      const own = rows.filter(row => {
        if (row.kampagne_id && slot.id) return row.kampagne_id === slot.id;
        return (row.kampagnen_nummer || 1) === nummer;
      });
      return {
        nummer,
        id: slot.id || null,
        basis: kampagneDisplayName(this.wizard.formData.auftrag?.titel, index, slots.length) || '',
        name: slot.eigener_name || slot.kampagnenname || (slots.length > 1 ? `Kampagne ${nummer}` : ''),
        volumen: budgetOrNull(slot.volumen) || 0,
        rows: own
      };
    });
  }

  _renderGroup(group) {
    const summe = sumBudgets(group.rows);
    const rest = roundMoney(group.volumen - summe);
    const title = group.name
      ? `<h3 class="form-section-title">${escapeHtml(group.name)}</h3>`
      : '';

    return `
      <div class="projekt-erstellen-subsection" data-kampagne-nummer="${group.nummer}" data-kampagne-id="${escapeHtml(group.id || '')}" data-basis="${escapeHtml(group.basis || '')}">
        ${title}
        <p class="projekt-erstellen-umsatz-hint" data-prod-hint>
          ${formatMoney(summe)} von ${formatMoney(group.volumen)} vergeben, Rest ${formatMoney(rest)}
        </p>
        <div class="data-table-container projekt-erstellen-prod-table-wrap">
          <table class="data-table projekt-erstellen-prod-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Produktionsbudget</th>
                <th class="col-actions"></th>
              </tr>
            </thead>
            <tbody data-prod-rows>
              ${group.rows.map(row => this._renderRow(row, group)).join('')}
            </tbody>
          </table>
        </div>
        <button type="button" class="mdc-btn mdc-btn--secondary" data-prod-add>
          ${icon('plus')} Produktion hinzufügen
        </button>
      </div>
    `;
  }

  _renderRow(row, group) {
    const key = row.id || row._key;
    const saved = !!row.id;
    const budget = budgetOrNull(row.budget);
    return `
      <tr data-prod-row data-key="${escapeHtml(key)}" data-id="${escapeHtml(row.id || '')}" >
        <td>
          <input type="text" class="cell-input" data-prod-name value="${escapeHtml(row.name || '')}">
        </td>
        <td>
          ${renderMoneyInput({ value: budget, attrs: { 'data-prod-budget': true } })}
        </td>
        <td class="col-actions">
          ${saved ? '' : `<button type="button" class="btn-icon" data-prod-remove title="Entfernen" aria-label="Entfernen">${icon('trash')}</button>`}
        </td>
      </tr>
    `;
  }

  bindEvents() {
    if (!this.host) return;
    bindMoneyInputs(this.host);
    this.host.addEventListener('click', (event) => {
      const add = event.target.closest('[data-prod-add]');
      if (add) {
        this._addRow(add.closest('[data-kampagne-nummer]'));
        return;
      }
      const remove = event.target.closest('[data-prod-remove]');
      if (remove) {
        remove.closest('[data-prod-row]')?.remove();
        this._refreshHints();
      }
    });
    this.host.addEventListener('input', (event) => {
      if (!event.target.matches('[data-prod-budget], [data-prod-name]')) return;
      this._refreshHints();
    });
  }

  _addRow(groupEl) {
    if (!groupEl) return;
    const nummer = Number(groupEl.dataset.kampagneNummer) || 1;
    const rowsHost = groupEl.querySelector('[data-prod-rows]');
    const count = rowsHost.querySelectorAll('[data-prod-row]').length + 1;
    const row = {
      _key: nextKey(),
      kampagnen_nummer: nummer,
      kampagne_id: groupEl.dataset.kampagneId || null,
      name: geistProduktionName(groupEl.dataset.basis || '', count),
      budget: null,
      verbrauch: 0
    };
    const group = this._groups().find(item => item.nummer === nummer) || {
      nummer,
      volumen: 0,
      rows: []
    };
    rowsHost.insertAdjacentHTML('beforeend', this._renderRow(row, group));
    bindMoneyInputs(rowsHost);
    this._refreshHints();
  }

  _refreshHints() {
    const collected = this.collectData().produktionen;
    this.host?.querySelectorAll('[data-kampagne-nummer]').forEach(groupEl => {
      const nummer = Number(groupEl.dataset.kampagneNummer) || 1;
      const id = groupEl.dataset.kampagneId || null;
      const rows = collected.filter(row => (id && row.kampagne_id === id) || (!id && (row.kampagnen_nummer || 1) === nummer));
      const group = this._groups().find(item => item.nummer === nummer);
      const volumen = group?.volumen || 0;
      const summe = sumBudgets(rows);
      const hint = groupEl.querySelector('[data-prod-hint]');
      if (hint) {
        hint.textContent = `${formatMoney(summe)} von ${formatMoney(volumen)} vergeben, Rest ${formatMoney(volumen - summe)}`;
      }
    });
  }

  attachLiveUpdate(handler) {
    this.host?.addEventListener('input', () => handler());
  }

  isMounted() {
    return Boolean(this.host?.querySelector('[data-prod-add]'));
  }

  collectData() {
    const produktionen = [];
    this.host?.querySelectorAll('[data-kampagne-nummer]').forEach(groupEl => {
      const nummer = Number(groupEl.dataset.kampagneNummer) || 1;
      const kampagneId = groupEl.dataset.kampagneId || null;
      groupEl.querySelectorAll('[data-prod-row]').forEach(rowEl => {
        const existing = (this.wizard.formData.produktionen || []).find(row =>
          (row.id && row.id === rowEl.dataset.id) || (row._key && row._key === rowEl.dataset.key)
        );
        produktionen.push({
          id: rowEl.dataset.id || null,
          _key: rowEl.dataset.key || null,
          kampagne_id: kampagneId || existing?.kampagne_id || null,
          kampagnen_nummer: nummer,
          name: rowEl.querySelector('[data-prod-name]')?.value || '',
          budget: parseCurrencyInput(rowEl.querySelector('[data-prod-budget]')?.value),
          verbrauch: existing?.verbrauch || 0
        });
      });
    });
    return { produktionen };
  }

  destroy() {}
}
