import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StakeholderOverviewPage, elapsedRatio, groupRowsByKundeMarke } from '../modules/stakeholder/StakeholderOverviewPage.js';

function createMockSupabase({ auftraege = [], blocks = [], kampagnen = [], kooperationen = [], videos = [], details = [], unternehmen = [], rechnungen = [] }) {
  const tableData = {
    auftrag: { data: auftraege, error: null },
    auftrag_kampagnenart_blocks: { data: blocks, error: null },
    kampagne: { data: kampagnen, error: null },
    kooperationen: { data: kooperationen, error: null },
    kooperation_videos: { data: videos, error: null },
    auftrag_details: { data: details, error: null },
    unternehmen: { data: unternehmen, error: null },
    rechnung: { data: rechnungen, error: null }
  };

  return {
    from: vi.fn((table) => ({
      select: vi.fn(() => Promise.resolve(tableData[table] || { data: [], error: null }))
    }))
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

  it('zeigt Zugriffsfehler für Nicht-Admins', async () => {
    window.isAdmin = vi.fn(() => false);
    const page = new StakeholderOverviewPage();
    await page.init();
    expect(window.setContentSafely).toHaveBeenCalledWith(
      window.content,
      expect.stringContaining('Kein Zugriff')
    );
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

    const page = new StakeholderOverviewPage();
    await page.init();

    expect(window.setHeadline).toHaveBeenCalledWith('Stakeholder-Übersicht');
    // init() zeigt zuerst Loading, dann das gerenderte HTML
    const html = window.setContentSafely.mock.calls[1][1];

    // Tabs vorhanden
    expect(html).toContain('GESAMT');
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

    // Tabellen-Spalten in CFO-Reihenfolge
    const thead = html.match(/<thead>[\s\S]*?<\/thead>/)?.[0] || '';
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

    const page = new StakeholderOverviewPage();
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

    const page = new StakeholderOverviewPage();
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

    const page = new StakeholderOverviewPage();
    await page.init();

    // Wechsel zu Influencer-Tab
    page.activeTab = 'influencer_marketing';
    page.render();
    const html = window.setContentSafely.mock.calls[2][1];

    expect(html).toContain('Offenes Creator Budget');
    expect(html).not.toContain('Verfügbares Budget');
    // Offenes Creator Budget = 44000 - 3000 = 41000
    expect(html).toContain('41.000,00');
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

    const page = new StakeholderOverviewPage();
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

    const page = new StakeholderOverviewPage();
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

    const page = new StakeholderOverviewPage();
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

    const page = new StakeholderOverviewPage();
    await page.init();
    const { totals } = page.aggregate();

    expect(totals.agenturFest).toBe(10000);
    expect(totals.agentur).toBe(10000);
    expect(totals.agenturVoll).toBe(10000);
    expect(totals.volumen).toBe(30000);
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

    const page = new StakeholderOverviewPage();
    await page.init();
    const html = window.setContentSafely.mock.calls[1][1];
    const thead = html.match(/<thead>[\s\S]*?<\/thead>/)?.[0] || '';

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

    const page = new StakeholderOverviewPage();
    await page.init();

    const html = window.setContentSafely.mock.calls[0][1];
    expect(html).not.toContain('WHITELISTING');
    expect(html).not.toContain('DARKPOSTING');
  });
});
