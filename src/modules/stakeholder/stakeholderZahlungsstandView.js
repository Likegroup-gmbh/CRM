// Zahlungsstand-Tabelle und aufklappbare Belegliste.
// Live-Zahlen sind die Kachelsummen. Alte Berichtsstände (gestellt/offen)
// rendern weiter mit dem eingefrorenen Schema.

import { leereRechnungsseite } from '../../core/budget/rechnungsstatus.js';
import { kartenBelege, kartenSummen } from './stakeholderOverviewData.js';
import { fmtBerichtsstandDatum } from './stakeholderMonatsView.js';

const BELEG_SEITEN = {
  kunden: 'Kundenrechnungen',
  contracting: 'Contractingrechnungen',
  creator: 'Creatorrechnungen',
};

const BELEG_KATEGORIEN = {
  netto: 'Netto',
  gestellt: 'gestellt',
  bezahlt: 'bezahlt',
  unbezahlt: 'unbezahlt',
  ueberfaellig: 'davon überfällig',
  ust: 'MwSt',
  brutto: 'Brutto',
  offen: 'offen',
  nichtGestellt: 'noch nicht gestellt',
};

const BELEG_DATUM_SPALTE = {
  netto: 'Rechnungsdatum',
  gestellt: 'Rechnungsdatum',
  bezahlt: 'Zahlungseingang',
  unbezahlt: 'Fälligkeit',
  ueberfaellig: 'Fälligkeit',
  ust: 'Rechnungsdatum',
  brutto: 'Rechnungsdatum',
  offen: 'Fälligkeit',
  nichtGestellt: '–',
};

const KUNDEN_SPALTEN = [
  ['netto', 'Netto', 'nettobetrag'],
  ['gestellt', 'Gestellt', 're_datum_netto'],
  ['bezahlt', 'Bezahlt', 'bezahlt_netto'],
  ['unbezahlt', 'Unbezahlt', 'unbezahlt_netto'],
  ['ueberfaellig', 'davon überfällig', 'ueberfaellig_netto'],
];

const RECHNUNG_SPALTEN = [
  ['netto', 'Netto', 'nettobetrag'],
  ['bezahlt', 'Bezahlt', 'bezahlt_netto'],
  ['unbezahlt', 'Unbezahlt', 'unbezahlt_netto'],
  ['ust', 'MwSt', 'ust_betrag'],
  ['brutto', 'Brutto', 'bruttobetrag'],
];

function isLegacyZahlungsstand(stand) {
  const kunden = stand?.kunden;
  if (!kunden) return false;
  return kunden.re_datum_netto == null && kunden.gestellt != null;
}

function zahlungsstandHint(page, eingefroren, liveAnsicht, legacy) {
  const stand = eingefroren
    ? `Stand ${fmtBerichtsstandDatum(page.aktiverBerichtsstand.created_at)} (eingefrorener Berichtsstand)`
    : 'Stand heute · Jahr und Leistungsbereich wie die Karten';
  const klick = liveAnsicht ? ' · Betrag anklicken zeigt die Belege' : '';
  const regel = legacy
    ? 'Gestellt = Summe aller gestellten Rechnungen · Bezahlt = Zahlung eingegangen · Offen = gestellt, nicht bezahlt · Noch nicht gestellt = Restbetrag aus Auftrag bzw. Kalkulation'
    : 'Kundenrechnungen: Netto, Gestellt, Bezahlt, Unbezahlt, überfällig wie die Kacheln · Rechnungen: Netto, Bezahlt, Unbezahlt, MwSt, Brutto wie die Kacheln · Unbezahlt = Netto − Bezahlt';
  return `${stand} · ${regel}${klick}`;
}

function zellenWert(page, seiteKey, kategorie, wert, { extra = '', negativ = false, klickbar = true } = {}) {
  const cls = `stakeholder-num${negativ ? ' stakeholder-negativ' : ''}`;
  if (!klickbar) {
    return `<td class="${cls}">${page.fmtEuro(wert)}${extra}</td>`;
  }
  const offen = page.zahlungsstandBelegeOffen;
  const open = offen?.seite === seiteKey && offen?.kategorie === kategorie;
  return `
    <td class="${cls}">
      <button type="button"
              class="stakeholder-status-zelle${open ? ' is-open' : ''}"
              data-zahlungsstand-seite="${seiteKey}"
              data-zahlungsstand-kategorie="${kategorie}"
              aria-expanded="${open ? 'true' : 'false'}">
        ${page.fmtEuro(wert)}
      </button>
      ${extra}
    </td>`;
}

function spaltenZeile(page, label, seiteKey, seite, spalten, klickbar) {
  const zellen = spalten.map(([kategorie, , feld]) => {
    const wert = seite?.[feld] || 0;
    return zellenWert(page, seiteKey, kategorie, wert, {
      klickbar,
      negativ: wert < -0.005,
    });
  }).join('');
  return `<tr><td>${label}</td>${zellen}</tr>`;
}

function tabellenKopf(spalten) {
  return spalten.map(([, label]) => `<th class="stakeholder-num">${label}</th>`).join('');
}

export function renderRechnungsstatus(page) {
  const eingefroren = page.aktiverBerichtsstand?.daten?.zahlungsstand;
  if (eingefroren && isLegacyZahlungsstand(eingefroren)) {
    return renderLegacyZahlungsstand(page, eingefroren);
  }
  const live = eingefroren || kartenSummen(page);
  const liveAnsicht = !eingefroren;
  const offenZelle = liveAnsicht ? page.zahlungsstandBelegeOffen : null;

  return `
    <div class="stakeholder-list-card stakeholder-status">
      <div class="stakeholder-list-header">
        <h3 class="stakeholder-list-title">Zahlungsstand</h3>
        <p class="stakeholder-list-hint">${zahlungsstandHint(page, Boolean(eingefroren), liveAnsicht, false)}</p>
      </div>
      <div class="stakeholder-scroll-x">
      <table class="stakeholder-table stakeholder-status-table">
        <thead>
          <tr><th>Kundenrechnungen</th>${tabellenKopf(KUNDEN_SPALTEN)}</tr>
        </thead>
        <tbody>
          ${spaltenZeile(page, 'Kundenrechnungen', 'kunden', live.kunden, KUNDEN_SPALTEN, liveAnsicht)}
        </tbody>
      </table>
      </div>
      <div class="stakeholder-scroll-x">
      <table class="stakeholder-table stakeholder-status-table">
        <thead>
          <tr><th>Rechnungen</th>${tabellenKopf(RECHNUNG_SPALTEN)}</tr>
        </thead>
        <tbody>
          ${spaltenZeile(page, 'Creatorrechnungen', 'creator', live.creator, RECHNUNG_SPALTEN, liveAnsicht)}
          ${spaltenZeile(page, 'Contractingrechnungen', 'contracting', live.contracting, RECHNUNG_SPALTEN, liveAnsicht)}
        </tbody>
      </table>
      </div>
      ${offenZelle ? renderZahlungsstandBelege(page, offenZelle.seite, offenZelle.kategorie) : ''}
    </div>
  `;
}

function renderLegacyZahlungsstand(page, live) {
  const kunden = live.kunden;
  const creator = live.creator || leereRechnungsseite();
  const contracting = live.contracting || leereRechnungsseite();

  const extraSpalten = (seite, seiteKey) => {
    const kskNicht = seiteKey === 'creator' ? -(seite.kskGestellt || 0) : 0;
    const zusatzNicht = seiteKey === 'creator' ? -(seite.zusatzGestellt || 0) : 0;
    const inkl = (seite.nichtGestellt || 0) + kskNicht + zusatzNicht;
    const zelle = (attr, wert) => `
      <td class="stakeholder-num${wert < -0.005 ? ' stakeholder-negativ' : ''}"
          data-zahlungsstand-${attr}="${seiteKey}">${page.fmtEuro(wert)}</td>`;
    return `${zelle('ksk-nicht', kskNicht)}${zelle('zusatz-nicht', zusatzNicht)}${zelle('nicht-inkl', inkl)}`;
  };

  const offenHinweis = (seite) => seite.ueberfaellig >= 0.005
    ? `<div class="stakeholder-status-ueberfaellig">davon überfällig: ${page.fmtEuro(seite.ueberfaellig)}</div>`
    : '';

  const zeile = (label, seite, seiteKey) => `
    <tr>
      <td>${label}</td>
      <td class="stakeholder-num">${page.fmtEuro(seite.gestellt || 0)}</td>
      <td class="stakeholder-num">${page.fmtEuro(seite.bezahlt || 0)}</td>
      <td class="stakeholder-num">${page.fmtEuro(seite.offen || 0)}${offenHinweis(seite)}</td>
      <td class="stakeholder-num${(seite.nichtGestellt || 0) < -0.005 ? ' stakeholder-negativ' : ''}">${page.fmtEuro(seite.nichtGestellt || 0)}</td>
      ${extraSpalten(seite, seiteKey)}
    </tr>
  `;

  return `
    <div class="stakeholder-list-card stakeholder-status">
      <div class="stakeholder-list-header">
        <h3 class="stakeholder-list-title">Zahlungsstand</h3>
        <p class="stakeholder-list-hint">${zahlungsstandHint(page, true, false, true)}</p>
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
            <th class="stakeholder-num">KSK nicht gestellt</th>
            <th class="stakeholder-num">Zusatz nicht gestellt</th>
            <th class="stakeholder-num">Noch nicht gestellt + KSK + Zusatz</th>
          </tr>
        </thead>
        <tbody>
          ${zeile('Kundenrechnungen', kunden, 'kunden')}
          ${zeile('Contractingrechnungen', contracting, 'contracting')}
          ${zeile('Creatorrechnungen', creator, 'creator')}
        </tbody>
      </table>
      </div>
    </div>
  `;
}

export function fmtBelegDatum(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function renderZahlungsstandBelege(page, seiteKey, kategorie) {
  const belege = kartenBelege(page)?.[seiteKey]?.[kategorie] || [];
  const summe = belege.reduce((s, b) => s + (b.betrag || 0), 0);
  const zeilen = belege.map(b => {
    const betragCls = b.betrag < -0.005 ? ' stakeholder-negativ' : '';
    return `
      <tr>
        <td>
          <a href="${page.escape(b.route)}" class="table-link" data-zahlungsstand-route="${page.escape(b.route)}">${page.escape(b.label)}</a>
        </td>
        <td>${page.escape(fmtBelegDatum(b.datum))}</td>
        <td class="stakeholder-num${betragCls}">${page.fmtEuro(b.betrag)}</td>
      </tr>`;
  }).join('');

  return `
    <div class="stakeholder-status-belege" data-zahlungsstand-belege="${seiteKey}" data-zahlungsstand-kategorie="${kategorie}">
      <p class="stakeholder-list-hint">Belege zu ${BELEG_SEITEN[seiteKey] || seiteKey} · ${BELEG_KATEGORIEN[kategorie] || kategorie} · Jahr und Leistungsbereich wie die Karten</p>
      <div class="stakeholder-scroll-x">
      <table class="stakeholder-table stakeholder-status-belege-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>${BELEG_DATUM_SPALTE[kategorie] || 'Datum'}</th>
            <th class="stakeholder-num">Betrag</th>
          </tr>
        </thead>
        <tbody>
          ${zeilen || '<tr><td colspan="3">Keine Belege.</td></tr>'}
        </tbody>
        <tfoot>
          <tr>
            <th colspan="2">Summe</th>
            <th class="stakeholder-num${summe < -0.005 ? ' stakeholder-negativ' : ''}" data-zahlungsstand-belege-summe>${page.fmtEuro(summe)}</th>
          </tr>
        </tfoot>
      </table>
      </div>
    </div>
  `;
}

// Klick auf Beleg-Link oder Zahlungsstand-Zelle. true = Event verbraucht.
export function onZahlungsstandClick(page, e) {
  const belegLink = e.target.closest('[data-zahlungsstand-route]');
  if (belegLink) {
    e.preventDefault();
    window.navigateTo(belegLink.getAttribute('data-zahlungsstand-route'));
    return true;
  }

  const zelleBtn = e.target.closest('[data-zahlungsstand-seite][data-zahlungsstand-kategorie]');
  if (!zelleBtn) return false;
  if (page.aktiverBerichtsstand) return true;
  const seite = zelleBtn.getAttribute('data-zahlungsstand-seite');
  const kategorie = zelleBtn.getAttribute('data-zahlungsstand-kategorie');
  const offen = page.zahlungsstandBelegeOffen;
  page.zahlungsstandBelegeOffen = offen?.seite === seite && offen?.kategorie === kategorie
    ? null
    : { seite, kategorie };
  page.render();
  return true;
}
