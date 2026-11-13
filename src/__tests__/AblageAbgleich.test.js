import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createFakeSupabase, createFakeSharePoint, ORDNER_UNIQUE, urlUmschreiben, strukturOffen } from './fixtures/fakeSupabase.js';

const require = createRequire(import.meta.url);
const { createAbgleich } = require('../../netlify/functions/_shared/ablage/abgleich.js');
const { createOrdner } = require('../../netlify/functions/_shared/ablage/ordner.js');
const { GraphError } = require('../../netlify/functions/_shared/ablage/graph.js');

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const K1 = id(1);
const KA1 = id(2);
const U1 = id(3);
const V1 = id(4);
const S1 = id(6);
const START = Date.parse('2026-11-09T12:00:00Z');
const iso = (ms) => new Date(ms).toISOString();

/** SQL-RPCs aus 20261201/20261202 in JS (gleiche Semantik: Lease, Fencing, Ruhe, Ordner zuerst). */
function rpcs(uhr) {
  const stand = (db, d) => db.ablage_stand.find((s) => s.drive_id === d);
  const eintrag = (db, d, i) => db.ablage_eingang.find((r) => r.drive_id === d && r.item_id === i);
  return {
    ablage_lease_holen: ({ p_drive_id, p_sekunden }, db) => {
      const s = stand(db, p_drive_id);
      if (!s || (s.lease_bis && Date.parse(s.lease_bis) > uhr.t)) return null;
      s.lease_token = (s.lease_token || 0) + 1;
      s.lease_bis = iso(uhr.t + p_sekunden * 1000);
      return s.lease_token;
    },
    ablage_lease_freigeben: ({ p_drive_id, p_token }, db) => {
      const s = stand(db, p_drive_id);
      if (s.lease_token !== p_token) return false;
      s.lease_bis = null;
      return true;
    },
    ablage_delta_speichern: ({ p_drive_id, p_token, p_delta_link }, db) => {
      const s = stand(db, p_drive_id);
      if (s.lease_token !== p_token || !s.lease_bis || Date.parse(s.lease_bis) <= uhr.t) return false;
      s.delta_link = p_delta_link;
      if (p_delta_link) s.voll_abgleich_noetig = false;
      return true;
    },
    ablage_eingang_aufnehmen: ({ p_drive_id, p_items }, db) => {
      let n = 0;
      for (const x of p_items) {
        const e = eintrag(db, p_drive_id, x.item_id);
        const basis = { gesehen_at: iso(uhr.t), status: 'offen', grund: null, versuche: 0, naechster_versuch: iso(uhr.t), gesperrt_bis: null };
        if (!e) {
          db.ablage_eingang.push({ drive_id: p_drive_id, ...x, ist_ordner: !!x.ist_ordner, geloescht: !!x.geloescht, fence: 1, ...basis });
          n++;
          continue;
        }
        const parent = x.parent_item_id ?? e.parent_item_id;
        const name = x.name ?? e.name;
        if (e.etag === (x.etag ?? null) && e.geloescht === !!x.geloescht && e.parent_item_id === parent && e.name === name) continue;
        const neu = Object.fromEntries(Object.entries(x).filter(([, v]) => v != null));
        Object.assign(e, neu, { parent_item_id: parent, name, ist_ordner: !!x.ist_ordner || e.ist_ordner, geloescht: !!x.geloescht, fence: e.fence + 1, ...basis });
        n++;
      }
      return n;
    },
    ablage_eingang_holen: ({ p_drive_id, p_limit, p_ruhe_sek, p_lease_sec }, db) => {
      const faellig = db.ablage_eingang
        .filter((e) => e.drive_id === p_drive_id && e.status === 'offen'
          && Date.parse(e.naechster_versuch) <= uhr.t
          && (!e.gesperrt_bis || Date.parse(e.gesperrt_bis) <= uhr.t)
          && (e.ist_ordner || e.geloescht || Date.parse(e.geaendert_at || e.gesehen_at) <= uhr.t - p_ruhe_sek * 1000))
        .sort((a, b) => (b.ist_ordner - a.ist_ordner) || ((a.pfad || '').length - (b.pfad || '').length))
        .slice(0, p_limit);
      for (const e of faellig) Object.assign(e, { gesperrt_bis: iso(uhr.t + p_lease_sec * 1000), versuche: e.versuche + 1, fence: e.fence + 1 });
      return faellig.map((e) => ({ ...e }));
    },
    ablage_eingang_abschliessen: ({ p_drive_id, p_item_id, p_fence, p_status, p_grund, p_ergebnis, p_wiederholen_sek }, db) => {
      const e = eintrag(db, p_drive_id, p_item_id);
      if (!e || e.fence !== p_fence) return false;
      const spaeter = p_wiederholen_sek > 0;
      Object.assign(e, {
        status: spaeter ? 'offen' : p_status, grund: p_grund, ergebnis: p_ergebnis ?? e.ergebnis, gesperrt_bis: null,
        naechster_versuch: iso(uhr.t + Math.max(p_wiederholen_sek, 0) * 1000), erledigt_at: spaeter ? e.erledigt_at : iso(uhr.t),
      });
      return true;
    },
    ablage_nachfahren: ({ p_drive_id, p_item_id }, db) => {
      const out = new Map();
      const offen = [p_item_id];
      while (offen.length) {
        const p = offen.shift();
        const kinder = [
          ...db.ablage_eingang.filter((e) => e.drive_id === p_drive_id && e.parent_item_id === p).map((e) => [e.item_id, e.ist_ordner]),
          ...db.ablage_ordner.filter((o) => o.drive_id === p_drive_id && o.parent_item_id === p && o.item_id).map((o) => [o.item_id, true]),
        ];
        for (const [i, ordner] of kinder) {
          if (out.has(i)) continue;
          out.set(i, ordner);
          if (ordner) offen.push(i);
        }
      }
      return [...out].map(([item_id, ist_ordner]) => ({ item_id, ist_ordner }));
    },
    ablage_geruest_offen: () => uhr.geruest || [],
    ablage_struktur_offen: strukturOffen,
    ablage_pfad_umschreiben: () => 0,
    ablage_url_umschreiben: urlUmschreiben,
  };
}

function setup({ assets = {}, abgleich = {} } = {}) {
  const uhr = { t: START, schlaefe: 0, beimSchlafen: null };
  const supabase = createFakeSupabase({
    tabellen: {
      ablage_stand: [{ drive_id: 'd1', root_item_id: 'root', lease_token: 0, delta_link: null, voll_abgleich_noetig: false }],
      ablage_ordner: [],
      ablage_upload: [],
      ablage_eingang: [],
      ablage_freigabelink: [],
      kooperationen: [{
        id: K1, name: 'Lisa', kampagne_id: KA1,
        kampagne: {
          id: KA1, kampagnenname: 'Auftrag', eigener_name: 'Sommer', unternehmen_id: U1, marke_id: null,
          unternehmen: { id: U1, firmenname: 'Firma', ablage_ziel: 'sharepoint', ist_test: false }, marke: null,
        },
      }],
      unternehmen: [{ id: U1, firmenname: 'Firma' }],
      kampagne: [{ id: KA1, kampagnenname: 'Auftrag', eigener_name: 'Sommer' }],
      kooperation_videos: [{ id: V1, kooperation_id: K1, position: 1, thema: 'Unboxing' }],
      kooperation_story: [{ id: S1, video_id: V1, slot_index: 2 }],
      kooperation_video_asset: [],
      kooperation_story_asset: [],
      kooperation_bilder_asset: [],
      kooperation_rohmaterial_asset: [],
      kooperation_video_zeitkommentar: [],
      benutzer: [{ id: 'b9', email: 'lisa@firma.de' }],
      ...assets,
    },
    unique: { ablage_ordner: ORDNER_UNIQUE },
    rpc: rpcs(uhr),
  });
  const sp = createFakeSharePoint();
  const seiten = [];
  sp.deltaSeite = async (link) => {
    sp.calls.push(['deltaSeite', link]);
    const s = seiten.shift() ?? { value: [], '@odata.deltaLink': `dl-${uhr.t}` };
    if (s instanceof Error) throw s;
    return s;
  };
  const ordner = createOrdner({ supabase, sp, schlafen: async () => {} });
  const ablage = { sp, ordner };
  // Ohne Nachlauf und mit 2 min Ruhe: die Szenarien steuern die Zeit selbst
  const a = createAbgleich({
    supabase, ablage, jetzt: () => uhr.t, ruheSek: 120, nachlaufSek: 0,
    schlafen: async (ms) => {
      uhr.schlaefe++;
      uhr.t += ms;
      await uhr.beimSchlafen?.();
    },
    ...abgleich,
  });

  /** driveItem wie im Delta-Feed (ohne parentReference.path). */
  const meldung = async (itemId, extra = {}) => ({
    ...(await sp.item(itemId)),
    lastModifiedDateTime: iso(uhr.t - 10 * 60000),
    lastModifiedBy: { user: { email: 'Lisa@Firma.de' } },
    ...extra,
  });
  const weg = (itemId, parent) => ({ id: itemId, deleted: { state: 'deleted' }, parentReference: { id: parent } });
  const seite = (value, link = 'dl-1') => seiten.push({ value, '@odata.deltaLink': link });
  const eingang = (itemId) => supabase.db.ablage_eingang.find((e) => e.item_id === itemId);
  const reg = (itemId) => supabase.db.ablage_ordner.find((o) => o.item_id === itemId);
  return { uhr, supabase, sp, ordner, a, seiten, meldung, weg, seite, eingang, reg };
}

const videoZiel = (extra = {}) => ({ typ: 'video', kooperation_id: K1, kooperation_video_id: V1, version_number: 2, variant_name: 'B', ...extra });

/** Varianten-Ordner aus der Zeit vor ADR 0065 (legt das CRM nicht mehr an). */
async function alteVariante(t, schleife, name = 'B') {
  const { item } = await t.sp.ordnerAnlegen(schleife.item_id, name);
  t.supabase.db.ablage_ordner.push({
    id: `alt-${name}`, drive_id: 'd1', item_id: item.id, parent_item_id: schleife.item_id, name, pfad: `${schleife.pfad}/${name}`,
    art: 'variante', typ: 'videos', variante: name, unternehmen_id: U1, kampagne_id: KA1, kooperation_id: K1,
    kooperation_video_id: V1, version_number: schleife.version_number,
  });
  return t.reg(item.id);
}

describe('ablage-abgleich: Finder-Dateien werden Assets', () => {
  it('Datei in einer Feedbackschleife -> Asset der Runde ohne Variante, uploaded_by ueber die E-Mail; Cursor gespeichert, Lease frei', async () => {
    const t = setup();
    const { ordner: schleife } = await t.ordner.zielOrdner(videoZiel());
    const f = t.sp.datei(schleife.item_id, 'neu.mov', 500);
    t.seite([await t.meldung(f.id)]);

    const r = await t.a.lauf();
    expect(r).toMatchObject({ lease: true, neu: 1, eingang: { erledigt: 1 } });
    const [row] = t.supabase.db.kooperation_video_asset;
    expect(row).toMatchObject({
      ablage: 'sharepoint', drive_id: 'd1', item_id: f.id, video_id: V1, version_number: 2, variant_name: null, is_final: false,
      file_name: 'neu.mov', file_path: '/Firma/Medien/Sommer/Lisa/Videos/Video_1_Unboxing/Feedbackschleife_2/neu.mov', uploaded_by: 'b9',
    });
    expect(t.eingang(f.id)).toMatchObject({ status: 'erledigt', pfad: row.file_path });
    expect(t.supabase.db.ablage_stand[0]).toMatchObject({ delta_link: 'dl-1', lease_bis: null });
  });

  it('Datei unter 2 Minuten Ruhe wartet; danach wird sie eingeordnet', async () => {
    const t = setup();
    const { ordner: variante } = await t.ordner.zielOrdner(videoZiel());
    const f = t.sp.datei(variante.item_id, 'frisch.mov', 500);
    t.seite([await t.meldung(f.id, { lastModifiedDateTime: iso(t.uhr.t - 30000) })]);
    await t.a.lauf();
    expect(t.supabase.db.kooperation_video_asset).toHaveLength(0);
    t.uhr.t += 3 * 60000;
    await t.a.lauf();
    expect(t.supabase.db.kooperation_video_asset).toHaveLength(1);
  });

  it('lose Datei in einer Schleife -> bleibt flach liegen, kein Varianten-Ordner, Typ nach Endung', async () => {
    const t = setup();
    const { ordner: schleife2 } = await t.ordner.zielOrdner(videoZiel({ variant_name: null }));
    const video = t.sp.datei(schleife2.item_id, 'lose.mov', 500);
    const bild = t.sp.datei(schleife2.item_id, 'foto.jpg', 300);
    t.seite([await t.meldung(video.id), await t.meldung(bild.id)]);
    await t.a.lauf();

    expect(t.supabase.db.ablage_ordner.some((o) => o.art === 'variante')).toBe(false);
    expect(t.sp.items.get(video.id).parent).toBe(schleife2.item_id);
    expect(t.sp.items.get(bild.id).parent).toBe(schleife2.item_id);
    const row = t.supabase.db.kooperation_video_asset.find((x) => x.item_id === video.id);
    expect(row).toMatchObject({ variant_name: null, version_number: 2, titel: 'lose', file_path: `${schleife2.pfad}/lose.mov` });
    expect(t.supabase.db.kooperation_video_asset.some((x) => x.item_id === bild.id)).toBe(false);
    const still = t.supabase.db.kooperation_bilder_asset.find((x) => x.item_id === bild.id);
    expect(still).toMatchObject({ video_id: V1, kooperation_id: K1, version_number: 2, variant_name: null, is_final: false, titel: 'foto' });
  });

  it('Finale Version: 9:16 wandert nach 9-16, 16:9 landet in Nicht zugeordnet', async () => {
    const t = setup();
    const { ordner: finale } = await t.ordner.zielOrdner(videoZiel({ is_final: true, variant_name: null }));
    const hoch = t.sp.datei(finale.item_id, 'final.mp4', 900);
    Object.assign(hoch, { breite: 1080, hoehe: 1920 });
    const quer = t.sp.datei(finale.item_id, 'quer.mp4', 900);
    Object.assign(quer, { breite: 1920, hoehe: 1080 });
    t.seite([await t.meldung(hoch.id), await t.meldung(quer.id)]);
    await t.a.lauf();

    const f916 = t.supabase.db.ablage_ordner.find((o) => o.art === 'format');
    expect(f916).toMatchObject({ name: '9-16', format: '9-16', parent_item_id: finale.item_id });
    expect(t.sp.items.get(hoch.id).parent).toBe(f916.item_id);
    expect(t.supabase.db.kooperation_video_asset).toEqual([expect.objectContaining({ item_id: hoch.id, is_final: true, variant_name: '9:16', version_number: 1 })]);
    expect(t.eingang(quer.id)).toMatchObject({ status: 'unzugeordnet', grund: 'format_unbekannt' });
  });

  it('CRM-Upload: wartet auf den Client, nach 10 Minuten ohne Zeile gilt der Upload-Kontext', async () => {
    const t = setup();
    const { ordner: schleife } = await t.ordner.zielOrdner(videoZiel({ variant_name: null }));
    const f = t.sp.datei(schleife.item_id, 'clip 1.mov', 777);
    t.supabase.db.ablage_upload.push({
      id: id(40), drive_id: 'd1', parent_item_id: schleife.item_id, name: 'clip.mov', groesse: 777, typ: 'video', item_id: null,
      erstellt_at: iso(t.uhr.t - 3 * 60000), kontext: { kooperation_id: K1, kooperation_video_id: V1, version_number: 2, is_final: false, variant_name: null },
    });
    t.seite([await t.meldung(f.id)]);
    await t.a.lauf();
    expect(t.eingang(f.id)).toMatchObject({ status: 'offen', grund: 'upload_laeuft' });

    t.uhr.t += 11 * 60000;
    await t.a.lauf();
    expect(t.supabase.db.kooperation_video_asset).toEqual([expect.objectContaining({ item_id: f.id, version_number: 2, variant_name: null })]);
    expect(t.sp.items.get(f.id).parent).toBe(schleife.item_id);
    expect(t.eingang(f.id).ergebnis).toMatchObject({ quelle: 'upload' });
  });

  it('Umzug: Laeufer starb nach dem Commit -> Datei haengt an der Bestandszeile, Umzug fertig', async () => {
    const alt = id(41);
    const t = setup({
      assets: {
        kooperation_video_asset: [
          { id: alt, video_id: V1, version_number: 2, variant_name: null, is_final: false, ablage: 'dropbox', file_path: '/Alt/clip.mov' },
          { id: id(42), video_id: V1, is_final: true, source_asset_id: alt, ablage: 'dropbox', file_path: '/Alt/clip.mov' },
        ],
        ablage_umzug: [{ id: 'z1', typ: 'video', asset_id: alt, status: 'offen', upload_url: 'https://upload.test/x', gesperrt_bis: iso(START + 60000) }],
      },
    });
    const { ordner: schleife } = await t.ordner.zielOrdner(videoZiel({ variant_name: null }));
    const f = t.sp.datei(schleife.item_id, 'clip.mov', 777);
    t.supabase.db.ablage_upload.push({
      id: id(43), drive_id: 'd1', parent_item_id: schleife.item_id, name: 'clip.mov', groesse: 777, typ: 'video', item_id: null,
      erstellt_at: iso(t.uhr.t - 11 * 60000), kontext: { kooperation_id: K1, kooperation_video_id: V1, version_number: 2, umzug_asset_id: alt },
    });
    t.seite([await t.meldung(f.id)]);
    await t.a.lauf();

    const rows = t.supabase.db.kooperation_video_asset;
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.ablage === 'sharepoint' && r.item_id === f.id && r.file_path === `${schleife.pfad}/clip.mov`)).toBe(true);
    expect(t.supabase.db.ablage_upload[0]).toMatchObject({ item_id: f.id, abgeschlossen_at: iso(START) });
    expect(t.supabase.db.ablage_umzug[0]).toMatchObject({ status: 'fertig', grund: 'abgleich', item_id: f.id, upload_url: null, gesperrt_bis: null });
    expect(t.eingang(f.id)).toMatchObject({ status: 'erledigt', ergebnis: expect.objectContaining({ quelle: 'umzug', asset_id: alt }) });
  });

  it('Story_4 in der Feedbackschleife angelegt: Slot entsteht, Ordner wird Fachordner mit CRM-Namen, Datei darin wird Story', async () => {
    const t = setup();
    const { ordner: st } = await t.ordner.zielOrdner({ typ: 'story', kooperation_id: K1, story_id: S1, version_number: 1 });
    expect(st).toMatchObject({ story_nummer: 2, typ: 'videos', version_number: 1 });
    const schleife = t.reg(st.parent_item_id);
    expect(schleife).toMatchObject({ art: 'schleife', typ: 'videos', version_number: 1 });
    const { item: neu } = await t.sp.ordnerAnlegen(schleife.item_id, 'story_4');
    const f = t.sp.datei(neu.id, 's.mp4', 10);
    const bild = t.sp.datei(neu.id, 'cover.jpg', 4);
    t.seite([await t.meldung(f.id), await t.meldung(bild.id), await t.meldung(neu.id)]);
    await t.a.lauf();

    const slot = t.supabase.db.kooperation_story.find((s) => s.slot_index === 4);
    expect(slot).toMatchObject({ video_id: V1, slot_name: 'Story 4' });
    expect(t.reg(neu.id)).toMatchObject({ art: 'story', story_nummer: 4, typ: 'videos', kooperation_video_id: V1, version_number: 1, name: 'Story_4' });
    expect(t.sp.items.get(neu.id).name).toBe('Story_4');
    expect(t.supabase.db.kooperation_story_asset).toEqual([
      expect.objectContaining({ item_id: f.id, story_id: slot.id, video_id: V1, version_number: 1, is_final: false }),
      expect.objectContaining({ item_id: bild.id, story_id: slot.id, version_number: 1 }),
    ]);
  });

  it('Story in Finale_Version/Story_K: finale Story mit Seitenverhaeltnis aus dem Pixelmass', async () => {
    const t = setup();
    const { ordner: st } = await t.ordner.zielOrdner({ typ: 'story', kooperation_id: K1, story_id: S1, is_final: true, variant_name: '9:16' });
    expect(st).toMatchObject({ art: 'story', version_number: null });
    const f = t.sp.datei(st.item_id, 'final.mp4', 10);
    Object.assign(f, { breite: 1080, hoehe: 1920 });
    t.seite([await t.meldung(f.id)]);
    await t.a.lauf();
    expect(t.supabase.db.kooperation_story_asset).toEqual([expect.objectContaining({ item_id: f.id, story_id: S1, is_final: true, variant_name: '9:16' })]);
    expect(t.sp.items.get(f.id).parent).toBe(st.item_id);
  });

  it('Altbestand: Datei im Varianten-Ordner zieht flach in die Schleife, die Variante bleibt an der Zeile', async () => {
    const t = setup({
      assets: { kooperation_video_asset: [{ id: id(32), video_id: V1, version_number: 2, variant_name: 'B', is_final: false, ablage: 'sharepoint', drive_id: 'd1', item_id: 'wird-gesetzt' }] },
    });
    const { ordner: schleife } = await t.ordner.zielOrdner(videoZiel());
    const b = await alteVariante(t, schleife);
    const alt = t.sp.datei(b.item_id, 'alt.mov', 5);
    t.supabase.db.kooperation_video_asset[0].item_id = alt.id;
    const neu = t.sp.datei(b.item_id, 'neu.mov', 5);
    t.seite([await t.meldung(alt.id), await t.meldung(neu.id)]);
    await t.a.lauf();
    expect(t.sp.items.get(alt.id).parent).toBe(schleife.item_id);
    expect(t.sp.items.get(neu.id).parent).toBe(schleife.item_id);
    expect(t.eingang(alt.id).ergebnis).toMatchObject({ aktion: 'zurueck' });
    expect(t.supabase.db.kooperation_video_asset.find((r) => r.item_id === alt.id).variant_name).toBe('B');
  });
});

describe('ablage-abgleich: Ordner', () => {
  it('neuer Ordner in der Kooperation -> frei registriert (fuer ablage-link frei)', async () => {
    const t = setup();
    const { kette } = await t.ordner.zielOrdner({ typ: 'roh', kooperation_id: K1 });
    const { item: frei } = await t.sp.ordnerAnlegen(kette.kooperation.item_id, 'Briefing');
    t.seite([await t.meldung(frei.id)]);
    await t.a.lauf();
    expect(t.reg(frei.id)).toMatchObject({ art: 'frei', kooperation_id: K1, kampagne_id: KA1, unternehmen_id: U1, pfad: '/Firma/Medien/Sommer/Lisa/Briefing' });
  });

  it('Fachordner im Finder umbenannt -> CRM dreht den Namen zurueck', async () => {
    const t = setup();
    const { ordner: schleife } = await t.ordner.zielOrdner(videoZiel({ variant_name: null }));
    t.sp.items.get(schleife.item_id).name = 'Runde 2';
    t.seite([await t.meldung(schleife.item_id)]);
    await t.a.lauf();
    expect(t.sp.items.get(schleife.item_id).name).toBe('Feedbackschleife_2');
    expect(t.eingang(schleife.item_id)).toMatchObject({ status: 'erledigt', ergebnis: { aktion: 'zurueck_benennen' } });
  });

  it('Bereich im Finder umbenannt -> zurueck, Links von waehrend des Finder-Namens ziehen mit', async () => {
    const t = setup();
    const { kette } = await t.ordner.zielOrdner({ typ: 'roh', kooperation_id: K1 });
    t.sp.items.get(kette.medien.item_id).name = 'Media';
    t.supabase.db.kooperation_videos[0].folder_url = t.sp.url(kette.kooperation.item_id);
    expect(t.supabase.db.kooperation_videos[0].folder_url).toBe('https://sp.test/Firma/Media/Sommer/Lisa');
    t.seite([await t.meldung(kette.medien.item_id)]);
    await t.a.lauf();
    expect(t.sp.items.get(kette.medien.item_id).name).toBe('Medien');
    expect(t.eingang(kette.medien.item_id)).toMatchObject({ status: 'erledigt', ergebnis: { aktion: 'zurueck_benennen' } });
    expect(t.supabase.db.kooperation_videos[0].folder_url).toBe('https://sp.test/Firma/Medien/Sommer/Lisa');
  });

  it('Verträge im Finder angelegt (NFD) -> Bereich registriert, kein Umbenennen', async () => {
    const t = setup();
    const { kette } = await t.ordner.zielOrdner({ typ: 'roh', kooperation_id: K1 });
    const { item: v } = await t.sp.ordnerAnlegen(kette.unternehmen.item_id, 'Verträge'.normalize('NFD'));
    const f = t.sp.datei(v.id, 'Vertrag.pdf', 3);
    t.seite([await t.meldung(f.id), await t.meldung(v.id)]);
    await t.a.lauf();
    expect(t.reg(v.id)).toMatchObject({ art: 'bereich', bereich: 'vertraege', unternehmen_id: U1, parent_item_id: kette.unternehmen.item_id });
    expect(t.sp.calls.some(([op]) => op === 'umbenennen')).toBe(false);
    expect(t.eingang(f.id)).toMatchObject({ status: 'ignoriert', ergebnis: { aktion: 'ignorieren', grund: 'dokument_ohne_crm' } });
    // CRM findet ihn wieder statt "Verträge (2)" anzulegen
    await t.ordner.geruest(K1);
    expect(t.supabase.db.ablage_ordner.filter((o) => o.art === 'bereich' && o.bereich === 'vertraege').map((o) => o.item_id)).toEqual([v.id]);
    expect(t.sp.calls.some(([op]) => op === 'umbenennen')).toBe(false);
  });

  it('Fachordner verschoben -> zurueck an den Platz aus dem Register', async () => {
    const t = setup();
    const { ordner: variante, kette } = await t.ordner.zielOrdner(videoZiel());
    const alt = t.sp.items.get(variante.item_id).parent;
    t.sp.items.get(variante.item_id).parent = kette.kooperation.item_id;
    t.seite([await t.meldung(variante.item_id)]);
    await t.a.lauf();
    expect(t.sp.items.get(variante.item_id).parent).toBe(alt);
  });

  it('Altbestand: Variante umbenannt -> Register und variant_name der Assets ziehen mit', async () => {
    const t = setup({
      assets: { kooperation_video_asset: [{ id: id(31), video_id: V1, version_number: 2, variant_name: 'B', is_final: false, ablage: 'sharepoint', drive_id: 'd1', item_id: 'x' }] },
    });
    const { ordner: schleife } = await t.ordner.zielOrdner(videoZiel());
    const variante = await alteVariante(t, schleife);
    t.sp.items.get(variante.item_id).name = 'Hook';
    t.seite([await t.meldung(variante.item_id)]);
    await t.a.lauf();
    expect(t.reg(variante.item_id)).toMatchObject({ name: 'Hook', variante: 'Hook', pfad: '/Firma/Medien/Sommer/Lisa/Videos/Video_1_Unboxing/Feedbackschleife_2/Hook' });
    expect(t.supabase.db.kooperation_video_asset[0].variant_name).toBe('Hook');
  });

  it('Ordner im Web geloescht -> Assets darin weg, Register geloescht, Leselinks widerrufen', async () => {
    const t = setup();
    const { ordner: variante, link } = await t.ordner.zielOrdner(videoZiel());
    const f = t.sp.datei(variante.item_id, 'a.mov', 5);
    t.seite([await t.meldung(f.id)]);
    await t.a.lauf();
    expect(t.supabase.db.kooperation_video_asset).toHaveLength(1);
    t.supabase.db.ablage_freigabelink.push({ id: 'fl1', drive_id: 'd1', item_id: variante.item_id, widerrufen_at: null });

    const schleifeId = t.sp.items.get(variante.item_id).parent;
    t.sp.items.delete(variante.item_id);
    t.sp.items.delete(f.id);
    t.seite([t.weg(variante.item_id, schleifeId)], 'dl-2');
    await t.a.lauf();

    expect(t.supabase.db.kooperation_video_asset).toHaveLength(0);
    expect(t.reg(variante.item_id).geloescht_at).toBeTruthy();
    expect(t.eingang(f.id)).toMatchObject({ geloescht: true, grund: 'ordner_geloescht' });
    expect(t.supabase.db.ablage_freigabelink[0]).toMatchObject({ widerruf_grund: 'ordner_geloescht' });
    expect(t.reg(link.item_id).geloescht_at).toBeFalsy();
  });
});

describe('ablage-abgleich: Loeschen, Verschieben, Vollabgleich, Lease', () => {
  it('Datei geloescht (Admin im Web) -> Asset ausgeblendet', async () => {
    const t = setup();
    const { ordner: variante } = await t.ordner.zielOrdner(videoZiel());
    const f = t.sp.datei(variante.item_id, 'a.mov', 5);
    t.seite([await t.meldung(f.id)]);
    await t.a.lauf();
    t.sp.items.delete(f.id);
    t.seite([t.weg(f.id, variante.item_id)], 'dl-2');
    await t.a.lauf();
    expect(t.supabase.db.kooperation_video_asset).toHaveLength(0);
    expect(t.eingang(f.id).ergebnis).toMatchObject({ aktion: 'entfernt', zeilen: 1 });
  });

  it('Fachdatei in einen freien Ordner verschoben -> zurueck in ihre Schleife', async () => {
    const t = setup();
    const { ordner: variante, kette } = await t.ordner.zielOrdner(videoZiel());
    const f = t.sp.datei(variante.item_id, 'a.mov', 5);
    const { item: frei } = await t.sp.ordnerAnlegen(kette.kooperation.item_id, 'Ablage');
    t.seite([await t.meldung(f.id), await t.meldung(frei.id)]);
    await t.a.lauf();

    t.sp.items.get(f.id).parent = frei.id;
    t.sp.items.get(f.id).v = 2;
    t.seite([await t.meldung(f.id)], 'dl-2');
    await t.a.lauf();
    expect(t.sp.items.get(f.id).parent).toBe(variante.item_id);
    expect(t.eingang(f.id).ergebnis).toMatchObject({ aktion: 'zurueck' });
    expect(t.supabase.db.kooperation_video_asset).toHaveLength(1);
  });

  it('410 (Cursor ungueltig) -> Vollabgleich; nicht mehr gemeldete Dateien gelten als geloescht', async () => {
    const t = setup();
    const { ordner: variante } = await t.ordner.zielOrdner(videoZiel());
    const a = t.sp.datei(variante.item_id, 'a.mov', 5);
    const b = t.sp.datei(variante.item_id, 'b.mov', 5);
    t.seite([await t.meldung(a.id), await t.meldung(b.id)]);
    await t.a.lauf();
    expect(t.supabase.db.kooperation_video_asset).toHaveLength(2);

    t.sp.items.delete(b.id);
    t.seiten.push(new GraphError(410, 'resyncRequired', 'gone'));
    t.seite([await t.meldung(a.id), await t.meldung(variante.item_id)], 'dl-voll');
    const r = await t.a.lauf();
    expect(r.verschwunden).toBe(1);
    expect(t.sp.calls.filter(([op]) => op === 'deltaSeite').map(([, l]) => l)).toEqual([null, 'dl-1', null]);
    expect(t.supabase.db.kooperation_video_asset.map((x) => x.item_id)).toEqual([a.id]);
    expect(t.supabase.db.ablage_stand[0]).toMatchObject({ delta_link: 'dl-voll', voll_abgleich_noetig: false });
  });

  it('Lease belegt -> kein zweiter Laeufer', async () => {
    const t = setup();
    t.supabase.db.ablage_stand[0].lease_bis = iso(t.uhr.t + 60000);
    expect(await t.a.lauf()).toEqual({ lease: false });
    expect(t.sp.calls.filter(([op]) => op === 'deltaSeite')).toHaveLength(0);
  });

  it('Fencing: neuere Meldung waehrend der Bearbeitung -> Abschluss verworfen, Item bleibt offen', async () => {
    const t = setup();
    const { ordner: variante } = await t.ordner.zielOrdner(videoZiel());
    const f = t.sp.datei(variante.item_id, 'a.mov', 5);
    await t.supabase.rpc('ablage_eingang_aufnehmen', { p_drive_id: 'd1', p_items: [{ item_id: f.id, parent_item_id: variante.item_id, name: 'a.mov', etag: 'e1', geaendert_at: iso(t.uhr.t - 600000) }] });
    const [claim] = (await t.supabase.rpc('ablage_eingang_holen', { p_drive_id: 'd1', p_limit: 5, p_ruhe_sek: 120, p_lease_sec: 300 })).data;
    await t.supabase.rpc('ablage_eingang_aufnehmen', { p_drive_id: 'd1', p_items: [{ item_id: f.id, etag: 'e2' }] });
    expect(await t.a.eintragBearbeiten(claim)).toBe('ueberholt');
    expect(t.eingang(f.id)).toMatchObject({ status: 'offen', etag: 'e2' });
  });

  it('Fehler beim Einordnen -> Backoff, nach 8 Versuchen Status fehler', async () => {
    const t = setup();
    const { ordner: variante } = await t.ordner.zielOrdner(videoZiel());
    const f = t.sp.datei(variante.item_id, 'a.mov', 5);
    t.sp.item = async () => { throw new Error('Graph down'); };
    await t.supabase.rpc('ablage_eingang_aufnehmen', { p_drive_id: 'd1', p_items: [{ item_id: f.id, parent_item_id: variante.item_id, name: 'a.mov', etag: 'e1', geaendert_at: iso(t.uhr.t - 600000) }] });
    const [claim] = (await t.supabase.rpc('ablage_eingang_holen', { p_drive_id: 'd1', p_limit: 5, p_ruhe_sek: 120, p_lease_sec: 300 })).data;
    expect(await t.a.eintragBearbeiten(claim)).toBe('warten');
    expect(t.eingang(f.id)).toMatchObject({ status: 'offen', grund: 'Graph down' });
    expect(Date.parse(t.eingang(f.id).naechster_versuch) - t.uhr.t).toBe(60000);
    expect(await t.a.eintragBearbeiten({ ...t.eingang(f.id), versuche: 8 })).toBe('fehler');
    expect(t.eingang(f.id).status).toBe('fehler');
  });
});

describe('ablage-webhook', () => {
  const webhook = require('../../netlify/functions/ablage-webhook.js');
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SP_WEBHOOK_CLIENT_STATE;
    delete process.env.URL;
  });

  it('Validierung: validationToken als text/plain zurueck', async () => {
    const r = await webhook.handler({ httpMethod: 'POST', queryStringParameters: { validationToken: 'abc 123' } });
    expect(r).toMatchObject({ statusCode: 200, body: 'abc 123', headers: { 'Content-Type': 'text/plain' } });
  });

  it('falscher clientState: 202, aber kein Abgleich; echter: Abgleich angestossen', async () => {
    process.env.SP_WEBHOOK_CLIENT_STATE = 'geheim';
    process.env.URL = 'https://crm.test';
    const fetchMock = vi.fn(async () => ({ ok: true, status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    const meldung = (cs) => ({ httpMethod: 'POST', body: JSON.stringify({ value: [{ clientState: cs, resource: 'drives/d1/root' }] }) });

    expect((await webhook.handler(meldung('falsch'))).statusCode).toBe(202);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await webhook.handler(meldung('geheim'))).statusCode).toBe(202);
    expect(fetchMock).toHaveBeenCalledWith('https://crm.test/.netlify/functions/ablage-abgleich-background', expect.objectContaining({ method: 'POST' }));
  });

  it('ohne konfigurierten clientState wird nichts angestossen', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await webhook.handler({ httpMethod: 'POST', body: JSON.stringify({ value: [{ clientState: '' }] }) });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('ablage-abgleich: Geruest, Namen, Aufraeumen, Abo', () => {
  it('Geruest fuer offene Kooperationen (Schleifen 1-3 + Finale)', async () => {
    const t = setup();
    t.uhr.geruest = [{ kooperation_id: K1 }];
    const r = await t.a.geruestNachziehen({});
    expect(r).toEqual({ gebaut: 1, fehler: [] });
    const namen = t.supabase.db.ablage_ordner.filter((o) => o.typ === 'videos').map((o) => o.name);
    expect(namen).toEqual(expect.arrayContaining(['Videos', 'Video_1_Unboxing', 'Feedbackschleife_1', 'Feedbackschleife_3', 'Finale_Version']));
  });

  it('Namensabgleich: Umbenennung im CRM -> PATCH auf den Ordner, Zaehler "(2)" zaehlt nicht als Abweichung', async () => {
    const t = setup();
    const { kette } = await t.ordner.zielOrdner({ typ: 'roh', kooperation_id: K1 });
    t.supabase.db.unternehmen[0].firmenname = 'Firma Neu';
    t.reg(kette.kooperation.item_id).name = 'Lisa (2)';
    const r = await t.a.namenAbgleichen({});
    expect(r).toMatchObject({ umbenannt: 1, fehler: [] });
    expect(t.sp.items.get(kette.unternehmen.item_id).name).toBe('Firma Neu');
    expect(t.sp.calls.filter(([op]) => op === 'umbenennen')).toHaveLength(1);
  });

  it('Struktur: Linie wechselt -> Kooperation zieht im naechsten Lauf unter die Produktion', async () => {
    const t = setup({ assets: { produktion: [{ id: 'p1', name: 'Wind Down', kampagne_id: KA1 }] } });
    const { kette } = await t.ordner.zielOrdner({ typ: 'roh', kooperation_id: K1 });
    expect(await t.a.strukturNachziehen({})).toEqual({ verschoben: 0, fehler: [] });
    Object.assign(t.supabase.db.kooperationen[0], { produktion_id: 'p1', produktion: { id: 'p1', name: 'Wind Down', kampagne_id: KA1 } });
    const r = await t.a.lauf();
    expect(r.struktur).toEqual({ verschoben: 1, fehler: [] });
    const prod = t.supabase.db.ablage_ordner.find((o) => o.art === 'produktion');
    expect(prod).toMatchObject({ produktion_id: 'p1', pfad: '/Firma/Medien/Sommer/Wind Down' });
    expect(t.reg(kette.kooperation.item_id)).toMatchObject({ parent_item_id: prod.item_id, pfad: '/Firma/Medien/Sommer/Wind Down/Lisa' });
    expect(await t.a.strukturNachziehen({})).toEqual({ verschoben: 0, fehler: [] });
  });

  it('Struktur: ohne RPC (Migration fehlt) laeuft der Abgleich weiter', async () => {
    const t = setup();
    const rpc = t.supabase.rpc;
    t.supabase.rpc = async (name, args) => (name === 'ablage_struktur_offen' ? { data: null, error: { message: 'function does not exist' } } : rpc(name, args));
    const r = await t.a.lauf();
    expect(r.fehler).toBeUndefined();
    expect(r.struktur).toEqual({ verschoben: 0, fehler: ['ablage_struktur_offen: function does not exist'] });
  });

  it('Namensabgleich: Produktion im CRM umbenannt -> Ordner folgt', async () => {
    const t = setup({ assets: { produktion: [{ id: 'p1', name: 'Wind Down', kampagne_id: KA1 }] } });
    Object.assign(t.supabase.db.kooperationen[0], { produktion_id: 'p1', produktion: { id: 'p1', name: 'Wind Down', kampagne_id: KA1 } });
    const { kette } = await t.ordner.zielOrdner({ typ: 'roh', kooperation_id: K1 });
    t.supabase.db.produktion[0].name = 'Lights Out';
    const r = await t.a.namenAbgleichen({});
    expect(r).toMatchObject({ umbenannt: 1, fehler: [] });
    expect(t.sp.items.get(kette.produktion.item_id).name).toBe('Lights Out');
    expect(t.reg(kette.produktion.item_id).pfad).toBe('/Firma/Medien/Sommer/Lights Out');
  });

  it('Pflege laeuft hoechstens alle 10 Minuten und raeumt alte Uploads', async () => {
    const t = setup();
    t.supabase.db.ablage_upload.push(
      { id: 'u-alt', drive_id: 'd1', erstellt_at: iso(t.uhr.t - 3 * 86400000) },
      { id: 'u-neu', drive_id: 'd1', erstellt_at: iso(t.uhr.t - 3600000) },
    );
    const r1 = await t.a.lauf();
    expect(r1.aufgeraeumt).toEqual({ uploads: 1 });
    expect(t.supabase.db.ablage_upload.map((u) => u.id)).toEqual(['u-neu']);
    t.uhr.t += 60000;
    expect((await t.a.lauf()).aufgeraeumt).toBeUndefined();
    t.uhr.t += 10 * 60000;
    expect((await t.a.lauf()).aufgeraeumt).toEqual({ uploads: 0 });
  });

  it('Abo: anlegen, unter 3 Tagen verlaengern, bei 404 neu anlegen', async () => {
    const t = setup();
    let n = 0;
    t.sp.aboAnlegen = async ({ notificationUrl, clientState }) => {
      t.sp.calls.push(['aboAnlegen', notificationUrl, clientState]);
      return { id: `abo${++n}`, expirationDateTime: iso(t.uhr.t + 29 * 86400000) };
    };
    t.sp.aboVerlaengern = async (aboId) => {
      t.sp.calls.push(['aboVerlaengern', aboId]);
      if (aboId === 'abo-weg') throw new GraphError(404, 'itemNotFound', 'weg');
      return { id: aboId, expirationDateTime: iso(t.uhr.t + 29 * 86400000) };
    };
    const opts = { notificationUrl: 'https://crm.test/.netlify/functions/ablage-webhook', clientState: 'geheim' };
    expect(await t.a.aboSicherstellen({ ...opts, clientState: '' })).toEqual({ abo: 'nicht_konfiguriert' });
    expect((await t.a.aboSicherstellen(opts)).abo).toBe('angelegt');
    expect((await t.a.aboSicherstellen(opts)).abo).toBe('ok');
    t.uhr.t += 27 * 86400000;
    expect((await t.a.aboSicherstellen(opts)).abo).toBe('verlaengert');
    Object.assign(t.supabase.db.ablage_stand[0], { abo_id: 'abo-weg', abo_ablauf: iso(t.uhr.t + 86400000) });
    expect((await t.a.aboSicherstellen(opts)).abo).toBe('angelegt');
    expect(t.supabase.db.ablage_stand[0].abo_id).toBe('abo2');
  });
});

describe('ablage-abgleich: Nachlauf bis die Datei reif ist', () => {
  const schnell = { abgleich: { ruheSek: 20, nachlaufSek: 25 } };

  it('frische Datei (vor 5 s geaendert) wird im selben Lauf eingeordnet', async () => {
    const t = setup(schnell);
    const { ordner: variante } = await t.ordner.zielOrdner(videoZiel());
    const f = t.sp.datei(variante.item_id, 'frisch.mov', 500);
    t.seite([await t.meldung(f.id, { lastModifiedDateTime: iso(t.uhr.t - 5000) })]);

    const r = await t.a.lauf();

    expect(r).toMatchObject({ lease: true, neu: 1, eingang: { erledigt: 1 } });
    expect(r.mehr).toBeUndefined();
    expect(t.supabase.db.kooperation_video_asset).toEqual([expect.objectContaining({ item_id: f.id })]);
    expect(t.uhr.t - START).toBeGreaterThanOrEqual(15000);
    expect(t.uhr.t - START).toBeLessThanOrEqual(25000);
    expect(t.supabase.db.ablage_stand[0].lease_bis).toBeNull();
  });

  it('ohne neue Eintraege endet der Lauf sofort', async () => {
    const t = setup(schnell);
    const r = await t.a.lauf();
    expect(r).toMatchObject({ lease: true, neu: 0 });
    expect(t.uhr.schlaefe).toBe(0);
  });

  it('der Nachlauf bleibt im Budget', async () => {
    const t = setup(schnell);
    const { ordner: variante } = await t.ordner.zielOrdner(videoZiel());
    const f = t.sp.datei(variante.item_id, 'frisch.mov', 500);
    t.seite([await t.meldung(f.id, { lastModifiedDateTime: iso(t.uhr.t - 5000) })]);

    await t.a.lauf({ budgetMs: 8000 });

    expect(t.uhr.t - START).toBeLessThanOrEqual(8000);
    expect(t.supabase.db.kooperation_video_asset).toHaveLength(0);
    expect(t.eingang(f.id)).toMatchObject({ status: 'offen' });
  });

  it('greift waehrend des Nachlaufs neu gemeldete Dateien auf (Webhook scheitert an der Lease)', async () => {
    const t = setup(schnell);
    const { ordner: variante } = await t.ordner.zielOrdner(videoZiel());
    const a = t.sp.datei(variante.item_id, 'a.mov', 500);
    const b = t.sp.datei(variante.item_id, 'b.mov', 600);
    t.seite([await t.meldung(a.id)]);
    t.uhr.beimSchlafen = async () => {
      t.uhr.beimSchlafen = null;
      t.seite([await t.meldung(b.id)], 'dl-2');
    };

    const r = await t.a.lauf();

    expect(r).toMatchObject({ neu: 2, eingang: { erledigt: 2 } });
    expect(t.supabase.db.kooperation_video_asset.map((x) => x.item_id).sort()).toEqual([a.id, b.id].sort());
  });
});

describe('ablage-abgleich: Dokumente (ADR 0068)', () => {
  const R1 = id(30);
  const VT1 = id(31);
  const dokTabellen = {
    unternehmen: [{ id: U1, firmenname: 'Firma', ist_test: false, dokument_ablage_ziel: 'sharepoint' }],
    kampagne: [{ id: KA1, kampagnenname: 'Auftrag', eigener_name: 'Sommer', unternehmen_id: U1, marke_id: null }],
    rechnung: [{ id: R1, rechnung_nr: 'RE-1', unternehmen_id: U1, kampagne_id: KA1 }],
    vertraege: [{ id: VT1, name: 'V', kunde_unternehmen_id: U1, kampagne_id: KA1, datei_ablage: 'dropbox', signiert_ablage: 'dropbox' }],
    rechnung_pdfs: [],
    rechnung_belege: [],
    auftrag_dokumente: [],
  };
  const { ladeBezug, dokumentEbenen, spaltenAusItem } = require('../../netlify/functions/_shared/ablage/dokument.js');
  async function kette(t, typ, bezugId) {
    const b = await ladeBezug(t.supabase, typ, bezugId);
    return t.ordner.dokumentKette(b.unternehmen, typ === 'vertrag' ? 'vertraege' : 'rechnungen', dokumentEbenen(typ, b));
  }

  it('Upload ohne Commit: nach 10 Minuten legt der Abgleich die Beleg-Zeile an', async () => {
    const t = setup({ assets: dokTabellen });
    const o = await kette(t, 'beleg', R1);
    const f = t.sp.datei(o.item_id, 'b.pdf', 7);
    t.supabase.db.ablage_upload.push({
      id: 'up1', drive_id: 'd1', parent_item_id: o.item_id, name: 'b.pdf', groesse: 7, typ: 'beleg', item_id: null,
      kontext: { typ: 'beleg', bezug_id: R1 }, erstellt_von: 'b9', erstellt_at: iso(START - 15 * 60000),
    });
    t.seite([await t.meldung(f.id)]);
    await t.a.lauf();
    expect(t.supabase.db.rechnung_belege).toEqual([expect.objectContaining({
      rechnung_id: R1, ablage: 'sharepoint', item_id: f.id, file_name: 'b.pdf', file_path: `${o.pfad}/b.pdf`, uploaded_by: 'b9',
    })]);
    expect(t.eingang(f.id)).toMatchObject({ status: 'erledigt', ergebnis: { aktion: 'dokument', typ: 'beleg' } });
  });

  it('Vertrag im Finder verschoben -> zurueck in seinen Ordner; im Bereich umbenannt -> Spalten ziehen mit', async () => {
    const t = setup({ assets: dokTabellen });
    const o = await kette(t, 'vertrag', VT1);
    const f = t.sp.datei(o.item_id, 'v.pdf', 3);
    Object.assign(t.supabase.db.vertraege[0], spaltenAusItem('vertrag', await t.sp.item(f.id), { driveId: 'd1', pfad: `${o.pfad}/v.pdf` }));
    const { item: fremd } = await t.sp.ordnerAnlegen('root', 'Ablage');
    t.supabase.db.ablage_ordner.push({ id: 'r-root-frei', drive_id: 'd1', item_id: fremd.id, parent_item_id: 'root', name: 'Ablage', pfad: '/Ablage', art: 'frei' });
    await t.sp.verschieben(f.id, fremd.id);
    t.seite([await t.meldung(f.id)]);
    await t.a.lauf();
    expect(t.sp.items.get(f.id).parent).toBe(o.item_id);
    expect(t.eingang(f.id)).toMatchObject({ ergebnis: { aktion: 'zurueck', grund: 'dokument_verschoben' } });

    t.sp.items.get(f.id).name = 'Vertrag final.pdf';
    t.seite([await t.meldung(f.id, { eTag: 'neu' })], 'dl-2');
    t.uhr.t += 5 * 60000;
    await t.a.lauf();
    expect(t.supabase.db.vertraege[0]).toMatchObject({ datei_path: `${o.pfad}/Vertrag final.pdf`, datei_item_id: f.id });
  });

  it('Dokument im Finder geloescht -> Zeile weg (zeile) bzw. Dateisatz leer (feld)', async () => {
    const t = setup({ assets: dokTabellen });
    const o = await kette(t, 'rechnung', R1);
    const f = t.sp.datei(o.item_id, 'r.pdf', 3);
    t.supabase.db.rechnung_pdfs.push({ id: id(40), rechnung_id: R1, ...spaltenAusItem('rechnung', await t.sp.item(f.id), { driveId: 'd1', pfad: `${o.pfad}/r.pdf` }) });
    t.seite([await t.meldung(f.id)]);
    await t.a.lauf();
    t.sp.items.delete(f.id);
    t.seite([t.weg(f.id, o.item_id)], 'dl-2');
    t.uhr.t += 5 * 60000;
    await t.a.lauf();
    expect(t.supabase.db.rechnung_pdfs).toHaveLength(0);
  });
});
