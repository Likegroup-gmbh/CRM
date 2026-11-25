import { afterEach, describe, expect, it, vi } from 'vitest';
import { openProduktionBudget, openProduktionName } from '../modules/produktion/produktionBearbeitenDrawer.js';
import { updateProduktionsbudgets } from '../modules/produktion/ProduktionService.js';

function updatesOf(calls) {
  window.supabase = {
    from: () => {
      const state = { patch: null };
      const query = {
        update: (patch) => {
          state.patch = patch;
          return query;
        },
        eq: (_column, id) => {
          calls.push({ id, patch: state.patch });
          return Promise.resolve({ error: null });
        }
      };
      return query;
    }
  };
}

describe('Produktion aus der Übersicht bearbeiten', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete window.supabase;
    delete window.toastSystem;
  });

  it('speichert einen neuen Namen', async () => {
    const calls = [];
    const toasts = [];
    updatesOf(calls);
    window.toastSystem = { show: (message, level) => toasts.push({ message, level }) };
    let saved = false;

    openProduktionName({ id: 'p1', name: 'Alt' }, async () => { saved = true; });
    const input = document.querySelector('#produktion-name-input');
    const drawer = document.querySelector('#produktion-name-drawer');
    expect(input.value).toBe('Alt');
    expect(input.classList.contains('input')).toBe(true);
    expect(drawer.querySelector('.drawer-body .drawer-footer')).toBeNull();
    expect(drawer.querySelector(':scope > .drawer-footer .mdc-btn--create')?.textContent).toBe('Speichern');
    expect(drawer.querySelector(':scope > .drawer-footer .mdc-btn--secondary')?.textContent).toBe('Abbrechen');

    input.value = '   ';
    document.querySelector('#produktion-name-drawer form').requestSubmit();
    await vi.waitFor(() => expect(toasts.at(-1)?.message).toBe('Name darf nicht leer sein'));
    expect(calls).toHaveLength(0);

    input.value = 'Neuer Süßer Senf';
    document.querySelector('#produktion-name-drawer form').requestSubmit();
    await vi.waitFor(() => expect(saved).toBe(true));
    expect(calls).toEqual([{ id: 'p1', patch: { name: 'Neuer Süßer Senf' } }]);
    expect(toasts.at(-1).message).toBe('Name gespeichert');
  });

  it('zeigt alle Produktionen und speichert nur gültige Budgets', async () => {
    const calls = [];
    const toasts = [];
    updatesOf(calls);
    window.toastSystem = { show: (message, level) => toasts.push({ message, level }) };

    const produktionen = [
      { id: 'p1', name: 'A', budget: null, budgetUsed: 1000 },
      { id: 'p2', name: 'B', budget: null, budgetUsed: 0 }
    ];
    openProduktionBudget({
      produktion: produktionen[0],
      produktionen,
      kampagne: { volumen: 50000, creator_budget: 100000, auftrag: { nettobetrag: 90000 } }
    });

    const budgetDrawer = document.querySelector('#produktion-budget-drawer');
    expect(budgetDrawer.textContent).toContain('A');
    expect(budgetDrawer.textContent).toContain('B');
    expect(budgetDrawer.querySelector('.money-field__suffix')?.textContent).toBe('€');
    expect(budgetDrawer.querySelector(':scope > .drawer-footer .mdc-btn--create')).toBeTruthy();
    expect(document.querySelector('[data-prod-hint]').textContent).toContain('50.000,00');
    expect(document.querySelector('#produktion-budget-drawer').textContent).toContain('1.000,00');

    document.querySelector('[data-produktion-id="p1"]').value = '15000';
    document.querySelector('#produktion-budget-drawer form').requestSubmit();
    await vi.waitFor(() => expect(toasts.at(-1)?.message).toContain('braucht B'));
    expect(calls).toHaveLength(0);

    document.querySelector('[data-produktion-id="p2"]').value = '10000';
    document.querySelector('#produktion-budget-drawer form').requestSubmit();
    await vi.waitFor(() => expect(calls.map(call => call.id)).toEqual(['p2', 'p1']));
    expect(calls[0].patch).toEqual({ budget: 10000 });
    expect(calls[1].patch).toEqual({ budget: 15000 });
  });

  it('schreibt Senkungen vor Erhöhungen', async () => {
    const calls = [];
    updatesOf(calls);
    await updateProduktionsbudgets(
      [
        { id: 'p1', budget: 20000 },
        { id: 'p2', budget: 5000 }
      ],
      [
        { id: 'p1', budget: 10000 },
        { id: 'p2', budget: 15000 }
      ]
    );
    expect(calls.map(call => [call.id, call.patch.budget])).toEqual([
      ['p1', 10000],
      ['p2', 15000]
    ]);
  });
});
