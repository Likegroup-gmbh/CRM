// Name und Produktionsbudget aus der Produktionsübersicht.
// Das Budget gilt für alle Produktionen der Kampagne: sobald eines gesetzt ist,
// brauchen alle eins, und die Summe bleibt im Volumen.

import { DRAWER_EXIT_MS } from '../../core/animation/drawer.js';
import { bindMoneyInputs, renderMoneyInput } from '../../core/form/moneyInput.js';
import {
  budgetZeilen,
  produktionsbudgetDecke,
  roundMoney,
  sumBudgets,
  validateProduktionsbudgets
} from './produktionsbudget.js';
import { updateProduktionName, updateProduktionsbudgets } from './ProduktionService.js';

const NAME_ID = 'produktion-name-drawer';
const BUDGET_ID = 'produktion-budget-drawer';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function formatMoney(value) {
  return roundMoney(value).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function closeDrawer(id) {
  const overlay = document.getElementById(`${id}-overlay`);
  const panel = document.getElementById(id);
  panel?._abort?.abort();
  if (!panel) {
    overlay?.remove();
    return;
  }
  panel.classList.remove('show');
  setTimeout(() => {
    overlay?.remove();
    panel.remove();
  }, DRAWER_EXIT_MS);
}

function mountDrawer({ id, title, subtitle, bodyHtml, onSubmit }) {
  closeDrawer(NAME_ID);
  closeDrawer(BUDGET_ID);

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id = `${id}-overlay`;

  const panel = document.createElement('div');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', `${id}-title`);
  panel.className = 'drawer-panel produktion-pflege-drawer';
  panel.id = id;
  const abort = new AbortController();
  panel._abort = abort;

  panel.innerHTML = `
    <div class="drawer-header">
      <div class="drawer-header-left">
        <span class="drawer-title" id="${id}-title">${escapeHtml(title)}</span>
        <p class="drawer-subtitle">${escapeHtml(subtitle)}</p>
      </div>
      <button type="button" class="drawer-close-btn" aria-label="Schließen">&times;</button>
    </div>
    <div class="drawer-body">
      <form id="${id}-form">
        ${bodyHtml}
      </form>
    </div>
    <div class="drawer-footer">
      <button type="button" class="mdc-btn mdc-btn--secondary" data-drawer-cancel>Abbrechen</button>
      <button type="submit" class="mdc-btn mdc-btn--create" form="${id}-form">Speichern</button>
    </div>
  `;

  const close = () => closeDrawer(id);
  overlay.addEventListener('click', close);
  panel.querySelector('.drawer-close-btn').addEventListener('click', close);
  panel.querySelector('[data-drawer-cancel]').addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  }, { signal: abort.signal });

  const form = panel.querySelector('form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = panel.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    try {
      const saved = await onSubmit(panel);
      if (saved === false) return;
      close();
    } catch (error) {
      window.toastSystem?.show(error.message || 'Speichern fehlgeschlagen', 'error');
    } finally {
      if (button?.isConnected) button.disabled = false;
    }
  });

  document.body.appendChild(overlay);
  document.body.appendChild(panel);
  requestAnimationFrame(() => panel.classList.add('show'));
  return panel;
}

export function openProduktionName(produktion, onSaved) {
  const panel = mountDrawer({
    id: NAME_ID,
    title: 'Name bearbeiten',
    subtitle: 'Name dieser Produktion',
    bodyHtml: `
      <div class="form-group">
        <label class="form-label" for="produktion-name-input">Name</label>
        <input type="text" id="produktion-name-input" class="input" value="${escapeHtml(produktion?.name || '')}" required>
      </div>
    `,
    onSubmit: async (root) => {
      const name = root.querySelector('#produktion-name-input')?.value.trim() || '';
      if (!name) {
        window.toastSystem?.show('Name darf nicht leer sein', 'warning');
        return false;
      }
      await updateProduktionName(produktion.id, name);
      window.toastSystem?.show('Name gespeichert', 'success');
      await onSaved?.();
    }
  });
  const input = panel.querySelector('#produktion-name-input');
  input?.focus();
  input?.select();
}

export function openProduktionBudget({ produktion, produktionen, kampagne, onSaved }) {
  const rows = produktionen?.length ? produktionen : [produktion];
  const decke = produktionsbudgetDecke(kampagne);
  const fields = rows.map(row => `
    <div class="form-group">
      <label class="form-label" for="prod-budget-${escapeHtml(row.id)}">${escapeHtml(row.name || 'Produktion')}</label>
      ${renderMoneyInput({
        id: `prod-budget-${row.id}`,
        value: row.budget,
        attrs: { 'data-prod-budget': true, 'data-produktion-id': row.id }
      })}
      ${(parseFloat(row.budgetUsed) || 0) > 0
        ? `<p class="produktion-pflege-hinweis">Verbrauch ${formatMoney(row.budgetUsed)}</p>`
        : ''}
    </div>
  `).join('');

  const panel = mountDrawer({
    id: BUDGET_ID,
    title: 'Produktionsbudget',
    subtitle: 'Aus dem Volumen der Kampagne',
    bodyHtml: `
      <p class="produktion-pflege-stand" data-prod-hint></p>
      <p class="produktion-pflege-hinweis">Leer heißt, die Produktionen teilen sich das Volumen. Ist eines gesetzt, brauchen alle eins.</p>
      ${fields}
    `,
    onSubmit: async (root) => {
      const zeilen = budgetZeilen(rows, leseBudgets(root));
      const check = validateProduktionsbudgets(zeilen, decke);
      if (!check.valid) {
        window.toastSystem?.show(check.errors[0], 'warning');
        return false;
      }
      await updateProduktionsbudgets(rows, zeilen);
      window.toastSystem?.show('Produktionsbudget gespeichert', 'success');
      await onSaved?.();
    }
  });

  bindMoneyInputs(panel);
  const hint = panel.querySelector('[data-prod-hint]');
  const refresh = () => {
    const summe = sumBudgets(budgetZeilen(rows, leseBudgets(panel)));
    hint.textContent = `${formatMoney(summe)} von ${formatMoney(decke)} vergeben, Rest ${formatMoney(decke - summe)}`;
  };
  panel.addEventListener('input', (event) => {
    if (event.target.matches('[data-prod-budget]')) refresh();
  });
  refresh();

  const focusId = String(produktion?.id || '').replace(/"/g, '');
  const focus = panel.querySelector(`[data-produktion-id="${focusId}"]`)
    || panel.querySelector('[data-prod-budget]');
  focus?.focus();
}

function leseBudgets(root) {
  const eingaben = {};
  root.querySelectorAll('[data-prod-budget]').forEach(input => {
    eingaben[input.dataset.produktionId] = input.value;
  });
  return eingaben;
}
