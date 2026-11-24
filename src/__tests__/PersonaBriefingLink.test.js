// @vitest-environment jsdom
//
// Speichern einer Persona darf die Linie nicht verlieren. Das Briefing-Feld
// haengt am Unternehmen; wird es beim Oeffnen nicht geladen, schickt der Save
// ein leeres Array und loest die Persona von der Produktion.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { DynamicDataLoader } from '../core/form/data/DynamicDataLoader.js';
import { personaConfig } from '../core/form/config/PersonaFormConfig.js';
import { setPrefillValues } from '../core/form/data/PrefillSelected.js';
import { PersonaForm } from '../modules/persona/PersonaForm.js';

const LINIE = '1207dc38-643c-4ab8-b50a-699d52e1b54b';
const FIELD = personaConfig.fields.find((field) => field.name === 'briefing_ids');

function briefingQuery(rows) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (resolve, reject) => Promise.resolve({ data: rows, error: null }).then(resolve, reject)
  };
  return query;
}

function formular() {
  document.body.innerHTML = `
    <form id="persona-form" data-entity="persona">
      <select name="unternehmen_id"><option value="u1" selected>Acme</option></select>
      <div class="form-field">
        <select id="field-briefing_ids" name="briefing_ids" multiple data-tag-based="true"></select>
      </div>
    </form>`;
  const form = document.getElementById('persona-form');
  form.dataset.isEditMode = 'true';
  form.dataset.entityType = 'persona';
  form.dataset.entityId = 'pe1';
  form.dataset.editModeData = JSON.stringify({
    unternehmen_id: 'u1',
    briefing_ids: [LINIE]
  });
  setPrefillValues(form.querySelector('[name="briefing_ids"]'), [LINIE]);
  return form;
}

describe('Persona bleibt an der Produktion', () => {
  afterEach(() => {
    delete window.supabase;
    delete window.formSystem;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('laedt die Linie beim Bearbeiten als ausgewaehltes Briefing', async () => {
    const query = briefingQuery([{
      id: LINIE,
      aktivierung_name: 'Lead Kampagne',
      unternehmen_id: 'u1',
      is_draft: false,
      ist_altbestand: false
    }]);
    window.supabase = { from: vi.fn(() => query) };
    const createTagBasedSelect = vi.fn();
    window.formSystem = { optionsManager: { createTagBasedSelect } };
    const form = formular();

    const loader = new DynamicDataLoader();
    loader.dataService = {};
    await loader.loadFieldOptions('persona', FIELD, form);

    expect(createTagBasedSelect).toHaveBeenCalled();
    const options = createTagBasedSelect.mock.calls[0][1];
    expect(options.filter((option) => option.selected).map((option) => option.value)).toEqual([LINIE]);
  });

  it('behaelt die Linie, wenn das Briefing-Feld leer ankommt, weil es nicht geladen wurde', () => {
    window.history.replaceState({}, '', '/persona/pe1');
    const form = new PersonaForm();
    form.personaId = 'pe1';
    form.briefingIds = [LINIE];
    document.body.innerHTML = '<form id="persona-form"></form>';

    expect(form.collectBriefingIds({ briefing_ids: [] })).toEqual([LINIE]);
  });

  it('loest die Linie, wenn das geladene Feld bewusst leer gespeichert wird', () => {
    window.history.replaceState({}, '', '/persona/pe1');
    const form = new PersonaForm();
    form.personaId = 'pe1';
    form.briefingIds = [LINIE];
    document.body.innerHTML = `
      <form id="persona-form">
        <div class="form-field">
          <select name="briefing_ids" multiple></select>
          <div class="tag-based-select" data-options='[{"value":"${LINIE}","label":"Lead"}]'></div>
        </div>
      </form>`;

    expect(form.collectBriefingIds({ briefing_ids: [] })).toEqual([]);
  });
});
