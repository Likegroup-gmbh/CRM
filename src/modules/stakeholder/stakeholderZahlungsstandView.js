// Zahlungsstand-Tabelle und aufklappbare Belegliste.

import { leereRechnungsseite } from '../../core/budget/rechnungsstatus.js';
import { aggregate, rechnungsstatus, zahlungsstandBelege } from './stakeholderOverviewData.js';
import { fmtBerichtsstandDatum } from './stakeholderMonatsView.js';

const BELEG_SEITEN = {
  kunden: 'Kundenrechnungen',
  contracting: 'Contractingrechnungen',
  creator: 'Creatorrechnungen',
};

const BELEG_KATEGORIEN = {
  gestellt: 'gestellt',
  bezahlt: 'bezahlt',
  offen: 'offen',
  nichtGestellt: 'noch nicht gestellt',
};

const BELEG_DATUM_SPALTE = {
  gestellt: 'Rechnungsdatum',
  bezahlt: 'Zahlungseingang',
  offen: 'Fälligkeit',
  nichtGestellt: '–',
};

function zahlungsstandHint(page, eingefroren, liveAnsicht) {
  const stand = eingefroren
    ? `Stand ${fmtBerichtsstandDatum(page.aktiverBerichtsstand.created_at)} (eingefrorener Berichtsstand)`
    : 'Stand heute · Jahr und Leistungsbereich wie die Karten';
  const klick = liveAnsicht ? ' · Betrag anklicken zeigt die Belege bzw. Restbeträge' : '';
  return `${stand} · Gestellt = Summe aller gestellten Rechnungen · Bezahlt = Zahlung eingegangen · Offen = gestellt, nicht bezahlt · Noch nicht gestellt = Restbetrag aus Auftrag bzw. Kalkulation · KSK/Zusatz nicht gestellt = Kartenwert minus bereits auf Belegen${klick}`;
}

export function renderRechnungsstatus(page) {
  // Im Berichtsstand-Modus zeigt der Block den eingefrorenen Stand,
  // damit die Ansicht konsistent zum gesicherten Update bleibt.
  const eingefroren = page.aktiverBerichtsstand?.daten?.zahlungsstand;
  const live = eingefroren || rechnungsstatus(page);
  const kunden = live.kunden;
  const creator = live.creator;
  const contracting = live.contracting || leereRechnungsseite();
  const liveAnsicht = !eingefroren;
  const offenZelle = liveAnsicht ? page.zahlungsstandBelegeOffen : null;
  const karten = liveAnsicht ? aggregate(page).totals : { ksk: 0, zusatz: 0 };
  const creatorKskNicht = karten.ksk - (creator.kskGestellt || 0);
  const creatorZusatzNicht = karten.zusatz - (creator.zusatzGestellt || 0);

  const extraSpalten = (seite, seiteKey) => {
    const kskNicht = seiteKey === 'creator' ? creatorKskNicht : 0;
    const zusatzNicht = seiteKey === 'creator' ? creatorZusatzNicht : 0;
    const inkl = (seite.nichtGestellt || 0) + kskNicht + zusatzNicht;
    const zelle = (attr, wert) => `
      <td class="stakeholder-num${wert < -0.005 ? ' stakeholder-negativ' : ''}"
          data-zahlungsstand-${attr}="${seiteKey}">${page.fmtEuro(wert)}</td>`;
    return `${zelle('ksk-nicht', kskNicht)}${zelle('zusatz-nicht', zusatzNicht)}${zelle('nicht-inkl', inkl)}`;
  };

  const offenHinweis = (seite) => seite.ueberfaellig >= 0.005
    ? `<div class="stakeholder-status-ueberfaellig">davon überfällig: ${page.fmtEuro(seite.ueberfaellig)}</div>`
    : '';

  const zellenWert = (seiteKey, kategorie, wert, { extra = '', negativ = false } = {}) => {
    const cls = `stakeholder-num${negativ ? ' stakeholder-negativ' : ''}`;
    if (!liveAnsicht) {
      return `<td class="${cls}">${page.fmtEuro(wert)}${extra}</td>`;
    }
    const open = offenZelle?.seite === seiteKey && offenZelle?.kategorie === kategorie;
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
  };

  const zeile = (label, seite, seiteKey) => `
    <tr>
      <td>${label}</td>
      ${zellenWert(seiteKey, 'gestellt', seite.gestellt)}
      ${zellenWert(seiteKey, 'bezahlt', seite.bezahlt)}
      ${zellenWert(seiteKey, 'offen', seite.offen, { extra: offenHinweis(seite) })}
      ${zellenWert(seiteKey, 'nichtGestellt', seite.nichtGestellt, { negativ: seite.nichtGestellt < -0.005 })}
      ${extraSpalten(seite, seiteKey)}
    </tr>
  `;

  return `
    <div class="stakeholder-list-card stakeholder-status">
      <div class="stakeholder-list-header">
        <h3 class="stakeholder-list-title">Zahlungsstand</h3>
        <p class="stakeholder-list-hint">${zahlungsstandHint(page, eingefroren, liveAnsicht)}</p>
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
      ${offenZelle ? renderZahlungsstandBelege(page, offenZelle.seite, offenZelle.kategorie) : ''}
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
  const istRest = kategorie === 'nichtGestellt';
  const belege = zahlungsstandBelege(page)?.[seiteKey]?.[kategorie] || [];
  const summe = belege.reduce((s, b) => s + (b.betrag || 0), 0);
  const zeilen = belege.map(b => {
    const aufschluss = b.honorar != null
      ? `<div class="stakeholder-status-beleg-meta">${page.fmtEuro(b.honorar)} Honorar · ${page.fmtEuro(b.ksk)} KSK · ${page.fmtEuro(b.zusatz)} Zusatz</div>`
      : '';
    const betragCls = b.betrag < -0.005 ? ' stakeholder-negativ' : '';
    return `
      <tr>
        <td>
          <a href="${page.escape(b.route)}" class="table-link" data-zahlungsstand-route="${page.escape(b.route)}">${page.escape(b.label)}</a>
        </td>
        <td>${page.escape(fmtBelegDatum(b.datum))}</td>
        <td class="stakeholder-num${betragCls}">${page.fmtEuro(b.betrag)}${aufschluss}</td>
      </tr>`;
  }).join('');
  const leer = istRest ? 'Kein Restbetrag.' : 'Keine Belege.';
  const art = istRest ? 'Restbetrag' : 'Belege';

  return `
    <div class="stakeholder-status-belege" data-zahlungsstand-belege="${seiteKey}" data-zahlungsstand-kategorie="${kategorie}">
      <p class="stakeholder-list-hint">${art} zu ${BELEG_SEITEN[seiteKey] || seiteKey} · ${BELEG_KATEGORIEN[kategorie] || kategorie} · Jahr und Leistungsbereich wie die Karten</p>
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
          ${zeilen || `<tr><td colspan="3">${leer}</td></tr>`}
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
