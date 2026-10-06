// BriefingSearchableSelects.test.js
// initSearchableSelects muss die geladenen Entity-IDs als selected-Flag
// in die Options schreiben – createSimpleSearchableSelect ignoriert field.value.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BriefingCreate } from '../modules/briefing/create/BriefingCreateCore.js';
import '../modules/briefing/create/FormEvents.js';
import '../modules/briefing/create/RenderShell.js';

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

  it('markiert geladene Unternehmen/Marke/Assignee als selected', () => {
    const instance = createInstance();
    instance.formData = {
      unternehmen_id: 'u1',
      marke_id: 'm2',
      assignee_id: 'b1'
    };

    instance.initSearchableSelects();

    expect(window.formSystem.createSearchableSelect).toHaveBeenCalledTimes(3);

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
  });

  it('initialisiert Marke nicht ohne unternehmen_id', () => {
    const instance = createInstance();
    instance.formData = { assignee_id: 'b2' };

    instance.initSearchableSelects();

    const names = window.formSystem.createSearchableSelect.mock.calls.map(c => c[2].name);
    expect(names).toEqual(['unternehmen_id', 'assignee_id']);
    expect(names).not.toContain('marke_id');

    const assigneeOpts = window.formSystem.createSearchableSelect.mock.calls
      .find(c => c[2].name === 'assignee_id')[1];
    expect(assigneeOpts.filter(o => o.selected)).toEqual([
      { value: 'b2', label: 'Ben', selected: true }
    ]);
  });
});

describe('Briefing aus Produktion: gesperrter Kontext', () => {
  const kampagnen = [
    { id: 'k1', label: 'FAG', kampagnenname: 'FAG', unternehmen_id: 'u1', marke_id: 'm1' }
  ];

  afterEach(() => {
    window.history.replaceState(null, '', '/');
    delete window.supabase;
    delete window.formSystem;
    document.body.innerHTML = '';
  });

  it('leitet Unternehmen und Marke aus der Kampagne ab, nicht aus der URL', () => {
    const instance = createInstance();
    instance.kampagnen = kampagnen;
    window.history.replaceState({}, '', '/briefing/new?unternehmen=u2&marke=m3&kampagne=k1&produktion=pn1');
    instance.applyQueryPrefill();

    expect(instance._linieGesperrt).toBe(true);
    expect(instance.formData).toMatchObject({
      unternehmen_id: 'u1', marke_id: 'm1', kampagne_id: 'k1', produktion_id: 'pn1'
    });
  });

  it('lädt bei reiner Produktion-URL die Kampagne nach', async () => {
    const instance = createInstance();
    instance.kampagnen = kampagnen;
    window.supabase = {
      from: vi.fn(() => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'pn1', kampagne_id: 'k1', produkt_id: null } }) }) })
      }))
    };
    window.history.replaceState({}, '', '/briefing/new?produktion=pn1');
    instance.applyQueryPrefill();
    await instance.resolveProduktionKontext();

    expect(instance._linieGesperrt).toBe(true);
    expect(instance.formData).toMatchObject({ unternehmen_id: 'u1', marke_id: 'm1', kampagne_id: 'k1', produktion_id: 'pn1' });
    expect(instance._produktionKontext).toMatchObject({ kampagneId: 'k1', produktionId: 'pn1' });
  });

  it('rendert Unternehmen, Marke und Kampagne gesperrt mit gewähltem Wert', async () => {
    const { renderField } = await import('../modules/briefing/create/FieldRenderer.js');
    const { getAllFields } = await import('../modules/briefing/create/fieldConfig.js');
    const instance = createInstance();
    instance.kampagnen = kampagnen;
    instance._linieGesperrt = true;
    instance.formData = { unternehmen_id: 'u1', marke_id: 'm1', kampagne_id: 'k1' };
    const context = instance.getFieldContext();

    const html = ['unternehmen_id', 'marke_id', 'kampagne_id']
      .map(name => renderField(getAllFields().find(f => f.name === name), instance.formData, context))
      .join('');
    document.body.innerHTML = `<form id="briefing-form">${html}</form>`;

    for (const [id, value] of [['unternehmen_id', 'u1'], ['marke_id', 'm1'], ['kampagne_id', 'k1']]) {
      const select = document.getElementById(id);
      expect(select.disabled).toBe(true);
      expect(select.value).toBe(value);
    }
  });

  it('Unternehmen/Marke werden nicht searchable, Kampagne bleibt bei Rebuild erhalten', () => {
    vi.useFakeTimers();
    window.formSystem = { createSearchableSelect: vi.fn() };
    const instance = createInstance();
    instance.kampagnen = kampagnen;
    instance._linieGesperrt = true;
    instance.formData = { unternehmen_id: 'u1', marke_id: 'm1', kampagne_id: 'k1' };
    document.body.innerHTML = `
      <form id="briefing-form">
        <select id="unternehmen_id" name="unternehmen_id"></select>
        <select id="marke_id" name="marke_id"></select>
        <select id="kampagne_id" name="kampagne_id"></select>
      </form>`;

    instance.initSearchableSelects();
    const names = window.formSystem.createSearchableSelect.mock.calls.map(c => c[2].name);
    expect(names).not.toContain('unternehmen_id');
    expect(names).not.toContain('marke_id');

    // Fremdes Unternehmen im State: Kampagne darf trotzdem nicht verschwinden
    instance.formData.unternehmen_id = 'u2';
    instance.rebuildMarkeSelect();
    instance.rebuildLinieSelects();
    const kampagne = document.getElementById('kampagne_id');
    expect(kampagne.disabled).toBe(true);
    expect(kampagne.value).toBe('k1');
    expect(document.getElementById('marke_id').value).toBe('m1');
    vi.useRealTimers();
  });

  it('ohne Kontext bleibt die Kampagne nach Unternehmen/Marke wählbar', () => {
    window.formSystem = { createSearchableSelect: vi.fn() };
    const instance = createInstance();
    instance.kampagnen = kampagnen;
    instance.formData = { unternehmen_id: 'u1', marke_id: 'm1' };
    document.body.innerHTML = `<form id="briefing-form"><select id="kampagne_id" name="kampagne_id"></select></form>`;

    instance.rebuildLinieSelects();
    expect(document.getElementById('kampagne_id').disabled).toBe(false);
    const [, options] = window.formSystem.createSearchableSelect.mock.calls[0];
    expect(options.map(o => o.value)).toEqual(['k1']);
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

describe('Nutzungsdauer Searchable-Select', () => {
  afterEach(() => {
    delete window.formSystem;
    delete window.supabase;
    document.body.innerHTML = '';
  });

  it('hängt Vorgaben und Katalog an das einfache Select mit allowCreate', async () => {
    const { renderField } = await import('../modules/briefing/create/FieldRenderer.js');
    const { getAllFields } = await import('../modules/briefing/create/fieldConfig.js');
    const field = getAllFields().find(item => item.name === 'nutzungsdauer');

    document.body.innerHTML = `<form id="briefing-form">${renderField(field, { nutzungsdauer: 'bis auf Weiteres' }, {})}</form>`;
    const select = document.getElementById('nutzungsdauer');
    expect(select.multiple).toBe(false);
    expect(select.dataset.tagBased).toBeUndefined();
    expect(select.querySelector('option[value="bis auf Weiteres"]')).toBeTruthy();

    const order = vi.fn(async () => ({ data: [{ label: 'Full Buyout' }], error: null }));
    window.supabase = { from: vi.fn(() => ({ select: vi.fn(() => ({ order })) })) };
    window.formSystem = { createSearchableSelect: vi.fn() };

    const instance = createInstance();
    instance.formData = { nutzungsdauer: 'bis auf Weiteres' };
    await instance.initNutzungsdauerSelect();

    expect(window.supabase.from).toHaveBeenCalledWith('nutzungsdauer_optionen');
    const [el, options, config] = window.formSystem.createSearchableSelect.mock.calls[0];
    expect(el).toBe(select);
    expect(options.map(option => option.label)).toEqual([
      '1 Monat', '3 Monate', '6 Monate', '12 Monate', '24 Monate', '90 Monate',
      'Full Buyout', 'bis auf Weiteres'
    ]);
    expect(options.filter(option => option.selected).map(option => option.label)).toEqual(['bis auf Weiteres']);
    expect(config).toEqual({
      name: 'nutzungsdauer',
      placeholder: 'z.B. 6 Monate, Full Buyout',
      allowCreate: true,
      table: 'nutzungsdauer_optionen',
      displayField: 'label',
      valueField: 'label'
    });
    expect(config.tagBased).toBeUndefined();
  });
});
