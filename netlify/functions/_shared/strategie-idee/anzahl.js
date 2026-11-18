// strategie-idee/anzahl.js
// Wie viele Ideen ein Auftrag will und wie er sich auf Laeufe verteilt
// (ein Produkt pro Lauf, es wird nicht gemischt).

const ANZAHL = 5;
const ANZAHL_MIN = 1;
const ANZAHL_MAX = 12;

/** job.input.anzahl: Integer, sonst 5, Clamp 1–12. Fehlend bleibt der alte Default. */
function normalisiereAnzahl(input) {
  const raw = input && typeof input === 'object' ? input.anzahl : undefined;
  if (raw == null || raw === '') return ANZAHL;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(n)) return ANZAHL;
  return Math.min(ANZAHL_MAX, Math.max(ANZAHL_MIN, n));
}

/**
 * Quoten aus job.input.proProdukt: [{ produkt_id, anzahl }].
 * Nur Produkte, die am Briefing haengen. Unbekannte IDs und Zahlen unter 1
 * fliegen raus, doppelte IDs addieren sich, die Summe wird auf ANZAHL_MAX
 * gekuerzt (frühere Eintraege behalten ihre Zahl).
 * Gibt null zurueck, wenn der Input keine proProdukt-Liste traegt.
 */
function normalisiereQuoten(input, produkte) {
  const raw = input && typeof input === 'object' ? input.proProdukt : undefined;
  if (!Array.isArray(raw)) return null;

  const bekannt = new Map((produkte || []).filter((p) => p?.id).map((p) => [p.id, p]));
  const summen = new Map();
  for (const eintrag of raw) {
    const id = eintrag?.produkt_id;
    if (!bekannt.has(id)) continue;
    const n = typeof eintrag.anzahl === 'number' ? eintrag.anzahl : Number(eintrag.anzahl);
    if (!Number.isInteger(n) || n < 1) continue;
    summen.set(id, (summen.get(id) || 0) + n);
  }

  let rest = ANZAHL_MAX;
  const quoten = [];
  for (const [id, n] of summen) {
    if (rest <= 0) break;
    const anzahl = Math.min(n, rest);
    quoten.push({ produkt: bekannt.get(id), anzahl });
    rest -= anzahl;
  }
  return quoten;
}

/**
 * Laeufe eines Auftrags: pro Lauf ein Produkt (oder keins) und eine Zahl.
 * - proProdukt im Input: ein Lauf pro Quote.
 * - sonst bei genau einem Produkt: ein Lauf fuer dieses Produkt.
 * - sonst ohne Produkt: ein Lauf nur aus dem Briefing.
 * - sonst (mehrere Produkte, keine Quote): Fehler, es wird nicht gemischt.
 * @returns {Array<{ produkt: object|null, anzahl: number }>}
 */
function planeLaeufe({ input, produkte } = {}) {
  const quoten = normalisiereQuoten(input, produkte);
  if (quoten) {
    if (!quoten.length) throw new Error('Keine gültige Produkt-Zuordnung im Auftrag');
    return quoten;
  }
  const liste = (produkte || []).filter(Boolean);
  if (liste.length > 1) {
    throw new Error('Das Briefing hat mehrere Produkte: bitte pro Produkt eine Anzahl angeben');
  }
  return [{ produkt: liste[0] || null, anzahl: normalisiereAnzahl(input) }];
}

module.exports = { ANZAHL, ANZAHL_MIN, ANZAHL_MAX, normalisiereAnzahl, normalisiereQuoten, planeLaeufe };
