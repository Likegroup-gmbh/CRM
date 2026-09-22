import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadDirectQueryOptions } from '../core/form/data/DirectQueryLoader.js';

function createQuery({ data = [] } = {}) {
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
    then: (resolve, reject) => Promise.resolve({ data, error: null }).then(resolve, reject)
  };
  return { query, eqs, ors };
}

function fakeForm(parentValue = 'u1') {
  return {
    dataset: {},
    querySelector: () => ({ value: parentValue })
  };
}

describe('DirectQueryLoader Final-Filter', () => {
  afterEach(() => {
    delete window.supabase;
    vi.restoreAllMocks();
  });

  it('filtert campaign_briefings per filterBy auf is_draft=false', async () => {
    const { query, eqs } = createQuery({
      data: [{ id: 'b1', aktivierung_name: 'Final' }]
    });
    window.supabase = { from: vi.fn(() => query) };

    const options = await loadDirectQueryOptions({
      table: 'campaign_briefings',
      filterBy: 'unternehmen_id',
      displayField: 'aktivierung_name',
      valueField: 'id',
      name: 'briefing_ids'
    }, fakeForm());

    expect(window.supabase.from).toHaveBeenCalledWith('campaign_briefings');
    expect(eqs).toEqual([
      ['unternehmen_id', 'u1'],
      ['is_draft', false]
    ]);
    expect(options).toEqual([{ value: 'b1', label: 'Final', description: undefined }]);
  });

  it('includeDrafts lässt Entwürfe im Briefing-Picker', async () => {
    const { query, eqs } = createQuery({
      data: [{ id: 'b2', aktivierung_name: 'Entwurf' }]
    });
    window.supabase = { from: vi.fn(() => query) };

    const options = await loadDirectQueryOptions({
      table: 'campaign_briefings',
      filterBy: 'unternehmen_id',
      displayField: 'aktivierung_name',
      valueField: 'id',
      name: 'briefing_ids',
      includeDrafts: true
    }, fakeForm());

    expect(eqs).toEqual([['unternehmen_id', 'u1']]);
    expect(options).toEqual([{ value: 'b2', label: 'Entwurf', description: undefined }]);
  });

  it('filtert vertraege per filterBy auf is_draft=false', async () => {
    const { query, eqs } = createQuery({ data: [] });
    window.supabase = { from: vi.fn(() => query) };

    await loadDirectQueryOptions({
      table: 'vertraege',
      filterBy: 'kooperation_id',
      displayField: 'name',
      valueField: 'id',
      name: 'vertrag_id'
    }, fakeForm('k1'));

    expect(eqs).toEqual([
      ['kooperation_id', 'k1'],
      ['is_draft', false]
    ]);
  });

  it('laesst Tabellen ohne is_draft unangetastet', async () => {
    const { query, eqs } = createQuery({
      data: [{ id: 'm1', markenname: 'ACME' }]
    });
    window.supabase = { from: vi.fn(() => query) };

    await loadDirectQueryOptions({
      table: 'marke',
      filterBy: 'unternehmen_id',
      displayField: 'markenname',
      valueField: 'id',
      name: 'marke_ids'
    }, fakeForm());

    expect(eqs).toEqual([['unternehmen_id', 'u1']]);
  });
});
