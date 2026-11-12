import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createFakeSupabase, createFakeSharePoint, ORDNER_UNIQUE, pfadUmschreiben, urlUmschreiben } from './fixtures/fakeSupabase.js';

const require = createRequire(import.meta.url);
const { createUmsortieren } = require('../../netlify/functions/_shared/ablage/umsortieren.js');
const { createOrdner } = require('../../netlify/functions/_shared/ablage/ordner.js');
const { createStand } = require('../../netlify/functions/_shared/ablage/stand.js');
const ziel = require('../../netlify/functions/_shared/ablage/ziel.js');

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const K1 = id(1);
const KA1 = id(2);
const U1 = id(3);
const V1 = id(4);
const S1 = id(6);
const K2 = id(7);
const KA2 = id(8);
const M1 = id(9);
const V2 = id(10);
const BASIS = '/Firma/Medien/Sommer/Lisa/Videos/Video_1_Unboxing';
const FIRMA = { id: U1, firmenname: 'Firma', ablage_ziel: 'sharepoint', ist_test: false };

function setup() {
  const supabase = createFakeSupabase({
    tabellen: {
      ablage_stand: [{ drive_id: 'd1', root_item_id: 'root' }],
      ablage_einstellung: [{ schluessel: 'notschalter', wert: false }],
      ablage_ordner: [],
      ablage_eingang: [],
      ablage_freigabelink: [],
      kooperationen: [{
        id: K1, name: 'Lisa', kampagne_id: KA1, bilder_folder_url: 'https://firma.sharepoint.com/sites/m/Lisa/Bilder',
        kampagne: {
          id: KA1, kampagnenname: 'Auftrag', eigener_name: 'Sommer', unternehmen_id: U1, marke_id: null,
          unternehmen: FIRMA, marke: null,
        },
      }, {
        id: K2, name: 'Max', kampagne_id: KA2,
        kampagne: {
          id: KA2, kampagnenname: 'Winter', eigener_name: null, unternehmen_id: U1, marke_id: M1,
          unternehmen: FIRMA, marke: { id: M1, markenname: 'Marke' },
        },
      }],
      kooperation_videos: [{ id: V1, kooperation_id: K1, position: 1, thema: 'Unboxing', story_folder_url: 'https://firma.sharepoint.com/sites/m/Lisa/Storys/Video_1' }],
      kooperation_story: [{ id: S1, video_id: V1, slot_index: 2 }],
      kooperation_video_asset: [],
      kooperation_story_asset: [],
      kooperation_bilder_asset: [],
      kooperation_rohmaterial_asset: [],
    },
    unique: { ablage_ordner: ORDNER_UNIQUE },
    rpc: { ablage_pfad_umschreiben: pfadUmschreiben, ablage_url_umschreiben: urlUmschreiben },
  });
  const sp = createFakeSharePoint();
  const ordner = createOrdner({ supabase, sp, schlafen: async () => {} });
  const u = createUmsortieren({ supabase, ablage: { sp, ordner } });
  return { supabase, db: supabase.db, sp, ordner, u };
}

async function ordnerAlt(t, parent, name, felder) {
  const { item } = await t.sp.ordnerAnlegen(parent.item_id, name);
  const row = {
    id: `o-${item.id}`, drive_id: 'd1', item_id: item.id, parent_item_id: parent.item_id, name, pfad: `${parent.pfad}/${name}`,
    unternehmen_id: U1, kampagne_id: KA1, kooperation_id: K1, ...felder,
  };
  t.db.ablage_ordner.push(row);
  return row;
}

function datei(t, ordnerRow, name, tabelle, zeile) {
  const f = t.sp.datei(ordnerRow.item_id, name, 3);
  const pfad = `${ordnerRow.pfad}/${name}`;
  t.db.ablage_eingang.push({ drive_id: 'd1', item_id: f.id, parent_item_id: ordnerRow.item_id, name, pfad, ist_ordner: false, geloescht: false, status: 'erledigt' });
  if (tabelle) {
    t.db[tabelle].push({ ablage: 'sharepoint', drive_id: 'd1', item_id: f.id, file_path: pfad, file_name: name, source_asset_id: null, ...zeile });
  }
  return f;
}

/** Ablage vor ADR 0065: Storys/Video_N/Story_K/{Feedbackschleife_1,Finale_Version}, Bilder/, Variante B. */
async function altbestand(t) {
  const { kooperation: koop } = await t.ordner.kette(K1);
  const storys = await ordnerAlt(t, koop, 'Storys', { art: 'typ', typ: 'storys' });
  const sv = await ordnerAlt(t, storys, 'Video_1_Unboxing', { art: 'video', typ: 'storys', kooperation_video_id: V1 });
  const s2 = await ordnerAlt(t, sv, 'Story_2', { art: 'story', typ: 'storys', kooperation_video_id: V1, story_nummer: 2 });
  const s2l1 = await ordnerAlt(t, s2, 'Feedbackschleife_1', { art: 'schleife', typ: 'storys', kooperation_video_id: V1, story_nummer: 2, version_number: 1 });
  const s2f = await ordnerAlt(t, s2, 'Finale_Version', { art: 'finale', typ: 'storys', kooperation_video_id: V1, story_nummer: 2 });
  const bilder = await ordnerAlt(t, koop, 'Bilder', { art: 'typ', typ: 'bilder' });
  const { ordner: schleife2 } = await t.ordner.zielOrdner({ typ: 'video', kooperation_id: K1, kooperation_video_id: V1, version_number: 2 });
  const varB = await ordnerAlt(t, schleife2, 'B', { art: 'variante', typ: 'videos', kooperation_video_id: V1, version_number: 2, variante: 'B' });

  const f = {
    story: datei(t, s2l1, 'story.mp4', 'kooperation_story_asset', { id: 'sa', story_id: S1, video_id: V1, version_number: 1, is_final: false, variant_name: 'C' }),
    storyFinal: datei(t, s2f, 'story_final.mp4', 'kooperation_story_asset', { id: 'sf', story_id: S1, video_id: V1, version_number: 1, is_final: true, variant_name: '9:16' }),
    bild: datei(t, bilder, 'foto.jpg', 'kooperation_bilder_asset', { id: 'ba', kooperation_id: K1, video_id: null, version_number: 1, is_final: false }),
    video: datei(t, varB, 'clip.mov', 'kooperation_video_asset', { id: 'va', video_id: V1, version_number: 2, variant_name: 'B', is_final: false }),
    rest: datei(t, sv, 'notiz.pdf'),
    muell: datei(t, s2f, '.DS_Store'),
  };
  // Promote-Finale teilt die Datei des Bildes
  t.db.kooperation_bilder_asset.push({ id: 'bf', kooperation_id: K1, video_id: null, is_final: true, source_asset_id: 'ba', ablage: 'sharepoint', drive_id: 'd1', item_id: f.bild.id, file_path: `${bilder.pfad}/foto.jpg` });
  t.db.ablage_freigabelink.push({ id: 'fl1', drive_id: 'd1', item_id: bilder.item_id, permission_id: 'p-alt', widerrufen_at: null });
  t.sp.links.set('p-alt', bilder.item_id);
  return { koop, storys, sv, s2, s2l1, s2f, bilder, schleife2, varB, f };
}

afterEach(() => ziel._reset());

describe('umsortieren: Trockenlauf', () => {
  it('zaehlt Dateien in alten Ordnern je Typ, Restdateien ohne CRM-Zeile, bewegt nichts', async () => {
    const t = setup();
    const a = await altbestand(t);
    const vorher = t.sp.calls.length;
    const plan = await t.u.planen(U1);
    // kette legt nur Medien/ an, Verträge/ kommt mit geruest oder dem Lauf
    expect(plan.zaehler).toEqual({ bereich: { marken: 0, kampagnen: 0, neu: 1, anlegen: ['Verträge'] }, dateien: 4, videos: 1, storys: 2, bilder: 1, ordner: 7, rest: 1 });
    expect(plan.rest).toEqual([{ name: 'notiz.pdf', pfad: `${a.sv.pfad}/notiz.pdf` }]);
    expect(t.sp.calls.length).toBe(vorher);
  });

  it('nichts Altes: alles null', async () => {
    const t = setup();
    await t.ordner.geruest(K1);
    expect((await t.u.planen(U1)).zaehler).toEqual({ bereich: { marken: 0, kampagnen: 0, neu: 0, anlegen: [] }, dateien: 0, videos: 0, storys: 0, bilder: 0, ordner: 0, rest: 0 });
  });
});

describe('umsortieren: Lauf', () => {
  it('verschiebt in die Runden unter Videos/, zieht Zeilen und Eingang nach, loescht leere alte Ordner', async () => {
    const t = setup();
    const a = await altbestand(t);
    const r = await t.u.lauf({ unternehmenId: U1 });
    expect(r).toMatchObject({ geplant: 4, verschoben: 4, fehlt: 0, fehler: [] });

    const story = t.db.kooperation_story_asset.find((x) => x.id === 'sa');
    expect(story).toMatchObject({ file_path: `${BASIS}/Feedbackschleife_1/Story_2/story.mp4`, variant_name: 'C', item_id: a.f.story.id });
    expect(t.db.kooperation_story_asset.find((x) => x.id === 'sf').file_path).toBe(`${BASIS}/Finale_Version/Story_2/story_final.mp4`);
    expect(t.db.kooperation_video_asset[0]).toMatchObject({ file_path: `${BASIS}/Feedbackschleife_2/clip.mov`, variant_name: 'B' });

    // Bild ohne Video: Runde des ersten Videos, Zeile und Promote-Finale haengen jetzt am Video
    const bild = t.db.kooperation_bilder_asset.find((x) => x.id === 'ba');
    expect(bild).toMatchObject({ file_path: `${BASIS}/Feedbackschleife_1/foto.jpg`, video_id: V1 });
    expect(t.db.kooperation_bilder_asset.find((x) => x.id === 'bf')).toMatchObject({ file_path: bild.file_path, video_id: V1 });

    const schleife1 = t.db.ablage_ordner.find((o) => o.pfad === `${BASIS}/Feedbackschleife_1`);
    expect(t.sp.items.get(a.f.bild.id).parent).toBe(schleife1.item_id);
    expect(t.db.ablage_eingang.find((e) => e.item_id === a.f.bild.id)).toMatchObject({ parent_item_id: schleife1.item_id, pfad: bild.file_path });

    // Leer: Variante B, Bilder/, Story_2 samt Runden (.DS_Store zaehlt nicht). Rest haelt Storys/Video_1 und Storys/
    const geloescht = (o) => !!t.db.ablage_ordner.find((x) => x.id === o.id).geloescht_at;
    for (const o of [a.varB, a.bilder, a.s2, a.s2l1, a.s2f]) {
      expect(geloescht(o)).toBe(true);
      expect(t.sp.items.has(o.item_id)).toBe(false);
    }
    for (const o of [a.storys, a.sv]) expect(geloescht(o)).toBe(false);
    expect(r.aufgeraeumt).toMatchObject({ geloescht: 5, bleibt: 2, links: 1 });

    expect(t.db.ablage_freigabelink[0]).toMatchObject({ widerruf_grund: 'umsortiert' });
    expect(t.sp.links.has('p-alt')).toBe(false);
    expect(t.db.kooperationen[0].bilder_folder_url).toBe(null);
    const videoOrdner = t.db.ablage_ordner.find((o) => o.art === 'video' && o.typ === 'videos');
    expect(t.db.kooperation_videos[0].story_folder_url).toBe(t.sp.url(videoOrdner.item_id));
  });

  it('zweiter Lauf hat nichts mehr zu tun', async () => {
    const t = setup();
    await altbestand(t);
    await t.u.lauf({ unternehmenId: U1 });
    const r = await t.u.lauf({ unternehmenId: U1 });
    expect(r).toMatchObject({ geplant: 0, verschoben: 0, aufgeraeumt: { geloescht: 0, bleibt: 2 } });
  });

  it('Datei schon weg (404): uebersprungen, Ordner wird trotzdem geprueft', async () => {
    const t = setup();
    const a = await altbestand(t);
    const orig = t.sp.verschieben.bind(t.sp);
    t.sp.verschieben = async (itemId, ...rest) => {
      if (itemId === a.f.video.id) { const e = new Error('itemNotFound'); e.status = 404; throw e; }
      return orig(itemId, ...rest);
    };
    const r = await t.u.lauf({ unternehmenId: U1 });
    expect(r).toMatchObject({ verschoben: 3, fehlt: 1 });
    // Variante B enthaelt die Datei noch: bleibt stehen
    expect(t.db.ablage_ordner.find((o) => o.id === a.varB.id).geloescht_at).toBeFalsy();
  });

  it('Loeschen scheitert: Register-Markierung wird zurueckgenommen', async () => {
    const t = setup();
    const a = await altbestand(t);
    t.sp.loeschen = async () => { const e = new Error('Graph 500'); e.status = 500; throw e; };
    await expect(t.u.lauf({ unternehmenId: U1 })).rejects.toThrow('Graph 500');
    // tiefster Ordner zuerst: Story_2/Feedbackschleife_1
    expect(t.db.ablage_ordner.find((o) => o.id === a.s2l1.id).geloescht_at).toBe(null);
    expect(t.sp.items.has(a.s2l1.item_id)).toBe(true);
  });

  it('Notschalter pausiert', async () => {
    const t = setup();
    t.db.ablage_einstellung[0].wert = true;
    expect(await t.u.lauf({ unternehmenId: U1 })).toEqual({ pausiert: true });
  });
});

/** Stand vor ADR 0067: Marke und Kampagne ohne Marke direkt unter Firma/, kein Medien/ und Verträge/. */
async function vorBereichen(t) {
  const a = await t.ordner.kette(K1);
  const b = await t.ordner.kette(K2);
  for (const row of [a.kampagne, b.marke]) await t.sp.verschieben(row.item_id, a.unternehmen.item_id);
  await t.sp.loeschen(a.medien.item_id);
  t.db.ablage_ordner.splice(t.db.ablage_ordner.findIndex((o) => o.id === a.medien.id), 1);
  for (const o of t.db.ablage_ordner) {
    if (o.pfad?.startsWith('/Firma/Medien/')) o.pfad = `/Firma/${o.pfad.slice('/Firma/Medien/'.length)}`;
    if (o.parent_item_id === a.medien.item_id) o.parent_item_id = a.unternehmen.item_id;
  }
  const reg = (row) => t.db.ablage_ordner.find((o) => o.id === row.id);
  const max = reg(b.kooperation);
  const f = datei(t, max, 'clip.mov', 'kooperation_video_asset', { id: 'vm', video_id: V2, version_number: 1, is_final: false });
  t.db.kooperation_video_asset.find((x) => x.id === 'vm').file_url = t.sp.url(f.id);
  t.db.kooperation_videos.push({ id: V2, kooperation_id: K2, position: 1, thema: 'Haul', folder_url: t.sp.url(max.item_id) });
  return { unternehmen: a.unternehmen, kampagne: reg(a.kampagne), marke: reg(b.marke), max, f };
}

describe('umsortieren: Bereiche', () => {
  it('Trockenlauf zaehlt Marken und Kampagnen direkt unter dem Unternehmen, bewegt nichts', async () => {
    const t = setup();
    await vorBereichen(t);
    const vorher = t.sp.calls.length;
    expect((await t.u.planen(U1)).zaehler.bereich).toEqual({ marken: 1, kampagnen: 1, neu: 2, anlegen: ['Medien', 'Verträge'] });
    expect(t.sp.calls.length).toBe(vorher);
  });

  it('Lauf: Medien/ und Verträge/ anlegen, Marke und Kampagne ohne Marke nach Medien/, Pfade und Links ziehen mit', async () => {
    const t = setup();
    const a = await vorBereichen(t);
    const r = await t.u.lauf({ unternehmenId: U1 });
    expect(r.bereich).toEqual({ verschoben: 2, fehler: [] });

    const bereiche = t.db.ablage_ordner.filter((o) => o.art === 'bereich');
    expect(bereiche.map((o) => [o.bereich, o.pfad, o.parent_item_id]).sort()).toEqual([
      ['medien', '/Firma/Medien', a.unternehmen.item_id],
      ['vertraege', '/Firma/Verträge', a.unternehmen.item_id],
    ]);
    const medien = bereiche.find((o) => o.bereich === 'medien');
    for (const [row, pfad] of [[a.kampagne, '/Firma/Medien/Sommer'], [a.marke, '/Firma/Medien/Marke']]) {
      expect(t.db.ablage_ordner.find((o) => o.id === row.id)).toMatchObject({ parent_item_id: medien.item_id, pfad });
      expect(t.sp.items.get(row.item_id).parent).toBe(medien.item_id);
    }

    const ziel = '/Firma/Medien/Marke/Winter/Max';
    expect(t.db.ablage_ordner.find((o) => o.id === a.max.id).pfad).toBe(ziel);
    expect(t.db.kooperation_video_asset.find((x) => x.id === 'vm')).toMatchObject({
      item_id: a.f.id, file_path: `${ziel}/clip.mov`, file_url: t.sp.url(a.f.id),
    });
    expect(t.sp.url(a.f.id)).toBe('https://sp.test/Firma/Medien/Marke/Winter/Max/clip.mov');
    expect(t.db.ablage_eingang.find((e) => e.item_id === a.f.id).pfad).toBe(`${ziel}/clip.mov`);
    expect(t.db.kooperation_videos.find((v) => v.id === V2).folder_url).toBe(t.sp.url(a.max.item_id));
  });

  it('zweiter Lauf verschiebt nichts mehr', async () => {
    const t = setup();
    await vorBereichen(t);
    await t.u.lauf({ unternehmenId: U1 });
    const vorher = t.sp.calls.filter(([op]) => op === 'verschieben' || op === 'ordnerAnlegen').length;
    const r = await t.u.lauf({ unternehmenId: U1 });
    expect(r.bereich).toEqual({ verschoben: 0, fehler: [] });
    expect(t.sp.calls.filter(([op]) => op === 'verschieben' || op === 'ordnerAnlegen').length).toBe(vorher);
    expect((await t.u.planen(U1)).zaehler.bereich).toEqual({ marken: 0, kampagnen: 0, neu: 0, anlegen: [] });
  });

  it('Verschieben scheitert: Fehler gesammelt, Register bleibt am alten Platz, Rest laeuft weiter', async () => {
    const t = setup();
    const a = await vorBereichen(t);
    const orig = t.sp.verschieben.bind(t.sp);
    t.sp.verschieben = async (itemId, ...rest) => {
      if (itemId === a.marke.item_id) { const e = new Error('gesperrt'); e.status = 423; throw e; }
      return orig(itemId, ...rest);
    };
    const r = await t.u.lauf({ unternehmenId: U1 });
    expect(r.bereich).toEqual({ verschoben: 1, fehler: ['/Firma/Marke: gesperrt'] });
    expect(t.db.ablage_ordner.find((o) => o.id === a.marke.id)).toMatchObject({ parent_item_id: a.unternehmen.item_id, pfad: '/Firma/Marke' });
    expect(t.db.kooperation_video_asset.find((x) => x.id === 'vm').file_path).toBe('/Firma/Marke/Winter/Max/clip.mov');
  });
});

describe('ablage-stand: Umsortieren', () => {
  const ADMIN = { id: 'a1', rolle: 'admin' };

  it('planen liefert nur Zaehler und Rest, starten stoesst den Hintergrund an', async () => {
    const t = setup();
    await altbestand(t);
    const angestossen = [];
    const stand = createStand({
      supabase: t.supabase, ablage: { sp: t.sp, ordner: t.ordner }, benutzer: ADMIN,
      anstossenImpl: async (_e, name, body) => { angestossen.push([name, body]); return true; },
    });
    const p = await stand.umsortieren_planen({ unternehmen_id: U1 });
    expect(p).toEqual({ ok: true, zaehler: expect.objectContaining({ dateien: 4 }), rest: expect.any(Array) });
    expect(p.assets).toBeUndefined();
    expect(await stand.umsortieren_starten({ unternehmen_id: U1 })).toEqual({ ok: true, angestossen: true });
    expect(angestossen).toEqual([['ablage-umsortieren-background', { unternehmen_id: U1 }]]);
    await expect(stand.umsortieren_planen({ unternehmen_id: 'x' })).rejects.toMatchObject({ status: 400 });
  });
});
