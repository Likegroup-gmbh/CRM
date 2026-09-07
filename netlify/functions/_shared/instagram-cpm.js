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

const CPM_RATE = 25;        // EUR pro 1000 Views
const MIN_AGE_HOURS = 96;   // Videos juenger als 4 Tage ignorieren
const WINDOW_SHORT = 8;
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
// Stichprobe konstant bei 8 bzw. 30 Reels, statt bei jedem Ausreisser zu
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

// Version der Rechenlogik. Landet in ig_stats.calc_version; eine aeltere
// Version im Creator-Pool gilt als veraltet und erzwingt einen neuen Abruf.
const CALC_VERSION = 5;

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

    const adMarker = istWerbePost(m.caption);
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
  return { included, skipped, nonVideoSkipped };
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
 * "8er-Schnitt" aus 3 Videos waere irrefuehrend. Gehen erst beim Nachruecken
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
    // selbst wieder durchgefallen sind. formatCpmDebug braucht die Reels dazu.
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
 * views_8 und views_30 sind der Schnitt aus genau 8 bzw. 30 sauberen Reels:
 * Ausreisser werden nicht einfach abgezogen, sondern durch den naechst-aelteren
 * organischen Reel ersetzt (siehe pickWindow). Was rausgefallen ist, steht in
 * outliers_8 / outliers_30, was verwendet wurde in used_8 / used_30.
 *
 * @param {Array} media   Rohe media.data-Eintraege
 * @param {object} [opts] { now: number } - Zeitbasis fuer die 4-Tage-Regel
 * @returns {{
 *   views_8: number|null, views_30: number|null,
 *   cpm_8: number|null, cpm_30: number|null,
 *   sample_8: number, sample_30: number,
 *   used_8: number[], used_30: number[],
 *   outliers_8: Array, outliers_30: Array,
 *   videos_available: number, skipped_too_recent: number,
 *   skipped_ads: number, skipped_trials: number, non_video_skipped: number,
 *   videos: Array, skipped_videos: Array, calc_version: number
 * }}
 */
function computeInstagramCpm(media, opts = {}) {
  const now = opts.now ?? Date.now();
  const { included: videos, skipped, nonVideoSkipped } = classifyVideos(media, now);

  // Die vollstaendige Liste uebergeben, nicht vorschneiden: pickWindow muss
  // ueber das Fenster hinaus nachruecken koennen.
  const window8 = evaluateWindow(videos, WINDOW_SHORT);
  const window30 = evaluateWindow(videos, WINDOW_LONG);

  // Die Debug-Liste muss jeden je betrachteten Reel enthalten, sonst findet
  // formatCpmDebug einen Nachruecker jenseits von Index 30 nicht wieder.
  const debugBis = Math.max(WINDOW_LONG, window8.maxIndex + 1, window30.maxIndex + 1);

  return {
    views_8: roundViews(window8.views),
    views_30: roundViews(window30.views),
    cpm_8: toCpm(window8.views),
    cpm_30: toCpm(window30.views),
    sample_8: window8.sample,
    sample_30: window30.sample,
    // Indizes in videos statt permalinks: haelt ig_stats klein
    used_8: window8.used,
    used_30: window30.used,
    outliers_8: window8.outliers,
    outliers_30: window30.outliers,
    videos_available: videos.length,
    skipped_too_recent: skipped.filter((s) => s.reason === 'too_recent').length,
    skipped_ads: skipped.filter((s) => s.reason === 'ad_post').length,
    skipped_trials: skipped.filter((s) => s.reason === 'trial_duplicate').length,
    non_video_skipped: nonVideoSkipped,
    videos: videos.slice(0, debugBis).map((v) => ({
      permalink: v.permalink,
      views: v.views,
      timestamp: v.timestamp
    })),
    skipped_videos: skipped.map((s) => ({
      permalink: s.permalink,
      views: s.views,
      timestamp: s.timestamp,
      age_hours: s.age_hours,
      reason: s.reason,
      ad_marker: s.ad_marker || null
    })),
    calc_version: CALC_VERSION
  };
}

/**
 * Strukturierter Debug-Payload fuer Server-/Browser-Konsole.
 * @param {string} username
 * @param {object} stats  Ergebnis von computeInstagramCpm oder Pool-Spiegel
 * @param {object} [meta] { source, pool_fetched_at, image_error }
 */
function formatCpmDebug(username, stats, meta = {}) {
  // Zwei getrennte Bloecke: exakt die Reels, die in den 8er- bzw. 30er-Schnitt
  // eingeflossen sind. used_8 / used_30 sind Indizes in stats.videos, damit sind
  // auch Nachruecker jenseits des Fensters korrekt aufgeloest.
  const alle = stats.videos || [];
  const mapVideo = (v, i) => ({
    index: i,
    views: v.views,
    timestamp: v.timestamp,
    permalink: v.permalink
  });

  // Fallback nur fuer Pool-Eintraege aus einer Zeit ohne used_*: Fenster ueber
  // den permalink der Ausreisser rekonstruieren. Nachruecker fehlen dort, das
  // ist hinnehmbar - CALC_VERSION erzwingt sowieso einen frischen Abruf.
  // Ein leeres used_* ist dagegen eine echte Aussage ("Fenster nicht voll"),
  // darf also nicht in den Fallback laufen.
  const fensterAus = (used, size, outliers) => {
    if (Array.isArray(used)) {
      return used
        .map((i) => alle[i])
        .filter(Boolean)
        .map(mapVideo);
    }
    const raus = new Set((outliers || []).map((o) => o.permalink));
    return alle
      .slice(0, size)
      .filter((v) => !raus.has(v.permalink))
      .map(mapVideo);
  };

  const included_8 = fensterAus(stats.used_8, WINDOW_SHORT, stats.outliers_8);
  const included_30 = fensterAus(stats.used_30, WINDOW_LONG, stats.outliers_30);

  const skipped = (stats.skipped_videos || []).map((v) => ({
    views: v.views,
    age_hours: v.age_hours,
    timestamp: v.timestamp,
    permalink: v.permalink,
    reason: v.reason || 'too_recent',
    ad_marker: v.ad_marker || null
  }));

  return {
    username: username || null,
    source: meta.source || null,
    pool_fetched_at: meta.pool_fetched_at || null,
    image_error: meta.image_error || null,
    rules: {
      MIN_AGE_HOURS,
      CPM_RATE,
      WINDOW_SHORT,
      WINDOW_LONG,
      OUTLIER_RATIO,
      OUTLIER_MIN_SAMPLE,
      AD_HASHTAGS,
      TRIAL_EXACT_MIN_LEN,
      TRIAL_EXACT_MAX_GAP_DAYS,
      TRIAL_FUZZY_MIN_LEN,
      TRIAL_FUZZY_MAX_GAP_DAYS,
      TRIAL_FUZZY_JACCARD,
      CALC_VERSION,
      note: 'UI-Preis = views × Listen-TKP; cpm_* hier immer × CPM_RATE'
    },
    skipped,
    included_8,
    included_30,
    outliers: {
      window_8: stats.outliers_8 || [],
      window_30: stats.outliers_30 || []
    },
    summary: {
      non_video_skipped: stats.non_video_skipped ?? null,
      skipped_too_recent: stats.skipped_too_recent ?? null,
      skipped_ads: stats.skipped_ads ?? null,
      skipped_trials: stats.skipped_trials ?? null,
      videos_available: stats.videos_available ?? null,
      sample_8: stats.sample_8 ?? null,
      sample_30: stats.sample_30 ?? null,
      window_8_full: stats.sample_8 === WINDOW_SHORT,
      window_30_full: stats.sample_30 === WINDOW_LONG,
      views_8: stats.views_8 ?? null,
      views_30: stats.views_30 ?? null,
      cpm_8: stats.cpm_8 ?? null,
      cpm_30: stats.cpm_30 ?? null,
      formula: `views / 1000 * ${CPM_RATE}`
    }
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
  WINDOW_SHORT,
  WINDOW_LONG,
  CALC_VERSION,
  classifyVideos,
  selectVideos,
  average,
  detectOutliers,
  pickWindow,
  istWerbePost,
  normCaption,
  captionJaccard,
  istTrialPaar,
  findeTrialDuplikate,
  toCpm,
  computeInstagramCpm,
  formatCpmDebug
};
