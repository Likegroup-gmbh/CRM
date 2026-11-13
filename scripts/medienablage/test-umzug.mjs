// test-umzug.mjs
// Probe-Umzug Dropbox -> SharePoint an einer Kopie: klont eine Kampagne (Kooperationen, Videos,
// Video-Dateien) in ein Testunternehmen und zieht nur den Klon mit dem Bestandsumzug (umzug.js) um.
// Der Klon zeigt auf dieselben Dropbox-Pfade; der Umzug kopiert nur, das Original bleibt unberuehrt.
// Laeuft lokal (die Bytes gehen ueber diesen Rechner) und bearbeitet nur die Umzugszeilen des Klons.
// Zuordnung alt -> neu liegt in .secrets/test-umzug/ (fuer --weiter und --zurueck).
//
// Aufruf (ohne Modus: Trockenlauf, schreibt nichts):
//   node scripts/medienablage/test-umzug.mjs --kampagne <id> --unternehmen <id> [--env .env]
//   ... --ausfuehren [--parallel 2]        klonen, Weiche auf SharePoint, umziehen, pruefen
//   ... --weiter [--parallel 2]            Umzug des Klons fortsetzen (Fehler neu versuchen), pruefen
//   ... --zurueck [--sharepoint-loeschen]  Klon und Register entfernen, Weiche zuruecksetzen
// Braucht die Live-Env (Supabase-Service-Key, MS_*/SP_*, DROPBOX_*); Zertifikat aus .secrets/ oder dem Vault.

import crypto from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import { ladeEnv, argumente, supabaseService, require } from './_env.mjs';

const { NAMEN, TEST_ORDNER, formatOrdner, dateiname, kampagnenName, basisName } = require('../../netlify/functions/_shared/ablage/pfad.js');

const KLON_ZUSATZ = ' (Umzugstest)';
const KEY_FILE = '.secrets/medienablage-app.key';
const CRT_FILE = '.secrets/medienablage-app.crt';
const ZUORDNUNG_DIR = '.secrets/test-umzug';
// Unter der Sperrfrist von ablage_umzug_holen (900 s), sonst greift ein zweiter Laeufer dieselbe Zeile
const BUDGET_MS = 12 * 60 * 1000;
const SPERRE_SEK = 900;
const MAX_WARTEN_MS = 10 * 60 * 1000;
const ONEDRIVE = /(sharepoint\.com|1drv\.ms|onedrive\.live\.com)/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const log = (...a) => console.error(...a);
const iso = (ms = Date.now()) => new Date(ms).toISOString();
const schlafen = (ms) => new Promise((r) => setTimeout(r, ms));
const mb = (b) => (b == null ? '?' : b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : `${(b / 1024 ** 2).toFixed(1)} MB`);

// ─── Reine Helfer (getestet) ────────────────────────────────

/** Quelle wie ablage_umzug_anlegen: OneDrive-Link, Dropbox-Pfad oder keine. */
export function quelleVon(asset) {
  if (ONEDRIVE.test(asset?.file_url || '')) return 'onedrive';
  return String(asset?.file_path || '').startsWith('/') ? 'dropbox' : null;
}

/** Zielordner wie ordner.zielOrdner fuer Video-Dateien, ohne " (2)"-Zaehler. */
export function zielOrdnerPfad({ unternehmen, marke = null, kampagne, kooperation, video, asset }) {
  const teile = [];
  if (unternehmen.ist_test) teile.push(TEST_ORDNER);
  teile.push(NAMEN.unternehmen(unternehmen), NAMEN.bereich('medien'));
  if (marke) teile.push(NAMEN.marke(marke));
  teile.push(NAMEN.kampagne(kampagne), NAMEN.kooperation(kooperation), NAMEN.typ('videos'), NAMEN.video(video));
  if (asset.is_final) {
    teile.push(NAMEN.finale());
    const f = formatOrdner(asset.variant_name);
    if (f) teile.push(f);
  } else {
    teile.push(NAMEN.schleife(asset.version_number || 1));
  }
  return `/${teile.join('/')}`;
}

/** Je Original-Datei: Quelle, Zielordner, Dateiname (wie umzug.js ihn vergibt). */
export function zielPlan({ unternehmen, kampagne, kooperationen, videos, assets }) {
  const koops = new Map(kooperationen.map((k) => [k.id, k]));
  const vids = new Map(videos.map((v) => [v.id, v]));
  return assets.filter((a) => !a.source_asset_id).map((asset) => {
    const video = vids.get(asset.video_id);
    const kooperation = koops.get(video?.kooperation_id);
    if (!video || !kooperation) throw new Error(`Datei ${asset.id} ohne Video/Kooperation in der Kampagne`);
    return {
      asset,
      quelle: quelleVon(asset),
      ordner: zielOrdnerPfad({ unternehmen, kampagne, kooperation, video, asset }),
      name: dateiname(asset.file_name || asset.file_path || 'video.mp4'),
    };
  });
}

/**
 * Gruppen gleicher Dateinamen im selben Zielordner (SharePoint benennt sie per conflict 'rename' um).
 * OneDrive-Dateien ohne file_name heissen erst nach dem Aufloesen des Links, ohne Quelle zieht nichts um.
 */
export function kollisionen(plan) {
  const je = new Map();
  for (const p of plan) {
    if (!p.quelle || (p.quelle === 'onedrive' && !p.asset.file_name)) continue;
    const k = `${p.ordner}/${p.name}`.toLowerCase();
    je.set(k, [...(je.get(k) || []), p]);
  }
  return [...je.values()].filter((g) => g.length > 1);
}

/** Ordnerpfad ohne " (2)"-Zaehler je Segment, fuer den Vergleich Soll/Ist. */
export function ohneZaehler(pfad) {
  return String(pfad || '').split('/').map(basisName).join('/');
}

/**
 * Klon-Zeilen mit neuen IDs. Preise, Produktion, Briefing und Ablage-Spalten bleiben leer:
 * der Klon soll nur die Ablage pruefen, nicht in Zahlen oder Budgets auftauchen.
 */
export function klonZeilen({ kampagne, kooperationen, videos, assets }, unternehmenId, neueId = () => crypto.randomUUID()) {
  const map = { kampagne: neueId(), kooperationen: {}, videos: {}, assets: {} };

  const kampagneZeile = {
    id: map.kampagne,
    kampagnenname: `${kampagnenName(kampagne)}${KLON_ZUSATZ}`,
    unternehmen_id: unternehmenId,
    kampagne_typ: kampagne.kampagne_typ ?? null,
    art_der_kampagne: kampagne.art_der_kampagne ?? null,
    start: kampagne.start ?? null,
    deadline: kampagne.deadline ?? null,
  };

  const koopZeilen = kooperationen.map((k) => {
    map.kooperationen[k.id] = neueId();
    return {
      id: map.kooperationen[k.id],
      name: k.name,
      kampagne_id: map.kampagne,
      creator_id: k.creator_id,
      unternehmen_id: unternehmenId,
      content_art: k.content_art ?? null,
      typ: k.typ ?? null,
      status: k.status ?? null,
      status_id: k.status_id ?? null,
      videoanzahl: k.videoanzahl ?? null,
      video_nummer: k.video_nummer ?? null,
      sort_order: k.sort_order ?? null,
    };
  });

  const videoZeilen = videos.filter((v) => map.kooperationen[v.kooperation_id]).map((v) => {
    map.videos[v.id] = neueId();
    return {
      id: map.videos[v.id],
      kooperation_id: map.kooperationen[v.kooperation_id],
      position: v.position ?? null,
      thema: v.thema ?? null,
      titel: v.titel ?? null,
      video_name: v.video_name ?? null,
      content_art: v.content_art ?? null,
      kampagnenart: v.kampagnenart ?? null,
      status: v.status ?? null,
    };
  });

  const originale = assets.filter((a) => !a.source_asset_id && map.videos[a.video_id]);
  for (const a of originale) map.assets[a.id] = neueId();
  // Promote-Finale nur, wenn ihr Original mitkommt (sonst wuerden sie zu eigenen Originalen)
  const promotes = assets.filter((a) => a.source_asset_id && map.assets[a.source_asset_id] && map.videos[a.video_id]);
  for (const a of promotes) map.assets[a.id] = neueId();

  const assetZeile = (a) => ({
    id: map.assets[a.id],
    video_id: map.videos[a.video_id],
    source_asset_id: a.source_asset_id ? map.assets[a.source_asset_id] : null,
    file_url: a.file_url ?? null,
    file_path: a.file_path ?? null,
    file_name: a.file_name ?? null,
    file_size: a.file_size ?? null,
    version_number: a.version_number ?? null,
    is_current: a.is_current ?? null,
    is_final: a.is_final ?? null,
    variant_name: a.variant_name ?? null,
    description: a.description ?? null,
    titel: a.titel ?? null,
    uploaded_by: a.uploaded_by ?? null,
    created_at: a.created_at,
    ablage: 'dropbox',
  });

  return {
    map,
    zeilen: {
      kampagne: kampagneZeile,
      kooperationen: koopZeilen,
      videos: videoZeilen,
      originale: originale.map(assetZeile),
      promotes: promotes.map(assetZeile),
    },
  };
}

// ─── Daten ──────────────────────────────────────────────────

function ergebnis({ data, error }, was) {
  if (error) throw new Error(`${was}: ${error.message}`);
  return data;
}

async function quelleLaden(supabase, kampagneId) {
  const kampagne = ergebnis(await supabase.from('kampagne').select('*').eq('id', kampagneId).maybeSingle(), 'Kampagne');
  if (!kampagne) throw new Error(`Kampagne ${kampagneId} nicht gefunden`);
  const kooperationen = ergebnis(await supabase.from('kooperationen').select('*').eq('kampagne_id', kampagneId)
    .order('created_at', { ascending: true }), 'Kooperationen');
  const koopIds = kooperationen.map((k) => k.id);
  const videos = koopIds.length
    ? ergebnis(await supabase.from('kooperation_videos').select('*').in('kooperation_id', koopIds).order('position', { ascending: true }), 'Videos')
    : [];
  const videoIds = videos.map((v) => v.id);
  const assets = videoIds.length
    ? ergebnis(await supabase.from('kooperation_video_asset').select('*').in('video_id', videoIds).order('created_at', { ascending: true }), 'Video-Dateien')
    : [];

  const andere = {};
  if (koopIds.length) {
    const zaehlen = async (tabelle, spalte, ids) => (await supabase.from(tabelle).select('id', { count: 'exact', head: true }).in(spalte, ids)).count || 0;
    andere.storys = videoIds.length ? await zaehlen('kooperation_story_asset', 'video_id', videoIds) : 0;
    andere.bilder = await zaehlen('kooperation_bilder_asset', 'kooperation_id', koopIds);
    andere.rohmaterial = await zaehlen('kooperation_rohmaterial_asset', 'kooperation_id', koopIds);
  }
  return { kampagne, kooperationen, videos, assets, andere };
}

function zuordnungsDatei(kampagneId, unternehmenId) {
  return path.join(ZUORDNUNG_DIR, `${kampagneId}_${unternehmenId}.json`);
}

function zuordnungLesen(datei) {
  if (!existsSync(datei)) return null;
  return JSON.parse(readFileSync(datei, 'utf8'));
}

function zuordnungSchreiben(datei, inhalt) {
  mkdirSync(path.dirname(datei), { recursive: true, mode: 0o700 });
  writeFileSync(datei, `${JSON.stringify(inhalt, null, 2)}\n`, { mode: 0o600 });
}

// ─── Vorpruefung und Trockenlauf ────────────────────────────

function zertifikatAusDateien() {
  if (process.env.MS_CERT_KEY && process.env.MS_CERT) return;
  if (!existsSync(KEY_FILE) || !existsSync(CRT_FILE)) return;
  process.env.MS_CERT_KEY = readFileSync(KEY_FILE, 'utf8');
  process.env.MS_CERT = readFileSync(CRT_FILE, 'utf8');
}

async function vorpruefen(supabase, { kampagneId, unternehmenId, mitSharePoint = true }) {
  const unternehmen = ergebnis(await supabase.from('unternehmen').select('id, firmenname, ablage_ziel, ist_test')
    .eq('id', unternehmenId).maybeSingle(), 'Unternehmen');
  if (!unternehmen) throw new Error(`Unternehmen ${unternehmenId} nicht gefunden`);
  const quelle = await quelleLaden(supabase, kampagneId);
  if (quelle.kampagne.unternehmen_id === unternehmen.id) throw new Error('Kampagne gehoert schon zum Zielunternehmen: das waere kein Klon');
  if (!mitSharePoint) return { unternehmen, quelle, ablage: null };

  const { ablageAusEnv } = require('../../netlify/functions/_shared/ablage/index.js');
  const { notschalterAn } = require('../../netlify/functions/_shared/ablage/ziel.js');
  const ablage = ablageAusEnv({ supabase });
  if (!ablage) throw new Error('SharePoint nicht konfiguriert (MS_TENANT_ID, MS_CLIENT_ID, SP_SITE_URL, SP_SITE_ID, SP_DRIVE_ID)');
  if (process.env.ABLAGE_ZIEL === 'dropbox') throw new Error('ABLAGE_ZIEL=dropbox ist gesetzt');
  if (await notschalterAn(supabase)) throw new Error('Notschalter ist an (Admin-Seite Medienablage)');

  const staende = ergebnis(await supabase.from('ablage_stand').select('drive_id'), 'ablage_stand');
  if (!staende.some((s) => s.drive_id === ablage.sp.driveId)) {
    throw new Error('SP_DRIVE_ID gehoert nicht zur eingerichteten Ablage (ablage_stand): falsche Env-Datei?');
  }
  const wurzel = await ablage.sp.wurzel();
  return { unternehmen, quelle, ablage, wurzel };
}

/** Dropbox-Groesse per Range-GET (wie umzug.js), null wenn nicht ermittelbar. */
async function dropboxGroesse(url) {
  const resp = await fetch(url, { headers: { Range: 'bytes=0-0' } });
  await resp.arrayBuffer().catch(() => null);
  const m = /\/(\d+)\s*$/.exec(resp.headers.get('content-range') || '');
  if (m) return Number(m[1]);
  const laenge = Number(resp.headers.get('content-length'));
  return resp.status === 200 && Number.isFinite(laenge) ? laenge : null;
}

async function dropboxPruefen(plan) {
  const { createDropboxAblage } = require('../../netlify/functions/_shared/ablage/dropbox.js');
  const dropbox = createDropboxAblage();
  const fehlt = [];
  let summe = 0;
  const offen = plan.filter((p) => p.quelle === 'dropbox');
  const arbeiter = async () => {
    for (let p = offen.shift(); p; p = offen.shift()) {
      const link = await dropbox.downloadUrl(p.asset.file_path);
      if (!link?.url) {
        fehlt.push(p);
        continue;
      }
      p.groesse = await dropboxGroesse(link.url).catch(() => null);
      summe += p.groesse || 0;
    }
  };
  try {
    await Promise.all(Array.from({ length: 4 }, arbeiter));
  } catch (err) {
    return { fehlt, summe, zugang: err.message };
  }
  return { fehlt, summe, zugang: null };
}

async function trockenlauf(supabase, ziel) {
  const { unternehmen, quelle, wurzel } = ziel;
  const { kampagne, kooperationen, videos, assets, andere } = quelle;
  const klonName = { ...kampagne, eigener_name: null, kampagnenname: `${kampagnenName(kampagne)}${KLON_ZUSATZ}` };
  const plan = zielPlan({ unternehmen, kampagne: klonName, kooperationen, videos, assets });
  const promotes = assets.filter((a) => a.source_asset_id).length;

  log(`Quelle:     ${kampagnenName(kampagne)}: ${kooperationen.length} Kooperationen, ${videos.length} Videos, ${plan.length} Dateien${promotes ? ` (+${promotes} Promote-Finale)` : ''}`);
  log(`Ziel:       ${unternehmen.firmenname} (Weiche ${unternehmen.ablage_ziel || 'dropbox'}${unternehmen.ist_test ? ', Testunternehmen: unter _Test' : ', kein Testunternehmen: direkt in der Wurzel'})`);
  log(`SharePoint: ${wurzel?.webUrl || '?'}`);
  for (const [art, n] of Object.entries(andere)) if (n) log(`Hinweis:    ${n} ${art} werden nicht geklont (nur Video-Dateien)`);

  const bereitsDa = ergebnis(await supabase.from('kampagne').select('id').eq('unternehmen_id', unternehmen.id)
    .eq('kampagnenname', klonName.kampagnenname), 'Kampagne');
  if (bereitsDa.length) log(`Hinweis:    "${klonName.kampagnenname}" gibt es im Ziel schon (${bereitsDa.map((k) => k.id).join(', ')})`);

  const { fehlt, summe, zugang } = await dropboxPruefen(plan);

  const wurzelPfad = `/${[unternehmen.ist_test ? TEST_ORDNER : null, NAMEN.unternehmen(unternehmen), NAMEN.bereich('medien'), NAMEN.kampagne(klonName)].filter(Boolean).join('/')}`;
  log(`\nZielstruktur unter ${wurzelPfad}/`);
  const jeOrdner = new Map();
  for (const p of plan) jeOrdner.set(p.ordner, [...(jeOrdner.get(p.ordner) || []), p]);
  for (const [ordner, eintraege] of [...jeOrdner].sort((a, b) => a[0].localeCompare(b[0], 'de'))) {
    log(`  ${ordner.slice(wurzelPfad.length + 1)}/`);
    for (const p of eintraege) {
      const herkunft = p.quelle === 'dropbox' ? path.basename(path.dirname(p.asset.file_path)) : p.quelle || 'ohne Quelle';
      log(`      ${p.name}  ${mb(p.groesse)}  (aus ${herkunft})`);
    }
  }

  const doppelt = kollisionen(plan);
  const ohneQuelle = plan.filter((p) => !p.quelle);
  const onedrive = plan.filter((p) => p.quelle === 'onedrive');
  log(`\nDateien:    ${plan.length}, Dropbox ${plan.length - onedrive.length - ohneQuelle.length}, OneDrive ${onedrive.length}, ohne Quelle ${ohneQuelle.length}`);
  if (zugang) log(`FEHLER:     Dropbox nicht erreichbar (DROPBOX_APP_KEY/_SECRET/_REFRESH_TOKEN in der Env pruefen): ${zugang}`);
  else log(`Volumen:    ${mb(summe)} (Dropbox, gehen ueber diesen Rechner)`);
  if (fehlt.length) {
    log(`WARNUNG:    ${fehlt.length} Dateien fehlen in Dropbox (Umzug: dropbox_fehlt):`);
    for (const p of fehlt) log(`      ${p.asset.file_path}`);
  }
  if (ohneQuelle.length) log(`WARNUNG:    ${ohneQuelle.length} Dateien ohne Dropbox-Pfad/OneDrive-Link (Umzug: uebersprungen)`);
  if (doppelt.length) {
    log(`WARNUNG:    ${doppelt.length} Namenskollisionen (Varianten-Ordner entfallen, SharePoint haengt " 1" an):`);
    for (const g of doppelt) log(`      ${g[0].ordner.slice(wurzelPfad.length + 1)}/${g[0].name}  x${g.length}`);
  }
  return { plan, fehlt, doppelt, bereitsDa, zugang };
}

// ─── Klonen ─────────────────────────────────────────────────

async function klonen(supabase, { quelle, unternehmen, datei }) {
  const { map, zeilen } = klonZeilen(quelle, unternehmen.id);
  const zuordnung = {
    erstellt_at: iso(),
    quelle_kampagne: quelle.kampagne.id,
    unternehmen: unternehmen.id,
    weiche_vorher: unternehmen.ablage_ziel || 'dropbox',
    ...map,
  };
  // Vor dem ersten Insert schreiben: bricht der Lauf ab, findet --zurueck die IDs trotzdem
  zuordnungSchreiben(datei, zuordnung);

  ergebnis(await supabase.from('kampagne').insert(zeilen.kampagne), 'Kampagne anlegen');
  ergebnis(await supabase.from('kooperationen').insert(zeilen.kooperationen), 'Kooperationen anlegen');
  if (zeilen.videos.length) ergebnis(await supabase.from('kooperation_videos').insert(zeilen.videos), 'Videos anlegen');
  if (zeilen.originale.length) ergebnis(await supabase.from('kooperation_video_asset').insert(zeilen.originale), 'Video-Dateien anlegen');
  if (zeilen.promotes.length) ergebnis(await supabase.from('kooperation_video_asset').insert(zeilen.promotes), 'Promote-Finale anlegen');

  log(`Geklont:    Kampagne "${zeilen.kampagne.kampagnenname}" (${map.kampagne}), ${zeilen.kooperationen.length} Kooperationen, ${zeilen.videos.length} Videos, ${zeilen.originale.length + zeilen.promotes.length} Dateien`);
  log(`Zuordnung:  ${datei}`);
  return zuordnung;
}

// ─── Umzug ──────────────────────────────────────────────────

async function weicheAufSharePoint(supabase, unternehmen) {
  if (unternehmen.ablage_ziel === 'sharepoint') return;
  ergebnis(await supabase.from('unternehmen').update({ ablage_ziel: 'sharepoint' }).eq('id', unternehmen.id), 'Weiche');
  log(`Weiche:     ${unternehmen.firmenname} -> sharepoint`);
}

async function einreihen(supabase, ablage, unternehmenId, assetIds) {
  const { createUmzug } = require('../../netlify/functions/_shared/ablage/umzug.js');
  await ablage.ordner.wurzel();
  const umzug = createUmzug({ supabase, ablage });
  const n = await umzug.anlegen(unternehmenId);
  const zeilen = ergebnis(await supabase.from('ablage_umzug').select('asset_id').eq('unternehmen_id', unternehmenId), 'ablage_umzug');
  const fremd = zeilen.filter((z) => !assetIds.includes(z.asset_id)).length;
  log(`Eingereiht: ${n} neu/wieder offen${fremd ? `, ${fremd} weitere Zeilen des Unternehmens (bearbeitet dieses Skript nicht)` : ''}`);
  return umzug;
}

/** Naechste faellige Zeile des Klons sperren (bedingtes Update: parallele Laeufer bekommen sie nicht). */
async function naechsteZeile(supabase, assetIds, anzahl) {
  const jetzt = iso();
  const frei = `gesperrt_bis.is.null,gesperrt_bis.lt.${jetzt}`;
  const kandidaten = ergebnis(await supabase.from('ablage_umzug').select('id').eq('typ', 'video').in('asset_id', assetIds)
    .eq('status', 'offen').lte('naechster_versuch', jetzt).or(frei)
    .order('naechster_versuch', { ascending: true }).limit(anzahl), 'ablage_umzug');
  for (const k of kandidaten) {
    const gesperrt = ergebnis(await supabase.from('ablage_umzug').update({ gesperrt_bis: iso(Date.now() + SPERRE_SEK * 1000) })
      .eq('id', k.id).eq('status', 'offen').or(frei).select('*'), 'ablage_umzug sperren');
    if (gesperrt?.length) return gesperrt[0];
  }
  return null;
}

async function offeneZeilen(supabase, assetIds) {
  return ergebnis(await supabase.from('ablage_umzug').select('id, naechster_versuch, gesperrt_bis, grund')
    .eq('typ', 'video').in('asset_id', assetIds).eq('status', 'offen'), 'ablage_umzug');
}

const kurz = (p) => (p ? `${p.ordner.split('/').slice(-3).join('/')}/${p.name}` : '?');

async function abarbeiten(supabase, umzug, { assetIds, planJeKlon, parallel }) {
  let nr = 0;
  let abbruch = null;

  const arbeiter = async () => {
    while (!abbruch) {
      const row = await naechsteZeile(supabase, assetIds, parallel * 2);
      if (!row) {
        const offen = await offeneZeilen(supabase, assetIds);
        if (!offen.length) return;
        // Gesperrt = ein Laeufer (dieser oder ein Netlify-Lauf) laedt gerade: weiter warten
        if (offen.some((z) => z.gesperrt_bis && Date.parse(z.gesperrt_bis) > Date.now())) {
          await schlafen(10000);
          continue;
        }
        const naechste = Math.min(...offen.map((z) => Date.parse(z.naechster_versuch)));
        const warten = naechste - Date.now();
        if (warten > MAX_WARTEN_MS) {
          abbruch = `${offen.length} Zeilen warten bis ${new Date(naechste).toLocaleTimeString('de-DE')} (${offen[0].grund || 'Backoff'}): spaeter mit --weiter fortsetzen`;
          return;
        }
        await schlafen(Math.max(5000, Math.min(warten, 60000)));
        continue;
      }
      const t0 = Date.now();
      const e = await umzug.eintragBearbeiten(row, { bis: Date.now() + BUDGET_MS });
      nr += 1;
      log(`  [${String(nr).padStart(3)}] ${e.status.padEnd(13)} ${(e.bytes ? mb(e.bytes) : '').padStart(9)}  ${kurz(planJeKlon.get(row.asset_id))}${e.grund ? `  (${e.grund})` : ''}  ${Math.round((Date.now() - t0) / 1000)} s`);
    }
  };

  log(`\nUmzug:      ${parallel} parallel, Abbruch mit Ctrl-C ist sicher (fortsetzen mit --weiter)`);
  await Promise.all(Array.from({ length: parallel }, arbeiter));
  if (abbruch) log(`Pause:      ${abbruch}`);
}

// ─── Pruefung ───────────────────────────────────────────────

async function pruefen(supabase, sp, { zuordnung, assetIds, planJeKlon }) {
  const zeilen = ergebnis(await supabase.from('ablage_umzug').select('asset_id, status, grund, groesse, versuche')
    .eq('typ', 'video').in('asset_id', assetIds), 'ablage_umzug');
  const assets = ergebnis(await supabase.from('kooperation_video_asset').select('id, ablage, item_id, file_path, file_size')
    .in('id', assetIds), 'Video-Dateien');
  const jeZeile = new Map(zeilen.map((z) => [z.asset_id, z]));

  const z = { ok: 0, offen: 0, fehler: 0, uebersprungen: 0, abweichung: 0 };
  const meldungen = [];
  if (assets.length < assetIds.length) {
    z.fehler += assetIds.length - assets.length;
    meldungen.push(`  ${assetIds.length - assets.length} Klon-Dateien fehlen in kooperation_video_asset`);
  }
  for (const a of assets) {
    const soll = planJeKlon.get(a.id);
    const row = jeZeile.get(a.id);
    const name = kurz(soll);
    if (!row) {
      z.fehler++;
      meldungen.push(`  nicht eingereiht  ${name}`);
      continue;
    }
    if (row.status !== 'fertig') {
      z[row.status === 'offen' ? 'offen' : row.status]++;
      meldungen.push(`  ${row.status.padEnd(16)} ${name}  (${row.grund || '-'}, ${row.versuche} Versuche)`);
      continue;
    }
    const item = a.item_id ? await sp.item(a.item_id, 'id,name,size,webUrl') : null;
    const fehler = [];
    if (a.ablage !== 'sharepoint') fehler.push(`ablage=${a.ablage}`);
    if (!item) fehler.push('Datei fehlt in SharePoint');
    else if (row.groesse != null && Number(item.size) !== Number(row.groesse)) fehler.push(`Groesse ${item.size} statt ${row.groesse}`);
    const istOrdner = path.posix.dirname(a.file_path || '');
    if (soll && ohneZaehler(istOrdner) !== ohneZaehler(soll.ordner)) fehler.push(`Ordner ${istOrdner} statt ${soll.ordner}`);
    if (fehler.length) {
      z.abweichung++;
      meldungen.push(`  ABWEICHUNG       ${name}: ${fehler.join(', ')}`);
    } else {
      z.ok++;
    }
  }

  log(`\nPruefung:   ${z.ok} ok (Datei in SharePoint, Groesse = Dropbox, richtiger Ordner), ${z.abweichung} Abweichungen, ${z.offen} offen, ${z.fehler} Fehler, ${z.uebersprungen} uebersprungen`);
  for (const m of meldungen) log(m);

  const ordner = ergebnis(await supabase.from('ablage_ordner').select('item_id, pfad').eq('art', 'kampagne')
    .eq('kampagne_id', zuordnung.kampagne).is('geloescht_at', null), 'ablage_ordner');
  for (const o of ordner) {
    const it = o.item_id ? await sp.item(o.item_id, 'id,webUrl') : null;
    log(`Ordner:     ${o.pfad}${it?.webUrl ? `\n            ${it.webUrl}` : ''}`);
  }
  return z.abweichung + z.fehler + z.offen === 0;
}

// ─── Zurueck ────────────────────────────────────────────────

async function zurueck(supabase, { zuordnung, datei, sp }) {
  const assetIds = Object.values(zuordnung.assets || {});
  const koopIds = Object.values(zuordnung.kooperationen || {});

  if (sp) {
    const ordner = ergebnis(await supabase.from('ablage_ordner').select('item_id, pfad').eq('art', 'kampagne')
      .eq('kampagne_id', zuordnung.kampagne).not('item_id', 'is', null), 'ablage_ordner');
    for (const o of ordner) {
      await sp.loeschen(o.item_id);
      log(`SharePoint: ${o.pfad} in den Papierkorb`);
    }
  }
  if (assetIds.length) {
    ergebnis(await supabase.from('ablage_umzug').delete().eq('typ', 'video').in('asset_id', assetIds), 'ablage_umzug');
    ergebnis(await supabase.from('ablage_upload').delete().in('kontext->>umzug_asset_id', assetIds), 'ablage_upload');
  }
  ergebnis(await supabase.from('ablage_ordner').delete().eq('kampagne_id', zuordnung.kampagne), 'ablage_ordner');
  if (koopIds.length) ergebnis(await supabase.from('ablage_ordner').delete().in('kooperation_id', koopIds), 'ablage_ordner');
  // Kaskade: Kooperationen -> Videos -> Video-Dateien
  ergebnis(await supabase.from('kampagne').delete().eq('id', zuordnung.kampagne), 'Kampagne loeschen');
  log(`Entfernt:   Kampagne ${zuordnung.kampagne} mit ${koopIds.length} Kooperationen, ${assetIds.length} Dateien, Umzugs- und Registerzeilen`);

  if (zuordnung.weiche_vorher) {
    ergebnis(await supabase.from('unternehmen').update({ ablage_ziel: zuordnung.weiche_vorher }).eq('id', zuordnung.unternehmen), 'Weiche');
    log(`Weiche:     zurueck auf ${zuordnung.weiche_vorher}`);
  }
  if (!sp) log('Hinweis:    SharePoint-Ordner bleiben liegen (--sharepoint-loeschen raeumt sie mit ab)');
  renameSync(datei, datei.replace(/\.json$/, `.entfernt-${Date.now()}.json`));
}

// ─── Ablauf ─────────────────────────────────────────────────

async function main() {
  const args = argumente();
  ladeEnv(args.env || '.env');
  const kampagneId = String(args.kampagne || '');
  const unternehmenId = String(args.unternehmen || '');
  if (!UUID_RE.test(kampagneId) || !UUID_RE.test(unternehmenId)) throw new Error('--kampagne und --unternehmen (UUIDs) sind Pflicht');
  const parallel = Math.max(1, Math.min(4, Number(args.parallel) || 2));
  const modi = ['ausfuehren', 'weiter', 'zurueck'].filter((m) => args[m]);
  if (modi.length > 1) throw new Error(`Nur ein Modus: ${modi.join(', ')}`);
  const modus = modi[0] || 'trocken';

  if (String(process.env.VITE_DROPBOX_UPLOAD || '').toLowerCase() === 'on') throw new Error('VITE_DROPBOX_UPLOAD=on: SharePoint ist abgeschaltet');
  // Der Schalter in schalter.json gilt fuer Client-Build und Functions; dieses Skript spricht SharePoint direkt an
  process.env.VITE_DROPBOX_UPLOAD = 'off';
  zertifikatAusDateien();

  const supabase = supabaseService();
  const datei = zuordnungsDatei(kampagneId, unternehmenId);
  const zuordnung = zuordnungLesen(datei);

  if (modus === 'zurueck') {
    if (!zuordnung) throw new Error(`Keine Zuordnung ${datei}: nichts zu entfernen`);
    let sp = null;
    if (args['sharepoint-loeschen']) sp = (await vorpruefen(supabase, { kampagneId, unternehmenId })).ablage.sp;
    await zurueck(supabase, { zuordnung, datei, sp });
    return;
  }

  const ziel = await vorpruefen(supabase, { kampagneId, unternehmenId });
  if (modus === 'ausfuehren' && zuordnung) throw new Error(`Klon existiert schon (${datei}): --weiter oder --zurueck`);
  if (modus === 'weiter' && !zuordnung) throw new Error(`Keine Zuordnung ${datei}: erst --ausfuehren`);

  const { plan, fehlt, bereitsDa, zugang } = await trockenlauf(supabase, ziel);
  if (modus === 'trocken') {
    log(`\nTrockenlauf: nichts geschrieben. Weiter mit --ausfuehren${fehlt.length ? ' (fehlende Dateien enden als Fehler)' : ''}.`);
    if (zugang) process.exitCode = 1;
    return;
  }
  if (zugang) throw new Error('Dropbox nicht erreichbar: nichts geklont');
  if (modus === 'ausfuehren' && bereitsDa.length) throw new Error('Klon-Kampagne existiert schon im Ziel, aber ohne Zuordnungsdatei: erst von Hand entfernen');

  const z = modus === 'ausfuehren' ? await klonen(supabase, { quelle: ziel.quelle, unternehmen: ziel.unternehmen, datei }) : zuordnung;
  // Nur Originale: Promote-Finale teilen die Datei und ziehen beim Umstellen mit
  const planJeKlon = new Map(plan.filter((p) => z.assets[p.asset.id]).map((p) => [z.assets[p.asset.id], p]));
  const assetIds = [...planJeKlon.keys()];
  await weicheAufSharePoint(supabase, ziel.unternehmen);
  const umzug = await einreihen(supabase, ziel.ablage, unternehmenId, assetIds);
  await abarbeiten(supabase, umzug, { assetIds, planJeKlon, parallel });
  const ok = await pruefen(supabase, ziel.ablage.sp, { zuordnung: z, assetIds, planJeKlon });
  log(ok ? '\nFertig: alle Dateien sind in SharePoint.' : '\nNoch nicht vollstaendig: --weiter versucht offene und fehlerhafte Zeilen erneut.');
  log(`Aufraeumen: node scripts/medienablage/test-umzug.mjs --kampagne ${kampagneId} --unternehmen ${unternehmenId} --zurueck --sharepoint-loeschen`);
  if (!ok) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`FEHLER: ${err.message}`);
    process.exit(1);
  });
}
