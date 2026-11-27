// instagram-cpm.js
// Reine Rechenlogik fuer die CPM-Ermittlung aus Instagram-Media.
// Bewusst ohne Netzwerk/DB, damit sie direkt unit-testbar ist.
//
// Nur Videos/Reels tragen einen view_count. Bild-Posts und Karussells
// liefern das Feld nicht und werden vollstaendig ignoriert.
//
// Das zuletzt hochgeladene Video ist noch nicht "ausgereift": in den ersten
// Tagen laufen die Views weiter hoch. Alles juenger als MIN_AGE_HOURS faellt
// deshalb raus, gezaehlt wird ab dem naechstaelteren Video.
//
// Reels mit Werbe-Kennzeichnung in der Caption fallen ebenfalls raus: bezahlte
// Kooperationen laufen ueber Anzeigenbudget und Collab-Reichweite und sagen
// nichts ueber die organische Reichweite des Creators aus. Ein offizielles
// Flag gibt Meta fuer fremde Profile nicht her (collaborators und
// is_paid_partnership brauchen einen Owner-Token, is_shared_to_feed und
// media_product_type lehnt Business Discovery mit Fehlercode 100 ab), deshalb
// bleibt nur die Caption.
//
// Trial-Reels, die nie graduiert werden, faengt die Caption-Logik nicht: sie
// tauchen genau einmal auf, mit winzigen Views, weil sie nur an Non-Follower
// ausgespielt werden. Sie werden deshalb per View-Luecke MARKIERT
// (findeTrialLuecke), aber nicht verworfen: computeInstagramCpm rechnet dual -
// Variante A ueber alle Reels (bisheriges Verhalten, bleibt in den
// Bestandsspalten), Variante B ohne die markierten Trials (ig_stats.ohne_trials,
// nur wenn das Gate aktiv war).

const CPM_RATE = 25;        // EUR pro 1000 Views
const MIN_AGE_HOURS = 96;   // Videos juenger als 4 Tage ignorieren
const WINDOW_SHORT = 12;
const WINDOW_LONG = 30;

// Ausreisser-Erkennung als Prozessregel statt als Statistik: die Reihe wird
// sortiert, dann werden nur die beiden Randwerte gegen ihren direkten Nachbarn
// geprueft. Hat der hoechste Wert mindestens doppelt so viele Views wie der
// zweithoechste, faellt er; hat der zweitniedrigste mindestens doppelt so viele
// wie der niedrigste, faellt der niedrigste. Mehr als ein Reel je Seite faellt
// pro Durchlauf nie.
//
// Ein durchgefallener Reel wird nicht einfach abgezogen, sondern durch den
// naechst-aelteren organischen Reel ersetzt (pickWindow). Damit bleibt die
// Stichprobe konstant bei 12 bzw. 30 Reels, statt bei jedem Ausreisser zu
// schrumpfen.
//
// Der Vorgaenger (modifizierter Z-Score ueber Median/MAD auf log10) war
// mathematisch saubere Ausreisser-Erkennung, hat aber bei realen Accounts
// praktisch nie ausgeloest: bei breit gestreuten Views liegt selbst ein
// Millionen-Reel noch unter Z = 2,5. Die Nachbarschaftsregel greift dafuer
// nachvollziehbar und laesst sich Kunden in zwei Saetzen erklaeren.
const OUTLIER_RATIO = 2.0;
const OUTLIER_MIN_SAMPLE = 5;

// Werbe-Kennzeichnungen in der Caption. \b haelt #ad von #adidas und
// #adventskalender fern.
const AD_HASHTAGS = [
  'werbung', 'anzeige', 'ad', 'ads', 'sponsored', 'sponsoredpost',
  'paidpartnership', 'bezahltepartnerschaft', 'werbepartner', 'werbevideo',
  'kooperation', 'collab', 'collabpost', 'affiliate'
];
const AD_HASHTAG_RE = new RegExp(`#(${AD_HASHTAGS.join('|')})\\b`, 'i');
const AD_PHRASE_RE = /paid partnership|bezahlte partnerschaft|in kooperation mit|anzeige\s*\||werbung\s*\|/i;

// Geschenkte Produkte ohne Bezahlung. Bewusst nicht aktiv: die Reichweite so
// eines Reels ist organisch. Zum Zuschalten in istWerbePost aufnehmen.
const GESCHENK_HASHTAGS = ['gifted', 'geschenkt', 'prsample', 'pr'];

// Trial-/Ghost-Reels: Meta gibt fuer fremde Profile kein Flag her, sichtbar
// ist nur die Doppelung - dieselbe Creative wird als Trial an Non-Follower
// ausgespielt und spaeter als Reel aufs Grid gehoben. Beide landen mit
// view_count in der Media-Liste und wuerden sonst zwei Slots im Fenster
// belegen. Erkannt wird ueber die Caption: gleicher Text in kurzem Abstand
// heisst gleiche Creative. Behalten wird der neuere Upload (der auf dem Grid),
// nicht der mit den mehr Views - ein frisches Final startet bei 0, waehrend
// der Trial schon Tage gelaufen ist.
const TRIAL_EXACT_MIN_LEN = 24;      // Zeichen der normalisierten Caption
const TRIAL_EXACT_MAX_GAP_DAYS = 14;
const TRIAL_FUZZY_MIN_LEN = 40;      // laengere Texte, sonst trifft jeder Hook
const TRIAL_FUZZY_MAX_GAP_DAYS = 7;
const TRIAL_FUZZY_JACCARD = 0.85;

// Trial-Flut per View-Luecke (findeTrialLuecke): bei Accounts, deren reguläre
// Reels hoch sechsstellig laufen, liegt ein klar getrennter Boden-Cluster aus
// Trials vor (3K vs. 600K). Der Split emergiert aus den Daten selbst, kein
// starrer Prozentsatz - so funktioniert es auch, wenn Trials mehr als die
// Haelfte der Posts stellen und den Median kaputt machen wuerden.
const TRIAL_GAP_RATIO = 3;           // min. Nachbar-Verhaeltnis am Splitpunkt.
                                     // Bewusst moderat: aeltere Reels mit
                                     // Mittelfeld-Views zerlegen eine grosse
                                     // Luecke in kleine Nachbarschritte
                                     // (carodaur: 62x gesamt, aber kein
                                     // einzelner 5x-Sprung) - die Trennschaerfe
                                     // uebernimmt der Boden-Check unten.
const TRIAL_MIN_CLUSTER = 3;         // min. Videos im Boden-Cluster ("hohe Stueckzahl")
const TRIAL_MIN_REGULAR = OUTLIER_MIN_SAMPLE; // min. Videos oberhalb des Splits
// Account-Gate statt Follower-Schalter: unter 50K regulaerem Median sind
// niedrige Views normaler Content, der Mechanismus bleibt komplett aus.
const TRIAL_MIN_REGULAR_MEDIAN = 50000;
// Doppelt genutzt: am Split muss der Median des Bodens unter 5 % des
// regulaeren Medians liegen (der Boden als Ganzes ist winzig, nicht nur
// einzelne Reels - das haelt Viral-Hit-Splits und echte Flop-Cluster fern),
// und markiert wird final pro Video unter 5 %. Trennt bei 600K-Median die
// 3-8K-Trials vom echten 50K-Flop.
const TRIAL_MAX_PCT = 0.05;

// Version der Rechenlogik. Landet in ig_stats.calc_version; eine aeltere
// Version im Creator-Pool gilt als veraltet und erzwingt einen neuen Abruf.
// 8: die Rechnung sieht nur noch die letzten 30 Beitraege, nicht mehr bis zu 150.
// 9: Engagement-Rate ohne Werbung, frische Posts und Ausreisser; TikTok auf Views (instagram-engagement.js).
// 10: kurzes Fenster 12 statt 8 Reels (views_12, used_12, outliers_12).
const CALC_VERSION = 10;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Werbe-Kennzeichnung in einer Caption erkennen.
 *
 * Rueckgabe ist der konkret gefundene Marker (`"#werbung"`, `"paid partnership"`
 * usw.), damit im Debug-Log direkt sichtbar ist warum ein Reel als Werbung
 * eingestuft wurde. Bei nichts gefunden -> null.
 *
 * @param {string|null|undefined} caption
 * @returns {string|null}
 */
function istWerbePost(caption) {
  const text = typeof caption === 'string' ? caption : '';
  if (!text) return null;
  const hashtagMatch = text.match(AD_HASHTAG_RE);
  if (hashtagMatch) return hashtagMatch[0].toLowerCase();
  const phraseMatch = text.match(AD_PHRASE_RE);
  if (phraseMatch) return phraseMatch[0].toLowerCase();
  return null;
}

/**
 * Caption fuer den Duplikat-Vergleich normalisieren. URLs, Mentions und
 * Hashtags fallen weg: Creators aendern beim Re-Upload oft genau diese
 * Anhaengsel, der eigentliche Text bleibt. Leere oder sehr kurze Captions
 * taugen nicht als Fingerabdruck und werden vom Aufrufer ignoriert.
 *
 * @param {string|null|undefined} caption
 * @returns {string}
 */
function normCaption(caption) {
  return String(caption || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/@[\w.]+/g, ' ')
    .replace(/#[\p{L}\p{N}_]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Jaccard-Aehnlichkeit der Wortmengen zweier normalisierter Captions */
function captionJaccard(a, b) {
  const setA = new Set(a.split(' ').filter(Boolean));
  const setB = new Set(b.split(' ').filter(Boolean));
  if (!setA.size || !setB.size) return 0;
  let schnitt = 0;
  for (const wort of setA) if (setB.has(wort)) schnitt += 1;
  return schnitt / (setA.size + setB.size - schnitt);
}

/**
 * Zwei Reels als Trial-Paar erkennen: dieselbe Creative in kurzem Abstand.
 * Exact reicht fuer den Normalfall (Caption 1:1 uebernommen), fuzzy faengt
 * leicht umgeschriebene Captions. Beide Stufen brauchen Mindestlaenge und
 * ein Zeitfenster, damit Serien mit gleichem Hook nicht zusammenkleben.
 *
 * @returns {boolean}
 */
function istTrialPaar(a, b) {
  const gapDays = Math.abs(a.postedAt - b.postedAt) / DAY_MS;
  const normA = normCaption(a.caption);
  const normB = normCaption(b.caption);

  if (normA.length >= TRIAL_EXACT_MIN_LEN && normA === normB
      && gapDays <= TRIAL_EXACT_MAX_GAP_DAYS) {
    return true;
  }

  if (normA.length >= TRIAL_FUZZY_MIN_LEN && normB.length >= TRIAL_FUZZY_MIN_LEN
      && gapDays <= TRIAL_FUZZY_MAX_GAP_DAYS
      && captionJaccard(normA, normB) >= TRIAL_FUZZY_JACCARD) {
    return true;
  }

  return false;
}

/**
 * Trial-Duplikate in einer Liste von Video-Entries markieren.
 * Laueft transitiv: drei Uploads derselben Creative bilden einen Cluster,
 * behalten wird der neueste Timestamp. Rueckgabe ist die Menge der
 * zu verwerfenden Indizes in `videos`.
 *
 * @param {Array} videos Video-Entries mit caption und postedAt
 * @returns {Set<number>}
 */
function findeTrialDuplikate(videos) {
  const drop = new Set();
  for (let i = 0; i < videos.length; i += 1) {
    if (drop.has(i)) continue;
    for (let j = i + 1; j < videos.length; j += 1) {
      if (drop.has(j)) continue;
      if (!istTrialPaar(videos[i], videos[j])) continue;
      // Der juengere bleibt, der aeltere faellt
      const aelter = videos[i].postedAt >= videos[j].postedAt ? j : i;
      drop.add(aelter);
    }
  }
  return drop;
}

/** Median einer Zahlenliste (robust gegen Ausreisser, anders als der Schnitt) */
function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mitte = s.length >> 1;
  return s.length % 2 ? s[mitte] : (s[mitte - 1] + s[mitte]) / 2;
}

/**
 * Trial-Cluster ueber die View-Luecke erkennen: Trials, die nie graduiert
 * sind, fallen nicht als Caption-Duplikat auf, wohl aber als Boden-Cluster
 * mit winzigen Views (Non-Follower-Testlauf), klar getrennt vom regulaeren
 * Niveau des Accounts.
 *
 * Vorgehen (Kandidaten-Scan statt erstem Treffer):
 * 1. Views aufsteigend sortieren. Jeder Split mit unten >= TRIAL_MIN_CLUSTER
 *    und oben >= TRIAL_MIN_REGULAR Videos ist Kandidat, wenn das
 *    Nachbar-Verhaeltnis >= TRIAL_GAP_RATIO liegt.
 * 2. Account-Gate je Kandidat: der Median der oberen Seite muss >=
 *    TRIAL_MIN_REGULAR_MEDIAN liegen (kleine Creator bleiben komplett aus).
 * 3. Boden-Check je Kandidat: der Median der UNTEREN Seite muss unter
 *    TRIAL_MAX_PCT des regulaeren Medians liegen. Der Boden muss also als
 *    Ganzes winzig sein, nicht nur einzelne Reels - das haelt Viral-Hit-
 *    Splits (oben 5M+, unten normale 200-800K) und echte Flop-Cluster fern
 *    und erlaubt gleichzeitig Mittelfeld-Stufen zwischen Boden und Split.
 * 4. Gewaehlt wird der Kandidat mit der groessten lokalen Luecke (die
 *    deutlichste Trennstelle).
 * 5. Markiert wird pro Video: views < TRIAL_MAX_PCT * reg_median. So bleibt
 *    der 50K-Flop auch dann regulaer, wenn der Split unter ihm liegt.
 *
 * Die Funktion entscheidet nur, markiert wird in classifyVideos.
 *
 * @param {Array} videos included-Entries (organisch, alt genug, keine Duplikate)
 * @returns {{aktiv: boolean, grund: string|null, markiert: Set<number>,
 *   gap_ratio: number|null, reg_median: number|null, boden_median: number|null,
 *   schwelle: number|null, cluster_size: number}}
 */
function findeTrialLuecke(videos) {
  const inaktiv = (grund) => ({
    aktiv: false,
    grund,
    markiert: new Set(),
    gap_ratio: null,
    reg_median: null,
    boden_median: null,
    schwelle: null,
    cluster_size: 0
  });

  if (!Array.isArray(videos) || videos.length < TRIAL_MIN_CLUSTER + TRIAL_MIN_REGULAR) {
    return inaktiv('zu wenige Videos fuer eine Lueckenpruefung');
  }

  const sortiert = videos
    .map((v, index) => ({ views: v.views, index }))
    .sort((a, b) => a.views - b.views);

  let bester = null;
  let lueckeGesehen = false;
  let maxRegMedian = 0;
  let minBodenPct = Infinity;
  for (let i = TRIAL_MIN_CLUSTER - 1; i < sortiert.length - TRIAL_MIN_REGULAR; i += 1) {
    const unten = sortiert[i].views;
    const oben = sortiert[i + 1].views;
    const ratio = unten > 0 ? oben / unten : (oben > 0 ? Infinity : 1);
    if (ratio < TRIAL_GAP_RATIO) continue;
    lueckeGesehen = true;

    const regMedian = median(sortiert.slice(i + 1).map((s) => s.views));
    if (regMedian > maxRegMedian) maxRegMedian = regMedian;
    if (regMedian < TRIAL_MIN_REGULAR_MEDIAN) continue;

    const bodenMedian = median(sortiert.slice(0, i + 1).map((s) => s.views));
    const bodenPct = bodenMedian / regMedian;
    if (bodenPct < minBodenPct) minBodenPct = bodenPct;
    if (bodenMedian >= TRIAL_MAX_PCT * regMedian) continue;

    if (!bester || ratio > bester.ratio) {
      bester = { ratio, regMedian, bodenMedian };
    }
  }

  if (!bester) {
    if (!lueckeGesehen) return inaktiv(`keine View-Luecke >= ${TRIAL_GAP_RATIO}x`);
    if (maxRegMedian < TRIAL_MIN_REGULAR_MEDIAN) {
      return inaktiv(`reg_median ${Math.round(maxRegMedian)} < ${TRIAL_MIN_REGULAR_MEDIAN}`);
    }
    return inaktiv(`Boden zu hoch: boden_median bei ${Math.round(minBodenPct * 100)}% reg_median (>= ${TRIAL_MAX_PCT * 100}%)`);
  }

  const schwelle = TRIAL_MAX_PCT * bester.regMedian;
  const markiert = new Set();
  for (const s of sortiert) {
    if (s.views < schwelle) markiert.add(s.index);
  }
  if (markiert.size < TRIAL_MIN_CLUSTER) {
    return inaktiv(`nur ${markiert.size} Videos unter der Schwelle`);
  }

  return {
    aktiv: true,
    grund: null,
    markiert,
    gap_ratio: bester.ratio,
    reg_median: bester.regMedian,
    boden_median: bester.bodenMedian,
    schwelle,
    cluster_size: markiert.size
  };
}

/**
 * trial_gate als JSON-sicheres Objekt (Set und Infinity muessen raus).
 * Eine Stelle fuer computeInstagramCpm und instagram-connect, damit Pool,
 * creator-Tabelle und Report dieselbe Form sehen.
 */
function serialisiereTrialGate(gate) {
  if (!gate) return null;
  return {
    aktiv: gate.aktiv === true,
    grund: gate.grund || null,
    reg_median: gate.reg_median != null ? Math.round(gate.reg_median) : null,
    boden_median: gate.boden_median != null ? Math.round(gate.boden_median) : null,
    gap_ratio: Number.isFinite(gate.gap_ratio)
      ? Math.round(gate.gap_ratio * 100) / 100
      : null,
    schwelle: gate.schwelle != null ? Math.round(gate.schwelle) : null,
    cluster_size: gate.cluster_size || 0
  };
}

/**
 * Videos klassifizieren: auswertbar vs. aussortiert.
 * Aussortiert werden Videos mit Werbe-Kennzeichnung (ad_post), die aeltere
 * Haelfte eines Trial-Duplikats (trial_duplicate) und Videos juenger als
 * MIN_AGE_HOURS (too_recent). Videos ohne view_count und Nicht-Videos werden
 * nicht in skipped gefuehrt.
 *
 * Reihenfolge ist entscheidend:
 * 1. Werbung zuerst: ein bezahlter Reel sagt nichts ueber organische
 *    Reichweite, egal ob er zusaetzlich ein Duplikat ist.
 * 2. Trial-Paare vor der Altersregel und ueber die frischen Reels hinweg:
 *    das Final ist oft juenger als 96h und wuerde sonst als too_recent
 *    ausfallen, waehrend der aeltere Trial ins Fenster rueckt. Der
 *    Duplikat-Check sieht das Paar nur, wenn beide Seiten noch im Rennen
 *    sind. Der juengere Upload bleibt - ist er zu frisch, faellt er danach
 *    regulär als too_recent und der naechste organische Reel rueckt nach.
 * 3. Erst dann die Altersregel.
 * 4. Zuletzt die View-Luecke auf dem Rest: so kann ein frischer Reel nie
 *    als Trial markiert werden (er ist laengst too_recent) und Werbung
 *    verfaelscht weder Median noch Luecke. Markiert heisst nicht verworfen:
 *    die Eintraege bleiben in included, damit Variante A unveraendert
 *    rechnet; Variante B filtert sie erst in computeInstagramCpm.
 *
 * @param {Array} media
 * @param {number} now
 */
function classifyVideos(media, now) {
  const cutoff = now - MIN_AGE_HOURS * HOUR_MS;
  const included = [];
  const skipped = [];
  let nonVideoSkipped = 0;

  // Erst sammeln, dann paaren: der Duplikat-Check braucht die Gesamtmenge,
  // auch die Reels, die danach als zu frisch ausfallen.
  const entries = [];
  for (const m of media || []) {
    if (!m) continue;
    if (m.media_type !== 'VIDEO') {
      nonVideoSkipped += 1;
      continue;
    }

    const views = Number(m.view_count);
    const postedAt = Date.parse(m.timestamp);
    if (!Number.isFinite(views) || views < 0 || !Number.isFinite(postedAt)) {
      continue;
    }

    const ageHours = Math.round((now - postedAt) / HOUR_MS);
    const entry = {
      id: m.id || null,
      permalink: m.permalink || null,
      timestamp: m.timestamp || null,
      postedAt,
      views,
      age_hours: ageHours,
      caption: m.caption || null
    };

    // ad_marker setzt ein Aufrufer, der ein echtes Werbe-Flag hat (TikTok: isAd/isSponsored)
    const adMarker = m.ad_marker || istWerbePost(m.caption);
    if (adMarker) {
      skipped.push({ ...entry, reason: 'ad_post', ad_marker: adMarker });
    } else {
      entries.push(entry);
    }
  }

  // Trial-Duplikate: aeltere Haelfte jedes Paars faellt, bevor das Alter
  // ueberhaupt geprueft wird.
  const trialDrops = findeTrialDuplikate(entries);
  entries.forEach((entry, index) => {
    if (trialDrops.has(index)) {
      skipped.push({ ...entry, reason: 'trial_duplicate', ad_marker: null });
    } else if (entry.postedAt > cutoff) {
      skipped.push({ ...entry, reason: 'too_recent', ad_marker: null });
    } else {
      included.push(entry);
    }
  });

  included.sort((a, b) => b.postedAt - a.postedAt);
  skipped.sort((a, b) => b.postedAt - a.postedAt);

  // 4. Stufe: Trial-Flut per View-Luecke markieren (bleibt in included!)
  const trialGate = findeTrialLuecke(included);
  if (trialGate.aktiv) {
    included.forEach((entry, index) => {
      if (!trialGate.markiert.has(index)) return;
      entry.trial_views = true;
      entry.trial_detail = {
        gap_ratio: Number.isFinite(trialGate.gap_ratio)
          ? Math.round(trialGate.gap_ratio * 100) / 100
          : null,
        reg_median: Math.round(trialGate.reg_median),
        schwelle: Math.round(trialGate.schwelle)
      };
    });
  }

  return { included, skipped, nonVideoSkipped, trialGate };
}

/** Videos mit belastbarem view_count, neueste zuerst */
function selectVideos(media, now) {
  return classifyVideos(media, now).included;
}

function average(values) {
  if (!values.length) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

/**
 * Ausreisser in einer Views-Reihe finden.
 *
 * Die Reihe wird aufsteigend sortiert, danach werden nur die beiden Randwerte
 * gegen ihren direkten Nachbarn geprueft:
 *   - hoechster Wert / zweithoechster Wert >= OUTLIER_RATIO -> hoechster faellt
 *   - zweitniedrigster Wert / niedrigster Wert >= OUTLIER_RATIO -> niedrigster faellt
 *
 * Es faellt hoechstens ein Wert oben und einer unten. Normale Schwankungen
 * gehoeren zur Performance eines Creators und bleiben Teil der Rechnung -
 * ausgeschlossen wird nur der offensichtliche Einzelfall.
 *
 * Bewusste Eigenschaft: zwei aehnlich hohe Spitzen decken sich gegenseitig
 * (900k und 1M haben Verhaeltnis 1,11), dann faellt nichts. Das ist der Preis
 * fuer eine Regel, die sich ohne Statistikkenntnisse nachrechnen laesst.
 *
 * @param {number[]} values Views, Reihenfolge egal
 * @returns {{indices: Set<number>, details: Array<{index:number,views:number,side:'high'|'low',ratio:number}>}}
 */
function detectOutliers(values) {
  const empty = { indices: new Set(), details: [] };
  if (!Array.isArray(values) || values.length < OUTLIER_MIN_SAMPLE) return empty;

  // Auf den sortierten Kopien rechnen, aber die Original-Indizes zurueckgeben:
  // evaluateWindow braucht sie, um den Reel zum Wert zu finden.
  const sortiert = values
    .map((views, index) => ({ views, index }))
    .sort((a, b) => a.views - b.views);

  const n = sortiert.length;
  const niedrigster = sortiert[0];
  const zweitniedrigster = sortiert[1];
  const hoechster = sortiert[n - 1];
  const zweithoechster = sortiert[n - 2];

  const indices = new Set();
  const details = [];

  // Division durch 0 abfangen: ein Reel mit 0 Views ist gegenueber jedem
  // Nachbarn mit Views ein Ausreisser nach unten.
  const verhaeltnis = (oben, unten) => {
    if (unten > 0) return oben / unten;
    return oben > 0 ? Infinity : 1;
  };

  const ratioHigh = verhaeltnis(hoechster.views, zweithoechster.views);
  if (ratioHigh >= OUTLIER_RATIO) {
    indices.add(hoechster.index);
    details.push({
      index: hoechster.index,
      views: hoechster.views,
      side: 'high',
      ratio: ratioHigh
    });
  }

  const ratioLow = verhaeltnis(zweitniedrigster.views, niedrigster.views);
  if (ratioLow >= OUTLIER_RATIO) {
    indices.add(niedrigster.index);
    details.push({
      index: niedrigster.index,
      views: niedrigster.views,
      side: 'low',
      ratio: ratioLow
    });
  }

  details.sort((a, b) => b.views - a.views);
  return { indices, details };
}

/** Views -> Preis in EUR, auf Cent gerundet */
function toCpm(views) {
  if (views == null) return null;
  return Math.round((views / 1000) * CPM_RATE * 100) / 100;
}

function roundViews(views) {
  return views == null ? null : Math.round(views);
}

/**
 * Fenster mit genau `size` sauberen Reels zusammenstellen.
 *
 * Startet mit den ersten `size` Reels. Faellt ein Reel als Ausreisser durch,
 * bleibt er dauerhaft draussen und der naechst-aeltere Reel rueckt nach. Danach
 * wird erneut geprueft, denn der Nachruecker kann selbst ein neues Rand-Extrem
 * sein. So bleibt die Stichprobengroesse konstant, statt bei jedem Ausreisser
 * zu schrumpfen.
 *
 * Das Fenster wird als Liste von Indizes in `videos` gefuehrt: detectOutliers
 * kennt nur Positionen innerhalb des Fensters, fuer die Ausreisser-Liste
 * brauchen wir aber den Reel im Original.
 *
 * Bewusst kein Verbreitern des Kandidatenpools: wuerde detectOutliers auf einem
 * gewachsenen Pool laufen, koennte ein bereits verworfener Ausreisser
 * zurueckkommen, weil der Nachruecker ihn deckt (1,64M / 669k = 2,46 faellt,
 * 1,64M / 771k = 2,13 faellt auch, aber irgendwann deckt einer den anderen).
 *
 * @param {Array} videos Organische Reels, neueste zuerst
 * @param {number} size  Zielgroesse des Fensters
 * @returns {{indices: number[], outliers: Array<{videoIndex:number,views:number,side:'high'|'low',ratio:number}>}}
 */
function pickWindow(videos, size) {
  if (!Array.isArray(videos) || videos.length < size) {
    return { indices: [], outliers: [] };
  }

  let fenster = [];
  for (let i = 0; i < size; i += 1) fenster.push(i);
  let naechster = size;
  const outliers = [];

  // Terminiert immer: jede Runde ohne break verbraucht mindestens einen
  // Nachruecker, und `naechster` ist durch videos.length begrenzt.
  for (;;) {
    const { indices, details } = detectOutliers(fenster.map((i) => videos[i].views));
    if (indices.size === 0) break;

    for (const d of details) {
      outliers.push({
        videoIndex: fenster[d.index],
        views: d.views,
        side: d.side,
        ratio: d.ratio
      });
    }
    fenster = fenster.filter((_, position) => !indices.has(position));

    while (fenster.length < size && naechster < videos.length) {
      fenster.push(naechster);
      naechster += 1;
    }
    // Vorrat erschoepft: mit dem kleineren Fenster rechnen ist ehrlicher, als
    // den Ausreisser wieder hereinzuholen.
    if (fenster.length < size) break;
  }

  return { indices: fenster, outliers };
}

/**
 * Ein Fenster auswerten: arithmetischer Schnitt aus `size` sauberen Reels.
 *
 * Liegen von Anfang an weniger als `size` Reels vor, gibt es keinen Wert - ein
 * "12er-Schnitt" aus 3 Videos waere irrefuehrend. Gehen erst beim Nachruecken
 * die Kandidaten aus, wird mit dem kleineren Fenster gerechnet und `sample`
 * weist die tatsaechliche Groesse aus.
 *
 * @param {Array} videos Organische Reels, neueste zuerst (vollstaendige Liste)
 * @param {number} size  Zielgroesse des Fensters
 */
function evaluateWindow(videos, size) {
  const { indices, outliers } = pickWindow(videos, size);
  if (!indices.length) {
    return { views: null, sample: 0, used: [], outliers: [], maxIndex: -1 };
  }

  return {
    views: average(indices.map((i) => videos[i].views)),
    sample: indices.length,
    used: indices,
    // Bis hierhin wurde in die Zeitleiste geschaut - inklusive Nachruecker, die
    // selbst wieder durchgefallen sind. formatCpmDebug (instagram-cpm-report.js)
    // braucht die Reels dazu.
    maxIndex: Math.max(...indices, ...outliers.map((o) => o.videoIndex)),
    outliers: outliers.map((o) => {
      const video = videos[o.videoIndex];
      return {
        views: o.views,
        timestamp: video?.timestamp || null,
        permalink: video?.permalink || null,
        side: o.side,
        // Infinity entsteht bei einem Nachbarn mit 0 Views und wuerde in JSON
        // zu null werden - dann lieber gleich null speichern
        ratio: Number.isFinite(o.ratio) ? Math.round(o.ratio * 100) / 100 : null
      };
    })
  };
}

/**
 * Kennzahlen aus einer Media-Liste der Business Discovery API.
 *
 * views_12 und views_30 sind der Schnitt aus genau 12 bzw. 30 sauberen Reels:
 * Ausreisser werden nicht einfach abgezogen, sondern durch den naechst-aelteren
 * organischen Reel ersetzt (siehe pickWindow). Was rausgefallen ist, steht in
 * outliers_12 / outliers_30, was verwendet wurde in used_12 / used_30.
 *
 * @param {Array} media   Rohe media.data-Eintraege
 * @param {object} [opts] { now: number } - Zeitbasis fuer die 4-Tage-Regel
 * @returns {{
 *   views_12: number|null, views_30: number|null,
 *   cpm_12: number|null, cpm_30: number|null,
 *   sample_12: number, sample_30: number,
 *   used_12: number[], used_30: number[],
 *   outliers_12: Array, outliers_30: Array,
 *   ohne_trials: object|null, trial_gate: object,
 *   videos_available: number, skipped_too_recent: number,
 *   skipped_ads: number, skipped_trials: number, skipped_trial_views: number,
 *   non_video_skipped: number,
 *   videos: Array, skipped_videos: Array, calc_version: number
 * }}
 * ohne_trials ist die Variante B (Fenster ohne per View-Luecke markierte
 * Trials) und null, solange das Gate inaktiv ist - dann gilt B = A.
 */
function computeInstagramCpm(media, opts = {}) {
  const now = opts.now ?? Date.now();
  const { included: videos, skipped, nonVideoSkipped, trialGate } = classifyVideos(media, now);

  // Die vollstaendige Liste uebergeben, nicht vorschneiden: pickWindow muss
  // ueber das Fenster hinaus nachruecken koennen.
  // Variante A: exakt das bisherige Verhalten - markierte Trials bleiben
  // enthalten, die Bestandsspalten (ig_views_*, cpm_ig_*) aendern sich nicht.
  const window12 = evaluateWindow(videos, WINDOW_SHORT);
  const window30 = evaluateWindow(videos, WINDOW_LONG);

  // Variante B: ohne die per View-Luecke markierten Trials. Nur wenn das Gate
  // aktiv war - sonst ist B per Definition identisch und bleibt null, damit
  // die UI weiss, dass es nichts Zweites anzuzeigen gibt.
  let ohneTrials = null;
  let bMaxIndexInVideos = -1;
  if (trialGate.aktiv) {
    const gefiltertIdx = [];
    const gefiltert = [];
    videos.forEach((v, i) => {
      if (!v.trial_views) {
        gefiltertIdx.push(i);
        gefiltert.push(v);
      }
    });
    const b12 = evaluateWindow(gefiltert, WINDOW_SHORT);
    const b30 = evaluateWindow(gefiltert, WINDOW_LONG);
    // used_* und maxIndex zeigen auf `gefiltert` - fuer eine einheitliche
    // Aufloesung ueber stats.videos auf die Indizes der vollen Liste mappen.
    const mapIdx = (arr) => arr.map((gi) => gefiltertIdx[gi]);
    ohneTrials = {
      views_12: roundViews(b12.views),
      views_30: roundViews(b30.views),
      cpm_12: toCpm(b12.views),
      cpm_30: toCpm(b30.views),
      sample_12: b12.sample,
      sample_30: b30.sample,
      used_12: mapIdx(b12.used),
      used_30: mapIdx(b30.used),
      outliers_12: b12.outliers,
      outliers_30: b30.outliers
    };
    const bMaxGefiltert = Math.max(b12.maxIndex, b30.maxIndex);
    if (bMaxGefiltert >= 0) bMaxIndexInVideos = gefiltertIdx[bMaxGefiltert];
  }

  // Die Debug-Liste muss jeden je betrachteten Reel enthalten, sonst findet
  // formatCpmDebug einen Nachruecker jenseits von Index 30 nicht wieder.
  const debugBis = Math.max(
    WINDOW_LONG,
    window12.maxIndex + 1,
    window30.maxIndex + 1,
    bMaxIndexInVideos + 1
  );

  // Markierte Trials zusaetzlich als skipped-Artikel fuehren, damit Report
  // und Response den Grund je Reel zeigen. Sie bleiben trotzdem in `videos`,
  // weil Variante A sie nutzt.
  const trialViewsSkipped = videos
    .filter((v) => v.trial_views)
    .map((v) => ({
      permalink: v.permalink,
      views: v.views,
      timestamp: v.timestamp,
      age_hours: v.age_hours,
      reason: 'trial_views',
      ad_marker: null,
      trial_detail: v.trial_detail || null
    }));
  const skippedAlle = [...skipped, ...trialViewsSkipped]
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  return {
    views_12: roundViews(window12.views),
    views_30: roundViews(window30.views),
    cpm_12: toCpm(window12.views),
    cpm_30: toCpm(window30.views),
    sample_12: window12.sample,
    sample_30: window30.sample,
    // Indizes in videos statt permalinks: haelt ig_stats klein
    used_12: window12.used,
    used_30: window30.used,
    outliers_12: window12.outliers,
    outliers_30: window30.outliers,
    ohne_trials: ohneTrials,
    trial_gate: serialisiereTrialGate(trialGate),
    videos_available: videos.length,
    skipped_too_recent: skipped.filter((s) => s.reason === 'too_recent').length,
    skipped_ads: skipped.filter((s) => s.reason === 'ad_post').length,
    skipped_trials: skipped.filter((s) => s.reason === 'trial_duplicate').length,
    skipped_trial_views: trialViewsSkipped.length,
    non_video_skipped: nonVideoSkipped,
    videos: videos.slice(0, debugBis).map((v) => ({
      permalink: v.permalink,
      views: v.views,
      timestamp: v.timestamp
    })),
    skipped_videos: skippedAlle.map((s) => ({
      permalink: s.permalink,
      views: s.views,
      timestamp: s.timestamp,
      age_hours: s.age_hours,
      reason: s.reason,
      ad_marker: s.ad_marker || null,
      ...(s.trial_detail ? { trial_detail: s.trial_detail } : {})
    })),
    calc_version: CALC_VERSION
  };
}

module.exports = {
  CPM_RATE,
  MIN_AGE_HOURS,
  OUTLIER_RATIO,
  OUTLIER_MIN_SAMPLE,
  AD_HASHTAGS,
  GESCHENK_HASHTAGS,
  TRIAL_EXACT_MIN_LEN,
  TRIAL_EXACT_MAX_GAP_DAYS,
  TRIAL_FUZZY_MIN_LEN,
  TRIAL_FUZZY_MAX_GAP_DAYS,
  TRIAL_FUZZY_JACCARD,
  TRIAL_GAP_RATIO,
  TRIAL_MIN_CLUSTER,
  TRIAL_MIN_REGULAR,
  TRIAL_MIN_REGULAR_MEDIAN,
  TRIAL_MAX_PCT,
  WINDOW_SHORT,
  WINDOW_LONG,
  CALC_VERSION,
  classifyVideos,
  selectVideos,
  average,
  detectOutliers,
  pickWindow,
  evaluateWindow,
  median,
  istWerbePost,
  normCaption,
  captionJaccard,
  istTrialPaar,
  findeTrialDuplikate,
  findeTrialLuecke,
  serialisiereTrialGate,
  toCpm,
  computeInstagramCpm
};
