import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createFakeSupabase, createFakeSharePoint, ORDNER_UNIQUE } from './fixtures/fakeSupabase.js';

const require = createRequire(import.meta.url);
const { createUmzug } = require('../../netlify/functions/_shared/ablage/umzug.js');
const { createOrdner } = require('../../netlify/functions/_shared/ablage/ordner.js');
const ziel = require('../../netlify/functions/_shared/ablage/ziel.js');

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const K1 = id(1);
const KA1 = id(2);
const U1 = id(3);
const V1 = id(4);
const V2 = id(5);
const A1 = id(10);
const F1 = id(11);
const ST1 = id(12);
const START = Date.parse('2026-12-01T22:00:00Z');
const iso = (ms) => new Date(ms).toISOString();
const MIN = 60000;
// Variante B ohne eigenen Ordner (ADR 0065): flach in der Schleife, variant_name bleibt an der Zeile
const ZIEL = '/Firma/Medien/Sommer/Lisa/Videos/Video_1_Unboxing/Feedbackschleife_2';

function antwort(status, body = Buffer.alloc(0), headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    arrayBuffer: async () => Uint8Array.from(body).buffer,
  };
}

const MEDIEN = ['video', 'story', 'still', 'roh'];

/** ablage_umzug_holen bzw. ablage_dokument_umzug_holen (Weiche je Unternehmen steckt im RPC, hier immer an). */
const holen = (uhr, medien) => ({ p_drive_id, p_sekunden }, db) => {
  const z = db.ablage_umzug
    .filter((x) => x.drive_id === p_drive_id && x.status === 'offen' && Date.parse(x.naechster_versuch) <= uhr.t
      && (!x.gesperrt_bis || Date.parse(x.gesperrt_bis) < uhr.t) && MEDIEN.includes(x.typ) === medien)
    .sort((a, b) => a.naechster_versuch.localeCompare(b.naechster_versuch))[0];
  if (!z) return [];
  z.gesperrt_bis = iso(uhr.t + p_sekunden * 1000);
  return [{ ...z }];
};

function setup({ assets, dateien = { '/Alt/Firma/clip.mov': Buffer.from('0123456789') }, zeilen = [], tabellen = {}, rpc = {}, uhr = { t: START } } = {}) {
  const supabase = createFakeSupabase({
    tabellen: {
      ablage_stand: [{ drive_id: 'd1', root_item_id: 'root' }],
      ablage_ordner: [],
      ablage_upload: [],
      ablage_umzug: zeilen,
      ablage_einstellung: [{ schluessel: 'notschalter', wert: false }],
      kooperationen: [{
        id: K1, name: 'Lisa', kampagne_id: KA1,
        kampagne: {
          id: KA1, kampagnenname: 'Auftrag', eigener_name: 'Sommer', unternehmen_id: U1, marke_id: null,
          unternehmen: { id: U1, firmenname: 'Firma', ablage_ziel: 'sharepoint', ist_test: false }, marke: null,
        },
      }],
      kooperation_videos: [
        { id: V1, kooperation_id: K1, position: 1, thema: 'Unboxing' },
        { id: V2, kooperation_id: K1, position: 2, thema: 'Rezept' },
      ],
      kooperation_story: [{ id: ST1, video_id: V1, slot_index: 1 }],
      kooperation_video_asset: assets ?? [
        { id: A1, video_id: V1, version_number: 2, variant_name: 'B', is_final: false, ablage: 'dropbox', file_path: '/Alt/Firma/clip.mov', file_name: 'clip.mov', file_url: 'https://www.dropbox.com/s/1/clip.mov' },
        { id: F1, video_id: V1, version_number: 1, is_final: true, source_asset_id: A1, ablage: 'dropbox', file_path: '/Alt/Firma/clip.mov', file_name: 'clip.mov' },
      ],
      kooperation_story_asset: [],
      kooperation_bilder_asset: [],
      kooperation_rohmaterial_asset: [],
      ...tabellen,
    },
    unique: { ablage_ordner: ORDNER_UNIQUE },
    rpc: { ablage_umzug_holen: holen(uhr, true), ablage_dokument_umzug_holen: holen(uhr, false), ...rpc },
  });
  const sp = createFakeSharePoint();
  const ordner = createOrdner({ supabase, sp, schlafen: async () => {} });
  const dropbox = { downloadUrl: vi.fn(async (pfad) => (dateien[pfad] ? { url: `https://dbx.test${encodeURI(pfad)}` } : null)) };
  const fetchImpl = vi.fn(async (url, { headers = {} } = {}) => {
    const inhalt = dateien[decodeURI(new URL(url).pathname)];
    if (!inhalt) return antwort(404);
    if (!headers.Range) return antwort(200, inhalt, { 'content-length': String(inhalt.length) });
    if (!inhalt.length) return antwort(416);
    const [, a, b] = /bytes=(\d+)-(\d+)/.exec(headers.Range);
    const von = Number(a);
    const bis = Math.min(Number(b), inhalt.length - 1);
    return antwort(206, inhalt.subarray(von, bis + 1), { 'content-range': `bytes ${von}-${bis}/${inhalt.length}` });
  });
  const u = createUmzug({
    supabase, ablage: { sp, ordner }, dropbox, fetchImpl, jetzt: () => uhr.t, schlafen: async (ms) => { uhr.t += ms; }, chunkBytes: 4,
  });
  const db = supabase.db;
  const asset = (aid = A1) => db.kooperation_video_asset.find((a) => a.id === aid);
  const zeile = (zid = 'z1') => db.ablage_umzug.find((z) => z.id === zid);
  const chunks = () => sp.calls.filter((c) => c[0] === 'chunk').map((c) => `${c[2]}-${c[3]}`);
  return { uhr, supabase, db, sp, ordner, dropbox, u, asset, zeile, chunks };
}

const umzugZeile = (extra = {}) => ({
  id: 'z1', drive_id: 'd1', unternehmen_id: U1, typ: 'video', asset_id: A1, quelle: 'dropbox', quelle_ref: '/Alt/Firma/clip.mov',
  status: 'offen', versuche: 0, naechster_versuch: iso(START - MIN), gesperrt_bis: null, versatz: 0, ...extra,
});

afterEach(() => ziel._reset());

describe('Umzug Dropbox', () => {
  it('kopiert in Stuecken, committet, stellt Original und Finale um, sortiert nach Fachspalten ein', async () => {
    const t = setup({ zeilen: [umzugZeile()] });
    const r = await t.u.lauf();
    expect(r).toMatchObject({ fertig: 1, leer: true, bytes: 10 });
    expect(t.chunks()).toEqual(['0-3', '4-7', '8-9']);
    expect(t.sp.calls.find((c) => c[0] === 'uploadSession')[3]).toEqual({ conflict: 'rename', deferCommit: true });

    const a = t.asset();
    expect(a).toMatchObject({ ablage: 'sharepoint', drive_id: 'd1', file_path: `${ZIEL}/clip.mov`, file_name: 'clip.mov', file_size: 10, version_number: 2, variant_name: 'B' });
    expect(t.sp.items.get(a.item_id).inhalt.toString()).toBe('0123456789');
    expect(t.asset(F1)).toMatchObject({ ablage: 'sharepoint', item_id: a.item_id, file_path: a.file_path, is_final: true, source_asset_id: A1 });
    expect(t.db.ablage_upload).toEqual([expect.objectContaining({
      item_id: a.item_id, abgeschlossen_at: iso(START), typ: 'video', kontext: expect.objectContaining({ umzug_asset_id: A1, kooperation_id: K1 }),
    })]);
    expect(t.zeile()).toMatchObject({ status: 'fertig', item_id: a.item_id, upload_url: null, gesperrt_bis: null });
  });

  it('Budget zu Ende: Versatz bleibt stehen, der naechste Lauf setzt fort', async () => {
    const t = setup({ zeilen: [umzugZeile()] });
    const orig = t.sp.chunkHochladen.bind(t.sp);
    t.sp.chunkHochladen = async (...a) => { t.uhr.t += 1000; return orig(...a); };
    const r1 = await t.u.lauf({ budgetMs: 1500 });
    expect(r1).toMatchObject({ offen: 1 });
    expect(t.zeile()).toMatchObject({ status: 'offen', versatz: 8, gesperrt_bis: null });
    expect(t.db.ablage_upload).toHaveLength(0);

    const r2 = await t.u.lauf();
    expect(r2).toMatchObject({ fertig: 1 });
    expect(t.chunks()).toEqual(['0-3', '4-7', '8-9']);
    expect(t.sp.calls.filter((c) => c[0] === 'uploadSession')).toHaveLength(1);
  });

  it('Session abgelaufen, noch kein Commit: neu von vorn', async () => {
    const t = setup({ zeilen: [umzugZeile({ upload_url: 'https://upload.test/weg', versatz: 4, groesse: 10, ziel_name: 'clip.mov' })] });
    await t.u.lauf();
    expect(t.chunks()).toEqual(['0-3', '4-7', '8-9']);
    expect(t.zeile().status).toBe('fertig');
  });

  it('Session weg nach Commit-Versuch: erst dem Abgleich Zeit lassen, dann neu', async () => {
    const t = setup({
      zeilen: [umzugZeile({ upload_url: 'https://upload.test/weg', versatz: 10, groesse: 10, upload_id: 'up1', ziel_name: 'clip.mov' })],
    });
    t.db.ablage_upload.push({ id: 'up1', drive_id: 'd1', parent_item_id: 'x', name: 'clip.mov', groesse: 10, typ: 'video', erstellt_at: iso(START - 5 * MIN), kontext: {} });
    const r1 = await t.u.lauf();
    expect(r1).toMatchObject({ offen: 1 });
    expect(t.zeile()).toMatchObject({ status: 'offen', grund: 'wartet_auf_abgleich', naechster_versuch: iso(START + 15 * MIN), gesperrt_bis: null });
    expect(t.chunks()).toEqual([]);

    t.uhr.t += 31 * MIN;
    await t.u.lauf();
    expect(t.zeile().status).toBe('fertig');
    expect(t.db.ablage_upload.map((x) => x.id)).not.toContain('up1');
  });

  it('Video inzwischen umgehaengt: alte Session verworfen, neues Ziel', async () => {
    const t = setup({ zeilen: [umzugZeile({ upload_url: 'https://upload.test/alt', versatz: 4, groesse: 10, ziel_parent_item_id: 'anderswo', ziel_name: 'clip.mov' })] });
    t.sp.sessions.set('https://upload.test/alt', { parentId: 'anderswo', name: 'clip.mov', deferCommit: true, empfangen: 4 });
    await t.u.lauf();
    expect(t.sp.calls).toContainEqual(['sessionVerwerfen', 'https://upload.test/alt']);
    expect(t.asset().file_path).toBe(`${ZIEL}/clip.mov`);
  });

  it('Datei fehlt in Dropbox: Fehler ohne Wiederholung', async () => {
    const t = setup({ zeilen: [umzugZeile({ quelle_ref: '/Alt/weg.mov' })] });
    const r = await t.u.lauf();
    expect(r).toMatchObject({ fehler: 1 });
    expect(t.zeile()).toMatchObject({ status: 'fehler', grund: 'dropbox_fehlt', versuche: 1 });
  });

  it('voruebergehender Fehler: Backoff, nach 6 Versuchen Fehler', async () => {
    const t = setup({ zeilen: [umzugZeile()] });
    t.sp.chunkHochladen = async () => { const e = new Error('Graph 500'); e.status = 500; throw e; };
    await t.u.lauf();
    expect(t.zeile()).toMatchObject({ status: 'offen', versuche: 1, grund: 'Graph 500', naechster_versuch: iso(START + 120000), gesperrt_bis: null });
    t.zeile().versuche = 5;
    t.zeile().naechster_versuch = iso(START);
    await t.u.lauf();
    expect(t.zeile()).toMatchObject({ status: 'fehler', versuche: 6 });
  });

  it('Zeile schon auf SharePoint (nach dem Stichtag ersetzt) bzw. geloescht', async () => {
    const t = setup({
      assets: [
        { id: A1, video_id: V1, ablage: 'sharepoint', drive_id: 'd1', item_id: 'neu1', file_path: '/x.mov' },
      ],
      zeilen: [umzugZeile(), umzugZeile({ id: 'z2', asset_id: id(99), naechster_versuch: iso(START - 500) })],
    });
    await t.u.lauf();
    expect(t.zeile()).toMatchObject({ status: 'fertig', item_id: 'neu1' });
    expect(t.zeile('z2')).toMatchObject({ status: 'uebersprungen', grund: 'asset_geloescht' });
    expect(t.chunks()).toEqual([]);
  });

  it('Story und Bild ohne Video landen in der Feedbackschleife unter Videos/ (Bild am ersten Video)', async () => {
    const t = setup({
      dateien: { '/Alt/s.mp4': Buffer.from('0123'), '/Alt/b.jpg': Buffer.from('56') },
      zeilen: [
        umzugZeile({ typ: 'story', asset_id: 'st-a', quelle_ref: '/Alt/s.mp4' }),
        umzugZeile({ id: 'z2', typ: 'still', asset_id: 'b-a', quelle_ref: '/Alt/b.jpg', naechster_versuch: iso(START - 500) }),
      ],
    });
    t.db.kooperation_story_asset.push({ id: 'st-a', story_id: ST1, video_id: V1, version_number: 1, is_final: false, ablage: 'dropbox', file_name: 's.mp4' });
    t.db.kooperation_bilder_asset.push({ id: 'b-a', kooperation_id: K1, video_id: null, version_number: 1, is_final: false, ablage: 'dropbox', file_name: 'b.jpg' });
    await t.u.lauf();
    const basis = '/Firma/Medien/Sommer/Lisa/Videos/Video_1_Unboxing/Feedbackschleife_1';
    expect(t.db.kooperation_story_asset[0]).toMatchObject({ ablage: 'sharepoint', file_path: `${basis}/Story_1/s.mp4` });
    expect(t.db.kooperation_bilder_asset[0]).toMatchObject({ ablage: 'sharepoint', file_path: `${basis}/b.jpg`, video_id: V1 });
    expect(t.db.ablage_ordner.some((o) => o.typ === 'storys' || o.typ === 'bilder')).toBe(false);
  });

  it('leere Datei wird uebersprungen', async () => {
    const t = setup({ dateien: { '/Alt/Firma/clip.mov': Buffer.alloc(0) }, zeilen: [umzugZeile()] });
    await t.u.lauf();
    expect(t.zeile()).toMatchObject({ status: 'uebersprungen', grund: 'leer' });
  });
});

describe('Umzug OneDrive-Links', () => {
  const OD = 'https://firma-my.sharepoint.com/:v:/g/personal/max/abc';
  const odSetup = ({ fertigNach = 1, fehler } = {}) => {
    const t = setup({
      assets: [{ id: A1, video_id: V1, version_number: 1, is_final: false, ablage: 'dropbox', file_path: null, file_url: OD }],
      zeilen: [umzugZeile({ quelle: 'onedrive', quelle_ref: OD })],
    });
    let polls = 0;
    const kopie = {};
    t.sp.freigabeAufloesen = vi.fn(async () => {
      if (fehler) { const e = new Error('accessDenied'); e.status = fehler; throw e; }
      return { driveId: 'od1', itemId: 'q1', name: 'Mein Video.mp4', groesse: 50, ordner: false };
    });
    t.sp.kopieren = vi.fn(async (_d, _i, parent, name) => {
      Object.assign(kopie, { parent, name, uploads: t.db.ablage_upload.length });
      return 'https://monitor.test/1';
    });
    t.sp.kopierStatus = vi.fn(async () => {
      polls++;
      if (polls < fertigNach) return { status: 'inProgress', prozent: 50 };
      const it = t.sp.datei(kopie.parent, kopie.name, 50);
      return { status: 'completed', itemId: it.id };
    });
    return { ...t, kopie };
  };

  it('Kopie im Tenant: Upload-Zeile vor der Kopie, Asset umgestellt', async () => {
    const t = odSetup({ fertigNach: 3 });
    const r = await t.u.lauf();
    expect(r).toMatchObject({ fertig: 1 });
    expect(t.kopie.uploads).toBe(1);
    expect(t.asset()).toMatchObject({
      ablage: 'sharepoint', file_name: 'Mein Video.mp4', file_size: 50,
      file_path: '/Firma/Medien/Sommer/Lisa/Videos/Video_1_Unboxing/Feedbackschleife_1/Mein Video.mp4',
    });
    expect(t.zeile()).toMatchObject({ status: 'fertig', kopie_url: null });
  });

  it('Kopie dauert: Monitor-URL bleibt, naechster Lauf pollt ohne neue Kopie', async () => {
    const t = odSetup({ fertigNach: 100 });
    await t.u.lauf({ budgetMs: 60000 });
    expect(t.zeile()).toMatchObject({ status: 'offen', kopie_url: 'https://monitor.test/1', gesperrt_bis: null });
    t.sp.kopierStatus.mockImplementation(async () => {
      const it = t.sp.datei(t.kopie.parent, t.kopie.name, 50);
      return { status: 'completed', itemId: it.id };
    });
    t.uhr.t += MIN;
    await t.u.lauf();
    expect(t.sp.kopieren).toHaveBeenCalledTimes(1);
    expect(t.zeile().status).toBe('fertig');
  });

  it('kein Zugriff auf das OneDrive: Fehler (Wizard: Site freigeben, dann erneut)', async () => {
    const t = odSetup({ fehler: 403 });
    await t.u.lauf();
    expect(t.zeile()).toMatchObject({ status: 'fehler', grund: 'onedrive_kein_zugriff' });
    expect(t.db.ablage_upload).toHaveLength(0);
  });
});

describe('Umzug Lauf', () => {
  it('Notschalter pausiert den Umzug', async () => {
    const t = setup({ zeilen: [umzugZeile()] });
    t.db.ablage_einstellung[0].wert = true;
    expect(await t.u.lauf()).toEqual({ pausiert: true });
    expect(t.zeile().status).toBe('offen');
  });

  it('Laeuferbedarf und Uebersicht', async () => {
    const t = setup({
      zeilen: [
        umzugZeile(),
        umzugZeile({ id: 'z2', asset_id: id(20) }),
        umzugZeile({ id: 'z3', asset_id: id(21), gesperrt_bis: iso(START + MIN) }),
        umzugZeile({ id: 'z4', asset_id: id(22), status: 'fertig' }),
        umzugZeile({ id: 'z5', asset_id: id(23), status: 'fehler' }),
      ],
    });
    expect(await t.u.laeuferBedarf({ parallel: 2 })).toBe(1);
    expect(await t.u.laeuferBedarf({ parallel: 5 })).toBe(2);
    expect(await t.u.uebersicht()).toEqual([{ unternehmen_id: U1, offen: 3, fertig: 1, fehler: 1, uebersprungen: 0 }]);
  });
});

describe('Umzug Dokumente (ADR 0068)', () => {
  const VT1 = id(30);
  const R1 = id(31);
  const SIG = 'https://x.supabase.co/storage/v1/object/public/unterschriebene-vertraege/vt1/sig.pdf';
  const dokZeile = (extra) => umzugZeile({ quelle: 'dropbox', ...extra });

  function dokSetup({ zeilen, einstellung = [] } = {}) {
    const t = setup({
      dateien: { '/Alt/Firma/Vertrag Lisa.pdf': Buffer.from('VERTRAG'), '/Alt/Firma/RE-1.pdf': Buffer.from('RECHNUNG') },
      zeilen: zeilen ?? [
        dokZeile({ id: 'z1', typ: 'vertrag', asset_id: VT1, quelle_ref: '/Alt/Firma/Vertrag Lisa.pdf' }),
        dokZeile({ id: 'z2', typ: 'vertrag_unterschrieben', asset_id: VT1, quelle: 'storage', quelle_ref: 'vt1/sig.pdf', quelle_bucket: 'unterschriebene-vertraege' }),
        dokZeile({ id: 'z3', typ: 'rechnung_alt', asset_id: R1, quelle_ref: '/Alt/Firma/RE-1.pdf' }),
      ],
      tabellen: {
        ablage_einstellung: [{ schluessel: 'notschalter', wert: false }, ...einstellung],
        unternehmen: [{ id: U1, firmenname: 'Firma', ist_test: false, dokument_ablage_ziel: 'sharepoint' }],
        kampagne: [{ id: KA1, kampagnenname: 'Auftrag', eigener_name: 'Sommer', unternehmen_id: U1, marke_id: null }],
        marke: [],
        auftrag: [],
        vertraege: [{
          id: VT1, name: 'Vertrag Lisa', kunde_unternehmen_id: U1, kampagne_id: KA1, contracting_auftrag_id: null,
          datei_url: 'https://www.dropbox.com/s/v.pdf', datei_path: '/Alt/Firma/Vertrag Lisa.pdf', datei_ablage: 'dropbox',
          dropbox_file_url: null, dropbox_file_path: null, signiert_ablage: 'dropbox',
          unterschriebener_vertrag_url: SIG, unterschriebener_vertrag_path: 'vt1/sig.pdf',
        }],
        rechnung: [{ id: R1, rechnung_nr: 'RE-1', unternehmen_id: U1, kampagne_id: KA1, auftrag_id: null, pdf_url: 'https://www.dropbox.com/s/r.pdf', pdf_path: '/Alt/Firma/RE-1.pdf' }],
        rechnung_pdfs: [],
      },
    });
    t.supabase.storage = {
      from: (bucket) => ({
        download: async (pfad) => (bucket === 'unterschriebene-vertraege' && pfad === 'vt1/sig.pdf'
          ? { data: { arrayBuffer: async () => Uint8Array.from(Buffer.from('SIGNIERT')).buffer }, error: null }
          : { data: null, error: { message: 'Object not found', statusCode: '404' } }),
      }),
    };
    return t;
  }

  it('Dropbox + Storage + rechnung.pdf_url: Bereichs-Ordner, Spalten umgestellt, rechnung_pdfs-Zeile neu', async () => {
    const t = dokSetup();
    const r = await t.u.lauf();
    expect(r).toMatchObject({ fertig: 3, leer: true, bytes: 7 + 8 + 8 });
    const v = t.db.vertraege[0];
    expect(v).toMatchObject({ datei_ablage: 'sharepoint', signiert_ablage: 'sharepoint', signiert_drive_id: 'd1' });
    expect(v.datei_path).toMatch(/\/Firma\/Verträge\/Sommer\/Vertrag Lisa\.pdf$/);
    expect(v.dropbox_file_path).toMatch(/\/Firma\/Verträge\/Sommer\/sig\.pdf$/);
    expect(t.db.rechnung_pdfs).toHaveLength(1);
    expect(t.db.rechnung_pdfs[0]).toMatchObject({ rechnung_id: R1, ablage: 'sharepoint', file_name: 'RE-1.pdf', size: 8, content_type: 'application/pdf' });
    expect(t.db.rechnung_pdfs[0].file_path).toMatch(/\/Firma\/Rechnungen\/Sommer\/RE-1\/RE-1\.pdf$/);
    expect(t.db.ablage_umzug.map((z) => z.status)).toEqual(['fertig', 'fertig', 'fertig']);
    expect(t.db.ablage_upload.every((u) => u.abgeschlossen_at && u.kontext.umzug_typ)).toBe(true);
    expect(t.db.ablage_upload.find((u) => u.kontext.umzug_typ === 'rechnung_alt').kontext).toMatchObject({ typ: 'rechnung', bezug_id: R1, umzug_asset_id: R1 });
    expect(t.db.ablage_upload.find((u) => u.kontext.umzug_typ === 'vertrag').kontext).toMatchObject({ typ: 'vertrag', bezug_id: VT1, umzug_dokument_id: VT1 });
    // deferCommit: unsichtbar bis die Upload-Zeile steht
    expect(t.sp.calls.filter((c) => c[0] === 'uploadSession').every((c) => c[3].deferCommit)).toBe(true);
  });

  it('Dokument-Notschalter haelt nur Dokumente an; schon auf SharePoint = fertig; Datei fehlt = Fehler', async () => {
    const t = dokSetup({ einstellung: [{ schluessel: 'notschalter_dokumente', wert: true }] });
    expect(await t.u.lauf()).toMatchObject({ dokumente_pausiert: true, leer: true, fertig: 0 });
    expect(t.db.ablage_umzug.every((z) => z.status === 'offen')).toBe(true);
    ziel._reset();

    const t2 = dokSetup({
      zeilen: [
        dokZeile({ id: 'z1', typ: 'vertrag', asset_id: VT1, quelle_ref: '/Alt/Firma/weg.pdf' }),
        dokZeile({ id: 'z2', typ: 'rechnung_alt', asset_id: R1, quelle_ref: '/Alt/Firma/RE-1.pdf' }),
      ],
    });
    Object.assign(t2.db.vertraege[0], { datei_ablage: 'dropbox', datei_path: '/Alt/Firma/weg.pdf' });
    await t2.u.lauf();
    expect(t2.zeile('z1')).toMatchObject({ status: 'fehler', grund: 'dropbox_fehlt' });
    expect(t2.zeile('z2').status).toBe('fertig');

    Object.assign(t2.db.vertraege[0], { datei_ablage: 'sharepoint', datei_drive_id: 'd1', datei_item_id: 'x9' });
    Object.assign(t2.zeile('z1'), { status: 'offen', naechster_versuch: iso(t2.uhr.t - MIN) });
    await t2.u.lauf();
    expect(t2.zeile('z1')).toMatchObject({ status: 'fertig', item_id: 'x9' });
  });

  it('dokumenteAnlegen reiht ueber das RPC ein', async () => {
    const anlegen = vi.fn(() => 5);
    const t = setup({ rpc: { ablage_dokument_umzug_anlegen: anlegen } });
    expect(await t.u.dokumenteAnlegen(U1)).toBe(5);
    expect(anlegen).toHaveBeenCalledWith({ p_drive_id: 'd1', p_unternehmen_id: U1 }, expect.anything());
  });
});
