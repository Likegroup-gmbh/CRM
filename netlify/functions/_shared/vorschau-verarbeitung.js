// vorschau-verarbeitung.js
// Konsument der Outbox kooperation_video_vorschau_auftrag und Abgleich mit dem
// Anbieter (ADR 0061). Alles hier darf doppelt laufen (Database Webhook, Sweeper,
// Webhook von Cloudflare, Retries): jeder Schritt prueft den Zustand, bevor er
// schreibt, und schreibt nur den Datensatz seines Schluessels.
//
// Ablauf erzeugen: Vorschau-Zeile (pending) anlegen -> frische Original-URL vom
// Quelle-Adapter -> Cloudflare kopiert selbst -> uid an die Zeile (bedingt, sonst
// Duplikat verwerfen). Fertig wird sie erst, wenn der MP4-Download bereit ist und
// ein signierter Abruf tatsaechlich eine lesbare Datei liefert.

const { probeMp4 } = require('./mp4-probe');
const { signStreamToken, downloadUrl } = require('./cloudflare-stream');

const TABLE = 'kooperation_video_vorschau';
const OUTBOX = 'kooperation_video_vorschau_auftrag';
const COLS = 'id, quelle, quelle_pfad, quelle_revision, anbieter_id, status, versuche, created_at, updated_at';

const MAX_VERSUCHE = 5;
const BACKOFF_BASIS_SEC = 30;
const BACKOFF_MAX_SEC = 30 * 60;
const MAX_PARALLEL = 3;
/** Hoechstens so viele Videos gleichzeitig beim Anbieter in Arbeit. */
const MAX_BEIM_ANBIETER = 10;
const LEASE_SEC = 120;
const PROBE_BYTES = 2 * 1024 * 1024;
const ABGLEICH_NACH_MS = 2 * 60 * 1000;
const ABGLEICH_LIMIT = 20;
const PENDING_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const HAENGT_NACH_MS = 10 * 60 * 1000;
/** Antworten des Anbieters, bei denen ein Retry nichts aendert. 401/403 nicht: das ist Konfiguration. */
const PERMANENT_STATUS = new Set([400, 404, 409, 413, 415, 422]);

const backoffSec = (versuche) => Math.min(BACKOFF_MAX_SEC, BACKOFF_BASIS_SEC * 2 ** Math.max(0, versuche - 1));

function istPermanent(err) {
  if (err?.permanent) return true;
  return err?.name === 'StreamError' && PERMANENT_STATUS.has(err.status);
}

const schluessel = (x) => ({ quelle: x.quelle, quelle_pfad: x.quelle_pfad, quelle_revision: x.quelle_revision });
const fehlerText = (err) => String(err?.message || err || 'Unbekannter Fehler').slice(0, 500);

/**
 * @param {{ db: object, stream: object, cfg: object, originalUrl: (key) => Promise<string>,
 *           fetchImpl?: typeof fetch, nowMs?: () => number, log?: Console }} deps
 */
function createVorschauVerarbeitung({
  db, stream, cfg, originalUrl,
  fetchImpl = (...a) => fetch(...a), nowMs = () => Date.now(), log = console,
}) {
  const jetzt = () => new Date(nowMs()).toISOString();

  async function check({ data, error }) {
    if (error) throw error;
    return data;
  }

  async function referenzen(key) {
    return check(await db.rpc('vorschau_referenzen', {
      p_quelle: key.quelle, p_pfad: key.quelle_pfad, p_revision: key.quelle_revision,
    }));
  }

  async function zeileZu(key) {
    return check(await db.from(TABLE).select(COLS).match(schluessel(key)).maybeSingle());
  }

  async function auftragAnlegen(art, key) {
    const { error } = await db.from(OUTBOX).insert({ art, ...schluessel(key) });
    // 23505: es gibt schon einen offenen Auftrag fuer den Schluessel
    if (error && error.code !== '23505') throw error;
  }

  async function markFailed(row, fehler) {
    await check(await db.from(TABLE)
      .update({ status: 'failed', fehler: String(fehler).slice(0, 500), updated_at: jetzt() })
      .eq('id', row.id).eq('status', 'pending'));
  }

  const touch = async (row) => check(await db.from(TABLE).update({ updated_at: jetzt() }).eq('id', row.id).eq('status', 'pending'));

  /* ---- Auftraege ---- */

  async function erzeugen(a) {
    const key = schluessel(a);
    await check(await db.from(TABLE).upsert(key, { onConflict: 'quelle,quelle_pfad,quelle_revision', ignoreDuplicates: true }));
    let row = await zeileZu(key);
    if (row.status === 'ready') return 'schon fertig';
    if (row.status === 'failed') {
      // Reprocessing: neuer Auftrag fuer einen gescheiterten Schluessel
      if (row.anbieter_id) await stream.deleteVideo(row.anbieter_id);
      row = (await check(await db.from(TABLE)
        .update({ status: 'pending', anbieter_id: null, fehler: null, updated_at: jetzt() })
        .eq('id', row.id).eq('status', 'failed').select(COLS)))[0] || await zeileZu(key);
    }
    if (row.anbieter_id) return 'beim Anbieter';

    const url = await originalUrl(key);
    const { uid } = await stream.copyFromUrl({
      url,
      name: a.quelle_pfad.split('/').pop(),
      meta: { vorschau_id: row.id, quelle: a.quelle, revision: a.quelle_revision },
    });
    const claimed = await check(await db.from(TABLE)
      .update({ anbieter_id: uid, versuche: a.versuche, updated_at: jetzt() })
      .eq('id', row.id).is('anbieter_id', null).select('id'));
    if (!claimed?.length) {
      // Ein paralleler Lauf war schneller (abgelaufene Lease): unser Upload ist ein Duplikat.
      await stream.deleteVideo(uid);
      return 'Duplikat verworfen';
    }
    return 'angestossen';
  }

  async function loeschen(a) {
    const key = schluessel(a);
    if (await referenzen(key) > 0) return 'noch referenziert';
    const row = await zeileZu(key);
    if (!row) return 'nichts da';
    if (row.anbieter_id) await stream.deleteVideo(row.anbieter_id);
    await check(await db.from(TABLE).delete().eq('id', row.id));
    // Zwischen Pruefung und Loeschen wieder referenziert (z. B. Promote): neu erzeugen.
    if (await referenzen(key) > 0) await auftragAnlegen('erzeugen', key);
    return 'geloescht';
  }

  /** Abschluss mit `versuche` als Fencing-Token: ein ueberholter Lauf schreibt nichts. */
  async function abschliessen(a, err = null) {
    const fenced = async (patch) => ((await check(await db.from(OUTBOX)
      .update({ ...patch, gesperrt_bis: null, updated_at: jetzt() })
      .eq('id', a.id).eq('versuche', a.versuche).eq('status', 'in_arbeit')
      .select('id'))) || []).length > 0;
    if (!err) {
      await fenced({ status: 'erledigt', fehler: null });
      return;
    }
    const endgueltig = istPermanent(err) || a.versuche >= MAX_VERSUCHE;
    const fehler = fehlerText(err);
    const getroffen = await fenced(endgueltig
      ? { status: 'failed', fehler }
      : { status: 'offen', fehler, naechster_versuch: new Date(nowMs() + backoffSec(a.versuche) * 1000).toISOString() });
    if (!getroffen) {
      log.warn(`[vorschau] Auftrag ${a.id}: überholt (Versuch ${a.versuche}), Abschluss verworfen`);
      return;
    }
    if (endgueltig && a.art === 'erzeugen') {
      await check(await db.from(TABLE)
        .update({ status: 'failed', fehler, versuche: a.versuche, updated_at: jetzt() })
        .match(schluessel(a)).eq('status', 'pending').is('anbieter_id', null));
    }
  }

  async function beimAnbieterInArbeit() {
    const { count, error } = await db.from(TABLE).select('id', { count: 'exact', head: true })
      .eq('status', 'pending').not('anbieter_id', 'is', null);
    if (error) throw error;
    return count || 0;
  }

  /** Faellige Auftraege claimen und abarbeiten (gedrosselt). */
  async function verarbeiteAuftraege({ maxParallel = MAX_PARALLEL } = {}) {
    const voll = await beimAnbieterInArbeit() >= MAX_BEIM_ANBIETER;
    const jobs = await check(await db.rpc('vorschau_auftraege_holen', {
      p_max_parallel: maxParallel,
      p_lease_sec: LEASE_SEC,
      p_arten: voll ? ['loeschen'] : ['erzeugen', 'loeschen'],
    }));
    const results = [];
    for (const a of jobs || []) {
      try {
        const ergebnis = a.art === 'erzeugen' ? await erzeugen(a) : await loeschen(a);
        await abschliessen(a);
        results.push({ id: a.id, art: a.art, ergebnis });
      } catch (err) {
        log.warn(`[vorschau] Auftrag ${a.id} (${a.art}, Versuch ${a.versuche}): ${fehlerText(err)}`);
        await abschliessen(a, err).catch((e) => log.error('[vorschau] Abschluss fehlgeschlagen', e));
        results.push({ id: a.id, art: a.art, fehler: fehlerText(err) });
      }
    }
    return results;
  }

  /* ---- Fertigstellen ---- */

  /** Signierter Abruf des Anfangs: liefert der Link wirklich eine lesbare MP4? */
  async function pruefeMp4(uid) {
    const url = downloadUrl(cfg, signStreamToken(cfg, uid, { ttlSec: 300 }));
    const resp = await fetchImpl(url, { headers: { Range: `bytes=0-${PROBE_BYTES - 1}` } });
    if (!resp.ok) return { ok: false, status: resp.status };
    const total = Number((resp.headers.get('content-range') || '').split('/')[1]) || null;
    const buf = Buffer.from(await resp.arrayBuffer());
    const probe = probeMp4(buf, total || buf.length);
    return { ok: true, probe: probe.fehler ? null : probe };
  }

  async function mp4Abschliessen(row, video) {
    let dl = await stream.getDownload(row.anbieter_id);
    if (!dl) dl = await stream.enableDownload(row.anbieter_id);
    if (dl?.status === 'error') {
      await markFailed(row, 'MP4-Download beim Anbieter fehlgeschlagen');
      return 'failed';
    }
    if (dl?.status !== 'ready') {
      await touch(row);
      return 'mp4 in Arbeit';
    }
    const check1 = await pruefeMp4(row.anbieter_id);
    if (!check1.ok) {
      // Nie "ready" ohne lieferbare Datei: Sweeper versucht es wieder, Timeout -> failed.
      log.warn(`[vorschau] ${row.id}: signierter Abruf ${check1.status}`);
      await touch(row);
      return 'Abruf fehlgeschlagen';
    }
    const p = check1.probe;
    if (p && !p.faststart) log.warn(`[vorschau] ${row.id}: MP4 ohne Faststart`);
    await check(await db.from(TABLE).update({
      status: 'ready',
      fehler: null,
      dauer: p?.dauer ?? video?.duration ?? null,
      fps: p?.fps ?? null,
      breite: p?.breite ?? video?.input?.width ?? null,
      hoehe: p?.hoehe ?? video?.input?.height ?? null,
      updated_at: jetzt(),
    }).eq('id', row.id).eq('status', 'pending'));
    return 'ready';
  }

  /* ---- Webhook ---- */

  async function zeileZuUid(uid) {
    return check(await db.from(TABLE).select(COLS).eq('anbieter', 'cloudflare_stream').eq('anbieter_id', uid).maybeSingle());
  }

  /**
   * Ereignis von Cloudflare (Video fertig oder fehlgeschlagen). Unbekannte uids mit unserer
   * vorschau_id im meta sind verwaiste Duplikate und werden geloescht; Videos ohne unser
   * meta gehoeren nicht uns und bleiben unberuehrt.
   */
  async function webhook(payload) {
    const uid = payload?.uid;
    if (!uid) return 'ohne uid';
    let row = await zeileZuUid(uid);
    const vorschauId = payload.meta?.vorschau_id;
    if (!row) {
      if (!vorschauId) return 'fremdes Video';
      const kandidat = await check(await db.from(TABLE).select(COLS).eq('id', vorschauId).maybeSingle());
      if (kandidat && !kandidat.anbieter_id) {
        // Webhook vor dem Speichern der uid (Absturz nach dem Upload): uid uebernehmen.
        row = (await check(await db.from(TABLE).update({ anbieter_id: uid, updated_at: jetzt() })
          .eq('id', kandidat.id).is('anbieter_id', null).select(COLS)))[0] || null;
      }
      if (!row) {
        await stream.deleteVideo(uid);
        return 'verwaist geloescht';
      }
    }
    if (row.status !== 'pending') return 'schon erledigt';
    const s = payload.status || {};
    if (s.state === 'error') {
      const code = s.errorReasonCode || s.errReasonCode || 'error';
      const text = s.errorReasonText || s.errReasonText || '';
      await markFailed(row, `${code}: ${text}`.trim());
      return 'failed';
    }
    if (!payload.readyToStream) return 'noch nicht bereit';
    return mp4Abschliessen(row, payload);
  }

  /* ---- Sweeper ---- */

  /** Haengende pending-Zeilen direkt beim Anbieter abgleichen (statt dem Webhook zu vertrauen). */
  async function abgleich() {
    const rows = await check(await db.from(TABLE).select(COLS)
      .eq('status', 'pending').not('anbieter_id', 'is', null)
      .lt('updated_at', new Date(nowMs() - ABGLEICH_NACH_MS).toISOString())
      .order('updated_at').limit(ABGLEICH_LIMIT));
    const results = [];
    for (const row of rows || []) {
      try {
        if (nowMs() - Date.parse(row.created_at) > PENDING_TIMEOUT_MS) {
          await markFailed(row, 'Timeout beim Anbieter');
          results.push({ id: row.id, ergebnis: 'timeout' });
          continue;
        }
        const video = await stream.getVideo(row.anbieter_id);
        if (video?.status?.state === 'error') {
          await markFailed(row, `${video.status.errorReasonCode || video.status.errReasonCode || 'error'}`);
          results.push({ id: row.id, ergebnis: 'failed' });
        } else if (!video?.readyToStream) {
          await touch(row);
          results.push({ id: row.id, ergebnis: 'in Arbeit' });
        } else {
          results.push({ id: row.id, ergebnis: await mp4Abschliessen(row, video) });
        }
      } catch (err) {
        if (err?.status === 404) {
          await markFailed(row, 'beim Anbieter nicht gefunden');
          results.push({ id: row.id, ergebnis: 'fehlt beim Anbieter' });
        } else {
          log.warn(`[vorschau] Abgleich ${row.id}: ${fehlerText(err)}`);
          results.push({ id: row.id, fehler: fehlerText(err) });
        }
      }
    }
    return results;
  }

  /** Zaehler fuer den Betrieb: haengend (pending > 10 min) und failed. */
  async function zaehler() {
    const seit = new Date(nowMs() - HAENGT_NACH_MS).toISOString();
    const count = async (query) => {
      const { count: n, error } = await query;
      if (error) throw error;
      return n || 0;
    };
    const [haengend, failed, auftraegeHaengend, auftraegeFailed] = await Promise.all([
      count(db.from(TABLE).select('id', { count: 'exact', head: true }).eq('status', 'pending').lt('created_at', seit)),
      count(db.from(TABLE).select('id', { count: 'exact', head: true }).eq('status', 'failed')),
      count(db.from(OUTBOX).select('id', { count: 'exact', head: true }).in('status', ['offen', 'in_arbeit']).lt('created_at', seit)),
      count(db.from(OUTBOX).select('id', { count: 'exact', head: true }).eq('status', 'failed')),
    ]);
    return { haengend, failed, auftraegeHaengend, auftraegeFailed };
  }

  return { verarbeiteAuftraege, webhook, abgleich, zaehler, _intern: { erzeugen, loeschen, abschliessen, mp4Abschliessen } };
}

/** Produktiv-Abhaengigkeiten aus der Env (Service-Client, Cloudflare, Dropbox). */
function vorschauAusEnv() {
  const { createClient } = require('@supabase/supabase-js');
  const { createStreamClient, streamConfig } = require('./cloudflare-stream');
  const { originalUrlFor } = require('./vorschau-quelle');
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase Service-Konfiguration fehlt (SUPABASE_URL / SUPABASE_SERVICE_KEY)');
  const cfg = streamConfig();
  return createVorschauVerarbeitung({
    db: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    stream: createStreamClient(cfg),
    cfg,
    originalUrl: (k) => originalUrlFor(k),
  });
}

module.exports = {
  createVorschauVerarbeitung,
  vorschauAusEnv,
  backoffSec,
  istPermanent,
  MAX_VERSUCHE,
};
