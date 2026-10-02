// stakeholderDashboard.js
// Reiner Rechenkern des Investor-Dashboards. Nimmt den Finanzbestand
// (Rohzeilen) und liefert das, was der Browser zum Anzeigen braucht:
// eine fertig gerechnete Zeile je Auftrag plus die Monatsauswertung.
//
// Laeuft auf dem Server (netlify/functions/stakeholder-dashboard.js) und als
// Fallback im Browser — dieselben Regeln (ADR 0006, ADR 0007), nur ein Ort
// fuer die Rechnung. Keine window-/document-Abhaengigkeit.
//
// Jahr und Leistungsbereich bleiben Filter im Browser: darum steht hier je
// Auftrag alles, was der Browser nur noch filtern, gruppieren und addieren
// muss. Alle Zahlungs-Summen sind additiv.

import { getChipFromKampagnenartName, sumBlockUmsatz } from '../../auftrag/logic/kampagnenartChip.js';
import { calculateBudgetOverview } from '../../../core/budget/calculateBudgetOverview.js';
import { calculateCreatorPaymentSummary } from '../../../core/budget/EkVkAgencyFeeHelper.js';
import { calculateMonatsauswertung } from '../../../core/budget/monatsauswertung.js';
import { kundenrechnungZeilen } from '../../../core/budget/kundenrechnungZeilen.js';
import {
  emptyRechnungSummary,
  summarizeKundenrechnungRows,
  summarizeRechnungRows,
} from '../../rechnung/invoiceCardTotals.js';
import {
  INFLUENCER_CHIPS,
  TAB_INFLUENCER,
  blocksByAuftrag,
  kampagnenByAuftrag,
  koopsByAuftrag,
  mergeFeeSource,
  resolvePercentageFee,
  tabForAuftrag,
  videosByKoop,
} from '../kern/stakeholderOverviewLogic.js';

export const DASHBOARD_VERSION = 1;

function zahl(v) {
  return parseFloat(v) || 0;
}

// Summen ohne Nullfelder: die meisten Auftraege haben z. B. keine
// Contracting-Rechnung. Der Browser addiert fehlende Felder als 0
// (stakeholderOverviewData.addiere), das spart je Zeile Dutzende Schluessel.
function ohneNullen(summe) {
  return Object.fromEntries(Object.entries(summe).filter(([, wert]) => wert !== 0));
}

// Auftrag der Rechnung: direkte Id, sonst Kampagne, sonst Kooperation.
function auftragIdVonRechnung(rechnung, koop, kampagneToAuftrag) {
  if (rechnung.auftrag_id) return rechnung.auftrag_id;
  if (rechnung.kampagne_id) {
    const vonKampagne = kampagneToAuftrag.get(rechnung.kampagne_id);
    if (vonKampagne) return vonKampagne;
  }
  return koop ? (kampagneToAuftrag.get(koop.kampagne_id) || null) : null;
}

// Rechnungen je Auftrag, getrennt nach Creator und Contracting.
// Creator: nur mit Auftrag im Bestand. Contracting: auch ohne Auftrag
// (landet dann in `contractingOhneAuftrag`), aber nicht zu einem Auftrag,
// der nicht im Bestand liegt.
function rechnungenJeAuftrag(bestand) {
  const auftragIds = new Set(bestand.auftraege.map(a => a.id));
  const koopById = new Map(bestand.kooperationen.map(k => [k.id, k]));
  const kampagneToAuftrag = new Map(bestand.kampagnen.map(k => [k.id, k.auftrag_id]));
  const creator = new Map();
  const contracting = new Map();
  const contractingOhneAuftrag = [];
  const push = (map, id, r) => {
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(r);
  };

  for (const rechnung of bestand.rechnungen) {
    const koop = rechnung.kooperation_id ? koopById.get(rechnung.kooperation_id) : null;
    const auftragId = auftragIdVonRechnung(rechnung, koop, kampagneToAuftrag);
    if (rechnung.rechnungstyp === 'contracting') {
      if (!auftragId) contractingOhneAuftrag.push(rechnung);
      else if (auftragIds.has(auftragId)) push(contracting, auftragId, rechnung);
      continue;
    }
    if (auftragId && auftragIds.has(auftragId)) push(creator, auftragId, rechnung);
  }
  return { creator, contracting, contractingOhneAuftrag };
}

// Nur fuer den Influencer-Tab: Creator-Budget (anteilig an den Influencer-
// Chips) und der darauf gebuchte Influencer-VK. Differenz siehe ADR 0007.
function influencerBudget(auftrag, rohDetails, koops, videoMap) {
  const chips = Array.isArray(rohDetails?.campaign_type) ? rohDetails.campaign_type : [];
  const influencerChips = chips.filter(c => INFLUENCER_CHIPS.has(c));
  const totalChips = chips.length || 1;
  const budget = zahl(auftrag.creator_budget) * (influencerChips.length / totalChips);

  let verbraucht = 0;
  koops.forEach(k => {
    (videoMap.get(k.id) || []).forEach(v => {
      const slug = getChipFromKampagnenartName(v.kampagnenart);
      if (slug && INFLUENCER_CHIPS.has(slug)) verbraucht += zahl(v.verkaufspreis_netto);
    });
  });
  return { budget, verbraucht };
}

/**
 * @param {object} bestand - Finanzbestand, Entwuerfe/Testunternehmen schon gefiltert
 * @returns {object} Dashboard-Ergebnis (JSON-serialisierbar)
 */
export function berechneDashboard(bestand = {}) {
  const b = {
    auftraege: bestand.auftraege || [],
    blocks: bestand.blocks || [],
    kampagnen: bestand.kampagnen || [],
    kooperationen: bestand.kooperationen || [],
    videos: bestand.videos || [],
    rechnungen: bestand.rechnungen || [],
    teilrechnungen: bestand.teilrechnungen || [],
    details: bestand.details || [],
    unternehmen: bestand.unternehmen || [],
    berichtsstaende: bestand.berichtsstaende || [],
  };

  const blockMap = blocksByAuftrag(b);
  const koopMap = koopsByAuftrag(b);
  const videoMap = videosByKoop(b);
  const kampMap = kampagnenByAuftrag(b);
  const detailsByAuftrag = new Map(b.details.map(d => [d.auftrag_id, d]));
  const rechnungen = rechnungenJeAuftrag(b);

  const teilrechnungenByAuftrag = new Map();
  b.teilrechnungen.forEach(t => {
    if (!teilrechnungenByAuftrag.has(t.auftrag_id)) teilrechnungenByAuftrag.set(t.auftrag_id, []);
    teilrechnungenByAuftrag.get(t.auftrag_id).push(t);
  });

  const zeilen = b.auftraege.map(a => {
    const blocks = blockMap.get(a.id) || [];
    const tab = tabForAuftrag(a, blocks);
    const rohDetails = detailsByAuftrag.get(a.id);
    const details = mergeFeeSource(rohDetails, a);
    const koops = koopMap.get(a.id) || [];
    const kampagnen = kampMap.get(a.id) || [];
    const videos = koops.flatMap(k => videoMap.get(k.id) || []);

    const summary = calculateBudgetOverview({
      auftrag: a,
      details,
      kooperationen: koops,
      videos,
      kampagnen,
    });

    const creator = summary.creatorAnteil || 0;
    const koopIds = new Set(koops.map(k => k.id));
    const auftragRechnungen = b.rechnungen.filter(r => {
      if (r.auftrag_id) return r.auftrag_id === a.id;
      return koopIds.has(r.kooperation_id);
    });
    const creatorPayment = calculateCreatorPaymentSummary(creator, auftragRechnungen);
    const blockSumme = sumBlockUmsatz(blocks);

    const kundenZeilen = kundenrechnungZeilen([a], teilrechnungenByAuftrag.get(a.id) || []);

    return {
      // Auftrag-Anteil: genug fuer Jahresfilter, Gruppierung und Anzeige.
      id: a.id,
      unternehmen_id: a.unternehmen_id || null,
      marke_id: a.marke_id || null,
      marke: a.marke ? { id: a.marke.id, markenname: a.marke.markenname } : null,
      start: a.start || null,
      ende: a.ende || null,
      created_at: a.created_at || null,
      tab,
      fee_aktiv: !!details.percentage_fee_enabled,
      // resolveVolumen: GESAMT zeigt den Nettobetrag, ein Kategorie-Tab die
      // Block-Summe (falls gepflegt).
      volumen_netto: zahl(a.nettobetrag),
      volumen_bloecke: blockSumme.sum,
      hat_bloecke: blockSumme.hasAny,
      creator,
      fee_roh: resolvePercentageFee(details),
      agentur_marge: summary.agencyFeeSummary?.ekVkMargin || 0,
      ksk: summary.agencyFeeSummary?.kskValue || 0,
      zusatz: summary.extraKostenVkSum || 0,
      ekvk_vk: summary.vkSum || 0,
      ekvk_realisiert: summary.ekVkMarginSum || 0,
      creator_bezahlt: creatorPayment.paid,
      creator_offen: creatorPayment.open,
      influencer: tab === TAB_INFLUENCER ? influencerBudget(a, rohDetails, koops, videoMap) : null,
      karten: {
        kunden: ohneNullen(summarizeKundenrechnungRows(kundenZeilen)),
        creator: ohneNullen(summarizeRechnungRows(rechnungen.creator.get(a.id))),
        contracting: ohneNullen(summarizeRechnungRows(rechnungen.contracting.get(a.id))),
      },
    };
  });

  const unternehmenIds = new Set(zeilen.map(z => z.unternehmen_id).filter(Boolean));

  return {
    version: DASHBOARD_VERSION,
    geladenAm: bestand.geladenAm || Date.now(),
    zeilen,
    contractingOhneAuftrag: rechnungen.contractingOhneAuftrag.length
      ? summarizeRechnungRows(rechnungen.contractingOhneAuftrag)
      : emptyRechnungSummary(),
    monatsauswertung: calculateMonatsauswertung({
      auftraege: b.auftraege,
      blocks: b.blocks,
      kampagnen: b.kampagnen,
      kooperationen: b.kooperationen,
      videos: b.videos,
      rechnungen: b.rechnungen,
      teilrechnungen: b.teilrechnungen,
    }),
    unternehmen: b.unternehmen
      .filter(u => unternehmenIds.has(u.id))
      .map(u => ({ id: u.id, firmenname: u.firmenname })),
    berichtsstaende: b.berichtsstaende,
  };
}
