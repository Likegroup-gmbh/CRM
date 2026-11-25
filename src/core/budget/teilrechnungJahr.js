// teilrechnungJahr.js
// Jahreszuordnung des Investor-Dashboards: ein Auftrag verteilt Volumen und
// Kosten anteilig auf die Jahre seiner Teilrechnungen, statt komplett im
// Startjahr zu stehen.
//
// Jahr einer Teilrechnung = Jahr von min(max(rechnung_gestellt_am, start), ende):
//   - rechnung_gestellt_am ist auch bei vorbereiteten Raten gepflegt und gilt
//     dort als geplantes Datum. Ohne Datum: start + (position - 1) Monate.
//   - Vorab gestellte Raten zaehlen nicht ins Vorjahr, spaet datierte nicht
//     ueber das Laufzeitende hinaus. Ein ende vor start ist ein Datenfehler
//     und klemmt nicht.
//   - start ist auftrag.start, ersatzweise created_at.
// Gerechnet wird in Europe/Berlin: die Netlify-Function laeuft in UTC, der
// Browser-Fallback in Ortszeit, beide muessen dasselbe Jahr liefern.
//
// Die Monatsauswertung periodisiert weiter nach Rechnungsdatum (ADR 0006).

const BERLIN = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: 'numeric',
});

function zahl(v) {
  return parseFloat(v) || 0;
}

// Monat als fortlaufende Zahl (jahr * 12 + monat0), damit Klemmen und
// Monatsarithmetik ohne Datumsobjekte auskommen.
function berlinMonat(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  let jahr = null;
  let monat = null;
  for (const part of BERLIN.formatToParts(d)) {
    if (part.type === 'year') jahr = parseInt(part.value, 10);
    if (part.type === 'month') monat = parseInt(part.value, 10);
  }
  if (!Number.isFinite(jahr) || !Number.isFinite(monat)) return null;
  return jahr * 12 + (monat - 1);
}

function laufzeit(auftrag) {
  const start = berlinMonat(auftrag?.start || auftrag?.created_at);
  let ende = berlinMonat(auftrag?.ende);
  if (start == null || ende == null || ende < start) ende = null;
  return { start, ende };
}

function positionVon(tr, index) {
  if (tr?.position == null) return index + 1;
  const p = Number(tr.position);
  return Number.isFinite(p) ? p : index + 1;
}

function sortiertNachPosition(teilrechnungen) {
  const rang = tr => (tr?.position == null ? Number.MAX_SAFE_INTEGER : Number(tr.position) || 0);
  return [...(teilrechnungen || [])].sort((a, b) => rang(a) - rang(b));
}

export function auftragJahr(auftrag) {
  const { start } = laufzeit(auftrag);
  return start == null ? null : Math.floor(start / 12);
}

/**
 * @param {object} tr - auftrag_teilrechnung
 * @param {object} auftrag
 * @param {number} index - Platz in der nach position sortierten Liste (Fallback ohne position)
 * @returns {number|null}
 */
export function teilrechnungJahr(tr, auftrag, index = 0) {
  const { start, ende } = laufzeit(auftrag);
  let monat = berlinMonat(tr?.rechnung_gestellt_am);
  if (monat == null) {
    if (start == null) return null;
    monat = start + positionVon(tr, index) - 1;
  }
  if (start != null) monat = Math.max(monat, start);
  if (ende != null) monat = Math.min(monat, ende);
  return Math.floor(monat / 12);
}

/**
 * Anteil je Jahr = Netto der Teilrechnungen dieses Jahres / Netto aller
 * Teilrechnungen. Raten ohne Betrag gewichten nicht; ihre Ids haengen an der
 * Jahreszeile, sonst an der mit dem groessten Anteil (Kundenrechnungs-Summen
 * bleiben vollstaendig). Ohne Teilrechnungen oder Betrag: eine Zeile im
 * Startjahr mit Anteil 1.
 *
 * @returns {Array<{ jahr: number|null, anteil: number, teilrechnungIds: Array }>}
 */
export function jahresanteile(auftrag, teilrechnungen = []) {
  const trs = sortiertNachPosition(teilrechnungen);
  const gewichtJeJahr = new Map();
  const idsJeJahr = new Map();
  const ohneJahr = [];
  let summe = 0;

  trs.forEach((tr, index) => {
    const jahr = teilrechnungJahr(tr, auftrag, index);
    if (jahr == null) {
      ohneJahr.push(tr.id);
      return;
    }
    const gewicht = Math.max(zahl(tr.nettobetrag), 0);
    summe += gewicht;
    gewichtJeJahr.set(jahr, (gewichtJeJahr.get(jahr) || 0) + gewicht);
    if (!idsJeJahr.has(jahr)) idsJeJahr.set(jahr, []);
    idsJeJahr.get(jahr).push(tr.id);
  });

  if (summe <= 0) {
    return [{ jahr: auftragJahr(auftrag), anteil: 1, teilrechnungIds: trs.map(t => t.id) }];
  }

  const zeilen = [...gewichtJeJahr.entries()]
    .filter(([, gewicht]) => gewicht > 0)
    .sort(([a], [b]) => a - b)
    .map(([jahr, gewicht]) => ({ jahr, anteil: gewicht / summe, teilrechnungIds: idsJeJahr.get(jahr) }));

  const groesste = zeilen.reduce((max, z) => (z.anteil > max.anteil ? z : max), zeilen[0]);
  const jahreMitZeile = new Set(zeilen.map(z => z.jahr));
  idsJeJahr.forEach((ids, jahr) => {
    if (!jahreMitZeile.has(jahr)) groesste.teilrechnungIds.push(...ids);
  });
  groesste.teilrechnungIds.push(...ohneJahr);

  return zeilen;
}
