// teilrechnungVerteilung.js
// Wie viel des Angebotsnettos auf Teilrechnungen verteilt ist. Netto und
// Teilrechnungen sind entkoppelt: Netto darf hoeher sein (Rest noch nicht
// verteilt) oder niedriger (Teilrechnungen uebersteigen das Angebot).

import { formatEuro } from '../format.js';

const TOLERANZ = 0.05;

function betrag(v) {
  return parseFloat(v) || 0;
}

function runden(v) {
  return Math.round(v * 100) / 100;
}

function hatWert(v) {
  return v !== undefined && v !== null && v !== '';
}

// Wie rechnungsstatus: das Datum ist massgeblich, das Flag nur Fallback.
function istGestellt(tr) {
  return hatWert(tr?.rechnung_gestellt_am) || Boolean(tr?.rechnung_gestellt)
    || hatWert(tr?.ueberwiesen_am) || Boolean(tr?.ueberwiesen);
}

/**
 * @param {number|string} netto - Angebotsnetto des Auftrags
 * @param {Array} teilrechnungen - je { nettobetrag, rechnung_gestellt(_am), ueberwiesen(_am) }
 */
export function verteilungsStand(netto, teilrechnungen = []) {
  const trs = Array.isArray(teilrechnungen) ? teilrechnungen : [];
  const n = runden(betrag(netto));
  const verteilt = runden(trs.reduce((sum, tr) => sum + betrag(tr?.nettobetrag), 0));
  const gestelltTrs = trs.filter(istGestellt);
  const differenz = runden(n - verteilt);

  return {
    netto: n,
    verteilt,
    offen: differenz > TOLERANZ ? differenz : 0,
    ueberschuss: differenz < -TOLERANZ ? -differenz : 0,
    prozent: n > 0 ? (verteilt / n) * 100 : null,
    gestellt: runden(gestelltTrs.reduce((sum, tr) => sum + betrag(tr?.nettobetrag), 0)),
    gestelltAnzahl: gestelltTrs.length,
    anzahl: trs.length
  };
}

// Ein offener Rest darf nie als "100 %" erscheinen.
function formatProzent(p) {
  const gerundet = Math.min(Math.round(p * 10) / 10, 99.9);
  return `${gerundet.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} %`;
}

/**
 * Hinweistext unter dem Netto-Feld.
 * @returns {{ ton: 'info'|'warnung', text: string }|null}
 */
export function verteilungsHinweis(stand) {
  if (!stand || stand.anzahl === 0 || stand.netto <= 0) return null;

  if (stand.ueberschuss > 0) {
    return {
      ton: 'warnung',
      text: `Teilrechnungen übersteigen das Angebotsnetto um ${formatEuro(stand.ueberschuss)}`
    };
  }

  const gestelltText = stand.gestelltAnzahl > 0
    ? ` · davon ${stand.gestelltAnzahl} von ${stand.anzahl} gestellt (${formatEuro(stand.gestellt)})`
    : '';

  if (stand.offen > 0) {
    return {
      ton: 'info',
      text: `${formatProzent(stand.prozent)} (${formatEuro(stand.verteilt)}) auf Teilrechnungen verteilt · ${formatEuro(stand.offen)} noch offen${gestelltText}`
    };
  }

  return { ton: 'info', text: `100 % auf Teilrechnungen verteilt${gestelltText}` };
}
