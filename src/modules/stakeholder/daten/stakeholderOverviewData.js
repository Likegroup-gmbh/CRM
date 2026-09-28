// Laden und Rechnen der Stakeholder-Übersicht.
// Schreibt geladene Zeilen auf die Page; Aggregation und Status sind reine Aufrufe.
// Der Bestand kommt aus dem gemeinsamen Finanzbestand (core/budget), der
// Entwürfe und Testunternehmen schon filtert und im Adminbereich cached.

import { getChipFromKampagnenartName } from '../../auftrag/logic/kampagnenartChip.js';
import { calculateBudgetOverview } from '../../../core/budget/calculateBudgetOverview.js';
import { calculateCreatorPaymentSummary } from '../../../core/budget/EkVkAgencyFeeHelper.js';
import { loadFinanzbestand } from '../../../core/budget/finanzbestand.js';
import { calculateMonatsauswertung } from '../../../core/budget/monatsauswertung.js';
import {
  summarizeKundenrechnungRows,
  summarizeRechnungRows,
} from '../../rechnung/invoiceCardTotals.js';
import { kundenrechnungZeilen } from '../../../core/budget/kundenrechnungZeilen.js';
import {
  INFLUENCER_CHIPS,
  TAB_INFLUENCER,
  auftraegeImFilter,
  blocksByAuftrag,
  elapsedRatio,
  filteredAuftraege,
  kampagnenByAuftrag,
  koopsByAuftrag,
  mergeFeeSource,
  resolvePercentageFee,
  resolveVolumen,
  tabForAuftrag,
  videosByKoop,
} from '../kern/stakeholderOverviewLogic.js';

const SUPABASE = () => window.supabase;

export async function loadData(page) {
  const supabase = SUPABASE();
  if (!supabase) throw new Error('Supabase nicht verfügbar');

  const bestand = await loadFinanzbestand(supabase);

  page.auftraege = bestand.auftraege;
  page.blocks = bestand.blocks;
  page.kampagnen = bestand.kampagnen;
  page.kooperationen = bestand.kooperationen;
  page.videos = bestand.videos;
  page.rechnungen = bestand.rechnungen;
  page.teilrechnungen = bestand.teilrechnungen;
  page.detailsByAuftrag = new Map((bestand.details || []).map(d => [d.auftrag_id, d]));
  page.unternehmenById = new Map((bestand.unternehmen || []).map(u => [u.id, u]));
  page.berichtsstaende = bestand.berichtsstaende;
}

export function aggregate(page) {
  const auftraege = auftraegeImFilter(page);
  const blockMap = blocksByAuftrag(page);
  const koopMap = koopsByAuftrag(page);
  const videoMap = videosByKoop(page);
  const kampMap = kampagnenByAuftrag(page);
  const rows = [];
  let sumVolumen = 0;
  let sumVerfuegbar = 0;
  let sumVerbraucht = 0;
  let sumCreator = 0;
  let sumAgentur = 0;
  let sumAgenturFest = 0;
  let sumAgenturMargin = 0;
  let sumAgenturVoll = 0;
  let sumKsk = 0;
  let sumZusatz = 0;
  let sumDb = 0;
  let sumCreatorPaid = 0;
  let sumCreatorOpen = 0;
  let sumFestVolumen = 0;
  let sumFestAgentur = 0;
  let sumEkvkVolumen = 0;
  let sumEkvkVk = 0;
  let sumEkvkRealisiert = 0;

  auftraege.forEach(a => {
    const blocks = blockMap.get(a.id) || [];
    const tab = tabForAuftrag(a, blocks);

    const details = mergeFeeSource(page.detailsByAuftrag.get(a.id), a);
    const koops = koopMap.get(a.id) || [];
    const kampagnen = kampMap.get(a.id) || [];
    const videos = koops.flatMap(k => videoMap.get(k.id) || []);

    const summary = calculateBudgetOverview({
      auftrag: a,
      details,
      kooperationen: koops,
      videos,
      kampagnen
    });

    const volumen = resolveVolumen(a, blocks, page.activeTab);
    const creator = summary.creatorAnteil || 0;
    const koopIds = new Set(koops.map(k => k.id));
    const auftragRechnungen = (page.rechnungen || []).filter(r => {
      if (r.auftrag_id) return r.auftrag_id === a.id;
      return koopIds.has(r.kooperation_id);
    });
    const creatorPayment = calculateCreatorPaymentSummary(creator, auftragRechnungen);
    const ksk = summary.agencyFeeSummary?.kskValue || 0;
    const zusatz = summary.extraKostenVkSum || 0;

    const feeRaw = resolvePercentageFee(details);
    const agenturFest = tab === TAB_INFLUENCER
      ? feeRaw * elapsedRatio(a.start, a.ende)
      : feeRaw;
    const agenturMargin = summary.agencyFeeSummary?.ekVkMargin || 0;
    const agentur = agenturFest + agenturMargin;
    const agenturVoll = feeRaw + agenturMargin;

    const verbraucht = creator + agentur + ksk + zusatz;
    // Negativ = Ueberschreitung, wird bewusst durchgereicht (ADR 0007).
    const verfuegbar = volumen - verbraucht;
    const db = agentur;

    sumVolumen += volumen;
    sumVerfuegbar += verfuegbar;
    sumVerbraucht += verbraucht;
    sumCreator += creator;
    sumAgentur += agentur;
    sumAgenturFest += agenturFest;
    sumAgenturMargin += agenturMargin;
    sumAgenturVoll += agenturVoll;
    sumKsk += ksk;
    sumZusatz += zusatz;
    sumDb += db;
    sumCreatorPaid += creatorPayment.paid;
    sumCreatorOpen += creatorPayment.open;

    // Volumen bleibt exklusiv: Fee-Auftrag nur in „fest“, sonst nur in EK/VK.
    // Die Fee steht voll (nicht zeitanteilig). Die EK/VK-Marge zählt immer,
    // auch wenn derselbe Auftrag zusätzlich eine Fee hat.
    if (feeRaw > 0) {
      sumFestVolumen += volumen;
      sumFestAgentur += feeRaw;
    } else {
      sumEkvkVolumen += volumen;
    }
    sumEkvkVk += summary.vkSum || 0;
    sumEkvkRealisiert += summary.ekVkMarginSum || 0;

    rows.push({
      auftrag: a,
      details,
      summary,
      volumen,
      verfuegbar,
      verbraucht,
      creator,
      creatorPaid: creatorPayment.paid,
      creatorOpen: creatorPayment.open,
      agentur,
      agenturVoll,
      ksk,
      zusatz,
      db
    });
  });

  return {
    rows,
    totals: {
      volumen: sumVolumen,
      verfuegbar: sumVerfuegbar,
      verbraucht: sumVerbraucht,
      creator: sumCreator,
      creatorPaid: sumCreatorPaid,
      creatorOpen: sumCreatorOpen,
      agentur: sumAgentur,
      agenturFest: sumAgenturFest,
      agenturMargin: sumAgenturMargin,
      agenturVoll: sumAgenturVoll,
      ksk: sumKsk,
      zusatz: sumZusatz,
      db: sumDb,
      festVolumen: sumFestVolumen,
      festAgentur: sumFestAgentur,
      ekvkVolumen: sumEkvkVolumen,
      ekvkVk: sumEkvkVk,
      ekvkRealisiert: sumEkvkRealisiert
    }
  };
}

export function influencerOffenesCreatorBudget(page) {
  // Nur für den Influencer-Tab: Σ creator_budget der Influencer-Aufträge
  // + KSK-Umbuchung − Σ VK der Influencer-Videos.
  const auftraege = filteredAuftraege(page);
  const blockMap = blocksByAuftrag(page);
  const koopMap = koopsByAuftrag(page);
  const videoMap = videosByKoop(page);

  let budget = 0;
  let verbraucht = 0;

  auftraege.forEach(a => {
    const blocks = blockMap.get(a.id) || [];
    if (tabForAuftrag(a, blocks) !== TAB_INFLUENCER) return;

    const details = page.detailsByAuftrag.get(a.id) || {};
    const chips = Array.isArray(details.campaign_type) ? details.campaign_type : [];
    const influencerChips = chips.filter(c => INFLUENCER_CHIPS.has(c));
    const totalChips = chips.length || 1;
    const influencerShare = influencerChips.length / totalChips;

    const creatorBudget = (parseFloat(a.creator_budget) || 0) * influencerShare;
    budget += creatorBudget;

    const koops = koopMap.get(a.id) || [];
    koops.forEach(k => {
      const videos = videoMap.get(k.id) || [];
      videos.forEach(v => {
        const slug = getChipFromKampagnenartName(v.kampagnenart);
        if (slug && INFLUENCER_CHIPS.has(slug)) {
          verbraucht += parseFloat(v.verkaufspreis_netto) || 0;
        }
      });
    });
  });

  // Negativ = mehr VK gebucht als Creator-Budget vorhanden (ADR 0007).
  return budget - verbraucht;
}

export function monatsauswertung(page) {
  if (!page._monats) {
    page._monats = calculateMonatsauswertung({
      auftraege: page.auftraege,
      blocks: page.blocks,
      kampagnen: page.kampagnen,
      kooperationen: page.kooperationen,
      videos: page.videos,
      rechnungen: page.rechnungen,
      teilrechnungen: page.teilrechnungen,
    });
  }
  return page._monats;
}

function auftragIdVonKoop(koop, kampagneToAuftrag) {
  return koop ? (kampagneToAuftrag.get(koop.kampagne_id) || null) : null;
}

// Auftrag der Rechnung: direkte Id, sonst Kampagne, sonst Kooperation.
function auftragIdVonRechnung(rechnung, koop, kampagneToAuftrag) {
  if (rechnung.auftrag_id) return rechnung.auftrag_id;
  if (rechnung.kampagne_id) {
    const vonKampagne = kampagneToAuftrag.get(rechnung.kampagne_id);
    if (vonKampagne) return vonKampagne;
  }
  return auftragIdVonKoop(koop, kampagneToAuftrag);
}

// Creator: Auftrag über auftrag_id, Kampagne oder Kooperation, und der Auftrag
// muss im Filter liegen. Contracting ohne Auftrag bleibt in der Summe.
function rechnungenImFilter(page) {
  const ids = new Set(auftraegeImFilter(page).map(a => a.id));
  const koopById = new Map((page.kooperationen || []).map(k => [k.id, k]));
  const kampagneToAuftrag = new Map((page.kampagnen || []).map(k => [k.id, k.auftrag_id]));
  const creator = [];
  const contracting = [];
  for (const rechnung of page.rechnungen || []) {
    const koop = rechnung.kooperation_id ? koopById.get(rechnung.kooperation_id) : null;
    const auftragId = auftragIdVonRechnung(rechnung, koop, kampagneToAuftrag);
    if (rechnung.rechnungstyp === 'contracting') {
      if (auftragId && !ids.has(auftragId)) continue;
      contracting.push(rechnung);
      continue;
    }
    if (!auftragId || !ids.has(auftragId)) continue;
    creator.push(rechnung);
  }
  return { creator, contracting, auftragById: new Map(auftraegeImFilter(page).map(a => [a.id, a])) };
}

function kundenZeilenImFilter(page) {
  const auftraege = auftraegeImFilter(page);
  const ids = new Set(auftraege.map(a => a.id));
  const teile = (page.teilrechnungen || []).filter(t => ids.has(t.auftrag_id));
  return kundenrechnungZeilen(auftraege, teile);
}

// Kachelsummen für den gefilterten Auftragskreis (Jahr + Leistungsbereich).
// Kunden aus Kundenrechnungen, Creator und Contracting aus Rechnungen.
export function kartenSummen(page) {
  const { creator, contracting } = rechnungenImFilter(page);
  return {
    kunden: summarizeKundenrechnungRows(kundenZeilenImFilter(page)),
    creator: summarizeRechnungRows(creator),
    contracting: summarizeRechnungRows(contracting),
  };
}
