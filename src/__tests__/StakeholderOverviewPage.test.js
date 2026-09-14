import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StakeholderOverviewPage, elapsedRatio, groupRowsByKundeMarke } from '../modules/stakeholder/StakeholderOverviewPage.js';
import { calculateMonatsauswertung } from '../core/budget/monatsauswertung.js';
import { calculateRechnungsstatus } from '../core/budget/rechnungsstatus.js';
import { invalidateFinanzbestand } from '../core/budget/finanzbestand.js';

// Jede Page bindet document-weite Listener und rendert in das globale
// window.content. Ohne Cleanup reagieren Pages aus frueheren Tests auf
// Events spaeterer Tests und ueberschreiben deren DOM. Deshalb zentral
// registrieren und nach jedem Test zerstoeren.
const createdPages = [];
function createPage() {
  const page = new StakeholderOverviewPage();
  createdPages.push(page);
  return page;
}

function createMockSupabase({ auftraege = [], blocks = [], kampagnen = [], kooperationen = [], videos = [], details = [], unternehmen = [], rechnungen = [], teilrechnungen = [], berichtsstaende = [], berichtsstandById = null, onBerichtsstandInsert = null } = {}) {
  const tableData = {
    auftrag: { data: auftraege, error: null },
    auftrag_kampagnenart_blocks: { data: blocks, error: null },
    kampagne: { data: kampagnen, error: null },
    kooperationen: { data: kooperationen, error: null },
    kooperation_videos: { data: videos, error: null },
    auftrag_details: { data: details, error: null },
    unternehmen: { data: unternehmen, error: null },
    rechnung: { data: rechnungen, error: null },
    auftrag_teilrechnung: { data: teilrechnungen, error: null }
  };

  // fetchAllRows kettet select().order().range(); die erste Seite liefert
  // hier immer alle Mock-Zeilen (< 1000), also stoppt die Pagination.
  // berichtsstand hat eigene Ketten: Liste (select().order()), einzelner
  // Stand (select().eq().single()) und Sichern (insert().select().single()).
  return {
    from: vi.fn((table) => {
      if (table === 'berichtsstand') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: berichtsstaende, error: null })),
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve(
                berichtsstandById
                  ? { data: berichtsstandById, error: null }
                  : { data: null, error: new Error('nicht gefunden') }
              ))
            }))
          })),
          insert: vi.fn((row) => {
            onBerichtsstandInsert?.(row);
            return {
              select: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({
                  data: { id: 'b-neu', created_at: '2026-09-09T12:00:00Z', label: row.label },
                  error: null
                }))
              }))
            };
          })
        };
      }
      return {
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            range: vi.fn(() => Promise.resolve(tableData[table] || { data: [], error: null }))
          }))
        }))
      };
    })
  };
}

describe('StakeholderOverviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.setHeadline = vi.fn();
    window.setContentSafely = vi.fn();
    window.content = document.createElement('div');
    window.isAdmin = vi.fn(() => true);
    window.validatorSystem = { sanitizeHtml: (v) => v || '' };
  });

  afterEach(() => {
    while (createdPages.length) createdPages.pop().destroy();
    window.content?.remove();
    invalidateFinanzbestand();
  });

  it('zeigt Zugriffsfehler für Nicht-Admins', async () => {
    window.isAdmin = vi.fn(() => false);
    window.canViewAccounting = vi.fn(() => false);
    const page = createPage();
    await page.init();
    expect(window.setContentSafely).toHaveBeenCalledWith(
      window.content,
      expect.stringContaining('Kein Zugriff')
    );
  });

  it('lädt als Investor und blendet Berichtsstand sichern aus', async () => {
    window.isAdmin = vi.fn(() => false);
    window.canViewAccounting = vi.fn(() => true);
    window.supabase = createMockSupabase({
      berichtsstaende: [{ id: 'b1', created_at: '2026-08-09T10:00:00Z', label: 'Investorenupdate August 2026' }]
    });

    const page = createPage();
    await page.init();
    page.activeView = 'monate';
    page.render();
    const html = window.setContentSafely.mock.calls.at(-1)[1];

    expect(window.setHeadline).toHaveBeenCalledWith('Stakeholder-Übersicht');
    expect(html).toContain('id="stakeholder-bericht-select"');
    expect(html).toContain('Investorenupdate August 2026');
    expect(html).not.toContain('stakeholder-bericht-sichern');
    expect(html).not.toContain('stakeholder-bericht-label');
    expect(html).not.toContain('data-stakeholder-dq-link');
  });

  it('lädt Daten und rendert Karten + Kundenliste', async () => {
    const auftraege = [
      {
        id: 'a1',
        auftragsname: 'UGC Auftrag',
        nettobetrag: 10000,
        creator_budget: 8000,
        auftragtype: 'UGC/Influencer',
        start: '2026-01-01',
        ende: '2026-03-31',
        is_draft: false,
        unternehmen_id: 'u1'
      },
      {
        id: 'a2',
        auftragsname: 'Influencer Auftrag',
        nettobetrag: 50000,
        creator_budget: 44000,
        auftragtype: 'UGC/Influencer',
        start: '2026-02-01',
        ende: '2026-04-30',
        is_draft: false,
        unternehmen_id: 'u2'
      }
    ];

    const blocks = [
      { auftrag_id: 'a1', campaign_type: 'ugc_paid', campaign_type_label: 'UGC Paid', umsatz_netto: 10000 },
      { auftrag_id: 'a2', campaign_type: 'influencer', campaign_type_label: 'Influencer Kampagne', umsatz_netto: 50000 }
    ];

    const kampagnen = [
      { id: 'k1', auftrag_id: 'a1', videoanzahl: 5, creatoranzahl: 2 },
      { id: 'k2', auftrag_id: 'a2', videoanzahl: 10, creatoranzahl: 5 }
    ];

    const kooperationen = [
      { id: 'koop1', kampagne_id: 'k1', creator_id: 'c1', videoanzahl: 2, einkaufspreis_netto: 1000, verkaufspreis_netto: 2000, verkaufspreis_zusatzkosten: 100 },
      { id: 'koop2', kampagne_id: 'k2', creator_id: 'c2', videoanzahl: 3, einkaufspreis_netto: 5000, verkaufspreis_netto: 8000, verkaufspreis_zusatzkosten: 0 }
    ];

    const videos = [
      { id: 'v1', kooperation_id: 'koop1', einkaufspreis_netto: 400, verkaufspreis_netto: 800, kampagnenart: 'UGC Paid' },
      { id: 'v2', kooperation_id: 'koop2', einkaufspreis_netto: 2000, verkaufspreis_netto: 3000, kampagnenart: 'Influencer Kampagne' }
    ];

    const details = [
      { auftrag_id: 'a1', campaign_type: ['ugc_paid'], percentage_fee_enabled: true, percentage_fee_value: '500', ksk_enabled: true, ksk_value: '250' },
      { auftrag_id: 'a2', campaign_type: ['influencer'], percentage_fee_enabled: true, percentage_fee_value: '2000', ksk_enabled: true, ksk_value: '500' }
    ];

    const unternehmen = [
      { id: 'u1', firmenname: 'Muster GmbH' },
      { id: 'u2', firmenname: 'Beispiel AG' }
    ];

    window.supabase = createMockSupabase({ auftraege, blocks, kampagnen, kooperationen, videos, details, unternehmen });

    const page = createPage();
    await page.init();

    expect(window.setHeadline).toHaveBeenCalledWith('Stakeholder-Übersicht');
    // init() zeigt zuerst Loading, dann das gerenderte HTML
    const html = window.setContentSafely.mock.calls[1][1];

    // Leistungsbereich als Formular-Select (wie Zeitraum daneben)
    expect(html).toContain('id="stakeholder-tab-select"');
    expect(html).toContain('form-select');
    expect(html).toContain('GESAMT ohne Contracts');
    expect(html).toContain('GESAMT mit');
    expect(html).toContain('INFLUENCER MARKETING');
    expect(html).toContain('UGC PAID');

    // Karten vorhanden
    expect(html).toContain('Auftragsvolumen = Budget');
    expect(html).toContain('Verfügbares Budget');
    expect(html).toContain('Verbrauchtes Budget');
    expect(html).toContain('Creatoranteil');
    expect(html).toContain('Bezahlt');
    expect(html).toContain('Offen');
    expect(html).toContain('bezahlt');
    expect(html).toContain('Agenturanteil');
    expect(html).toContain('KSK-Abgabe');
    expect(html).toContain('Zusatzkosten');

    // Formel-Tooltips auf den Karten
    expect(html).toContain('stakeholder-card-info');
    expect(html).toContain('Creatoranteil + Agenturanteil + KSK + Zusatzkosten');
    expect(html).toContain('Feste Fee + EK/VK-Differenz');
    expect(html).toContain('eingelöst');
    expect(html).toContain('von');
    expect(html).toContain('UGC: 4,9 % auf EK · Influencer: KSK-Topf');
    expect(html).toContain('Σ Nettobetrag aller Aufträge');
    expect(html).toContain('Auftragsvolumen − Verbrauchtes Budget');

    // Kundenliste vorhanden
    expect(html).toContain('Kunden nach Umsatz');
    expect(html).toContain('Muster GmbH');
    expect(html).toContain('Beispiel AG');
    expect(html).toContain('FESTE FEE');
    expect(html).toContain('EK/VK');

    // Tabellen-Spalten in CFO-Reihenfolge (Kundenliste — nicht der
    // Zahlungsstand-Block, der früher im HTML steht)
    const kundenCard = html.split('Kunden nach Umsatz')[1] || '';
    const thead = kundenCard.match(/<thead>[\s\S]*?<\/thead>/)?.[0] || '';
    expect(thead).toContain('Kunde');
    expect(thead).toContain('Marke');
    expect(thead).toContain('Auftragsvolumen');
    expect(thead).toContain('Verbrauchtes Budget');
    expect(thead).toContain('Verfügbares Budget');
    expect(thead).toContain('Creatoranteil');
    expect(thead).toContain('Agenturanteil');
    expect(thead).toContain('KSK');
    expect(thead).toContain('Zusatzkosten');
    expect(thead).not.toContain('DB');

    // Reihenfolge: Kunde vor Marke vor Typ, Verbrauchtes vor Verfügbares, Creator vor Agentur
    expect(thead.indexOf('Kunde')).toBeLessThan(thead.indexOf('Marke'));
    expect(thead.indexOf('Marke')).toBeLessThan(thead.indexOf('Typ'));
    expect(thead.indexOf('Auftragsvolumen')).toBeLessThan(thead.indexOf('Verbrauchtes'));
    expect(thead.indexOf('Verbrauchtes')).toBeLessThan(thead.indexOf('Verfügbares'));
    expect(thead.indexOf('Verfügbares')).toBeLessThan(thead.indexOf('Creatoranteil'));
    expect(thead.indexOf('Creatoranteil')).toBeLessThan(thead.indexOf('Agenturanteil'));
    expect(thead.indexOf('Agenturanteil')).toBeLessThan(thead.indexOf('KSK'));
    expect(thead.indexOf('KSK')).toBeLessThan(thead.indexOf('Zusatzkosten'));
  });

  it('rendert die Monatsauswertung mit beiden Sichten, Matrix und Sonderzeilen', async () => {
    const auftraege = [{
      id: 'a1',
      auftragsname: 'UGC Auftrag',
      nettobetrag: 10000,
      creator_budget: 8000,
      auftragtype: 'UGC/Influencer',
      start: '2026-01-01',
      ende: '2026-03-31',
      is_draft: false,
      unternehmen_id: 'u1',
      rechnung_gestellt_am: '2026-03-10'
    }];
    const blocks = [{ auftrag_id: 'a1', campaign_type: 'ugc_paid', campaign_type_label: 'UGC Paid', umsatz_netto: 10000 }];
    const kampagnen = [{ id: 'k1', auftrag_id: 'a1', videoanzahl: 5, creatoranzahl: 2 }];
    const kooperationen = [{ id: 'koop1', kampagne_id: 'k1', creator_id: 'c1', videoanzahl: 2, einkaufspreis_netto: 5000, verkaufspreis_netto: 8000 }];
    const rechnungen = [{
      id: 'r1', auftrag_id: 'a1', kooperation_id: 'koop1', status: 'Bezahlt', rechnungstyp: 'kampagne',
      nettobetrag: 2000, nettobetrag_steuerfrei: 0, zusatzkosten: 0, gestellt_am: '2026-06-15'
    }];

    window.supabase = createMockSupabase({ auftraege, blocks, kampagnen, kooperationen, rechnungen });

    const page = createPage();
    await page.init();

    // Umschalten auf die Monatsauswertung
    page.activeView = 'monate';
    page.render();
    const html = window.setContentSafely.mock.calls.at(-1)[1];

    // Sicht- und Metrik-Umschalter (ViewModeToggle, wie Briefings Liste/Grid)
    expect(html).toContain('btn-view-marge');
    expect(html).toContain('btn-view-buchhaltung');
    expect(html).toContain('btn-view-umsatz');
    expect(html).toContain('Margensicht');
    expect(html).toContain('Buchhaltungssicht');
    expect(html).toContain('Umsatz');
    expect(html).toContain('Fremdkosten');
    expect(html).toContain('Differenz');

    // Matrix: Leistungsbereich und beide Monate (Umsatz März, Kosten Juni)
    expect(html).toContain('Leistungsbereich');
    expect(html).toContain('UGC Paid');
    expect(html).toContain('März 26');
    expect(html).toContain('Juni 26');

    // Fremdkosten-Posten bleiben getrennt
    expect(html).toContain('Fremdkosten nach Posten');
    expect(html).toContain('Creator-Honorar');
    expect(html).toContain('KSK-Abgabe');
    expect(html).toContain('Zusatzkosten');

    // Sonderzeile: 3.000 € Restbetrag der Kooperation ist noch nicht fakturiert
    expect(html).toContain('Nicht in der Monatsmatrix enthalten');
    expect(html).toContain('Noch nicht fakturiert');
    expect(html).toContain('3.000,00');

    // Margensicht (Standard): die Juni-Rechnung steht im März, nicht im Juni.
    // Differenz März = 10.000 − 2.000 − 98 KSK = 7.902
    expect(html).toContain('7.902,00');

    // Buchhaltungssicht: Kosten stehen im Juni
    page.monatsSicht = 'buchhaltung';
    page.render();
    const htmlBuch = window.setContentSafely.mock.calls.at(-1)[1];
    expect(htmlBuch).toContain('Buchhaltungssicht');
  });

  it('zeigt den Zahlungsstand als Snapshot in beiden Ansichten', async () => {
    const auftraege = [{
      id: 'a1',
      auftragsname: 'UGC Auftrag',
      nettobetrag: 10000,
      creator_budget: 8000,
      auftragtype: 'UGC/Influencer',
      start: '2026-01-01',
      is_draft: false,
      unternehmen_id: 'u1',
      rechnung_gestellt_am: '2026-03-10',
      ueberwiesen: false,
      ueberwiesen_am: null,
      re_faelligkeit: '2026-12-31'
    }];
    const blocks = [{ auftrag_id: 'a1', campaign_type: 'ugc_paid', campaign_type_label: 'UGC Paid', umsatz_netto: 10000 }];
    const kampagnen = [{ id: 'k1', auftrag_id: 'a1', videoanzahl: 5, creatoranzahl: 2 }];
    const kooperationen = [{ id: 'koop1', kampagne_id: 'k1', creator_id: 'c1', einkaufspreis_netto: 5000, ksk_selbstzahler: false }];
    const rechnungen = [{
      id: 'r1', auftrag_id: 'a1', kooperation_id: 'koop1', status: 'Bezahlt', rechnungstyp: 'kampagne',
      nettobetrag: 5000, nettobetrag_steuerfrei: 0, zusatzkosten: 0,
      gestellt_am: '2026-06-01', bezahlt_am: '2026-07-01', zahlungsziel: '2026-07-15'
    }];

    window.supabase = createMockSupabase({ auftraege, blocks, kampagnen, kooperationen, rechnungen });

    const page = createPage();
    await page.init();
    const html = window.setContentSafely.mock.calls[1][1];

    // Block mit beiden Seiten und vier Kategorien
    expect(html).toContain('Zahlungsstand');
    expect(html).toContain('Kundenrechnungen');
    expect(html).toContain('Creatorrechnungen');
    expect(html).toContain('Gestellt');
    expect(html).toContain('Bezahlt');
    expect(html).toContain('Noch nicht gestellt');
    // Kunden: 10.000 gestellt und offen; Creator: 5.000 + 245 KSK = 5.245 bezahlt
    expect(html).toContain('10.000,00');
    expect(html).toContain('5.245,00');

    // Der Snapshot steht auch über der Monatsauswertung
    page.activeView = 'monate';
    page.render();
    const htmlMonate = window.setContentSafely.mock.calls.at(-1)[1];
    expect(htmlMonate).toContain('Zahlungsstand');
  });

  it('zeigt die Berichtsstand-Leiste in der Monatsauswertung', async () => {
    window.supabase = createMockSupabase({
      berichtsstaende: [{ id: 'b1', created_at: '2026-08-09T10:00:00Z', label: 'Investorenupdate August 2026' }]
    });

    const page = createPage();
    await page.init();
    page.activeView = 'monate';
    page.render();
    const html = window.setContentSafely.mock.calls.at(-1)[1];

    expect(html).toContain('id="stakeholder-bericht-select"');
    expect(html).toContain('form-select');
    expect(html).toContain('form-input');
    expect(html).toContain('class="mdc-btn"');
    expect(html).toContain('Live-Ansicht');
    expect(html).toContain('Investorenupdate August 2026');
    expect(html).toContain('stakeholder-bericht-sichern');
    expect(html).toContain('Investorenupdate'); // Default-Label im Eingabefeld
    expect(html).not.toContain('stakeholder-bericht-btn');
    expect(html).not.toContain('table-select');
    // Live-Modus: kein Banner
    expect(html).not.toContain('stakeholder-bericht-banner');
  });

  it('sichert den Live-Stand als Berichtsstand mit versioniertem Payload', async () => {
    const auftraege = [
      { id: 'a1', auftragsname: 'A', nettobetrag: 10000, start: '2026-03-01', is_draft: false, unternehmen_id: 'u1', rechnung_gestellt_am: '2026-03-15' }
    ];
    const blocks = [{ auftrag_id: 'a1', campaign_type: 'ugc_paid', campaign_type_label: 'UGC Paid', umsatz_netto: 10000 }];

    let insertPayload = null;
    window.toastSystem = { show: vi.fn() };
    window.supabase = createMockSupabase({
      auftraege, blocks,
      onBerichtsstandInsert: (row) => { insertPayload = row; }
    });
    window.setContentSafely = vi.fn((el, html) => { el.innerHTML = html; });
    document.body.appendChild(window.content);

    const page = createPage();
    await page.init();
    page.activeView = 'monate';
    page.render();

    document.getElementById('stakeholder-bericht-sichern')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // Vollständig synchronisieren: die neu gesicherte Zeile erscheint erst
    // im Select, wenn Sichern inklusive abschliessendem Render durch ist.
    // Sonst schreibt ein spaeter Render dieser Page in das window.content
    // des naechsten Tests.
    await vi.waitFor(() => {
      const values = [...document.getElementById('stakeholder-bericht-select').options]
        .map(o => o.value);
      expect(values).toContain('b-neu');
    });
    expect(insertPayload).not.toBeNull();

    expect(insertPayload.label).toContain('Investorenupdate');
    expect(insertPayload.daten.version).toBe(1);
    expect(insertPayload.daten.monatsauswertung.months).toContain('2026-03');
    expect(insertPayload.daten.zahlungsstand.kunden.gestellt).toBe(10000);
    expect(window.toastSystem.show).toHaveBeenCalledWith(
      expect.stringContaining('gesichert'), 'success'
    );

    page.destroy();
    window.content.remove();
  });

  it('rendert einen gewählten Berichtsstand eingefroren statt live', async () => {
    const auftraege = [
      { id: 'a1', auftragsname: 'A', nettobetrag: 10000, start: '2026-03-01', is_draft: false, unternehmen_id: 'u1', rechnung_gestellt_am: '2026-03-15' }
    ];
    const blocks = [{ auftrag_id: 'a1', campaign_type: 'ugc_paid', campaign_type_label: 'UGC Paid', umsatz_netto: 10000 }];

    // Eingefrorener Stand mit abweichendem Wert (99.999 statt 10.000),
    // erzeugt ueber die echte Berechnung auf einem anderen Datensatz.
    const frozenAuftraege = [
      { id: 'a1', auftragsname: 'A', nettobetrag: 99999, start: '2026-03-01', is_draft: false, unternehmen_id: 'u1', rechnung_gestellt_am: '2026-03-15' }
    ];
    const frozenBlocks = [{ auftrag_id: 'a1', campaign_type: 'ugc_paid', campaign_type_label: 'UGC Paid', umsatz_netto: 99999 }];
    const frozen = {
      version: 1,
      monatsauswertung: calculateMonatsauswertung({
        auftraege: frozenAuftraege, blocks: frozenBlocks,
        kampagnen: [], kooperationen: [], videos: [], rechnungen: [], teilrechnungen: []
      }),
      zahlungsstand: calculateRechnungsstatus({
        auftraege: frozenAuftraege, kampagnen: [], kooperationen: [],
        videos: [], rechnungen: [], teilrechnungen: []
      })
    };

    window.supabase = createMockSupabase({
      auftraege, blocks,
      berichtsstaende: [{ id: 'b1', created_at: '2026-08-09T10:00:00Z', label: 'Investorenupdate August 2026' }],
      berichtsstandById: { id: 'b1', created_at: '2026-08-09T10:00:00Z', label: 'Investorenupdate August 2026', daten: frozen }
    });
    window.setContentSafely = vi.fn((el, html) => { el.innerHTML = html; });
    document.body.appendChild(window.content);

    const page = createPage();
    await page.init();
    page.activeView = 'monate';
    page.render();

    const berichtSelect = document.getElementById('stakeholder-bericht-select');
    berichtSelect.value = 'b1';
    berichtSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => {
      expect(window.content.innerHTML).toContain('stakeholder-bericht-banner');
    });

    const html = window.content.innerHTML;
    expect(html).toContain('Berichtsstand vom 09.08.2026');
    expect(html).toContain('Investorenupdate August 2026');
    expect(html).toContain('eingefroren');
    // Matrix und Zahlungsstand zeigen die eingefrorenen Werte
    expect(html).toContain('99.999,00');
    expect(html).toContain('eingefrorener Berichtsstand');

    // Zurueck zur Live-Ansicht
    const liveSelect = document.getElementById('stakeholder-bericht-select');
    liveSelect.value = 'live';
    liveSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => {
      expect(window.content.innerHTML).not.toContain('stakeholder-bericht-banner');
    });
    expect(window.content.innerHTML).toContain('10.000,00');

    page.destroy();
    window.content.remove();
  });

  it('filtert Aufträge nach Zeitraum', async () => {
    const auftraege = [
      { id: 'a1', auftragsname: 'Alt', nettobetrag: 1000, start: '2025-01-01', is_draft: false, unternehmen_id: 'u1' },
      { id: 'a2', auftragsname: 'Neu', nettobetrag: 2000, start: '2026-01-01', is_draft: false, unternehmen_id: 'u1' }
    ];
    const blocks = [
      { auftrag_id: 'a1', campaign_type: 'ugc_paid', campaign_type_label: 'UGC Paid', umsatz_netto: 1000 },
      { auftrag_id: 'a2', campaign_type: 'ugc_paid', campaign_type_label: 'UGC Paid', umsatz_netto: 2000 }
    ];
    const unternehmen = [{ id: 'u1', firmenname: 'Muster GmbH' }];
    window.supabase = createMockSupabase({ auftraege, blocks, unternehmen });
    window.setContentSafely = vi.fn((el, html) => { el.innerHTML = html; });
    document.body.appendChild(window.content);

    const page = createPage();
    await page.init();

    expect(window.content.innerHTML).toContain('Jan. 2025');
    expect(window.content.innerHTML).toContain('Jan. 2026');

    let select = document.getElementById('stakeholder-year-select');
    select.value = '2026';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(window.content.innerHTML).not.toContain('Jan. 2025');
    expect(window.content.innerHTML).toContain('Jan. 2026');

    // Zweiter Wechsel auf dem neu gerenderten Select (bisher kaputter Pfad)
    select = document.getElementById('stakeholder-year-select');
    select.value = 'all';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(window.content.innerHTML).toContain('Jan. 2025');
    expect(window.content.innerHTML).toContain('Jan. 2026');

    page.destroy();
    window.content.remove();
  });

  it('rechnet nur die Influencer-Agentur-Fee zeitanteilig, EK/VK und Volumen bleiben Ist', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-31T12:00:00Z'));

    const auftraege = [
      {
        id: 'inf',
        auftragsname: 'Influencer',
        nettobetrag: 100000,
        creator_budget: 80000,
        start: '2026-08-01',
        ende: '2026-09-30',
        is_draft: false,
        unternehmen_id: 'u1'
      },
      {
        id: 'ugc',
        auftragsname: 'UGC',
        nettobetrag: 20000,
        creator_budget: 15000,
        start: '2026-08-01',
        ende: '2026-09-30',
        is_draft: false,
        unternehmen_id: 'u2'
      }
    ];
    const blocks = [
      { auftrag_id: 'inf', campaign_type: 'influencer', campaign_type_label: 'Influencer Kampagne', umsatz_netto: 100000 },
      { auftrag_id: 'ugc', campaign_type: 'ugc_paid', campaign_type_label: 'UGC Paid', umsatz_netto: 20000 }
    ];
    const kampagnen = [
      { id: 'k-inf', auftrag_id: 'inf', videoanzahl: 1, creatoranzahl: 1 },
      { id: 'k-ugc', auftrag_id: 'ugc', videoanzahl: 1, creatoranzahl: 1 }
    ];
    const kooperationen = [
      { id: 'koop-inf', kampagne_id: 'k-inf', creator_id: 'c1', videoanzahl: 1, einkaufspreis_netto: 2000, verkaufspreis_netto: 3000, verkaufspreis_zusatzkosten: 0 },
      { id: 'koop-ugc', kampagne_id: 'k-ugc', creator_id: 'c2', videoanzahl: 1, einkaufspreis_netto: 500, verkaufspreis_netto: 800, verkaufspreis_zusatzkosten: 0 }
    ];
    const videos = [
      { id: 'v-inf', kooperation_id: 'koop-inf', einkaufspreis_netto: 2000, verkaufspreis_netto: 3000, kampagnenart: 'Influencer Kampagne' },
      { id: 'v-ugc', kooperation_id: 'koop-ugc', einkaufspreis_netto: 500, verkaufspreis_netto: 800, kampagnenart: 'UGC Paid' }
    ];
    const details = [
      { auftrag_id: 'inf', campaign_type: ['influencer'], agency_services_enabled: true, percentage_fee_enabled: true, percentage_fee_value: '44000', ksk_enabled: false },
      { auftrag_id: 'ugc', campaign_type: ['ugc_paid'], agency_services_enabled: true, percentage_fee_enabled: true, percentage_fee_value: '2000', ksk_enabled: false }
    ];
    const unternehmen = [
      { id: 'u1', firmenname: 'Inf GmbH' },
      { id: 'u2', firmenname: 'Ugc GmbH' }
    ];

    window.supabase = createMockSupabase({ auftraege, blocks, kampagnen, kooperationen, videos, details, unternehmen });

    const page = createPage();
    await page.init();
    const { rows, totals } = page.aggregate();

    const inf = rows.find(r => r.auftrag.id === 'inf');
    const ugc = rows.find(r => r.auftrag.id === 'ugc');
    const ratio = elapsedRatio('2026-08-01', '2026-09-30', new Date('2026-08-31T12:00:00Z'));

    // Influencer: ~50 % der Fee 44.000, EK/VK-Marge 1.000 und Volumen unangetastet
    expect(inf.volumen).toBe(100000);
    expect(inf.creator).toBe(2000);
    expect(inf.summary.agencyFeeSummary.ekVkMargin).toBe(1000);
    expect(inf.agentur).toBeCloseTo(44000 * ratio + 1000, 5);
    expect(inf.agenturVoll).toBe(45000);

    // UGC: Fee voll 2.000 + Marge 300
    expect(ugc.volumen).toBe(20000);
    expect(ugc.creator).toBe(500);
    expect(ugc.agentur).toBe(2300);
    expect(ugc.agenturVoll).toBe(2300);
    expect(totals.agenturFest).toBeCloseTo(44000 * ratio + 2000, 5);
    expect(totals.agenturVoll).toBe(47300);

    const html = window.setContentSafely.mock.calls[1][1];
    expect(html).toContain('eingelöst');
    expect(html).toContain('von');
    expect(html).toContain('stakeholder-agentur');

    vi.useRealTimers();
  });

  it('zeigt im Influencer-Tab "Offenes Creator Budget" statt "Verfügbares Budget"', async () => {
    const auftraege = [
      {
        id: 'a1',
        auftragsname: 'Influencer Auftrag',
        nettobetrag: 50000,
        creator_budget: 44000,
        auftragtype: 'UGC/Influencer',
        start: '2026-01-01',
        is_draft: false,
        unternehmen_id: 'u1'
      }
    ];
    const blocks = [
      { auftrag_id: 'a1', campaign_type: 'influencer', campaign_type_label: 'Influencer Kampagne', umsatz_netto: 50000 }
    ];
    const kampagnen = [{ id: 'k1', auftrag_id: 'a1', videoanzahl: 10, creatoranzahl: 5 }];
    const kooperationen = [
      { id: 'koop1', kampagne_id: 'k1', creator_id: 'c1', videoanzahl: 3, einkaufspreis_netto: 5000, verkaufspreis_netto: 8000, verkaufspreis_zusatzkosten: 0 }
    ];
    const videos = [
      { id: 'v1', kooperation_id: 'koop1', einkaufspreis_netto: 2000, verkaufspreis_netto: 3000, kampagnenart: 'Influencer Kampagne' }
    ];
    const details = [
      { auftrag_id: 'a1', campaign_type: ['influencer'], percentage_fee_enabled: true, percentage_fee_value: '2000', ksk_enabled: true, ksk_value: '500' }
    ];
    const unternehmen = [{ id: 'u1', firmenname: 'Beispiel AG' }];

    window.supabase = createMockSupabase({ auftraege, blocks, kampagnen, kooperationen, videos, details, unternehmen });
    window.setContentSafely = vi.fn((el, html) => { el.innerHTML = html; });
    document.body.appendChild(window.content);

    const page = createPage();
    await page.init();

    const tabSelect = document.getElementById('stakeholder-tab-select');
    tabSelect.value = 'influencer_marketing';
    tabSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(window.content.innerHTML).toContain('Offenes Creator Budget');
    expect(window.content.innerHTML).not.toContain('Verfügbares Budget');
    // Offenes Creator Budget = 44000 - 3000 = 41000
    expect(window.content.innerHTML).toContain('41.000,00');

    page.destroy();
    window.content.remove();
  });

  it('berechnet DB als Agenturanteil (Verbraucht − Creator − KSK − Zusatz)', async () => {
    const auftraege = [
      {
        id: 'a1',
        auftragsname: 'UGC Auftrag',
        nettobetrag: 10000,
        creator_budget: 8000,
        auftragtype: 'UGC/Influencer',
        start: '2026-01-01',
        is_draft: false,
        unternehmen_id: 'u1'
      }
    ];
    const blocks = [{ auftrag_id: 'a1', campaign_type: 'ugc_paid', campaign_type_label: 'UGC Paid', umsatz_netto: 10000 }];
    const kampagnen = [{ id: 'k1', auftrag_id: 'a1', videoanzahl: 5, creatoranzahl: 2 }];
    const kooperationen = [
      { id: 'koop1', kampagne_id: 'k1', creator_id: 'c1', videoanzahl: 2, einkaufspreis_netto: 1000, verkaufspreis_netto: 2000, verkaufspreis_zusatzkosten: 100 }
    ];
    const videos = [
      { id: 'v1', kooperation_id: 'koop1', einkaufspreis_netto: 400, verkaufspreis_netto: 800, kampagnenart: 'UGC Paid' }
    ];
    const details = [
      { auftrag_id: 'a1', campaign_type: ['ugc_paid'], agency_services_enabled: true, percentage_fee_enabled: true, percentage_fee_value: '500', ksk_enabled: true, ksk_value: '250' }
    ];
    const unternehmen = [{ id: 'u1', firmenname: 'Muster GmbH' }];

    window.supabase = createMockSupabase({ auftraege, blocks, kampagnen, kooperationen, videos, details, unternehmen });

    const page = createPage();
    await page.init();

    const { totals } = page.aggregate();
    // UGC: Creator = 400 (Video-EK), Agentur = 500 + (800-400) = 900,
    // KSK = 4,9 % von 400 = 19,60 (auto), Zusatz = 100
    // Verbraucht = 400 + 900 + 19,60 + 100 = 1419,60; DB = Agenturanteil = 900
    expect(totals.creator).toBe(400);
    expect(totals.agentur).toBe(900);
    expect(totals.ksk).toBeCloseTo(19.6, 2);
    expect(totals.zusatz).toBe(100);
    expect(totals.verbraucht).toBeCloseTo(1419.6, 2);
    expect(totals.db).toBe(900);
    expect(totals.creatorPaid).toBe(0);
    expect(totals.creatorOpen).toBe(400);
  });

  it('teilt Creatoranteil in Bezahlt/Offen aus Rechnungen', async () => {
    const auftraege = [
      {
        id: 'a1',
        auftragsname: 'UGC Auftrag',
        nettobetrag: 10000,
        creator_budget: 8000,
        auftragtype: 'UGC/Influencer',
        start: '2026-01-01',
        is_draft: false,
        unternehmen_id: 'u1'
      }
    ];
    const blocks = [{ auftrag_id: 'a1', campaign_type: 'ugc_paid', campaign_type_label: 'UGC Paid', umsatz_netto: 10000 }];
    const kampagnen = [{ id: 'k1', auftrag_id: 'a1', videoanzahl: 5, creatoranzahl: 2 }];
    const kooperationen = [
      { id: 'koop1', kampagne_id: 'k1', creator_id: 'c1', videoanzahl: 2, einkaufspreis_netto: 1000, verkaufspreis_netto: 2000, verkaufspreis_zusatzkosten: 100 }
    ];
    const videos = [
      { id: 'v1', kooperation_id: 'koop1', einkaufspreis_netto: 400, verkaufspreis_netto: 800, kampagnenart: 'UGC Paid' }
    ];
    const details = [
      { auftrag_id: 'a1', campaign_type: ['ugc_paid'], agency_services_enabled: true, percentage_fee_enabled: true, percentage_fee_value: '500' }
    ];
    const unternehmen = [{ id: 'u1', firmenname: 'Muster GmbH' }];
    const rechnungen = [
      { auftrag_id: 'a1', kooperation_id: 'koop1', status: 'Bezahlt', nettobetrag: 150, rechnungstyp: 'kampagne' },
      { auftrag_id: 'a1', kooperation_id: 'koop1', status: 'Offen', nettobetrag: 80, rechnungstyp: 'kampagne' },
      { auftrag_id: 'a1', kooperation_id: 'koop1', status: 'Bezahlt', nettobetrag: 999, rechnungstyp: 'contracting' }
    ];

    window.supabase = createMockSupabase({ auftraege, blocks, kampagnen, kooperationen, videos, details, unternehmen, rechnungen });

    const page = createPage();
    await page.init();

    const { totals } = page.aggregate();
    expect(totals.creator).toBe(400);
    expect(totals.creatorPaid).toBe(150);
    expect(totals.creatorOpen).toBe(250);

    const html = window.setContentSafely.mock.calls[1][1];
    expect(html).toContain('150,00 € von 400,00 € bezahlt');
    expect(html).toContain('Bezahlt');
    expect(html).toContain('Offen');
  });

  it('gruppiert Kundenliste nach Unternehmen und sortiert nach Volumen', async () => {
    const auftraege = [
      { id: 'a1', auftragsname: 'Klein', nettobetrag: 5000, start: '2026-01-01', is_draft: false, unternehmen_id: 'u1' },
      { id: 'a2', auftragsname: 'Groß', nettobetrag: 50000, start: '2026-01-01', is_draft: false, unternehmen_id: 'u2' },
      { id: 'a3', auftragsname: 'Mittel', nettobetrag: 10000, start: '2026-01-01', is_draft: false, unternehmen_id: 'u1' }
    ];
    const blocks = [
      { auftrag_id: 'a1', campaign_type: 'ugc_paid', campaign_type_label: 'UGC Paid', umsatz_netto: 5000 },
      { auftrag_id: 'a2', campaign_type: 'ugc_paid', campaign_type_label: 'UGC Paid', umsatz_netto: 50000 },
      { auftrag_id: 'a3', campaign_type: 'ugc_paid', campaign_type_label: 'UGC Paid', umsatz_netto: 10000 }
    ];
    const unternehmen = [
      { id: 'u1', firmenname: 'Muster GmbH' },
      { id: 'u2', firmenname: 'Beispiel AG' }
    ];

    window.supabase = createMockSupabase({ auftraege, blocks, unternehmen });

    const page = createPage();
    await page.init();

    const html = window.setContentSafely.mock.calls[1][1];
    const idxGross = html.indexOf('Beispiel AG');
    const idxMuster = html.indexOf('Muster GmbH');
    const idxMuster2 = html.indexOf('Muster GmbH', idxMuster + 1);

    // Beispiel AG (50k) zuerst, Muster GmbH (15k) eine Zeile
    expect(idxGross).toBeGreaterThan(-1);
    expect(idxMuster).toBeGreaterThan(-1);
    expect(idxMuster2).toBe(-1);
    expect(idxGross).toBeLessThan(idxMuster);
    expect(html).toContain('2 Aufträge');
    expect(html).toContain('2 Kunden');
  });

  it('nimmt die Contracting-Fee vom Auftrag wenn details fehlen', async () => {
    const auftraege = [
      {
        id: 'c1',
        auftragsname: 'Retainer',
        nettobetrag: 30000,
        auftragtype: 'Contracting',
        start: '2026-01-01',
        ende: '2026-12-31',
        is_draft: false,
        unternehmen_id: 'u1',
        agency_services_enabled: true,
        percentage_fee_enabled: true,
        percentage_fee_value: 10000
      }
    ];
    const unternehmen = [{ id: 'u1', firmenname: 'Contract GmbH' }];
    window.supabase = createMockSupabase({ auftraege, unternehmen });

    const page = createPage();
    await page.init();
    page.activeTab = 'gesamt_mit';
    const { totals } = page.aggregate();

    expect(totals.agenturFest).toBe(10000);
    expect(totals.agentur).toBe(10000);
    expect(totals.agenturVoll).toBe(10000);
    expect(totals.volumen).toBe(30000);
  });

  it('schließt Contracting im Default-Tab aus und nimmt es in GESAMT mit auf', async () => {
    const auftraege = [
      {
        id: 'ugc1',
        auftragsname: 'UGC Auftrag',
        nettobetrag: 10000,
        auftragtype: 'UGC/Influencer',
        start: '2026-01-01',
        is_draft: false,
        unternehmen_id: 'u1'
      },
      {
        id: 'c1',
        auftragsname: 'Retainer',
        nettobetrag: 30000,
        auftragtype: 'Contracting',
        start: '2026-01-01',
        is_draft: false,
        unternehmen_id: 'u2'
      }
    ];
    const blocks = [
      { auftrag_id: 'ugc1', campaign_type: 'ugc_paid', campaign_type_label: 'UGC Paid', umsatz_netto: 10000 }
    ];
    const unternehmen = [
      { id: 'u1', firmenname: 'Ugc GmbH' },
      { id: 'u2', firmenname: 'Contract GmbH' }
    ];
    window.supabase = createMockSupabase({ auftraege, blocks, unternehmen });

    const page = createPage();
    await page.init();

    expect(page.activeTab).toBe('gesamt_ohne');
    const ohne = page.aggregate();
    expect(ohne.rows.map(r => r.auftrag.id)).toEqual(['ugc1']);
    expect(ohne.totals.volumen).toBe(10000);

    const html = window.setContentSafely.mock.calls[1][1];
    expect(html).toContain('value="gesamt_ohne" selected');
    expect(html).toContain('Ugc GmbH');
    expect(html).not.toContain('Contract GmbH');

    page.activeTab = 'gesamt_mit';
    const mit = page.aggregate();
    expect(mit.rows.map(r => r.auftrag.id).sort()).toEqual(['c1', 'ugc1']);
    expect(mit.totals.volumen).toBe(40000);
  });

  it('summiert agentur und agenturVoll pro Kunde+Marke', () => {
    const groups = groupRowsByKundeMarke([
      {
        auftrag: { unternehmen_id: 'u1', marke_id: 'm1', marke: { id: 'm1', markenname: 'Ninja' }, start: '2026-01-01' },
        agentur: 10000,
        agenturVoll: 20000,
        volumen: 100
      },
      {
        auftrag: { unternehmen_id: 'u1', marke_id: 'm1', marke: { id: 'm1', markenname: 'Ninja' }, start: '2026-02-01' },
        agentur: 5000,
        agenturVoll: 5000,
        volumen: 50
      }
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].agentur).toBe(15000);
    expect(groups[0].agenturVoll).toBe(25000);
    expect(groups[0].count).toBe(2);
  });

  it('bündelt gleiche Marke, trennt unterschiedliche Marken desselben Kunden', async () => {
    const auftraege = [
      {
        id: 'a1',
        auftragsname: 'Ninja 1',
        nettobetrag: 10000,
        start: '2026-01-01',
        is_draft: false,
        unternehmen_id: 'u1',
        marke_id: 'm1',
        marke: { id: 'm1', markenname: 'Ninja Kitchen' }
      },
      {
        id: 'a2',
        auftragsname: 'Ninja 2',
        nettobetrag: 20000,
        start: '2026-02-01',
        is_draft: false,
        unternehmen_id: 'u1',
        marke_id: 'm1',
        marke: { id: 'm1', markenname: 'Ninja Kitchen' }
      },
      {
        id: 'a3',
        auftragsname: 'Shark 1',
        nettobetrag: 5000,
        start: '2026-03-01',
        is_draft: false,
        unternehmen_id: 'u1',
        marke_id: 'm2',
        marke: { id: 'm2', markenname: 'Shark Clean' }
      }
    ];
    const blocks = [
      { auftrag_id: 'a1', campaign_type: 'ugc_paid', campaign_type_label: 'UGC Paid', umsatz_netto: 10000 },
      { auftrag_id: 'a2', campaign_type: 'ugc_paid', campaign_type_label: 'UGC Paid', umsatz_netto: 20000 },
      { auftrag_id: 'a3', campaign_type: 'ugc_paid', campaign_type_label: 'UGC Paid', umsatz_netto: 5000 }
    ];
    const unternehmen = [{ id: 'u1', firmenname: 'SharkNinja Germany GmbH' }];
    window.supabase = createMockSupabase({ auftraege, blocks, unternehmen });

    const page = createPage();
    await page.init();
    const html = window.setContentSafely.mock.calls[1][1];
    const kundenCard = html.split('Kunden nach Umsatz')[1] || '';
    const thead = kundenCard.match(/<thead>[\s\S]*?<\/thead>/)?.[0] || '';

    expect(thead).toContain('Marke');
    expect(html).toContain('Ninja Kitchen');
    expect(html).toContain('Shark Clean');
    expect(html.split('SharkNinja Germany GmbH').length - 1).toBe(2);
    expect(html).toContain('30.000,00');
    expect(html).toContain('2 Aufträge');
    expect(html).toContain('2 Kunden');
  });

  it('zeigt Whitelisting/Darkposting nur als Tab wenn Count > 0', async () => {
    const auftraege = [
      { id: 'a1', auftragsname: 'UGC', nettobetrag: 1000, start: '2026-01-01', is_draft: false, unternehmen_id: 'u1' }
    ];
    const blocks = [{ auftrag_id: 'a1', campaign_type: 'ugc_paid', campaign_type_label: 'UGC Paid', umsatz_netto: 1000 }];
    const unternehmen = [{ id: 'u1', firmenname: 'Muster GmbH' }];

    window.supabase = createMockSupabase({ auftraege, blocks, unternehmen });

    const page = createPage();
    await page.init();

    const html = window.setContentSafely.mock.calls[0][1];
    expect(html).not.toContain('WHITELISTING');
    expect(html).not.toContain('DARKPOSTING');
  });

  it('summiert bezahlte Kundenrechnungen (Netto/Brutto) und folgt dem Jahr-Filter', async () => {
    const auftraege = [
      // Auftragsebene bezahlt (keine Teilrechnungen)
      { id: 'a1', auftragsname: 'Alt bezahlt', nettobetrag: 1000, bruttobetrag: 1190, ueberwiesen_am: '2025-02-10', start: '2025-01-01', is_draft: false, unternehmen_id: 'u1' },
      // Hat Teilrechnungen -> Auftrags-Betraege duerfen nicht zaehlen
      { id: 'a2', auftragsname: 'Neu teilweise', nettobetrag: 2000, bruttobetrag: 2380, ueberwiesen_am: null, start: '2026-01-01', is_draft: false, unternehmen_id: 'u1' }
    ];
    const teilrechnungen = [
      { auftrag_id: 'a2', nettobetrag: 500, bruttobetrag: 595, ueberwiesen_am: '2026-03-01' },
      { auftrag_id: 'a2', nettobetrag: 1500, bruttobetrag: 1785, ueberwiesen_am: null }
    ];
    const unternehmen = [{ id: 'u1', firmenname: 'Muster GmbH' }];
    window.supabase = createMockSupabase({ auftraege, teilrechnungen, unternehmen });
    window.setContentSafely = vi.fn((el, html) => { el.innerHTML = html; });
    document.body.appendChild(window.content);

    const page = createPage();
    await page.init();

    const nettoEl = () => window.content.querySelector('[data-paid-value="netto"]');
    const bruttoEl = () => window.content.querySelector('[data-paid-value="brutto"]');

    expect(window.content.innerHTML).toContain('Bereits bezahlt');
    // Alle Jahre: a1 (1000/1190) + bezahlte Teilrechnung von a2 (500/595)
    expect(nettoEl().textContent).toBe(page.fmtEuro(1500));
    expect(bruttoEl().textContent).toBe(page.fmtEuro(1785));

    // Jahr 2026: nur a2, davon nur die bezahlte Teilrechnung
    let select = document.getElementById('stakeholder-year-select');
    select.value = '2026';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(nettoEl().textContent).toBe(page.fmtEuro(500));
    expect(bruttoEl().textContent).toBe(page.fmtEuro(595));

    // Jahr 2025: nur a1 auf Auftragsebene
    select = document.getElementById('stakeholder-year-select');
    select.value = '2025';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(nettoEl().textContent).toBe(page.fmtEuro(1000));
    expect(bruttoEl().textContent).toBe(page.fmtEuro(1190));

    page.destroy();
    window.content.remove();
  });
});
