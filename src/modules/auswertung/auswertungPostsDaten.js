// auswertungPostsDaten.js
// Posts der Auswertung aus kooperation_post (ADR 0076, ADR 0078): DB-Zeile ↔ Post des Reports.
// einheitId ist dieselbe wie in einheitenAusBaum (video:/story:/still: plus ID), dateiId die
// gepostete Finale Version (beim Still der Still selbst). Lesen darf nur das Team (RLS).

// Gleich zu POST_SPALTEN in netlify/functions/_shared/post-zugriff.js (auswertungKonfigSync.test.js)
export const POST_SELECT = [
  'id', 'kampagne_id', 'produktion_id', 'kooperation_id', 'video_id', 'story_id', 'still_id',
  'video_asset_id', 'story_asset_id', 'plattform', 'account_handle', 'link', 'posted_at', 'measured_at',
  'metrics', 'confidence', 'source', 'status', 'ki_status', 'ki_fehler', 'ki_schritt', 'ki_gestartet_at',
  'screenshot_pfade', 'created_at', 'updated_at', 'confirmed_by', 'confirmed_at'
].join(', ');

const ANKER = { video: 'video_id', story: 'story_id', still: 'still_id' };
// Länger als ein KI-Lauf je dauern darf (Frist im Client 120 s): dann ist die Function
// abgebrochen, ohne zu melden, und niemand hat zugesehen.
const KI_HAENGT_MS = 3 * 60 * 1000;

export function einheitIdVon(row) {
  const art = Object.keys(ANKER).find(a => row?.[ANKER[a]]);
  return art ? `${art}:${row[ANKER[art]]}` : null;
}

/** Anker-Spalte einer Einheit fürs Anlegen, null bei unbekanntem Schlüssel. */
export function ankerAus(einheitId) {
  const [art, id] = String(einheitId || '').split(':');
  return ANKER[art] && id ? { [ANKER[art]]: id } : null;
}

/** Spalte der geposteten Datei. Beim Still ist der Anker selbst die Datei. */
function dateiSpalten(einheitId, dateiId) {
  const art = String(einheitId || '').split(':')[0];
  if (art === 'video') return { video_asset_id: dateiId || null };
  if (art === 'story') return { story_asset_id: dateiId || null };
  return {};
}

/** Nur endliche Zahlen; alles andere fällt weg, damit ein leeres Feld nie als 0 zählt. */
export function bereinigeMetrics(metrics) {
  const out = {};
  Object.entries(metrics || {}).forEach(([key, wert]) => {
    if (typeof wert === 'number' && Number.isFinite(wert)) out[key] = wert;
  });
  return out;
}

function kiStand(row, jetzt) {
  const kiSchritt = row.ki_schritt || null;
  const seit = Date.parse(row.ki_gestartet_at || row.updated_at);
  const haengt = row.ki_status === 'laeuft' && Number.isFinite(seit) && jetzt - seit > KI_HAENGT_MS;
  if (haengt) return { kiStatus: 'fehler', kiFehler: 'Die KI hat nicht geantwortet. Erneut versuchen oder manuell eintragen.', kiSchritt };
  return { kiStatus: row.ki_status || null, kiFehler: row.ki_fehler || null, kiSchritt };
}

/**
 * @param {object} row - Zeile aus kooperation_post
 * @param {Map<string, string>} [namen] - auth_user_id → Name für „bestätigt von“
 */
export function postAusZeile(row, namen = new Map(), jetzt = Date.now()) {
  const pfade = Array.isArray(row.screenshot_pfade) ? row.screenshot_pfade : [];
  return {
    id: row.id,
    einheitId: einheitIdVon(row),
    kampagneId: row.kampagne_id,
    produktionId: row.produktion_id || null,
    kooperationId: row.kooperation_id,
    dateiId: row.video_asset_id || row.story_asset_id || row.still_id || null,
    plattform: row.plattform,
    accountHandle: row.account_handle || null,
    link: row.link || null,
    postedAt: row.posted_at || null,
    measuredAt: row.measured_at || null,
    metrics: bereinigeMetrics(row.metrics),
    confidence: row.confidence || null,
    source: row.source,
    status: row.status,
    ...kiStand(row, jetzt),
    kiGestartetAt: row.ki_gestartet_at || null,
    screenshotPfade: pfade,
    screenshots: pfade.length,
    confirmedBy: (row.confirmed_by && namen.get(row.confirmed_by)) || null,
    confirmedAt: row.confirmed_at || null,
    updatedAt: row.updated_at || null
  };
}

/**
 * Spalten aus einem Teil-Post (nur die Schlüssel, die drinstehen). Scope-Spalten setzt der
 * Trigger, sie gehen nie vom Client aus.
 */
export function spaltenAus(teil, einheitId) {
  const out = {};
  if ('plattform' in teil) out.plattform = teil.plattform;
  if ('accountHandle' in teil) out.account_handle = teil.accountHandle || null;
  if ('link' in teil) out.link = teil.link ? String(teil.link).trim() || null : null;
  if ('postedAt' in teil) out.posted_at = teil.postedAt || null;
  if ('measuredAt' in teil) out.measured_at = teil.measuredAt || null;
  if ('metrics' in teil) out.metrics = bereinigeMetrics(teil.metrics);
  if ('confidence' in teil) out.confidence = teil.confidence || null;
  if ('source' in teil) out.source = teil.source;
  if ('dateiId' in teil) Object.assign(out, dateiSpalten(einheitId, teil.dateiId));
  return out;
}

async function namenFuer(rows) {
  const ids = [...new Set(rows.map(r => r.confirmed_by).filter(Boolean))];
  if (!ids.length) return new Map();
  const { data, error } = await window.supabase.from('benutzer').select('auth_user_id, name').in('auth_user_id', ids);
  if (error) {
    console.warn('Auswertung: Namen nicht lesbar', error.message || error);
    return new Map();
  }
  return new Map((data || []).map(b => [b.auth_user_id, b.name]));
}

/** Posts mit Namen der Bestätiger. Für Admin und Mitarbeiter; alle anderen bekommen per RLS nichts. */
export async function postsAusZeilen(rows) {
  const namen = await namenFuer(rows || []);
  return (rows || []).map(r => postAusZeile(r, namen));
}

/**
 * Posts der Kampagne, mit `produktionId` nur die dieser Produktion.
 * @returns {Promise<object[]>}
 */
export async function ladePosts({ kampagneId, produktionId = null }) {
  if (!window.supabase || !kampagneId) return [];
  let query = window.supabase.from('kooperation_post').select(POST_SELECT).eq('kampagne_id', kampagneId);
  if (produktionId) query = query.eq('produktion_id', produktionId);
  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) throw error;
  return postsAusZeilen(data || []);
}

/** Einen Post frisch lesen (nach Abruf, KI oder Realtime). */
export async function ladePost(postId) {
  const { data, error } = await window.supabase.from('kooperation_post').select(POST_SELECT).eq('id', postId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [post] = await postsAusZeilen([data]);
  return post;
}
