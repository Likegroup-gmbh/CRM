// ablageAbgleichTestKit.js
// Gemeinsame Fakes fuer die Abgleich-Tests: SQL-RPCs in JS, setup() mit Uhr, SharePoint und Ordner.

import { createRequire } from 'module';
import { createFakeSupabase, createFakeSharePoint, ORDNER_UNIQUE, urlUmschreiben, strukturOffen } from './fixtures/fakeSupabase.js';

const require = createRequire(import.meta.url);
const { createAbgleich } = require('../../netlify/functions/_shared/ablage/abgleich.js');
const { createOrdner } = require('../../netlify/functions/_shared/ablage/ordner.js');

export const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const K1 = id(1);
export const KA1 = id(2);
export const U1 = id(3);
export const V1 = id(4);
export const S1 = id(6);
export const START = Date.parse('2026-11-09T12:00:00Z');
export const iso = (ms) => new Date(ms).toISOString();

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

export function setup({ assets = {}, abgleich = {} } = {}) {
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

export const videoZiel = (extra = {}) => ({ typ: 'video', kooperation_id: K1, kooperation_video_id: V1, version_number: 2, variant_name: 'B', ...extra });

/** Varianten-Ordner aus der Zeit vor ADR 0065 (legt das CRM nicht mehr an). */
export async function alteVariante(t, schleife, name = 'B') {
  const { item } = await t.sp.ordnerAnlegen(schleife.item_id, name);
  t.supabase.db.ablage_ordner.push({
    id: `alt-${name}`, drive_id: 'd1', item_id: item.id, parent_item_id: schleife.item_id, name, pfad: `${schleife.pfad}/${name}`,
    art: 'variante', typ: 'videos', variante: name, unternehmen_id: U1, kampagne_id: KA1, kooperation_id: K1,
    kooperation_video_id: V1, version_number: schleife.version_number,
  });
  return t.reg(item.id);
}
