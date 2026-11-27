// reelAuswahl.js
// Rechenlogik der Admin-Seite Instagram-CPM (ADR 0087), ohne DOM und Netzwerk.
//
// Ablauf: Aus den Kandidaten (vorgefiltert, neueste zuerst) wird die typische Range des
// Creators bestimmt. Was deutlich darueber liegt (Viral-Hit) oder extrem darunter (5 Views
// bei 300K Median), wird als Ausreisser vorgeschlagen und abgewaehlt. Der Mitarbeiter kann
// jede Kachel an- und abwaehlen. Gerechnet wird erst auf "Berechnen" und nur mit dem, was
// ausgewaehlt ist: die 30 neuesten ausgewaehlten Reels bilden den 30er, die 12 neuesten davon
// den 12er. Wer ein Reel abwaehlt, zieht so automatisch das naechstaeltere nach.
//
// Range: Median M, Quartile Q1 und Q3 (typische Range Q1 bis Q3). Die Obergrenze ist der
// Tukey-Zaun auf der log-Skala, Q3 * (Q3/Q1)^k, eingeklemmt zwischen M * mindestFaktor und
// M * hoechstFaktor. Auf der log-Skala, weil Views multiplikativ streuen: bei einer engen
// Creatorin (200K-300K) faellt ein 700K-Reel, bei breiter Streuung erst deutlich spaeter.
// Nach unten zaehlt nur der Extremfall unter floorProzent des Medians.

import { berechnePreisAusViews, DEFAULT_TKP } from '../../modules/creator-auswahl/castingPreisZellen.js';

export const FENSTER_KURZ = 12;
export const FENSTER_LANG = 30;
// Die Range kommt aus den 30 neuesten Kandidaten, unabhaengig von der Auswahl
export const RANGE_BASIS = FENSTER_LANG;
export const MIN_STICHPROBE = 5;

export const REGELN_STANDARD = Object.freeze({
  mindestFaktor: 2,
  tukeyK: 1.5,
  hoechstFaktor: 5,
  floorProzent: 5,
});

const positivOder = (wert, standard) => {
  const n = Number(wert);
  return Number.isFinite(n) && n >= 0 ? n : standard;
};

/** Unvollstaendige oder kaputte Regelwerte fallen auf den Standard zurueck. */
export function regelnAus(regeln = {}) {
  return Object.fromEntries(Object.entries(REGELN_STANDARD)
    .map(([key, standard]) => [key, positivOder(regeln[key], standard)]));
}

/** Quantil mit linearer Interpolation, sortiert aufsteigend */
export function quantil(sortiert, p) {
  if (!sortiert.length) return null;
  const pos = (sortiert.length - 1) * p;
  const unten = Math.floor(pos);
  const oben = Math.ceil(pos);
  return sortiert[unten] + (sortiert[oben] - sortiert[unten]) * (pos - unten);
}

/**
 * Typische Range und Grenzen aus einer Views-Reihe.
 * @param {number[]} views
 * @returns {{ n:number, median:number, q1:number, q3:number, oben:number, unten:number }|null}
 *   null unter MIN_STICHPROBE Werten oder bei Median 0: dann wird nichts vorgeschlagen.
 */
export function typischeRange(views, regeln = REGELN_STANDARD) {
  const r = regelnAus(regeln);
  const sortiert = (views || []).filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
  if (sortiert.length < MIN_STICHPROBE) return null;
  const median = quantil(sortiert, 0.5);
  if (!(median > 0)) return null;
  const q1 = quantil(sortiert, 0.25);
  const q3 = quantil(sortiert, 0.75);
  const tukey = q1 > 0 ? q3 * (q3 / q1) ** r.tukeyK : Infinity;
  const oben = Math.min(Math.max(median * r.mindestFaktor, tukey), median * Math.max(r.hoechstFaktor, r.mindestFaktor));
  return {
    n: sortiert.length,
    median,
    q1,
    q3,
    oben,
    unten: median * (r.floorProzent / 100),
  };
}

/** Range aus den RANGE_BASIS neuesten Kandidaten */
export function rangeFuer(reels, regeln = REGELN_STANDARD) {
  return typischeRange((reels || []).slice(0, RANGE_BASIS).map((r) => r.views), regeln);
}

/**
 * Ausreisser-Vorschlag ueber alle Kandidaten, auch die aelteren Nachruecker.
 * @returns {Map<string, 'hoch'|'flop'>} Reel-ID -> Seite
 */
export function vorschlag(reels, range) {
  const treffer = new Map();
  if (!range) return treffer;
  (reels || []).forEach((reel) => {
    if (reel.views > range.oben) treffer.set(reel.id, 'hoch');
    else if (reel.views < range.unten) treffer.set(reel.id, 'flop');
  });
  return treffer;
}

/**
 * Nachruecken: die neuesten nicht abgewaehlten Reels fuellen die Fenster.
 * @param {object[]} reels neueste zuerst
 * @param {Set<string>} abgewaehlt
 * @returns {{ kurz: string[], lang: string[] }} Reel-IDs
 */
export function fenster(reels, abgewaehlt = new Set()) {
  const lang = (reels || []).filter((r) => !abgewaehlt.has(r.id)).slice(0, FENSTER_LANG).map((r) => r.id);
  return { kurz: lang.slice(0, FENSTER_KURZ), lang };
}

function auswertung(liste, ziel, tkp) {
  const summe = liste.reduce((acc, r) => acc + r.views, 0);
  const schnitt = liste.length ? Math.round(summe / liste.length) : null;
  return {
    ziel,
    anzahl: liste.length,
    vollstaendig: liste.length === ziel,
    summe,
    schnitt,
    tkp,
    preis: berechnePreisAusViews(schnitt, tkp),
    reels: liste,
  };
}

/**
 * 12er und 30er aus der aktuellen Auswahl. Der Preis rechnet mit dem gerundeten Schnitt,
 * damit der angezeigte Rechenweg auf den Cent aufgeht.
 */
export function berechne(reels, abgewaehlt = new Set(), tkp = DEFAULT_TKP) {
  const satz = Number(tkp) > 0 ? Number(tkp) : DEFAULT_TKP;
  const { kurz, lang } = fenster(reels, abgewaehlt);
  const nachId = new Map((reels || []).map((r) => [r.id, r]));
  const hole = (ids) => ids.map((id) => nachId.get(id));
  return {
    kurz: auswertung(hole(kurz), FENSTER_KURZ, satz),
    lang: auswertung(hole(lang), FENSTER_LANG, satz),
  };
}
