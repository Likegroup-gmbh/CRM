// DatenqualitaetPage.js
// Datenqualitaetsanzeige im Accounting-Bereich (PRD Schritt 9): Liste der
// Kampagnen mit Pflegegrad, aufklappbar zu den konkreten Maengeln,
// sortiert nach betroffenem Geldvolumen. Die Rechenlogik liegt in
// core/budget/datenqualitaet.js — diese Seite laedt nur und rendert.
//
// Die Anzeige benennt die Faelle; korrigiert werden sie von den Teams
// in den jeweiligen Detailseiten (Links in den aufgeklappten Maengeln).

import { calculateDatenqualitaet, DATENQUALITAET_PRUEFUNGEN } from '../../core/budget/datenqualitaet.js';
import { fetchAllRows } from '../../core/fetchAllRows.js';
import { escapeHtml, formatEuro } from '../../core/format.js';
import { icon } from '../../core/icons/IconSystem.js';

const SUPABASE = () => window.supabase;

// Pro Mangel werden hoechstens so viele Einzelbefunde gezeigt; der Rest
// wird als "+N weitere" zusammengefasst, damit die Liste lesbar bleibt.
const DETAIL_LIMIT = 8;

const DETAIL_ROUTES = {
  video: '/video/',
  kooperation: '/kooperation/',
  auftrag: '/auftrag/',
  rechnung: '/rechnung/',
};

export class DatenqualitaetPage {
  constructor() {
    this.data = null;
    this.ergebnis = null;
    this._docClickHandler = null;
  }

  async init() {
    window.setContentSafely(window.content, '<div class="admin-loading">Lade Datenqualitätsanzeige …</div>');

    try {
      await this.loadData();
    } catch (e) {
      console.error('❌ Datenqualität: Daten konnten nicht geladen werden', e);
      window.setContentSafely(window.content, `
        <div class="empty-state"><p>Fehler beim Laden: ${this.escape(e?.message || 'Unbekannt')}</p></div>
      `);
      return;
    }

    this.ergebnis = calculateDatenqualitaet(this.data);
    this.render();
    this.bindEvents();
  }

  async loadData() {
    const supabase = SUPABASE();
    if (!supabase) throw new Error('Supabase nicht verfügbar');

    // Seitenweise laden (fetchAllRows), damit nichts am PostgREST-Limit
    // verloren geht — dieselbe Konvention wie in der Stakeholder-Uebersicht.
    const [auftraege, blocks, kampagnen, kooperationen, videos, rechnungen, creators] = await Promise.all([
      fetchAllRows(supabase, 'auftrag',
        'id, auftragsname, titel, nettobetrag, auftragtype, is_draft'),
      fetchAllRows(supabase, 'auftrag_kampagnenart_blocks',
        'id, auftrag_id, campaign_type, umsatz_netto'),
      fetchAllRows(supabase, 'kampagne',
        'id, kampagnenname, auftrag_id'),
      fetchAllRows(supabase, 'kooperationen',
        'id, kampagne_id, creator_id, einkaufspreis_netto, ksk_selbstzahler, ksk_betrag'),
      fetchAllRows(supabase, 'kooperation_videos',
        'id, kooperation_id, einkaufspreis_netto, verkaufspreis_netto, kampagnenart, titel, video_name'),
      fetchAllRows(supabase, 'rechnung',
        'id, kooperation_id, auftrag_id, kampagne_id, nettobetrag, nettobetrag_steuerfrei, gestellt_am, rechnung_nr'),
      fetchAllRows(supabase, 'creator',
        'id, vorname, nachname'),
    ]);

    this.data = {
      // Entwuerfe werden hier herausgefiltert; das Kernmodul erwartet
      // bereits gefilterte Auftraege (Konvention wie Monatsauswertung).
      auftraege: (auftraege || []).filter(a => a.is_draft !== true),
      blocks: blocks || [],
      kampagnen: kampagnen || [],
      kooperationen: kooperationen || [],
      videos: videos || [],
      rechnungen: rechnungen || [],
      creators: creators || [],
    };
  }

  // ---------- Helpers ----------

  escape(v) {
    return escapeHtml(v);
  }

  fmtEuro(n) {
    return formatEuro(n);
  }

  // ---------- Rendering ----------

  render() {
    const { gruppen, proPruefung, summen } = this.ergebnis;

    window.setContentSafely(window.content, `
      <div class="admin-page">
        <div class="admin-header">
          <p class="admin-hint">Wo fehlen Angaben, an denen Geld hängt? Die Liste ist nach betroffenem Geldvolumen sortiert — je weiter oben, desto dringender. Gleicher Ein- und Verkaufspreis ist bewusst <em>kein</em> Mangel (Fee-Modell bei Influencer Marketing).</p>
        </div>
        ${this.renderPruefungsUebersicht(proPruefung)}
        ${this.renderKampagnenListe(gruppen, summen)}
      </div>
    `);
  }

  renderPruefungsUebersicht(proPruefung) {
    const karten = Object.entries(DATENQUALITAET_PRUEFUNGEN).map(([key, def]) => {
      const { anzahl, volumen } = proPruefung[key] || { anzahl: 0, volumen: 0 };
      const ok = anzahl === 0;
      return `
        <div class="dq-pruefung${ok ? ' dq-pruefung--ok' : ''}" title="${this.escape(def.hint)}">
          <div class="dq-pruefung-label">${this.escape(def.label)}</div>
          <div class="dq-pruefung-werte">
            <span class="dq-pruefung-anzahl">${anzahl}</span>
            <span class="dq-pruefung-volumen">${ok ? 'keine Fälle' : this.fmtEuro(volumen)}</span>
          </div>
        </div>
      `;
    }).join('');

    return `<div class="dq-summary">${karten}</div>`;
  }

  renderKampagnenListe(gruppen, summen) {
    if (summen.mitMaengeln === 0) {
      return `
        <div class="dq-list-card">
          <div class="dq-leer dq-leer--ok">Keine Mängel gefunden — alle geprüften Kampagnen sind vollständig gepflegt.</div>
        </div>
      `;
    }

    const zeilen = gruppen.map(g => this.renderGruppe(g)).join('');

    return `
      <div class="dq-list-card">
        <div class="dq-list-header">
          <h2 class="dq-list-title">Kampagnen</h2>
          <p class="dq-list-hint">${summen.mitMaengeln} von ${summen.gruppen} Kampagnen mit Mängeln · ${summen.maengel} Befunde · ${this.fmtEuro(summen.volumen)} betroffen</p>
        </div>
        <div class="dq-scroll-x">
        <table class="dq-table">
          <thead>
            <tr>
              <th class="dq-toggle-col"></th>
              <th>Kampagne</th>
              <th>Pflegegrad</th>
              <th class="dq-num">Mängel</th>
              <th class="dq-num">Betroffenes Volumen</th>
            </tr>
          </thead>
          <tbody>
            ${zeilen}
          </tbody>
        </table>
        </div>
      </div>
    `;
  }

  renderGruppe(g) {
    const key = g.kampagneId || '__ohne__';
    const anzahlMaengel = g.maengel.reduce((s, m) => s + m.anzahl, 0);
    const expandierbar = g.maengel.length > 0;

    const grad = g.pflegegrad;
    const gradLabel = grad == null ? '–' : `${Math.round(grad * 100)} %`;
    const gradClass = grad == null
      ? 'dq-grad--leer'
      : grad >= 0.9 ? 'dq-grad--gut' : grad >= 0.7 ? 'dq-grad--mittel' : 'dq-grad--schlecht';

    const nameHtml = g.kampagneId
      ? `<button type="button" class="dq-link dq-name" data-dq-nav="/kampagne/${g.kampagneId}">${this.escape(g.name)}</button>`
      : `<span class="dq-name dq-name--ohne">${this.escape(g.name)}</span>`;

    const hauptZeile = `
      <tr class="dq-row">
        <td class="dq-toggle-col">${expandierbar ? `
          <button type="button" class="dq-toggle" data-dq-toggle="${key}"
                  aria-expanded="false" aria-label="Mängel von ${this.escape(g.name)} anzeigen">
            ${icon('chevron-down', { stroke: 2, size: 16 })}
          </button>` : ''}
        </td>
        <td>${nameHtml}</td>
        <td><span class="dq-grad ${gradClass}">${gradLabel}</span></td>
        <td class="dq-num">${anzahlMaengel || '–'}</td>
        <td class="dq-num${g.volumen > 0.005 ? ' dq-volumen' : ''}">${this.fmtEuro(g.volumen)}</td>
      </tr>
    `;

    if (!expandierbar) return hauptZeile;

    return hauptZeile + `
      <tr class="dq-detail" data-dq-detail="${key}" hidden>
        <td colspan="5">
          <div class="dq-maengel">
            ${g.maengel.map(m => this.renderMangel(m)).join('')}
          </div>
        </td>
      </tr>
    `;
  }

  renderMangel(m) {
    const def = DATENQUALITAET_PRUEFUNGEN[m.pruefung] || { label: m.pruefung, hint: '' };
    const sichtbar = m.details.slice(0, DETAIL_LIMIT);
    const rest = m.details.length - sichtbar.length;

    const detailHtml = sichtbar.map(d => {
      const extra = d.extra?.fakturiert != null
        ? ` · ${this.fmtEuro(d.extra.fakturiert)} fakturiert / ${this.fmtEuro(d.extra.erfasst)} erfasst`
        : '';
      return `
        <button type="button" class="dq-link dq-befund" data-dq-nav="${DETAIL_ROUTES[d.typ]}${d.id}">
          <span>${this.escape(d.label)}</span>
          <span class="dq-befund-betrag">${this.fmtEuro(d.betrag)}${this.escape(extra)}</span>
        </button>
      `;
    }).join('');

    return `
      <div class="dq-mangel">
        <div class="dq-mangel-head">
          <span class="dq-mangel-label">${this.escape(def.label)}</span>
          <span class="dq-mangel-meta">${m.anzahl} ${m.anzahl === 1 ? 'Fall' : 'Fälle'} · ${this.fmtEuro(m.volumen)}</span>
        </div>
        <p class="dq-mangel-hint">${this.escape(def.hint)}</p>
        <div class="dq-mangel-details">
          ${detailHtml}
          ${rest > 0 ? `<span class="dq-mehr">… und ${rest} weitere</span>` : ''}
        </div>
      </div>
    `;
  }

  // ---------- Events ----------

  toggleGruppe(key) {
    const detail = document.querySelector(`[data-dq-detail="${key}"]`);
    const toggle = document.querySelector(`[data-dq-toggle="${key}"]`);
    if (!detail || !toggle) return;
    const offen = detail.hasAttribute('hidden');
    detail.toggleAttribute('hidden', !offen);
    toggle.setAttribute('aria-expanded', String(offen));
    toggle.classList.toggle('dq-toggle--offen', offen);
  }

  bindEvents() {
    if (this._docClickHandler) return;

    this._docClickHandler = (e) => {
      const toggle = e.target.closest('[data-dq-toggle]');
      if (toggle) {
        this.toggleGruppe(toggle.dataset.dqToggle);
        return;
      }
      const nav = e.target.closest('[data-dq-nav]');
      if (nav) {
        window.navigateTo(nav.dataset.dqNav);
      }
    };
    document.addEventListener('click', this._docClickHandler);
  }

  destroy() {
    if (this._docClickHandler) {
      document.removeEventListener('click', this._docClickHandler);
      this._docClickHandler = null;
    }
  }
}
