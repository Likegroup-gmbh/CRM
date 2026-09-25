// Laden und Rechnen der Stakeholder-Übersicht.
// Schreibt geladene Zeilen auf die Page; Aggregation und Status sind reine Aufrufe.

import { getChipFromKampagnenartName } from '../projekt-erstellen/logic/CampaignBudgetFields.js';
import { calculateBudgetOverview } from '../../core/budget/calculateBudgetOverview.js';
import { calculateCreatorPaymentSummary } from '../../core/budget/EkVkAgencyFeeHelper.js';
import { calculateMonatsauswertung } from '../../core/budget/monatsauswertung.js';
import { isInvoiceRowPaid, isReFaelligkeitOverdue } from '../auftrag/logic/PaymentRowStatus.js';
import {
  hatRechnungsdatum,
  summarizeKundenrechnungRows,
  summarizeRechnungRows,
} from '../rechnung/invoiceCardTotals.js';
import { kundenrechnungZeilen } from '../rechnung/Monatsblatt.js';
import { fetchBerichtsstaende } from './berichtsstandStore.js';
import { fetchAllRows } from '../../core/fetchAllRows.js';
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
} from './stakeholderOverviewLogic.js';

const SUPABASE = () => window.supabase;

export async function loadData(page) {
  const supabase = SUPABASE();
  if (!supabase) throw new Error('Supabase nicht verfügbar');

  // Alle Tabellen seitenweise (fetchAllRows), damit nichts am
  // PostgREST-Zeilenlimit verloren geht.
  const [auftraege, blocks, kampagnen, koops, videos, details, unternehmen, rechnungen, teilrechnungen] = await Promise.all([
    fetchAllRows(supabase, 'auftrag',
      'id, titel, auftragsname, nettobetrag, ust_betrag, bruttobetrag, creator_budget, auftragtype, start, ende, created_at, is_draft, unternehmen_id, marke_id, agency_services_enabled, percentage_fee_enabled, percentage_fee_value, ksk_enabled, ksk_value, rechnung_gestellt_am, ueberwiesen, ueberwiesen_am, re_faelligkeit, marke:marke_id(id, markenname)'),
    fetchAllRows(supabase, 'auftrag_kampagnenart_blocks',
      'id, auftrag_id, campaign_type, campaign_type_label, umsatz_netto, sort_order'),
    fetchAllRows(supabase, 'kampagne',
      'id, auftrag_id, videoanzahl, creatoranzahl'),
    fetchAllRows(supabase, 'kooperationen',
      'id, name, kampagne_id, creator_id, videoanzahl, einkaufspreis_netto, verkaufspreis_netto, verkaufspreis_zusatzkosten, ksk_selbstzahler, ksk_betrag'),
    fetchAllRows(supabase, 'kooperation_videos',
      'id, kooperation_id, einkaufspreis_netto, verkaufspreis_netto, kampagnenart'),
    fetchAllRows(supabase, 'auftrag_details',
      'auftrag_id, campaign_type, agency_services_enabled, percentage_fee_enabled, percentage_fee_value, ksk_enabled, ksk_value'),
    fetchAllRows(supabase, 'unternehmen',
      'id, firmenname'),
    // Fremdkosten brauchen Rechnungsdatum und die drei Posten-Quellen
    // (Honorar netto + steuerfrei, Zusatzkosten; KSK wird berechnet).
    // Der Zahlungsstand braucht zusaetzlich status/bezahlt_am/zahlungsziel.
    fetchAllRows(supabase, 'rechnung',
      'id, kooperation_id, auftrag_id, status, nettobetrag, ust_betrag, bruttobetrag, nettobetrag_steuerfrei, zusatzkosten, gestellt_am, bezahlt_am, zahlungsziel, rechnungstyp, rechnung_nr'),
    // Kundenrechnungen: geplante und gestellte Teilrechnungen je Auftrag,
    // inkl. Zahlungsstatus (ueberwiesen_am) und Faelligkeit.
    fetchAllRows(supabase, 'auftrag_teilrechnung',
      'id, auftrag_id, nettobetrag, ust_betrag, bruttobetrag, rechnung_gestellt, rechnung_gestellt_am, ueberwiesen, ueberwiesen_am, re_faelligkeit'),
  ]);

  page.auftraege = (auftraege || []).filter(a => a.is_draft !== true);
  page.blocks = blocks || [];
  page.kampagnen = kampagnen || [];
  page.kooperationen = koops || [];
  page.videos = videos || [];
  page.rechnungen = rechnungen || [];
  page.teilrechnungen = teilrechnungen || [];
  page.detailsByAuftrag = new Map((details || []).map(d => [d.auftrag_id, d]));
  page.unternehmenById = new Map((unternehmen || []).map(u => [u.id, u]));

  // Berichtsstände sind ein Add-on: scheitert das Listen-Laden, soll die
  // Uebersicht trotzdem rendern.
  try {
    page.berichtsstaende = await fetchBerichtsstaende(supabase);
  } catch (e) {
    console.error('❌ Investor-Dashboard: Berichtsstände konnten nicht geladen werden', e);
    page.berichtsstaende = [];
  }
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
      db: sumDb
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

function betrag(v) {
  return parseFloat(v) || 0;
}

function auftragIdVonKoop(koop, kampagneToAuftrag) {
  return koop ? (kampagneToAuftrag.get(koop.kampagne_id) || null) : null;
}

// Dieselbe Zuordnung wie bisher: Creator nur mit Kooperation im Filter,
// Contracting nur wenn der Auftrag nicht herausgefiltert ist.
function rechnungenImFilter(page) {
  const ids = new Set(auftraegeImFilter(page).map(a => a.id));
  const koopById = new Map((page.kooperationen || []).map(k => [k.id, k]));
  const kampagneToAuftrag = new Map((page.kampagnen || []).map(k => [k.id, k.auftrag_id]));
  const creator = [];
  const contracting = [];
  for (const rechnung of page.rechnungen || []) {
    const koop = rechnung.kooperation_id ? koopById.get(rechnung.kooperation_id) : null;
    if (rechnung.rechnungstyp === 'contracting') {
      const auftragId = rechnung.auftrag_id || auftragIdVonKoop(koop, kampagneToAuftrag);
      if (auftragId && !ids.has(auftragId)) continue;
      contracting.push(rechnung);
      continue;
    }
    const auftragId = auftragIdVonKoop(koop, kampagneToAuftrag);
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

function sortBelege(list) {
  return list.slice().sort((a, b) => (b.betrag || 0) - (a.betrag || 0));
}

function pushBeleg(bucket, kategorie, fields) {
  bucket[kategorie].push({ kategorie, ...fields });
}

function leereKundenBelege() {
  return { netto: [], gestellt: [], bezahlt: [], unbezahlt: [], ueberfaellig: [] };
}

function leereRechnungBelege() {
  return { netto: [], bezahlt: [], unbezahlt: [], ust: [], brutto: [] };
}

function kundenLabel(row) {
  return (row?.auftragsname || row?.titel || '').trim() || 'Auftrag';
}

// Belege zu einer Zelle. Summe je Kategorie = kartenSummen(...).seite.feld.
export function kartenBelege(page) {
  const kunden = leereKundenBelege();
  for (const row of kundenZeilenImFilter(page)) {
    const netto = betrag(row.nettobetrag);
    const basis = {
      seite: 'kunden',
      id: row.teilrechnung_id || row.id,
      label: kundenLabel(row),
      route: `/auftrag/${row.id}`,
    };
    pushBeleg(kunden, 'netto', { ...basis, datum: row.rechnung_gestellt_am || null, betrag: netto });
    if (hatRechnungsdatum(row)) {
      pushBeleg(kunden, 'gestellt', { ...basis, datum: row.rechnung_gestellt_am || null, betrag: netto });
    }
    if (isInvoiceRowPaid(row)) {
      pushBeleg(kunden, 'bezahlt', { ...basis, datum: row.ueberwiesen_am || null, betrag: netto });
    } else {
      pushBeleg(kunden, 'unbezahlt', { ...basis, datum: row.re_faelligkeit || null, betrag: netto });
      if (isReFaelligkeitOverdue(row?.re_faelligkeit)) {
        pushBeleg(kunden, 'ueberfaellig', { ...basis, datum: row.re_faelligkeit || null, betrag: netto });
      }
    }
  }

  const { creator, contracting, auftragById } = rechnungenImFilter(page);
  const rechnungBelege = (rows, seite) => {
    const bucket = leereRechnungBelege();
    for (const rechnung of rows) {
      const auftrag = rechnung.auftrag_id ? auftragById.get(rechnung.auftrag_id) : null;
      const label = (rechnung.rechnung_nr || '').trim() || kundenLabel(auftrag);
      const basis = {
        seite,
        id: rechnung.id,
        label,
        route: `/rechnung/${rechnung.id}`,
      };
      const netto = betrag(rechnung.nettobetrag);
      pushBeleg(bucket, 'netto', { ...basis, datum: rechnung.gestellt_am || null, betrag: netto });
      pushBeleg(bucket, 'ust', { ...basis, datum: rechnung.gestellt_am || null, betrag: betrag(rechnung.ust_betrag) });
      pushBeleg(bucket, 'brutto', { ...basis, datum: rechnung.gestellt_am || null, betrag: betrag(rechnung.bruttobetrag) });
      if (rechnung.status === 'Bezahlt') {
        pushBeleg(bucket, 'bezahlt', { ...basis, datum: rechnung.bezahlt_am || null, betrag: netto });
      } else {
        pushBeleg(bucket, 'unbezahlt', { ...basis, datum: rechnung.zahlungsziel || null, betrag: netto });
      }
    }
    return bucket;
  };

  const sortSeite = (seite) => Object.fromEntries(
    Object.entries(seite).map(([key, list]) => [key, sortBelege(list)])
  );

  return {
    kunden: sortSeite(kunden),
    creator: sortSeite(rechnungBelege(creator, 'creator')),
    contracting: sortSeite(rechnungBelege(contracting, 'contracting')),
  };
}
