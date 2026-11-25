// @vitest-environment jsdom
//
// Produkt anlegen aus einer Linie (/produkt/new?briefing=...): das Entwurf-Briefing
// der Linie muss im Briefings-Feld als Tag stehen und den Unternehmens-Reload
// ueberstehen.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { DependentFields } from '../core/form/logic/DependentFields.js';
import { loadDirectQueryOptions } from '../core/form/data/DirectQueryLoader.js';
import { setPrefillValues } from '../core/form/data/PrefillSelected.js';
import { produktConfig } from '../core/form/config/ProduktFormConfig.js';

const FIELD = produktConfig.fields.find(f => f.name === 'briefing_ids');

function createQuery({ rows = [], single = null } = {}) {
  const eqs = [];
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn((column, value) => { eqs.push([column, value]); return query; }),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data: single, error: null })),
    then: (resolve, reject) => Promise.resolve({ data: rows, error: null }).then(resolve, reject)
  };
  return { query, eqs };
}

function baueForm({ vorhandeneTags = [] } = {}) {
  document.body.innerHTML = `
    <form id="produkt-form">
      <select name="unternehmen_id"><option value="u1" selected>Acme</option></select>
      <div class="form-field">
        <select id="field-briefing_ids" name="briefing_ids" multiple></select>
        <div class="tag-based-select">
          <div class="tags-container">
            ${vorhandeneTags.map(v => `<div class="tag" data-value="${v}"></div>`).join('')}
          </div>
        </div>
        <select id="field-briefing_ids_hidden" multiple style="display: none">
          ${vorhandeneTags.map(v => `<option value="${v}" selected></option>`).join('')}
        </select>
      </div>
    </form>`;
  return document.getElementById('produkt-form');
}

describe('Produkt-Formular: Briefing-Picker', () => {
  it('laesst Entwuerfe im Briefing-Feld zu', () => {
    expect(FIELD.includeDrafts).toBe(true);
  });
});

describe('Briefing-Vorauswahl beim Anlegen', () => {
  let createTagBasedSelect;

  beforeEach(() => {
    createTagBasedSelect = vi.fn();
    window.formSystem = { optionsManager: { createTagBasedSelect } };
  });

  afterEach(() => {
    delete window.supabase;
    delete window.formSystem;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('Erst-Load: markiert das Entwurf-Briefing als selected und filtert Entwuerfe nicht weg', async () => {
    const { query, eqs } = createQuery({
      rows: [
        { id: 'b-entwurf', aktivierung_name: 'Sommer', unternehmen_id: 'u1', is_draft: true },
        { id: 'b-andere', aktivierung_name: 'Winter', unternehmen_id: 'u1', is_draft: false }
      ]
    });
    window.supabase = { from: vi.fn(() => query) };
    const form = baueForm();
    setPrefillValues(form.querySelector('[name="briefing_ids"]'), ['b-entwurf']);

    const options = await loadDirectQueryOptions(FIELD, form);

    expect(eqs).toEqual([['unternehmen_id', 'u1']]);
    expect(options.filter(o => o.selected).map(o => o.value)).toEqual(['b-entwurf']);
    expect(form.querySelector('[name="briefing_ids"]').dataset.prefillValues).toBeUndefined();
  });

  it('Unternehmens-Reload: setzt das Briefing als Tag und laedt Entwuerfe mit', async () => {
    const { query, eqs } = createQuery({
      rows: [
        { id: 'b-entwurf', aktivierung_name: 'Sommer', unternehmen_id: 'u1', is_draft: true },
        { id: 'b-andere', aktivierung_name: 'Winter', unternehmen_id: 'u1', is_draft: false }
      ]
    });
    window.supabase = { from: vi.fn(() => query) };
    const form = baueForm();
    setPrefillValues(form.querySelector('[name="briefing_ids"]'), ['b-entwurf']);

    await new DependentFields().reloadFilteredField(form, FIELD, 'u1');

    expect(eqs).toEqual([['unternehmen_id', 'u1']]);
    const [, options] = createTagBasedSelect.mock.calls[0];
    expect(options.filter(o => o.selected).map(o => o.value)).toEqual(['b-entwurf']);
  });

  it('Unternehmens-Reload: behaelt bestehende Tags, die zum Unternehmen passen', async () => {
    const { query } = createQuery({
      rows: [
        { id: 'b1', aktivierung_name: 'Sommer', unternehmen_id: 'u1', is_draft: true },
        { id: 'b2', aktivierung_name: 'Winter', unternehmen_id: 'u1', is_draft: false }
      ]
    });
    window.supabase = { from: vi.fn(() => query) };
    const form = baueForm({ vorhandeneTags: ['b1', 'alt-anderes-unternehmen'] });

    await new DependentFields().reloadFilteredField(form, FIELD, 'u1');

    const [, options] = createTagBasedSelect.mock.calls[0];
    expect(options.filter(o => o.selected).map(o => o.value)).toEqual(['b1']);
    expect(form.querySelectorAll('.tag')).toHaveLength(0);
    expect(document.getElementById('field-briefing_ids_hidden').options).toHaveLength(0);
  });

  it('laedt ein vorgemerktes Briefing nach, wenn es nicht in der Liste steht', async () => {
    const { query } = createQuery({ rows: [], single: {
      id: 'b-fehlt', aktivierung_name: 'Fehlt', unternehmen_id: 'u1', is_draft: true
    } });
    window.supabase = { from: vi.fn(() => query) };
    const form = baueForm();
    setPrefillValues(form.querySelector('[name="briefing_ids"]'), ['b-fehlt']);

    await new DependentFields().reloadFilteredField(form, FIELD, 'u1');

    const [, options] = createTagBasedSelect.mock.calls[0];
    expect(options).toEqual([{ value: 'b-fehlt', label: 'Fehlt', selected: true }]);
  });

  it('verwirft ein vorgemerktes Briefing eines anderen Unternehmens', async () => {
    const { query } = createQuery({ rows: [], single: {
      id: 'b-fremd', aktivierung_name: 'Fremd', unternehmen_id: 'u9', is_draft: true
    } });
    window.supabase = { from: vi.fn(() => query) };
    const form = baueForm();
    setPrefillValues(form.querySelector('[name="briefing_ids"]'), ['b-fremd']);

    await new DependentFields().reloadFilteredField(form, FIELD, 'u1');

    const [, options] = createTagBasedSelect.mock.calls[0];
    expect(options).toEqual([]);
  });

  it('Vormerkung gilt einmalig: ein zweiter Reload bringt entfernte Tags nicht zurueck', async () => {
    const { query } = createQuery({
      rows: [{ id: 'b1', aktivierung_name: 'Sommer', unternehmen_id: 'u1', is_draft: true }]
    });
    window.supabase = { from: vi.fn(() => query) };
    const form = baueForm();
    setPrefillValues(form.querySelector('[name="briefing_ids"]'), ['b1']);
    const dependent = new DependentFields();

    await dependent.reloadFilteredField(form, FIELD, 'u1');
    await dependent.reloadFilteredField(form, FIELD, 'u1');

    const [, zweite] = createTagBasedSelect.mock.calls[1];
    expect(zweite.filter(o => o.selected)).toEqual([]);
  });
});
