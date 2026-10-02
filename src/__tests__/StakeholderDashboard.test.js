import { describe, it, expect } from 'vitest';
import { berechneDashboard, DASHBOARD_VERSION } from '../modules/stakeholder/daten/stakeholderDashboard.js';

// Rechenkern des Investor-Dashboards: je Auftrag eine fertige Zeile plus
// Monatsauswertung. Der Kern laeuft auf dem Server und als Browser-Fallback;
// die Seitentests (StakeholderOverviewPage) pruefen dieselben Zahlen
// durch die Anzeige.

function bestand() {
  return {
    auftraege: [
      {
        id: 'inf', nettobetrag: 100000, creator_budget: 80000,
        start: '2026-08-01', ende: '2026-09-30', is_draft: false,
        unternehmen_id: 'u1', marke_id: 'm1', marke: { id: 'm1', markenname: 'Marke 1' },
        rechnung_gestellt_am: '2026-08-15',
      },
      {
        id: 'ugc', nettobetrag: 20000, creator_budget: 15000,
        start: '2026-08-01', ende: '2026-09-30', is_draft: false, unternehmen_id: 'u2',
      },
      {
        id: 'con', nettobetrag: 5000, start: '2026-08-01', is_draft: false, unternehmen_id: 'u2',
      },
    ],
    blocks: [
      { auftrag_id: 'inf', campaign_type: 'influencer', umsatz_netto: 90000 },
      { auftrag_id: 'ugc', campaign_type: 'ugc_paid', umsatz_netto: 20000 },
    ],
    kampagnen: [
      { id: 'k-inf', auftrag_id: 'inf', videoanzahl: 1, creatoranzahl: 1 },
      { id: 'k-ugc', auftrag_id: 'ugc', videoanzahl: 1, creatoranzahl: 1 },
    ],
    kooperationen: [
      { id: 'koop-inf', kampagne_id: 'k-inf', creator_id: 'c1', videoanzahl: 1, einkaufspreis_netto: 2000, verkaufspreis_netto: 3000 },
      { id: 'koop-ugc', kampagne_id: 'k-ugc', creator_id: 'c2', videoanzahl: 1, einkaufspreis_netto: 500, verkaufspreis_netto: 800, verkaufspreis_zusatzkosten: 100 },
    ],
    videos: [
      { id: 'v-inf', kooperation_id: 'koop-inf', einkaufspreis_netto: 2000, verkaufspreis_netto: 3000, kampagnenart: 'Influencer Kampagne' },
      { id: 'v-ugc', kooperation_id: 'koop-ugc', einkaufspreis_netto: 500, verkaufspreis_netto: 800, kampagnenart: 'UGC Paid' },
    ],
    rechnungen: [
      { id: 'r1', kooperation_id: 'koop-inf', status: 'Bezahlt', nettobetrag: 2000, gestellt_am: '2026-09-01' },
      { id: 'r2', kooperation_id: 'koop-ugc', status: 'Offen', nettobetrag: 500, gestellt_am: '2026-09-02' },
      { id: 'r3', auftrag_id: 'con', rechnungstyp: 'contracting', status: 'Bezahlt', nettobetrag: 700 },
      { id: 'r4', rechnungstyp: 'contracting', status: 'Bezahlt', nettobetrag: 300 },
      { id: 'r5', auftrag_id: 'unbekannt', rechnungstyp: 'contracting', status: 'Bezahlt', nettobetrag: 9999 },
      { id: 'r6', status: 'Bezahlt', nettobetrag: 8888 },
    ],
    teilrechnungen: [],
    details: [
      { auftrag_id: 'inf', campaign_type: ['influencer'], agency_services_enabled: true, percentage_fee_enabled: true, percentage_fee_value: '44000' },
      { auftrag_id: 'ugc', campaign_type: ['ugc_paid'], agency_services_enabled: true, percentage_fee_enabled: false },
    ],
    unternehmen: [
      { id: 'u1', firmenname: 'Inf GmbH', ist_test: false },
      { id: 'u2', firmenname: 'Ugc GmbH', ist_test: false },
      { id: 'u3', firmenname: 'Ohne Auftrag GmbH', ist_test: false },
    ],
    berichtsstaende: [{ id: 'b1', created_at: '2026-08-09T10:00:00Z', label: 'Stand' }],
    geladenAm: 1234,
  };
}

const zeile = (ergebnis, id) => ergebnis.zeilen.find(z => z.id === id);

describe('berechneDashboard', () => {
  it('liefert eine gerechnete Zeile je Auftrag mit Tab und Volumen-Varianten', () => {
    const erg = berechneDashboard(bestand());

    expect(erg.version).toBe(DASHBOARD_VERSION);
    expect(erg.geladenAm).toBe(1234);
    expect(erg.zeilen.map(z => z.id)).toEqual(['inf', 'ugc', 'con']);

    const inf = zeile(erg, 'inf');
    expect(inf.tab).toBe('influencer_marketing');
    // Netto fuer GESAMT, Block-Summe fuer einen Kategorie-Tab.
    expect(inf.volumen_netto).toBe(100000);
    expect(inf.volumen_bloecke).toBe(90000);
    expect(inf.hat_bloecke).toBe(true);
    expect(inf.creator).toBe(2000);
    expect(inf.fee_roh).toBe(44000);
    expect(inf.fee_aktiv).toBe(true);
    expect(inf.agentur_marge).toBe(1000);
    expect(inf.ekvk_vk).toBe(3000);
    expect(inf.ekvk_realisiert).toBe(1000);
    expect(inf.marke).toEqual({ id: 'm1', markenname: 'Marke 1' });

    const ugc = zeile(erg, 'ugc');
    expect(ugc.fee_aktiv).toBe(false);
    expect(ugc.fee_roh).toBe(0);
    expect(ugc.zusatz).toBe(100);
    expect(ugc.creator).toBe(500);

    expect(zeile(erg, 'con').hat_bloecke).toBe(false);
  });

  it('rechnet Creator bezahlt und offen aus den Rechnungen des Auftrags', () => {
    const erg = berechneDashboard(bestand());
    const inf = zeile(erg, 'inf');
    expect(inf.creator_bezahlt).toBe(2000);
    expect(inf.creator_offen).toBe(0);
    const ugc = zeile(erg, 'ugc');
    expect(ugc.creator_bezahlt).toBe(0);
    expect(ugc.creator_offen).toBe(500);
  });

  it('liefert das Influencer-Budget nur fuer Influencer-Auftraege', () => {
    const erg = berechneDashboard(bestand());
    expect(zeile(erg, 'inf').influencer).toEqual({ budget: 80000, verbraucht: 3000 });
    expect(zeile(erg, 'ugc').influencer).toBeNull();
  });

  it('ordnet Rechnungen den Auftraegen zu und haelt Contracting ohne Auftrag getrennt', () => {
    const erg = berechneDashboard(bestand());

    // Creator ueber die Kooperation; fremde und auftragslose Belege fallen weg.
    expect(zeile(erg, 'inf').karten.creator.nettobetrag).toBe(2000);
    expect(zeile(erg, 'inf').karten.creator.bezahlt_netto).toBe(2000);
    expect(zeile(erg, 'ugc').karten.creator.nettobetrag).toBe(500);

    expect(zeile(erg, 'con').karten.contracting.nettobetrag).toBe(700);
    expect(erg.contractingOhneAuftrag.nettobetrag).toBe(300);

    // Nullfelder fehlen in der Zeile (kleinere Antwort), der Browser addiert sie als 0.
    expect(zeile(erg, 'con').karten.creator).toEqual({});
    const alleCreator = erg.zeilen.reduce((s, z) => s + (z.karten.creator.nettobetrag || 0), 0);
    expect(alleCreator).toBe(2500);
  });

  it('liefert Kundenrechnungs-Summen je Auftrag', () => {
    const erg = berechneDashboard(bestand());
    const kunden = zeile(erg, 'inf').karten.kunden;
    expect(kunden.nettobetrag).toBe(100000);
    expect(kunden.re_datum_netto).toBe(100000);
  });

  it('enthaelt die Monatsauswertung, Unternehmen und Berichtsstaende', () => {
    const erg = berechneDashboard(bestand());

    expect(erg.monatsauswertung.months).toContain('2026-08');
    expect(erg.monatsauswertung.kontrolle.umsatzGesamt).toBe(100000);
    // Nur Unternehmen mit Auftrag, nur Id und Name.
    expect(erg.unternehmen).toEqual([
      { id: 'u1', firmenname: 'Inf GmbH' },
      { id: 'u2', firmenname: 'Ugc GmbH' },
    ]);
    expect(erg.berichtsstaende).toHaveLength(1);
  });

  it('ist JSON-serialisierbar und kommt mit leerem Bestand klar', () => {
    const erg = berechneDashboard(bestand());
    expect(JSON.parse(JSON.stringify(erg)).zeilen).toHaveLength(3);

    const leer = berechneDashboard({});
    expect(leer.zeilen).toEqual([]);
    expect(leer.contractingOhneAuftrag.nettobetrag).toBe(0);
    expect(leer.monatsauswertung.months).toEqual([]);
  });

  it('klemmt Ueberschreitungen nicht (ADR 0007)', () => {
    const b = bestand();
    b.auftraege[1].nettobetrag = 100;
    const erg = berechneDashboard(b);
    const ugc = zeile(erg, 'ugc');
    // Die Zeile traegt Volumen und Kosten getrennt; verfuegbar rechnet der Browser
    // und darf negativ werden. Hier: Kosten stehen ungekappt in der Zeile.
    expect(ugc.volumen_netto).toBe(100);
    expect(ugc.creator + ugc.zusatz).toBeGreaterThan(ugc.volumen_netto);
  });
});
