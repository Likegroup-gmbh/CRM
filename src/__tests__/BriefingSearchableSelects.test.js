// BriefingSearchableSelects.test.js
// initSearchableSelects muss die geladenen Entity-IDs als selected-Flag
// in die Options schreiben – createSimpleSearchableSelect ignoriert field.value.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BriefingCreate } from '../modules/briefing/create/BriefingCreateCore.js';
import '../modules/briefing/create/FormEvents.js';

function createInstance() {
  const instance = new BriefingCreate();
  instance.unternehmen = [
    { id: 'u1', firmenname: 'Acme GmbH' },
    { id: 'u2', firmenname: 'Beta AG' }
  ];
  instance.marken = [
    { id: 'm1', markenname: 'Acme Beauty', unternehmen_id: 'u1' },
    { id: 'm2', markenname: 'Acme Food', unternehmen_id: 'u1' },
    { id: 'm3', markenname: 'Beta Brand', unternehmen_id: 'u2' }
  ];
  instance.benutzer = [
    { id: 'b1', name: 'Anna' },
    { id: 'b2', name: 'Ben' }
  ];
  instance.produkte = [
    { id: 'p1', name: 'Serum' },
    { id: 'p2', name: 'Creme' }
  ];
  return instance;
}

function mountSelects() {
  document.body.innerHTML = `
    <form id="briefing-form">
      <select id="unternehmen_id" name="unternehmen_id"></select>
      <select id="marke_id" name="marke_id"></select>
      <select id="assignee_id" name="assignee_id"></select>
      <div class="form-field" data-entity-multi="produkt_ids">
        <select id="produkt_ids" name="produkt_ids" multiple></select>
      </div>
    </form>
  `;
}

describe('Briefing initSearchableSelects', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mountSelects();
    window.formSystem = { createSearchableSelect: vi.fn() };
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.formSystem;
    document.body.innerHTML = '';
  });

  it('markiert geladene Unternehmen/Marke/Assignee/Produkte als selected', () => {
    const instance = createInstance();
    instance.formData = {
      unternehmen_id: 'u1',
      marke_id: 'm2',
      assignee_id: 'b1',
      produkt_ids: ['p2']
    };

    instance.initSearchableSelects();

    expect(window.formSystem.createSearchableSelect).toHaveBeenCalledTimes(4);

    const [unternehmenEl, unternehmenOpts] = window.formSystem.createSearchableSelect.mock.calls[0];
    expect(unternehmenEl.id).toBe('unternehmen_id');
    expect(unternehmenOpts.filter(o => o.selected)).toEqual([
      { value: 'u1', label: 'Acme GmbH', selected: true }
    ]);

    const [markeEl, markeOpts] = window.formSystem.createSearchableSelect.mock.calls[1];
    expect(markeEl.id).toBe('marke_id');
    expect(markeOpts.map(o => o.value)).toEqual(['m1', 'm2']);
    expect(markeOpts.filter(o => o.selected)).toEqual([
      { value: 'm2', label: 'Acme Food', selected: true }
    ]);

    const [assigneeEl, assigneeOpts] = window.formSystem.createSearchableSelect.mock.calls[2];
    expect(assigneeEl.id).toBe('assignee_id');
    expect(assigneeOpts.filter(o => o.selected)).toEqual([
      { value: 'b1', label: 'Anna', selected: true }
    ]);

    const [produktEl, produktOpts, produktField] = window.formSystem.createSearchableSelect.mock.calls[3];
    expect(produktEl.id).toBe('produkt_ids');
    expect(produktField).toMatchObject({ type: 'multiselect', tagBased: true, name: 'produkt_ids' });
    expect(produktOpts).toEqual([
      { value: 'p1', label: 'Serum', selected: false },
      { value: 'p2', label: 'Creme', selected: true }
    ]);
  });

  it('initialisiert Marke und Produkte nicht ohne unternehmen_id', () => {
    const instance = createInstance();
    instance.formData = { assignee_id: 'b2' };

    instance.initSearchableSelects();

    const names = window.formSystem.createSearchableSelect.mock.calls.map(c => c[2].name);
    expect(names).toEqual(['unternehmen_id', 'assignee_id']);
    expect(names).not.toContain('marke_id');
    expect(names).not.toContain('produkt_ids');

    const assigneeOpts = window.formSystem.createSearchableSelect.mock.calls
      .find(c => c[2].name === 'assignee_id')[1];
    expect(assigneeOpts.filter(o => o.selected)).toEqual([
      { value: 'b2', label: 'Ben', selected: true }
    ]);
  });

  it('rebuildProduktSelect setzt die tag-basierte Mehrfachauswahl neu auf', () => {
    const instance = createInstance();
    instance.formData = { unternehmen_id: 'u1', produkt_ids: ['p1'] };

    instance.rebuildProduktSelect();

    expect(window.formSystem.createSearchableSelect).toHaveBeenCalledTimes(1);
    const [el, opts, field] = window.formSystem.createSearchableSelect.mock.calls[0];
    expect(el.id).toBe('produkt_ids');
    expect(field).toMatchObject({ type: 'multiselect', tagBased: true });
    expect(opts.filter(o => o.selected)).toEqual([
      { value: 'p1', label: 'Serum', selected: true }
    ]);
  });
});

describe('renderEntityMulti', () => {
  it('rendert ein tag-basiertes Multi-Select', async () => {
    const { renderField } = await import('../modules/briefing/create/FieldRenderer.js');
    const html = renderField({
      name: 'produkt_ids',
      label: 'Produkte (optional)',
      type: 'entityMulti',
      table: 'produkt',
      displayField: 'name',
      persist: false,
      dependsOn: 'unternehmen_id',
      placeholder: 'Produkte suchen und hinzufügen...'
    }, { unternehmen_id: 'u1', produkt_ids: ['p2'] }, {
      produkt: [{ id: 'p1', name: 'Serum' }, { id: 'p2', name: 'Creme' }]
    });

    expect(html).toContain('data-entity-multi="produkt_ids"');
    expect(html).toContain('multiple');
    expect(html).toContain('data-tag-based="true"');
    expect(html).toContain('data-searchable="true"');
    expect(html).toContain('value="p2" selected');
    expect(html).not.toContain('checkbox-label');
  });
});
