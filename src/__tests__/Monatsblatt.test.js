import { beforeEach, describe, expect, it } from 'vitest';
import { ALL_TAB, UNDATED_TAB } from '../modules/auftrag/logic/InvoiceMonthFilter.js';
import { hydrateRechnungPdfs, loadCounts, loadRows } from '../modules/rechnung/Monatsblatt.js';

function createChain(table, resolveResult) {
  const calls = {
    table,
    select: null,
    selectOpts: null,
    eq: [],
    or: [],
    gte: [],
    lt: [],
    is: [],
    in: [],
    ilike: [],
    range: null
  };
  const query = {
    calls,
    select(columns, opts) {
      calls.select = columns;
      calls.selectOpts = opts || null;
      return query;
    },
    order() { return query; },
    eq(...args) { calls.eq.push(args); return query; },
    or(value) { calls.or.push(value); return query; },
    gte(...args) { calls.gte.push(args); return query; },
    lt(...args) { calls.lt.push(args); return query; },
    lte() { return query; },
    is(...args) { calls.is.push(args); return query; },
    in(...args) { calls.in.push(args); return query; },
    ilike(...args) { calls.ilike.push(args); return query; },
    range(from, to) { calls.range = [from, to]; return query; },
    then(resolve, reject) {
      return Promise.resolve(resolveResult(calls)).then(resolve, reject);
    }
  };
  return query;
}

function installSupabase({ rows = [], count = 0, pdfs = [], lookups = {} } = {}) {
  const queries = [];
  window.supabase = {
    from(table) {
      const query = createChain(table, (calls) => {
        if (table === 'rechnung' && calls.selectOpts?.head) {
          return { data: null, count, error: null };
        }
        if (table === 'rechnung') return { data: rows, error: null };
        if (table === 'rechnung_pdfs') return { data: pdfs, error: null };
        return { data: lookups[table] || [], error: null };
      });
      queries.push(query);
      return query;
    }
  };
  return queries;
}

function rechnungQueries(queries) {
  return queries.filter(query => query.calls.table === 'rechnung');
}

describe('Monatsblatt Rechnung', () => {
  beforeEach(() => {
    delete window.supabase;
  });

  it('wendet typeTab in der Query an', async () => {
    const queries = installSupabase({ rows: [{ id: 'r1' }] });
    await loadRows({ year: 2026, month: 0, typeTab: 'contracting' });

    const rowQuery = rechnungQueries(queries).find(query => !query.calls.selectOpts?.head);
    expect(rowQuery.calls.eq).toContainEqual(['rechnungstyp', 'contracting']);
  });

  it('laesst den Monatsfilter weg wenn search gesetzt ist', async () => {
    const queries = installSupabase({
      rows: [{ id: 'r1' }],
      lookups: { unternehmen: [{ id: 'u1' }] }
    });
    await loadRows({ year: 2026, month: 0, search: 'acme', typeTab: 'rechnung' });

    const rowQuery = rechnungQueries(queries).find(query => !query.calls.selectOpts?.head);
    expect(rowQuery.calls.gte).toEqual([]);
    expect(rowQuery.calls.lt).toEqual([]);
    expect(rowQuery.calls.is).toEqual([]);
    expect(rowQuery.calls.or.some(value => String(value).includes('rechnung_nr.ilike.%acme%'))).toBe(true);
    expect(rowQuery.calls.or.some(value => String(value).includes('unternehmen_id.in.(u1)'))).toBe(true);
  });

  it('wendet den Monatsfilter an wenn search leer ist', async () => {
    const queries = installSupabase({ rows: [{ id: 'r1' }] });
    await loadRows({ year: 2026, month: 0, search: '', typeTab: 'rechnung' });

    const rowQuery = rechnungQueries(queries).find(query => !query.calls.selectOpts?.head);
    expect(rowQuery.calls.gte).toContainEqual(['gestellt_am', '2026-01-01']);
    expect(rowQuery.calls.lt).toContainEqual(['gestellt_am', '2026-02-01']);
  });

  it('begrenzt Alle auf das gewaehlte Jahr', async () => {
    const queries = installSupabase({ rows: [{ id: 'r1' }], count: 4 });
    await loadRows({ year: 2026, month: ALL_TAB, typeTab: 'rechnung' });
    const result = await loadCounts({
      year: 2026,
      month: ALL_TAB,
      typeTab: 'rechnung',
      statusIds: ['alle', 'Offen']
    });

    const rowQuery = rechnungQueries(queries).find(query => !query.calls.selectOpts?.head);
    expect(rowQuery.calls.gte).toContainEqual(['gestellt_am', '2026-01-01']);
    expect(rowQuery.calls.lt).toContainEqual(['gestellt_am', '2027-01-01']);

    const alleQuery = rechnungQueries(queries).find(query =>
      query.calls.selectOpts?.head && query.calls.gte.some(args => args[0] === 'gestellt_am' && args[1] === '2026-01-01')
    );
    expect(alleQuery.calls.lt).toContainEqual(['gestellt_am', '2027-01-01']);
    expect(result.months.alle).toBe(4);
  });

  it('laedt PDFs separat und nicht im Row-Select', async () => {
    const pdfs = [{ id: 'p1', rechnung_id: 'r1', file_name: 'a.pdf', file_path: 'a.pdf', file_url: 'https://x/a.pdf' }];
    const queries = installSupabase({ rows: [{ id: 'r1' }], pdfs });

    const { rows } = await loadRows({ year: 2026, month: ALL_TAB, typeTab: 'rechnung' });

    const rowQuery = rechnungQueries(queries).find(query => !query.calls.selectOpts?.head);
    expect(String(rowQuery.calls.select)).not.toContain('rechnung_pdfs');
    expect(queries.some(query => query.calls.table === 'rechnung_pdfs')).toBe(false);
    expect(rows[0].rechnung_pdfs).toBeUndefined();

    await hydrateRechnungPdfs(rows);
    expect(queries.some(query => query.calls.table === 'rechnung_pdfs')).toBe(true);
    expect(rows[0].rechnung_pdfs).toEqual(pdfs);
  });

  it('zaehlt per HEAD statt Row-Dump', async () => {
    const queries = installSupabase({ count: 4 });
    const result = await loadCounts({
      year: 2026,
      month: UNDATED_TAB,
      typeTab: 'rechnung',
      statusIds: ['alle', 'Offen']
    });

    const countQueries = rechnungQueries(queries).filter(query => query.calls.selectOpts?.head);
    expect(countQueries.length).toBeGreaterThanOrEqual(14);
    expect(countQueries.every(query => query.calls.select === 'id' && query.calls.selectOpts.count === 'exact')).toBe(true);
    expect(countQueries.every(query => query.calls.select !== 'gestellt_am, status, rechnungstyp')).toBe(true);
    expect(result.months.alle).toBe(4);
    expect(result.type.rechnung).toBe(4);
    expect(result.type.contracting).toBe(4);
  });
});
