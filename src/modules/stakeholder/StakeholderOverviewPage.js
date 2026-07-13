// StakeholderOverviewPage.js
// Stakeholder-Umsatzuebersicht: Verteilung des Auftrags-Nettoumsatzes auf
// Kampagnenarten (auftrag_kampagnenart_blocks.umsatz_netto) inkl. Donut-Chart,
// Jahres-Filter und Datenluecken-Liste (read-only, Pflege ueber den
// Projekt-Bearbeiten-Wizard).
// Erreichbar unter /stakeholder (kein Nav-Eintrag, Deep-Link only, Admin-only).

import { CAMPAIGN_TYPES } from '../projekt-erstellen/constants.js';

const SUPABASE = () => window.supabase;

// Feste Farbpalette fuer die Kampagnenarten (Reihenfolge = CAMPAIGN_TYPES + Contracting)
const CHART_COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#ca8a04',
  '#16a34a', '#0d9488', '#0284c7', '#dc2626', '#9333ea',
  '#65a30d', '#475569'
];

const CONTRACTING_KEY = '__contracting__';
const DIFF_TOLERANCE = 1; // Euro

export class StakeholderOverviewPage {
  constructor() {
    this.auftraege = [];
    this.blocks = [];
    this.selectedYear = 'all';
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

    const [auftragRes, blocksRes] = await Promise.all([
      supabase
        .from('auftrag')
        .select('id, titel, auftragsname, nettobetrag, auftragtype, start, created_at, is_draft'),
      supabase
        .from('auftrag_kampagnenart_blocks')
        .select('id, auftrag_id, campaign_type, campaign_type_label, umsatz_netto, sort_order')
    ]);

    if (auftragRes.error) throw auftragRes.error;
    if (blocksRes.error) throw blocksRes.error;

    this.auftraege = (auftragRes.data || []).filter(a => a.is_draft !== true);
    this.blocks = blocksRes.data || [];
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
    const issues = []; // { auftrag, blocks, types: [...], diff }

    auftraege.forEach(a => {
      const netto = Number(a.nettobetrag) || 0;
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

    return { gesamt, zugeordnet, offen: gesamt - zugeordnet, categories: sorted, issues };
  }

  categoryColor(key, index) {
    if (key === CONTRACTING_KEY) return CHART_COLORS[CHART_COLORS.length - 1];
    return CHART_COLORS[index % (CHART_COLORS.length - 1)];
  }

  // ---------- Rendering ----------

  render() {
    const agg = this.aggregate();
    const years = this.availableYears();

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
      </div>
    `;

    window.setContentSafely(window.content, html);
    this.bindEvents();
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

  renderDonut(agg) {
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
          <text x="${cx}" y="${cy + 14}" text-anchor="middle" class="stakeholder-donut-center-label">zugeordnet</text>
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
            <button type="button" class="secondary-btn stakeholder-edit-btn"
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
