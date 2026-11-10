// poster-generator.js
// Erzeugt Poster (Standbild als WebP, hoechstens 480 px breit) fuer Videos und Bilder im
// Videos-Tab (ADR 0064) und legt sie in den privaten Bucket.
//
// Quellen: Dropbox (files/get_thumbnail_batch, 25 Dateien je Call, Standbild auch fuer Videos,
// wandelt HEIC) und SharePoint (Graph-Thumbnails per $batch, Schluessel 'sp:<drive>:<item>').
// Was scheitert, landet mit Grund in asset_poster.fehler und der Client faellt auf das
// Original zurueck.
//
// Ein Lauf: claimen (poster_auftraege_holen), Thumbnails holen, mit sharp auf WebP bringen,
// hochladen, abschliessen. Der Abschluss schreibt nur mit dem versuche-Stand des Claims
// (Fencing): ein ueberholter Lauf ueberschreibt nichts.

const crypto = require('crypto');
const { getAccessToken } = require('./dropbox');
const { BUCKET, serviceClient } = require('./poster');

const BATCH = 25;
const MAX_BREITE = 480;
const WEBP_QUALITY = 72;
const MAX_VERSUCHE = 3;
const BACKOFF_SEC = 60;
const DROPBOX_SIZE = 'w480h320';
// Kuerzere Seite passt in w480h320, Hochformat kommt also mit 480 px Breite zurueck
const DROPBOX_MODE = 'fitone_bestfit';
// Fehler, bei denen ein neuer Versuch nichts aendert
const PERMANENT = new Set(['path', 'unsupported_extension', 'unsupported_image', 'encrypted_content']);

/** Deterministischer Pfad im Bucket: ein Schluessel, eine Datei (Upsert ist idempotent). */
function storagePathFor(filePath, revision) {
  const h = crypto.createHash('sha256').update(`${filePath}\n${revision}`).digest('hex');
  return `${h.slice(0, 2)}/${h}.webp`;
}

class BatchError extends Error {
  constructor(message, retryAfterSec = null) {
    super(message);
    this.name = 'BatchError';
    this.retryAfterSec = retryAfterSec;
  }
}

/**
 * Dropbox-Thumbnails fuer bis zu 25 Pfade. Ergebnis in derselben Reihenfolge.
 * HTTP-Fehler (Rate Limit, 5xx, Token) gelten fuer den ganzen Batch und werfen BatchError.
 * @returns {Promise<Array<{ ok: true, buffer: Buffer } | { ok: false, fehler: string, permanent: boolean }>>}
 */
async function dropboxThumbnails(paths, { fetchImpl = (...a) => fetch(...a), token = getAccessToken } = {}) {
  const t = await token();
  const resp = await fetchImpl('https://content.dropboxapi.com/2/files/get_thumbnail_batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entries: paths.map((path) => ({ path, format: 'jpeg', size: DROPBOX_SIZE, mode: DROPBOX_MODE })),
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    const retryAfter = Number(resp.headers?.get?.('retry-after')) || null;
    throw new BatchError(`Dropbox ${resp.status}: ${text.slice(0, 200)}`, retryAfter);
  }
  const { entries = [] } = await resp.json();
  return paths.map((_, i) => {
    const entry = entries[i];
    if (entry?.['.tag'] === 'success' && entry.thumbnail) {
      return { ok: true, buffer: Buffer.from(entry.thumbnail, 'base64') };
    }
    const tag = entry?.failure?.['.tag'] || 'unbekannt';
    const detail = entry?.failure?.[tag]?.['.tag'];
    return { ok: false, fehler: `dropbox:${tag}${detail ? `/${detail}` : ''}`, permanent: PERMANENT.has(tag) };
  });
}

// Passt in 480 x 1600 ohne Zuschnitt: Hochformat kommt mit 480 px Breite
const SP_GROESSE = 'c480x1600';
// Frisch hochgeladene Videos haben ein paar Minuten lang noch kein Standbild
const SP_NOCH_NICHT_SEK = 600;

/**
 * SharePoint-Thumbnails fuer Schluessel 'sp:<drive_id>:<item_id>'. Drosselung wirft BatchError.
 * @returns {Promise<Array<{ ok: true, buffer: Buffer } | { ok: false, fehler: string, permanent: boolean, warteSek?: number }>>}
 */
async function sharePointThumbnails(keys, { sp, fetchImpl = (...a) => fetch(...a) } = {}) {
  const out = new Array(keys.length);
  const eigene = [];
  keys.forEach((k, i) => {
    const [, driveId, itemId] = String(k).split(':');
    if (!sp) out[i] = { ok: false, fehler: 'sharepoint:nichtKonfiguriert', permanent: false };
    else if (driveId !== sp.driveId || !itemId) out[i] = { ok: false, fehler: 'sharepoint:fremdesDrive', permanent: true };
    else eigene.push({ i, itemId });
  });
  if (!eigene.length) return out;

  let res;
  try {
    res = await sp.thumbnailUrls(eigene.map((e) => e.itemId), SP_GROESSE);
  } catch (err) {
    throw new BatchError(`SharePoint ${err.status || ''}: ${err.message}`, err.retryAfter ?? null);
  }
  await Promise.all(eigene.map(async (e, j) => {
    const r = res[j];
    if (!r?.ok) {
      out[e.i] = r?.fehler === 'sharepoint:keinThumbnail' ? { ...r, warteSek: SP_NOCH_NICHT_SEK } : (r || { ok: false, fehler: 'sharepoint:leer', permanent: false });
      return;
    }
    try {
      // Thumbnail-URLs sind vorab signiert
      const resp = await fetchImpl(r.url);
      out[e.i] = resp.ok
        ? { ok: true, buffer: Buffer.from(await resp.arrayBuffer()) }
        : { ok: false, fehler: `sharepoint:thumbnail${resp.status}`, permanent: false };
    } catch (err) {
      out[e.i] = { ok: false, fehler: `sharepoint:netz/${err.message}`.slice(0, 200), permanent: false };
    }
  }));
  return out;
}

/** Verteilt die Schluessel auf Dropbox und SharePoint, Ergebnis in Eingabe-Reihenfolge. */
function gemischteThumbnails({ sp = null, dropbox = dropboxThumbnails, fetchImpl } = {}) {
  return async (keys) => {
    const out = new Array(keys.length);
    const spIdx = [];
    const dbIdx = [];
    keys.forEach((k, i) => (String(k).startsWith('sp:') ? spIdx : dbIdx).push(i));
    if (dbIdx.length) (await dropbox(dbIdx.map((i) => keys[i]))).forEach((r, j) => { out[dbIdx[j]] = r; });
    if (spIdx.length) {
      (await sharePointThumbnails(spIdx.map((i) => keys[i]), { sp, fetchImpl })).forEach((r, j) => { out[spIdx[j]] = r; });
    }
    return out;
  };
}

/** JPEG von der Quelle -> WebP, gedreht nach EXIF, hoechstens MAX_BREITE breit. */
async function toWebp(buffer, sharpImpl) {
  const { data, info } = await sharpImpl(buffer)
    .rotate()
    .resize({ width: MAX_BREITE, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });
  return { data, breite: info.width, hoehe: info.height };
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * @param {{ service: object, thumbnails?: Function, sharp?: Function, now?: () => number }} deps
 */
function createPosterGenerator(deps) {
  const service = deps.service;
  const thumbnails = deps.thumbnails || dropboxThumbnails;
  const now = deps.now || (() => Date.now());
  const sharpImpl = () => deps.sharp || require('sharp');
  const iso = (ms) => new Date(ms).toISOString();

  async function abschluss(auftrag, felder) {
    const { error } = await service
      .from('asset_poster')
      .update({ ...felder, gesperrt_bis: null, updated_at: iso(now()) })
      .eq('file_path', auftrag.file_path)
      .eq('revision', auftrag.revision)
      .eq('versuche', auftrag.versuche);
    if (error) console.error('[poster-generator] Abschluss fehlgeschlagen:', auftrag.file_path, error.message);
  }

  /** Fehler eines Auftrags: dauerhaft oder nach MAX_VERSUCHE failed, sonst Backoff. */
  async function fehlschlag(auftrag, fehler, permanent, warteSek = null) {
    if (permanent || auftrag.versuche >= MAX_VERSUCHE) {
      await abschluss(auftrag, { status: 'failed', fehler });
      return 'failed';
    }
    const warten = warteSek || BACKOFF_SEC * 2 ** (auftrag.versuche - 1);
    await abschluss(auftrag, { status: 'pending', fehler, naechster_versuch: iso(now() + warten * 1000) });
    return 'pending';
  }

  async function fertig(auftrag, buffer) {
    const { data, breite, hoehe } = await toWebp(buffer, sharpImpl());
    const storagePath = storagePathFor(auftrag.file_path, auftrag.revision);
    const { error } = await service.storage
      .from(BUCKET)
      .upload(storagePath, data, { contentType: 'image/webp', cacheControl: '31536000', upsert: true });
    if (error) throw new Error(`Upload: ${error.message}`);
    await abschluss(auftrag, {
      status: 'ready',
      storage_path: storagePath,
      breite,
      hoehe,
      bytes: data.length,
      fehler: null,
    });
    return 'ready';
  }

  /**
   * Batch-Fehler (Rate Limit, Dropbox down): Lease freigeben, ohne einen Versuch zu verbrauchen.
   * versuche geht auf den Stand vor dem Claim zurueck, der naechste Claim zaehlt wieder hoch.
   */
  async function freigeben(auftrag, err) {
    const warten = err.retryAfterSec || BACKOFF_SEC;
    await abschluss(auftrag, {
      fehler: err.message.slice(0, 300),
      versuche: Math.max(0, auftrag.versuche - 1),
      naechster_versuch: iso(now() + warten * 1000),
    });
  }

  /**
   * Geclaimte Auftraege abarbeiten.
   * @param {Array<{ file_path: string, revision: string, art: string, versuche: number }>} auftraege
   * @returns {Promise<Array<{ file_path: string, status: string, fehler?: string }>>}
   */
  async function verarbeite(auftraege) {
    const ergebnisse = [];
    for (const teil of chunk(auftraege, BATCH)) {
      let thumbs;
      try {
        thumbs = await thumbnails(teil.map((a) => a.file_path));
      } catch (err) {
        console.warn('[poster-generator] Batch fehlgeschlagen:', err.message);
        await Promise.all(teil.map((a) => freigeben(a, err)));
        teil.forEach((a) => ergebnisse.push({ file_path: a.file_path, status: 'freigegeben', fehler: err.message }));
        continue;
      }
      const teilErgebnisse = await Promise.all(teil.map(async (auftrag, i) => {
        const thumb = thumbs[i];
        try {
          if (!thumb?.ok) {
            const status = await fehlschlag(auftrag, thumb?.fehler || 'kein Ergebnis', !!thumb?.permanent, thumb?.warteSek);
            return { file_path: auftrag.file_path, status, fehler: thumb?.fehler };
          }
          return { file_path: auftrag.file_path, status: await fertig(auftrag, thumb.buffer) };
        } catch (err) {
          const status = await fehlschlag(auftrag, err.message.slice(0, 300), false);
          return { file_path: auftrag.file_path, status, fehler: err.message };
        }
      }));
      ergebnisse.push(...teilErgebnisse);
    }
    return ergebnisse;
  }

  async function holen() {
    const { data, error } = await service.rpc('poster_auftraege_holen', { p_limit: BATCH });
    if (error) throw new Error(`Claim: ${error.message}`);
    return data || [];
  }

  /**
   * Claimen und abarbeiten, bis nichts mehr faellig ist oder das Zeitbudget aufgebraucht ist.
   * `mehr` heisst: das Budget war aus, waehrend noch volle Batches kamen.
   */
  async function lauf({ budgetMs = 12 * 60 * 1000 } = {}) {
    const start = now();
    const summe = { verarbeitet: 0, ready: 0, pending: 0, failed: 0, freigegeben: 0, mehr: false };
    for (;;) {
      if (now() - start > budgetMs) {
        summe.mehr = true;
        break;
      }
      const auftraege = await holen();
      if (!auftraege.length) break;
      for (const e of await verarbeite(auftraege)) {
        summe.verarbeitet += 1;
        summe[e.status] = (summe[e.status] || 0) + 1;
      }
      if (auftraege.length < BATCH) break;
    }
    return summe;
  }

  /** Verwaiste Poster aus Tabelle und Bucket entfernen. @returns {Promise<number>} */
  async function verwaisteEntfernen() {
    const { data, error } = await service.rpc('poster_verwaiste_entfernen', { p_limit: 200 });
    if (error) throw new Error(`Verwaiste: ${error.message}`);
    const pfade = (data || []).map((r) => r.storage_path).filter(Boolean);
    for (const teil of chunk(pfade, 100)) {
      const { error: rmErr } = await service.storage.from(BUCKET).remove(teil);
      if (rmErr) console.warn('[poster-generator] Bucket nicht raeumbar:', rmErr.message);
    }
    return (data || []).length;
  }

  async function stand() {
    const { data, error } = await service.rpc('poster_stand');
    if (error) throw new Error(`Stand: ${error.message}`);
    return Array.isArray(data) ? data[0] : data;
  }

  return { verarbeite, lauf, verwaisteEntfernen, stand };
}

function posterAusEnv() {
  const service = serviceClient();
  if (!service) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY fehlt');
  const { ablageAusEnv } = require('./ablage');
  const ablage = ablageAusEnv({ supabase: service });
  return createPosterGenerator({ service, thumbnails: gemischteThumbnails({ sp: ablage?.sp || null }) });
}

module.exports = {
  BATCH,
  MAX_VERSUCHE,
  BACKOFF_SEC,
  BatchError,
  storagePathFor,
  dropboxThumbnails,
  sharePointThumbnails,
  gemischteThumbnails,
  toWebp,
  createPosterGenerator,
  posterAusEnv,
};
