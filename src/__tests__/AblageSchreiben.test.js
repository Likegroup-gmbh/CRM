import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createFakeSupabase, createFakeSharePoint, ORDNER_UNIQUE } from './fixtures/fakeSupabase.js';

const require = createRequire(import.meta.url);
const { createSchreiben } = require('../../netlify/functions/_shared/ablage/schreiben.js');
const { createCreatorAblage } = require('../../netlify/functions/_shared/ablage/creator.js');
const { createOrdner } = require('../../netlify/functions/_shared/ablage/ordner.js');
const ziel = require('../../netlify/functions/_shared/ablage/ziel.js');
const cu = require('../../netlify/functions/_shared/creator-upload.js');

const ENV = { MS_TENANT_ID: 't', MS_CLIENT_ID: 'c', SP_SITE_URL: 'https://x.sharepoint.com/sites/Medienablage', SP_SITE_ID: 's1', SP_DRIVE_ID: 'd1' };
const ROH_TOKEN = 'a'.repeat(64);

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const K1 = id(1);
const KA1 = id(2);
const U1 = id(3);
const V1 = id(4);
const VX = id(5);
const S1 = id(6);
const A1 = id(11);
const A2 = id(12);
const A3 = id(13);
const A4 = id(14);

const MA = { id: 'b1', rolle: 'mitarbeiter', freigeschaltet: true };
const FINANZEN = { id: 'b2', rolle: 'admin', freigeschaltet: true, mitarbeiter_klasse: { name: 'Finanzen' } };

function koop({ ablageZiel = 'sharepoint' } = {}) {
  return {
    id: K1, name: 'Lisa', kampagne_id: KA1, creator_id: 'cr1', created_at: '2026-01-01',
    kampagne: {
      id: KA1, kampagnenname: 'Auftrag', eigener_name: 'Sommer', unternehmen_id: U1, marke_id: null,
      unternehmen: { id: U1, firmenname: 'Firma', ablage_ziel: ablageZiel, ist_test: false }, marke: null,
    },
    creator: { vorname: 'Lisa', nachname: 'M' },
  };
}

function setup({ ablageZiel = 'sharepoint', notschalter = false, assets = {}, ohneSp = false } = {}) {
  const supabase = createFakeSupabase({
    tabellen: {
      ablage_einstellung: [{ schluessel: 'notschalter', wert: notschalter }],
      ablage_stand: [{ drive_id: 'd1', root_item_id: 'root' }],
      ablage_ordner: [],
      ablage_upload: [],
      ablage_eingang: [],
      kooperationen: [koop({ ablageZiel })],
      kooperation_videos: [
        { id: V1, kooperation_id: K1, position: 1, thema: 'Unboxing' },
        { id: VX, kooperation_id: id(99), position: 1 },
      ],
      kooperation_story: [{ id: S1, video_id: V1, slot_index: 2 }],
      kooperation_video_asset: [],
      kooperation_story_asset: [],
      kooperation_bilder_asset: [],
      kooperation_rohmaterial_asset: [],
      kampagne: [{ id: KA1, unternehmen_id: U1 }],
      unternehmen: [{ id: U1 }],
      creator_upload_token: [{ id: 'tok1', token_hash: cu.hashToken(ROH_TOKEN), kampagne_id: KA1, creator_id: 'cr1', expires_at: '2099-01-01', revoked_at: null }],
      creator_upload_job: [],
      ...assets,
    },
    unique: { ablage_ordner: ORDNER_UNIQUE },
    rpc: { ablage_pfad_umschreiben: () => 0, ablage_nachfahren: () => [] },
  });
  const sp = createFakeSharePoint();
  const ordner = createOrdner({ supabase, sp, schlafen: async () => {} });
  const ablage = ohneSp ? null : { sp, ordner, konfig: { siteUrl: ENV.SP_SITE_URL } };
  const s = createSchreiben({ supabase, ablage });
  return { supabase, sp, ordner, s, caller: supabase };
}

const zielBody = (extra = {}) => ({
  typ: 'video', kooperation_id: K1, kooperation_video_id: V1, version_number: 2, variant_name: 'B',
  file_name: 'clip.MOV', file_size: 1000, ...extra,
});

beforeEach(() => {
  Object.assign(process.env, ENV);
  ziel._reset();
});
afterEach(() => {
  for (const k of Object.keys(ENV)) delete process.env[k];
  delete process.env.ABLAGE_ZIEL;
});

describe('ablage-upload-ziel', () => {
  it('Weiche auf dropbox: nur { ziel: dropbox }, keine Session', async () => {
    const { s, sp, caller, supabase } = setup({ ablageZiel: 'dropbox' });
    expect(await s.uploadZiel({ benutzer: MA, caller, body: zielBody() })).toEqual({ ziel: 'dropbox' });
    expect(sp.calls.filter(([op]) => op === 'uploadSession')).toHaveLength(0);
    expect(supabase.db.ablage_upload).toHaveLength(0);
  });

  it('Notschalter und ABLAGE_ZIEL schicken zu Dropbox', async () => {
    const a = setup({ notschalter: true });
    expect((await a.s.uploadZiel({ benutzer: MA, caller: a.caller, body: zielBody() })).ziel).toBe('dropbox');
    ziel._reset();
    process.env.ABLAGE_ZIEL = 'dropbox';
    const b = setup();
    expect((await b.s.uploadZiel({ benutzer: MA, caller: b.caller, body: zielBody() })).ziel).toBe('dropbox');
  });

  it('SharePoint: Session flach in der Schleife (Variante ohne Ordner), Upload-Zeile, Commit liefert die Asset-Spalten', async () => {
    const { s, sp, caller, supabase } = setup();
    const z = await s.uploadZiel({ benutzer: MA, caller, body: zielBody() });
    expect(z).toMatchObject({ ziel: 'sharepoint', chunk_bytes: 10 * 1024 * 1024, file_name: 'clip.mov' });
    expect(z.ordner.pfad).toBe('/Firma/Sommer/Lisa/Videos/Video_1_Unboxing/Feedbackschleife_2');
    expect(supabase.db.ablage_upload[0]).toMatchObject({ id: z.upload_id, name: 'clip.mov', groesse: 1000, typ: 'video', erstellt_von: 'b1', item_id: null });

    const item = sp.hochladen(z.upload_url, 1000);
    const c = await s.uploadCommit({ benutzer: MA, body: { upload_id: z.upload_id, item_id: item.id } });
    const videoOrdner = supabase.db.ablage_ordner.find((o) => o.art === 'video' && o.typ === 'videos');
    expect(c).toMatchObject({
      ablage: 'sharepoint', drive_id: 'd1', item_id: item.id, file_name: 'clip.mov', file_size: 1000,
      file_path: `${z.ordner.pfad}/clip.mov`, folder_url: `https://sp.test/${videoOrdner.item_id}`, video_id: V1,
    });
    expect(supabase.db.ablage_upload[0].abgeschlossen_at).toBeTruthy();
  });

  it('Story landet in Videos/Video_N/Feedbackschleife_n/Story_k, finale in Finale_Version/Story_k', async () => {
    const { s, caller } = setup();
    const z = await s.uploadZiel({ benutzer: MA, caller, body: { typ: 'story', kooperation_id: K1, story_id: S1, version_number: 1, file_name: 's.mp4', file_size: 5 } });
    expect(z.ordner.pfad).toBe('/Firma/Sommer/Lisa/Videos/Video_1_Unboxing/Feedbackschleife_1/Story_2');
    const f = await s.uploadZiel({ benutzer: MA, caller, body: { typ: 'story', kooperation_id: K1, story_id: S1, is_final: true, variant_name: '9:16', file_name: 's.mp4', file_size: 5 } });
    expect(f.ordner.pfad).toBe('/Firma/Sommer/Lisa/Videos/Video_1_Unboxing/Finale_Version/Story_2');
  });

  it('Bild ohne Video: Runde des ersten Videos, Commit und Upload-Kontext kennen das Video', async () => {
    const { s, sp, caller, supabase } = setup();
    const z = await s.uploadZiel({ benutzer: MA, caller, body: { typ: 'still', kooperation_id: K1, version_number: 1, file_name: 'b.jpg', file_size: 3 } });
    expect(z.ordner.pfad).toBe('/Firma/Sommer/Lisa/Videos/Video_1_Unboxing/Feedbackschleife_1');
    expect(supabase.db.ablage_upload[0].kontext).toMatchObject({ typ: 'still', kooperation_video_id: V1 });
    const item = sp.hochladen(z.upload_url, 3);
    const c = await s.uploadCommit({ benutzer: MA, body: { upload_id: z.upload_id, item_id: item.id } });
    expect(c.video_id).toBe(V1);
    expect(supabase.db.ablage_ordner.some((o) => o.typ === 'bilder' || o.typ === 'storys')).toBe(false);
  });

  it('Grenzen und Rechte', async () => {
    const { s, caller } = setup();
    await expect(s.uploadZiel({ benutzer: MA, caller, body: zielBody({ file_size: 3 * 1024 ** 3 }) }))
      .rejects.toMatchObject({ status: 413, code: 'zu_gross', extra: { max_bytes: 2 * 1024 ** 3 } });
    await expect(s.uploadZiel({ benutzer: FINANZEN, caller, body: zielBody() })).rejects.toMatchObject({ status: 403 });
    const blind = createFakeSupabase({ tabellen: { kooperationen: [] } });
    await expect(s.uploadZiel({ benutzer: MA, caller: blind, body: zielBody() })).rejects.toMatchObject({ status: 404 });
    await expect(s.uploadZiel({ benutzer: MA, caller, body: zielBody({ kooperation_video_id: VX }) })).rejects.toMatchObject({ status: 404 });
  });

  it('Ersetzen einer SharePoint-Datei: gleiches Item, neue Version, neuer Name', async () => {
    const t = setup();
    const z1 = await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: zielBody() });
    const it1 = t.sp.hochladen(z1.upload_url, 1000);
    const c1 = await t.s.uploadCommit({ benutzer: MA, body: { upload_id: z1.upload_id, item_id: it1.id } });
    t.supabase.db.kooperation_video_asset.push({ id: A1, video_id: V1, version_number: 2, variant_name: 'B', ...c1 });

    const z2 = await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: { ...zielBody({ file_name: 'neu.mp4', file_size: 2000 }), ersetzen: { typ: 'video', id: A1 } } });
    expect(t.sp.calls.at(-1)[0]).toBe('uploadSessionFuerItem');
    const it2 = t.sp.hochladen(z2.upload_url, 2000);
    expect(it2.id).toBe(it1.id);
    const c2 = await t.s.uploadCommit({ benutzer: MA, body: { upload_id: z2.upload_id, item_id: it2.id } });
    expect(c2).toMatchObject({ item_id: it1.id, file_name: 'neu.mp4', file_size: 2000 });
    expect(c2.file_path.endsWith('/Feedbackschleife_2/neu.mp4')).toBe(true);

    // Rollback beim Ersetzen loescht nie das bestehende Item
    await t.s.uploadVerwerfen({ benutzer: MA, body: { upload_id: z2.upload_id } });
    expect(t.sp.items.has(it1.id)).toBe(true);
  });

  it('Ersetzen einer SharePoint-Datei bei Notschalter: 503 statt Dropbox', async () => {
    const t = setup({ notschalter: true, assets: { kooperation_video_asset: [{ id: A1, video_id: V1, ablage: 'sharepoint', drive_id: 'd1', item_id: 'x' }] } });
    await expect(t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: { ...zielBody(), ersetzen: { typ: 'video', id: A1 } } }))
      .rejects.toMatchObject({ status: 503, code: 'notschalter' });
  });

  it('Commit prueft Besitzer und Zielordner', async () => {
    const t = setup();
    const z = await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: zielBody() });
    const fremd = t.sp.datei('root', 'woanders.mov', 1000);
    await expect(t.s.uploadCommit({ benutzer: { id: 'b9', rolle: 'mitarbeiter' }, body: { upload_id: z.upload_id, item_id: fremd.id } })).rejects.toMatchObject({ status: 403 });
    await expect(t.s.uploadCommit({ benutzer: MA, body: { upload_id: z.upload_id, item_id: fremd.id } })).rejects.toMatchObject({ status: 409 });
  });
});

describe('Commit ohne item_id (Antwort aufs letzte Stueck verloren)', () => {
  it('findet die Datei ueber Name oder Konflikt-Name und Groesse', async () => {
    const t = setup();
    const z = await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: zielBody() });
    const item = t.sp.hochladen(z.upload_url, 1000);
    expect((await t.s.uploadCommit({ benutzer: MA, body: { upload_id: z.upload_id } })).item_id).toBe(item.id);

    // Zweiter Upload gleichen Namens: SharePoint benennt um ("clip 1.mov")
    const z2 = await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: zielBody({ file_size: 2000 }) });
    const item2 = t.sp.hochladen(z2.upload_url, 2000);
    expect(item2.name).toBe('clip 1.mov');
    expect((await t.s.uploadCommit({ benutzer: MA, body: { upload_id: z2.upload_id } })).item_id).toBe(item2.id);
  });

  it('nichts angekommen: 404', async () => {
    const t = setup();
    const z = await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: zielBody() });
    await expect(t.s.uploadCommit({ benutzer: MA, body: { upload_id: z.upload_id } })).rejects.toMatchObject({ status: 404 });
  });

  it('alte Datei gleicher Groesse (vor dem Upload-Start angelegt) zaehlt nicht', async () => {
    const t = setup();
    const z = await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: zielBody() });
    const up = t.supabase.db.ablage_upload.find((u) => u.id === z.upload_id);
    up.erstellt_at = '2026-11-09T12:00:00Z';
    const alt = t.sp.datei(z.ordner.item_id, 'clip.mov', 1000);
    alt.erstellt = '2026-11-09T11:50:00Z';
    await expect(t.s.uploadCommit({ benutzer: MA, body: { upload_id: z.upload_id } })).rejects.toMatchObject({ status: 404 });
    alt.erstellt = '2026-11-09T12:00:30Z';
    expect((await t.s.uploadCommit({ benutzer: MA, body: { upload_id: z.upload_id } })).item_id).toBe(alt.id);
  });
});

describe('ablage-datei', () => {
  it('verschieben: Bild in den Ordner des anderen Videos, Zuordnung gleich mit', async () => {
    const t = setup();
    t.supabase.db.kooperation_videos.push({ id: id(20), kooperation_id: K1, position: 2, thema: 'Haul' });
    const z = await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: { typ: 'still', kooperation_id: K1, kooperation_video_id: V1, version_number: 1, file_name: 'b.jpg', file_size: 3 } });
    const item = t.sp.hochladen(z.upload_url, 3);
    const c = await t.s.uploadCommit({ benutzer: MA, body: { upload_id: z.upload_id, item_id: item.id } });
    t.supabase.db.kooperation_bilder_asset.push({ id: A1, kooperation_id: K1, video_id: V1, version_number: 1, is_final: false, ...c });

    const r = await t.s.dateiVerschieben({ benutzer: MA, caller: t.caller, body: { typ: 'still', id: A1, kooperation_video_id: id(20) } });
    expect(r.file_path).toBe('/Firma/Sommer/Lisa/Videos/Video_2_Haul/Feedbackschleife_1/b.jpg');
    expect(t.supabase.db.kooperation_bilder_asset[0]).toMatchObject({ video_id: id(20), file_path: r.file_path });
    expect(t.sp.items.get(item.id).parent).toBe(t.supabase.db.ablage_ordner.find((o) => o.pfad === '/Firma/Sommer/Lisa/Videos/Video_2_Haul/Feedbackschleife_1').item_id);

    await expect(t.s.dateiVerschieben({ benutzer: MA, caller: t.caller, body: { typ: 'still', id: A1, kooperation_video_id: VX } })).rejects.toMatchObject({ status: 404 });
  });

  it('upload_verwerfen loescht die Datei, ausser eine Zeile zeigt darauf', async () => {
    const t = setup();
    const z = await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: zielBody() });
    const item = t.sp.hochladen(z.upload_url, 1000);
    await t.s.uploadVerwerfen({ benutzer: MA, body: { upload_id: z.upload_id } });
    expect(t.sp.items.has(item.id)).toBe(false);
    expect(t.supabase.db.ablage_upload).toHaveLength(0);

    const z2 = await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: zielBody() });
    const item2 = t.sp.hochladen(z2.upload_url, 1000);
    await t.s.uploadCommit({ benutzer: MA, body: { upload_id: z2.upload_id, item_id: item2.id } });
    t.supabase.db.kooperation_video_asset.push({ id: A2, drive_id: 'd1', item_id: item2.id, ablage: 'sharepoint' });
    await t.s.uploadVerwerfen({ benutzer: MA, body: { upload_id: z2.upload_id } });
    expect(t.sp.items.has(item2.id)).toBe(true);
  });

  it('loeschen: SharePoint in den Papierkorb, Dropbox und geteilte Dateien nicht', async () => {
    const t = setup({ assets: { kooperation_video_asset: [
      { id: A1, ablage: 'sharepoint', drive_id: 'd1', item_id: 'i-a' },
      { id: A2, ablage: 'dropbox', file_path: '/x.mp4' },
      { id: A3, ablage: 'sharepoint', drive_id: 'd1', item_id: 'i-b' },
      { id: A4, ablage: 'sharepoint', drive_id: 'd1', item_id: 'i-b', source_asset_id: A3 },
    ] } });
    expect(await t.s.dateiLoeschen({ benutzer: MA, caller: t.caller, body: { typ: 'video', id: A1 } })).toEqual({ geloescht: true });
    expect(t.sp.calls).toContainEqual(['loeschen', 'i-a']);
    expect(await t.s.dateiLoeschen({ benutzer: MA, caller: t.caller, body: { typ: 'video', id: A2 } })).toEqual({ geloescht: false });
    expect(await t.s.dateiLoeschen({ benutzer: MA, caller: t.caller, body: { typ: 'video', id: A3 } })).toEqual({ geloescht: false });
    await expect(t.s.dateiLoeschen({ benutzer: FINANZEN, caller: t.caller, body: { typ: 'video', id: A1 } })).rejects.toMatchObject({ status: 403 });
  });

  it('umbenennen: Endung bleibt, Kollision bekommt "(2)", Promote-Zeilen ziehen mit', async () => {
    const t = setup();
    const f = t.sp.datei('root', 'Ordner');
    f.folder = {};
    const a = t.sp.datei(f.id, 'alt.mp4');
    t.sp.datei(f.id, 'AdName.mp4');
    t.supabase.db.kooperation_video_asset.push(
      { id: A1, ablage: 'sharepoint', drive_id: 'd1', item_id: a.id, file_name: 'alt.mp4', file_path: '/U/Ordner/alt.mp4' },
      { id: A2, ablage: 'sharepoint', drive_id: 'd1', item_id: a.id, file_name: 'alt.mp4', file_path: '/U/Ordner/alt.mp4', source_asset_id: A1 },
    );
    const r = await t.s.dateiUmbenennen({ benutzer: MA, caller: t.caller, body: { typ: 'video', id: A1, name: 'AdName' } });
    expect(r).toMatchObject({ file_name: 'AdName (2).mp4', file_path: '/U/Ordner/AdName (2).mp4' });
    expect(t.supabase.db.kooperation_video_asset.every((x) => x.file_name === 'AdName (2).mp4')).toBe(true);
  });

  it('umbenennen einer Dropbox-Datei: 409 nicht_sharepoint', async () => {
    const t = setup({ assets: { kooperation_video_asset: [{ id: A1, ablage: 'dropbox', file_path: '/x.mp4' }] } });
    await expect(t.s.dateiUmbenennen({ benutzer: MA, caller: t.caller, body: { typ: 'video', id: A1, name: 'y' } }))
      .rejects.toMatchObject({ status: 409, code: 'nicht_sharepoint' });
  });
});

describe('ablage-loeschen', () => {
  it('Kooperation: Ordner endgueltig, Register markiert, verstreute Dateien einzeln', async () => {
    const t = setup();
    const z = await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: zielBody() });
    const item = t.sp.hochladen(z.upload_url, 1000);
    const lose = t.sp.datei('root', 'verirrt.mp4');
    t.supabase.db.kooperation_video_asset.push(
      { id: A1, video_id: V1, ablage: 'sharepoint', drive_id: 'd1', item_id: item.id, file_path: `${z.ordner.pfad}/clip.mov` },
      { id: A2, video_id: V1, ablage: 'sharepoint', drive_id: 'd1', item_id: lose.id, file_path: '/verirrt.mp4' },
      { id: A3, video_id: V1, ablage: 'dropbox', file_path: '/Dropbox/x.mp4' },
    );
    const koopOrdner = t.supabase.db.ablage_ordner.find((o) => o.art === 'kooperation');
    const r = await t.s.entityLoeschen({ benutzer: MA, caller: t.caller, body: { entity: 'kooperation', id: K1 } });
    expect(r).toEqual({ ordner: 1, dateien: 2, fehler: [] });
    expect(t.sp.calls).toContainEqual(['endgueltigLoeschen', koopOrdner.item_id]);
    expect(t.sp.items.has(item.id)).toBe(false);
    expect(t.sp.items.has(lose.id)).toBe(false);
    expect(t.supabase.db.ablage_ordner.find((o) => o.id === koopOrdner.id).geloescht_at).toBeTruthy();
  });

  it('ohne Konfiguration: nur Nullen', async () => {
    const t = setup({ ohneSp: true });
    expect(await t.s.entityLoeschen({ benutzer: MA, caller: t.caller, body: { entity: 'unternehmen', id: U1 } }))
      .toEqual({ ordner: 0, dateien: 0, fehler: [], nicht_konfiguriert: true });
  });
});

describe('Creator-Upload mit deferCommit', () => {
  const startBody = (extra = {}) => ({ token: ROH_TOKEN, targetType: 'video', targetId: V1, fileName: 'mein clip.mov', fileSize: 5000, contentType: 'video/quicktime', ...extra });
  const creator = (t) => createCreatorAblage({ supabase: t.supabase, ablage: { sp: t.sp, ordner: t.ordner } });

  it('Weiche auf dropbox: bisheriger Weg', async () => {
    const t = setup({ ablageZiel: 'dropbox' });
    expect(await creator(t).start(startBody())).toEqual({ ziel: 'dropbox' });
  });

  it('Start -> Bytes -> Complete: Datei erst nach Pruefung sichtbar, Asset + Ordner-Link', async () => {
    const t = setup();
    const c = creator(t);
    const s = await c.start(startBody());
    expect(s).toMatchObject({ ziel: 'sharepoint', versionNumber: 1, chunkBytes: 10 * 1024 * 1024 });
    const [, , name, opts] = t.sp.calls.find(([op]) => op === 'uploadSession');
    expect(opts.deferCommit).toBe(true);
    expect(name).toBe('lisa_m_firma_sommer_1_v1.mov');

    await expect(c.complete({ token: ROH_TOKEN, jobId: s.jobId })).rejects.toMatchObject({ code: 'unvollstaendig' });
    expect(t.supabase.db.creator_upload_job[0].status).toBe('pending');

    expect(t.sp.hochladen(s.uploadUrl, 5000)).toBeNull();
    expect([...t.sp.items.values()].some((i) => i.name === name)).toBe(false);
    expect(await c.complete({ token: ROH_TOKEN, jobId: s.jobId })).toEqual({ status: 'done', versionNumber: 1 });

    const asset = t.supabase.db.kooperation_video_asset[0];
    expect(asset).toMatchObject({ ablage: 'sharepoint', drive_id: 'd1', video_id: V1, version_number: 1, is_final: false, uploaded_by: null });
    expect(asset.file_path).toBe(`/Firma/Sommer/Lisa/Videos/Video_1_Unboxing/Feedbackschleife_1/${name}`);
    expect(t.supabase.db.kooperation_videos.find((v) => v.id === V1).folder_url).toMatch(/^https:\/\/sp\.test\//);
    expect(t.supabase.db.creator_upload_job[0]).toMatchObject({ status: 'done', asset_id: asset.id });
    expect(await c.complete({ token: ROH_TOKEN, jobId: s.jobId })).toEqual({ status: 'done', versionNumber: 1 });
  });

  it('Schleife inzwischen belegt: Datei wandert in die naechste freie', async () => {
    const t = setup();
    const c = creator(t);
    const s = await c.start(startBody());
    t.supabase.db.kooperation_video_asset.push({ id: A1, video_id: V1, version_number: 1, is_final: false });
    t.sp.hochladen(s.uploadUrl, 5000);
    expect(await c.complete({ token: ROH_TOKEN, jobId: s.jobId })).toEqual({ status: 'done', versionNumber: 2 });
    const neu = t.supabase.db.kooperation_video_asset.find((a) => a.ablage === 'sharepoint');
    expect(neu.file_path).toContain('/Feedbackschleife_2/');
    expect(t.sp.calls.some(([op]) => op === 'verschieben')).toBe(true);
  });

  it('falsche Groesse: Datei weg, Job failed', async () => {
    const t = setup();
    const c = creator(t);
    const s = await c.start(startBody());
    t.sp.hochladen(s.uploadUrl, 4000);
    await expect(c.complete({ token: ROH_TOKEN, jobId: s.jobId })).rejects.toMatchObject({ code: 'groesse' });
    expect(t.supabase.db.creator_upload_job[0].status).toBe('failed');
    expect(t.supabase.db.kooperation_video_asset).toHaveLength(0);
  });

  it('ungueltiger Token: 404 ohne Hinweis auf die Ablage', async () => {
    const t = setup();
    await expect(creator(t).start(startBody({ token: 'b'.repeat(64) }))).rejects.toMatchObject({ status: 404 });
  });
});
