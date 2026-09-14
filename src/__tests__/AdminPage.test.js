import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminPage } from '../modules/admin/AdminPage.js';
import { invalidateFinanzbestand } from '../core/budget/finanzbestand.js';

// AdminPage (PRD Schritt 8) mit der Datenqualitaetsanzeige (Schritt 9).
// Jede Page bindet document-weite Listener und rendert in das globale
// window.content — wie bei der Stakeholder-Seite zentral registrieren und
// nach jedem Test zerstoeren, damit keine Test-Pollution entsteht.
const createdPages = [];
function createPage() {
  const page = new AdminPage();
  createdPages.push(page);
  return page;
}

function createMockSupabase({ auftraege = [], blocks = [], kampagnen = [], kooperationen = [], videos = [], rechnungen = [], creators = [] } = {}) {
  const tableData = {
    auftrag: auftraege,
    auftrag_kampagnenart_blocks: blocks,
    kampagne: kampagnen,
    kooperationen,
    kooperation_videos: videos,
    rechnung: rechnungen,
    creator: creators,
    auftrag_details: [],
    unternehmen: [],
    auftrag_teilrechnung: [],
  };
  // fetchAllRows kettet select().order().range(); die erste Seite liefert
  // hier immer alle Mock-Zeilen (< 1000), also stoppt die Pagination.
  // berichtsstand hat eine eigene Kette: Liste (select().order()).
  return {
    from: vi.fn((table) => {
      if (table === 'berichtsstand') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        };
      }
      return {
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            range: vi.fn(() => Promise.resolve({ data: tableData[table] || [], error: null }))
          }))
        }))
      };
    })
  };
}

// a1 ohne Kampagnenart-Block (50.000 €), a2 sauber, aber Video ohne EK
// (2.000 €). Erwartung: k1 (a1) steht wegen des hoeheren Volumens oben.
const FIXTURE = {
  auftraege: [
    { id: 'a1', auftragsname: 'Ohne Block', nettobetrag: 50000, auftragtype: 'UGC/Influencer', is_draft: false },
    { id: 'a2', auftragsname: 'Sauber bis auf Video', nettobetrag: 10000, auftragtype: 'UGC/Influencer', is_draft: false },
  ],
  blocks: [
    { auftrag_id: 'a2', campaign_type: 'ugc_paid', umsatz_netto: 10000 },
  ],
  kampagnen: [
    { id: 'k1', kampagnenname: 'Kampagne Ohne Block', auftrag_id: 'a1' },
    { id: 'k2', kampagnenname: 'Kampagne Video', auftrag_id: 'a2' },
  ],
  kooperationen: [
    { id: 'koop1', kampagne_id: 'k2', creator_id: 'c1', einkaufspreis_netto: 0, ksk_selbstzahler: false, ksk_betrag: 0 },
  ],
  videos: [
    { id: 'v1', kooperation_id: 'koop1', einkaufspreis_netto: null, verkaufspreis_netto: 2000, kampagnenart: 'UGC Paid', titel: 'Video A' },
  ],
  rechnungen: [],
  creators: [],
};

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.setHeadline = vi.fn();
    window.setContentSafely = vi.fn((el, html) => { el.innerHTML = html; });
    window.content = document.createElement('div');
    document.body.appendChild(window.content);
    window.isAdmin = vi.fn(() => true);
    window.navigateTo = vi.fn();
  });

  afterEach(() => {
    while (createdPages.length) createdPages.pop().destroy();
    window.content?.remove();
    invalidateFinanzbestand();
  });

  it('zeigt Zugriffsfehler für Nicht-Admins', async () => {
    window.isAdmin = vi.fn(() => false);
    const page = createPage();
    await page.init();
    expect(window.content.innerHTML).toContain('Kein Zugriff');
  });

  it('laedt als Admin und rendert Pruefungs-Uebersicht und Kampagnen-Liste', async () => {
    window.supabase = createMockSupabase(FIXTURE);
    const page = createPage();
    await page.init();

    const html = window.content.innerHTML;
    // Alle acht Pruefungen sind als Karten sichtbar
    expect(html).toContain('Videos ohne Einkaufspreis');
    expect(html).toContain('Kooperationen mit offenem Restbetrag');
    expect(html).toContain('Rechnungen mit unmoeglichem Rechnungsdatum');

    // Sortierung nach betroffenem Volumen: k1 (50.000) vor k2 (2.000)
    const i1 = html.indexOf('Kampagne Ohne Block');
    const i2 = html.indexOf('Kampagne Video');
    expect(i1).toBeGreaterThan(-1);
    expect(i2).toBeGreaterThan(-1);
    expect(i1).toBeLessThan(i2);

    // Pflegegrad von k2: 1 von 2 geprueften Einheiten fehlerfrei (Video
    // fehlerhaft, Auftrag ok) -> 50 %
    expect(html).toContain('50 %');
    expect(html).toContain('dq-grad--schlecht');

    // Headline der Huelle
    expect(window.setHeadline).toHaveBeenCalledWith('Accounting – Datenqualität');
  });

  it('faellt bei unbekannter Unterseite auf die Datenqualitaet zurueck', async () => {
    window.supabase = createMockSupabase(FIXTURE);
    const page = createPage();
    await page.init('gibts-nicht');
    // Die Datenqualitaetsanzeige ist gerendert (Pruefungs-Karten sichtbar).
    expect(window.content.innerHTML).toContain('Videos ohne Einkaufspreis');
  });

  it('klappt die Maengel einer Kampagne auf und wieder zu', async () => {
    window.supabase = createMockSupabase(FIXTURE);
    const page = createPage();
    await page.init();

    const toggle = window.content.querySelector('[data-dq-toggle="k2"]');
    const detail = window.content.querySelector('[data-dq-detail="k2"]');
    expect(toggle).toBeTruthy();
    expect(detail.hasAttribute('hidden')).toBe(true);

    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(detail.hasAttribute('hidden')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(detail.innerHTML).toContain('Videos ohne Einkaufspreis');
    expect(detail.innerHTML).toContain('Video A');

    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(detail.hasAttribute('hidden')).toBe(true);
  });

  it('navigiert aus den Befunden auf die Detailseiten', async () => {
    window.supabase = createMockSupabase(FIXTURE);
    const page = createPage();
    await page.init();

    window.content.querySelector('[data-dq-toggle="k2"]')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    window.content.querySelector('[data-dq-nav="/video/v1"]')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(window.navigateTo).toHaveBeenCalledWith('/video/v1');
  });

  it('zeigt einen Erfolgszustand, wenn es keine Maengel gibt', async () => {
    window.supabase = createMockSupabase({
      auftraege: [{ id: 'a9', auftragsname: 'Sauber', nettobetrag: 5000, auftragtype: 'UGC', is_draft: false }],
      blocks: [{ auftrag_id: 'a9', campaign_type: 'ugc_paid', umsatz_netto: 5000 }],
      kampagnen: [{ id: 'k9', kampagnenname: 'Saubere Kampagne', auftrag_id: 'a9' }],
    });
    const page = createPage();
    await page.init();
    expect(window.content.innerHTML).toContain('Keine Mängel gefunden');
  });
});
