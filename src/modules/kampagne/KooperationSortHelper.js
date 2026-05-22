// KooperationSortHelper.js
// Reine Sortier-Funktionen für die Kooperationsliste auf der Kampagnen-Detailseite.
// Wird vom KampagneDetailStore.getFilteredAndSorted() genutzt und ist seiteneffektfrei
// (kein DOM, kein window) damit clientseitig + testbar.
//
// Unterstützte Sort-Werte:
//   - 'name_asc' / 'name_desc'           → koop.name (de, case-insensitive)
//   - 'created_desc' / 'created_asc'     → koop.created_at
//   - 'posting_asc' / 'posting_desc'     → rollierendes "nächstes relevantes Video"
//
// GoLive-Regel (rollierend):
//   Videos werden in position-Reihenfolge durchlaufen. Ein Video gilt als
//   "erledigt" wenn freigabe === true UND posting_datum gesetzt UND
//   posting_datum <= heute (Tagesgenauigkeit, lokale Zeitzone). Erledigte
//   Videos werden übersprungen, das erste nicht-erledigte Video bestimmt
//   das effektive GoLive-Datum. Sind alle erledigt, zählt das letzte Video.
//   Fallback: kooperation.posting_datum. Einträge ohne Datum sortieren ans Ende.

function parseDateOnly(value) {
  if (!value) return null;
  // 'YYYY-MM-DD' oder ISO-String → lokale Date auf Tagesanfang normalisieren
  const str = String(value);
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfDay(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Video gilt als für GoLive-Sortierung erledigt (wird übersprungen).
 */
export function isVideoGoLiveCompleted(video, now = new Date()) {
  if (!video?.freigabe) return false;
  if (!video.posting_datum) return false;
  const postingDay = parseDateOnly(video.posting_datum);
  const today = startOfDay(now);
  if (!postingDay || !today) return false;
  return postingDay.getTime() <= today.getTime();
}

/**
 * Liefert das effektive GoLive-Datum (als 'YYYY-MM-DD' String oder null) einer
 * Kooperation für die Sortierung.
 *
 * @param {object} koop                      Kooperation-Objekt
 * @param {Record<string, object[]>} videosByKoopId  Videos je Kooperation-ID (nach position sortiert)
 * @param {Date} [now]                       Stichtag für "erledigt"-Prüfung
 * @returns {string|null}
 */
export function getEffectiveGoLiveDate(koop, videosByKoopId, now = new Date()) {
  if (!koop) return null;
  const videos = videosByKoopId?.[koop.id] || [];

  // Erstes nicht-erledigtes Video bestimmt den Sort-Wert
  const active = videos.find(v => !isVideoGoLiveCompleted(v, now));
  if (active) {
    return active.posting_datum || null;
  }

  // Alle Videos erledigt → letztes Video
  if (videos.length > 0) {
    const last = videos[videos.length - 1];
    if (last?.posting_datum) return last.posting_datum;
  }

  // Fallback: Datum direkt an der Kooperation
  return koop.posting_datum || null;
}

function compareStringsDe(a, b) {
  const sa = (a == null ? '' : String(a));
  const sb = (b == null ? '' : String(b));
  return sa.localeCompare(sb, 'de', { sensitivity: 'base' });
}

function compareDates(a, b) {
  const da = a ? parseDateOnly(a)?.getTime() ?? null : null;
  const db = b ? parseDateOnly(b)?.getTime() ?? null : null;
  if (da === db) return 0;
  if (da == null) return 1;   // null immer ans Ende
  if (db == null) return -1;
  return da - db;
}

function compareTimestamps(a, b) {
  const ta = a ? new Date(a).getTime() : NaN;
  const tb = b ? new Date(b).getTime() : NaN;
  const va = isNaN(ta) ? null : ta;
  const vb = isNaN(tb) ? null : tb;
  if (va === vb) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  return va - vb;
}

/**
 * Sortiert eine Kooperationen-Liste stabil (Original-Reihenfolge bei Gleichstand bleibt erhalten).
 *
 * @param {object[]} koops                            Kooperationen
 * @param {string} sortValue                          z.B. 'name_asc', 'posting_desc'
 * @param {Record<string, object[]>} videosByKoopId   Videos je Kooperation-ID (nach position sortiert)
 * @param {Date} [now]                                Stichtag für GoLive-Sort
 * @returns {object[]} neue, sortierte Liste
 */
export function sortKooperationen(koops, sortValue, videosByKoopId = {}, now = new Date()) {
  if (!Array.isArray(koops) || koops.length === 0) return koops || [];

  // Stabile Sortierung über Index-Decorate
  const indexed = koops.map((k, i) => [k, i]);

  let cmp;
  switch (sortValue) {
    case 'name_asc':
      cmp = (a, b) => compareStringsDe(a.name, b.name);
      break;
    case 'name_desc':
      cmp = (a, b) => compareStringsDe(b.name, a.name);
      break;
    case 'created_asc':
      cmp = (a, b) => compareTimestamps(a.created_at, b.created_at);
      break;
    case 'created_desc':
      cmp = (a, b) => compareTimestamps(b.created_at, a.created_at);
      break;
    case 'posting_asc': {
      const dateCache = new Map();
      const get = (k) => {
        if (!dateCache.has(k.id)) dateCache.set(k.id, getEffectiveGoLiveDate(k, videosByKoopId, now));
        return dateCache.get(k.id);
      };
      cmp = (a, b) => compareDates(get(a), get(b));
      break;
    }
    case 'posting_desc': {
      const dateCache = new Map();
      const get = (k) => {
        if (!dateCache.has(k.id)) dateCache.set(k.id, getEffectiveGoLiveDate(k, videosByKoopId, now));
        return dateCache.get(k.id);
      };
      cmp = (a, b) => {
        const da = get(a);
        const db = get(b);
        // null immer ans Ende, auch bei desc
        if (da == null && db == null) return 0;
        if (da == null) return 1;
        if (db == null) return -1;
        return compareDates(db, da);
      };
      break;
    }
    default:
      // Unbekannter Wert → unverändert
      return [...koops];
  }

  indexed.sort((x, y) => {
    const r = cmp(x[0], y[0]);
    return r !== 0 ? r : x[1] - y[1];
  });

  return indexed.map(([k]) => k);
}
