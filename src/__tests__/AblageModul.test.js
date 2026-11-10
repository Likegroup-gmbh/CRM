import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
import crypto from 'node:crypto';
import { createFakeSupabase, createFakeSharePoint, ORDNER_UNIQUE } from './fixtures/fakeSupabase.js';

const require = createRequire(import.meta.url);
const pfad = require('../../netlify/functions/_shared/ablage/pfad.js');
const { clientAssertion, createTokenQuelle } = require('../../netlify/functions/_shared/ablage/graph-auth.js');
const { createHttp, batch, GraphError } = require('../../netlify/functions/_shared/ablage/graph.js');
const { ablageZiel } = require('../../netlify/functions/_shared/ablage/ziel.js');
const { createOrdner } = require('../../netlify/functions/_shared/ablage/ordner.js');
const { itemZuEingang } = require('../../netlify/functions/_shared/ablage/sharepoint.js');
const asset = require('../../netlify/functions/_shared/ablage/asset.js');

const antwort = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => headers[k.toLowerCase()] ?? (k.toLowerCase() === 'content-type' && body !== undefined ? 'application/json' : null) },
  json: async () => body,
  text: async () => JSON.stringify(body ?? ''),
});

describe('pfad: eine Namensregel', () => {
  it('ersetzt verbotene Zeichen, kuerzt und entfernt Punkte am Ende', () => {
    expect(pfad.bereinigen('Müller: "Sommer"/Herbst?')).toBe('Müller- -Sommer-Herbst-');
    expect(pfad.bereinigen('Name...')).toBe('Name');
    expect(pfad.bereinigen('x'.repeat(80)).length).toBe(pfad.MAX_SEGMENT);
    expect(pfad.bereinigen('CON')).toBe('CON_');
  });

  it('Dateiname behaelt die Endung beim Kuerzen', () => {
    const n = pfad.dateiname(`${'a'.repeat(200)}.MP4`);
    expect(n.endsWith('.mp4')).toBe(true);
    expect(n.length).toBeLessThanOrEqual(pfad.MAX_DATEINAME);
    expect(pfad.dateiname('C:\\fake\\clip?.mov')).toBe('clip-.mov');
  });

  it('Zaehler "(2)" vor der Endung bzw. am Ende', () => {
    expect(pfad.mitZaehler('Lisa', 1)).toBe('Lisa');
    expect(pfad.mitZaehler('Lisa', 2)).toBe('Lisa (2)');
    expect(pfad.mitZaehler('clip.mp4', 3)).toBe('clip (3).mp4');
  });

  it('Kampagnenname: eigener Name vor Kampagnenname', () => {
    expect(pfad.kampagnenName({ kampagnenname: 'Auftrag X', eigener_name: 'Sommer' })).toBe('Sommer');
    expect(pfad.kampagnenName({ kampagnenname: 'Auftrag X', eigener_name: '  ' })).toBe('Auftrag X');
    expect(pfad.NAMEN.kampagne({ kampagnenname: 'A/B' })).toBe('A-B');
  });

  it('Video-Ordner mit Thema, Format aus Pixelmass', () => {
    expect(pfad.NAMEN.video({ position: 2, thema: 'Unboxing: Teil 1' })).toBe('Video_2_Unboxing- Teil 1');
    expect(pfad.NAMEN.video({ position: 3 })).toBe('Video_3');
    expect(pfad.formatAusMass(1080, 1920)).toBe('9:16');
    expect(pfad.formatAusMass(1080, 1350)).toBe('4:5');
    expect(pfad.formatAusMass(1920, 1080)).toBe(null);
    expect(pfad.formatOrdner('9:16')).toBe('9-16');
    expect(pfad.formatAusOrdner('4-5')).toBe('4:5');
  });

  it('erkennt Fachordner und Mac-Muell', () => {
    expect(pfad.nummer('video', 'Video_12_Thema')).toBe(12);
    expect(pfad.nummer('schleife', 'Feedbackschleife_2')).toBe(2);
    expect(pfad.MUSTER.finale.test('Finale Version')).toBe(true);
    expect(pfad.typAusOrdner('storys')).toBe('storys');
    expect(pfad.systemdatei('.DS_Store')).toBe(true);
    expect(pfad.systemdatei('._clip.mov')).toBe(true);
    expect(pfad.systemdatei('clip.mov')).toBe(false);
  });
});

describe('graph-auth', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

  it('Client-Assertion ist ein gueltig signiertes RS256-JWT mit x5t', () => {
    const jwt = clientAssertion({ tenantId: 't1', clientId: 'c1', zert: { key: privateKey, x5t: 'abc' }, jetzt: 1_700_000_000_000 });
    const [h, p, s] = jwt.split('.');
    const header = JSON.parse(Buffer.from(h, 'base64url'));
    const payload = JSON.parse(Buffer.from(p, 'base64url'));
    expect(header).toMatchObject({ alg: 'RS256', x5t: 'abc' });
    expect(payload).toMatchObject({ iss: 'c1', sub: 'c1', aud: 'https://login.microsoftonline.com/t1/oauth2/v2.0/token' });
    expect(payload.exp - payload.iat).toBe(600);
    expect(crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, 'base64url'))).toBe(true);
  });

  it('cacht den Token je Scope und teilt parallele Anfragen', async () => {
    const fetchImpl = vi.fn(async () => antwort(200, { access_token: 'tok', expires_in: 3600 }));
    const token = createTokenQuelle({
      konfig: { tenantId: 't', clientId: 'c' },
      fetchImpl,
      zertifikat: async () => ({ key: privateKey, x5t: 'x' }),
    });
    const [a, b] = await Promise.all([token('s1'), token('s1')]);
    await token('s1');
    expect(a).toBe('tok');
    expect(b).toBe('tok');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await token('s2');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await token('s1', { neu: true });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe('graph: Retry', () => {
  it('wartet bei 429 Retry-After ab und holt bei 401 einmal einen neuen Token', async () => {
    const schlafen = vi.fn(async () => {});
    const tokens = [];
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(antwort(429, {}, { 'retry-after': '3' }))
      .mockResolvedValueOnce(antwort(401, { error: { code: 'InvalidAuthenticationToken' } }))
      .mockResolvedValueOnce(antwort(200, { id: 'ok' }));
    const http = createHttp({ token: async ({ neu }) => { tokens.push(neu); return 't'; }, fetchImpl, schlafen });
    await expect(http.get('/x')).resolves.toEqual({ id: 'ok' });
    expect(schlafen).toHaveBeenCalledWith(3000);
    expect(tokens).toEqual([false, false, true]);
  });

  it('Fehler tragen Status und Graph-Code', async () => {
    const http = createHttp({ token: async () => 't', fetchImpl: async () => antwort(404, { error: { code: 'itemNotFound', message: 'weg' } }) });
    const err = await http.get('/x').catch((e) => e);
    expect(err).toBeInstanceOf(GraphError);
    expect(err).toMatchObject({ status: 404, code: 'itemNotFound' });
  });

  it('$batch: Reihenfolge bleibt, 429 im Batch wird geworfen', async () => {
    const http = { post: vi.fn(async (_p, body) => ({ responses: body.requests.map((r) => ({ id: r.id, status: 200, body: { url: r.url } })).reverse() })) };
    const res = await batch(http, Array.from({ length: 25 }, (_, i) => ({ url: `/u${i}` })));
    expect(http.post).toHaveBeenCalledTimes(2);
    expect(res[0].body.url).toBe('/u0');
    expect(res[24].body.url).toBe('/u24');
    const zu = { post: async () => ({ responses: [{ id: '0', status: 429, headers: { 'Retry-After': '7' } }] }) };
    await expect(batch(zu, [{ url: '/a' }])).rejects.toMatchObject({ status: 429, retryAfter: 7 });
  });
});

describe('ziel: Weiche + Notschalter', () => {
  it('nur SharePoint, wenn konfiguriert, Weiche an und kein Notschalter', () => {
    const u = { ablage_ziel: 'sharepoint' };
    expect(ablageZiel(u, { konfiguriert: true })).toBe('sharepoint');
    expect(ablageZiel(u, { konfiguriert: false })).toBe('dropbox');
    expect(ablageZiel(u, { konfiguriert: true, notschalter: true })).toBe('dropbox');
    expect(ablageZiel({ ablage_ziel: 'dropbox' }, { konfiguriert: true })).toBe('dropbox');
    expect(ablageZiel(null, { konfiguriert: true })).toBe('dropbox');
    process.env.ABLAGE_ZIEL = 'dropbox';
    try {
      expect(ablageZiel(u, { konfiguriert: true })).toBe('dropbox');
    } finally {
      delete process.env.ABLAGE_ZIEL;
    }
  });
});

describe('sharepoint: driveItem -> Eingang', () => {
  it('uebernimmt Masse aus dem video-Facet und erkennt Ordner/Loeschung', () => {
    const z = itemZuEingang({
      id: 'i1', name: 'a.mov', size: 5, eTag: 'e', cTag: 'c', parentReference: { id: 'p' },
      file: { mimeType: 'video/quicktime' }, video: { width: 1080, height: 1920, duration: 12000 },
      lastModifiedBy: { user: { email: 'x@y.de' } },
    });
    expect(z).toMatchObject({ item_id: 'i1', parent_item_id: 'p', ist_ordner: false, breite: 1080, hoehe: 1920, dauer_ms: 12000, geaendert_von: 'x@y.de' });
    expect(itemZuEingang({ id: 'f', folder: {}, deleted: {} })).toMatchObject({ ist_ordner: true, geloescht: true });
  });
});

function koop({ id = 'k1', name = 'Lisa', kampagneId = 'kamp1', marke = { id: 'm1', markenname: 'Marke' }, unternehmen = { id: 'u1', firmenname: 'Firma', ist_test: false } } = {}) {
  return {
    id, name, kampagne_id: kampagneId,
    kampagne: { id: kampagneId, kampagnenname: 'Auftrag', eigener_name: 'Sommer', unternehmen_id: unternehmen.id, marke_id: marke?.id || null, unternehmen, marke },
  };
}

function setup(extra = {}) {
  const supabase = createFakeSupabase({
    tabellen: {
      ablage_ordner: [],
      ablage_stand: [{ drive_id: 'd1', root_item_id: 'root' }],
      kooperationen: [koop(), koop({ id: 'k2' })],
      kooperation_videos: [{ id: 'v1', kooperation_id: 'k1', position: 1, thema: 'Unboxing' }],
      kooperation_story: [{ id: 's1', video_id: 'v1', slot_index: 2 }],
      ...extra,
    },
    unique: { ablage_ordner: ORDNER_UNIQUE },
    rpc: { ablage_pfad_umschreiben: () => 0 },
  });
  const sp = createFakeSharePoint();
  const ordner = createOrdner({ supabase, sp, schlafen: async () => {} });
  return { supabase, sp, ordner };
}

describe('ordner: Register + Anlage', () => {
  it('legt die Kette an und registriert Pfade; zweiter Aufruf legt nichts neu an', async () => {
    const { supabase, sp, ordner } = setup();
    const k = await ordner.kette(koop());
    expect(k.kooperation.pfad).toBe('/Firma/Marke/Sommer/Lisa');
    const anzahl = sp.calls.length;
    await ordner.kette(koop());
    expect(sp.calls.length).toBe(anzahl);
    expect(supabase.db.ablage_ordner.every((r) => r.item_id)).toBe(true);
  });

  it('gleichnamige Kooperation in derselben Kampagne bekommt "(2)"', async () => {
    const { ordner } = setup();
    const a = await ordner.kette(koop({ id: 'k1' }));
    const b = await ordner.kette(koop({ id: 'k2' }));
    expect(a.kooperation.name).toBe('Lisa');
    expect(b.kooperation.name).toBe('Lisa (2)');
    expect(b.kooperation.kooperation_id).toBe('k2');
  });

  it('uebernimmt einen im Finder angelegten Ordner gleichen Namens', async () => {
    const { supabase, sp, ordner } = setup();
    const k = await ordner.kette(koop());
    const vids = await ordner.typOrdner(k.kooperation, 'videos');
    const { item } = await sp.ordnerAnlegen(vids.item_id, 'Video_1_Unboxing');
    supabase.db.ablage_ordner.push({ id: 'frei1', drive_id: 'd1', item_id: item.id, parent_item_id: vids.item_id, name: item.name, art: 'frei', created_at: new Date().toISOString() });
    const v = await ordner.videoOrdner(vids, { id: 'v1', position: 1, thema: 'Unboxing' });
    expect(v.item_id).toBe(item.id);
    expect(v.art).toBe('video');
    expect(supabase.db.ablage_ordner.filter((r) => r.item_id === item.id)).toHaveLength(1);
  });

  it('Testunternehmen liegen unter _Test', async () => {
    const { ordner } = setup();
    const k = await ordner.kette(koop({ unternehmen: { id: 'ut', firmenname: 'Testfirma', ist_test: true }, marke: null }));
    expect(k.kooperation.pfad).toBe('/_Test/Testfirma/Sommer/Lisa');
  });

  it('zielOrdner: Variante unter der Schleife, Finale nach Format', async () => {
    const { ordner } = setup();
    const a = await ordner.zielOrdner({ typ: 'video', kooperation_id: 'k1', kooperation_video_id: 'v1', version_number: 2, variant_name: 'B' }, { koop: koop() });
    expect(a.ordner.pfad).toBe('/Firma/Marke/Sommer/Lisa/Videos/Video_1_Unboxing/Feedbackschleife_2/B');
    const f = await ordner.zielOrdner({ typ: 'video', kooperation_id: 'k1', kooperation_video_id: 'v1', is_final: true, variant_name: '9:16' }, { koop: koop() });
    expect(f.ordner.pfad).toBe('/Firma/Marke/Sommer/Lisa/Videos/Video_1_Unboxing/Finale_Version/9-16');
    const s = await ordner.zielOrdner({ typ: 'story', kooperation_id: 'k1', story_id: 's1', version_number: 1 }, { koop: koop() });
    expect(s.ordner.pfad).toBe('/Firma/Marke/Sommer/Lisa/Storys/Video_1_Unboxing/Story_2/Feedbackschleife_1');
    const r = await ordner.zielOrdner({ typ: 'roh', kooperation_id: 'k1' }, { koop: koop() });
    expect(r.ordner.pfad).toBe('/Firma/Marke/Sommer/Lisa/Rohmaterial');
  });

  it('Kampagne an andere Marke: Ordner wird verschoben statt neu angelegt', async () => {
    const { sp, ordner } = setup();
    const a = await ordner.kette(koop());
    const b = await ordner.kette(koop({ marke: { id: 'm2', markenname: 'Andere' } }));
    expect(b.kampagne.item_id).toBe(a.kampagne.item_id);
    expect(b.kampagne.pfad).toBe('/Firma/Andere/Sommer');
    expect(sp.calls.some(([op]) => op === 'verschieben')).toBe(true);
  });

  it('umbenennen: CRM-Name per PATCH, bei Kollision "(2)"', async () => {
    const { supabase, ordner } = setup();
    const a = await ordner.kette(koop({ id: 'k1' }));
    const b = await ordner.kette(koop({ id: 'k2', name: 'Max' }));
    const neu = await ordner.umbenennen(b.kooperation, 'Lisa');
    expect(neu.name).toBe('Lisa (2)');
    expect(neu.pfad).toBe('/Firma/Marke/Sommer/Lisa (2)');
    expect(supabase.log.some((l) => l.rpc === 'ablage_pfad_umschreiben')).toBe(true);
    expect(a.kooperation.name).toBe('Lisa');
  });
});

describe('asset: Upsert per item_id', () => {
  it('legt einmal an, zweite Meldung aktualisiert; neuer cTag -> neues created_at', async () => {
    const supabase = createFakeSupabase({ tabellen: { kooperation_video_asset: [] } });
    const werte = { ...asset.dateiSpalten({ id: 'i1', name: 'a.mp4', size: 3, eTag: 'e1', cTag: 'c1', webUrl: 'https://x' }, { driveId: 'd1', pfad: '/a.mp4' }), ...asset.fachSpalten('video', { kooperation_video_id: 'v1', version_number: 1 }) };
    const a = await asset.upsert(supabase, 'video', werte, { jetzt: '2026-01-01T00:00:00Z' });
    const b = await asset.upsert(supabase, 'video', { ...werte, file_name: 'b.mp4' }, { jetzt: '2026-01-02T00:00:00Z' });
    expect(a.neu).toBe(true);
    expect(b.neu).toBe(false);
    expect(supabase.db.kooperation_video_asset).toHaveLength(1);
    expect(b.row.created_at).toBe('2026-01-01T00:00:00Z');
    const c = await asset.upsert(supabase, 'video', { ...werte, ctag: 'c2' }, { jetzt: '2026-01-03T00:00:00Z' });
    expect(c.row.created_at).toBe('2026-01-03T00:00:00Z');
  });

  it('Story: neueste Schleife ist aktuell', async () => {
    const supabase = createFakeSupabase({ tabellen: { kooperation_story_asset: [
      { id: 'a', story_id: 's', version_number: 1, is_final: false, is_current: true, drive_id: 'd1', item_id: 'x' },
    ] } });
    await asset.upsert(supabase, 'story', { drive_id: 'd1', item_id: 'y', ...asset.fachSpalten('story', { story_id: 's', kooperation_video_id: 'v', version_number: 2 }) });
    const rows = supabase.db.kooperation_story_asset;
    expect(rows.find((r) => r.id === 'a').is_current).toBe(false);
    expect(rows.find((r) => r.item_id === 'y').is_current).toBe(true);
  });
});
