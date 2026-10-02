import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadDirectQueryOptions } from '../core/form/data/DirectQueryLoader.js';
import { kooperationConfig } from '../core/form/config/KooperationFormConfig.js';
import { EntityRegistry } from '../core/data/entities/index.js';
import KooperationDataModule from '../core/data/entities/KooperationDataModule.js';
import { DataPreparer } from '../core/data/DataPreparer.js';
import { DynamicDataLoader } from '../core/form/data/DynamicDataLoader.js';
import { summiereBuchungenNachJahr } from '../modules/admin/mitarbeiterBuchungen.js';
import { renderBudget } from '../modules/admin/MitarbeiterDetailRendererTables.js';

function benutzerQuery(rows) {
  const query = {
    select: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: (resolve, reject) => Promise.resolve({ data: rows, error: null }).then(resolve, reject)
  };
  return query;
}

const MITARBEITER = [
  { id: 'u-anna', name: 'Anna' },
  { id: 'u-ben', name: 'Ben' }
];

const assigneeField = () => kooperationConfig.fields.find(f => f.name === 'assignee_id');

describe('Kooperation: Feld assignee_id', () => {
  it('steht als Pflicht-Select auf benutzer im Formular', () => {
    const field = assigneeField();
    expect(field).toMatchObject({
      type: 'select',
      required: true,
      searchable: true,
      table: 'benutzer',
      displayField: 'name',
      defaultCurrentUser: true,
      section: 'zuordnung'
    });
  });

  it('steht in EntityRegistry und im DataModule', () => {
    expect(EntityRegistry.kooperation.fields.assignee_id).toBe('uuid');
    expect(KooperationDataModule.config.fields.assignee_id).toBe('uuid');
    expect(EntityRegistry.kooperation.relations.assignee.table).toBe('benutzer');
  });

  it('übersteht die Aufbereitung für Supabase', async () => {
    const preparer = new DataPreparer();
    const data = await preparer.prepareDataForSupabase(
      { name: 'Test', assignee_id: 'u-anna' },
      EntityRegistry.kooperation.fields,
      'kooperation'
    );
    expect(data.assignee_id).toBe('u-anna');
  });

  it('wird beim Leeren als null gespeichert', async () => {
    const preparer = new DataPreparer();
    const data = await preparer.prepareDataForSupabase(
      { name: 'Test', assignee_id: '' },
      EntityRegistry.kooperation.fields,
      'kooperation'
    );
    expect(data.assignee_id).toBeNull();
  });
});

describe('DirectQueryLoader defaultCurrentUser', () => {
  afterEach(() => {
    delete window.supabase;
    delete window.currentUser;
  });

  const load = (form) => {
    window.supabase = { from: vi.fn(() => benutzerQuery(MITARBEITER)) };
    return loadDirectQueryOptions(assigneeField(), form);
  };

  it('wählt beim Anlegen den eingeloggten User vor', async () => {
    window.currentUser = { id: 'u-ben' };
    const options = await load({ dataset: {} });
    expect(options.find(o => o.value === 'u-ben').selected).toBe(true);
    expect(options.find(o => o.value === 'u-anna').selected).toBeUndefined();
  });

  it('wählt im Edit-Modus nichts vor', async () => {
    window.currentUser = { id: 'u-ben' };
    const options = await load({ dataset: { isEditMode: 'true' } });
    expect(options.some(o => o.selected)).toBe(false);
  });

  it('wählt nichts vor, wenn der User nicht in der Liste steht', async () => {
    window.currentUser = { id: 'u-kunde' };
    const options = await load({ dataset: {} });
    expect(options.some(o => o.selected)).toBe(false);
  });
});

describe('Kooperationsformular: Mitarbeiter-Select im Anlegen-Flow', () => {
  afterEach(() => {
    delete window.supabase;
    delete window.currentUser;
    delete window.dataService;
    document.body.innerHTML = '';
  });

  const formWithSelect = (isEditMode = false) => {
    document.body.innerHTML = `
      <form id="kooperation-form" ${isEditMode ? 'data-is-edit-mode="true"' : ''}>
        <select name="assignee_id" data-searchable="true" required></select>
      </form>`;
    return document.getElementById('kooperation-form');
  };

  it('übergibt dem Searchable den eingeloggten User als vorgewählt', async () => {
    window.currentUser = { id: 'u-anna' };
    window.dataService = {};
    window.supabase = { from: vi.fn(() => benutzerQuery(MITARBEITER)) };
    const reinit = vi.fn();
    const loader = new DynamicDataLoader({
      getFormConfig: () => kooperationConfig,
      reinitializeSearchableSelect: reinit
    });
    const form = formWithSelect();

    await loader.loadFieldOptions('kooperation', assigneeField(), form);

    expect(reinit).toHaveBeenCalledTimes(1);
    const [select, options] = reinit.mock.calls[0];
    expect(options).toEqual([
      { value: 'u-anna', label: 'Anna', selected: true },
      { value: 'u-ben', label: 'Ben', selected: false }
    ]);
    expect(select.value).toBe('u-anna');
  });
});

describe('summiereBuchungenNachJahr', () => {
  it('summiert Einkauf, Verkauf und Marge pro Kalenderjahr, neuestes zuerst', () => {
    const rows = summiereBuchungenNachJahr([
      { created_at: '2026-03-01T10:00:00Z', einkaufspreis_netto: 1000, verkaufspreis_netto: 1500 },
      { created_at: '2026-06-01T10:00:00Z', einkaufspreis_netto: '200.10', verkaufspreis_netto: '300.20' },
      { created_at: '2025-11-15T10:00:00Z', einkaufspreis_netto: 500, verkaufspreis_netto: 400 }
    ]);

    expect(rows).toEqual([
      { jahr: 2026, anzahl: 2, einkauf: 1200.1, verkauf: 1800.2, marge: 600.1 },
      { jahr: 2025, anzahl: 1, einkauf: 500, verkauf: 400, marge: -100 }
    ]);
  });

  it('behandelt fehlende Preise als 0 und ordnet Einträge ohne Datum ans Ende', () => {
    const rows = summiereBuchungenNachJahr([
      { created_at: null, einkaufspreis_netto: 10, verkaufspreis_netto: null },
      { created_at: '2026-01-02T10:00:00Z', einkaufspreis_netto: null, verkaufspreis_netto: null }
    ]);

    expect(rows.map(r => r.jahr)).toEqual([2026, null]);
    expect(rows[1]).toMatchObject({ anzahl: 1, einkauf: 10, verkauf: 0, marge: -10 });
  });

  it('liefert ohne Kooperationen eine leere Liste', () => {
    expect(summiereBuchungenNachJahr([])).toEqual([]);
    expect(summiereBuchungenNachJahr(undefined)).toEqual([]);
  });
});

describe('Mitarbeiter-Budget-Tab: Eigene Buchungen', () => {
  const formatCurrency = (v) => `${v} EUR`;

  const detail = (eigeneKoops) => ({
    formatCurrency,
    assignments: { kooperationen: [] },
    budget: {
      invoicesByKoop: {},
      totals: { netto: 0, zusatz: 0, gesamt: 0, invoice_netto: 0, invoice_brutto: 0 },
      eigeneKoops
    }
  });

  afterEach(() => {
    delete window.validatorSystem;
  });

  it('zeigt den Leerzustand, wenn nichts zugeordnet ist', () => {
    window.validatorSystem = { sanitizeHtml: (v) => v };
    const html = renderBudget(detail([]));
    expect(html).toContain('Eigene Buchungen');
    expect(html).toContain('Noch keine eigenen Buchungen');
    expect(html).toContain('Kooperationen der zugeordneten Firmen');
  });

  it('zeigt Jahressumme und Zeilen der eigenen Kooperationen getrennt von der Firmenliste', () => {
    window.validatorSystem = { sanitizeHtml: (v) => v };
    const html = renderBudget(detail([
      {
        id: 'k1',
        name: 'Koop A',
        created_at: '2026-04-01T10:00:00Z',
        kampagne: { kampagnenname: 'Kamp' },
        einkaufspreis_netto: 1000,
        verkaufspreis_netto: 1400
      }
    ]));

    expect(html).toContain('Koop A');
    expect(html).toContain('2026');
    expect(html).toContain('1000 EUR');
    expect(html).toContain('1400 EUR');
    expect(html).toContain('400 EUR');
    expect(html).not.toContain('Noch keine eigenen Buchungen');
  });
});
