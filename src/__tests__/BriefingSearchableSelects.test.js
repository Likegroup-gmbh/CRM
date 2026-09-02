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
  return instance;
}

function mountSelects() {
  document.body.innerHTML = `
    <form id="briefing-form">
      <select id="unternehmen_id" name="unternehmen_id"></select>
      <select id="marke_id" name="marke_id"></select>
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

  it('markiert geladene Unternehmen/Marke als selected', () => {
    const instance = createInstance();
    instance.formData = {
      unternehmen_id: 'u1',
      marke_id: 'm2'
    };

    instance.initSearchableSelects();

    expect(window.formSystem.createSearchableSelect).toHaveBeenCalledTimes(2);

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
  });

  it('initialisiert Marke nicht ohne unternehmen_id', () => {
    const instance = createInstance();
    instance.formData = {};

    instance.initSearchableSelects();

    const names = window.formSystem.createSearchableSelect.mock.calls.map(c => c[2].name);
    expect(names).toEqual(['unternehmen_id']);
    expect(names).not.toContain('marke_id');
  });
});
