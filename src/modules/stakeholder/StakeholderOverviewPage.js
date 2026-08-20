// StakeholderOverviewPage.js
// Stakeholder-Gesamtübersicht (/stakeholder, Admin-only, Deep-Link).
// Zeitraum-Filter + Kategorie-Tabs (GESAMT, Influencer Marketing, UGC Paid,
// UGC Organic, Vor-Ort Production, Contracting). Darunter Budget-Karten
// (Auftragsvolumen, Verfügbares/Offenes Creator Budget, Verbrauchtes Budget,
// Creatoranteil, Agenturanteil, KSK-Abgabe, Zusatzkosten) und eine
// Kundenliste mit denselben Spalten.
// Rechenquelle: calculateBudgetOverview (gleiche Logik wie Auftragsdetails).

import { CAMPAIGN_TYPES } from '../projekt-erstellen/constants.js';
import { getChipFromKampagnenartName } from '../projekt-erstellen/logic/CampaignBudgetFields.js';
import { calculateBudgetOverview } from '../../core/budget/calculateBudgetOverview.js';
import { calculateCreatorPaymentSummary } from '../../core/budget/EkVkAgencyFeeHelper.js';
import { icon } from '../../core/icons/IconSystem.js';

const SUPABASE = () => window.supabase;

const TAB_GESAMT = 'gesamt';
const TAB_INFLUENCER = 'influencer_marketing';
const TAB_UGC_PAID = 'ugc_paid';
const TAB_UGC_ORGANIC = 'ugc_organic';
const TAB_VOR_ORT = 'vorort_produktion';
const TAB_CONTRACTING = 'contracting';
const TAB_WHITELISTING = 'whitelisting';
const TAB_DARKPOSTING = 'darkposting';

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

export function resolvePercentageFee(details) {
  if (!details?.agency_services_enabled || !details?.percentage_fee_enabled) return 0;
  return parseFloat(details.percentage_fee_value) || 0;
}

const MARK_NONE = '__none__';
const DATE_MONTH = { month: 'short', year: 'numeric' };

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
    formula: 'Σ Einkaufspreise (EK)',
    hint: 'Honorare der gebuchten Videos'
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
  { key: TAB_GESAMT, label: 'GESAMT' },
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
    this.detailsByAuftrag = new Map();
    this.unternehmenById = new Map();
    this.selectedYear = 'all';
    this.activeTab = TAB_GESAMT;
    this._eventsBound = false;
    this._docClickHandler = null;
    this._docChangeHandler = null;
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

    const [auftragRes, blocksRes, kampagnenRes, koopsRes, videosRes, detailsRes, unternehmenRes, rechnungRes] = await Promise.all([
      supabase
        .from('auftrag')
        .select('id, titel, auftragsname, nettobetrag, creator_budget, auftragtype, start, ende, created_at, is_draft, unternehmen_id, marke_id, agency_services_enabled, percentage_fee_enabled, percentage_fee_value, ksk_enabled, ksk_value, marke:marke_id(id, markenname)'),
      supabase
        .from('auftrag_kampagnenart_blocks')
        .select('id, auftrag_id, campaign_type, campaign_type_label, umsatz_netto, sort_order'),
      supabase
        .from('kampagne')
        .select('id, auftrag_id, videoanzahl, creatoranzahl'),
      supabase
        .from('kooperationen')
        .select('id, kampagne_id, creator_id, videoanzahl, einkaufspreis_netto, verkaufspreis_netto, verkaufspreis_zusatzkosten, ksk_selbstzahler, ksk_betrag'),
      supabase
        .from('kooperation_videos')
        .select('id, kooperation_id, einkaufspreis_netto, verkaufspreis_netto, kampagnenart'),
      supabase
        .from('auftrag_details')
        .select('auftrag_id, campaign_type, agency_services_enabled, percentage_fee_enabled, percentage_fee_value, ksk_enabled, ksk_value'),
      supabase
        .from('unternehmen')
        .select('id, firmenname'),
      supabase
        .from('rechnung')
        .select('kooperation_id, auftrag_id, status, nettobetrag, rechnungstyp')
    ]);

    if (auftragRes.error) throw auftragRes.error;
    if (blocksRes.error) throw blocksRes.error;
    if (kampagnenRes.error) throw kampagnenRes.error;
    if (koopsRes.error) throw koopsRes.error;
    if (videosRes.error) throw videosRes.error;
    if (detailsRes.error) throw detailsRes.error;
    if (unternehmenRes.error) throw unternehmenRes.error;
    if (rechnungRes.error) throw rechnungRes.error;

    this.auftraege = (auftragRes.data || []).filter(a => a.is_draft !== true);
    this.blocks = blocksRes.data || [];
    this.kampagnen = kampagnenRes.data || [];
    this.kooperationen = koopsRes.data || [];
    this.videos = videosRes.data || [];
    this.rechnungen = rechnungRes.data || [];
    this.detailsByAuftrag = new Map((detailsRes.data || []).map(d => [d.auftrag_id, d]));
    this.unternehmenById = new Map((unternehmenRes.data || []).map(u => [u.id, u]));
  }

  // ---------- Helpers ----------

  escape(v) {
    if (v == null) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  fmtEuro(n) {
    const num = Number(n) || 0;
    return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
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

  tabForAuftrag(auftrag, blocks) {
    if (auftrag.auftragtype === 'Contracting') return TAB_CONTRACTING;
    const chips = new Set((blocks || []).map(b => b.campaign_type).filter(Boolean));
    if (chips.size === 0) return TAB_GESAMT;
    if ([...chips].some(c => INFLUENCER_CHIPS.has(c))) return TAB_INFLUENCER;
    if (chips.has('ugc_paid')) return TAB_UGC_PAID;
    if (chips.has('ugc_organic')) return TAB_UGC_ORGANIC;
    if (chips.has('vorort_produktion')) return TAB_VOR_ORT;
    if (chips.has('whitelisting')) return TAB_WHITELISTING;
    if (chips.has('darkposting')) return TAB_DARKPOSTING;
    return TAB_GESAMT;
  }

  tabCounts() {
    const counts = new Map(TABS.map(t => [t.key, 0]));
    const blockMap = this.blocksByAuftrag();
    this.filteredAuftraege().forEach(a => {
      const tab = this.tabForAuftrag(a, blockMap.get(a.id));
      counts.set(tab, (counts.get(tab) || 0) + 1);
      counts.set(TAB_GESAMT, (counts.get(TAB_GESAMT) || 0) + 1);
    });
    return counts;
  }

  visibleTabs() {
    const counts = this.tabCounts();
    return TABS.filter(t => t.key === TAB_GESAMT || (counts.get(t.key) || 0) > 0);
  }

  // ---------- Aggregation ----------

  aggregate() {
    const auftraege = this.filteredAuftraege();
    const blockMap = this.blocksByAuftrag();
    const koopMap = this.koopsByAuftrag();
    const videoMap = this.videosByKoop();
    const kampMap = this.kampagnenByAuftrag();

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
      const tab = this.tabForAuftrag(a, blocks);
      if (this.activeTab !== TAB_GESAMT && tab !== this.activeTab) return;

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

      const volumen = parseFloat(a.nettobetrag) || 0;
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
      const verfuegbar = Math.max(0, volumen - verbraucht);
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

  // ---------- Rendering ----------

  render() {
    const years = this.availableYears();
    const counts = this.tabCounts();
    const tabs = this.visibleTabs();

    const tabButtons = tabs.map(t => `
      <button type="button" class="stakeholder-tab${this.activeTab === t.key ? ' active' : ''}"
              data-tab="${t.key}" role="tab" aria-selected="${this.activeTab === t.key}">
        ${t.label}
        <span class="stakeholder-tab-badge">${counts.get(t.key) || 0}</span>
      </button>
    `).join('');

    const { rows, totals } = this.aggregate();
    const isInfluencerTab = this.activeTab === TAB_INFLUENCER;

    const html = `
      <div class="stakeholder-page">
        <div class="stakeholder-toolbar">
          <div class="form-field stakeholder-year-field">
            <label for="stakeholder-year-select">Zeitraum</label>
            <select id="stakeholder-year-select">
              <option value="all"${this.selectedYear === 'all' ? ' selected' : ''}>Alle Jahre</option>
              ${years.map(y => `<option value="${y}"${String(this.selectedYear) === String(y) ? ' selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="stakeholder-tabs" role="tablist">
          ${tabButtons}
        </div>

        ${this.renderCards(totals, isInfluencerTab)}
        ${this.renderKundenListe(rows, totals, isInfluencerTab)}
      </div>
    `;

    window.setContentSafely(window.content, html);
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

    const verbrauchtPct = volumen > 0 ? Math.min(100, (verbraucht / volumen) * 100) : 0;
    const offenPct = volumen > 0 ? Math.max(0, 100 - verbrauchtPct) : 0;
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
        <div class="stakeholder-card-value${opts.accent ? ' stakeholder-card-value--accent' : ''}">${this.fmtEuro(value)}</div>
        ${sub ? `<div class="stakeholder-card-sub">${sub}</div>` : ''}
        ${opts.progress != null ? `
          <div class="stakeholder-progress">
            <div class="stakeholder-progress-fill${opts.progressClass ? ` ${opts.progressClass}` : ''}" style="width: ${Math.min(100, Math.max(0, opts.progress))}%"></div>
          </div>` : ''}
        ${foot ? `<div class="stakeholder-card-foot${opts.footAccent ? ' stakeholder-card-foot--accent' : ''}">${foot}</div>` : ''}
      </div>`;

    const breakdownCard = (label, value, sub, lines, foot, opts = {}) => `
      <div class="stakeholder-card">
        ${cardHead(label, opts.hint)}
        <div class="stakeholder-card-value${opts.accent ? ' stakeholder-card-value--accent' : ''}">${this.fmtEuro(value)}</div>
        ${sub ? `<div class="stakeholder-card-sub">${sub}</div>` : ''}
        ${lines?.length ? `
          <div class="stakeholder-card-breakdown">
            ${lines.map(l => `<div class="stakeholder-card-breakdown-line"><span>${l[0]}</span><span>${l[1]}</span></div>`).join('')}
          </div>` : ''}
        ${opts.progress != null ? `
          <div class="stakeholder-progress">
            <div class="stakeholder-progress-fill${opts.progressClass ? ` ${opts.progressClass}` : ''}" style="width: ${Math.min(100, Math.max(0, opts.progress))}%"></div>
          </div>` : ''}
        ${foot ? `<div class="stakeholder-card-foot${opts.footAccent ? ' stakeholder-card-foot--accent' : ''}">${foot}</div>` : ''}
      </div>`;

    const progressClass = (pct) => pct >= 90 ? 'stakeholder-progress-fill--danger' : pct >= 75 ? 'stakeholder-progress-fill--warning' : '';
    const openProgressClass = (pct) => pct <= 10 ? 'stakeholder-progress-fill--danger' : pct <= 25 ? 'stakeholder-progress-fill--warning' : 'stakeholder-progress-fill--success';

    return `
      <div class="stakeholder-cards">
        ${card('Auftragsvolumen = Budget', volumen, 'was der Kunde beauftragt hat', 'jede Buchung verbraucht Budget', { hint: CARD_HINTS.volumen })}
        ${card('Verbrauchtes Budget', verbraucht, 'aufgeschlüsselt in der Zeile darunter', `${this.fmtPct(verbrauchtPct)} des Budgets`, { progress: verbrauchtPct, progressClass: progressClass(verbrauchtPct), accent: true, footAccent: true, hint: CARD_HINTS.verbraucht })}
        ${card(offenLabel, offenValue, offenSub, `${this.fmtPct(offenPct)} offen`, { progress: offenPct, progressClass: openProgressClass(offenPct), hint: offenHint })}
      </div>
      <div class="stakeholder-cards stakeholder-cards--breakdown">
        ${breakdownCard('Creatoranteil', creator, `${this.fmtEuro(totals.creatorPaid)} von ${this.fmtEuro(creator)} bezahlt`, [
          ['Bezahlt', this.fmtEuro(totals.creatorPaid)],
          ['Offen', this.fmtEuro(totals.creatorOpen)]
        ], `${this.fmtPct(verbraucht > 0 ? (creator / verbraucht) * 100 : 0)} · gebucht`, { progress: verbraucht > 0 ? (creator / verbraucht) * 100 : 0, hint: CARD_HINTS.creator })}
        ${breakdownCard('Agenturanteil', agentur, `${this.fmtEuro(agentur)} von ${this.fmtEuro(totals.agenturVoll)} eingelöst`, [
          ['Fest vereinbart', this.fmtEuro(totals.agenturFest)],
          ['EK/VK-Differenz', this.fmtEuro(totals.agenturMargin)]
        ], `${this.fmtPct(quote)} Quote`, { progress: quote, accent: true, footAccent: true, hint: CARD_HINTS.agentur })}
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

    return Math.max(0, budget - verbraucht);
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
        <table class="stakeholder-table">
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
    `;
  }

  bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    this._docClickHandler = (e) => {
      const tab = e.target.closest('.stakeholder-tab');
      if (tab) {
        this.activeTab = tab.dataset.tab;
        this.render();
        return;
      }
    };
    document.addEventListener('click', this._docClickHandler);

    this._docChangeHandler = (e) => {
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
