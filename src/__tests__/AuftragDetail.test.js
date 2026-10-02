import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuftragDetail, auftragDetail } from '../modules/auftrag/AuftragDetail.js';

const MIXIN_METHODS = [
  // Core
  'init', 'bindEvents', 'destroy', 'switchTab', 'showEditForm',
  // DataLoader
  'loadCriticalData', 'loadKooperationenVideos',
  // Finanzen
  'loadTabData', 'calculateKoopSummary', 'calculateRealCounts', 'updateRechnungenTab',
  'renderFinanzenTab', 'renderBudget', 'renderRechnungen',
  // Renderer
  'render', 'getSidebarInfo', 'renderMainContent', 'renderAuftragSummaryCards',
  'renderUebersicht', 'renderUeberwiesenItems', 'formatDate', 'formatCurrency',
  // Produktion
  'renderAuftragsdetails', 'collectKampagnenartenFromKampagnen',
  'formatBudgetUsage', 'getBudgetPercentage', 'renderKooperationenVideosTable'
];

function createDetail() {
  const d = new AuftragDetail();
  d.auftragId = 'a1';
  d.auftrag = {
    id: 'a1',
    auftragsname: 'Testauftrag',
    status: 'Beauftragt',
    nettobetrag: 10000,
    bruttobetrag: 11900,
    creator_budget: 4000,
    unternehmen_id: 'u1',
    unternehmen: { firmenname: 'ACME' },
    marke_id: 'm1',
    marke: { markenname: 'Marke X' },
    mitarbeiter: [{ name: 'Anna' }],
    cutter: [],
    copywriter: [],
    art_der_kampagne_namen: [],
    start: '2026-01-01',
    ende: '2026-02-01'
  };
  d.kooperationen = [
    { id: 'k1', typ: 'UGC Paid', videoanzahl: 2, einkaufspreis_netto: 500, einkaufspreis_gesamt: 500, creator: { id: 'c1', vorname: 'Max', nachname: 'Muster' } }
  ];
  d.videos = [{ id: 'v1', kooperation_id: 'k1', titel: 'Video 1', asset_url: 'https://example.com/v1' }];
  d.usedBudget = 500;
  d.realCreatorCount = 1;
  d.targetCreatorCount = 3;
  d.usedVideoCount = 2;
  d.targetVideoCount = 6;
  return d;
}

describe('AuftragDetail (Split in Core + Mixins)', () => {
  beforeEach(() => {
    window.setHeadline = vi.fn();
    window.setContentSafely = vi.fn();
    window.content = document.createElement('div');
    window.canSeePricing = () => true;
    window.isKunde = () => false;
    window.isMitarbeiter = () => false;
    window.validatorSystem = { sanitizeHtml: (s) => String(s) };
  });

  it('exportiert Klasse und Singleton', () => {
    expect(auftragDetail).toBeInstanceOf(AuftragDetail);
  });

  it('haengt alle Mixin-Methoden an den Prototype', () => {
    for (const name of MIXIN_METHODS) {
      expect(typeof AuftragDetail.prototype[name], name).toBe('function');
    }
  });

  it('entfernter toter Code ist weg', () => {
    for (const name of ['renderInformationen', 'renderCreator', 'renderRechnungenTab', 'setupCacheInvalidation', 'getProgressColorClass', 'showDetailsForm']) {
      expect(AuftragDetail.prototype[name], name).toBeUndefined();
    }
  });

  it('rendert Summary-Cards mit Budget und Zaehlern', () => {
    const html = createDetail().renderAuftragSummaryCards();
    expect(html).toContain('data-summary-card="total-budget"');
    expect(html).toContain('1 von 3');
    expect(html).toContain('2 von 6');
  });

  it('rendert den Uebersicht-Tab', () => {
    const html = createDetail().renderUebersicht();
    expect(html).toContain('Auftrags-Eckdaten');
    expect(html).toContain('ACME');
    expect(html).toContain('Anna');
  });

  it('rendert Ueberwiesen ohne Teilrechnungen inkl. Datum (kein ReferenceError)', () => {
    const d = createDetail();
    d.teilrechnungen = [];
    const html = d.renderUeberwiesenItems({ ueberwiesen: true, ueberwiesen_am: '2026-03-05' });
    expect(html).toContain('Überwiesen am:');
    expect(html).toContain(new Date('2026-03-05').toLocaleDateString('de-DE'));
  });

  it('rendert Ueberwiesen je Teilrechnung', () => {
    const d = createDetail();
    d.teilrechnungen = [
      { position: 1, ueberwiesen_am: '2026-03-05' },
      { position: 2, ueberwiesen_am: null }
    ];
    const html = d.renderUeberwiesenItems({});
    expect(html).toContain('Teilrechnung 1');
    expect(html).toContain(new Date('2026-03-05').toLocaleDateString('de-DE'));
    expect(html).toContain('Offen');
  });

  it('rendert Finanzen-Tab mit Budget und leerem Rechnungs-State', () => {
    const d = createDetail();
    d.rechnungen = [];
    const html = d.renderFinanzenTab();
    expect(html).toContain('Einnahmen (Auftrag)');
    expect(html).toContain('Keine Rechnungen vorhanden');
  });

  it('rendert Rechnungstabelle', () => {
    const d = createDetail();
    d.rechnungen = [{ id: 'r1', rechnung_nr: 'RE-1', status: 'Bezahlt', nettobetrag: 100, bruttobetrag: 119 }];
    const html = d.renderRechnungen();
    expect(html).toContain('RE-1');
    expect(html).toContain('/rechnung/r1');
  });

  it('rendert Auftragsdetails-Tab und Kooperationen-Tabelle', () => {
    const d = createDetail();
    d.auftragsDetails = { ugc_paid_video_anzahl: 4, ugc_paid_budget_info: 'Info' };
    d.auftrag.art_der_kampagne_namen = ['UGC Paid'];
    const html = d.renderAuftragsdetails();
    expect(html).toContain('Kooperationen & Videos');
    expect(html).toContain('Max Muster');
    expect(html).toContain('Video 1');
  });

  it('berechnet Budget-Verbrauch und Prozent konsistent', () => {
    const d = createDetail();
    expect(d.getBudgetPercentage()).toBe(Math.round((500 / 4000) * 100));
    expect(d.formatBudgetUsage()).toMatch(/500,00.*von.*4\.000,00/);
  });
});
