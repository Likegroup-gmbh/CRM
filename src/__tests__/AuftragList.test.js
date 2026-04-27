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

  it('rendert externe PO nach Rechnungsnummer und Details am Ende ohne Auftrag-Spalte', () => {
    const list = new AuftragList();
    document.body.innerHTML = list.renderListView();

    const headers = [...document.querySelectorAll('thead th')]
      .map((header) => header.textContent.trim())
      .filter(Boolean);

    expect(headers).toEqual([
      'Unternehmen',
      'Marke',
      'Angebotsnummer',
      'Rechnungsnummer',
      'Externe PO',
      'Rechnungsdatum',
      'Zahlungsziel',
      'Rechnungsfälligkeit',
      'Betrag netto',
      'Umsatzsteuer',
      'Betrag brutto',
      'Rechnung gestellt',
      'Überwiesen',
      'Bezahlt am',
      'Ansprechpartner',
      'Erstellt von',
      'Status',
      'Details',
      'Aktionen'
    ]);
    expect(headers).not.toContain('Auftrag');
    expect(headers).not.toContain('Interne PO');
  });

  it('blendet Auftrag und Details fuer Kunden aus', () => {
    window.currentUser = { rolle: 'kunde' };
    const list = new AuftragList();
    list._kundeHasMultipleMarken = true;
    document.body.innerHTML = list.renderListView();

    const headers = [...document.querySelectorAll('thead th')]
      .map((header) => header.textContent.trim())
      .filter(Boolean);

    expect(headers).not.toContain('Auftrag');
    expect(headers).not.toContain('Details');
    expect(headers).toContain('Externe PO');
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
