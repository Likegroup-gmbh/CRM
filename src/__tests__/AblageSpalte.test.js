import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createFakeSupabase, createFakeSharePoint, ORDNER_UNIQUE } from './fixtures/fakeSupabase.js';

const require = createRequire(import.meta.url);
const { createSchreiben } = require('../../netlify/functions/_shared/ablage/schreiben.js');
const { createOrdner } = require('../../netlify/functions/_shared/ablage/ordner.js');
const { createFreigabe } = require('../../netlify/functions/_shared/ablage/freigabe.js');
const k = require('../../netlify/functions/_shared/ablage/klassifizierung.js');

// Upload-Spalten der Kampagne (custom_columns, field_type upload): Ziel, Ersetzen, Loeschkaskade,
// Klassifizierung im Abgleich und Kunden-Leselink auf den Spalten-Ordner.

const ENV = { MS_TENANT_ID: 't', MS_CLIENT_ID: 'c', SP_SITE_URL: 'https://x.sharepoint.com/sites/Medienablage', SP_SITE_ID: 's1', SP_DRIVE_ID: 'd1' };

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const K1 = id(1);
const KA1 = id(2);
const U1 = id(3);
const V1 = id(4);
const SK = id(31);
const SV = id(32);
const SX = id(33);
const STEXT = id(34);
const C1 = id(41);

const MA = { id: 'b1', rolle: 'mitarbeiter', freigeschaltet: true };
const KUNDE = { id: 'ku', rolle: 'kunde', freigeschaltet: true };

function koop() {
  return {
    id: K1, name: 'Lisa', kampagne_id: KA1, creator_id: 'cr1', created_at: '2026-01-01',
    kampagne: {
      id: KA1, kampagnenname: 'Auftrag', eigener_name: 'Sommer', unternehmen_id: U1, marke_id: null,
      unternehmen: { id: U1, firmenname: 'Firma', ist_test: false }, marke: null,
    },
    creator: { vorname: 'Lisa', nachname: 'M' },
  };
}

const SPALTEN = [
  { id: SK, name: 'Rohschnitt', field_type: 'upload', entity_type: 'kooperation', kampagne_id: KA1, visible_for_kunden: false },
  { id: SV, name: 'Untertitel', field_type: 'upload', entity_type: 'video', kampagne_id: KA1, visible_for_kunden: true },
  { id: SX, name: 'Fremd', field_type: 'upload', entity_type: 'kooperation', kampagne_id: id(98), visible_for_kunden: true },
  { id: STEXT, name: 'Notiz', field_type: 'text', entity_type: 'kooperation', kampagne_id: KA1, visible_for_kunden: true },
];

function setup() {
  const supabase = createFakeSupabase({
    tabellen: {
      ablage_stand: [{ drive_id: 'd1', root_item_id: 'root' }],
      ablage_ordner: [],
      ablage_upload: [],
      ablage_eingang: [],
      ablage_freigabelink: [],
      kooperationen: [koop()],
      kooperation_videos: [{ id: V1, kooperation_id: K1, position: 1, thema: 'Unboxing' }],
      custom_columns: SPALTEN,
      custom_column_assets: [],
      kampagne: [{ id: KA1, unternehmen_id: U1 }],
      unternehmen: [{ id: U1 }],
    },
    unique: { ablage_ordner: ORDNER_UNIQUE },
    rpc: {
      ablage_pfad_umschreiben: () => 0,
      ablage_nachfahren: () => [],
      ablage_meine_kooperationen: ({ p_ids }) => p_ids.filter((x) => x === K1).map((x) => ({ kooperation_id: x })),
    },
  });
  const sp = createFakeSharePoint();
  const ordner = createOrdner({ supabase, sp, schlafen: async () => {} });
  const ablage = { sp, ordner, konfig: { siteUrl: ENV.SP_SITE_URL } };
  const s = createSchreiben({ supabase, ablage });
  const freigabe = createFreigabe({ supabase, ablage, jetzt: () => Date.parse('2026-11-09T12:00:00Z') });
  return { supabase, sp, s, freigabe, caller: supabase };
}

const body = (extra = {}) => ({ typ: 'spalte', custom_column_id: SK, entity_id: K1, file_name: 'Schnitt.MP4', file_size: 1000, ...extra });

beforeEach(() => { Object.assign(process.env, ENV); });
afterEach(() => { for (const key of Object.keys(ENV)) delete process.env[key]; });

describe('ablage-upload-ziel: typ spalte', () => {
  it('Spalte auf Kooperationsebene: Ordner <Kooperation>/<Spalte>, Kontext mit Spalte und Entitaet', async () => {
    const t = setup();
    const z = await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: body() });
    expect(z.ordner.pfad).toBe('/Firma/Medien/Sommer/Lisa/Rohschnitt');
    expect(t.supabase.db.ablage_ordner.find((o) => o.art === 'spalte')).toMatchObject({ custom_column_id: SK, kooperation_id: K1 });
    expect(t.supabase.db.ablage_upload[0]).toMatchObject({
      typ: 'spalte',
      kontext: { typ: 'spalte', kooperation_id: K1, kooperation_video_id: null, custom_column_id: SK, entity_id: K1, ordner_pfad: z.ordner.pfad },
    });

    const item = t.sp.hochladen(z.upload_url, 1000);
    const c = await t.s.uploadCommit({ benutzer: MA, body: { upload_id: z.upload_id, item_id: item.id } });
    expect(c).toMatchObject({ ablage: 'sharepoint', drive_id: 'd1', item_id: item.id, file_path: `${z.ordner.pfad}/${z.file_name}`, kooperation_id: K1, video_id: null });
  });

  it('Spalte auf Videoebene: Unterordner je Video, Kooperation aus dem Video', async () => {
    const t = setup();
    const z = await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: body({ custom_column_id: SV, entity_id: V1 }) });
    expect(z.ordner.pfad).toBe('/Firma/Medien/Sommer/Lisa/Untertitel/Video_1_Unboxing');
    expect(t.supabase.db.ablage_ordner.map((o) => o.art)).toEqual(expect.arrayContaining(['spalte_videos', 'spalte_video']));
    expect(t.supabase.db.ablage_upload[0].kontext).toMatchObject({ kooperation_id: K1, kooperation_video_id: V1, custom_column_id: SV, entity_id: V1 });
  });

  it('lehnt fehlende Ids, Nicht-Upload-Spalten, fremde Kampagnen und unbekannte Zeilen ab', async () => {
    const t = setup();
    const ziel = (extra) => t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: body(extra) });
    await expect(ziel({ custom_column_id: 'x' })).rejects.toMatchObject({ status: 400 });
    await expect(ziel({ custom_column_id: STEXT })).rejects.toMatchObject({ status: 400 });
    await expect(ziel({ custom_column_id: SX })).rejects.toMatchObject({ status: 400 });
    await expect(ziel({ custom_column_id: id(77) })).rejects.toMatchObject({ status: 404 });
    await expect(ziel({ custom_column_id: SV, entity_id: id(78) })).rejects.toMatchObject({ status: 404 });
    await expect(t.s.uploadZiel({ benutzer: KUNDE, caller: t.caller, body: body() })).rejects.toMatchObject({ status: 403 });
    expect(t.supabase.db.ablage_upload).toHaveLength(0);
  });

  it('ohne Konfiguration: harter Fehler', async () => {
    const t = setup();
    const s = createSchreiben({ supabase: t.supabase, ablage: null });
    await expect(s.uploadZiel({ benutzer: MA, caller: t.caller, body: body() })).rejects.toMatchObject({ status: 503, code: 'nicht_konfiguriert' });
  });

  it('Ersetzen einer SharePoint-Datei: neue Version desselben Items; Altbestand kommt neu in den Ordner', async () => {
    const t = setup();
    const z = await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: body() });
    const item = t.sp.hochladen(z.upload_url, 1000);
    t.supabase.db.custom_column_assets.push(
      { id: C1, custom_column_id: SK, entity_id: K1, ablage: 'sharepoint', drive_id: 'd1', item_id: item.id, file_path: `${z.ordner.pfad}/${item.name}` },
      { id: id(42), custom_column_id: SK, entity_id: K1, ablage: 'dropbox', file_path: '/Alt/x.mp4' },
    );

    await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: body({ ersetzen: { typ: 'spalte', id: C1 } }) });
    expect(t.sp.calls.filter(([op]) => op === 'uploadSessionFuerItem').map(([, itemId]) => itemId)).toEqual([item.id]);
    expect(t.supabase.db.ablage_upload[1]).toMatchObject({ item_id: item.id, kontext: { gleiches_item: true, ersetzen: { typ: 'spalte', id: C1 } } });

    await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: body({ ersetzen: { typ: 'spalte', id: id(42) } }) });
    expect(t.supabase.db.ablage_upload[2]).toMatchObject({ item_id: null, parent_item_id: t.supabase.db.ablage_upload[0].parent_item_id });

    await expect(t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: body({ entity_id: K1, custom_column_id: SV, ersetzen: { typ: 'spalte', id: C1 } }) }))
      .rejects.toMatchObject({ status: 404 });
  });
});

describe('ablage-loeschen: entity spalte', () => {
  it('Spalten-Ordner endgueltig weg, Register markiert', async () => {
    const t = setup();
    const z = await t.s.uploadZiel({ benutzer: MA, caller: t.caller, body: body() });
    const item = t.sp.hochladen(z.upload_url, 1000);
    t.supabase.db.custom_column_assets.push({ id: C1, custom_column_id: SK, entity_id: K1, kooperation_id: K1, ablage: 'sharepoint', drive_id: 'd1', item_id: item.id, file_path: `${z.ordner.pfad}/${item.name}` });
    const ordner = t.supabase.db.ablage_ordner.find((o) => o.art === 'spalte');

    const r = await t.s.entityLoeschen({ benutzer: MA, caller: t.caller, body: { entity: 'spalte', id: SK } });
    expect(r).toMatchObject({ ordner: 1, fehler: [] });
    expect(t.sp.calls).toContainEqual(['endgueltigLoeschen', ordner.item_id]);
    expect(t.supabase.db.ablage_ordner.find((o) => o.id === ordner.id).geloescht_at).toBeTruthy();
  });
});

describe('dateiEinordnen: Spalten-Ordner', () => {
  const besitz = { unternehmen_id: U1, marke_id: null, kampagne_id: KA1, kooperation_id: K1 };
  const reg = (art, extra = {}) => ({ id: `r-${art}`, item_id: `i-${art}`, parent_item_id: 'p', name: art, pfad: `/x/${art}`, art, ...besitz, ...extra });
  const einordnen = (eltern) => k.dateiEinordnen({ item: { name: 'schnitt.mp4' }, eltern, versuche: 1, jetztMs: Date.parse('2026-11-09T12:00:00Z') });

  it('Datei im Spalten-Ordner der Kooperation -> Spalten-Asset der Kooperation', () => {
    expect(einordnen(reg('spalte', { custom_column_id: SK }))).toMatchObject({
      aktion: 'asset', typ: 'spalte', ziel: { kooperation_id: K1, custom_column_id: SK, entity_id: K1 },
    });
  });

  it('Datei im Video-Ordner einer Spalte -> Spalten-Asset des Videos', () => {
    expect(einordnen(reg('spalte_video', { custom_column_id: SV, kooperation_video_id: V1 }))).toMatchObject({
      aktion: 'asset', typ: 'spalte', ziel: { kooperation_id: K1, custom_column_id: SV, entity_id: V1 },
    });
  });

  it('direkt im Spalten-Ordner einer Video-Spalte: kein Asset', () => {
    expect(einordnen(reg('spalte_videos', { custom_column_id: SV }))).not.toMatchObject({ aktion: 'asset' });
  });
});

describe('ablage-freigabe: Spalten-Ordner', () => {
  const mitOrdner = (t) => t.supabase.db.ablage_ordner.push(
    { drive_id: 'd1', item_id: 'sk', parent_item_id: 'k', name: 'Rohschnitt', art: 'spalte', custom_column_id: SK, kooperation_id: K1 },
    { drive_id: 'd1', item_id: 'sv', parent_item_id: 'svs', name: 'Video_1_Unboxing', art: 'spalte_video', custom_column_id: SV, kooperation_video_id: V1, kooperation_id: K1 },
  );

  it('Team: Link auf den Spalten-Ordner der Kooperation bzw. des Videos', async () => {
    const t = setup();
    mitOrdner(t);
    const l = await t.freigabe.erstellen({ benutzer: MA, caller: t.caller, body: { custom_column_id: SK, entity_id: K1 } });
    expect(l.url).toMatch(/^https:\/\/share\.test\//);
    expect(t.supabase.db.ablage_freigabelink[0]).toMatchObject({ item_id: 'sk', kooperation_id: K1, ordner_art: 'spalte' });

    await t.freigabe.erstellen({ benutzer: MA, caller: t.caller, body: { custom_column_id: SV, entity_id: V1 } });
    expect(t.supabase.db.ablage_freigabelink[1]).toMatchObject({ item_id: 'sv', kooperation_id: K1, ordner_art: 'spalte' });
  });

  it('Kunden nur bei sichtbarer Spalte; ohne Ordner 409', async () => {
    const t = setup();
    await expect(t.freigabe.erstellen({ benutzer: MA, caller: t.caller, body: { custom_column_id: SK, entity_id: K1 } }))
      .rejects.toMatchObject({ status: 409, code: 'nicht_sharepoint' });
    mitOrdner(t);
    await expect(t.freigabe.erstellen({ benutzer: KUNDE, caller: t.caller, body: { custom_column_id: SK, entity_id: K1 } }))
      .rejects.toMatchObject({ status: 404 });
    const l = await t.freigabe.erstellen({ benutzer: KUNDE, caller: t.caller, body: { custom_column_id: SV, entity_id: V1 } });
    expect(l.url).toMatch(/^https:\/\/share\.test\//);
    await expect(t.freigabe.erstellen({ benutzer: MA, caller: t.caller, body: { custom_column_id: SK, entity_id: 'x' } }))
      .rejects.toMatchObject({ status: 400 });
  });
});
