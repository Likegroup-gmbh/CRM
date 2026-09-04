// Regressionstests fuer die Kette Auftrag-Bearbeiten → Stakeholder / Kundenrechnungen.
// Frueher liefen Auftragsbetraege ueber zwei Speicherpfade und drei Datumsregeln
// auseinander, sodass die Monatsuebersichten alte Zahlen zeigten.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../modules/auth/CurrentUser.js', () => ({
  getCurrentBenutzerId: vi.fn(async () => 'user-1')
}));

import { ModuleRegistry } from '../core/ModuleRegistry.js';
import { ProjektErstellenPersistence } from '../modules/projekt-erstellen/services/ProjektErstellenPersistence.js';
import { ProjektErstellenWizard } from '../modules/projekt-erstellen/ProjektErstellenWizard.js';
import { resolveVolumen } from '../modules/stakeholder/StakeholderOverviewPage.js';
import { AusgangsrechnungenList } from '../modules/ausgangsrechnungen/AusgangsrechnungenList.js';
import { StepDetails } from '../modules/projekt-erstellen/steps/StepDetails.js';

describe('Auftrag-Edit landet immer im Wizard', () => {
  beforeEach(() => {
    delete window.guestShare;
    window.currentUser = { rolle: 'admin' };
    window.toastSystem = { show: vi.fn() };
    window.content = document.createElement('div');
    window.setHeadline = vi.fn();
  });

  it('schickt /auftrag/:id/edit zum Wizard statt zum alten FormSystem', async () => {
    const registry = new ModuleRegistry();
    const auftragDetail = { init: vi.fn(), showEditForm: vi.fn(), initForEdit: vi.fn() };
    const wizard = { init: vi.fn(), initForEdit: vi.fn() };
    registry.register('auftrag-detail', auftragDetail);
    registry.register('projekt-erstellen', wizard);

    await registry.navigateTo('/auftrag/a-1/edit', true);

    expect(wizard.initForEdit).toHaveBeenCalledWith('a-1');
    expect(auftragDetail.showEditForm).not.toHaveBeenCalled();
    expect(auftragDetail.initForEdit).not.toHaveBeenCalled();
  });

  it('schickt auch /contracts/:id/edit zum Wizard', async () => {
    const registry = new ModuleRegistry();
    const wizard = { init: vi.fn(), initForEdit: vi.fn() };
    registry.register('contracts-detail', { init: vi.fn(), showEditForm: vi.fn() });
    registry.register('projekt-erstellen', wizard);

    await registry.navigateTo('/contracts/c-1/edit', true);

    expect(wizard.initForEdit).toHaveBeenCalledWith('c-1');
  });

  // Interne Redirects liefen frueher ueber navigateTo und wurden vom
  // Reentrancy-Flag verschluckt, die Seite blieb dann einfach leer.
  it('fuehrt auch die uebrigen Wizard-Redirects wirklich aus', async () => {
    const registry = new ModuleRegistry();
    const wizard = { init: vi.fn(), initForEdit: vi.fn() };
    registry.register('projekt-erstellen', wizard);
    registry.register('auftrag', { init: vi.fn() });

    await registry.navigateTo('/auftrag/new', true);

    expect(wizard.init).toHaveBeenCalled();
  });

  it('laesst die Detailansicht ohne /edit unberuehrt', async () => {
    const registry = new ModuleRegistry();
    const auftragDetail = { init: vi.fn() };
    registry.register('auftrag-detail', auftragDetail);
    registry.register('projekt-erstellen', { init: vi.fn(), initForEdit: vi.fn() });

    await registry.navigateTo('/auftrag/a-1', true);

    expect(auftragDetail.init).toHaveBeenCalledWith('a-1');
  });
});

describe('Wizard sammelt nur gemountete Steps', () => {
  it('uebernimmt Werte des gerenderten Steps und laesst die anderen in Ruhe', () => {
    const wizard = new ProjektErstellenWizard(document.createElement('div'));
    wizard.formData.auftrag.nettobetrag = 5000;
    wizard.formData.auftrag.titel = 'Bestehender Titel';

    wizard.steps = [
      {
        isMounted: () => false,
        collectData: () => ({ auftrag: { titel: '' } })
      },
      {
        isMounted: () => true,
        collectData: () => ({ auftrag: { nettobetrag: 7500 } })
      }
    ];

    wizard.collectMountedSteps();

    expect(wizard.formData.auftrag.nettobetrag).toBe(7500);
    expect(wizard.formData.auftrag.titel).toBe('Bestehender Titel');
  });
});

describe('Contracting speichert Agenturleistungen in auftrag_details', () => {
  let upserted;
  let persistence;

  beforeEach(() => {
    upserted = {};
    persistence = new ProjektErstellenPersistence();
    window.supabase = {
      from: vi.fn((table) => ({
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        insert: vi.fn(async () => ({ error: null })),
        upsert: vi.fn(async (payload) => {
          upserted[table] = payload;
          return { error: null };
        })
      }))
    };
  });

  it('upsertet Fee und KSK beim Contracting-Edit', async () => {
    const result = await persistence.submitEditContracting({
      auftragId: 'auftrag-1',
      existingRaw: { auftrag: { status: 'Beauftragt', is_draft: false } },
      formData: {
        auftrag: { auftragtype: 'Contracting', nettobetrag: 12000 },
        details: {
          agency_services_enabled: true,
          percentage_fee_enabled: true,
          percentage_fee_value: 1500,
          ksk_enabled: true,
          ksk_value: 300
        }
      }
    });

    expect(result.success).toBe(true);
    expect(upserted.auftrag_details[0]).toMatchObject({
      auftrag_id: 'auftrag-1',
      agency_services_enabled: true,
      percentage_fee_enabled: true,
      percentage_fee_value: 1500,
      ksk_enabled: true,
      ksk_value: 300
    });
  });
});

describe('Anzahl Teilrechnungen aendern', () => {
  function createStep(auftrag) {
    const wizard = new ProjektErstellenWizard(document.createElement('div'));
    Object.assign(wizard.formData.auftrag, auftrag);
    return new StepDetails(wizard);
  }

  it('behaelt Betraege, Daten und Bezahlt-Flags der vorhandenen Teilrechnungen', () => {
    const step = createStep({
      nettobetrag: 3000,
      teilrechnungen: [{
        position: 1,
        nettobetrag: 1000,
        ust_betrag: 190,
        bruttobetrag: 1190,
        re_nr: 'RE-1',
        externe_po: 'PO-1',
        rechnung_gestellt: true,
        rechnung_gestellt_am: '2026-02-01',
        re_faelligkeit: '2026-03-01',
        erwarteter_monat_zahlungseingang: '2026-03-15',
        notiz: 'Anzahlung',
        ueberwiesen: true,
        ueberwiesen_am: '2026-03-10'
      }]
    });

    step._resizeTeilrechnungen(3);

    const [erste, zweite, dritte] = step.wizard.formData.auftrag.teilrechnungen;
    expect(erste).toMatchObject({
      position: 1,
      nettobetrag: 1000,
      re_nr: 'RE-1',
      externe_po: 'PO-1',
      rechnung_gestellt_am: '2026-02-01',
      re_faelligkeit: '2026-03-01',
      erwarteter_monat_zahlungseingang: '2026-03-15',
      notiz: 'Anzahlung',
      ueberwiesen: true,
      ueberwiesen_am: '2026-03-10'
    });
    // Restbetrag 2000 auf die zwei neuen Teilrechnungen
    expect(zweite.nettobetrag).toBe(1000);
    expect(dritte.nettobetrag).toBe(1000);
    expect(step.wizard.formData.auftrag.nettobetrag).toBe(3000);
  });

  it('zieht beim Verkleinern den Auftrags-Nettobetrag nach', () => {
    const step = createStep({
      nettobetrag: 3000,
      teilrechnungen: [
        { position: 1, nettobetrag: 1000, re_nr: 'RE-1' },
        { position: 2, nettobetrag: 1000, re_nr: 'RE-2' },
        { position: 3, nettobetrag: 1000, re_nr: 'RE-3' }
      ]
    });

    step._resizeTeilrechnungen(2);

    const trs = step.wizard.formData.auftrag.teilrechnungen;
    expect(trs).toHaveLength(2);
    expect(trs.map(tr => tr.re_nr)).toEqual(['RE-1', 'RE-2']);
    expect(step.wizard.formData.auftrag.nettobetrag).toBe(2000);
  });
});

describe('Stakeholder-Volumen', () => {
  const auftrag = { nettobetrag: 20000 };
  const blocks = [{ umsatz_netto: 8000 }, { umsatz_netto: 4000 }];

  it('nimmt im GESAMT-Tab den Auftrags-Nettobetrag', () => {
    expect(resolveVolumen(auftrag, blocks, 'gesamt')).toBe(20000);
  });

  it('nimmt im Kategorie-Tab die Summe der Block-Umsaetze', () => {
    expect(resolveVolumen(auftrag, blocks, 'ugc_paid')).toBe(12000);
  });

  it('faellt ohne gepflegten Block-Umsatz auf den Nettobetrag zurueck', () => {
    expect(resolveVolumen(auftrag, [{ umsatz_netto: null }], 'contracting')).toBe(20000);
    expect(resolveVolumen(auftrag, [], 'contracting')).toBe(20000);
  });
});

describe('Kundenrechnungen-Monatssummen', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.currentUser = { rolle: 'admin' };
    window.validatorSystem = { sanitizeHtml: value => value };
  });

  it('summiert Netto, MwSt und Brutto der uebergebenen Zeilen', () => {
    const list = new AusgangsrechnungenList();
    expect(list.sumInvoiceRows([
      { nettobetrag: 1000, ust_betrag: 190, bruttobetrag: 1190 },
      { nettobetrag: '2500.50', ust_betrag: '475.10', bruttobetrag: '2975.60' },
      { nettobetrag: null }
    ])).toEqual({
      nettobetrag: 3500.5,
      ust_betrag: 665.1,
      bruttobetrag: 4165.6
    });
  });

  it('schreibt die Summen in den tfoot der sichtbaren Zeilen', () => {
    const list = new AusgangsrechnungenList();
    document.body.innerHTML = list.renderListView();

    list.updateInvoiceSummary([
      { nettobetrag: 1000, ust_betrag: 190, bruttobetrag: 1190 },
      { nettobetrag: 1000, ust_betrag: 190, bruttobetrag: 1190 }
    ]);

    const foot = document.getElementById('ausgangsrechnungen-summary');
    expect(foot.querySelector('[data-summary="nettobetrag"]').textContent)
      .toBe(list.formatSummaryCurrency(2000));
    expect(foot.querySelector('[data-summary="ust_betrag"]').textContent)
      .toBe(list.formatSummaryCurrency(380));
    expect(foot.querySelector('[data-summary="bruttobetrag"]').textContent)
      .toBe(list.formatSummaryCurrency(2380));
  });

  it('haelt die tfoot-Breite auf der Spaltenzahl der Tabelle', () => {
    const list = new AusgangsrechnungenList();
    document.body.innerHTML = list.renderListView();

    const cells = [...document.querySelectorAll('#ausgangsrechnungen-summary td')];
    const spans = cells.reduce((sum, td) => sum + (parseInt(td.colSpan, 10) || 1), 0);
    expect(spans).toBe(list.getListColumnCount());
  });
});
