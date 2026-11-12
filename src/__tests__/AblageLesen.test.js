import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { createFakeSupabase, createFakeSharePoint } from './fixtures/fakeSupabase.js';

const require = createRequire(import.meta.url);
const { createLesen } = require('../../netlify/functions/_shared/ablage/lesen.js');
const { createFreigabe } = require('../../netlify/functions/_shared/ablage/freigabe.js');
const { istGastToken } = require('../../netlify/functions/_shared/ablage/http.js');
const { GraphError } = require('../../netlify/functions/_shared/ablage/graph.js');
const { gemischteThumbnails, BatchError } = require('../../netlify/functions/_shared/poster-generator.js');

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const K1 = id(1);
const K2 = id(2);
const V1 = id(3);
const V2 = id(4);
const A1 = id(11);
const A2 = id(12);
const A3 = id(13);
const A4 = id(14);
const B1 = id(15);

const ADMIN = { id: 'ad', rolle: 'admin', freigeschaltet: true };
const MA = { id: 'ma', rolle: 'mitarbeiter', freigeschaltet: true };
const KUNDE = { id: 'ku', rolle: 'kunde', freigeschaltet: true };

function setup() {
  const sp = createFakeSharePoint();
  const datei = sp.datei('root', 'clip.mp4', 100);
  const fremd = sp.datei('root', 'fremd.mp4', 100);
  const supabase = createFakeSupabase({
    tabellen: {
      kooperation_videos: [{ id: V1, kooperation_id: K1 }, { id: V2, kooperation_id: K2 }],
      ablage_ordner: [],
      ablage_freigabelink: [],
    },
  });
  // Was der Aufrufer per RLS sieht; die Zuordnung prueft die RPC
  const caller = createFakeSupabase({
    tabellen: {
      kooperation_video_asset: [
        { id: A1, ablage: 'sharepoint', drive_id: 'd1', item_id: datei.id, video_id: V1 },
        { id: A2, ablage: 'dropbox', file_path: '/Firma/x.mp4', video_id: V1 },
        { id: A3, ablage: 'sharepoint', drive_id: 'd1', item_id: fremd.id, video_id: V2 },
        { id: A4, ablage: 'sharepoint', drive_id: 'anderes', item_id: 'zz', video_id: V1 },
      ],
      kooperation_bilder_asset: [{ id: B1, ablage: 'sharepoint', drive_id: 'd1', item_id: datei.id, kooperation_id: K1 }],
      kooperationen: [{ id: K1 }],
    },
    rpc: { ablage_meine_kooperationen: ({ p_ids }) => p_ids.filter((k) => k === K1).map((k) => ({ kooperation_id: k })) },
  });
  const dropbox = { downloadUrl: async (p) => (p === '/Firma/x.mp4' ? { url: 'https://db.test/x', ablauf: '2026-11-09T16:00:00.000Z' } : null) };
  const jetzt = () => Date.parse('2026-11-09T12:00:00Z');
  const lesen = createLesen({ supabase, ablage: { sp }, dropbox, jetzt });
  const freigabe = createFreigabe({ supabase, ablage: { sp }, jetzt });
  return { sp, supabase, caller, dropbox, lesen, freigabe, datei, fremd, jetzt };
}

const alle = [{ typ: 'video', id: A1 }, { typ: 'video', id: A2 }, { typ: 'video', id: A3 }, { typ: 'video', id: A4 }, { typ: 'still', id: B1 }];

describe('ablage-link', () => {
  it('Admin: SharePoint-downloadUrl, Dropbox-Temp-Link, fremdes Drive fehlt', async () => {
    const t = setup();
    const r = await t.lesen.links({ benutzer: ADMIN, caller: t.caller, body: { items: alle } });
    expect(r.links[A1]).toEqual({ url: `https://dl.test/${t.datei.id}`, laeuft_ab: '2026-11-09T12:55:00.000Z' });
    expect(r.links[A2].url).toBe('https://db.test/x');
    expect(r.links[A3].url).toBe(`https://dl.test/${t.fremd.id}`);
    expect(r.links[B1].url).toBe(`https://dl.test/${t.datei.id}`);
    expect(r.fehlend).toEqual([A4]);
    // dieselbe Datei nur einmal bei Graph
    expect(t.sp.calls.find(([op]) => op === 'downloadUrls')[1]).toEqual([t.datei.id, t.fremd.id]);
  });

  it('Mitarbeiter: nur zugeordnete Kooperationen, auch wenn RLS die Zeile zeigt', async () => {
    const t = setup();
    const r = await t.lesen.links({ benutzer: MA, caller: t.caller, body: { items: alle } });
    expect(Object.keys(r.links).sort()).toEqual([A1, A2, B1].sort());
    expect(r.fehlend.sort()).toEqual([A3, A4].sort());
    expect(t.caller.log.some((l) => l.rpc === 'ablage_meine_kooperationen')).toBe(true);
  });

  it('Gast und Kunde: RLS allein entscheidet', async () => {
    const t = setup();
    const gast = await t.lesen.links({ benutzer: null, caller: t.caller, body: { items: alle } });
    expect(gast.links[A3]).toBeTruthy();
    const unsichtbar = createFakeSupabase({ tabellen: { kooperation_video_asset: [] } });
    const k = await t.lesen.links({ benutzer: KUNDE, caller: unsichtbar, body: { items: alle } });
    expect(k.links).toEqual({});
    expect(k.fehlend).toHaveLength(5);
  });

  it('Eingaben und gesperrte Konten', async () => {
    const t = setup();
    const viele = Array.from({ length: 101 }, (_, i) => ({ typ: 'video', id: id(100 + i) }));
    await expect(t.lesen.links({ benutzer: ADMIN, caller: t.caller, body: { items: viele } })).rejects.toMatchObject({ status: 400 });
    await expect(t.lesen.links({ benutzer: ADMIN, caller: t.caller, body: { items: [{ typ: 'pdf', id: A1 }] } })).rejects.toMatchObject({ status: 400 });
    await expect(t.lesen.links({ benutzer: { ...MA, freigeschaltet: false }, caller: t.caller, body: { items: alle } })).rejects.toMatchObject({ status: 403 });
  });

  it('ohne SharePoint-Konfiguration: Dropbox geht weiter', async () => {
    const t = setup();
    const lesen = createLesen({ supabase: t.supabase, ablage: null, dropbox: t.dropbox });
    const r = await lesen.links({ benutzer: ADMIN, caller: t.caller, body: { items: alle } });
    expect(Object.keys(r.links)).toEqual([A2]);
  });

  it('Gast-Token nur mit share_id', () => {
    const tok = (claims) => ({ headers: { authorization: `Bearer x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y` } });
    expect(istGastToken(tok({ role: 'anon', share_id: 'abc' }))).toBe(true);
    expect(istGastToken(tok({ role: 'authenticated', sub: 'u' }))).toBe(false);
    expect(istGastToken({ headers: {} })).toBe(false);
  });
});

describe('freie Ordner', () => {
  async function mitFrei(t) {
    const { item: f } = await t.sp.ordnerAnlegen('root', 'Extras');
    const { item: s } = await t.sp.ordnerAnlegen(f.id, 'Sub');
    const a = t.sp.datei(f.id, 'a.mov', 5);
    t.sp.datei(f.id, '.DS_Store', 1);
    const b = t.sp.datei(s.id, 'b.mov', 6);
    const { item: fach } = await t.sp.ordnerAnlegen('root', 'Video_1');
    const c = t.sp.datei(fach.id, 'c.mov', 7);
    t.supabase.db.ablage_ordner.push(
      { drive_id: 'd1', item_id: f.id, parent_item_id: 'root', name: 'Extras', pfad: '/Firma/Extras', art: 'frei', kooperation_id: K1 },
      { drive_id: 'd1', item_id: s.id, parent_item_id: f.id, name: 'Sub', pfad: '/Firma/Extras/Sub', art: 'frei', kooperation_id: K1 },
      { drive_id: 'd1', item_id: fach.id, parent_item_id: 'root', name: 'Video_1', art: 'video', kooperation_id: K1 },
    );
    return { f, s, a, b, c };
  }

  it('Liste rekursiv, ohne Systemdateien, Unterordner nicht doppelt', async () => {
    const t = setup();
    const { f, s, a, b } = await mitFrei(t);
    const r = await t.lesen.frei({ benutzer: MA, caller: t.caller, body: { frei: { kooperation_id: K1 } } });
    expect(r.ordner.map((o) => [o.item_id, o.pfad, o.dateien.map((d) => d.item_id)])).toEqual([
      [f.id, '/Firma/Extras', [a.id]],
      [s.id, '/Firma/Extras/Sub', [b.id]],
    ]);
    expect(r.ordner[0].dateien[0]).toMatchObject({ name: 'a.mov', groesse: 5, web_url: t.sp.url(a.id) });
  });

  it('nur intern und nur zugeordnet', async () => {
    const t = setup();
    await mitFrei(t);
    await expect(t.lesen.frei({ benutzer: KUNDE, caller: t.caller, body: { frei: { kooperation_id: K1 } } })).rejects.toMatchObject({ status: 403 });
    await expect(t.lesen.frei({ benutzer: MA, caller: t.caller, body: { frei: { kooperation_id: K2 } } })).rejects.toMatchObject({ status: 404 });
  });

  it('frei_datei: Link nur fuer Dateien unter einem freien Ordner', async () => {
    const t = setup();
    const { b, c } = await mitFrei(t);
    expect(await t.lesen.freiDatei({ benutzer: MA, caller: t.caller, body: { frei_datei: { item_id: b.id } } })).toEqual({ url: `https://dl.test/${b.id}` });
    await expect(t.lesen.freiDatei({ benutzer: MA, caller: t.caller, body: { frei_datei: { item_id: c.id } } })).rejects.toMatchObject({ status: 404 });
    await expect(t.lesen.freiDatei({ benutzer: KUNDE, caller: t.caller, body: { frei_datei: { item_id: b.id } } })).rejects.toMatchObject({ status: 403 });
  });
});

describe('ablage-freigabe', () => {
  const mitVideosOrdner = (t) => t.supabase.db.ablage_ordner.push({ drive_id: 'd1', item_id: 'vid', parent_item_id: 'k', name: 'Videos', art: 'typ', typ: 'videos', kooperation_id: K1 });

  it('ohne SharePoint-Ordner: 409 nicht_sharepoint', async () => {
    const t = setup();
    await expect(t.freigabe.erstellen({ benutzer: KUNDE, caller: t.caller, body: { kooperation_id: K1 } }))
      .rejects.toMatchObject({ status: 409, code: 'nicht_sharepoint' });
  });

  it('erstellen (30 Tage), wiederverwenden, liste, widerrufen nur Staff', async () => {
    const t = setup();
    mitVideosOrdner(t);
    const l = await t.freigabe.erstellen({ benutzer: KUNDE, caller: t.caller, body: { kooperation_id: K1 } });
    expect(l).toMatchObject({ url: expect.stringMatching(/^https:\/\/share\.test\//), laeuft_ab_at: '2026-12-09T12:00:00.000Z' });
    expect(t.supabase.db.ablage_freigabelink[0]).toMatchObject({ item_id: 'vid', kooperation_id: K1, erstellt_von: 'ku', ordner_art: 'videos' });

    const l2 = await t.freigabe.erstellen({ benutzer: MA, caller: t.caller, body: { kooperation_id: K1 } });
    expect(l2.id).toBe(l.id);
    expect(t.sp.calls.filter(([op]) => op === 'leselink')).toHaveLength(1);

    await expect(t.freigabe.widerrufen({ benutzer: KUNDE, caller: t.caller, body: { id: l.id } })).rejects.toMatchObject({ status: 403 });
    expect(await t.freigabe.widerrufen({ benutzer: MA, caller: t.caller, body: { id: l.id } })).toEqual({ ok: true });
    expect(t.sp.links.size).toBe(0);
    const { links } = await t.freigabe.liste({ benutzer: KUNDE, caller: t.caller, body: { kooperation_id: K1 } });
    expect(links[0].widerrufen_at).toBeTruthy();
  });

  it('Gast und nicht zugeordnete Mitarbeiter bekommen keinen Link', async () => {
    const t = setup();
    mitVideosOrdner(t);
    await expect(t.freigabe.erstellen({ benutzer: null, caller: t.caller, body: { kooperation_id: K1 } })).rejects.toMatchObject({ status: 403 });
    await expect(t.freigabe.erstellen({ benutzer: MA, caller: t.caller, body: { kooperation_id: K2 } })).rejects.toMatchObject({ status: 404 });
  });

  it('typ storys (alte Clients) ist der Videos-Link, Stories liegen dort; unbekannter Typ 400', async () => {
    const t = setup();
    mitVideosOrdner(t);
    t.supabase.db.ablage_ordner.push({ drive_id: 'd1', item_id: 'sto', parent_item_id: 'k', name: 'Storys', art: 'typ', typ: 'storys', kooperation_id: K1 });
    const v = await t.freigabe.erstellen({ benutzer: KUNDE, caller: t.caller, body: { kooperation_id: K1 } });
    const s = await t.freigabe.erstellen({ benutzer: KUNDE, caller: t.caller, body: { kooperation_id: K1, typ: 'storys' } });
    expect(s.id).toBe(v.id);
    expect(t.sp.calls.filter(([op]) => op === 'leselink').map(([, item]) => item)).toEqual(['vid']);
    for (const typ of ['bilder', 'constructor']) {
      await expect(t.freigabe.erstellen({ benutzer: KUNDE, caller: t.caller, body: { kooperation_id: K1, typ } })).rejects.toMatchObject({ status: 400 });
    }
  });

  it('Tenant sperrt anonyme Links: 409 links_gesperrt', async () => {
    const t = setup();
    mitVideosOrdner(t);
    t.sp.leselink = async () => { throw new GraphError(403, 'accessDenied', 'policy'); };
    await expect(t.freigabe.erstellen({ benutzer: KUNDE, caller: t.caller, body: { kooperation_id: K1 } }))
      .rejects.toMatchObject({ status: 409, code: 'links_gesperrt' });
  });
});

describe('Poster: SharePoint-Thumbnails', () => {
  const fetchImpl = async (url) => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode(url).buffer });

  it('verteilt Dropbox- und SharePoint-Schluessel, Reihenfolge bleibt', async () => {
    const sp = createFakeSharePoint();
    const x = sp.datei('root', 'x.mp4');
    const dropbox = async (pfade) => pfade.map((p) => ({ ok: true, buffer: Buffer.from(`db:${p}`) }));
    const thumbs = gemischteThumbnails({ sp, dropbox, fetchImpl });
    const r = await thumbs(['/a.jpg', `sp:d1:${x.id}`, 'sp:fremd:i9', '/b.mov']);
    expect(r[0].buffer.toString()).toBe('db:/a.jpg');
    expect(r[1].buffer.toString()).toBe(`https://thumb.test/${x.id}`);
    expect(r[2]).toMatchObject({ ok: false, fehler: 'sharepoint:fremdesDrive', permanent: true });
    expect(r[3].buffer.toString()).toBe('db:/b.mov');
    expect(sp.calls.find(([op]) => op === 'thumbnailUrls')[2]).toBe('c480x1600');
  });

  it('noch kein Standbild: laengeres Warten; Drosselung: BatchError mit Retry-After', async () => {
    const sp = createFakeSharePoint();
    sp.thumbnailUrls = async (ids) => ids.map(() => ({ ok: false, fehler: 'sharepoint:keinThumbnail', permanent: false }));
    const r = await gemischteThumbnails({ sp, fetchImpl })(['sp:d1:i1']);
    expect(r[0]).toMatchObject({ ok: false, warteSek: 600 });

    sp.thumbnailUrls = async () => { throw new GraphError(429, 'tooManyRequests', 'x', { retryAfter: 30 }); };
    const err = await gemischteThumbnails({ sp, fetchImpl })(['sp:d1:i1']).catch((e) => e);
    expect(err).toBeInstanceOf(BatchError);
    expect(err.retryAfterSec).toBe(30);
  });
});
