import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataPreparer } from '../core/data/DataPreparer.js';
import { EntityRegistry } from '../core/data/entities/index.js';
import { CustomDatePicker } from '../core/components/CustomDatePicker.js';
import { AuftragList } from '../modules/auftrag/AuftragList.js';

describe('Billing-Datumsfelder für Teilrechnungen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    window.currentUser = { rolle: 'admin' };
    window.dataService = { updateEntity: vi.fn() };
    window.toastSystem = { show: vi.fn() };
  });

  it('registriert nur die erlaubten Inline-Felder', () => {
    expect(EntityRegistry.auftrag_teilrechnung.table).toBe('auftrag_teilrechnung');
    expect(EntityRegistry.auftrag_teilrechnung.fields).toEqual({
      re_nr: 'string',
      externe_po: 'string',
      rechnung_gestellt: 'boolean',
      rechnung_gestellt_am: 'date',
      ueberwiesen: 'boolean',
      ueberwiesen_am: 'date',
      erwarteter_monat_zahlungseingang: 'date'
    });
  });

  it('bereitet Boolean und Datum für Supabase korrekt vor', async () => {
    const preparer = new DataPreparer();
    const result = await preparer.prepareDataForSupabase(
      {
        rechnung_gestellt: true,
        rechnung_gestellt_am: '2026-08-03'
      },
      EntityRegistry.auftrag_teilrechnung.fields,
      'auftrag_teilrechnung'
    );

    expect(result).toEqual({
      rechnung_gestellt: true,
      rechnung_gestellt_am: new Date('2026-08-03').toISOString()
    });
  });

  it('speichert ein Rechnungsdatum auf der Teilrechnung', async () => {
    const list = new AuftragList();
    window.dataService.updateEntity.mockResolvedValue({ success: true });
    document.body.innerHTML = CustomDatePicker.render({
      id: 'teilrechnung-1',
      entity: 'auftrag_teilrechnung',
      field: 'rechnung_gestellt',
      dateField: 'rechnung_gestellt_am',
      value: '2026-08-01',
      inputClass: 'auftrag-inline-date-input'
    });
    const input = document.querySelector('.auftrag-inline-date-input');
    input.dataset.isoValue = '2026-08-03';

    await list.handleInlineBillingDateChange(input);

    expect(window.dataService.updateEntity).toHaveBeenCalledWith(
      'auftrag_teilrechnung',
      'teilrechnung-1',
      {
        rechnung_gestellt_am: '2026-08-03',
        rechnung_gestellt: true
      }
    );
    expect(input.dataset.previousValue).toBe('2026-08-03');
  });

  it('stellt bei einem fehlgeschlagenen Update den vorherigen Wert wieder her', async () => {
    const list = new AuftragList();
    window.dataService.updateEntity.mockResolvedValue({
      success: false,
      error: 'Update fehlgeschlagen'
    });
    document.body.innerHTML = CustomDatePicker.render({
      id: 'teilrechnung-1',
      entity: 'auftrag_teilrechnung',
      field: 'ueberwiesen',
      dateField: 'ueberwiesen_am',
      value: '2026-08-01',
      inputClass: 'auftrag-inline-date-input'
    });
    const input = document.querySelector('.auftrag-inline-date-input');
    input.dataset.isoValue = '2026-08-03';

    await list.handleInlineBillingDateChange(input);

    expect(input.dataset.isoValue).toBe('2026-08-01');
    expect(window.toastSystem.show).toHaveBeenCalledWith(
      'Aktualisierung fehlgeschlagen',
      'error'
    );
  });

  it('synchronisiert den Picker über data-date-field', () => {
    const list = new AuftragList();
    document.body.innerHTML = `
      <table class="data-table">
        <tbody>
          <tr data-tr-id="teilrechnung-1">
            <td class="beliebige-spalte">
              ${CustomDatePicker.render({
                id: 'teilrechnung-1',
                entity: 'auftrag_teilrechnung',
                field: 'rechnung_gestellt',
                dateField: 'rechnung_gestellt_am',
                inputClass: 'auftrag-inline-date-input'
              })}
            </td>
          </tr>
        </tbody>
      </table>
    `;

    list.syncInlineBillingUpdate(
      'teilrechnung-1',
      'rechnung_gestellt_am',
      '2026-08-03'
    );

    const input = document.querySelector('.auftrag-inline-date-input');
    expect(input.dataset.isoValue).toBe('2026-08-03');
    expect(input.dataset.previousValue).toBe('2026-08-03');
  });

  it('synchronisiert alle Picker mit demselben date-field', () => {
    const list = new AuftragList();
    document.body.innerHTML = `
      <table class="data-table">
        <tbody>
          <tr data-tr-id="teilrechnung-1">
            <td>
              ${CustomDatePicker.render({
                id: 'teilrechnung-1',
                entity: 'auftrag_teilrechnung',
                field: 'rechnung_gestellt',
                dateField: 'rechnung_gestellt_am',
                inputClass: 'auftrag-inline-date-input'
              })}
            </td>
            <td>
              ${CustomDatePicker.render({
                id: 'teilrechnung-1',
                entity: 'auftrag_teilrechnung',
                field: 'rechnung_gestellt',
                dateField: 'rechnung_gestellt_am',
                inputClass: 'auftrag-inline-date-input'
              })}
            </td>
          </tr>
        </tbody>
      </table>
    `;

    list.syncInlineBillingUpdate(
      'teilrechnung-1',
      'rechnung_gestellt_am',
      '2026-08-03'
    );

    const inputs = document.querySelectorAll('.auftrag-inline-date-input');
    expect(inputs).toHaveLength(2);
    inputs.forEach(input => {
      expect(input.dataset.isoValue).toBe('2026-08-03');
      expect(input.dataset.previousValue).toBe('2026-08-03');
    });
  });
});
