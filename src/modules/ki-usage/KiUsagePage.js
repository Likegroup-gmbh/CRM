// KiUsagePage.js
// Admin-Übersicht über alle KI-Anfragen (ki_requests): wer hat wann welches
// Feature benutzt, wie viele Tokens, welche Kosten, erfolgreich oder nicht.
// Geschrieben werden die Zeilen von den Netlify Functions (siehe
// netlify/functions/_shared/ki-log.js), gelesen per RLS nur von Admins.

import { renderEmptyStateRow } from '../../core/components/EmptyState.js';

const FEATURE_LABELS = {
  skript_generierung: 'Skript-Generierung',
  skript_rueckfragen: 'Skript-Rückfragen',
  skript_editor: 'Skript-Editor',
  dna_destillat: 'DNA-Destillat',
  pdf_briefing: 'PDF-Briefing',
  site_extract_unternehmen: 'Webseiten-Extrakt Unternehmen',
  site_extract_marke: 'Webseiten-Extrakt Marke',
  site_extract_produkt: 'Webseiten-Extrakt Produkt',
  produkt_persona: 'Persona-Vorschläge Produkt',
  briefing_auswertung: 'Briefing-Auswertung'
};

const STATUS_META = {
  ok: { label: 'OK', color: 'var(--success-color, #2e9e5b)' },
  error: { label: 'Fehler', color: 'var(--error-color, #d64545)' },
  blocked: { label: 'Geblockt', color: 'var(--warning-color, #d68f22)' },
  running: { label: 'Läuft', color: 'var(--text-secondary, #999)' }
};

const ZEITRAEUME = [
  { id: 'heute', label: 'Heute', tage: 0 },
  { id: '7t', label: '7 Tage', tage: 7 },
  { id: '30t', label: '30 Tage', tage: 30 }
];

export class KiUsagePage {
  constructor() {
    this.requests = [];
    this.benutzerNamen = new Map();
    this.zeitraum = '7t';
    this._abort = null;
  }

  async init() {
    if (!window.isAdmin?.()) {
      window.content.innerHTML = '<div class="error-message"><p>Keine Berechtigung.</p></div>';
      return;
    }

    window.setHeadline('KI-Nutzung');
    window.content.innerHTML = `
      <div class="table-loading-container table-loading-min">
        <div class="table-loading-spinner"></div>
      </div>
    `;

    await this.loadData();
    this.render();
  }

  destroy() {
    if (this._abort) {
      this._abort.abort();
      this._abort = null;
    }
  }

  startDatum() {
    const zeitraum = ZEITRAEUME.find((z) => z.id === this.zeitraum) || ZEITRAEUME[1];
    const start = new Date();
    if (zeitraum.tage === 0) {
      start.setHours(0, 0, 0, 0);
    } else {
      start.setDate(start.getDate() - zeitraum.tage);
    }
    return start.toISOString();
  }

  async loadData() {
    const { data, error } = await window.supabase
      .from('ki_requests')
      .select('id, created_at, created_by, feature, model, input_tokens, output_tokens, cost_eur, status, error_message, dauer_ms')
      .gte('created_at', this.startDatum())
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Fehler beim Laden der KI-Nutzung:', error);
      this.requests = [];
      return;
    }
    this.requests = data || [];

    // Namen der Benutzer nachladen (created_by ist die auth-User-ID,
    // kein FK -> client-seitig ueber benutzer.auth_user_id mappen)
    const userIds = [...new Set(this.requests.map((r) => r.created_by).filter(Boolean))]
      .filter((id) => !this.benutzerNamen.has(id));
    if (userIds.length) {
      const { data: benutzer } = await window.supabase
        .from('benutzer')
        .select('auth_user_id, name, vorname, nachname')
        .in('auth_user_id', userIds);
      (benutzer || []).forEach((b) => {
        const name = (b.name || '').trim()
          || [b.vorname, b.nachname].filter(Boolean).join(' ').trim()
          || 'Unbekannt';
        this.benutzerNamen.set(b.auth_user_id, name);
      });
    }
  }

  formatKosten(eur, digits = 3) {
    if (eur === null || eur === undefined) return '–';
    return `${Number(eur).toFixed(digits).replace('.', ',')} €`;
  }

  formatTokens(zahl) {
    if (zahl === null || zahl === undefined) return '–';
    return Number(zahl).toLocaleString('de-DE');
  }

  render() {
    this._abort?.abort();
    this._abort = new AbortController();
    const { signal } = this._abort;

    const summe = this.requests.reduce((acc, r) => {
      acc.kosten += Number(r.cost_eur) || 0;
      acc.tokens += (r.input_tokens || 0) + (r.output_tokens || 0);
      if (r.status === 'blocked') acc.geblockt += 1;
      if (r.status === 'error') acc.fehler += 1;
      return acc;
    }, { kosten: 0, tokens: 0, geblockt: 0, fehler: 0 });

    const zeitraumButtons = ZEITRAEUME.map((z) => `
      <button type="button" class="mdc-btn mdc-btn--secondary ki-usage-zeitraum" data-zeitraum="${z.id}"
        style="${z.id === this.zeitraum ? 'font-weight:600;text-decoration:underline;' : ''}">
        ${z.label}
      </button>
    `).join('');

    const rows = this.requests.map((r) => {
      const status = STATUS_META[r.status] || { label: r.status, color: 'inherit' };
      const wann = new Date(r.created_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium' });
      const wer = r.created_by ? (this.benutzerNamen.get(r.created_by) || 'Unbekannt') : '–';
      const fehlerHinweis = r.error_message
        ? ` title="${this.escape(r.error_message)}"`
        : '';
      return `
        <tr>
          <td class="cell-nowrap">${wann}</td>
          <td>${this.escape(wer)}</td>
          <td>${this.escape(FEATURE_LABELS[r.feature] || r.feature)}</td>
          <td>${this.escape(r.model || '–')}</td>
          <td class="u-text-right">${this.formatTokens(r.input_tokens)}</td>
          <td class="u-text-right">${this.formatTokens(r.output_tokens)}</td>
          <td class="u-text-right cell-nowrap">${this.formatKosten(r.cost_eur)}</td>
          <td><span class="status-badge" style="color:${status.color};"${fehlerHinweis}>${status.label}</span></td>
        </tr>
      `;
    }).join('');

    window.content.innerHTML = `
      <div class="content-section">
        <div class="page-header">
          <h2 class="page-header-title">KI-Nutzung</h2>
          <div class="page-header-right ki-usage-header-actions">
            ${zeitraumButtons}
          </div>
        </div>
        <div class="ki-usage-summary">
          <div><strong>${this.requests.length}</strong> Anfragen${this.requests.length === 500 ? ' (max. 500 geladen)' : ''}</div>
          <div><strong>${this.formatTokens(summe.tokens)}</strong> Tokens</div>
          <div><strong>${this.formatKosten(summe.kosten, 2)}</strong> Kosten</div>
          <div><strong>${summe.fehler}</strong> Fehler</div>
          <div><strong>${summe.geblockt}</strong> geblockt</div>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Mitarbeiter</th>
                <th>Bereich</th>
                <th>Modell</th>
                <th class="u-text-right">Tokens in</th>
                <th class="u-text-right">Tokens out</th>
                <th class="u-text-right">Kosten</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows || renderEmptyStateRow({ icon: 'info', title: 'Keine KI-Anfragen im gewählten Zeitraum' }, 8)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.querySelectorAll('.ki-usage-zeitraum').forEach((btn) => {
      btn.addEventListener('click', async () => {
        this.zeitraum = btn.dataset.zeitraum;
        await this.loadData();
        this.render();
      }, { signal });
    });
  }

  escape(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export const kiUsagePage = new KiUsagePage();
