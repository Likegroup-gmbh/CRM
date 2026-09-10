// StakeholderOverviewPage.js
// Stakeholder-Gesamtübersicht (/admin/stakeholder, Admin-only).
// Zeitraum-Filter + Leistungsbereich-Auswahl (GESAMT ohne/mit Contracts, Influencer Marketing, UGC Paid,
// UGC Organic, Vor-Ort Production, Contracting). Darunter Budget-Karten
// (Auftragsvolumen, Verfügbares/Offenes Creator Budget, Verbrauchtes Budget,
// Creatoranteil, Agenturanteil, KSK-Abgabe, Zusatzkosten) und eine
// Kundenliste mit denselben Spalten.
// Rechenquelle: calculateBudgetOverview (gleiche Logik wie Auftragsdetails).

import { CAMPAIGN_TYPES } from '../projekt-erstellen/constants.js';
import { getChipFromKampagnenartName, sumBlockUmsatz } from '../projekt-erstellen/logic/CampaignBudgetFields.js';
import { calculateBudgetOverview } from '../../core/budget/calculateBudgetOverview.js';
import { calculateCreatorPaymentSummary } from '../../core/budget/EkVkAgencyFeeHelper.js';
import {
  LEISTUNGSBEREICHE,
  LEISTUNGSBEREICH_LABELS,
  primaerBereichForAuftrag,
} from '../../core/budget/leistungsbereich.js';
import { calculateMonatsauswertung, zuordnungsquote } from '../../core/budget/monatsauswertung.js';
import { calculateRechnungsstatus } from '../../core/budget/rechnungsstatus.js';
import {
  BERICHTSSTAND_VERSION,
  buildBerichtsstandPayload,
  saveBerichtsstand,
  fetchBerichtsstaende,
  fetchBerichtsstand,
} from './berichtsstandStore.js';
import { sumPaidInvoiceRows } from '../auftrag/logic/PaymentRowStatus.js';
import { icon } from '../../core/icons/IconSystem.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import { fetchAllRows } from '../../core/fetchAllRows.js';
import { escapeHtml, formatEuro } from '../../core/format.js';

const SUPABASE = () => window.supabase;

const TAB_GESAMT = 'gesamt';
const TAB_GESAMT_OHNE = 'gesamt_ohne';
const TAB_GESAMT_MIT = 'gesamt_mit';
const TAB_INFLUENCER = 'influencer_marketing';
const TAB_UGC_PAID = 'ugc_paid';
const TAB_UGC_ORGANIC = 'ugc_organic';
const TAB_VOR_ORT = 'vorort_produktion';
const TAB_CONTRACTING = 'contracting';
const TAB_WHITELISTING = 'whitelisting';
const TAB_DARKPOSTING = 'darkposting';

function isGesamtTab(tab) {
  return tab === TAB_GESAMT_OHNE || tab === TAB_GESAMT_MIT || tab === TAB_GESAMT;
}

const INFLUENCER_CHIPS = new Set(['influencer', 'story', 'event']);

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

// Metriken der Monatsmatrix: Label und Zellwert an einem Ort.
const MONATS_METRIKEN = {
  umsatz: {
    label: 'Umsatz (netto, nach Rechnungsdatum)',
    wert: (row, m) => row.umsatz[m],
  },
  fremdkosten: {
    label: 'Fremdkosten gesamt (Honorar + KSK + Zusatzkosten)',
    wert: (row, m) => (row.honorar[m] || 0) + (row.ksk[m] || 0) + (row.zusatzkosten[m] || 0),
  },
  differenz: {
    label: 'Differenz (Umsatz − Fremdkosten)',
    wert: (row, m) => row.differenz[m],
  },
};

const CARD_HINTS = {
  volumen: {
    formula: 'Σ Nettobetrag aller Aufträge',
    hint: 'was der Kunde beauftragt hat'
  },
  verbraucht: {
    formula: 'Creatoranteil + Agenturanteil + KSK + Zusatzkosten',
    hint: 'alles, was bereits gebucht ist'
  },
  verfuegbar: {
    formula: 'Auftragsvolumen − Verbrauchtes Budget',
    hint: 'noch nicht gebucht'
  },
  offenCreator: {
    formula: 'Creator-Budget − gebuchte VK',
    hint: 'noch nicht gebuchtes Creator-Budget'
  },
  creator: {
    formula: 'Σ Einkaufspreise (EK) der gebuchten Videos',
    hint: 'Kalkulation — nicht die gestellten Creatorrechnungen im Zahlungsstand'
  },
  agentur: {
    formula: 'Feste Fee + EK/VK-Differenz',
    hint: 'Influencer-Fee wird zeitanteilig über die Laufzeit erkannt'
  },
  ksk: {
    formula: 'UGC: 4,9 % auf EK · Influencer: KSK-Topf',
    hint: 'Künstlersozialabgabe auf Honorare'
  },
  zusatz: {
    formula: 'Σ Zusatzkosten der Kooperationen',
    hint: 'Reise, Lizenzen, Tools, Versand, Payroll'
  },
  bezahlt: {
    formula: 'Σ Netto/Brutto der Rechnungen mit „Bezahlt am"-Datum',
    hint: 'nur tatsächlich überwiesene Kundenrechnungen'
  }
};

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

export class StakeholderOverviewPage {
  constructor() {
    this.auftraege = [];
    this.blocks = [];
    this.kampagnen = [];
    this.kooperationen = [];
    this.videos = [];
    this.rechnungen = [];
    this.teilrechnungen = [];
    this.detailsByAuftrag = new Map();
    this.unternehmenById = new Map();
    this.selectedYear = 'all';
    this.activeTab = TAB_GESAMT_OHNE;
    // Monatsauswertung (ADR 0006): eigene Ansicht neben der Kalkulation.
    this.activeView = 'kalkulation'; // 'kalkulation' | 'monate'
    this.monatsSicht = 'marge'; // 'marge' | 'buchhaltung'
    this.monatsMetrik = 'differenz'; // 'umsatz' | 'fremdkosten' | 'differenz'
    this._monats = null;
    this._status = null;
    // Berichtsstände (PRD Schritt 7): eingefrorene Stände der Auswertung.
    // aktiverBerichtsstand === null bedeutet Live-Ansicht.
    this.berichtsstaende = [];
    this.aktiverBerichtsstand = null;
    this._eventsBound = false;
    this._docClickHandler = null;
    this._docChangeHandler = null;
    this._berichtWahl = 'live';
  }

  async init() {
    if (!window.isAdmin?.()) {
      window.setContentSafely(window.content, `
        <div class="empty-state">
          <p>Kein Zugriff – diese Seite ist nur für Admins.</p>
        </div>
      `);
      return;
    }

    window.setHeadline('Stakeholder-Übersicht');
    window.setContentSafely(window.content, '<div class="stakeholder-loading">Lade Daten...</div>');

    try {
      await this.loadData();
    } catch (e) {
      console.error('❌ Stakeholder-Übersicht: Daten konnten nicht geladen werden', e);
      window.setContentSafely(window.content, `
        <div class="empty-state"><p>Fehler beim Laden: ${this.escape(e?.message || 'Unbekannt')}</p></div>
      `);
      return;
    }

    this.render();
    this.bindEvents();
  }

  async loadData() {
    const supabase = SUPABASE();
    if (!supabase) throw new Error('Supabase nicht verfügbar');

    // Alle Tabellen seitenweise (fetchAllRows), damit nichts am
    // PostgREST-Zeilenlimit verloren geht.
    const [auftraege, blocks, kampagnen, koops, videos, details, unternehmen, rechnungen, teilrechnungen] = await Promise.all([
      fetchAllRows(supabase, 'auftrag',
        'id, titel, auftragsname, nettobetrag, bruttobetrag, creator_budget, auftragtype, start, ende, created_at, is_draft, unternehmen_id, marke_id, agency_services_enabled, percentage_fee_enabled, percentage_fee_value, ksk_enabled, ksk_value, rechnung_gestellt_am, ueberwiesen, ueberwiesen_am, re_faelligkeit, marke:marke_id(id, markenname)'),
      fetchAllRows(supabase, 'auftrag_kampagnenart_blocks',
        'id, auftrag_id, campaign_type, campaign_type_label, umsatz_netto, sort_order'),
      fetchAllRows(supabase, 'kampagne',
        'id, auftrag_id, videoanzahl, creatoranzahl'),
      fetchAllRows(supabase, 'kooperationen',
        'id, kampagne_id, creator_id, videoanzahl, einkaufspreis_netto, verkaufspreis_netto, verkaufspreis_zusatzkosten, ksk_selbstzahler, ksk_betrag'),
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
        'id, kooperation_id, auftrag_id, status, nettobetrag, nettobetrag_steuerfrei, zusatzkosten, gestellt_am, bezahlt_am, zahlungsziel, rechnungstyp'),
      // Kundenrechnungen: geplante und gestellte Teilrechnungen je Auftrag,
      // inkl. Zahlungsstatus (ueberwiesen_am) und Faelligkeit.
      fetchAllRows(supabase, 'auftrag_teilrechnung',
        'id, auftrag_id, nettobetrag, bruttobetrag, rechnung_gestellt, rechnung_gestellt_am, ueberwiesen, ueberwiesen_am, re_faelligkeit'),
    ]);

    this.auftraege = (auftraege || []).filter(a => a.is_draft !== true);
    this.blocks = blocks || [];
    this.kampagnen = kampagnen || [];
    this.kooperationen = koops || [];
    this.videos = videos || [];
    this.rechnungen = rechnungen || [];
    this.teilrechnungen = teilrechnungen || [];
    this.detailsByAuftrag = new Map((details || []).map(d => [d.auftrag_id, d]));
    this.unternehmenById = new Map((unternehmen || []).map(u => [u.id, u]));

    // Berichtsstände sind ein Add-on: scheitert das Listen-Laden, soll die
    // Uebersicht trotzdem rendern.
    try {
      this.berichtsstaende = await fetchBerichtsstaende(supabase);
    } catch (e) {
      console.error('❌ Stakeholder-Übersicht: Berichtsstände konnten nicht geladen werden', e);
      this.berichtsstaende = [];
    }
  }

  // ---------- Helpers ----------

  escape(v) {
    return escapeHtml(v);
  }

  fmtEuro(n) {
    return formatEuro(n);
  }

  fmtPct(n) {
    return (Number(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
  }

  renderAgenturZelle(earned, voll) {
    const total = Number(voll) || 0;
    const pct = total > 0 ? ((Number(earned) || 0) / total) * 100 : null;
    return `
      <div class="stakeholder-agentur">
        <div class="stakeholder-agentur-top">
          <span>${this.fmtEuro(earned)}</span>
          ${pct != null ? `<span class="stakeholder-agentur-pct">${this.fmtPct(pct)}</span>` : ''}
        </div>
        <div class="stakeholder-agentur-meta">von ${this.fmtEuro(total)}</div>
      </div>
    `;
  }

  auftragYear(a) {
    const dateStr = a.start || a.created_at;
    if (!dateStr) return null;
    const y = new Date(dateStr).getFullYear();
    return Number.isFinite(y) ? y : null;
  }

  availableYears() {
    const years = new Set();
    this.auftraege.forEach(a => {
      const y = this.auftragYear(a);
      if (y) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }

  filteredAuftraege() {
    if (this.selectedYear === 'all') return this.auftraege;
    const year = parseInt(this.selectedYear, 10);
    return this.auftraege.filter(a => this.auftragYear(a) === year);
  }

  campaignLabel(type) {
    return CAMPAIGN_TYPES.find(t => t.value === type)?.label || type;
  }

  blocksByAuftrag() {
    const map = new Map();
    this.blocks.forEach(b => {
      if (!map.has(b.auftrag_id)) map.set(b.auftrag_id, []);
      map.get(b.auftrag_id).push(b);
    });
    return map;
  }

  koopsByAuftrag() {
    const kampagneToAuftrag = new Map();
    this.kampagnen.forEach(k => kampagneToAuftrag.set(k.id, k.auftrag_id));

    const map = new Map();
    this.kooperationen.forEach(koop => {
      const auftragId = kampagneToAuftrag.get(koop.kampagne_id);
      if (!auftragId) return;
      if (!map.has(auftragId)) map.set(auftragId, []);
      map.get(auftragId).push(koop);
    });
    return map;
  }

  videosByKoop() {
    const map = new Map();
    this.videos.forEach(v => {
      if (!map.has(v.kooperation_id)) map.set(v.kooperation_id, []);
      map.get(v.kooperation_id).push(v);
    });
    return map;
  }

  kampagnenByAuftrag() {
    const map = new Map();
    this.kampagnen.forEach(k => {
      if (!map.has(k.auftrag_id)) map.set(k.auftrag_id, []);
      map.get(k.auftrag_id).push(k);
    });
    return map;
  }

  // ---------- Tab-Logik ----------

  // Die Zuordnung Kampagnenart -> Bereich kommt aus leistungsbereich.js;
  // hier entscheidet nur noch die Tab-Prioritaet (Mehrbereichs-Auftraege
  // erscheinen im Tab ihres Schwerpunkts).
  tabForAuftrag(auftrag, blocks) {
    return primaerBereichForAuftrag(auftrag, blocks);
  }

  tabCounts() {
    const counts = new Map(TABS.map(t => [t.key, 0]));
    const blockMap = this.blocksByAuftrag();
    this.filteredAuftraege().forEach(a => {
      const tab = this.tabForAuftrag(a, blockMap.get(a.id));
      counts.set(tab, (counts.get(tab) || 0) + 1);
      counts.set(TAB_GESAMT_MIT, (counts.get(TAB_GESAMT_MIT) || 0) + 1);
      if (tab !== TAB_CONTRACTING) {
        counts.set(TAB_GESAMT_OHNE, (counts.get(TAB_GESAMT_OHNE) || 0) + 1);
      }
    });
    return counts;
  }

  visibleTabs() {
    const counts = this.tabCounts();
    return TABS.filter(t => isGesamtTab(t.key) || (counts.get(t.key) || 0) > 0);
  }

  // ---------- Aggregation ----------

  // Teilrechnungen nach auftrag_id gruppieren (fuer die „Bereits bezahlt"-Card)
  teilrechnungenByAuftrag() {
    const map = new Map();
    (this.teilrechnungen || []).forEach(tr => {
      if (!map.has(tr.auftrag_id)) map.set(tr.auftrag_id, []);
      map.get(tr.auftrag_id).push(tr);
    });
    return map;
  }

  aggregate() {
    const auftraege = this.filteredAuftraege();
    const blockMap = this.blocksByAuftrag();
    const koopMap = this.koopsByAuftrag();
    const videoMap = this.videosByKoop();
    const kampMap = this.kampagnenByAuftrag();
    const trMap = this.teilrechnungenByAuftrag();

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
    let sumPaidNetto = 0;
    let sumPaidBrutto = 0;

    auftraege.forEach(a => {
      const blocks = blockMap.get(a.id) || [];
      const tab = this.tabForAuftrag(a, blocks);
      if (!isGesamtTab(this.activeTab) && tab !== this.activeTab) return;
      if (this.activeTab === TAB_GESAMT_OHNE && tab === TAB_CONTRACTING) return;

      const details = mergeFeeSource(this.detailsByAuftrag.get(a.id), a);
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

      const volumen = resolveVolumen(a, blocks, this.activeTab);
      const creator = summary.creatorAnteil || 0;
      const koopIds = new Set(koops.map(k => k.id));
      const auftragRechnungen = (this.rechnungen || []).filter(r => {
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

      // „Bereits bezahlt": Teilrechnungen haben eigene Betraege/Zahlungsdaten;
      // ohne Teilrechnungen gilt der Auftrags-Datensatz als eine Rechnungszeile.
      const trs = trMap.get(a.id) || [];
      const paid = trs.length > 0 ? sumPaidInvoiceRows(trs) : sumPaidInvoiceRows([a]);
      sumPaidNetto += paid.netto;
      sumPaidBrutto += paid.brutto;

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
        paidNetto: sumPaidNetto,
        paidBrutto: sumPaidBrutto
      }
    };
  }

  // ---------- Rendering ----------

  render() {
    const years = this.availableYears();
    const counts = this.tabCounts();
    const tabs = this.visibleTabs();
    const isMonate = this.activeView === 'monate';

    const tabOptions = tabs.map(t => `
      <option value="${t.key}"${this.activeTab === t.key ? ' selected' : ''}>${this.escape(t.label)} (${counts.get(t.key) || 0})</option>
    `).join('');

    const html = `
      <div class="stakeholder-page">
        ${this.renderRechnungsstatus()}
        <div class="stakeholder-toolbar">
          ${ViewModeToggle.render([
            { buttonId: 'btn-view-kalkulation', label: 'Kalkulation', active: !isMonate },
            { buttonId: 'btn-view-monate', label: 'Monatsauswertung', active: isMonate },
          ])}
          ${!isMonate ? `
          <div class="stakeholder-toolbar-filters">
            <div class="form-field">
              <label for="stakeholder-tab-select">Leistungsbereich</label>
              <select id="stakeholder-tab-select" class="form-select">
                ${tabOptions}
              </select>
            </div>
            <div class="form-field stakeholder-year-field">
              <label for="stakeholder-year-select">Zeitraum</label>
              <select id="stakeholder-year-select" class="form-select">
                <option value="all"${this.selectedYear === 'all' ? ' selected' : ''}>Alle Jahre</option>
                ${years.map(y => `<option value="${y}"${String(this.selectedYear) === String(y) ? ' selected' : ''}>${y}</option>`).join('')}
              </select>
            </div>
          </div>` : ''}
        </div>

        ${isMonate ? this.renderMonatsauswertung() : this.renderKalkulationBody()}
      </div>
    `;

    window.setContentSafely(window.content, html);
  }

  renderKalkulationBody() {
    const { rows, totals } = this.aggregate();
    const isInfluencerTab = this.activeTab === TAB_INFLUENCER;
    return `${this.renderCards(totals, isInfluencerTab)}${this.renderKundenListe(rows, totals, isInfluencerTab)}`;
  }

  monatsauswertung() {
    if (!this._monats) {
      this._monats = calculateMonatsauswertung({
        auftraege: this.auftraege,
        blocks: this.blocks,
        kampagnen: this.kampagnen,
        kooperationen: this.kooperationen,
        videos: this.videos,
        rechnungen: this.rechnungen,
        teilrechnungen: this.teilrechnungen,
      });
    }
    return this._monats;
  }

  // Zahlungsstand als Snapshot "Stand heute" (PRD Schritt 5). Haengt
  // bewusst nicht am Zeitraum-Filter und steht ueber beiden Ansichten.
  rechnungsstatus() {
    if (!this._status) {
      this._status = calculateRechnungsstatus({
        auftraege: this.auftraege,
        kampagnen: this.kampagnen,
        kooperationen: this.kooperationen,
        videos: this.videos,
        rechnungen: this.rechnungen,
        teilrechnungen: this.teilrechnungen,
      });
    }
    return this._status;
  }

  renderRechnungsstatus() {
    // Im Berichtsstand-Modus zeigt der Block den eingefrorenen Stand,
    // damit die Ansicht konsistent zum gesicherten Update bleibt.
    const eingefroren = this.aktiverBerichtsstand?.daten?.zahlungsstand;
    const { kunden, creator } = eingefroren || this.rechnungsstatus();

    const offenZelle = (seite) => `
      <div>${this.fmtEuro(seite.offen)}</div>
      ${seite.ueberfaellig >= 0.005
        ? `<div class="stakeholder-status-ueberfaellig">davon überfällig: ${this.fmtEuro(seite.ueberfaellig)}</div>`
        : ''}
    `;

    const zeile = (label, seite) => `
      <tr>
        <td>${label}</td>
        <td class="stakeholder-num">${this.fmtEuro(seite.gestellt)}</td>
        <td class="stakeholder-num">${this.fmtEuro(seite.bezahlt)}</td>
        <td class="stakeholder-num">${offenZelle(seite)}</td>
        <td class="stakeholder-num${seite.nichtGestellt < -0.005 ? ' stakeholder-negativ' : ''}">${this.fmtEuro(seite.nichtGestellt)}</td>
      </tr>
    `;

    return `
      <div class="stakeholder-list-card stakeholder-status">
        <div class="stakeholder-list-header">
          <h3 class="stakeholder-list-title">Zahlungsstand</h3>
          <p class="stakeholder-list-hint">${eingefroren
            ? `Stand ${this.fmtBerichtsstandDatum(this.aktiverBerichtsstand.created_at)} (eingefrorener Berichtsstand)`
            : 'Stand heute, unabhängig von Ansicht und Zeitraum'} · Gestellt = Summe aller gestellten Rechnungen · Bezahlt = Zahlung eingegangen · Offen = gestellt, nicht bezahlt · Noch nicht gestellt = Restbetrag aus Auftrag bzw. Kalkulation</p>
        </div>
        <div class="stakeholder-scroll-x">
        <table class="stakeholder-table stakeholder-status-table">
          <thead>
            <tr>
              <th></th>
              <th class="stakeholder-num">Gestellt</th>
              <th class="stakeholder-num">Bezahlt</th>
              <th class="stakeholder-num">Offen</th>
              <th class="stakeholder-num">Noch nicht gestellt</th>
            </tr>
          </thead>
          <tbody>
            ${zeile('Kundenrechnungen', kunden)}
            ${zeile('Creatorrechnungen', creator)}
          </tbody>
        </table>
        </div>
      </div>
    `;
  }

  fmtMonatLabel(monthKeyStr) {
    const [y, m] = monthKeyStr.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
  }

  // semantisch = true nur bei der Differenz-Metrik: dort traegt der Wert
  // eine Bewertung (gruen/rot). Umsatz und Fremdkosten bleiben neutral.
  fmtMonatsWert(v, semantisch = false) {
    if (v == null || Math.abs(v) < 0.005) return '<span class="stakeholder-null">–</span>';
    const cls = v < 0
      ? ' class="stakeholder-negativ"'
      : (semantisch ? ' class="stakeholder-positiv"' : '');
    return `<span${cls}>${this.fmtEuro(v)}</span>`;
  }

  // Quelle der Monatsauswertung: live gerechnet oder der eingefrorene
  // Berichtsstand (PRD Schritt 7). Gleiche Objektform in beiden Faellen.
  aktiveMonatsauswertung() {
    return this.aktiverBerichtsstand?.daten?.monatsauswertung || this.monatsauswertung();
  }

  defaultBerichtsstandLabel() {
    return `Investorenupdate ${new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`;
  }

  fmtBerichtsstandDatum(iso) {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  renderBerichtsstandLeiste() {
    const aktiv = this.aktiverBerichtsstand;
    const optionen = this.berichtsstaende.map(b =>
      `<option value="${this.escape(b.id)}"${aktiv?.id === b.id ? ' selected' : ''}>${this.escape(this.fmtBerichtsstandDatum(b.created_at))} — ${this.escape(b.label)}</option>`
    ).join('');

    const select = `
      <select id="stakeholder-bericht-select" class="form-select" aria-label="Berichtsstand wählen">
        <option value="live"${!aktiv ? ' selected' : ''}>Live-Ansicht</option>
        ${optionen}
      </select>`;

    if (aktiv) {
      return `
        <div class="stakeholder-bericht-banner">
          <span>Berichtsstand vom ${this.fmtBerichtsstandDatum(aktiv.created_at)} — „${this.escape(aktiv.label)}". Eingefrorener Stand; die Live-Werte können inzwischen abweichen.</span>
          ${select}
        </div>
      `;
    }

    return `
      <div class="stakeholder-bericht">
        ${select}
        <input type="text" id="stakeholder-bericht-label" class="form-input"
               value="${this.escape(this.defaultBerichtsstandLabel())}"
               aria-label="Bezeichnung des Berichtsstands" />
        <button type="button" id="stakeholder-bericht-sichern" class="mdc-btn">
          Berichtsstand sichern
        </button>
      </div>
    `;
  }

  renderMonatsauswertung() {
    const auswertung = this.aktiveMonatsauswertung();
    const view = auswertung.views[this.monatsSicht];
    const quote = zuordnungsquote(view);
    const stand = this.aktiverBerichtsstand
      ? this.fmtBerichtsstandDatum(this.aktiverBerichtsstand.created_at)
      : new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return `
      <div class="stakeholder-monate-toolbar">
        ${ViewModeToggle.render([
          {
            buttonId: 'btn-view-marge',
            label: 'Margensicht',
            active: this.monatsSicht === 'marge',
            title: 'Fremdkosten stehen im Monat der zugehörigen Kundenrechnung – so liest sich die Marge pro Monat richtig.',
          },
          {
            buttonId: 'btn-view-buchhaltung',
            label: 'Buchhaltungssicht',
            active: this.monatsSicht === 'buchhaltung',
            title: 'Jeder Beleg steht im Monat seines eigenen Rechnungsdatums – so ging der Monat durch die Bücher.',
          },
        ])}
        ${ViewModeToggle.render([
          { buttonId: 'btn-view-umsatz', label: 'Umsatz', active: this.monatsMetrik === 'umsatz' },
          { buttonId: 'btn-view-fremdkosten', label: 'Fremdkosten', active: this.monatsMetrik === 'fremdkosten' },
          { buttonId: 'btn-view-differenz', label: 'Differenz', active: this.monatsMetrik === 'differenz' },
        ])}
        <div class="stakeholder-monate-meta"
             title="Der nicht zugeordnete Rest ist ein Datenmangel (fehlende Kampagnenart-Blöcke). Die konkreten Fälle stehen in der Datenqualitätsanzeige im Adminbereich.">
          Stand ${stand}${this.aktiverBerichtsstand ? ' (eingefroren)' : ''}
          ${quote != null ? ` · ${this.fmtPct(quote * 100)} des Umsatzes einem Leistungsbereich zugeordnet` : ''}
          ${window.isAdmin?.() ? ` · <button type="button" class="stakeholder-dq-link" data-stakeholder-dq-link>Fälle in der Datenqualitätsanzeige ansehen</button>` : ''}
        </div>
      </div>
      ${this.renderBerichtsstandLeiste()}
      ${this.renderMonatsMatrix(view, auswertung.months)}
      ${this.renderFremdkostenPosten(view, auswertung.months)}
      ${this.renderSonderzeilen(auswertung.sonderzeilen)}
    `;
  }

  renderMonatsMatrix(view, months) {
    if (months.length === 0) {
      return `
        <div class="stakeholder-list-card">
          <div class="stakeholder-empty">Noch keine gestellten Rechnungen mit plausiblem Datum.</div>
        </div>
      `;
    }

    const metrik = MONATS_METRIKEN[this.monatsMetrik] || MONATS_METRIKEN.differenz;
    const semantisch = metrik === MONATS_METRIKEN.differenz;

    const aktiveBereiche = LEISTUNGSBEREICHE.filter(key => {
      const row = view.bereiche[key];
      if (!row) return false;
      return months.some(m => Math.abs(metrik.wert(row, m) || 0) >= 0.005);
    });

    const totals = {};
    months.forEach(m => {
      totals[m] = aktiveBereiche.reduce((s, key) => s + (metrik.wert(view.bereiche[key], m) || 0), 0);
    });

    return `
      <div class="stakeholder-list-card">
        <div class="stakeholder-list-header">
          <h3 class="stakeholder-list-title">${this.escape(metrik.label)}</h3>
          <p class="stakeholder-list-hint">${
            this.monatsSicht === 'marge'
              ? 'Margensicht: Fremdkosten folgen dem Umsatz anteilig über dessen Kundenrechnungsmonate. Nachlaufende Creatorrechnungen ändern abgeschlossene Monate rückwirkend.'
              : 'Buchhaltungssicht: jeder Beleg steht im Monat seines eigenen Rechnungsdatums.'
          }</p>
        </div>
        <div class="stakeholder-scroll-x">
        <table class="stakeholder-table stakeholder-matrix">
          <thead>
            <tr>
              <th>Leistungsbereich</th>
              ${months.map(m => `<th class="stakeholder-num">${this.fmtMonatLabel(m)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${aktiveBereiche.map(key => `
              <tr>
                <td>${this.escape(LEISTUNGSBEREICH_LABELS[key])}</td>
                ${months.map(m => `<td class="stakeholder-num">${this.fmtMonatsWert(metrik.wert(view.bereiche[key], m), semantisch)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="stakeholder-row--total">
              <td>GESAMT</td>
              ${months.map(m => `<td class="stakeholder-num">${this.fmtMonatsWert(totals[m], semantisch)}</td>`).join('')}
            </tr>
          </tfoot>
        </table>
        </div>
      </div>
    `;
  }

  renderFremdkostenPosten(view, months) {
    if (months.length === 0) return '';
    const posten = [
      ['Creator-Honorar', 'honorar'],
      ['KSK-Abgabe', 'ksk'],
      ['Zusatzkosten', 'zusatzkosten'],
    ];
    const sumOf = (field, m) => Object.values(view.bereiche)
      .reduce((s, row) => s + (row[field]?.[m] || 0), 0);

    return `
      <div class="stakeholder-list-card">
        <div class="stakeholder-list-header">
          <h3 class="stakeholder-list-title">Fremdkosten nach Posten</h3>
          <p class="stakeholder-list-hint">Die drei Posten bleiben getrennt – KSK wird berechnet (4,9 %), nie eingetragen; Selbstzahler ausgenommen.</p>
        </div>
        <div class="stakeholder-scroll-x">
        <table class="stakeholder-table stakeholder-matrix">
          <thead>
            <tr>
              <th>Posten</th>
              ${months.map(m => `<th class="stakeholder-num">${this.fmtMonatLabel(m)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${posten.map(([label, field]) => `
              <tr>
                <td>${label}</td>
                ${months.map(m => `<td class="stakeholder-num">${this.fmtMonatsWert(sumOf(field, m))}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        </div>
      </div>
    `;
  }

  renderSonderzeilen(sonderzeilen) {
    const zeilen = [
      {
        label: 'Noch nicht fakturiert (Creatorseite)',
        wert: sonderzeilen.nochNichtFakturiert.betrag,
        meta: `${sonderzeilen.nochNichtFakturiert.faelle} Kooperationen mit offenem Restbetrag`,
        hint: 'Kalkulierter Einkaufspreis minus bereits gestellte Creatorrechnungen. Fehlt in der Hauptzahl beider Sichten.',
      },
      {
        label: 'Ohne Kundenrechnung',
        wert: sonderzeilen.ohneKundenrechnung.betrag,
        meta: `${sonderzeilen.ohneKundenrechnung.faelle} Creatorrechnungen zu nie fakturierten Aufträgen`,
        hint: 'Diese Kosten haben in der Margensicht keinen Monat, weil der Auftrag nie fakturiert wurde. In der Buchhaltungssicht stehen sie in ihrem Rechnungsmonat.',
      },
      {
        label: 'Überfakturiert',
        wert: sonderzeilen.ueberfakturiert.betrag,
        meta: `${sonderzeilen.ueberfakturiert.faelle} Kooperationen über ihrem Einkaufspreis fakturiert`,
        hint: 'Gestellte Creatorrechnungen übersteigen den kalkulierten Einkaufspreis (ADR 0007: ausgewiesen, nicht geklemmt).',
        negativ: true,
      },
      {
        label: 'Unplausibles Rechnungsdatum',
        wert: sonderzeilen.unplausibleDaten.betrag,
        meta: `${sonderzeilen.unplausibleDaten.faelle} Creatorrechnungen mit Datum vor 2020`,
        hint: 'Diese Daten sind falsch und würden Phantom-Monate erzeugen. Bitte in der Buchhaltung korrigieren.',
      },
    ].filter(z => z.faelle !== 0 || Math.abs(z.wert) >= 0.005);

    if (zeilen.length === 0) return '';

    return `
      <div class="stakeholder-list-card">
        <div class="stakeholder-list-header">
          <h3 class="stakeholder-list-title">Nicht in der Monatsmatrix enthalten</h3>
          <p class="stakeholder-list-hint">Bewusst ausgewiesen statt untergeschlagen (ADR 0007) – diese Beträge fehlen in der Hauptzahl oben.</p>
        </div>
        <div class="stakeholder-sonderzeilen">
          ${zeilen.map(z => `
            <div class="stakeholder-sonderzeile" title="${this.escape(z.hint)}">
              <div class="stakeholder-sonderzeile-label">${this.escape(z.label)}</div>
              <div class="stakeholder-sonderzeile-wert${z.negativ ? ' stakeholder-negativ' : ''}">${this.fmtEuro(z.wert)}</div>
              <div class="stakeholder-sonderzeile-meta">${this.escape(z.meta)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  renderCards(totals, isInfluencerTab) {
    const volumen = totals.volumen;
    const verbraucht = totals.verbraucht;
    const verfuegbar = totals.verfuegbar;
    const creator = totals.creator;
    const agentur = totals.agentur;
    const ksk = totals.ksk;
    const zusatz = totals.zusatz;
    const db = totals.db;

    // Ungeklemmt: ueber 100 % bedeutet Ueberschreitung, unter 0 % Ueberzahlung.
    // Die Balkenbreite wird erst beim Rendern begrenzt.
    const verbrauchtPct = volumen > 0 ? (verbraucht / volumen) * 100 : 0;
    const offenPct = volumen > 0 ? 100 - verbrauchtPct : 0;
    const quote = verbraucht > 0 ? (agentur / verbraucht) * 100 : 0;

    const offenLabel = isInfluencerTab ? 'Offenes Creator Budget' : 'Verfügbares Budget';
    const offenSub = isInfluencerTab ? 'noch nicht gebucht' : 'noch nicht gebucht';
    const offenValue = isInfluencerTab
      ? this.influencerOffenesCreatorBudget()
      : verfuegbar;
    const offenHint = isInfluencerTab ? CARD_HINTS.offenCreator : CARD_HINTS.verfuegbar;

    const cardHead = (label, hint) => `
      <div class="stakeholder-card-head">
        <div class="stakeholder-card-label">${label}</div>
        ${hint ? `
          <button type="button" class="stakeholder-card-info" aria-label="Berechnung">
            ${icon('question-mark-circle', { stroke: 1, size: 16 })}
            <span class="stakeholder-card-tooltip" role="tooltip">
              <strong>${this.escape(hint.formula)}</strong>
              <span>${this.escape(hint.hint)}</span>
            </span>
          </button>` : ''}
      </div>`;

    const card = (label, value, sub, foot, opts = {}) => `
      <div class="stakeholder-card">
        ${cardHead(label, opts.hint)}
        <div class="stakeholder-card-value">${this.fmtEuro(value)}</div>
        ${sub ? `<div class="stakeholder-card-sub">${sub}</div>` : ''}
        ${opts.progress != null ? `
          <div class="stakeholder-progress">
            <div class="stakeholder-progress-fill${opts.progressClass ? ` ${opts.progressClass}` : ''}" style="width: ${Math.min(100, Math.max(0, opts.progress))}%"></div>
          </div>` : ''}
        ${foot ? `<div class="stakeholder-card-foot">${foot}</div>` : ''}
      </div>`;

    const breakdownCard = (label, value, sub, lines, foot, opts = {}) => `
      <div class="stakeholder-card">
        ${cardHead(label, opts.hint)}
        <div class="stakeholder-card-value">${this.fmtEuro(value)}</div>
        ${sub ? `<div class="stakeholder-card-sub">${sub}</div>` : ''}
        ${lines?.length ? `
          <div class="stakeholder-card-breakdown">
            ${lines.map(l => `<div class="stakeholder-card-breakdown-line"><span>${l[0]}</span><span>${l[1]}</span></div>`).join('')}
          </div>` : ''}
        ${opts.progress != null ? `
          <div class="stakeholder-progress">
            <div class="stakeholder-progress-fill${opts.progressClass ? ` ${opts.progressClass}` : ''}" style="width: ${Math.min(100, Math.max(0, opts.progress))}%"></div>
          </div>` : ''}
        ${foot ? `<div class="stakeholder-card-foot">${foot}</div>` : ''}
      </div>`;

    const progressClass = (pct) => pct >= 90 ? 'stakeholder-progress-fill--danger' : pct >= 75 ? 'stakeholder-progress-fill--warning' : '';
    const openProgressClass = (pct) => pct <= 10 ? 'stakeholder-progress-fill--danger' : pct <= 25 ? 'stakeholder-progress-fill--warning' : 'stakeholder-progress-fill--success';

    return `
      <div class="stakeholder-cards">
        ${card('Auftragsvolumen = Budget', volumen, 'was der Kunde beauftragt hat', 'jede Buchung verbraucht Budget', { hint: CARD_HINTS.volumen })}
        ${card('Verbrauchtes Budget', verbraucht, 'aufgeschlüsselt in der Zeile darunter', `${this.fmtPct(verbrauchtPct)} des Budgets`, { progress: verbrauchtPct, progressClass: progressClass(verbrauchtPct), hint: CARD_HINTS.verbraucht })}
        ${card(offenLabel, offenValue, offenSub, `${this.fmtPct(offenPct)} offen`, { progress: offenPct, progressClass: openProgressClass(offenPct), hint: offenHint })}
      </div>
      <div class="stakeholder-cards stakeholder-cards--paid">
        <div class="stakeholder-card stakeholder-card--wide">
          ${cardHead('Bereits bezahlt', CARD_HINTS.bezahlt)}
          <div class="stakeholder-card-paid-values">
            <div class="stakeholder-card-paid-value">
              <div class="stakeholder-card-value" data-paid-value="netto">${this.fmtEuro(totals.paidNetto)}</div>
              <div class="stakeholder-card-sub">Netto</div>
            </div>
            <div class="stakeholder-card-paid-value">
              <div class="stakeholder-card-value" data-paid-value="brutto">${this.fmtEuro(totals.paidBrutto)}</div>
              <div class="stakeholder-card-sub">Brutto</div>
            </div>
          </div>
        </div>
      </div>
      <div class="stakeholder-cards stakeholder-cards--breakdown">
        ${breakdownCard('Creatoranteil', creator, `${this.fmtEuro(totals.creatorPaid)} von ${this.fmtEuro(creator)} bezahlt`, [
          ['Bezahlt', this.fmtEuro(totals.creatorPaid)],
          ['Offen', this.fmtEuro(totals.creatorOpen)]
        ], `${this.fmtPct(verbraucht > 0 ? (creator / verbraucht) * 100 : 0)} · gebucht`, { progress: verbraucht > 0 ? (creator / verbraucht) * 100 : 0, hint: CARD_HINTS.creator })}
        ${breakdownCard('Agenturanteil', agentur, `${this.fmtEuro(agentur)} von ${this.fmtEuro(totals.agenturVoll)} eingelöst`, [
          ['Fest vereinbart', this.fmtEuro(totals.agenturFest)],
          ['EK/VK-Differenz', this.fmtEuro(totals.agenturMargin)]
        ], `${this.fmtPct(quote)} Quote`, { progress: quote, hint: CARD_HINTS.agentur })}
        ${breakdownCard('KSK-Abgabe', ksk, 'Künstlersozialabgabe auf Honorare', null, `${this.fmtPct(verbraucht > 0 ? (ksk / verbraucht) * 100 : 0)} · gebucht`, { progress: verbraucht > 0 ? (ksk / verbraucht) * 100 : 0, hint: CARD_HINTS.ksk })}
        ${breakdownCard('Zusatzkosten', zusatz, 'Reise, Lizenzen, Tools, Versand, Payroll', null, `${this.fmtPct(verbraucht > 0 ? (zusatz / verbraucht) * 100 : 0)} · gebucht`, { progress: verbraucht > 0 ? (zusatz / verbraucht) * 100 : 0, hint: CARD_HINTS.zusatz })}
      </div>
    `;
  }

  influencerOffenesCreatorBudget() {
    // Nur für den Influencer-Tab: Σ creator_budget der Influencer-Aufträge
    // + KSK-Umbuchung − Σ VK der Influencer-Videos.
    const auftraege = this.filteredAuftraege();
    const blockMap = this.blocksByAuftrag();
    const koopMap = this.koopsByAuftrag();
    const videoMap = this.videosByKoop();

    let budget = 0;
    let verbraucht = 0;

    auftraege.forEach(a => {
      const blocks = blockMap.get(a.id) || [];
      if (this.tabForAuftrag(a, blocks) !== TAB_INFLUENCER) return;

      const details = this.detailsByAuftrag.get(a.id) || {};
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

  renderKundenListe(rows, totals, isInfluencerTab) {
    if (rows.length === 0) {
      return `
        <div class="stakeholder-list-card">
          <div class="stakeholder-empty">Keine Aufträge im gewählten Zeitraum und Tab.</div>
        </div>
      `;
    }

    const grouped = groupRowsByKundeMarke(rows);

    const rowsHtml = grouped.map((g, i) => {
      const unternehmen = this.unternehmenById.get(g.unternehmenId);
      const name = unternehmen?.firmenname || 'Ohne Unternehmen';
      const countLabel = g.count === 1 ? '1 Auftrag' : `${g.count} Aufträge`;
      const zeitraum = groupZeitraum(g.starts, g.endes);
      const badges = groupTypBadges(g);
      const badgesHtml = badges.map(b =>
        `<span class="stakeholder-badge${b.fee ? ' stakeholder-badge--fee' : ''}">${b.label}</span>`
      ).join('');

      const verbrauchtPct = g.volumen > 0 ? Math.min(100, (g.verbraucht / g.volumen) * 100) : 0;
      const offenValue = g.verfuegbar;

      return `
        <tr>
          <td class="stakeholder-num">${i + 1}</td>
          <td>
            <div class="stakeholder-kunde">
              <span class="stakeholder-kunde-name">${this.escape(name)}</span>
              <span class="stakeholder-kunde-meta">${this.escape(countLabel)} · ${this.escape(zeitraum)}</span>
            </div>
          </td>
          <td>${this.escape(g.markeName)}</td>
          <td><div class="stakeholder-badges">${badgesHtml}</div></td>
          <td class="stakeholder-num">${this.fmtEuro(g.volumen)}</td>
          <td>
            <div class="stakeholder-verbraucht">
              <div class="stakeholder-verbraucht-top">
                <span>${this.fmtEuro(g.verbraucht)}</span>
                <span class="stakeholder-verbraucht-pct">${this.fmtPct(verbrauchtPct)}</span>
              </div>
              <div class="stakeholder-progress">
                <div class="stakeholder-progress-fill" style="width: ${verbrauchtPct}%"></div>
              </div>
            </div>
          </td>
          <td class="stakeholder-num">${this.fmtEuro(offenValue)}</td>
          <td class="stakeholder-num">${this.fmtEuro(g.creator)}</td>
          <td>${this.renderAgenturZelle(g.agentur, g.agenturVoll)}</td>
          <td class="stakeholder-num">${this.fmtEuro(g.ksk)}</td>
          <td class="stakeholder-num">${this.fmtEuro(g.zusatz)}</td>
        </tr>
      `;
    }).join('');

    const kundenLabel = grouped.length === 1 ? '1 Kunde' : `${grouped.length} Kunden`;

    return `
      <div class="stakeholder-list-card">
        <div class="stakeholder-list-header">
          <h3 class="stakeholder-list-title">Kunden nach Umsatz</h3>
          <p class="stakeholder-list-hint">Spalten wie Karten · ${kundenLabel}</p>
        </div>
        <div class="stakeholder-scroll-x">
        <table class="stakeholder-table stakeholder-table--kunden">
          <thead>
            <tr>
              <th class="stakeholder-num">#</th>
              <th>Kunde</th>
              <th>Marke</th>
              <th>Typ</th>
              <th class="stakeholder-num">Auftragsvolumen</th>
              <th>Verbrauchtes Budget</th>
              <th class="stakeholder-num">${isInfluencerTab ? 'Offenes Creator Budget' : 'Verfügbares Budget'}</th>
              <th class="stakeholder-num">Creatoranteil</th>
              <th class="stakeholder-num">Agenturanteil</th>
              <th class="stakeholder-num">KSK</th>
              <th class="stakeholder-num">Zusatzkosten</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr class="stakeholder-row--total">
              <td class="stakeholder-num"></td>
              <td>GESAMT</td>
              <td></td>
              <td></td>
              <td class="stakeholder-num">${this.fmtEuro(totals.volumen)}</td>
              <td class="stakeholder-num">${this.fmtEuro(totals.verbraucht)}</td>
              <td class="stakeholder-num">${this.fmtEuro(isInfluencerTab ? this.influencerOffenesCreatorBudget() : totals.verfuegbar)}</td>
              <td class="stakeholder-num">${this.fmtEuro(totals.creator)}</td>
              <td>${this.renderAgenturZelle(totals.agentur, totals.agenturVoll)}</td>
              <td class="stakeholder-num">${this.fmtEuro(totals.ksk)}</td>
              <td class="stakeholder-num">${this.fmtEuro(totals.zusatz)}</td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>
    `;
  }

  // Sichert den aktuellen Live-Stand als Berichtsstand (PRD Schritt 7).
  async sichereBerichtsstand() {
    // Doppelklick-Guard: Staende koennen bewusst nicht geloescht werden,
    // also darf ein Klick nicht zwei Belege erzeugen.
    if (this._berichtSpeichert) return;
    this._berichtSpeichert = true;
    const input = document.getElementById('stakeholder-bericht-label');
    const label = (input?.value || '').trim() || this.defaultBerichtsstandLabel();
    try {
      const daten = buildBerichtsstandPayload({
        monatsauswertung: this.monatsauswertung(),
        zahlungsstand: this.rechnungsstatus(),
      });
      const createdBy = window.currentUser?.auth_user_id || null;
      const row = await saveBerichtsstand(SUPABASE(), { label, daten, createdBy });
      this.berichtsstaende = [{ ...row, created_by: createdBy }, ...this.berichtsstaende];
      window.toastSystem?.show(`Berichtsstand „${label}" gesichert`, 'success');
    } catch (e) {
      console.error('❌ Berichtsstand konnte nicht gesichert werden', e);
      window.toastSystem?.show('Berichtsstand konnte nicht gesichert werden', 'error');
      return;
    } finally {
      this._berichtSpeichert = false;
    }
    this.render();
  }

  // Wechselt zwischen Live-Ansicht und einem eingefrorenen Berichtsstand.
  async oeffneBerichtsstand(id) {
    this._berichtWahl = id;
    if (id === 'live') {
      this.aktiverBerichtsstand = null;
      this.render();
      return;
    }
    let stand;
    try {
      stand = await fetchBerichtsstand(SUPABASE(), id);
    } catch (e) {
      console.error('❌ Berichtsstand konnte nicht geladen werden', e);
      window.toastSystem?.show('Berichtsstand konnte nicht geladen werden', 'error');
      return;
    }
    // Spaet eintreffende Antwort verwerfen, wenn inzwischen umgeschaltet wurde.
    if (this._berichtWahl !== id) return;
    if (stand.daten?.version !== BERICHTSSTAND_VERSION) {
      window.toastSystem?.show('Dieser Berichtsstand hat ein unbekanntes Format und kann nicht angezeigt werden', 'error');
      return;
    }
    this.aktiverBerichtsstand = stand;
    this.render();
  }

  bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    this._docClickHandler = (e) => {
      const dqLink = e.target.closest('[data-stakeholder-dq-link]');
      if (dqLink) {
        window.navigateTo('/admin/datenqualitaet');
        return;
      }

      const viewBtn = e.target.closest('#btn-view-kalkulation, #btn-view-monate');
      if (viewBtn) {
        this.activeView = viewBtn.id === 'btn-view-monate' ? 'monate' : 'kalkulation';
        // Berichtsstände gehören zur Monatsauswertung: beim Wechsel in die
        // Kalkulation gilt wieder die Live-Rechnung, sonst stuende dort ein
        // eingefrorener Zahlungsstand ohne Weg zurueck.
        if (this.activeView !== 'monate') this.aktiverBerichtsstand = null;
        this.render();
        return;
      }

      const sichtBtn = e.target.closest('#btn-view-marge, #btn-view-buchhaltung');
      if (sichtBtn) {
        this.monatsSicht = sichtBtn.id === 'btn-view-buchhaltung' ? 'buchhaltung' : 'marge';
        this.render();
        return;
      }

      const metrikBtn = e.target.closest('#btn-view-umsatz, #btn-view-fremdkosten, #btn-view-differenz');
      if (metrikBtn) {
        this.monatsMetrik = metrikBtn.id === 'btn-view-fremdkosten' ? 'fremdkosten'
          : metrikBtn.id === 'btn-view-differenz' ? 'differenz'
          : 'umsatz';
        this.render();
        return;
      }

      if (e.target.closest('#stakeholder-bericht-sichern')) {
        this.sichereBerichtsstand();
        return;
      }
    };
    document.addEventListener('click', this._docClickHandler);

    this._docChangeHandler = (e) => {
      if (e.target?.id === 'stakeholder-tab-select') {
        this.activeTab = e.target.value;
        this.render();
        return;
      }
      if (e.target?.id === 'stakeholder-bericht-select') {
        this.oeffneBerichtsstand(e.target.value);
        return;
      }
      if (e.target?.id !== 'stakeholder-year-select') return;
      this.selectedYear = e.target.value;
      this.render();
    };
    document.addEventListener('change', this._docChangeHandler);
  }

  destroy() {
    if (this._docClickHandler) {
      document.removeEventListener('click', this._docClickHandler);
      this._docClickHandler = null;
    }
    if (this._docChangeHandler) {
      document.removeEventListener('change', this._docChangeHandler);
      this._docChangeHandler = null;
    }
    this._eventsBound = false;
  }
}

export const stakeholderOverviewPage = new StakeholderOverviewPage();
