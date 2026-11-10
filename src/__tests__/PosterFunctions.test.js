import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';
import crypto from 'crypto';

// Poster-Functions (ADR 0064):
// - poster-urls: Links nur fuer Assets, die der Aufrufer unter RLS sieht; Read-Repair legt
//   fehlende Schluessel idempotent an und stoesst nur bei wirklich neuen an.
// - Generator: Batches zu 25, Abschluss nur mit dem versuche-Stand des Claims (Fencing),
//   permanent -> failed, voruebergehend -> Backoff, Batch-Fehler -> Lease frei ohne Versuch.
// - Abgleich und Background Function: Anstossen nur bei offenem Bestand, nur mit Secret.

const require = createRequire(import.meta.url);
const posterShared = require('../../netlify/functions/_shared/poster.js');
const generatorPath = require.resolve('../../netlify/functions/_shared/poster-generator.js');
const generator = require(generatorPath);
const { createHandler, TTL_SEC } = require('../../netlify/functions/poster-urls.js');

const ENV_KEYS = ['POSTER_SECRET', 'URL', 'DEPLOY_PRIME_URL', 'SUPABASE_SERVICE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const envVorher = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
beforeEach(() => {
  ENV_KEYS.forEach((k) => delete process.env[k]);
});
afterEach(() => {
  vi.unstubAllGlobals();
});
afterAll(() => {
  ENV_KEYS.forEach((k) => {
    if (envVorher[k] === undefined) delete process.env[k];
    else process.env[k] = envVorher[k];
  });
});

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const post = (body, jwt = 'jwt-kunde') => ({
  httpMethod: 'POST',
  headers: jwt ? { authorization: `Bearer ${jwt}` } : {},
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const antwort = (res) => ({ status: res.statusCode, ...JSON.parse(res.body) });

/** Fake-Supabase: Aufrufer sieht nur `sichtbar[tabelle]`, service liest `stand`. */
function fakeDb({ sichtbar = {}, stand = [], vorhanden = new Set(), rlsFehler = null } = {}) {
  const calls = { caller: [], stand: [], upserts: [], signed: [] };
  const caller = {
    from: (table) => ({
      select: () => ({
        in: async (_col, ids) => {
          calls.caller.push({ table, ids });
          if (rlsFehler) return { data: null, error: rlsFehler };
          return { data: ids.filter((id) => (sichtbar[table] || []).includes(id)).map((id) => ({ id })), error: null };
        },
      }),
    }),
  };
  const service = {
    from: (table) => {
      if (table === 'asset_poster_je_asset') {
        return {
          select: () => ({
            in: async (_col, ids) => {
              calls.stand.push(ids);
              return { data: stand.filter((r) => ids.includes(r.asset_id)), error: null };
            },
          }),
        };
      }
      return {
        upsert: (rows, opts) => ({
          select: async () => {
            calls.upserts.push({ table, rows, opts });
            const neu = rows.filter((r) => !vorhanden.has(`${r.file_path}\n${r.revision}`));
            neu.forEach((r) => vorhanden.add(`${r.file_path}\n${r.revision}`));
            return { data: neu.map((r) => ({ file_path: r.file_path })), error: null };
          },
        }),
      };
    },
    storage: {
      from: (bucket) => ({
        createSignedUrls: async (paths, ttl) => {
          calls.signed.push({ bucket, paths, ttl });
          return { data: paths.map((p) => ({ path: p, signedUrl: `https://sb.test/${p}?ttl=${ttl}`, error: null })), error: null };
        },
      }),
    },
  };
  return { caller, service, calls };
}

function handlerMit(db) {
  const anstossen = vi.fn(async () => true);
  const handler = createHandler({ callerClient: () => db.caller, serviceClient: () => db.service, anstossen });
  return { handler, anstossen };
}

const zeile = (id, extra = {}) => ({
  typ: 'video', asset_id: id, file_path: `/K/${id}.mp4`, revision: '2026-11-01T10:00:00.000000Z',
  status: null, storage_path: null, ...extra,
});

describe('poster-urls', () => {
  it('lehnt GET, fehlende Anmeldung und kaputtes JSON ab', async () => {
    const { handler } = handlerMit(fakeDb());
    expect((await handler({ httpMethod: 'GET', headers: {} })).statusCode).toBe(405);
    expect((await handler(post({ items: [] }, null))).statusCode).toBe(401);
    expect((await handler(post('{kaputt'))).statusCode).toBe(400);
  });

  it('signiert nur Poster von Assets, die der Aufrufer unter RLS sieht', async () => {
    const [a, b] = [uuid(1), uuid(2)];
    const db = fakeDb({
      sichtbar: { kooperation_video_asset: [a] },
      stand: [
        zeile(a, { status: 'ready', storage_path: 'ab/a.webp' }),
        zeile(b, { status: 'ready', storage_path: 'cd/b.webp' }),
      ],
    });
    const { handler } = handlerMit(db);
    const res = antwort(await handler(post({ items: [{ typ: 'video', id: a }, { typ: 'video', id: b }] })));

    expect(res.status).toBe(200);
    expect(res.posters).toEqual({ [a]: `https://sb.test/ab/a.webp?ttl=${TTL_SEC}` });
    expect(res.ohne).toEqual([b]);
    expect(res.ttlSec).toBe(600);
    expect(db.calls.stand).toEqual([[a]]);
    expect(db.calls.signed).toEqual([{ bucket: 'video-posters', paths: ['ab/a.webp'], ttl: 600 }]);
  });

  it('prueft die Tabelle zum angegebenen Typ und verlangt passenden Typ im Stand', async () => {
    const id = uuid(3);
    const db = fakeDb({
      sichtbar: { kooperation_bilder_asset: [id] },
      stand: [zeile(id, { typ: 'video', status: 'ready', storage_path: 'x/y.webp' })],
    });
    const { handler } = handlerMit(db);
    const res = antwort(await handler(post({ items: [{ typ: 'still', id }] })));

    expect(db.calls.caller).toEqual([{ table: 'kooperation_bilder_asset', ids: [id] }]);
    expect(res.posters).toEqual({});
    expect(res.ohne).toEqual([id]);
  });

  it('meldet pending als ausstehend und failed als ohne', async () => {
    const [p, f] = [uuid(4), uuid(5)];
    const db = fakeDb({
      sichtbar: { kooperation_video_asset: [p, f] },
      stand: [zeile(p, { status: 'pending' }), zeile(f, { status: 'failed' })],
    });
    const { handler, anstossen } = handlerMit(db);
    const res = antwort(await handler(post({ items: [{ typ: 'video', id: p }, { typ: 'video', id: f }] })));

    expect(res.ausstehend).toEqual([p]);
    expect(res.ohne).toEqual([f]);
    expect(db.calls.upserts).toHaveLength(0);
    expect(anstossen).not.toHaveBeenCalled();
  });

  it('Read-Repair: legt fehlende Schluessel einmal an und stoesst nur bei neuen an', async () => {
    const [a, b] = [uuid(6), uuid(7)];
    // b ist eine Story mit derselben Datei und Revision: ein Schluessel, ein Poster
    const db = fakeDb({
      sichtbar: { kooperation_video_asset: [a], kooperation_story_asset: [b] },
      stand: [zeile(a), zeile(b, { typ: 'story', file_path: `/K/${a}.mp4` })],
    });
    const { handler, anstossen } = handlerMit(db);
    const body = { items: [{ typ: 'video', id: a }, { typ: 'story', id: b }] };

    const erste = antwort(await handler(post(body)));
    expect(erste.ausstehend).toEqual([a, b]);
    expect(db.calls.upserts).toHaveLength(1);
    expect(db.calls.upserts[0]).toMatchObject({
      table: 'asset_poster',
      rows: [{ file_path: `/K/${a}.mp4`, revision: '2026-11-01T10:00:00.000000Z' }],
      opts: { onConflict: 'file_path,revision', ignoreDuplicates: true },
    });
    expect(anstossen).toHaveBeenCalledTimes(1);

    // Zweiter Client fragt, bevor der Erzeuger lief: Upsert ist ein No-op, kein zweiter Anstoss
    await handler(post(body));
    expect(db.calls.upserts).toHaveLength(2);
    expect(anstossen).toHaveBeenCalledTimes(1);
  });

  it('ignoriert ungueltige IDs, unbekannte Typen und Doppelte ohne DB-Zugriff', async () => {
    const db = fakeDb();
    const { handler } = handlerMit(db);
    const res = antwort(await handler(post({
      items: [{ typ: 'video', id: 'kein-uuid' }, { typ: 'ordner', id: uuid(8) }, { typ: 'video', id: "x' or 1=1" }],
    })));
    expect(res).toMatchObject({ status: 200, posters: {}, ausstehend: [], ohne: [] });
    expect(db.calls.caller).toHaveLength(0);

    const id = uuid(9);
    await handler(post({ items: [{ typ: 'video', id }, { typ: 'video', id }, { typ: 'story', id }] }));
    expect(db.calls.caller).toEqual([{ table: 'kooperation_video_asset', ids: [id] }]);
  });

  it('fragt grosse Mengen in Bloecken von 100 und hoechstens 200 Items', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => uuid(100 + i));
    const db = fakeDb({ sichtbar: { kooperation_video_asset: ids } });
    const { handler } = handlerMit(db);
    await handler(post({ items: ids.map((id) => ({ typ: 'video', id })) }));
    expect(db.calls.caller.map((c) => c.ids.length)).toEqual([100, 100]);
    expect(db.calls.stand.map((c) => c.length)).toEqual([100, 100]);
  });

  it('gibt bei abgelaufenem JWT 401 zurueck', async () => {
    const db = fakeDb({ rlsFehler: { code: 'PGRST301', message: 'JWT expired' } });
    const { handler } = handlerMit(db);
    expect((await handler(post({ items: [{ typ: 'video', id: uuid(10) }] }))).statusCode).toBe(401);
  });
});

/** Fake-Service fuer den Generator: protokolliert Updates samt Filtern, Uploads, RPCs. */
function fakeService({ claims = [], verwaist = [], stand = null } = {}) {
  const log = { updates: [], uploads: [], removed: [], rpcs: [] };
  const service = {
    from: (table) => ({
      update: (felder) => {
        const eintrag = { table, felder, eq: {} };
        log.updates.push(eintrag);
        const chain = {
          eq: (col, val) => { eintrag.eq[col] = val; return chain; },
          then: (res, rej) => Promise.resolve({ error: null }).then(res, rej),
        };
        return chain;
      },
    }),
    rpc: async (name, args) => {
      log.rpcs.push({ name, args });
      if (name === 'poster_auftraege_holen') return { data: claims.shift() || [], error: null };
      if (name === 'poster_verwaiste_entfernen') return { data: verwaist, error: null };
      return { data: [stand], error: null };
    },
    storage: {
      from: (bucket) => ({
        upload: async (path, data, opts) => { log.uploads.push({ bucket, path, data, opts }); return { error: null }; },
        remove: async (paths) => { log.removed.push(paths); return { error: null }; },
      }),
    },
  };
  return { service, log };
}

const fakeSharp = () => ({
  rotate() { return this; },
  resize() { return this; },
  webp() { return this; },
  toBuffer: async () => ({ data: Buffer.from('webp-bytes'), info: { width: 480, height: 853 } }),
});
const auftrag = (n, versuche = 1) => ({ file_path: `/K/v${n}.mov`, revision: 'r1', art: 'video', versuche });
const T0 = Date.parse('2026-11-06T12:00:00Z');

describe('poster-generator', () => {
  it('speichert fertige Poster deterministisch und schliesst mit Fencing ab', async () => {
    const { service, log } = fakeService();
    const gen = generator.createPosterGenerator({
      service,
      sharp: fakeSharp,
      now: () => T0,
      thumbnails: async (paths) => paths.map(() => ({ ok: true, buffer: Buffer.from('jpg') })),
    });

    const [e] = await gen.verarbeite([auftrag(1, 2)]);
    const pfad = generator.storagePathFor('/K/v1.mov', 'r1');

    expect(e).toEqual({ file_path: '/K/v1.mov', status: 'ready' });
    expect(log.uploads).toEqual([{
      bucket: 'video-posters', path: pfad, data: Buffer.from('webp-bytes'),
      opts: { contentType: 'image/webp', cacheControl: '31536000', upsert: true },
    }]);
    expect(log.updates[0].eq).toEqual({ file_path: '/K/v1.mov', revision: 'r1', versuche: 2 });
    expect(log.updates[0].felder).toMatchObject({
      status: 'ready', storage_path: pfad, breite: 480, hoehe: 853, bytes: 10, fehler: null, gesperrt_bis: null,
    });
  });

  it('storagePathFor ist stabil und haengt an Datei und Revision', () => {
    const a = generator.storagePathFor('/K/v.mov', 'r1');
    expect(generator.storagePathFor('/K/v.mov', 'r1')).toBe(a);
    expect(generator.storagePathFor('/K/v.mov', 'r2')).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{2}\/[0-9a-f]{64}\.webp$/);
    expect(a.slice(0, 2)).toBe(a.slice(3, 5));
  });

  it('holt Thumbnails in Batches zu 25', async () => {
    const { service } = fakeService();
    const thumbnails = vi.fn(async (paths) => paths.map(() => ({ ok: true, buffer: Buffer.from('jpg') })));
    const gen = generator.createPosterGenerator({ service, sharp: fakeSharp, thumbnails });
    await gen.verarbeite(Array.from({ length: 30 }, (_, i) => auftrag(i)));
    expect(thumbnails.mock.calls.map((c) => c[0].length)).toEqual([25, 5]);
  });

  it('permanent -> failed, voruebergehend -> Backoff, nach 3 Versuchen -> failed', async () => {
    const { service, log } = fakeService();
    const gen = generator.createPosterGenerator({
      service,
      sharp: fakeSharp,
      now: () => T0,
      thumbnails: async () => [
        { ok: false, fehler: 'dropbox:unsupported_extension', permanent: true },
        { ok: false, fehler: 'dropbox:conversion_error', permanent: false },
        { ok: false, fehler: 'dropbox:conversion_error', permanent: false },
      ],
    });

    const status = (await gen.verarbeite([auftrag(1, 1), auftrag(2, 2), auftrag(3, 3)])).map((e) => e.status);
    expect(status).toEqual(['failed', 'pending', 'failed']);

    const [perm, backoff, aus] = log.updates.map((u) => u.felder);
    expect(perm).toMatchObject({ status: 'failed', fehler: 'dropbox:unsupported_extension' });
    // Versuch 2: 60 s * 2^1
    expect(backoff).toMatchObject({ status: 'pending', naechster_versuch: new Date(T0 + 120_000).toISOString() });
    expect(aus).toMatchObject({ status: 'failed' });
    expect(log.updates.map((u) => u.eq.versuche)).toEqual([1, 2, 3]);
  });

  it('Batch-Fehler gibt die Lease frei, ohne einen Versuch zu verbrauchen', async () => {
    const { service, log } = fakeService();
    const gen = generator.createPosterGenerator({
      service,
      now: () => T0,
      thumbnails: async () => { throw new generator.BatchError('Dropbox 429: too_many_requests', 30); },
    });

    const [e] = await gen.verarbeite([auftrag(1, 2)]);
    expect(e.status).toBe('freigegeben');
    expect(log.updates[0].eq.versuche).toBe(2);
    expect(log.updates[0].felder).toMatchObject({
      versuche: 1, gesperrt_bis: null, naechster_versuch: new Date(T0 + 30_000).toISOString(),
    });
    expect(log.updates[0].felder.status).toBeUndefined();
  });

  it('ein Upload-Fehler zaehlt als voruebergehender Fehler', async () => {
    const { service, log } = fakeService();
    service.storage.from = () => ({ upload: async () => ({ error: { message: 'Bucket weg' } }) });
    const gen = generator.createPosterGenerator({
      service, sharp: fakeSharp, now: () => T0,
      thumbnails: async () => [{ ok: true, buffer: Buffer.from('jpg') }],
    });
    const [e] = await gen.verarbeite([auftrag(1, 1)]);
    expect(e.status).toBe('pending');
    expect(log.updates[0].felder.fehler).toContain('Bucket weg');
  });

  it('lauf claimt, bis weniger als ein voller Batch kommt', async () => {
    const voll = Array.from({ length: 25 }, (_, i) => auftrag(i));
    const { service, log } = fakeService({ claims: [voll, [auftrag(99)]] });
    const gen = generator.createPosterGenerator({
      service, sharp: fakeSharp,
      thumbnails: async (paths) => paths.map(() => ({ ok: true, buffer: Buffer.from('jpg') })),
    });
    const summe = await gen.lauf();
    expect(summe).toMatchObject({ verarbeitet: 26, ready: 26, mehr: false });
    expect(log.rpcs.filter((r) => r.name === 'poster_auftraege_holen')).toHaveLength(2);
  });

  it('lauf meldet mehr, wenn das Zeitbudget aus ist', async () => {
    let t = 0;
    const voll = () => Array.from({ length: 25 }, (_, i) => auftrag(i));
    const { service } = fakeService({ claims: [voll(), voll(), voll()] });
    const gen = generator.createPosterGenerator({
      service, sharp: fakeSharp,
      now: () => t,
      thumbnails: async (paths) => { t += 1000; return paths.map(() => ({ ok: true, buffer: Buffer.from('jpg') })); },
    });
    const summe = await gen.lauf({ budgetMs: 1500 });
    expect(summe.mehr).toBe(true);
    expect(summe.verarbeitet).toBe(50);
  });

  it('verwaisteEntfernen loescht die Dateien im Bucket in Bloecken', async () => {
    const verwaist = Array.from({ length: 150 }, (_, i) => ({ storage_path: `aa/${i}.webp` }));
    verwaist.push({ storage_path: null });
    const { service, log } = fakeService({ verwaist });
    const gen = generator.createPosterGenerator({ service });
    expect(await gen.verwaisteEntfernen()).toBe(151);
    expect(log.removed.map((r) => r.length)).toEqual([100, 50]);
  });
});

describe('dropboxThumbnails', () => {
  it('ordnet Ergebnisse den Pfaden zu und erkennt dauerhafte Fehler', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        entries: [
          { '.tag': 'success', metadata: {}, thumbnail: Buffer.from('jpg').toString('base64') },
          { '.tag': 'failure', failure: { '.tag': 'path', path: { '.tag': 'not_found' } } },
          { '.tag': 'failure', failure: { '.tag': 'unsupported_extension' } },
          { '.tag': 'failure', failure: { '.tag': 'conversion_error' } },
        ],
      }),
    }));
    const paths = ['/a.mov', '/b.mov', '/c.mkv', '/d.mov'];
    const out = await generator.dropboxThumbnails(paths, { fetchImpl, token: async () => 'tok' });

    expect(out[0]).toEqual({ ok: true, buffer: Buffer.from('jpg') });
    expect(out[1]).toEqual({ ok: false, fehler: 'dropbox:path/not_found', permanent: true });
    expect(out[2]).toEqual({ ok: false, fehler: 'dropbox:unsupported_extension', permanent: true });
    expect(out[3]).toEqual({ ok: false, fehler: 'dropbox:conversion_error', permanent: false });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://content.dropboxapi.com/2/files/get_thumbnail_batch');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body).entries[0]).toEqual({ path: '/a.mov', format: 'jpeg', size: 'w480h320', mode: 'fitone_bestfit' });
  });

  it('wirft bei HTTP-Fehlern einen BatchError mit Retry-After', async () => {
    const fetchImpl = async () => ({
      ok: false, status: 429, text: async () => 'too_many_requests',
      headers: { get: (h) => (h === 'retry-after' ? '30' : null) },
    });
    const err = await generator.dropboxThumbnails(['/a.mov'], { fetchImpl, token: async () => 'tok' }).catch((e) => e);
    expect(err).toBeInstanceOf(generator.BatchError);
    expect(err.retryAfterSec).toBe(30);
  });
});

describe('toWebp (sharp)', () => {
  it('verkleinert Hochformat auf 480 px Breite und vergroessert nichts', async () => {
    const sharp = require('sharp');
    const jpeg = (width, height) => sharp({
      create: { width, height, channels: 3, background: { r: 200, g: 80, b: 40 } },
    }).jpeg().toBuffer();

    const gross = await generator.toWebp(await jpeg(1080, 1920), sharp);
    expect(gross).toMatchObject({ breite: 480, hoehe: 853 });
    expect((await sharp(gross.data).metadata()).format).toBe('webp');

    const klein = await generator.toWebp(await jpeg(200, 100), sharp);
    expect(klein).toMatchObject({ breite: 200, hoehe: 100 });
  });
});

describe('Secret und Anstossen', () => {
  it('nimmt POSTER_SECRET oder leitet es aus dem Service-Key ab', () => {
    process.env.SUPABASE_SERVICE_KEY = 'service-key';
    const abgeleitet = crypto.createHash('sha256').update('poster-erzeugen:service-key').digest('hex');
    expect(posterShared.posterSecret()).toBe(abgeleitet);
    process.env.POSTER_SECRET = 'geheim';
    expect(posterShared.posterSecret()).toBe('geheim');
  });

  it('secretOk vergleicht exakt und lehnt Fehlendes ab', () => {
    process.env.POSTER_SECRET = 'geheim';
    expect(posterShared.secretOk({ headers: { 'x-poster-secret': 'geheim' } })).toBe(true);
    expect(posterShared.secretOk({ headers: { 'x-poster-secret': 'geheiM' } })).toBe(false);
    expect(posterShared.secretOk({ headers: { 'x-poster-secret': 'geheim2' } })).toBe(false);
    expect(posterShared.secretOk({ headers: {} })).toBe(false);
    delete process.env.POSTER_SECRET;
    expect(posterShared.secretOk({ headers: { 'x-poster-secret': '' } })).toBe(false);
  });

  it('erzeugungAnstossen ruft die Background Function der eigenen Umgebung', async () => {
    process.env.POSTER_SECRET = 'geheim';
    process.env.DEPLOY_PRIME_URL = 'https://branch--crm.netlify.app/';
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    expect(await posterShared.erzeugungAnstossen({}, { fetchImpl })).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://branch--crm.netlify.app/.netlify/functions/poster-erzeugen-background');
    expect(init.headers['x-poster-secret']).toBe('geheim');
  });

  it('erzeugungAnstossen schluckt Netzfehler', async () => {
    process.env.POSTER_SECRET = 'geheim';
    process.env.URL = 'https://crm.test';
    const fetchImpl = async () => { throw new Error('timeout'); };
    expect(await posterShared.erzeugungAnstossen({}, { fetchImpl })).toBe(false);
  });
});

describe('poster-abgleich und poster-erzeugen-background', () => {
  const fakeGen = { verwaisteEntfernen: vi.fn(), stand: vi.fn(), lauf: vi.fn() };
  let abgleich;
  let erzeugen;
  const fetchMock = vi.fn(async () => ({ ok: true }));

  beforeAll(() => {
    // posterAusEnv vor dem ersten Laden der Handler austauschen
    require.cache[generatorPath].exports = { ...generator, posterAusEnv: () => fakeGen };
    abgleich = require('../../netlify/functions/poster-abgleich.js').handler;
    erzeugen = require('../../netlify/functions/poster-erzeugen-background.js').handler;
  });
  afterAll(() => {
    require.cache[generatorPath].exports = generator;
  });
  beforeEach(() => {
    process.env.POSTER_SECRET = 'geheim';
    process.env.URL = 'https://crm.test';
    fetchMock.mockClear();
    Object.values(fakeGen).forEach((fn) => fn.mockReset());
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('Abgleich stoesst nur an, wenn Poster offen sind', async () => {
    fakeGen.verwaisteEntfernen.mockResolvedValue(2);
    fakeGen.stand.mockResolvedValue({ soll: 10, ready: 7, failed: 1, offen: 2 });
    const res = JSON.parse((await abgleich({})).body);
    expect(res).toMatchObject({ verwaist: 2, angestossen: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://crm.test/.netlify/functions/poster-erzeugen-background');

    fakeGen.stand.mockResolvedValue({ soll: 10, ready: 9, failed: 1, offen: 0 });
    await abgleich({});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('Abgleich laeuft weiter, wenn das Aufraeumen scheitert', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fakeGen.verwaisteEntfernen.mockRejectedValue(new Error('RPC weg'));
    fakeGen.stand.mockResolvedValue({ soll: 1, ready: 0, failed: 0, offen: 1 });
    const res = await abgleich({});
    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('Background Function verlangt POST und das Secret', async () => {
    expect((await erzeugen({ httpMethod: 'GET', headers: {} })).statusCode).toBe(405);
    expect((await erzeugen({ httpMethod: 'POST', headers: { 'x-poster-secret': 'falsch' } })).statusCode).toBe(401);
    expect(fakeGen.lauf).not.toHaveBeenCalled();
  });

  it('Background Function stoesst sich nur bei Restbestand selbst wieder an', async () => {
    const event = { httpMethod: 'POST', headers: { 'x-poster-secret': 'geheim' } };
    fakeGen.lauf.mockResolvedValue({ verarbeitet: 3, ready: 3, mehr: false });
    expect((await erzeugen(event)).statusCode).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();

    fakeGen.lauf.mockResolvedValue({ verarbeitet: 600, ready: 600, mehr: true });
    await erzeugen(event);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fakeGen.lauf).toHaveBeenLastCalledWith({ budgetMs: 12 * 60 * 1000 });
  });
});
