// calculateBudgetOverview.js
// Extrahiert die Budget-Zusammenfassung aus AuftragsdetailsDetail, damit
// dieselbe Logik auch auf der Stakeholder-Gesamtübersicht (/stakeholder)
// aggregiert werden kann. Keine window-Abhängigkeiten.

import { berechneVerfuegbaresBudget, calculateEkVkTotals, calculateAgencyFeeSummary } from './EkVkAgencyFeeHelper.js';

/**
 * Bestimmt die Budget-Kachel-Variante: Influencer-Auftraege haben ein
 * festgelegtes Creatorbudget (VK-basierte Leiste), UGC-Auftraege rechnen
 * ueber die EK/VK-Differenz (EK-basierte Leiste).
 * @param {object|null} details - auftrag_details
 * @returns {'influencer'|'ugc'}
 */
export function getBudgetCardVariant(details) {
  const d = details || {};
  const chips = Array.isArray(d.campaign_type) ? d.campaign_type : [];

  if (chips.includes('influencer') || chips.includes('story') || chips.includes('event')) return 'influencer';
  if (chips.some(chip => typeof chip === 'string' && chip.startsWith('ugc'))) return 'ugc';

  // Altbestand ohne Chips: ueber vorhandene Daten-Spalten erkennen
  const hasValue = (v) => v !== null && v !== undefined && v !== '';
  const suffixes = [
    'video_anzahl', 'bilder_anzahl', 'creator_anzahl', 'videographen_anzahl', 'budget_info',
    'einkaufspreis_netto_von', 'einkaufspreis_netto_bis',
    'verkaufspreis_netto_von', 'verkaufspreis_netto_bis'
  ];
  const hasDataForPrefixes = (prefixes) => prefixes.some(prefix =>
    suffixes.some(suffix => hasValue(d[`${prefix}_${suffix}`]))
  );

  if (hasDataForPrefixes(['influencer'])) return 'influencer';
  if (hasDataForPrefixes(['ugc_paid', 'ugc_organic', 'ugc', 'igc'])) return 'ugc';

  return 'influencer';
}

/**
 * Berechnet die Budget-Zusammenfassung für einen Auftrag.
 * Identisch zur bisherigen AuftragsdetailsDetail.calculateBudgetSummary,
 * aber als reine Funktion ohne Seiteneffekte.
 *
 * @param {object} params
 * @param {object} params.auftrag - auftrag (nettobetrag, creator_budget, ...)
 * @param {object|null} params.details - auftrag_details
 * @param {Array} params.kooperationen
 * @param {Array} params.videos
 * @param {Array} params.kampagnen
 * @returns {object} budgetSummary
 */
export function calculateBudgetOverview({ auftrag, details, kooperationen = [], videos = [], kampagnen = [] }) {
  const variant = getBudgetCardVariant(details);

  // Verfuegbares Budget (read-derived): creator_budget + KSK-Umbuchungen der Selbstzahler
  const verfuegbaresBudget = berechneVerfuegbaresBudget(auftrag, kooperationen);
  const totalBudget = verfuegbaresBudget.verfuegbar;
  const kskUmgebucht = verfuegbaresBudget.umgebucht;

  // Verbrauchtes Budget = Summe aller Video-EK-Netto + KSK-Aufschlaege (Selbstzahler)
  const usedBudget = (videos || []).reduce((sum, v) => {
    return sum + (parseFloat(v.einkaufspreis_netto) || 0);
  }, 0) + kskUmgebucht;

  // Gesamtanzahl Videos = Summe aller videoanzahl aus Kooperationen
  const totalVideos = (kooperationen || []).reduce((sum, koop) => {
    return sum + (parseInt(koop.videoanzahl, 10) || 0);
  }, 0);

  const totalCreators = (kooperationen || []).filter(k => k.creator?.id).length;

  const avgCostPerCreator = totalCreators > 0 ? usedBudget / totalCreators : 0;

  // VK-basierter Verbrauch (Influencer-Variante: Verbrauchtes Creatorbudget)
  const usedVkBudget = (videos || []).reduce((sum, v) => {
    return sum + (parseFloat(v.verkaufspreis_netto) || 0);
  }, 0);

  const extraKostenVkSum = (kooperationen || []).reduce((sum, k) => {
    return sum + (parseFloat(k.verkaufspreis_zusatzkosten) || 0);
  }, 0);

  const targetVideos = (kampagnen || []).reduce((sum, k) => sum + (k.videoanzahl || 0), 0);
  const targetCreators = (kampagnen || []).reduce((sum, k) => sum + (k.creatoranzahl || 0), 0);

  const ekVk = calculateEkVkTotals(kooperationen, videos);
  const ekSum = ekVk.ekSum;
  const vkSum = ekVk.vkSum;
  const ekVkMarginSum = ekVk.marginSum;
  const ekVkMarginCreatorbudgetPct = totalBudget > 0
    ? (ekVkMarginSum / totalBudget) * 100
    : 0;

  const agencyFeeSummary = calculateAgencyFeeSummary(details, kooperationen, videos, { variant });

  // Verbrauchtes Budget (EK-basiert): Creator-Anteil + Agenturanteil + KSK + Zusatzkosten
  const creatorAnteil = ekSum;
  const verbrauchtesBudget =
    creatorAnteil +
    (agencyFeeSummary?.total || 0) +
    (agencyFeeSummary?.kskValue || 0) +
    (extraKostenVkSum || 0);
  const auftragsvolumen = parseFloat(auftrag?.nettobetrag) || 0;
  const verfuegbaresBudgetRest = Math.max(0, auftragsvolumen - verbrauchtesBudget);

  return {
    variant,
    totalBudget,
    kskUmgebucht,
    usedBudget,
    totalVideos,
    totalCreators,
    avgCostPerCreator,
    usedVkBudget,
    extraKostenVkSum,
    targetVideos,
    targetCreators,
    ekSum,
    vkSum,
    ekVkMarginSum,
    ekVkMarginCreatorbudgetPct,
    agencyFeeSummary,
    creatorAnteil,
    verbrauchtesBudget,
    verfuegbaresBudget: verfuegbaresBudgetRest,
    auftragsvolumen
  };
}
