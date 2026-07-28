// ExtractCostBadge.js
// Zeigt nach dem Auslesen an, was der Vorgang gekostet hat: Preis, Tokens und
// woher der Inhalt kam. Nutzt das vorhandene Tag-System (.tags / .tag) fuer das
// Styling, damit die Badges wie ueberall sonst im CRM aussehen.

const HOST_CLASS = 'extract-meta';

const ICONS = {
  cost: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256"><path d="M244.24,60a8,8,0,0,0-7.75-.4c-42.93,21-73.59,11.16-106,.78-34-10.89-69.25-22.14-117.95,1.64A8,8,0,0,0,8,69.24V189.17a8,8,0,0,0,11.51,7.19c42.93-21,73.59-11.16,106.05-.78,19.24,6.15,38.84,12.42,61,12.42,17.09,0,35.73-3.72,56.91-14.06a8,8,0,0,0,4.49-7.18V66.83A8,8,0,0,0,244.24,60ZM232,181.67c-40.6,18.17-70.25,8.69-101.56-1.32-19.24-6.15-38.84-12.42-61-12.42a122,122,0,0,0-45.4,9V74.33c40.6-18.17,70.25-8.69,101.56,1.32S189.14,96,232,79.09ZM128,96a32,32,0,1,0,32,32A32,32,0,0,0,128,96Zm0,48a16,16,0,1,1,16-16A16,16,0,0,1,128,144ZM56,96v48a8,8,0,0,1-16,0V96a8,8,0,1,1,16,0Zm144,64V112a8,8,0,1,1,16,0v48a8,8,0,1,1-16,0Z"/></svg>',
  tokens: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 256 256"><path d="M211,103.43l-70.13,28,49.47,63.61a8,8,0,1,1-12.63,9.82L128,141,78.32,204.91a8,8,0,0,1-12.63-9.82l49.47-63.61L45,103.43A8,8,0,0,1,51,88.57l69,27.61V40a8,8,0,0,1,16,0v76.18l69-27.61A8,8,0,1,1,211,103.43Z"/></svg>',
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

    // Ein vom Formular vorbereiteter Platz hat Vorrang - so kann ein Layout
    // die Badges genau dort haben, wo sie hingehoeren, statt am Section-Ende.
    const slot = this.form?.querySelector('[data-extract-meta-slot]');
    if (slot) {
      slot.classList.add(HOST_CLASS, 'tags', 'tags-compact');
      this.host = slot;
      return this.host;
    }

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

    const { cost, source, cached, diagnostics } = result || {};
    const parts = [];

    if (diagnostics?.abbruch) {
      parts.push(tag('Abgebrochen', {
        variant: 'extract-abbruch',
        title: 'Der Vorgang lief in das Zeitlimit. Details in der Browser-Console.'
      }));
    } else if (cached) {
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
