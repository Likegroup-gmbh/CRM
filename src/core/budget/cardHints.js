// cardHints.js
// Info-Tooltips (Formel + Kurztext) auf Budget-Kacheln.
// CSS-only Hover/Focus-Pattern, urspruenglich aus der Stakeholder-Uebersicht
// extrahiert, jetzt shared fuer Auftragsdetails, Kampagne und Stakeholder.
// Styling: assets/styles/cards.css (.card-head, .card-hint, .card-hint-tooltip).

import { icon } from '../icons/IconSystem.js';
import { escapeHtml } from '../format.js';

// Formeltexte fuer Kacheln auf Auftragsdetails und Kampagne.
// Die Stakeholder-Uebersicht pflegt eigene, aggregationsbezogene Texte lokal.
export const CARD_HINTS = {
  volumen: {
    formula: 'Nettobetrag des Auftrags',
    hint: 'was der Kunde beauftragt hat'
  },
  verbraucht: {
    formula: 'Creatoranteil + Agenturanteil + KSK + Zusatzkosten',
    hint: 'alles, was bereits gebucht ist'
  },
  verfuegbar: {
    formula: 'Auftragsvolumen − Zusatzleistungen − Verbrauchtes Budget',
    hint: 'noch nicht gebucht'
  },
  creator: {
    formula: 'Σ Einkaufspreise (EK) der gebuchten Videos',
    hint: 'Kalkulation — nicht die gestellten Creatorrechnungen'
  },
  agentur: {
    formula: 'Feste Fee + EK/VK-Differenz',
    hint: 'festgelegte Fee plus Marge aus voll bepreisten Videos'
  },
  ksk: {
    formula: 'UGC: 4,9 % auf EK · Influencer: KSK-Topf',
    hint: 'Künstlersozialabgabe auf Honorare'
  },
  zusatz: {
    formula: 'Σ Zusatzkosten der Kooperationen',
    hint: 'Reise, Lizenzen, Tools, Versand, Payroll'
  },
  extras: {
    formula: 'Σ Zusatzleistungen (extra_services)',
    hint: 'reserviertes Volumen — kein Verbrauch, mindert den Rest'
  },
  creatorbudget: {
    formula: 'Creator-Budget + KSK-Selbstzahler-Umbuchungen',
    hint: 'Topf für Influencer-Buchungen'
  },
  verbrauchtCreator: {
    formula: 'Σ Verkaufspreise (VK) der gebuchten Videos',
    hint: 'was bereits aus dem Creator-Topf gebucht ist'
  },
  offenCreator: {
    formula: 'Creator-Budget − gebuchte VK',
    hint: 'noch nicht gebuchtes Creator-Budget'
  }
};

/**
 * Fragezeichen-Button mit CSS-Tooltip (Formel fett, Kurztext darunter).
 * @param {{ formula: string, hint: string }|null} hint
 * @returns {string} HTML oder '' ohne hint
 */
export function renderCardHintHtml(hint) {
  if (!hint) return '';
  return `
    <button type="button" class="card-hint" aria-label="Berechnung">
      ${icon('question-mark-circle', { stroke: 1, size: 16 })}
      <span class="card-hint-tooltip" role="tooltip">
        <strong>${escapeHtml(hint.formula)}</strong>
        <span>${escapeHtml(hint.hint)}</span>
      </span>
    </button>`;
}

/**
 * Summary-Label plus optionales Info-Fragezeichen.
 * Das Icon bleibt im Label-Markup; CSS setzt es oben rechts in die Karte.
 * label wird bewusst nicht escaped — Aufrufer geben statische oder bereits
 * sanitizte Labels (z. B. Zusatzleistungs-Namen via validatorSystem).
 * @param {string} label
 * @param {{ formula: string, hint: string }|null} [hint]
 * @returns {string} HTML
 */
export function renderSummaryLabelHtml(label, hint = null) {
  if (!hint) return `<div class="summary-label">${label}</div>`;
  return `
    <div class="summary-label card-head">
      <span>${label}</span>
      ${renderCardHintHtml(hint)}
    </div>`;
}
