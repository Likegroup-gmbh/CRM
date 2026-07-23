// StakeholderOverviewPage.js
// Stakeholder-Umsatzuebersicht mit vier Tabs:
// - "Plan": Verteilung des Auftrags-Nettoumsatzes auf Kampagnenarten
//   (auftrag_kampagnenart_blocks.umsatz_netto) inkl. Donut-Chart und
//   Datenluecken-Liste (read-only, Pflege ueber den Projekt-Bearbeiten-Wizard).
// - "Stand heute": Ist-Werte aus Kooperationen/Videos (EK = Fremdkosten /
//   verbrauchtes Creatorbudget, VK = Umsatz, DB = VK - EK) pro Kampagnenart,
//   plus Agentur-Fee gesamt (Festgelegt + EK/VK-Differenz) und KSK-Summe.
// - "DB Leistungsbereich": Monatspivot VK/EK/DB je Leistungsbereich
//   (= Kampagnenart), plus Pipeline-2026-Block (gebuchte Auftraege).
// - "DB Kunde": Monatspivot je Unternehmen, aufklappbar nach Leistungsbereich,
//   plus Konzentrations-Hinweis (Top-Kunden-Anteil).
// Durchgeleitete Umsaetze (Proxy: Koop-Zusatzkosten aus Rechnungen, NICHT in
// den Netto-Preisen enthalten) koennen in den DB-Tabs zugeschaltet werden.
// Erreichbar unter /stakeholder (kein Nav-Eintrag, Deep-Link only, Admin-only).

import { CAMPAIGN_TYPES } from '../projekt-erstellen/constants.js';
import { getChipFromKampagnenartName } from '../projekt-erstellen/logic/CampaignBudgetFields.js';
import { isFilledPrice } from '../../core/budget/EkVkAgencyFeeHelper.js';

const SUPABASE = () => window.supabase;

// Feste Farbpalette fuer die Kampagnenarten (Reihenfolge = CAMPAIGN_TYPES + Contracting)
const CHART_COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#ca8a04',
  '#16a34a', '#0d9488', '#0284c7', '#dc2626', '#9333ea',
  '#65a30d', '#475569'
];

const CONTRACTING_KEY = '__contracting__';
const UNASSIGNED_KEY = '__unassigned__';
const PASSTHROUGH_KEY = '__passthrough__';
const NO_CUSTOMER_KEY = '__no_customer__';
const DIFF_TOLERANCE = 1; // Euro
const MIN_MONTH = '2025-01'; // Auswertungsbeginn laut Anforderung
const MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export class StakeholderOverviewPage {
  constructor() {
    this.auftraege = [];
    this.blocks = [];
    this.kampagnen = [];
    this.kooperationen = [];
    this.videos = [];
    this.detailsByAuftrag = new Map();
    this.unternehmenById = new Map();
    this.selectedYear = 'all';
    this.activeTab = 'plan'; // 'plan' | 'ist' | 'db-lb' | 'db-kunde'
    this.dbMetric = 'db'; // 'vk' | 'ek' | 'db' | 'dbpct'
    this.includePassthrough = false; // Durchgeleitete Umsaetze (Zusatzkosten) einbeziehen
    this.expandedCustomers = new Set(); // Drilldown im Kunde-Tab
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
  }

  async loadData() {
    const supabase = SUPABASE();
    if (!supabase) throw new Error('Supabase nicht verfügbar');

    const [auftragRes, blocksRes, kampagnenRes, koopsRes, videosRes, detailsRes, unternehmenRes] = await Promise.all([
      supabase
        .from('auftrag')
        .select('id, titel, auftragsname, nettobetrag, auftragtype, start, created_at, is_draft, unternehmen_id'),
      supabase
        .from('auftrag_kampagnenart_blocks')
        .select('id, auftrag_id, campaign_type, campaign_type_label, umsatz_netto, sort_order'),
      supabase
        .from('kampagne')
        .select('id, auftrag_id'),
      supabase
        .from('kooperationen')
        .select('id, kampagne_id, einkaufspreis_netto, verkaufspreis_netto, einkaufspreis_zusatzkosten, verkaufspreis_zusatzkosten'),
      supabase
        .from('kooperation_videos')
        .select('id, kooperation_id, einkaufspreis_netto, verkaufspreis_netto, kampagnenart'),
      supabase
        .from('auftrag_details')
        .select('auftrag_id, agency_services_enabled, percentage_fee_enabled, percentage_fee_value, ksk_enabled, ksk_value'),
      supabase
        .from('unternehmen')
        .select('id, firmenname')
    ]);

    if (auftragRes.error) throw auftragRes.error;
    if (blocksRes.error) throw blocksRes.error;
    if (kampagnenRes.error) throw kampagnenRes.error;
    if (koopsRes.error) throw koopsRes.error;
    if (videosRes.error) throw videosRes.error;
    if (detailsRes.error) throw detailsRes.error;
    if (unternehmenRes.error) throw unternehmenRes.error;

    this.auftraege = (auftragRes.data || []).filter(a => a.is_draft !== true);
    this.blocks = blocksRes.data || [];
    this.kampagnen = kampagnenRes.data || [];
    this.kooperationen = koopsRes.data || [];
    this.videos = videosRes.data || [];
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

  auftragYear(a) {
    const dateStr = a.start || a.created_at;
    if (!dateStr) return null;
    const y = new Date(dateStr).getFullYear();
    return Number.isFinite(y) ? y : null;
  }

  // Monatsbucket "YYYY-MM" (gleiche Datumsquelle wie auftragYear)
  auftragMonth(a) {
    const dateStr = a.start || a.created_at;
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (!Number.isFinite(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  currentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  monthLabel(monthKey) {
    const [y, m] = monthKey.split('-');
    return `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y.slice(2)}`;
  }

  // Monatsraster: max(MIN_MONTH, fruehester Auftrag) bis heute,
  // optional per Jahr-Filter auf ein Jahr eingeschraenkt.
  monthRange() {
    const current = this.currentMonth();
    let earliest = null;
    this.auftraege.forEach(a => {
      const m = this.auftragMonth(a);
      if (m && m <= current && (!earliest || m < earliest)) earliest = m;
    });
    let start = earliest && earliest > MIN_MONTH ? earliest : MIN_MONTH;

    if (this.selectedYear !== 'all') {
      const y = String(this.selectedYear);
      const yearStart = `${y}-01`;
      const yearEnd = `${y}-12`;
      if (yearStart > start) start = yearStart;
      if (yearEnd < current) {
        return this.buildMonths(start, yearEnd);
      }
      return this.buildMonths(start, current > yearEnd ? yearEnd : current);
    }

    return this.buildMonths(start, current);
  }

  buildMonths(startKey, endKey) {
    const months = [];
    let [y, m] = startKey.split('-').map(n => parseInt(n, 10));
    const [ey, em] = endKey.split('-').map(n => parseInt(n, 10));
    while (y < ey || (y === ey && m <= em)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return months;
  }

  customerName(unternehmenId) {
    if (!unternehmenId) return 'Ohne Unternehmen';
    return this.unternehmenById.get(unternehmenId)?.firmenname || 'Unbekanntes Unternehmen';
  }

  auftragName(a) {
    return a.titel || a.auftragsname || 'Unbenannter Auftrag';
  }

  campaignLabel(type) {
    return CAMPAIGN_TYPES.find(t => t.value === type)?.label || type;
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

  blocksByAuftrag() {
    const map = new Map();
    this.blocks.forEach(b => {
      if (!map.has(b.auftrag_id)) map.set(b.auftrag_id, []);
      map.get(b.auftrag_id).push(b);
    });
    return map;
  }

  // ---------- Aggregation ----------

  aggregate() {
    const auftraege = this.filteredAuftraege();
    const blockMap = this.blocksByAuftrag();

    const categories = new Map(); // key -> { key, label, sum, auftragIds:Set }
    const addToCategory = (key, label, amount, auftragId) => {
      if (!categories.has(key)) {
        categories.set(key, { key, label, sum: 0, auftragIds: new Set() });
      }
      const cat = categories.get(key);
      cat.sum += amount;
      cat.auftragIds.add(auftragId);
    };

    let gesamt = 0;
    let zugeordnet = 0;
    let auftragSumme = 0; // Netto-Summe ueber ALLE Auftraege (auch ohne/negativen Betrag)
    const issues = []; // { auftrag, blocks, types: [...], diff }

    auftraege.forEach(a => {
      const netto = Number(a.nettobetrag) || 0;
      auftragSumme += netto;
      if (netto <= 0) return;
      gesamt += netto;

      if (a.auftragtype === 'Contracting') {
        addToCategory(CONTRACTING_KEY, 'Contracting', netto, a.id);
        zugeordnet += netto;
        return;
      }

      const blocks = blockMap.get(a.id) || [];
      let blockSum = 0;
      let hasMissingUmsatz = false;

      blocks.forEach(b => {
        const umsatz = b.umsatz_netto == null ? null : Number(b.umsatz_netto);
        if (umsatz == null) {
          hasMissingUmsatz = true;
          return;
        }
        blockSum += umsatz;
        addToCategory(b.campaign_type, b.campaign_type_label || this.campaignLabel(b.campaign_type), umsatz, a.id);
      });

      zugeordnet += blockSum;

      const diff = netto - blockSum;
      const issueTypes = [];
      if (blocks.length === 0) issueTypes.push('keine_art');
      if (blocks.length > 0 && hasMissingUmsatz) issueTypes.push('betrag_fehlt');
      if (blocks.length > 0 && Math.abs(diff) > DIFF_TOLERANCE) issueTypes.push('differenz');

      if (issueTypes.length > 0) {
        issues.push({ auftrag: a, blocks, types: issueTypes, diff });
      }
    });

    const sorted = Array.from(categories.values()).sort((a, b) => b.sum - a.sum);
    issues.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    return {
      gesamt,
      zugeordnet,
      offen: gesamt - zugeordnet,
      auftragSumme,
      auftragCount: auftraege.length,
      categories: sorted,
      issues
    };
  }

  // ---------- Aggregation "Stand heute" (Ist-Werte aus Kooperationen) ----------

  koopsByAuftrag() {
    const kampagneToAuftrag = new Map();
    this.kampagnen.forEach(k => kampagneToAuftrag.set(k.id, k.auftrag_id));

    const map = new Map(); // auftrag_id -> kooperationen[]
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

  aggregateIst() {
    const auftraege = this.filteredAuftraege();
    const koopMap = this.koopsByAuftrag();
    const videoMap = this.videosByKoop();

    const categories = new Map(); // key -> { key, label, vk, ek, koopIds:Set }
    const addToCategory = (key, label, vk, ek, koopId) => {
      if (!categories.has(key)) {
        categories.set(key, { key, label, vk: 0, ek: 0, koopIds: new Set() });
      }
      const cat = categories.get(key);
      cat.vk += vk;
      cat.ek += ek;
      if (koopId) cat.koopIds.add(koopId);
    };

    let vkGesamt = 0;
    let ekGesamt = 0;
    let feeBase = 0;    // Summe "Festgelegt" (percentage_fee_value)
    let feeMargin = 0;  // Summe EK/VK-Differenz (nur Zeilen mit EK und VK > 0)
    let kskGesamt = 0;
    let unassignedRows = 0;
    const istIssues = []; // Auftraege mit Fee-/Margen-Datenluecken (ohne Contracting)

    auftraege.forEach(a => {
      const details = this.detailsByAuftrag.get(a.id);
      const feeValue = parseFloat(details?.percentage_fee_value) || 0;
      const feeActive = !!(details?.agency_services_enabled && details?.percentage_fee_enabled);
      const auftragBaseFee = feeActive ? feeValue : 0;

      if (feeActive) feeBase += feeValue;
      if (details?.agency_services_enabled && details.ksk_enabled) {
        kskGesamt += parseFloat(details.ksk_value) || 0;
      }

      if (a.auftragtype === 'Contracting') {
        const netto = Number(a.nettobetrag) || 0;
        if (netto > 0) {
          vkGesamt += netto;
          addToCategory(CONTRACTING_KEY, 'Contracting', netto, 0, null);
        }
        return;
      }

      let auftragMargin = 0;
      let filledPairs = 0;
      let positions = 0;
      let negativePairs = 0;   // Positionen mit EK > VK
      let negativeSum = 0;     // Summe der Verluste aus diesen Positionen

      const koops = koopMap.get(a.id) || [];
      koops.forEach(koop => {
        const koopVideos = videoMap.get(koop.id) || [];

        // Gleiche Granularitaet wie collectEkVkPriceRows: Video-Ebene,
        // Kooperations-Fallback wenn keine Videos existieren.
        const rows = koopVideos.length > 0
          ? koopVideos.map(v => ({ ek: v.einkaufspreis_netto, vk: v.verkaufspreis_netto, art: v.kampagnenart }))
          : [{ ek: koop.einkaufspreis_netto, vk: koop.verkaufspreis_netto, art: null }];

        rows.forEach(row => {
          const ek = parseFloat(row.ek) || 0;
          const vk = parseFloat(row.vk) || 0;
          ekGesamt += ek;
          vkGesamt += vk;
          positions++;

          if (isFilledPrice(row.ek) && isFilledPrice(row.vk)) {
            feeMargin += vk - ek;
            auftragMargin += vk - ek;
            filledPairs++;
            if (vk < ek) {
              negativePairs++;
              negativeSum += vk - ek;
            }
          }

          const slug = getChipFromKampagnenartName(row.art);
          if (slug || row.art) {
            const key = slug || row.art;
            const label = row.art || this.campaignLabel(slug);
            addToCategory(key, label, vk, ek, koop.id);
          } else {
            unassignedRows++;
            addToCategory(UNASSIGNED_KEY, 'Ohne Zuordnung', vk, ek, koop.id);
          }
        });
      });

      // Issue-Typen fuer die Datenluecken-Tabelle ableiten
      const types = [];
      const feeDisabledButValue = !feeActive && feeValue > 0;
      if (feeDisabledButValue) types.push('fee_deaktiviert');
      if (!feeActive && !feeDisabledButValue && filledPairs === 0) types.push('fee_und_marge_fehlen');
      if (auftragMargin < 0) types.push('marge_negativ');
      if (negativePairs > 0) types.push('ek_groesser_vk');
      if (filledPairs > 0 && auftragMargin === 0 && auftragBaseFee <= 0) types.push('marge_null');
      if (filledPairs > 0 && filledPairs < positions) types.push('preise_unvollstaendig');

      if (types.length > 0) {
        istIssues.push({
          auftrag: a,
          types,
          baseFee: auftragBaseFee,
          feeValue,
          margin: auftragMargin,
          filledPairs,
          positions,
          negativePairs,
          negativeSum
        });
      }
    });

    // Schwere Faelle zuerst, innerhalb gleicher Schwere nach Nettobetrag absteigend
    const severity = (issue) => {
      if (issue.types.includes('fee_und_marge_fehlen') || issue.types.includes('marge_negativ') || issue.types.includes('ek_groesser_vk')) return 0;
      if (issue.types.includes('fee_deaktiviert') || issue.types.includes('marge_null')) return 1;
      return 2;
    };
    istIssues.sort((x, y) => {
      const s = severity(x) - severity(y);
      if (s !== 0) return s;
      return (Number(y.auftrag.nettobetrag) || 0) - (Number(x.auftrag.nettobetrag) || 0);
    });

    const sorted = Array.from(categories.values()).sort((a, b) => b.vk - a.vk);
    sorted.forEach(cat => {
      cat.db = cat.vk - cat.ek;
      cat.dbPct = cat.vk > 0 ? (cat.db / cat.vk) * 100 : 0;
    });

    const db = vkGesamt - ekGesamt;
    return {
      vk: vkGesamt,
      ek: ekGesamt,
      db,
      dbPct: vkGesamt > 0 ? (db / vkGesamt) * 100 : 0,
      feeBase,
      feeMargin,
      feeTotal: feeBase + feeMargin,
      ksk: kskGesamt,
      unassignedRows,
      istIssues,
      categories: sorted
    };
  }

  categoryColor(key, index) {
    if (key === CONTRACTING_KEY) return CHART_COLORS[CHART_COLORS.length - 1];
    if (key === UNASSIGNED_KEY) return '#94a3b8';
    return CHART_COLORS[index % (CHART_COLORS.length - 1)];
  }

  // ---------- Aggregation DB-Tabs (Monat x Leistungsbereich x Kunde) ----------

  // Flache Ist-Positionen: { month, unternehmenId, catKey, catLabel, vk, ek, passthrough }
  // Monat/Kunde kommen vom Auftrag, VK/EK von Videos (Fallback Kooperation).
  // Zusatzkosten der Kooperation (= Durchleitungs-Proxy, nicht in den Netto-Preisen
  // enthalten) werden als eigene Positionen mit passthrough=true angehaengt.
  collectDbRows() {
    const koopMap = this.koopsByAuftrag();
    const videoMap = this.videosByKoop();
    const current = this.currentMonth();
    const rows = [];

    this.auftraege.forEach(a => {
      const month = this.auftragMonth(a);
      if (!month || month > current) return; // Zukunft (Pipeline) nicht im Ist-Pivot

      if (a.auftragtype === 'Contracting') {
        const netto = Number(a.nettobetrag) || 0;
        if (netto > 0) {
          rows.push({
            month, unternehmenId: a.unternehmen_id || null,
            catKey: CONTRACTING_KEY, catLabel: 'Contracting',
            vk: netto, ek: 0, passthrough: false
          });
        }
        return;
      }

      const koops = koopMap.get(a.id) || [];
      koops.forEach(koop => {
        const koopVideos = videoMap.get(koop.id) || [];
        const priceRows = koopVideos.length > 0
          ? koopVideos.map(v => ({ ek: v.einkaufspreis_netto, vk: v.verkaufspreis_netto, art: v.kampagnenart }))
          : [{ ek: koop.einkaufspreis_netto, vk: koop.verkaufspreis_netto, art: null }];

        priceRows.forEach(row => {
          const ek = parseFloat(row.ek) || 0;
          const vk = parseFloat(row.vk) || 0;
          if (ek === 0 && vk === 0) return;

          const slug = getChipFromKampagnenartName(row.art);
          const catKey = slug || row.art || UNASSIGNED_KEY;
          const catLabel = row.art || (slug ? this.campaignLabel(slug) : 'Ohne Zuordnung');

          rows.push({
            month, unternehmenId: a.unternehmen_id || null,
            catKey, catLabel, vk, ek, passthrough: false
          });
        });

        // Durchleitungs-Proxy: Zusatzkosten (aus Rechnungen gesynct)
        const ptEk = parseFloat(koop.einkaufspreis_zusatzkosten) || 0;
        const ptVk = parseFloat(koop.verkaufspreis_zusatzkosten) || 0;
        if (ptEk !== 0 || ptVk !== 0) {
          rows.push({
            month, unternehmenId: a.unternehmen_id || null,
            catKey: PASSTHROUGH_KEY, catLabel: 'Durchleitung (Zusatzkosten)',
            vk: ptVk, ek: ptEk, passthrough: true
          });
        }
      });
    });

    return rows;
  }

  // Pivot: groupBy 'category' | 'customer'
  // Ergebnis: { months, rows: [{ key, label, cells: Map(month -> {vk,ek}), total: {vk,ek},
  //             children: [...] (nur customer, je Leistungsbereich) }], totals }
  aggregateDbPivot(groupBy) {
    const months = this.monthRange();
    const monthSet = new Set(months);
    const allRows = this.collectDbRows().filter(r => monthSet.has(r.month));
    const rows = this.includePassthrough ? allRows : allRows.filter(r => !r.passthrough);

    const emptyCell = () => ({ vk: 0, ek: 0 });
    const groups = new Map();

    const groupInfo = (r) => {
      if (groupBy === 'customer') {
        const key = r.unternehmenId || NO_CUSTOMER_KEY;
        return { key, label: this.customerName(r.unternehmenId) };
      }
      return { key: r.catKey, label: r.catLabel };
    };

    rows.forEach(r => {
      const { key, label } = groupInfo(r);
      if (!groups.has(key)) {
        groups.set(key, { key, label, cells: new Map(), total: emptyCell(), children: new Map() });
      }
      const g = groups.get(key);
      if (!g.cells.has(r.month)) g.cells.set(r.month, emptyCell());
      const cell = g.cells.get(r.month);
      cell.vk += r.vk;
      cell.ek += r.ek;
      g.total.vk += r.vk;
      g.total.ek += r.ek;

      // Drilldown Kunde -> Leistungsbereich
      if (groupBy === 'customer') {
        if (!g.children.has(r.catKey)) {
          g.children.set(r.catKey, { key: r.catKey, label: r.catLabel, cells: new Map(), total: emptyCell() });
        }
        const c = g.children.get(r.catKey);
        if (!c.cells.has(r.month)) c.cells.set(r.month, emptyCell());
        const ccell = c.cells.get(r.month);
        ccell.vk += r.vk;
        ccell.ek += r.ek;
        c.total.vk += r.vk;
        c.total.ek += r.ek;
      }
    });

    const sortedRows = Array.from(groups.values()).sort((a, b) => b.total.vk - a.total.vk);
    sortedRows.forEach(g => {
      g.children = Array.from(g.children.values()).sort((a, b) => b.total.vk - a.total.vk);
    });

    const totals = { total: { vk: 0, ek: 0 }, byMonth: new Map() };
    sortedRows.forEach(g => {
      totals.total.vk += g.total.vk;
      totals.total.ek += g.total.ek;
      g.cells.forEach((cell, month) => {
        if (!totals.byMonth.has(month)) totals.byMonth.set(month, emptyCell());
        const t = totals.byMonth.get(month);
        t.vk += cell.vk;
        t.ek += cell.ek;
      });
    });

    return { months, rows: sortedRows, totals };
  }

  // Pipeline 2026: gebuchte Auftraege mit Start in 2026, Plan-Umsatz nach Kampagnenart
  aggregatePipeline2026() {
    const blockMap = this.blocksByAuftrag();
    const categories = new Map();
    let gesamt = 0;
    let count = 0;

    this.auftraege.forEach(a => {
      if (this.auftragYear(a) !== 2026) return;
      const netto = Number(a.nettobetrag) || 0;
      if (netto <= 0) return;
      gesamt += netto;
      count++;

      const add = (key, label, sum) => {
        if (!categories.has(key)) categories.set(key, { key, label, sum: 0 });
        categories.get(key).sum += sum;
      };

      if (a.auftragtype === 'Contracting') {
        add(CONTRACTING_KEY, 'Contracting', netto);
        return;
      }

      const blocks = blockMap.get(a.id) || [];
      let blockSum = 0;
      blocks.forEach(b => {
        const umsatz = b.umsatz_netto == null ? null : Number(b.umsatz_netto);
        if (umsatz == null) return;
        blockSum += umsatz;
        add(b.campaign_type, b.campaign_type_label || this.campaignLabel(b.campaign_type), umsatz);
      });

      const rest = netto - blockSum;
      if (rest > DIFF_TOLERANCE) add(UNASSIGNED_KEY, 'Ohne Zuordnung', rest);
    });

    return {
      gesamt,
      count,
      categories: Array.from(categories.values()).sort((a, b) => b.sum - a.sum)
    };
  }

  metricValue(cell) {
    if (!cell) return null;
    switch (this.dbMetric) {
      case 'vk': return cell.vk;
      case 'ek': return cell.ek;
      case 'dbpct': return cell.vk > 0 ? ((cell.vk - cell.ek) / cell.vk) * 100 : null;
      default: return cell.vk - cell.ek;
    }
  }

  fmtMetric(value) {
    if (value == null) return '–';
    return this.dbMetric === 'dbpct' ? this.fmtPct(value) : this.fmtEuro(value);
  }

  // ---------- Rendering ----------

  render() {
    const years = this.availableYears();

    const tabs = [
      { tab: 'plan', label: 'Plan' },
      { tab: 'ist', label: 'Stand heute' },
      { tab: 'db-lb', label: 'DB Leistungsbereich' },
      { tab: 'db-kunde', label: 'DB Kunde' }
    ];

    const tabButtons = tabs.map(t => `
      <button type="button" class="tab-button${this.activeTab === t.tab ? ' active' : ''}"
              data-tab="${t.tab}" role="tab" aria-selected="${this.activeTab === t.tab}">${t.label}</button>
    `).join('');

    let view;
    switch (this.activeTab) {
      case 'ist': view = this.renderIstView(); break;
      case 'db-lb': view = this.renderDbLbView(); break;
      case 'db-kunde': view = this.renderDbKundeView(); break;
      default: view = this.renderPlanView();
    }

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

        <div class="tab-navigation" role="tablist">
          ${tabButtons}
        </div>

        ${view}
      </div>
    `;

    window.setContentSafely(window.content, html);
    this.bindEvents();
  }

  // ---------- Rendering DB-Tabs ----------

  renderDbToolbar() {
    const metrics = [
      { key: 'vk', label: 'Umsatz (VK)' },
      { key: 'ek', label: 'Cost-of-Sales (EK)' },
      { key: 'db', label: 'DB' },
      { key: 'dbpct', label: 'DB %' }
    ];
    return `
      <div class="stakeholder-db-toolbar">
        <div class="stakeholder-metric-toggle" role="group" aria-label="Kennzahl">
          ${metrics.map(m => `
            <button type="button" class="secondary-btn${this.dbMetric === m.key ? ' active' : ''}"
                    data-action="set-metric" data-metric="${m.key}">${m.label}</button>
          `).join('')}
        </div>
        <label class="stakeholder-passthrough-toggle">
          <input type="checkbox" id="stakeholder-passthrough-toggle"${this.includePassthrough ? ' checked' : ''}>
          Durchgeleitete Umsätze einbeziehen
        </label>
      </div>
    `;
  }

  renderPassthroughHint() {
    return `
      <div class="stakeholder-issues">
        <h3 class="stakeholder-card-title">Hinweis: Durchgeleitete Umsätze</h3>
        <p class="stakeholder-issues-hint">
          Durchgeleitete Umsätze (z.&nbsp;B. übernommener Muster-Versand wie im Fall Ninja/LikeGroup)
          verfälschen die Rohmarge und verzerren die relative Abhängigkeit von einzelnen Kunden.
          Sie sind hier standardmäßig ausgeblendet, damit DB und DB&nbsp;% die bereinigte Marge zeigen.
          Aktuelle Näherung: Zusatzkosten aus Rechnungen (durchlaufende Posten, EK-&nbsp;und VK-seitig
          an den Kooperationen gesynct). Ein explizites Durchleitungs-Flag pro Position folgt später.
        </p>
      </div>
    `;
  }

  renderDbPivotTable(pivot, { firstColLabel, expandable = false } = {}) {
    if (!pivot.rows.length) {
      return '<div class="stakeholder-empty">Keine Ist-Daten im gewählten Zeitraum.</div>';
    }

    const headCells = pivot.months.map(m => `<th class="stakeholder-num">${this.monthLabel(m)}</th>`).join('');

    const renderCells = (entry) => pivot.months.map(m => {
      const value = this.metricValue(entry.cells.get(m) || null);
      const negClass = value != null && value < 0 ? ' stakeholder-num--neg' : '';
      return `<td class="stakeholder-num${negClass}">${this.fmtMetric(value)}</td>`;
    }).join('');

    const renderTotalCell = (entry) => {
      const value = this.metricValue(entry.total);
      const negClass = value != null && value < 0 ? ' stakeholder-num--neg' : '';
      return `<td class="stakeholder-num stakeholder-num--total${negClass}">${this.fmtMetric(value)}</td>`;
    };

    const bodyRows = pivot.rows.map(row => {
      const expanded = expandable && this.expandedCustomers.has(row.key);
      const toggle = expandable
        ? `<button type="button" class="stakeholder-expand-btn" data-action="toggle-customer"
                   data-customer-key="${this.escape(row.key)}" aria-expanded="${expanded}"
                   title="${expanded ? 'Leistungsbereiche einklappen' : 'Nach Leistungsbereich aufschlüsseln'}">${expanded ? '−' : '+'}</button>`
        : '';

      const mainRow = `
        <tr${expandable ? ' class="stakeholder-row--expandable"' : ''}>
          <td class="stakeholder-row-label">${toggle}${this.escape(row.label)}</td>
          ${renderCells(row)}
          ${renderTotalCell(row)}
        </tr>
      `;

      if (!expanded || !row.children?.length) return mainRow;

      const childRows = row.children.map(child => `
        <tr class="stakeholder-row--child">
          <td class="stakeholder-row-label stakeholder-row-label--child">${this.escape(child.label)}</td>
          ${renderCells(child)}
          ${renderTotalCell(child)}
        </tr>
      `).join('');

      return mainRow + childRows;
    }).join('');

    const totalsEntry = { cells: pivot.totals.byMonth, total: pivot.totals.total };
    const footRow = `
      <tr class="stakeholder-row--total">
        <td class="stakeholder-row-label">Gesamt</td>
        ${renderCells(totalsEntry)}
        ${renderTotalCell(totalsEntry)}
      </tr>
    `;

    return `
      <div class="stakeholder-pivot-scroll">
        <table class="stakeholder-table stakeholder-table--pivot">
          <thead>
            <tr>
              <th>${this.escape(firstColLabel)}</th>
              ${headCells}
              <th class="stakeholder-num stakeholder-num--total">Gesamt</th>
            </tr>
          </thead>
          <tbody>${bodyRows}${footRow}</tbody>
        </table>
      </div>
    `;
  }

  renderDbSummaryCards(pivot) {
    const t = pivot.totals.total;
    const db = t.vk - t.ek;
    const dbPct = t.vk > 0 ? (db / t.vk) * 100 : 0;
    const dbClass = db < 0 ? ' stakeholder-summary-value--warn' : '';
    return `
      <div class="stakeholder-summary-grid">
        <div class="stakeholder-summary-card">
          <span class="stakeholder-summary-label">Umsatz (VK, netto)</span>
          <span class="stakeholder-summary-value">${this.fmtEuro(t.vk)}</span>
        </div>
        <div class="stakeholder-summary-card">
          <span class="stakeholder-summary-label">Cost-of-Sales (EK, netto)</span>
          <span class="stakeholder-summary-value">${this.fmtEuro(t.ek)}</span>
        </div>
        <div class="stakeholder-summary-card">
          <span class="stakeholder-summary-label">Deckungsbeitrag</span>
          <span class="stakeholder-summary-value${dbClass}">${this.fmtEuro(db)}</span>
          <span class="stakeholder-summary-sub">DB %: ${this.fmtPct(dbPct)}</span>
        </div>
        <div class="stakeholder-summary-card">
          <span class="stakeholder-summary-label">Durchleitung</span>
          <span class="stakeholder-summary-value">${this.includePassthrough ? 'einbezogen' : 'ausgeblendet'}</span>
          <span class="stakeholder-summary-sub">Proxy: Zusatzkosten aus Rechnungen</span>
        </div>
      </div>
    `;
  }

  renderPipeline2026() {
    const pipeline = this.aggregatePipeline2026();
    if (pipeline.count === 0) {
      return `
        <div class="stakeholder-issues">
          <h3 class="stakeholder-card-title">Pipeline 2026 (Plan)</h3>
          <div class="stakeholder-empty">Keine gebuchten Aufträge mit Start in 2026.</div>
        </div>
      `;
    }

    const rows = pipeline.categories.map((cat, i) => {
      const pct = pipeline.gesamt > 0 ? (cat.sum / pipeline.gesamt) * 100 : 0;
      return `
        <tr>
          <td>
            <span class="stakeholder-color-dot" style="background:${this.categoryColor(cat.key, i)}"></span>
            ${this.escape(cat.label)}
          </td>
          <td class="stakeholder-num">${this.fmtEuro(cat.sum)}</td>
          <td class="stakeholder-num">${this.fmtPct(pct)}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="stakeholder-issues">
        <h3 class="stakeholder-card-title">Pipeline 2026 (Plan)</h3>
        <p class="stakeholder-issues-hint">
          Gebuchte Aufträge mit Start in 2026 nach Leistungsbereich (Plan-Umsatz, kein Sales-Forecast) –
          ${pipeline.count} ${pipeline.count === 1 ? 'Auftrag' : 'Aufträge'}, gesamt ${this.fmtEuro(pipeline.gesamt)}.
        </p>
        <table class="stakeholder-table">
          <thead>
            <tr>
              <th>Leistungsbereich</th>
              <th class="stakeholder-num">Umsatz (Plan)</th>
              <th class="stakeholder-num">Anteil</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  renderDbLbView() {
    const pivot = this.aggregateDbPivot('category');
    return `
      ${this.renderDbToolbar()}
      ${this.renderDbSummaryCards(pivot)}

      <div class="stakeholder-table-card">
        <h3 class="stakeholder-card-title">Monatswerte nach Leistungsbereich</h3>
        <p class="stakeholder-issues-hint">
          Leistungsbereiche = Kampagnenarten. Monat = Auftragsstart (Fallback Erstellungsdatum).
          Ist-Werte aus Kooperationen/Videos; Auswertung ab Januar 2025 – Monate vor der ersten
          CRM-Auftragshistorie bleiben leer.
        </p>
        ${this.renderDbPivotTable(pivot, { firstColLabel: 'Leistungsbereich' })}
      </div>

      ${this.renderPipeline2026()}
      ${this.renderPassthroughHint()}
    `;
  }

  renderCustomerConcentration(pivot) {
    const t = pivot.totals.total;
    if (t.vk <= 0 || !pivot.rows.length) return '';
    const top = pivot.rows[0];
    const top3 = pivot.rows.slice(0, 3).reduce((s, r) => s + r.total.vk, 0);
    const topPct = (top.total.vk / t.vk) * 100;
    const top3Pct = (top3 / t.vk) * 100;
    return `
      <p class="stakeholder-issues-hint">
        Kundenkonzentration: ${this.escape(top.label)} = ${this.fmtPct(topPct)} des Umsatzes,
        Top&nbsp;3 gemeinsam ${this.fmtPct(top3Pct)}.
        ${this.includePassthrough ? 'Durchgeleitete Umsätze sind einbezogen und können die Abhängigkeit überzeichnen.' : 'Durchgeleitete Umsätze sind ausgeblendet (bereinigte Sicht).'}
      </p>
    `;
  }

  renderDbKundeView() {
    const pivot = this.aggregateDbPivot('customer');
    return `
      ${this.renderDbToolbar()}
      ${this.renderDbSummaryCards(pivot)}

      <div class="stakeholder-table-card">
        <h3 class="stakeholder-card-title">Monatswerte nach Kunde</h3>
        <p class="stakeholder-issues-hint">
          Kunde = Unternehmen des Auftrags. Über „+" lässt sich jeder Kunde nach
          Leistungsbereich aufschlüsseln. Monat = Auftragsstart (Fallback Erstellungsdatum).
        </p>
        ${this.renderCustomerConcentration(pivot)}
        ${this.renderDbPivotTable(pivot, { firstColLabel: 'Kunde', expandable: true })}
      </div>

      ${this.renderPassthroughHint()}
    `;
  }

  renderPlanView() {
    const agg = this.aggregate();
    return `
      ${this.renderSummaryCards(agg)}

      <div class="stakeholder-main-grid">
        <div class="stakeholder-table-card">
          <h3 class="stakeholder-card-title">Umsatz nach Kampagnenart</h3>
          ${this.renderCategoryTable(agg)}
        </div>
        <div class="stakeholder-chart-card">
          <h3 class="stakeholder-card-title">Verteilung</h3>
          ${this.renderDonut(agg)}
        </div>
      </div>

      ${this.renderIssues(agg)}
    `;
  }

  renderIstView() {
    const agg = this.aggregateIst();

    const donutAgg = {
      categories: agg.categories.map(c => ({ key: c.key, label: c.label, sum: c.vk })),
      gesamt: agg.vk
    };

    const hint = agg.unassignedRows > 0
      ? `<p class="stakeholder-issues-hint">
           ${agg.unassignedRows} ${agg.unassignedRows === 1 ? 'Position' : 'Positionen'} ohne Kampagnenart-Zuordnung
           (Videos ohne Kampagnenart bzw. Kooperationen ohne Videos) – in der Kategorie „Ohne Zuordnung" enthalten.
         </p>`
      : '';

    return `
      ${this.renderIstSummaryCards(agg)}

      <div class="stakeholder-main-grid">
        <div class="stakeholder-table-card">
          <h3 class="stakeholder-card-title">Stand heute nach Kampagnenart</h3>
          ${this.renderIstCategoryTable(agg)}
          ${hint}
        </div>
        <div class="stakeholder-chart-card">
          <h3 class="stakeholder-card-title">Verteilung (Umsatz)</h3>
          ${this.renderDonut(donutAgg, 'Umsatz')}
        </div>
      </div>

      ${this.renderIstIssues(agg)}
    `;
  }

  renderNoFeeHint(istIssues) {
    const critical = (istIssues || []).filter(i =>
      i.types.includes('fee_und_marge_fehlen') || i.types.includes('fee_deaktiviert')
    );
    if (!critical.length) return '';

    const label = critical.length === 1 ? 'Auftrag' : 'Aufträge';
    return `<span class="stakeholder-summary-sub stakeholder-summary-sub--warn">
      ${critical.length} ${label} mit fehlender/deaktivierter Fee – siehe Datenlücken unten
    </span>`;
  }

  istIssueBadges(issue) {
    const badges = [];
    if (issue.types.includes('fee_und_marge_fehlen')) {
      badges.push('<span class="stakeholder-badge stakeholder-badge--error">Fee &amp; Marge fehlen</span>');
    }
    if (issue.types.includes('marge_negativ')) {
      badges.push('<span class="stakeholder-badge stakeholder-badge--error">Marge negativ</span>');
    }
    if (issue.types.includes('ek_groesser_vk')) {
      badges.push('<span class="stakeholder-badge stakeholder-badge--error">EK &gt; VK</span>');
    }
    if (issue.types.includes('fee_deaktiviert')) {
      badges.push('<span class="stakeholder-badge stakeholder-badge--warn">Fee deaktiviert</span>');
    }
    if (issue.types.includes('marge_null')) {
      badges.push('<span class="stakeholder-badge stakeholder-badge--warn">Marge 0 €</span>');
    }
    if (issue.types.includes('preise_unvollstaendig')) {
      badges.push('<span class="stakeholder-badge stakeholder-badge--warn">Preise unvollständig</span>');
    }
    return badges.join('');
  }

  renderIstIssues(agg) {
    const issues = agg.istIssues || [];

    if (!issues.length) {
      return `
        <div class="stakeholder-issues">
          <h3 class="stakeholder-card-title">Datenlücken Agentur-Fee &amp; Marge</h3>
          <div class="stakeholder-empty stakeholder-empty--ok">Alle Aufträge haben eine Agentur-Fee oder
            eine gepflegte EK/VK-Marge. Keine offenen Datenlücken im gewählten Zeitraum.</div>
        </div>
      `;
    }

    const rows = issues.map(issue => {
      const a = issue.auftrag;

      let feeCell = '–';
      if (issue.baseFee > 0) {
        feeCell = this.fmtEuro(issue.baseFee);
      } else if (issue.types.includes('fee_deaktiviert')) {
        feeCell = `${this.fmtEuro(issue.feeValue)} <span class="stakeholder-badge stakeholder-badge--warn">deaktiviert</span>`;
      }

      const marginClass = issue.margin < 0 ? ' stakeholder-num--neg' : '';

      const negCell = issue.negativePairs > 0
        ? `<span class="stakeholder-num--neg">${issue.negativePairs} Pos. (${this.fmtEuro(issue.negativeSum)})</span>`
        : '–';

      return `
        <tr>
          <td>
            <a href="/auftrag/${this.escape(a.id)}" class="stakeholder-issue-title"
               onclick="event.preventDefault(); window.navigateTo('/auftrag/${this.escape(a.id)}')">${this.escape(this.auftragName(a))}</a>
          </td>
          <td class="stakeholder-num">${this.fmtEuro(a.nettobetrag)}</td>
          <td class="stakeholder-num">${feeCell}</td>
          <td class="stakeholder-num${marginClass}">${this.fmtEuro(issue.margin)}</td>
          <td class="stakeholder-num">${negCell}</td>
          <td class="stakeholder-num">${issue.filledPairs}/${issue.positions}</td>
          <td><div class="stakeholder-issue-badges stakeholder-issue-badges--table">${this.istIssueBadges(issue)}</div></td>
          <td>
            <button type="button" class="secondary-btn"
                    data-action="edit-auftrag" data-auftrag-id="${this.escape(a.id)}">Im Wizard bearbeiten</button>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="stakeholder-issues">
        <h3 class="stakeholder-card-title">Datenlücken Agentur-Fee &amp; Marge (${issues.length} ${issues.length === 1 ? 'Auftrag' : 'Aufträge'})</h3>
        <p class="stakeholder-issues-hint">
          Aufträge ohne aktive Agentur-Fee und ohne EK/VK-Marge, mit hinterlegter aber deaktivierter Fee,
          negativer Marge, Positionen mit EK &gt; VK oder unvollständig gepflegten Preisen.
          Contracting-Aufträge sind ausgenommen.
          „EK &gt; VK" = einzelne Positionen, bei denen der Einkaufspreis über dem Verkaufspreis liegt.
          „Positionen" = Preispaare mit EK und VK &gt; 0 im Verhältnis zu allen Positionen.
        </p>
        <div class="stakeholder-ist-issues-scroll">
          <table class="stakeholder-table">
            <thead>
              <tr>
                <th>Auftrag</th>
                <th class="stakeholder-num">Netto</th>
                <th class="stakeholder-num">Fee festgelegt</th>
                <th class="stakeholder-num">EK/VK-Marge</th>
                <th class="stakeholder-num">EK &gt; VK</th>
                <th class="stakeholder-num">Positionen</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderIstSummaryCards(agg) {
    return `
      <div class="stakeholder-summary-grid">
        <div class="stakeholder-summary-card">
          <span class="stakeholder-summary-label">Umsatz (VK, netto)</span>
          <span class="stakeholder-summary-value">${this.fmtEuro(agg.vk)}</span>
        </div>
        <div class="stakeholder-summary-card">
          <span class="stakeholder-summary-label">Fremdkosten (EK, netto)</span>
          <span class="stakeholder-summary-value">${this.fmtEuro(agg.ek)}</span>
          <span class="stakeholder-summary-sub">Verbrauchtes Creatorbudget</span>
        </div>
        <div class="stakeholder-summary-card">
          <span class="stakeholder-summary-label">Agentur Fee gesamt</span>
          <span class="stakeholder-summary-value">${this.fmtEuro(agg.feeTotal)}</span>
          <span class="stakeholder-summary-sub">Festgelegt: ${this.fmtEuro(agg.feeBase)} · EK/VK-Differenz: ${this.fmtEuro(agg.feeMargin)}</span>
          ${this.renderNoFeeHint(agg.istIssues)}
        </div>
        <div class="stakeholder-summary-card">
          <span class="stakeholder-summary-label">KSK gesamt</span>
          <span class="stakeholder-summary-value">${this.fmtEuro(agg.ksk)}</span>
        </div>
      </div>
    `;
  }

  renderIstCategoryTable(agg) {
    if (!agg.categories.length) {
      return '<div class="stakeholder-empty">Keine Kooperationen mit Preisen im gewählten Zeitraum.</div>';
    }

    const rows = agg.categories.map((cat, i) => `
      <tr>
        <td>
          <span class="stakeholder-color-dot" style="background:${this.categoryColor(cat.key, i)}"></span>
          ${this.escape(cat.label)}
        </td>
        <td class="stakeholder-num">${this.fmtEuro(cat.vk)}</td>
        <td class="stakeholder-num">${this.fmtEuro(cat.ek)}</td>
        <td class="stakeholder-num">${this.fmtEuro(cat.db)}</td>
        <td class="stakeholder-num">${this.fmtPct(cat.dbPct)}</td>
        <td class="stakeholder-num">${cat.koopIds.size}</td>
      </tr>
    `).join('');

    return `
      <table class="stakeholder-table">
        <thead>
          <tr>
            <th>Kampagnenart</th>
            <th class="stakeholder-num">Umsatz (VK)</th>
            <th class="stakeholder-num">Fremdkosten (EK)</th>
            <th class="stakeholder-num">DB</th>
            <th class="stakeholder-num">DB %</th>
            <th class="stakeholder-num">Kooperationen</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  renderSummaryCards(agg) {
    const offenClass = agg.offen > DIFF_TOLERANCE ? ' stakeholder-summary-value--warn' : '';
    return `
      <div class="stakeholder-summary-grid">
        <div class="stakeholder-summary-card">
          <span class="stakeholder-summary-label">Gesamtumsatz (netto)</span>
          <span class="stakeholder-summary-value">${this.fmtEuro(agg.gesamt)}</span>
        </div>
        <div class="stakeholder-summary-card">
          <span class="stakeholder-summary-label">Kampagnenarten zugeordnet</span>
          <span class="stakeholder-summary-value">${this.fmtEuro(agg.zugeordnet)}</span>
        </div>
        <div class="stakeholder-summary-card">
          <span class="stakeholder-summary-label">Nicht zugeordnet</span>
          <span class="stakeholder-summary-value${offenClass}">${this.fmtEuro(agg.offen)}</span>
        </div>
        <div class="stakeholder-summary-card">
          <span class="stakeholder-summary-label">Summe aller Aufträge (netto)</span>
          <span class="stakeholder-summary-value">${this.fmtEuro(agg.auftragSumme)}</span>
          <span class="stakeholder-summary-sub">${agg.auftragCount} ${agg.auftragCount === 1 ? 'Auftrag' : 'Aufträge'}</span>
        </div>
      </div>
    `;
  }

  renderCategoryTable(agg) {
    if (!agg.categories.length) {
      return '<div class="stakeholder-empty">Keine zugeordneten Umsätze im gewählten Zeitraum.</div>';
    }

    const rows = agg.categories.map((cat, i) => {
      const pct = agg.gesamt > 0 ? (cat.sum / agg.gesamt) * 100 : 0;
      return `
        <tr>
          <td>
            <span class="stakeholder-color-dot" style="background:${this.categoryColor(cat.key, i)}"></span>
            ${this.escape(cat.label)}
          </td>
          <td class="stakeholder-num">${this.fmtEuro(cat.sum)}</td>
          <td class="stakeholder-num">${this.fmtPct(pct)}</td>
          <td class="stakeholder-num">${cat.auftragIds.size}</td>
        </tr>
      `;
    }).join('');

    return `
      <table class="stakeholder-table">
        <thead>
          <tr>
            <th>Kampagnenart</th>
            <th class="stakeholder-num">Umsatz</th>
            <th class="stakeholder-num">Anteil</th>
            <th class="stakeholder-num">Aufträge</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  renderDonut(agg, centerLabel = 'zugeordnet') {
    const total = agg.categories.reduce((s, c) => s + c.sum, 0);
    if (total <= 0) {
      return '<div class="stakeholder-empty">Keine Daten für das Diagramm.</div>';
    }

    const cx = 100, cy = 100, r = 80, strokeWidth = 34;
    const circumference = 2 * Math.PI * r;
    let offset = 0;

    const segments = agg.categories.map((cat, i) => {
      const fraction = cat.sum / total;
      const dash = fraction * circumference;
      const color = this.categoryColor(cat.key, i);
      const pct = agg.gesamt > 0 ? (cat.sum / agg.gesamt) * 100 : 0;
      const seg = `
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
                stroke="${color}" stroke-width="${strokeWidth}"
                stroke-dasharray="${dash} ${circumference - dash}"
                stroke-dashoffset="${-offset}"
                transform="rotate(-90 ${cx} ${cy})">
          <title>${this.escape(cat.label)}: ${this.fmtEuro(cat.sum)} (${this.fmtPct(pct)})</title>
        </circle>
      `;
      offset += dash;
      return seg;
    }).join('');

    const legend = agg.categories.map((cat, i) => {
      const pct = agg.gesamt > 0 ? (cat.sum / agg.gesamt) * 100 : 0;
      return `
        <div class="stakeholder-legend-item">
          <span class="stakeholder-color-dot" style="background:${this.categoryColor(cat.key, i)}"></span>
          <span class="stakeholder-legend-label">${this.escape(cat.label)}</span>
          <span class="stakeholder-legend-value">${this.fmtPct(pct)}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="stakeholder-donut-wrap">
        <svg viewBox="0 0 200 200" class="stakeholder-donut" role="img" aria-label="Umsatzverteilung nach Kampagnenart">
          ${segments}
          <text x="${cx}" y="${cy - 6}" text-anchor="middle" class="stakeholder-donut-center-value">${this.fmtEuro(total)}</text>
          <text x="${cx}" y="${cy + 14}" text-anchor="middle" class="stakeholder-donut-center-label">${this.escape(centerLabel)}</text>
        </svg>
        <div class="stakeholder-legend">${legend}</div>
      </div>
    `;
  }

  renderIssues(agg) {
    if (!agg.issues.length) {
      return `
        <div class="stakeholder-issues">
          <h3 class="stakeholder-card-title">Datenlücken</h3>
          <div class="stakeholder-empty stakeholder-empty--ok">Alle Aufträge sind sauber zugeordnet. 
            Keine offenen Datenlücken im gewählten Zeitraum.</div>
        </div>
      `;
    }

    const cards = agg.issues.map(issue => {
      const a = issue.auftrag;
      const badges = [];
      if (issue.types.includes('keine_art')) badges.push('<span class="stakeholder-badge stakeholder-badge--error">Keine Kampagnenart</span>');
      if (issue.types.includes('betrag_fehlt')) badges.push('<span class="stakeholder-badge stakeholder-badge--warn">Betrag fehlt</span>');
      if (issue.types.includes('differenz')) {
        badges.push(`<span class="stakeholder-badge stakeholder-badge--warn">Differenz ${this.fmtEuro(issue.diff)}</span>`);
      }

      const blockRows = issue.blocks.map(b => `
        <div class="stakeholder-block-row">
          <span class="stakeholder-block-label">${this.escape(b.campaign_type_label || this.campaignLabel(b.campaign_type))}</span>
          <span class="stakeholder-block-value">${b.umsatz_netto != null ? this.fmtEuro(b.umsatz_netto) : '– kein Umsatz hinterlegt –'}</span>
        </div>
      `).join('');

      return `
        <div class="stakeholder-issue-card">
          <div class="stakeholder-issue-header">
            <a href="/auftrag/${this.escape(a.id)}" class="stakeholder-issue-title"
               onclick="event.preventDefault(); window.navigateTo('/auftrag/${this.escape(a.id)}')">${this.escape(this.auftragName(a))}</a>
            <span class="stakeholder-issue-netto">Nettobetrag: ${this.fmtEuro(a.nettobetrag)}</span>
            <div class="stakeholder-issue-badges">${badges.join('')}</div>
            <button type="button" class="secondary-btn"
                    data-action="edit-auftrag" data-auftrag-id="${this.escape(a.id)}">Im Wizard bearbeiten</button>
          </div>
          ${blockRows ? `<div class="stakeholder-issue-blocks">${blockRows}</div>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="stakeholder-issues">
        <h3 class="stakeholder-card-title">Datenlücken (${agg.issues.length} ${agg.issues.length === 1 ? 'Auftrag' : 'Aufträge'})</h3>
        <p class="stakeholder-issues-hint">
          Aufträge ohne Kampagnenart, mit fehlenden Umsatz-Beträgen oder mit Differenz zwischen
          Kampagnenart-Umsätzen und Auftrags-Nettobetrag. Die Pflege erfolgt über
          „Im Wizard bearbeiten" im Schritt Kampagnenarten.
        </p>
        <div class="stakeholder-issue-list">${cards}</div>
      </div>
    `;
  }

  // ---------- Events ----------

  bindEvents() {
    document.getElementById('stakeholder-year-select')?.addEventListener('change', (e) => {
      this.selectedYear = e.target.value;
      this.render();
    });

    document.querySelectorAll('.stakeholder-page .tab-navigation .tab-button').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.tab === this.activeTab) return;
        this.activeTab = btn.dataset.tab;
        this.render();
      });
    });

    // DB-Tabs: Kennzahl umschalten
    document.querySelectorAll('[data-action="set-metric"]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.metric === this.dbMetric) return;
        this.dbMetric = btn.dataset.metric;
        this.render();
      });
    });

    // DB-Tabs: Durchleitung einbeziehen/ausblenden
    document.getElementById('stakeholder-passthrough-toggle')?.addEventListener('change', (e) => {
      this.includePassthrough = e.target.checked;
      this.render();
    });

    // DB Kunde: Drilldown nach Leistungsbereich
    document.querySelectorAll('[data-action="toggle-customer"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.customerKey;
        if (this.expandedCustomers.has(key)) {
          this.expandedCustomers.delete(key);
        } else {
          this.expandedCustomers.add(key);
        }
        this.render();
      });
    });

    // Datenluecken: direkt in den Wizard-Step "Kampagnenarten" springen
    document.querySelectorAll('[data-action="edit-auftrag"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const auftragId = btn.dataset.auftragId;
        if (auftragId) window.navigateTo(`/projekt-erstellen/edit/${auftragId}?step=kampagnen`);
      });
    });
  }

  destroy() {
    // Kein globaler State/Listener ausserhalb von window.content
  }
}

export const stakeholderOverviewPage = new StakeholderOverviewPage();
