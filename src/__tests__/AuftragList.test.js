import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuftragList } from '../modules/auftrag/AuftragList.js';

describe('AuftragList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    window.currentUser = { rolle: 'admin' };
    window.validatorSystem = { sanitizeHtml: (value) => value };
    window.navigateTo = vi.fn();
  });

  it('rendert schlanke Auftraege-Spalten (Admin) ohne Rechnungsspalten', () => {
    const list = new AuftragList();
    document.body.innerHTML = list.renderListView();

    const headers = [...document.querySelectorAll('thead th')]
      .map((header) => header.textContent.trim())
      .filter(Boolean);

    expect(headers).toEqual([
      'Unternehmen',
      'Marke',
      'Details',
      'Angebotsnummer',
      'Zahlungsziel',
      'Leistungszeitraum',
      'Teilrechnungen',
      'Betrag netto',
      'Mehrwertsteuer',
      'Betrag brutto',
      'Rechnungskontakte',
      'Erstellt von',
      'Status',
      'Aktionen'
    ]);
    expect(headers).not.toContain('Rechnungsnummer');
    expect(headers).not.toContain('Externe PO');
    expect(headers).not.toContain('Ansprechpartner');
  });

  it('blendet Details, Rechnungskontakte und Aktionen fuer Kunden aus', () => {
    window.currentUser = { rolle: 'kunde' };
    const list = new AuftragList();
    list._kundeHasMultipleMarken = true;
    document.body.innerHTML = list.renderListView();

    const headers = [...document.querySelectorAll('thead th')]
      .map((header) => header.textContent.trim())
      .filter(Boolean);

    expect(headers).not.toContain('Details');
    expect(headers).not.toContain('Rechnungskontakte');
    expect(headers).not.toContain('Aktionen');
    expect(headers).toContain('Leistungszeitraum');
    expect(headers).toContain('Teilrechnungen');
  });

  it('rendert Legacy-Spalten im Contracts-Modus', () => {
    const list = new AuftragList();
    document.body.innerHTML = list.renderListView('contracts');

    const headers = [...document.querySelectorAll('thead th')]
      .map((header) => header.textContent.trim())
      .filter(Boolean);

    expect(headers).toContain('Rechnungsnummer');
    expect(headers).toContain('Externe PO');
    expect(headers).toContain('Ansprechpartner');
    expect(headers).not.toContain('Leistungszeitraum');
    expect(headers).not.toContain('Rechnungskontakte');
  });

  it('laedt Erstellt-von per auth_user_id nach, wenn die Relation leer ist', async () => {
    const list = new AuftragList();
    const byBenutzerId = [];
    const byAuthUserId = [{
      id: 'benutzer-1',
      auth_user_id: 'auth-user-1',
      name: 'Oliver Mackeldanz',
      profile_image_url: null,
      profile_image_thumb_url: null
    }];

    const createQuery = (data) => ({
      select: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({ data, error: null }))
      }))
    });

    const benutzerQueries = [createQuery(byBenutzerId), createQuery(byAuthUserId)];
    window.supabase = {
      from: vi.fn((table) => {
        if (table !== 'benutzer') throw new Error(`Unexpected table ${table}`);
        return benutzerQueries.shift();
      })
    };

    const users = await list.loadCreatedByFallbacks([
      { id: 'auftrag-1', created_by_id: 'auth-user-1', created_by: null }
    ]);

    expect(users.get('auth-user-1')?.name).toBe('Oliver Mackeldanz');
  });

  it('zeigt den Auftragsnamen in der Details-Spalte als Link zu den Auftragsdetails', async () => {
    const list = new AuftragList();
    document.body.innerHTML = '<table class="data-table auftrag-table"><tbody></tbody></table>';

    await list.updateTable([{
      id: 'auftrag-1',
      auftragsname: 'Creator Paket April',
      auftragsdetails_id: 'details-1',
      unternehmen: { firmenname: 'Firma', internes_kuerzel: 'F' },
      marke: { markenname: 'Marke' },
      created_by: { id: 'user-1', name: 'Oliver' }
    }]);

    const detailsCell = document.querySelector('td.col-details');
    const link = detailsCell.querySelector('a');

    expect(link.textContent.trim()).toBe('Creator Paket April');
    expect(link.getAttribute('onclick')).toContain('/auftragsdetails/details-1');
    expect(document.querySelector('td.col-auftrag')).toBeNull();
  });
});
