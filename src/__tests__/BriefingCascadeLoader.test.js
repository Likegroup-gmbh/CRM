// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { findStrategy } from '../core/form/logic/CascadeStrategies.js';
import { DependentFields } from '../core/form/logic/DependentFields.js';

function createQuery({ data = [], error = null } = {}) {
  const eqs = [];
  const ors = [];
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn((column, value) => {
      eqs.push([column, value]);
      return query;
    }),
    or: vi.fn((expr) => {
      ors.push(expr);
      return query;
    }),
    order: vi.fn().mockReturnThis(),
    then: (resolve, reject) => Promise.resolve({ data, error }).then(resolve, reject)
  };
  return { query, eqs, ors };
}

describe('briefing_id:unternehmen_id cascade', () => {
  afterEach(() => {
    delete window.supabase;
    vi.restoreAllMocks();
  });

  it('findet den Loader fuer Casting/Konzept', () => {
    const strategy = findStrategy({ name: 'briefing_id', dependsOn: 'unternehmen_id' });
    expect(typeof strategy).toBe('function');
  });

  it('laedt finalisierte Briefings ohne Markenfilter, wenn keine Marke gesetzt ist', async () => {
    const { query, eqs } = createQuery({
      data: [{ id: 'br-1', aktivierung_name: 'LIEBHERR vor Ort Produktion Ochsenhausen Oktober 26' }]
    });
    window.supabase = { from: vi.fn(() => query) };

    const field = { disabled: true };
    const ctx = {
      getFieldValue: () => '',
      setNoOptionsState: vi.fn(),
      updateDependentFieldOptions: vi.fn()
    };
    const form = {
      querySelector: (sel) => (sel === '[name="marke_id"]' ? { value: '' } : null)
    };

    const strategy = findStrategy({ name: 'briefing_id', dependsOn: 'unternehmen_id' });
    await strategy('u-liebherr', form, field, { name: 'briefing_id' }, ctx);

    expect(window.supabase.from).toHaveBeenCalledWith('campaign_briefings');
    expect(eqs).toEqual([
      ['unternehmen_id', 'u-liebherr'],
      ['is_draft', false]
    ]);
    expect(field.disabled).toBe(false);
    expect(ctx.updateDependentFieldOptions).toHaveBeenCalledWith(
      field,
      { name: 'briefing_id' },
      [{ value: 'br-1', label: 'LIEBHERR vor Ort Produktion Ochsenhausen Oktober 26' }]
    );
    expect(ctx.setNoOptionsState).not.toHaveBeenCalled();
  });

  it('filtert nach Marke, wenn eine Marke gewaehlt ist', async () => {
    const { query, eqs } = createQuery({
      data: [{ id: 'br-2', aktivierung_name: 'Brand Briefing' }]
    });
    window.supabase = { from: vi.fn(() => query) };

    const field = { disabled: true };
    const ctx = {
      getFieldValue: () => 'm-1',
      setNoOptionsState: vi.fn(),
      updateDependentFieldOptions: vi.fn()
    };
    const form = {
      querySelector: (sel) => (sel === '[name="marke_id"]' ? { value: 'm-1' } : null)
    };

    const strategy = findStrategy({ name: 'briefing_id', dependsOn: 'unternehmen_id' });
    await strategy('u-1', form, field, { name: 'briefing_id' }, ctx);

    expect(eqs).toEqual([
      ['unternehmen_id', 'u-1'],
      ['is_draft', false],
      ['marke_id', 'm-1']
    ]);
    expect(field.disabled).toBe(false);
  });

  it('zeigt den Leer-Hinweis statt des Initial-Placeholders', async () => {
    const { query } = createQuery({ data: [] });
    window.supabase = { from: vi.fn(() => query) };

    const field = { disabled: true };
    const ctx = {
      getFieldValue: () => '',
      setNoOptionsState: vi.fn(),
      updateDependentFieldOptions: vi.fn()
    };
    const form = {
      querySelector: (sel) => (sel === '[name="marke_id"]' ? { value: '' } : null)
    };

    const strategy = findStrategy({ name: 'briefing_id', dependsOn: 'unternehmen_id' });
    await strategy('u-empty', form, field, { name: 'briefing_id' }, ctx);

    expect(ctx.updateDependentFieldOptions).not.toHaveBeenCalled();
    expect(ctx.setNoOptionsState).toHaveBeenCalledTimes(1);
    const message = ctx.setNoOptionsState.mock.calls[0][2];
    expect(message).toContain('Kein finalisiertes Briefing vorhanden');
    expect(message).toContain('/briefing/new?unternehmen=u-empty');
  });
});

describe('briefing_id reloadOnChange', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('laedt Briefings neu, wenn die Marke wechselt', async () => {
    vi.useFakeTimers();
    const df = new DependentFields(null);
    df.dynamicDataLoader = {};
    df.getFormConfig = () => ({
      fields: [
        { name: 'unternehmen_id' },
        { name: 'marke_id' },
        {
          name: 'briefing_id',
          dependsOn: 'unternehmen_id',
          reloadOnChange: ['marke_id'],
          dynamic: true,
          table: 'campaign_briefings'
        }
      ]
    });

    document.body.innerHTML = `
      <form data-entity="sourcing">
        <select name="unternehmen_id">
          <option value="u1" selected>Liebherr</option>
        </select>
        <select name="marke_id">
          <option value="">Keine</option>
          <option value="m1">Marke</option>
        </select>
        <select name="briefing_id"></select>
      </form>
    `;
    const form = document.querySelector('form');
    const loadSpy = vi.spyOn(df, 'loadDependentFieldData').mockResolvedValue();

    df.setupFormDelegation(form);
    await vi.advanceTimersByTimeAsync(300);

    loadSpy.mockClear();
    const marke = form.querySelector('[name="marke_id"]');
    marke.value = 'm1';
    marke.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(150);

    expect(loadSpy).toHaveBeenCalled();
    const briefingReload = loadSpy.mock.calls.find((call) => call[1]?.name === 'briefing_id');
    expect(briefingReload).toBeTruthy();
    expect(briefingReload[2]).toBe('u1');
  });
});

describe('briefing_id:kampagne_id cascade', () => {
  afterEach(() => {
    delete window.supabase;
    vi.restoreAllMocks();
  });

  it('laedt nur finalisierte Briefings', async () => {
    const briefing = createQuery({
      data: [{ id: 'br-1', aktivierung_name: 'Final' }]
    });
    const kampagneQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({ data: { unternehmen_id: 'u1' }, error: null }))
    };
    window.supabase = {
      from: vi.fn((table) => (table === 'kampagne' ? kampagneQuery : briefing.query))
    };

    const field = { disabled: true };
    const ctx = { updateDependentFieldOptions: vi.fn() };
    const strategy = findStrategy({ name: 'briefing_id', dependsOn: 'kampagne_id' });
    await strategy('k1', {}, field, { name: 'briefing_id' }, ctx);

    expect(briefing.eqs).toEqual([
      ['unternehmen_id', 'u1'],
      ['is_draft', false]
    ]);
    expect(ctx.updateDependentFieldOptions).toHaveBeenCalledWith(
      field,
      { name: 'briefing_id' },
      [{ value: 'br-1', label: 'Final' }]
    );
  });
});

describe('auftrag_id cascade', () => {
  afterEach(() => {
    delete window.supabase;
    vi.restoreAllMocks();
  });

  it('filtert Auftrag-Entwuerfe (null oder false)', async () => {
    const { query, ors } = createQuery({
      data: [{ id: 'a1', auftragsname: 'Live', marke_id: null }]
    });
    window.supabase = { from: vi.fn(() => query) };

    const field = { disabled: true };
    const ctx = { updateDependentFieldOptions: vi.fn() };
    const form = { querySelector: () => ({ value: '' }) };
    const strategy = findStrategy({ name: 'auftrag_id', dependsOn: 'unternehmen_id' });
    await strategy('u1', form, field, { name: 'auftrag_id' }, ctx);

    expect(window.supabase.from).toHaveBeenCalledWith('auftrag');
    expect(ors).toEqual(['is_draft.is.null,is_draft.eq.false']);
  });
});
