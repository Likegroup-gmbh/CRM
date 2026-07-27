// ExtractCostBadge.js
// Zeigt nach dem Auslesen an, was der Vorgang gekostet hat: Preis, Tokens und
// woher der Inhalt kam. Nutzt das vorhandene Tag-System (.tags / .tag) fuer das
// Styling, damit die Badges wie ueberall sonst im CRM aussehen.

const HOST_CLASS = 'extract-meta';

const ICONS = {
  cost: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m3-9.5c0-.8-1.3-1.5-3-1.5s-3 .7-3 1.5S10.3 10 12 10s3 .7 3 1.5S13.7 13 12 13s-3 .7-3 1.5S10.3 16 12 16s3-.7 3-1.5"/></svg>',
  tokens: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M4 12h16M4 17h10"/></svg>',
  cache: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 2 4.1 13.4a.6.6 0 0 0 .5 1H11l-1 7.6 8.9-11.4a.6.6 0 0 0-.5-1H12l1-7.6Z"/></svg>',
  browser: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5.5h18v13H3zM3 9.5h18"/></svg>'
};

/** Preise sind winzig, deshalb in Cent - erst ab 1 Euro in Euro. */
function formatCost(eur) {
  const value = Number(eur) || 0;
  if (value >= 1) return `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  const cent = value * 100;
  if (value > 0 && cent < 0.01) return '< 0,01 ct';
  return `${cent.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ct`;
}

function tag(label, { icon = null, variant = '', title = '' } = {}) {
  const cls = variant ? `tag tag--${variant}` : 'tag';
  const titleAttr = title ? ` title="${title}"` : '';
  return `<span class="${cls}"${titleAttr}>${icon ? ICONS[icon] || '' : ''}${label}</span>`;
}

export class ExtractCostBadge {
  /**
   * @param {HTMLFormElement} form
   * @param {HTMLElement} anchor - Button oder Feld, in dessen Umgebung die
   *        Badges landen. Die Section hat Vorrang, sonst das Formularfeld.
   */
  constructor(form, anchor) {
    this.form = form;
    this.anchor = anchor;
    this.host = null;
  }

  ensureHost() {
    if (this.host?.isConnected) return this.host;

    const container = this.anchor?.closest('.form-section') || this.anchor?.closest('.form-field');
    if (!container) return null;

    const existing = container.querySelector(`.${HOST_CLASS}`);
    this.host = existing || document.createElement('div');
    if (!existing) {
      this.host.className = `${HOST_CLASS} tags tags-compact`;
      container.appendChild(this.host);
    }
    return this.host;
  }

  /**
   * @param {Object} result - Antwort der Function: { cost, source, cached }
   */
  show(result) {
    const host = this.ensureHost();
    if (!host) return;

    const { cost, source, cached } = result || {};
    const parts = [];

    if (cached) {
      parts.push(tag('Aus Cache, kostenlos', { icon: 'cache', variant: 'extract-cache', title: 'Diese Webseite wurde in den letzten 30 Tagen schon ausgelesen' }));
      const saved = cost?.saved?.eur;
      if (saved) parts.push(tag(`spart ${formatCost(saved)}`, { title: 'Was ein erneutes Auslesen gekostet haette' }));
    } else if (cost) {
      parts.push(tag(formatCost(cost.eur), {
        icon: 'cost',
        variant: 'extract-cost',
        title: `${cost.usd?.toFixed(6)} USD, Modell ${cost.model}`
      }));
      if (cost.tokens?.total) {
        parts.push(tag(`${cost.tokens.total.toLocaleString('de-DE')} Tokens`, {
          icon: 'tokens',
          title: this.tokenBreakdown(cost.tokens)
        }));
      }
    } else {
      parts.push(tag('Kosten unbekannt', { title: 'Für dieses Modell sind keine Preise hinterlegt' }));
    }

    // Nur den erklaerungsbeduerftigen Fall zeigen: der Browser lief mit
    if (source === 'browser') {
      parts.push(tag('Browser nötig', { icon: 'browser', title: 'Die Seite liess sich nicht direkt lesen, sie wurde im Browser gerendert' }));
    }

    host.innerHTML = parts.join('');
  }

  tokenBreakdown(tokens) {
    return [
      `Eingabe: ${(tokens.input || 0).toLocaleString('de-DE')}`,
      `Ausgabe: ${(tokens.output || 0).toLocaleString('de-DE')}`,
      `Cache geschrieben: ${(tokens.cacheWrite || 0).toLocaleString('de-DE')}`,
      `Cache gelesen: ${(tokens.cacheRead || 0).toLocaleString('de-DE')}`
    ].join(' · ');
  }

  clear() {
    if (this.host) this.host.innerHTML = '';
  }
}
