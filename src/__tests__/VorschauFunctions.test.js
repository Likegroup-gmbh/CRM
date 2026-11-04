import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';
import crypto from 'crypto';

// Vorschaudatei, Server-Seite (ADR 0061): Webhook-Signatur, lokale Token-Signierung,
// MP4-Probe, idempotenter Outbox-Konsument und vorschau-link.

const require = createRequire(import.meta.url);
const { verifyWebhookSignature, signStreamToken, downloadUrl } = require('../../netlify/functions/_shared/cloudflare-stream.js');
const { probeMp4 } = require('../../netlify/functions/_shared/mp4-probe.js');
const { createVorschauVerarbeitung, backoffSec } = require('../../netlify/functions/_shared/vorschau-verarbeitung.js');
const { createHandler: createLinkHandler } = require('../../netlify/functions/vorschau-link.js');
const { _secretOk } = require('../../netlify/functions/vorschau-verarbeiten.js');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const CFG = { keyId: 'kid-1', keyPem: Buffer.from(PEM).toString('base64'), customerCode: 'abc123', webhookSecret: 'whsec' };
const jwtPayload = (url) => JSON.parse(Buffer.from(url.split('/')[3].split('.')[1], 'base64url').toString());

/* ---- MP4-Fixture ---- */

const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
const box = (type, ...parts) => {
  const body = Buffer.concat(parts);
  return Buffer.concat([u32(body.length + 8), Buffer.from(type, 'latin1'), body]);
};
function mp4({ w = 1080, h = 1920, timescale = 30000, units = 300300, samples = 300, faststart = true } = {}) {
  const tkhd = box('tkhd', Buffer.alloc(76), u32(w * 65536), u32(h * 65536));
  const mdhd = box('mdhd', Buffer.alloc(12), u32(timescale), u32(units), Buffer.alloc(4));
  const hdlr = box('hdlr', Buffer.alloc(8), Buffer.from('vide'), Buffer.alloc(12));
  const stts = box('stts', Buffer.alloc(4), u32(1), u32(samples), u32(1001));
  const stsd = box('stsd', Buffer.alloc(4), u32(1), u32(16), Buffer.from('avc1'), Buffer.alloc(8));
  const moov = box('moov', box('trak', tkhd, box('mdia', mdhd, hdlr, box('minf', box('stbl', stsd, stts)))));
  const mdat = box('mdat', Buffer.alloc(4000));
  const ftyp = box('ftyp', Buffer.from('isom'), u32(0));
  return Buffer.concat(faststart ? [ftyp, moov, mdat] : [ftyp, mdat, moov]);
}

/* ---- Fake-Supabase (Teilmenge von supabase-js, In-Memory) ---- */

const TABLE = 'kooperation_video_vorschau';
const OUTBOX = 'kooperation_video_vorschau_auftrag';
const sameKey = (a, b) => a.quelle === b.quelle && a.quelle_pfad === b.quelle_pfad && a.quelle_revision === b.quelle_revision;

function fakeDb({ tables = {}, referenzen = () => 0 } = {}) {
  const data = { [TABLE]: [], [OUTBOX]: [], ...tables };
  let seq = 1;
  const rpc = {
    vorschau_referenzen: (args) => referenzen(args),
    vorschau_auftraege_holen: ({ p_max_parallel: max, p_arten: arten }) => {
      const faellig = data[OUTBOX].filter((a) => a.status === 'offen' && arten.includes(a.art)).slice(0, max);
      faellig.forEach((a) => { a.status = 'in_arbeit'; a.versuche += 1; });
      return faellig.map((a) => ({ ...a }));
    },
  };

  function from(table) {
    const filters = [];
    let op = 'select';
    let payload = null;
    let opts = {};
    let returning = false;
    let count = false;
    let single = false;
    let limitN = null;
    const rows = () => data[table];
    const matches = (r) => filters.every((f) => f(r));

    function run() {
      if (op === 'insert' || op === 'upsert') {
        const row = { ...payload };
        if (table === TABLE) {
          if (rows().some((r) => sameKey(r, row))) {
            return { data: null, error: op === 'upsert' && opts.ignoreDuplicates ? null : { code: '23505' } };
          }
          rows().push({ id: `v${seq++}`, anbieter: 'cloudflare_stream', anbieter_id: null, status: 'pending', versuche: 0, created_at: new Date().toISOString(), updated_at: '2000-01-01T00:00:00Z', ...row });
        } else {
          if (rows().some((r) => r.art === row.art && sameKey(r, row) && ['offen', 'in_arbeit'].includes(r.status))) {
            return { data: null, error: { code: '23505' } };
          }
          rows().push({ id: seq++, status: 'offen', versuche: 0, ...row });
        }
        return { data: null, error: null };
      }
      let hit = rows().filter(matches);
      if (op === 'update') {
        hit.forEach((r) => Object.assign(r, payload));
        return { data: returning ? hit.map((r) => ({ ...r })) : null, error: null };
      }
      if (op === 'delete') {
        data[table] = rows().filter((r) => !matches(r));
        return { data: null, error: null };
      }
      if (count) return { count: hit.length, data: null, error: null };
      if (limitN !== null) hit = hit.slice(0, limitN);
      if (single) return { data: hit[0] ? { ...hit[0] } : null, error: null };
      return { data: hit.map((r) => ({ ...r })), error: null };
    }

    const b = {
      select(_cols, o = {}) { if (op === 'select') count = !!o.count; else returning = true; return b; },
      insert(row) { op = 'insert'; payload = row; return b; },
      upsert(row, o) { op = 'upsert'; payload = row; opts = o || {}; return b; },
      update(patch) { op = 'update'; payload = patch; return b; },
      delete() { op = 'delete'; return b; },
      eq(c, v) { filters.push((r) => r[c] === v); return b; },
      is(c, v) { filters.push((r) => (r[c] ?? null) === v); return b; },
      not(c, _op, v) { filters.push((r) => (r[c] ?? null) !== v); return b; },
      lt(c, v) { filters.push((r) => r[c] < v); return b; },
      in(c, vs) { filters.push((r) => vs.includes(r[c])); return b; },
      match(obj) { Object.entries(obj).forEach(([c, v]) => filters.push((r) => r[c] === v)); return b; },
      order() { return b; },
      limit(n) { limitN = n; return b; },
      maybeSingle() { single = true; return b; },
      then(resolve, reject) { try { resolve(run()); } catch (e) { reject(e); } },
    };
    return b;
  }

  return { data, from, rpc: async (name, args) => ({ data: rpc[name](args), error: null }) };
}

function fakeStream() {
  const videos = new Map();
  let n = 0;
  return {
    videos,
    copyFromUrl: vi.fn(async ({ meta }) => {
      const uid = `cf${++n}`;
      videos.set(uid, { uid, meta, readyToStream: false, status: { state: 'queued' }, download: null, duration: 10.01 });
      return { uid };
    }),
    getVideo: vi.fn(async (uid) => {
      if (!videos.has(uid)) throw Object.assign(new Error('not found'), { name: 'StreamError', status: 404 });
      return videos.get(uid);
    }),
    getDownload: vi.fn(async (uid) => videos.get(uid)?.download || null),
    enableDownload: vi.fn(async (uid) => {
      const v = videos.get(uid);
      v.download = v.download || { status: 'inprogress' };
      return v.download;
    }),
    deleteVideo: vi.fn(async (uid) => videos.delete(uid)),
  };
}

const AUFTRAG = { art: 'erzeugen', quelle: 'dropbox', quelle_pfad: '/K/clip.mov', quelle_revision: '2026-11-01T10:00:00.000000Z' };
/** Vorschau-Zeile mit den Spalten-Defaults der Tabelle */
const zeile = (over) => ({
  quelle: AUFTRAG.quelle, quelle_pfad: AUFTRAG.quelle_pfad, quelle_revision: AUFTRAG.quelle_revision,
  anbieter: 'cloudflare_stream', anbieter_id: null, status: 'pending', versuche: 0,
  created_at: new Date().toISOString(), updated_at: '2000-01-01T00:00:00Z', ...over,
});

function setup({ referenzen, fetchImpl, originalUrl } = {}) {
  const db = fakeDb({ referenzen });
  const stream = fakeStream();
  const log = { warn: vi.fn(), error: vi.fn() };
  const mp4Antwort = vi.fn(async () => ({
    ok: true, status: 206,
    headers: new Map([['content-range', 'bytes 0-2097151/12500000']]),
    arrayBuffer: async () => mp4(),
  }));
  const v = createVorschauVerarbeitung({
    db, stream, cfg: CFG, log,
    originalUrl: originalUrl || vi.fn(async () => 'https://dropbox.test/tmp/clip.mov'),
    fetchImpl: fetchImpl || mp4Antwort,
  });
  return { db, stream, v, log, mp4Antwort };
}

/* ---- Tests ---- */

describe('Cloudflare Stream: Webhook-Signatur', () => {
  const body = JSON.stringify({ uid: 'cf1', readyToStream: true });
  const now = 1_800_000_000;
  const sign = (time, raw = body, secret = 'whsec') => `time=${time},sig1=${crypto.createHmac('sha256', secret).update(`${time}.${raw}`).digest('hex')}`;

  it('akzeptiert eine gültige Signatur', () => {
    expect(verifyWebhookSignature('whsec', sign(now), body, now)).toBe(true);
  });
  it('lehnt veränderten Body, falsches Secret und alte Zeitstempel ab', () => {
    expect(verifyWebhookSignature('whsec', sign(now), body.replace('true', 'false'), now)).toBe(false);
    expect(verifyWebhookSignature('whsec', sign(now, body, 'anders'), body, now)).toBe(false);
    expect(verifyWebhookSignature('whsec', sign(now - 600), body, now)).toBe(false);
    expect(verifyWebhookSignature('whsec', 'time=abc,sig1=zz', body, now)).toBe(false);
    expect(verifyWebhookSignature('', sign(now), body, now)).toBe(false);
  });
});

describe('Cloudflare Stream: lokal signierte Links', () => {
  it('RS256 mit kid, sub, exp und downloadable; PEM auch base64-kodiert', () => {
    const url = downloadUrl(CFG, signStreamToken(CFG, 'cf-uid', { ttlSec: 600, nowSec: 1000 }));
    expect(url).toMatch(/^https:\/\/customer-abc123\.cloudflarestream\.com\/[\w-]+\.[\w-]+\.[\w-]+\/downloads\/default\.mp4$/);
    const token = url.split('/')[3];
    const [h, p, s] = token.split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'RS256', kid: 'kid-1' });
    expect(jwtPayload(url)).toMatchObject({ sub: 'cf-uid', kid: 'kid-1', exp: 1600, downloadable: true });
    expect(crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, 'base64url'))).toBe(true);
  });
});

describe('MP4-Probe', () => {
  it('liest Auflösung, Bildrate, Dauer und Faststart', () => {
    expect(probeMp4(mp4())).toMatchObject({ codec: 'avc1', breite: 1080, hoehe: 1920, fps: 29.97, dauer: 10.01, faststart: true });
    expect(probeMp4(mp4({ faststart: false })).faststart).toBe(false);
  });
  it('reicht ein Anfangsstück, solange moov vollständig ist', () => {
    const file = mp4();
    expect(probeMp4(file.subarray(0, file.length - 3000), 5_000_000)).toMatchObject({ breite: 1080, kbps: 3996 });
    expect(probeMp4(file.subarray(0, 40)).fehler).toBeTruthy();
  });
});

describe('vorschau-verarbeiten: Outbox-Konsument', () => {
  it('erzeugt: Zeile pending, Cloudflare kopiert mit Schlüssel im meta', async () => {
    const { db, stream, v } = setup();
    await db.from(OUTBOX).insert(AUFTRAG);
    const [r] = await v.verarbeiteAuftraege();
    expect(r.ergebnis).toBe('angestossen');
    const row = db.data[TABLE][0];
    expect(row).toMatchObject({ status: 'pending', anbieter_id: 'cf1', quelle_pfad: '/K/clip.mov' });
    expect(stream.copyFromUrl).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://dropbox.test/tmp/clip.mov',
      meta: { vorschau_id: row.id, quelle: 'dropbox', revision: AUFTRAG.quelle_revision },
    }));
    expect(db.data[OUTBOX][0].status).toBe('erledigt');
  });

  it('ist idempotent: zweiter Auftrag für denselben Schlüssel kopiert nicht erneut', async () => {
    const { db, stream, v } = setup();
    await db.from(OUTBOX).insert(AUFTRAG);
    await v.verarbeiteAuftraege();
    db.data[OUTBOX].push({ id: 99, ...AUFTRAG, status: 'offen', versuche: 0 });
    const [r] = await v.verarbeiteAuftraege();
    expect(r.ergebnis).toBe('beim Anbieter');
    expect(stream.copyFromUrl).toHaveBeenCalledTimes(1);
  });

  it('verwirft das Duplikat, wenn ein überholter Lauf die uid schon gesetzt hat', async () => {
    const { db, stream, v } = setup();
    await db.from(OUTBOX).insert(AUFTRAG);
    stream.copyFromUrl.mockImplementationOnce(async () => {
      db.data[TABLE][0].anbieter_id = 'cf-anderer-lauf';
      return { uid: 'cf-duplikat' };
    });
    const [r] = await v.verarbeiteAuftraege();
    expect(r.ergebnis).toBe('Duplikat verworfen');
    expect(stream.deleteVideo).toHaveBeenCalledWith('cf-duplikat');
    expect(db.data[TABLE][0].anbieter_id).toBe('cf-anderer-lauf');
  });

  it('Retry mit Backoff, nach 5 Versuchen failed (Original-Fallback)', async () => {
    const originalUrl = vi.fn(async () => { throw new Error('Dropbox 500'); });
    const { db, v } = setup({ originalUrl });
    await db.from(OUTBOX).insert(AUFTRAG);
    await v.verarbeiteAuftraege();
    const a = db.data[OUTBOX][0];
    expect(a).toMatchObject({ status: 'offen', versuche: 1, fehler: 'Dropbox 500' });
    expect(Date.parse(a.naechster_versuch) - Date.now()).toBeGreaterThan(25_000);
    for (let i = 0; i < 4; i += 1) {
      a.status = 'offen';
      await v.verarbeiteAuftraege();
    }
    expect(a).toMatchObject({ status: 'failed', versuche: 5 });
    expect(db.data[TABLE][0].status).toBe('failed');
    expect([1, 2, 3, 6].map(backoffSec)).toEqual([30, 60, 120, 960]);
  });

  it('permanenter Fehler (Datei fehlt) scheitert sofort', async () => {
    const originalUrl = vi.fn(async () => { throw Object.assign(new Error('Dropbox 409'), { permanent: true }); });
    const { db, v } = setup({ originalUrl });
    await db.from(OUTBOX).insert(AUFTRAG);
    await v.verarbeiteAuftraege();
    expect(db.data[OUTBOX][0]).toMatchObject({ status: 'failed', versuche: 1 });
  });

  it('ein überholter Lauf (Lease abgelaufen) schreibt den Abschluss nicht', async () => {
    const { db, v } = setup();
    await db.from(OUTBOX).insert(AUFTRAG);
    const [a] = (await db.rpc('vorschau_auftraege_holen', { p_max_parallel: 3, p_arten: ['erzeugen'] })).data;
    db.data[OUTBOX][0].versuche = 2; // ein anderer Lauf hat neu geclaimt
    await v._intern.abschliessen(a);
    expect(db.data[OUTBOX][0].status).toBe('in_arbeit');

    await db.from(TABLE).upsert(zeile({}), { ignoreDuplicates: true });
    await v._intern.abschliessen(a, Object.assign(new Error('weg'), { permanent: true }));
    expect(db.data[OUTBOX][0].status).toBe('in_arbeit');
    expect(db.data[TABLE][0].status).toBe('pending');
  });

  it('löscht nur, wenn keine Asset-Zeile mehr auf den Schlüssel zeigt (Promote teilt die Datei)', async () => {
    let refs = 1;
    const { db, stream, v } = setup({ referenzen: () => refs });
    db.data[TABLE].push(zeile({ id: 'v1', anbieter_id: 'cf9', status: 'ready' }));
    stream.videos.set('cf9', {});
    await db.from(OUTBOX).insert({ ...AUFTRAG, art: 'loeschen' });
    expect((await v.verarbeiteAuftraege())[0].ergebnis).toBe('noch referenziert');
    expect(stream.deleteVideo).not.toHaveBeenCalled();

    refs = 0;
    await db.from(OUTBOX).insert({ ...AUFTRAG, art: 'loeschen' });
    expect((await v.verarbeiteAuftraege())[0].ergebnis).toBe('geloescht');
    expect(stream.deleteVideo).toHaveBeenCalledWith('cf9');
    expect(db.data[TABLE]).toHaveLength(0);
  });

  it('drosselt das Erzeugen, solange beim Anbieter zu viel in Arbeit ist', async () => {
    const { db, v } = setup();
    for (let i = 0; i < 10; i += 1) db.data[TABLE].push(zeile({ id: `x${i}`, quelle_revision: `r${i}`, anbieter_id: `cfx${i}` }));
    await db.from(OUTBOX).insert(AUFTRAG);
    await db.from(OUTBOX).insert({ ...AUFTRAG, art: 'loeschen', quelle_revision: 'alt' });
    const results = await v.verarbeiteAuftraege();
    expect(results.map((r) => r.art)).toEqual(['loeschen']);
    expect(db.data[OUTBOX].find((a) => a.art === 'erzeugen').status).toBe('offen');
  });
});

describe('vorschau-webhook', () => {
  async function angestossen(opts) {
    const s = setup(opts);
    await s.db.from(OUTBOX).insert(AUFTRAG);
    await s.v.verarbeiteAuftraege();
    return { ...s, row: s.db.data[TABLE][0] };
  }

  it('ready erst mit fertigem MP4 und erfolgreichem signiertem Abruf', async () => {
    const { db, stream, v, row, mp4Antwort } = await angestossen();
    const event = { uid: 'cf1', readyToStream: true, status: { state: 'ready' }, meta: { vorschau_id: row.id }, duration: 10.01 };
    expect(await v.webhook(event)).toBe('mp4 in Arbeit');
    expect(stream.enableDownload).toHaveBeenCalledWith('cf1');
    expect(db.data[TABLE][0].status).toBe('pending');

    stream.videos.get('cf1').download = { status: 'ready' };
    expect(await v.webhook(event)).toBe('ready');
    expect(db.data[TABLE][0]).toMatchObject({ status: 'ready', breite: 1080, hoehe: 1920, fps: 29.97, dauer: 10.01 });
    const [url, init] = mp4Antwort.mock.calls[0];
    expect(jwtPayload(url)).toMatchObject({ sub: 'cf1', downloadable: true });
    expect(init.headers.Range).toBe('bytes=0-2097151');
  });

  it('gleiches Ereignis zweimal ändert nichts', async () => {
    const { db, stream, v, row } = await angestossen();
    stream.videos.get('cf1').download = { status: 'ready' };
    const event = { uid: 'cf1', readyToStream: true, meta: { vorschau_id: row.id } };
    await v.webhook(event);
    const vorher = { ...db.data[TABLE][0] };
    expect(await v.webhook(event)).toBe('schon erledigt');
    expect(db.data[TABLE][0]).toEqual(vorher);
  });

  it('nie ready ohne lieferbare Datei', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 401, headers: new Map() }));
    const { db, stream, v, row } = await angestossen({ fetchImpl });
    stream.videos.get('cf1').download = { status: 'ready' };
    expect(await v.webhook({ uid: 'cf1', readyToStream: true, meta: { vorschau_id: row.id } })).toBe('Abruf fehlgeschlagen');
    expect(db.data[TABLE][0].status).toBe('pending');
  });

  it('Fehler beim Anbieter: failed mit Grund', async () => {
    const { db, v, row } = await angestossen();
    await v.webhook({ uid: 'cf1', readyToStream: false, status: { state: 'error', errorReasonCode: 'ERR_NON_VIDEO', errorReasonText: 'Kein Video' }, meta: { vorschau_id: row.id } });
    expect(db.data[TABLE][0]).toMatchObject({ status: 'failed', fehler: 'ERR_NON_VIDEO: Kein Video' });
  });

  it('übernimmt die uid, wenn der Webhook vor dem Speichern kommt', async () => {
    const { db, v } = setup();
    db.data[TABLE].push(zeile({ id: 'v7' }));
    expect(await v.webhook({ uid: 'cf-neu', readyToStream: false, meta: { vorschau_id: 'v7' } })).toBe('noch nicht bereit');
    expect(db.data[TABLE][0].anbieter_id).toBe('cf-neu');
  });

  it('löscht verwaiste Duplikate mit unserem meta, fremde Videos bleiben', async () => {
    const { db, stream, v } = setup();
    db.data[TABLE].push(zeile({ id: 'v7', anbieter_id: 'cf-echt' }));
    expect(await v.webhook({ uid: 'cf-dup', meta: { vorschau_id: 'v7' } })).toBe('verwaist geloescht');
    expect(stream.deleteVideo).toHaveBeenCalledWith('cf-dup');
    expect(await v.webhook({ uid: 'cf-fremd', meta: { name: 'spike' } })).toBe('fremdes Video');
    expect(stream.deleteVideo).toHaveBeenCalledTimes(1);
  });

  it('verspätetes Ereignis einer alten Revision schreibt nur seinen Datensatz', async () => {
    const { db, stream, v } = setup();
    db.data[TABLE].push(zeile({ id: 'alt', anbieter_id: 'cf-alt' }));
    db.data[TABLE].push(zeile({ id: 'neu', quelle_revision: 'neu', anbieter_id: 'cf-neu' }));
    stream.videos.set('cf-alt', { download: { status: 'ready' } });
    await v.webhook({ uid: 'cf-alt', readyToStream: true, meta: { vorschau_id: 'alt' } });
    expect(db.data[TABLE].find((r) => r.id === 'alt').status).toBe('ready');
    expect(db.data[TABLE].find((r) => r.id === 'neu').status).toBe('pending');
  });
});

describe('vorschau-sweeper: Abgleich', () => {
  it('gleicht hängende Zeilen direkt beim Anbieter ab', async () => {
    const { db, stream, v } = setup();
    db.data[TABLE].push(
      zeile({ id: 'a', anbieter_id: 'cf-a' }),
      zeile({ id: 'b', quelle_revision: 'b', anbieter_id: 'cf-weg' }),
      zeile({ id: 'c', quelle_revision: 'c', anbieter_id: 'cf-c', created_at: '2000-01-01T00:00:00Z' })
    );
    stream.videos.set('cf-a', { readyToStream: true, download: { status: 'ready' } });
    stream.videos.set('cf-c', { readyToStream: false });
    const results = await v.abgleich();
    expect(results.map((r) => [r.id, r.ergebnis])).toEqual([['a', 'ready'], ['b', 'fehlt beim Anbieter'], ['c', 'timeout']]);
    expect((await v.zaehler()).failed).toBe(2);
  });
});

describe('vorschau-link', () => {
  const A1 = '11111111-1111-4111-8111-111111111111';
  const A2 = '22222222-2222-4222-8222-222222222222';
  const FINAL = '33333333-3333-4333-8333-333333333333';
  const service = fakeDb({ tables: { [TABLE]: [{ id: 'v1', anbieter_id: 'cf-1', status: 'ready' }] } });
  // RLS-Ersatz: Kunde sieht A1 und dessen Finale Version (gleiche Vorschaudatei), nicht A2
  const VIEW = {
    'jwt-kunde': [
      { asset_id: A1, vorschau_id: 'v1', status: 'ready' },
      { asset_id: FINAL, vorschau_id: 'v1', status: 'ready' },
    ],
  };
  const handler = createLinkHandler({
    callerClient: (jwt) => (jwt === 'jwt-kaputt'
      ? { from: () => ({ select: () => ({ in: () => ({ eq: async () => ({ data: null, error: { code: 'PGRST301', message: 'JWT expired' } }) }) }) }) }
      : fakeDb({ tables: { kooperation_video_vorschau_je_asset: VIEW[jwt] || [] } })),
    serviceClient: () => service,
    cfg: () => CFG,
    nowSec: () => 1000,
  });
  const call = (jwt, body) => handler({ httpMethod: 'POST', headers: jwt ? { authorization: `Bearer ${jwt}` } : {}, body: JSON.stringify(body) });

  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));

  it('ohne Login 401', async () => {
    expect((await call(null, { assetIds: [A1] })).statusCode).toBe(401);
  });

  it('signiert nur, was der Aufrufer unter RLS sieht; Promote nutzt die Vorschau der Quelle', async () => {
    const res = await call('jwt-kunde', { assetIds: [A1, A2, FINAL, 'kein-uuid'] });
    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(Object.keys(body.links).sort()).toEqual([A1, FINAL].sort());
    expect(jwtPayload(body.links[A1])).toMatchObject({ sub: 'cf-1', downloadable: true, exp: 1000 + 4 * 3600 });
    expect(jwtPayload(body.links[FINAL]).sub).toBe('cf-1');
    expect(body.ttlSec).toBe(4 * 3600);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('fremder oder abgelaufener Zugang bekommt keine Links (Client spielt das Original)', async () => {
    expect(JSON.parse((await call('jwt-fremd', { assetIds: [A1] })).body).links).toEqual({});
    expect((await call('jwt-kaputt', { assetIds: [A1] })).statusCode).toBe(401);
  });
});

describe('vorschau-verarbeiten: Anstoß', () => {
  it('nur mit dem gemeinsamen Secret', () => {
    process.env.VORSCHAU_WEBHOOK_SECRET = 'geheim';
    expect(_secretOk({ headers: { 'x-vorschau-secret': 'geheim' } })).toBe(true);
    expect(_secretOk({ headers: { 'x-vorschau-secret': 'falsch' } })).toBe(false);
    expect(_secretOk({ headers: {} })).toBe(false);
    delete process.env.VORSCHAU_WEBHOOK_SECRET;
    expect(_secretOk({ headers: { 'x-vorschau-secret': '' } })).toBe(false);
  });
});
