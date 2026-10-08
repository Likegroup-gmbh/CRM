import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setup } from '../core/form/logic/events/KooperationTagsEvents.js';

const TAGS = [
  { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', name: '9.11' },
  { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', name: '9.11.' }
];

function createSupabase({ usages = {}, failDelete = false } = {}) {
  const calls = [];
  const supabase = {
    calls,
    from(table) {
      const state = { table, filters: [], op: 'select', head: false };
      const builder = {
        select(_cols, opts) {
          state.op = 'select';
          state.head = !!opts?.head;
          return builder;
        },
        delete() {
          state.op = 'delete';
          return builder;
        },
        eq(col, val) {
          state.filters.push({ col, val });
          return builder;
        },
        order() { return builder; },
        upsert() { return builder; },
        single() { return Promise.resolve({ data: null, error: null }); },
        then(onFulfilled, onRejected) {
          calls.push({ table: state.table, op: state.op, head: state.head, filters: [...state.filters] });
          if (state.op === 'delete') {
            const error = failDelete ? { message: 'delete blocked' } : null;
            return Promise.resolve({ error }).then(onFulfilled, onRejected);
          }
          if (state.head) {
            const tagId = state.filters.find(filter => filter.col === 'tag_id')?.val;
            return Promise.resolve({ count: usages[tagId] || 0, error: null }).then(onFulfilled, onRejected);
          }
          return Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected);
        }
      };
      return builder;
    }
  };
  return supabase;
}

function mount() {
  document.body.innerHTML = `
    <form id="koop-form">
      <div id="koop-tag-container">
        <div id="selected_koop_tags"></div>
        <input id="koop_tag_input" />
        <div id="koop_tag_suggestions" style="display:none;"></div>
      </div>
    </form>`;
  return document.getElementById('koop-form');
}

async function openList(usages) {
  window.supabase = createSupabase({ usages });
  const form = mount();
  await setup(form, { allTags: TAGS.map(tag => ({ ...tag })) });
  document.getElementById('koop_tag_input').dispatchEvent(new Event('focus'));
  return window.supabase;
}

describe('Kooperation-Tags aus der Vorschlagsliste löschen', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.confirmationModal = { open: vi.fn(async () => ({ confirmed: true })) };
    window.toastSystem = { show: vi.fn() };
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.supabase;
    delete window.confirmationModal;
    delete window.toastSystem;
  });

  it('zeigt an bestehenden Tags ein × und legt den Tag beim Klick auf den Namen an', async () => {
    await openList();

    const removes = document.querySelectorAll('.suggestion-item-remove');
    expect(removes).toHaveLength(2);
    expect(document.querySelector('.suggestion-item--new')).toBeNull();

    document.querySelector('.suggestion-item-name').click();

    expect(document.querySelector('#selected_koop_tags .tag-item')?.textContent).toContain('9.11');
    expect(window.supabase.calls.some(call => call.op === 'delete')).toBe(false);
  });

  it('löscht einen ungenutzten Tag sofort und lässt die Liste offen', async () => {
    await openList();

    document.querySelector('[data-id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2"] .suggestion-item-remove').click();
    await vi.waitFor(() => {
      expect(document.querySelector('[data-id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2"]')).toBeNull();
    });

    expect(window.confirmationModal.open).not.toHaveBeenCalled();
    expect(window.supabase.calls).toContainEqual(expect.objectContaining({
      table: 'kooperation_tag_typen',
      op: 'delete',
      filters: [{ col: 'id', val: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2' }]
    }));
    expect(document.getElementById('koop_tag_suggestions').style.display).toBe('block');
    expect(document.querySelector('#selected_koop_tags .tag-item')).toBeNull();
  });

  it('fragt nach, wenn Kooperationen den Tag nutzen, und löscht erst nach Bestätigung', async () => {
    const usedId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';
    await openList({ [usedId]: 3 });

    document.querySelector('.suggestion-item[data-id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1"] .suggestion-item-name').click();
    document.querySelector(`[data-id="${usedId}"] .suggestion-item-remove`).click();
    await vi.waitFor(() => expect(window.confirmationModal.open).toHaveBeenCalled());

    expect(window.confirmationModal.open).toHaveBeenCalledWith(expect.objectContaining({
      message: '„9.11.“ wird von 3 Kooperationen genutzt. Der Tag wird dort entfernt und gelöscht.',
      confirmText: 'Trotzdem löschen',
      cancelText: 'Abbrechen'
    }));
    await vi.waitFor(() => {
      expect(window.supabase.calls.some(call => call.op === 'delete')).toBe(true);
    });
    expect(document.querySelector(`[data-id="${usedId}"]`)).toBeNull();
  });

  it('lässt den Tag stehen, wenn die Bestätigung abgebrochen wird', async () => {
    const usedId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';
    window.confirmationModal.open = vi.fn(async () => ({ confirmed: false }));
    await openList({ [usedId]: 1 });

    document.querySelector(`[data-id="${usedId}"] .suggestion-item-remove`).click();
    await vi.waitFor(() => expect(window.confirmationModal.open).toHaveBeenCalled());

    expect(window.confirmationModal.open.mock.calls[0][0].message)
      .toBe('„9.11.“ wird von 1 Kooperation genutzt. Der Tag wird dort entfernt und gelöscht.');
    expect(window.supabase.calls.some(call => call.op === 'delete')).toBe(false);
    expect(document.querySelector(`[data-id="${usedId}"]`)).not.toBeNull();
  });

  it('nimmt einen gesetzten Chip mit, wenn der Katalogeintrag gelöscht wird', async () => {
    const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
    await openList();

    document.querySelector(`.suggestion-item[data-id="${id}"]`).click();
    expect(document.querySelector(`#selected_koop_tags .tag-item[data-id="${id}"]`)).not.toBeNull();

    document.querySelector(`[data-id="${id}"] .suggestion-item-remove`).click();
    await vi.waitFor(() => {
      expect(document.querySelector(`#selected_koop_tags .tag-item[data-id="${id}"]`)).toBeNull();
    });
    expect(document.querySelector('input[name="koop_tag_ids[]"]')).toBeNull();
  });

  it('behält den Tag, wenn das Löschen fehlschlägt', async () => {
    window.supabase = createSupabase({ failDelete: true });
    const form = mount();
    await setup(form, { allTags: TAGS.map(tag => ({ ...tag })) });
    document.getElementById('koop_tag_input').dispatchEvent(new Event('focus'));

    document.querySelector('.suggestion-item-remove').click();
    await vi.waitFor(() => expect(window.toastSystem.show).toHaveBeenCalled());

    expect(window.toastSystem.show).toHaveBeenCalledWith('Tag konnte nicht gelöscht werden', 'error');
    expect(document.querySelectorAll('.suggestion-item-remove')).toHaveLength(2);
  });
});
