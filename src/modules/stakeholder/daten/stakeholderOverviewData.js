// Laden und Summieren der Stakeholder-Übersicht.
// Gerechnet wird vorher (stakeholderDashboard.js, auf dem Server): die Page
// bekommt je Auftrag eine fertige Zeile und filtert, gruppiert und addiert
// sie nur noch. Jahr und Leistungsbereich bleiben damit reine Browser-Filter.

import { loadDashboard } from './dashboardLoad.js';
import {
  emptyKundenSummary,
  emptyRechnungSummary,
} from '../../rechnung/invoiceCardTotals.js';
import {
  TAB_INFLUENCER,
  auftraegeImFilter,
  elapsedRatio,
  filteredAuftraege,
  isGesamtTab,
} from '../kern/stakeholderOverviewLogic.js';

const SUPABASE = () => window.supabase;

export async function loadData(page) {
  const supabase = SUPABASE();
  if (!supabase) throw new Error('Supabase nicht verfügbar');

  const dashboard = await loadDashboard(supabase);

  page.auftraege = dashboard.zeilen;
  page.contractingOhneAuftrag = dashboard.contractingOhneAuftrag || emptyRechnungSummary();
  page.unternehmenById = new Map((dashboard.unternehmen || []).map(u => [u.id, u]));
  page.berichtsstaende = dashboard.berichtsstaende || [];
  page.geladenAm = dashboard.geladenAm || Date.now();
  // Die Monatsauswertung kommt fertig mit; sie gehoert zum selben Stand.
  page._monats = dashboard.monatsauswertung;
}

// GESAMT zeigt das Auftragsvolumen. In einem Kategorie-Tab ist der gepflegte
// Kampagnenart-Umsatz die genauere Zahl; ohne gepflegten Block bleibt der Nettobetrag.
function zeilenVolumen(zeile, activeTab) {
  if (isGesamtTab(activeTab)) return zeile.volumen_netto;
  return zeile.hat_bloecke ? zeile.volumen_bloecke : zeile.volumen_netto;
}

export function aggregate(page) {
  const zeilen = auftraegeImFilter(page);
  const rows = [];
  const totals = {
    volumen: 0,
    verfuegbar: 0,
    verbraucht: 0,
    creator: 0,
    creatorPaid: 0,
    creatorOpen: 0,
    agentur: 0,
    agenturFest: 0,
    agenturMargin: 0,
    agenturVoll: 0,
    ksk: 0,
    zusatz: 0,
    db: 0,
    festVolumen: 0,
    festAgentur: 0,
    ekvkVolumen: 0,
    ekvkVk: 0,
    ekvkRealisiert: 0,
  };

  zeilen.forEach(z => {
    const volumen = zeilenVolumen(z, page.activeTab);
    const creator = z.creator;
    const ksk = z.ksk;
    const zusatz = z.zusatz;

    const feeRaw = z.fee_roh;
    const agenturFest = z.tab === TAB_INFLUENCER
      ? feeRaw * elapsedRatio(z.start, z.ende)
      : feeRaw;
    const agenturMargin = z.agentur_marge;
    const agentur = agenturFest + agenturMargin;
    const agenturVoll = feeRaw + agenturMargin;

    const verbraucht = creator + agentur + ksk + zusatz;
    // Negativ = Ueberschreitung, wird bewusst durchgereicht (ADR 0007).
    const verfuegbar = volumen - verbraucht;
    const db = agentur;

    totals.volumen += volumen;
    totals.verfuegbar += verfuegbar;
    totals.verbraucht += verbraucht;
    totals.creator += creator;
    totals.agentur += agentur;
    totals.agenturFest += agenturFest;
    totals.agenturMargin += agenturMargin;
    totals.agenturVoll += agenturVoll;
    totals.ksk += ksk;
    totals.zusatz += zusatz;
    totals.db += db;
    totals.creatorPaid += z.creator_bezahlt;
    totals.creatorOpen += z.creator_offen;

    // Volumen bleibt exklusiv: Fee-Auftrag nur in „fest“, sonst nur in EK/VK.
    // Die Fee steht voll (nicht zeitanteilig). Die EK/VK-Marge zählt immer,
    // auch wenn derselbe Auftrag zusätzlich eine Fee hat.
    if (feeRaw > 0) {
      totals.festVolumen += volumen;
      totals.festAgentur += feeRaw;
    } else {
      totals.ekvkVolumen += volumen;
    }
    totals.ekvkVk += z.ekvk_vk;
    totals.ekvkRealisiert += z.ekvk_realisiert;

    rows.push({
      auftrag: z,
      details: { percentage_fee_enabled: z.fee_aktiv },
      volumen,
      verfuegbar,
      verbraucht,
      creator,
      creatorPaid: z.creator_bezahlt,
      creatorOpen: z.creator_offen,
      agentur,
      agenturVoll,
      agenturMargin,
      ksk,
      zusatz,
      db,
    });
  });

  return { rows, totals };
}

export function influencerOffenesCreatorBudget(page) {
  // Nur für den Influencer-Tab: Σ creator_budget der Influencer-Aufträge
  // + KSK-Umbuchung − Σ VK der Influencer-Videos.
  let budget = 0;
  let verbraucht = 0;

  filteredAuftraege(page).forEach(z => {
    if (z.tab !== TAB_INFLUENCER || !z.influencer) return;
    budget += z.influencer.budget;
    verbraucht += z.influencer.verbraucht;
  });

  // Negativ = mehr VK gebucht als Creator-Budget vorhanden (ADR 0007).
  return budget - verbraucht;
}

export function monatsauswertung(page) {
  return page._monats;
}

function addiere(summe, teil) {
  if (!teil) return;
  for (const key of Object.keys(summe)) summe[key] += teil[key] || 0;
}

// Kachelsummen für den gefilterten Auftragskreis (Jahr + Leistungsbereich).
// Kunden aus Kundenrechnungen, Creator und Contracting aus Rechnungen.
// Contracting-Rechnungen ohne Auftrag bleiben immer in der Summe.
export function kartenSummen(page) {
  const kunden = emptyKundenSummary();
  const creator = emptyRechnungSummary();
  const contracting = emptyRechnungSummary();

  auftraegeImFilter(page).forEach(z => {
    addiere(kunden, z.karten?.kunden);
    addiere(creator, z.karten?.creator);
    addiere(contracting, z.karten?.contracting);
  });
  addiere(contracting, page.contractingOhneAuftrag);

  return { kunden, creator, contracting };
}
