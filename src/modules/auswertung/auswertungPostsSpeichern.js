// auswertungPostsSpeichern.js
// Schreiben der Posts (ADR 0078): anlegen, speichern, bestätigen, löschen, Screenshots hochladen
// und von der KI lesen lassen, Link bei Instagram abrufen. Jede Funktion gibt den frischen Post
// zurück, damit die Ansicht ihn tauscht, ohne neu zu laden. Rechte prüft RLS (nur das Team).

import { authorizedFetch } from '../../core/auth/getAccessToken.js';
import { POST_SELECT, ankerAus, ladePost, postsAusZeilen, spaltenAus } from './auswertungPostsDaten.js';
import { verkleinere } from './auswertungBildVerkleinern.js';
import { logKi } from './auswertungKiLauf.js';

const TABELLE = 'kooperation_post';
const BUCKET = 'post-screenshots';
const BILD_TYPEN = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
export const MAX_BILD_BYTES = 10 * 1024 * 1024;
const URL_GUELTIG_S = 60 * 60;

const mb = (bytes) => `${(bytes / 1048576).toFixed(2)} MB`;

const authId = () => window.currentUser?.auth_user_id || null;
const tabelle = () => window.supabase.from(TABELLE);

async function alsPost(query) {
  const { data, error } = await query.select(POST_SELECT).single();
  if (error) throw error;
  const [post] = await postsAusZeilen([data]);
  return post;
}

/** Bild im erlaubten Format und unter 10 MB? Gibt den Grund zurück, sonst null. */
export function bildFehler(file) {
  if (!file || !BILD_TYPEN[file.type]) return 'Nur PNG, JPG, WebP oder GIF.';
  if (file.size > MAX_BILD_BYTES) return 'Das Bild ist größer als 10 MB.';
  return null;
}

/**
 * Neuer Post an einer Einheit, immer als Entwurf.
 * @param {{ einheitId: string, plattform: string, dateiId?: string|null }} basis - plus Felder des Posts
 */
export async function legePostAn({ einheitId, plattform, dateiId = null, ...felder }) {
  const anker = ankerAus(einheitId);
  if (!anker) throw new Error('Unbekannte Einheit');
  const zeile = {
    ...anker,
    ...spaltenAus({ source: 'manuell', ...felder, plattform, dateiId }, einheitId),
    status: 'draft',
    created_by: authId()
  };
  return alsPost(tabelle().insert(zeile));
}

/** Felder eines Posts ändern; der Status bleibt. */
export async function speicherePost(post, teil) {
  return alsPost(tabelle().update(spaltenAus(teil, post.einheitId)).eq('id', post.id));
}

/** Prüfen abschließen oder einen bestätigten Post neu speichern: Felder übernehmen, Status confirmed. */
export async function bestaetigePost(post, teil = {}) {
  const spalten = {
    ...spaltenAus(teil, post.einheitId),
    status: 'confirmed',
    confirmed_by: authId(),
    confirmed_at: new Date().toISOString(),
    ...(post.kiStatus === 'fehler' ? { ki_status: null, ki_fehler: null } : {})
  };
  return alsPost(tabelle().update(spalten).eq('id', post.id));
}

/**
 * KI-Stand setzen: „laeuft“ fordert einen neuen Lauf an (leeres ki_gestartet_at, der Trigger
 * setzt Start und Schritt), „fehler“ mit Grund, wenn der Start scheitert.
 */
export async function setzeKiStatus(post, kiStatus, kiFehler = null) {
  const neuerLauf = kiStatus === 'laeuft' ? { ki_gestartet_at: null } : {};
  return alsPost(tabelle().update({ ki_status: kiStatus, ki_fehler: kiFehler, ...neuerLauf }).eq('id', post.id));
}

/**
 * Laufenden KI-Lauf als gescheitert markieren (Abbruch, Frist). Nur, solange er noch läuft:
 * war die Function inzwischen fertig, bleibt ihr Ergebnis, und zurück kommt der fertige Post.
 */
export async function beendeKiLauf(post, grund) {
  const { data, error } = await tabelle().update({ ki_status: 'fehler', ki_fehler: grund })
    .eq('id', post.id).eq('ki_status', 'laeuft').select(POST_SELECT).maybeSingle();
  if (error) throw error;
  if (!data) return ladePost(post.id);
  const [neu] = await postsAusZeilen([data]);
  return neu;
}

/** Rückgängig nach dem Bestätigen: wieder Entwurf mit den vorherigen Werten. */
export async function nimmBestaetigungZurueck(post, vorher = null) {
  const zurueck = vorher ? spaltenAus(vorher, post.einheitId) : {};
  return alsPost(tabelle().update({ ...zurueck, status: 'draft', confirmed_by: null, confirmed_at: null }).eq('id', post.id));
}

/**
 * Post samt Screenshots löschen. Die Screenshots zuerst: ihre Policy verlangt, dass der Post
 * noch existiert. Rückgängig hält die Ansicht über eine Verzögerung, nicht die Datenbank.
 */
export async function loeschePost(post) {
  const pfade = post.screenshotPfade || [];
  if (pfade.length) {
    const { error } = await window.supabase.storage.from(BUCKET).remove(pfade);
    if (error) console.warn('Auswertung: Screenshots nicht gelöscht', error.message || error);
  }
  const { error } = await tabelle().delete().eq('id', post.id);
  if (error) throw error;
}

/**
 * Bilder verkleinern, unter {kampagne_id}/{post_id}/ ablegen und am Post vermerken. Fordert
 * einen neuen KI-Lauf an, damit Liste und Polling den Stand schon vor dem Start der Function kennen.
 */
export async function ladeScreenshotsHoch(post, files) {
  const t0 = Date.now();
  const neu = [];
  let vorher = 0;
  let nachher = 0;
  for (const file of files) {
    const bild = await verkleinere(file);
    vorher += file.size;
    nachher += bild.size;
    const pfad = `${post.kampagneId}/${post.id}/${crypto.randomUUID()}.${BILD_TYPEN[bild.type]}`;
    const { error } = await window.supabase.storage.from(BUCKET).upload(pfad, bild, { upsert: false, contentType: bild.type });
    if (error) throw new Error(`Upload fehlgeschlagen: ${error.message}`);
    neu.push(pfad);
  }
  logKi(post.id, `Upload: ${neu.length} Bild(er), ${mb(vorher)} → ${mb(nachher)} in ${Date.now() - t0} ms`);
  // Frisch lesen, damit ein zweiter Upload auf denselben Post keine Pfade überschreibt
  const aktuell = await ladePost(post.id);
  const pfade = [...(aktuell?.screenshotPfade || post.screenshotPfade || []), ...neu];
  return alsPost(tabelle().update({ screenshot_pfade: pfade, ki_status: 'laeuft', ki_fehler: null, ki_gestartet_at: null }).eq('id', post.id));
}

async function fehlerAus(response, fallback) {
  const result = await response.json().catch(() => ({}));
  const error = new Error(result.hint || result.error || fallback);
  error.retryable = response.status === 429;
  return error;
}

/**
 * Background-Function anstoßen. Sie antwortet sofort mit 202, auch wenn sie danach beim Laden
 * abstürzt; ob sie wirklich läuft, zeigt erst ki_schritt (auswertungKiLauf).
 */
export async function starteScreenshotLesen(postId) {
  const t0 = Date.now();
  const response = await authorizedFetch('/.netlify/functions/post-screenshot-background', {
    method: 'POST',
    body: JSON.stringify({ postId })
  });
  logKi(postId, `Function angestoßen: HTTP ${response.status} in ${Date.now() - t0} ms`, undefined, response.ok ? 'info' : 'error');
  if (!response.ok) throw await fehlerAus(response, `Die KI konnte nicht gestartet werden (HTTP ${response.status})`);
}

/** Zahlen zum Link des Posts bei Instagram holen. Der Link muss vorher gespeichert sein. */
export async function rufeLinkAb(postId) {
  const response = await authorizedFetch('/.netlify/functions/post-link-abruf', {
    method: 'POST',
    body: JSON.stringify({ postId })
  });
  if (!response.ok) throw await fehlerAus(response, 'Abruf fehlgeschlagen');
  const result = await response.json();
  const [post] = await postsAusZeilen([result.post]);
  return post;
}

/** Signierte URLs der Screenshots (eine Stunde gültig), in Reihenfolge der Pfade. */
export async function screenshotUrls(pfade) {
  if (!pfade?.length) return [];
  const { data, error } = await window.supabase.storage.from(BUCKET).createSignedUrls(pfade, URL_GUELTIG_S);
  if (error) throw error;
  const jePfad = new Map((data || []).map(d => [d.path, d.signedUrl]));
  return pfade.map(p => jePfad.get(p)).filter(Boolean);
}
