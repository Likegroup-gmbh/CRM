// Monatsmatrix, Sonderzeilen und Berichtsstand der Stakeholder-Übersicht.

import {
  LEISTUNGSBEREICHE,
  LEISTUNGSBEREICH_LABELS,
} from '../../core/budget/leistungsbereich.js';
import { zuordnungsquote } from '../../core/budget/monatsauswertung.js';
import { ViewModeToggle } from '../../core/components/ViewModeToggle.js';
import {
  BERICHTSSTAND_VERSION,
  buildBerichtsstandPayload,
  fetchBerichtsstand,
  saveBerichtsstand,
} from './berichtsstandStore.js';
import { kartenSummen, monatsauswertung } from './stakeholderOverviewData.js';

const SUPABASE = () => window.supabase;

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

export function fmtMonatLabel(monthKeyStr) {
  const [y, m] = monthKeyStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
}

// semantisch = true nur bei der Differenz-Metrik: dort traegt der Wert
// eine Bewertung (gruen/rot). Umsatz und Fremdkosten bleiben neutral.
export function fmtMonatsWert(page, v, semantisch = false) {
  if (v == null || Math.abs(v) < 0.005) return '<span class="stakeholder-null">–</span>';
  const cls = v < 0
    ? ' class="stakeholder-negativ"'
    : (semantisch ? ' class="stakeholder-positiv"' : '');
  return `<span${cls}>${page.fmtEuro(v)}</span>`;
}

// Quelle der Monatsauswertung: live gerechnet oder der eingefrorene
// Berichtsstand (PRD Schritt 7). Gleiche Objektform in beiden Faellen.
export function aktiveMonatsauswertung(page) {
  return page.aktiverBerichtsstand?.daten?.monatsauswertung || monatsauswertung(page);
}

export function defaultBerichtsstandLabel() {
  return `Investorenupdate ${new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`;
}

export function fmtBerichtsstandDatum(iso) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function renderBerichtsstandLeiste(page) {
  const aktiv = page.aktiverBerichtsstand;
  const optionen = page.berichtsstaende.map(b =>
    `<option value="${page.escape(b.id)}"${aktiv?.id === b.id ? ' selected' : ''}>${page.escape(fmtBerichtsstandDatum(b.created_at))} — ${page.escape(b.label)}</option>`
  ).join('');

  const select = `
    <select id="stakeholder-bericht-select" class="form-select" aria-label="Berichtsstand wählen">
      <option value="live"${!aktiv ? ' selected' : ''}>Live-Ansicht</option>
      ${optionen}
    </select>`;

  if (aktiv) {
    return `
      <div class="stakeholder-bericht-banner">
        <span>Berichtsstand vom ${fmtBerichtsstandDatum(aktiv.created_at)} — „${page.escape(aktiv.label)}". Eingefrorener Stand; die Live-Werte können inzwischen abweichen.</span>
        ${select}
      </div>
    `;
  }

  if (!window.isAdmin?.()) {
    return `
      <div class="stakeholder-bericht">
        ${select}
      </div>
    `;
  }

  return `
    <div class="stakeholder-bericht">
      ${select}
      <input type="text" id="stakeholder-bericht-label" class="form-input"
             value="${page.escape(defaultBerichtsstandLabel())}"
             aria-label="Bezeichnung des Berichtsstands" />
      <button type="button" id="stakeholder-bericht-sichern" class="mdc-btn">
        Berichtsstand sichern
      </button>
    </div>
  `;
}

export function renderMonatsauswertung(page) {
  const auswertung = aktiveMonatsauswertung(page);
  const view = auswertung.views[page.monatsSicht];
  const quote = zuordnungsquote(view);
  const stand = page.aktiverBerichtsstand
    ? fmtBerichtsstandDatum(page.aktiverBerichtsstand.created_at)
    : new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return `
    <div class="stakeholder-monate-toolbar">
      ${ViewModeToggle.render([
        {
          buttonId: 'btn-view-marge',
          label: 'Margensicht',
          active: page.monatsSicht === 'marge',
          title: 'Fremdkosten stehen im Monat der zugehörigen Kundenrechnung – so liest sich die Marge pro Monat richtig.',
        },
        {
          buttonId: 'btn-view-buchhaltung',
          label: 'Buchhaltungssicht',
          active: page.monatsSicht === 'buchhaltung',
          title: 'Jeder Beleg steht im Monat seines eigenen Rechnungsdatums – so ging der Monat durch die Bücher.',
        },
      ])}
      ${ViewModeToggle.render([
        { buttonId: 'btn-view-umsatz', label: 'Umsatz', active: page.monatsMetrik === 'umsatz' },
        { buttonId: 'btn-view-fremdkosten', label: 'Fremdkosten', active: page.monatsMetrik === 'fremdkosten' },
        { buttonId: 'btn-view-differenz', label: 'Differenz', active: page.monatsMetrik === 'differenz' },
      ])}
      <div class="stakeholder-monate-meta"
           title="Der nicht zugeordnete Rest ist ein Datenmangel (fehlende Kampagnenart-Blöcke). Die konkreten Fälle stehen in der Datenqualitätsanzeige im Accounting-Bereich.">
        Stand ${stand}${page.aktiverBerichtsstand ? ' (eingefroren)' : ''}
        ${quote != null ? ` · ${page.fmtPct(quote * 100)} des Umsatzes einem Leistungsbereich zugeordnet` : ''}
        ${window.isAdmin?.() ? ` · <button type="button" class="stakeholder-dq-link" data-stakeholder-dq-link>Fälle in der Datenqualitätsanzeige ansehen</button>` : ''}
      </div>
    </div>
    ${renderBerichtsstandLeiste(page)}
    ${renderMonatsMatrix(page, view, auswertung.months)}
    ${renderFremdkostenPosten(page, view, auswertung.months)}
    ${renderSonderzeilen(page, auswertung.sonderzeilen)}
  `;
}

export function renderMonatsMatrix(page, view, months) {
  if (months.length === 0) {
    return `
      <div class="stakeholder-list-card">
        <div class="stakeholder-empty">Noch keine gestellten Rechnungen mit plausiblem Datum.</div>
      </div>
    `;
  }

  const metrik = MONATS_METRIKEN[page.monatsMetrik] || MONATS_METRIKEN.differenz;
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
        <h3 class="stakeholder-list-title">${page.escape(metrik.label)}</h3>
        <p class="stakeholder-list-hint">${
          page.monatsSicht === 'marge'
            ? 'Margensicht: Fremdkosten folgen dem Umsatz anteilig über dessen Kundenrechnungsmonate. Nachlaufende Creatorrechnungen ändern abgeschlossene Monate rückwirkend.'
            : 'Buchhaltungssicht: jeder Beleg steht im Monat seines eigenen Rechnungsdatums.'
        }</p>
      </div>
      <div class="stakeholder-scroll-x">
      <table class="stakeholder-table stakeholder-matrix">
        <thead>
          <tr>
            <th>Leistungsbereich</th>
            ${months.map(m => `<th class="stakeholder-num">${fmtMonatLabel(m)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${aktiveBereiche.map(key => `
            <tr>
              <td>${page.escape(LEISTUNGSBEREICH_LABELS[key])}</td>
              ${months.map(m => `<td class="stakeholder-num">${fmtMonatsWert(page, metrik.wert(view.bereiche[key], m), semantisch)}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="stakeholder-row--total">
            <td>GESAMT</td>
            ${months.map(m => `<td class="stakeholder-num">${fmtMonatsWert(page, totals[m], semantisch)}</td>`).join('')}
          </tr>
        </tfoot>
      </table>
      </div>
    </div>
  `;
}

export function renderFremdkostenPosten(page, view, months) {
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
            ${months.map(m => `<th class="stakeholder-num">${fmtMonatLabel(m)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${posten.map(([label, field]) => `
            <tr>
              <td>${label}</td>
              ${months.map(m => `<td class="stakeholder-num">${fmtMonatsWert(page, sumOf(field, m))}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      </div>
    </div>
  `;
}

export function renderSonderzeilen(page, sonderzeilen) {
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
          <div class="stakeholder-sonderzeile" title="${page.escape(z.hint)}">
            <div class="stakeholder-sonderzeile-label">${page.escape(z.label)}</div>
            <div class="stakeholder-sonderzeile-wert${z.negativ ? ' stakeholder-negativ' : ''}">${page.fmtEuro(z.wert)}</div>
            <div class="stakeholder-sonderzeile-meta">${page.escape(z.meta)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Sichert den aktuellen Live-Stand als Berichtsstand (PRD Schritt 7).
export async function sichereBerichtsstand(page) {
  // Doppelklick-Guard: Staende koennen bewusst nicht geloescht werden,
  // also darf ein Klick nicht zwei Belege erzeugen.
  if (page._berichtSpeichert) return;
  page._berichtSpeichert = true;
  const input = document.getElementById('stakeholder-bericht-label');
  const label = (input?.value || '').trim() || defaultBerichtsstandLabel();
  try {
    const daten = buildBerichtsstandPayload({
      monatsauswertung: monatsauswertung(page),
      zahlungsstand: kartenSummen(page),
    });
    const createdBy = window.currentUser?.auth_user_id || null;
    const row = await saveBerichtsstand(SUPABASE(), { label, daten, createdBy });
    page.berichtsstaende = [{ ...row, created_by: createdBy }, ...page.berichtsstaende];
    window.toastSystem?.show(`Berichtsstand „${label}" gesichert`, 'success');
  } catch (e) {
    console.error('❌ Berichtsstand konnte nicht gesichert werden', e);
    window.toastSystem?.show('Berichtsstand konnte nicht gesichert werden', 'error');
    return;
  } finally {
    page._berichtSpeichert = false;
  }
  page.render();
}

// Wechselt zwischen Live-Ansicht und einem eingefrorenen Berichtsstand.
export async function oeffneBerichtsstand(page, id) {
  page._berichtWahl = id;
  if (id === 'live') {
    page.aktiverBerichtsstand = null;
    page.render();
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
  if (page._berichtWahl !== id) return;
  // Version 1 ist das alte Zahlungsstand-Schema und bleibt lesbar.
  if (stand.daten?.version !== 1 && stand.daten?.version !== BERICHTSSTAND_VERSION) {
    window.toastSystem?.show('Dieser Berichtsstand hat ein unbekanntes Format und kann nicht angezeigt werden', 'error');
    return;
  }
  page.aktiverBerichtsstand = stand;
  page.render();
}
