// Filter, Tab-Zuordnung und Gruppierung der Stakeholder-Übersicht.
// Reine Funktionen: Jahr, Leistungsbereich, Index-Maps, Fee/Volumen.

import { sumBlockUmsatz } from '../projekt-erstellen/logic/CampaignBudgetFields.js';
import { primaerBereichForAuftrag } from '../../core/budget/leistungsbereich.js';

export const TAB_GESAMT = 'gesamt';
export const TAB_GESAMT_OHNE = 'gesamt_ohne';
export const TAB_GESAMT_MIT = 'gesamt_mit';
export const TAB_INFLUENCER = 'influencer_marketing';
const TAB_UGC_PAID = 'ugc_paid';
const TAB_UGC_ORGANIC = 'ugc_organic';
const TAB_VOR_ORT = 'vorort_produktion';
export const TAB_CONTRACTING = 'contracting';
const TAB_WHITELISTING = 'whitelisting';
const TAB_DARKPOSTING = 'darkposting';

export function isGesamtTab(tab) {
  return tab === TAB_GESAMT_OHNE || tab === TAB_GESAMT_MIT || tab === TAB_GESAMT;
}

export const INFLUENCER_CHIPS = new Set(['influencer', 'story', 'event']);

const FEE_KEYS = [
  'agency_services_enabled',
  'percentage_fee_enabled',
  'percentage_fee_value',
  'ksk_enabled',
  'ksk_value'
];

// Nur die Agentur-Fee (percentage_fee_value) wird über die Laufzeit erkannt.
// Start 1.8., Ende 30.9., heute 1.9. → 0,5. ende fehlt → 1.
export function elapsedRatio(start, ende, today = new Date()) {
  const s = start ? new Date(start).getTime() : null;
  const e = ende ? new Date(ende).getTime() : null;
  if (s == null || e == null || !Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 1;
  const t = today.getTime();
  return Math.min(1, Math.max(0, (t - s) / (e - s)));
}

export function mergeFeeSource(details, auftrag) {
  const merged = { ...(details || {}) };
  FEE_KEYS.forEach(key => {
    const empty = merged[key] == null || merged[key] === '';
    if (empty && auftrag?.[key] != null && auftrag[key] !== '') {
      merged[key] = auftrag[key];
    }
  });
  return merged;
}

// GESAMT zeigt das Auftragsvolumen. In einem Kategorie-Tab ist der gepflegte
// Kampagnenart-Umsatz die genauere Zahl; ohne gepflegten Block bleibt der Nettobetrag.
export function resolveVolumen(auftrag, blocks, activeTab) {
  const netto = parseFloat(auftrag?.nettobetrag) || 0;
  if (isGesamtTab(activeTab)) return netto;

  const { sum, hasAny } = sumBlockUmsatz(blocks);
  return hasAny ? sum : netto;
}

export function resolvePercentageFee(details) {
  if (!details?.agency_services_enabled || !details?.percentage_fee_enabled) return 0;
  return parseFloat(details.percentage_fee_value) || 0;
}

const MARK_NONE = '__none__';
const DATE_MONTH = { month: 'short', year: 'numeric' };

function markeKey(auftrag) {
  return auftrag?.marke_id || auftrag?.marke?.id || MARK_NONE;
}

function toTime(d) {
  const t = d ? new Date(d).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
}

function fmtMonatJahr(d) {
  return new Date(d).toLocaleDateString('de-DE', DATE_MONTH);
}

export function groupRowsByKundeMarke(rows) {
  const groups = new Map();

  (rows || []).forEach(r => {
    const auftrag = r.auftrag || {};
    const unternehmenId = auftrag.unternehmen_id || MARK_NONE;
    const mKey = markeKey(auftrag);
    const key = `${unternehmenId}::${mKey}`;

    if (!groups.has(key)) {
      groups.set(key, {
        unternehmenId,
        markeId: mKey,
        markeName: auftrag.marke?.markenname || '–',
        count: 0,
        volumen: 0,
        verbraucht: 0,
        verfuegbar: 0,
        creator: 0,
        agentur: 0,
        agenturVoll: 0,
        ksk: 0,
        zusatz: 0,
        starts: [],
        endes: [],
        feeCount: 0,
        ekvkCount: 0
      });
    }

    const g = groups.get(key);
    g.count += 1;
    g.volumen += r.volumen || 0;
    g.verbraucht += r.verbraucht || 0;
    g.verfuegbar += r.verfuegbar || 0;
    g.creator += r.creator || 0;
    g.agentur += r.agentur || 0;
    g.agenturVoll += r.agenturVoll || 0;
    g.ksk += r.ksk || 0;
    g.zusatz += r.zusatz || 0;
    if (auftrag.start) g.starts.push(auftrag.start);
    if (auftrag.ende) g.endes.push(auftrag.ende);
    if (r.details?.percentage_fee_enabled) g.feeCount += 1;
    else g.ekvkCount += 1;
  });

  return Array.from(groups.values()).sort((a, b) => b.volumen - a.volumen);
}

export function groupZeitraum(starts, endes) {
  const times = [...(starts || []), ...(endes || [])].map(toTime).filter(t => t != null);
  if (times.length === 0) return '-';
  const min = Math.min(...times);
  const max = Math.max(...times);
  const a = fmtMonatJahr(min);
  const b = fmtMonatJahr(max);
  return a === b ? a : `${a} – ${b}`;
}

export function groupTypBadges(g) {
  const showFee = (g.feeCount || 0) > 0;
  const showEkvk = (g.ekvkCount || 0) > 0;
  const badges = [];
  if (showFee) badges.push({ label: 'FESTE FEE', fee: true });
  if (showEkvk) badges.push({ label: 'EK/VK', fee: false });
  if (badges.length === 0) badges.push({ label: 'EK/VK', fee: false });
  return badges;
}

const TABS = [
  { key: TAB_GESAMT_OHNE, label: 'GESAMT ohne Contracts' },
  { key: TAB_GESAMT_MIT, label: 'GESAMT mit' },
  { key: TAB_INFLUENCER, label: 'INFLUENCER MARKETING' },
  { key: TAB_UGC_PAID, label: 'UGC PAID' },
  { key: TAB_UGC_ORGANIC, label: 'UGC ORGANIC' },
  { key: TAB_VOR_ORT, label: 'VOR-ORT PRODUCTION' },
  { key: TAB_CONTRACTING, label: 'CONTRACTING' },
  { key: TAB_WHITELISTING, label: 'WHITELISTING' },
  { key: TAB_DARKPOSTING, label: 'DARKPOSTING' }
];

export function auftragYear(a) {
  const dateStr = a.start || a.created_at;
  if (!dateStr) return null;
  const y = new Date(dateStr).getFullYear();
  return Number.isFinite(y) ? y : null;
}

export function availableYears(page) {
  const years = new Set([new Date().getFullYear()]);
  page.auftraege.forEach(a => {
    const y = auftragYear(a);
    if (y) years.add(y);
  });
  return Array.from(years).sort((a, b) => b - a);
}

export function filteredAuftraege(page) {
  if (page.selectedYear === 'all') return page.auftraege;
  const year = parseInt(page.selectedYear, 10);
  return page.auftraege.filter(a => auftragYear(a) === year);
}

export function blocksByAuftrag(page) {
  const map = new Map();
  page.blocks.forEach(b => {
    if (!map.has(b.auftrag_id)) map.set(b.auftrag_id, []);
    map.get(b.auftrag_id).push(b);
  });
  return map;
}

export function koopsByAuftrag(page) {
  const kampagneToAuftrag = new Map();
  page.kampagnen.forEach(k => kampagneToAuftrag.set(k.id, k.auftrag_id));

  const map = new Map();
  page.kooperationen.forEach(koop => {
    const auftragId = kampagneToAuftrag.get(koop.kampagne_id);
    if (!auftragId) return;
    if (!map.has(auftragId)) map.set(auftragId, []);
    map.get(auftragId).push(koop);
  });
  return map;
}

export function videosByKoop(page) {
  const map = new Map();
  page.videos.forEach(v => {
    if (!map.has(v.kooperation_id)) map.set(v.kooperation_id, []);
    map.get(v.kooperation_id).push(v);
  });
  return map;
}

export function kampagnenByAuftrag(page) {
  const map = new Map();
  page.kampagnen.forEach(k => {
    if (!map.has(k.auftrag_id)) map.set(k.auftrag_id, []);
    map.get(k.auftrag_id).push(k);
  });
  return map;
}

// Die Zuordnung Kampagnenart -> Bereich kommt aus leistungsbereich.js;
// hier entscheidet nur noch die Tab-Prioritaet (Mehrbereichs-Auftraege
// erscheinen im Tab ihres Schwerpunkts).
export function tabForAuftrag(auftrag, blocks) {
  return primaerBereichForAuftrag(auftrag, blocks);
}

// Dieselbe Menge wie die Kalkulationskarten: Jahr plus Leistungsbereich.
export function auftraegeImFilter(page) {
  const blockMap = blocksByAuftrag(page);
  return filteredAuftraege(page).filter(a => {
    const tab = tabForAuftrag(a, blockMap.get(a.id));
    if (!isGesamtTab(page.activeTab) && tab !== page.activeTab) return false;
    if (page.activeTab === TAB_GESAMT_OHNE && tab === TAB_CONTRACTING) return false;
    return true;
  });
}

export function tabCounts(page) {
  const counts = new Map(TABS.map(t => [t.key, 0]));
  const blockMap = blocksByAuftrag(page);
  filteredAuftraege(page).forEach(a => {
    const tab = tabForAuftrag(a, blockMap.get(a.id));
    counts.set(tab, (counts.get(tab) || 0) + 1);
    counts.set(TAB_GESAMT_MIT, (counts.get(TAB_GESAMT_MIT) || 0) + 1);
    if (tab !== TAB_CONTRACTING) {
      counts.set(TAB_GESAMT_OHNE, (counts.get(TAB_GESAMT_OHNE) || 0) + 1);
    }
  });
  return counts;
}

export function visibleTabs(page) {
  const counts = tabCounts(page);
  return TABS.filter(t => isGesamtTab(t.key) || (counts.get(t.key) || 0) > 0);
}
