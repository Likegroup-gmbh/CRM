#!/usr/bin/env node
/**
 * Altbestand-Linien: V1-Kampagnen nach V2 uebernehmen.
 *
 * Kampagne > Produktion (je Tag-Gruppe) > Altbestand-Linie (Casting + Konzept + Kooperationen).
 * Regeln und Begruendung: docs/adr/0058-altbestand-wird-linie-ohne-briefing.md,
 * Planlogik: scripts/legacy-linien/planner.cjs.
 *
 * Usage:
 *   node scripts/legacy-linien-migration.js                       Dry-run, schreibt CSV nach reports/legacy-linien/<zeit>/
 *   node scripts/legacy-linien-migration.js --kampagne <id[,id]>  nur diese Kampagnen
 *   node scripts/legacy-linien-migration.js --apply [--limit 20]  auto-Kampagnen anwenden (Review-Kampagnen nie)
 *   node scripts/legacy-linien-migration.js --apply --kampagne <id>   gezielt, auch Review-Kampagnen (Pilot)
 *   node scripts/legacy-linien-migration.js --apply --reapply <kampagnen.csv>   Kampagnen mit freigabe=ja
 *   node scripts/legacy-linien-migration.js --verschieben <csv> [--apply]  Kooperation in andere Linie (kooperation_id;ziel_briefing_id)
 *   node scripts/legacy-linien-migration.js --rollback <lauf_id> [--kampagne <id>]
 *
 * Weitere Optionen: --snapshot <json> (offline planen), --export-snapshot <json>,
 *                   --ignore-aktiv (Kampagnen mit Aktivitaet in der letzten Stunde nicht ueberspringen),
 *                   --out <ordner>
 *
 * Env: SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY (Pflicht, ausser --snapshot)
 *
 * Es wird nie geschrieben: vertrag_kooperation, vertraege.kooperation_id, PDFs, Dropbox-Pfade, Status, Preise.
 * Jede Aenderung steht vorher in legacy_linien_backup (Rollback ueber --rollback).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { planKampagne } = require('./legacy-linien/planner.cjs');
const { vergleiche } = require('./legacy-linien/validate.cjs');
const {
  toCsv, parseCsv, berichtZeilen, KAMPAGNEN_SPALTEN, LINIEN_SPALTEN, KOOPS_SPALTEN,
} = require('./legacy-linien/report.cjs');

const AKTIV_FENSTER_MS = 60 * 60 * 1000;
const CHUNK = 100;

// ------------------------------------------------------------------ CLI
function parseArgs(argv) {
  const opt = { apply: false, ignoreAktiv: false, kampagnen: null, limit: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--apply') opt.apply = true;
    else if (a === '--dry-run') opt.apply = false;
    else if (a === '--ignore-aktiv') opt.ignoreAktiv = true;
    else if (a === '--kampagne') opt.kampagnen = String(next()).split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--limit') opt.limit = parseInt(next(), 10);
    else if (a === '--reapply') opt.reapply = next();
    else if (a === '--verschieben') opt.verschieben = next();
    else if (a === '--rollback') opt.rollback = next();
    else if (a === '--snapshot') opt.snapshot = next();
    else if (a === '--export-snapshot') opt.exportSnapshot = next();
    else if (a === '--out') opt.out = next();
    else if (a === '--help' || a === '-h') opt.help = true;
    else throw new Error(`Unbekannte Option: ${a}`);
  }
  return opt;
}

function loadEnvFile() {
  for (const name of ['.env.local', '.env']) {
    const envPath = path.join(__dirname, '..', name);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

function createDb() {
  loadEnvFile();
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY fehlt (.env.local oder Umgebung). Ohne Service-Role-Key kann das Skript weder lesen noch schreiben; alternativ --snapshot <json> fuer Dry-run.');
  }
  const { createClient } = require('@supabase/supabase-js');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ----------------------------------------------------------------- Laden
function chunks(list, size = CHUNK) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function lade(db, table, select, { inCol, values, order = 'id' } = {}) {
  const teile = values ? chunks([...new Set(values)]) : [null];
  const out = [];
  for (const teil of teile) {
    if (teil && !teil.length) continue;
    for (let from = 0; ; from += 1000) {
      let q = db.from(table).select(select).order(order).range(from, from + 999);
      if (teil) q = q.in(inCol, teil);
      const { data, error } = await q;
      if (error) throw new Error(`${table}: ${error.message}`);
      out.push(...(data || []));
      if ((data || []).length < 1000) break;
    }
  }
  return out;
}

async function ladeRohdaten(db, kampagneIds) {
  const filter = kampagneIds ? { inCol: 'id', values: kampagneIds } : {};
  const kampagnen = await lade(db, 'kampagne',
    'id, kampagnenname, eigener_name, art_der_kampagne, creator_budget, volumen, is_completed, auftrag_id, unternehmen_id, marke_id', filter);
  const ids = kampagnen.map(k => k.id);
  const nachKampagne = { inCol: 'kampagne_id', values: ids };

  const auftraege = await lade(db, 'auftrag', 'id, creator_budget, nettobetrag',
    { inCol: 'id', values: kampagnen.map(k => k.auftrag_id).filter(Boolean) });
  const produktionen = await lade(db, 'produktion', 'id, kampagne_id, name, budget, produkt_id, created_at', nachKampagne);
  const briefings = await lade(db, 'campaign_briefings', 'id, kampagne_id, produktion_id, ist_altbestand, is_draft, aktivierung_name, bereich',
    { inCol: 'produktion_id', values: produktionen.map(p => p.id) });
  const castings = await lade(db, 'creator_auswahl',
    'id, name, briefing_id, produktion_id, kampagne_id, strategie_id, liste_typ, unternehmen_id, marke_id, created_at, updated_at', nachKampagne);
  const konzepte = await lade(db, 'strategie',
    'id, name, briefing_id, produktion_id, kampagne_id, creator_auswahl_id, unternehmen_id, marke_id, created_at, updated_at', nachKampagne);
  const castingItems = await lade(db, 'creator_auswahl_items', 'id, creator_auswahl_id, creator_id',
    { inCol: 'creator_auswahl_id', values: castings.map(c => c.id) });
  const strategieItems = await lade(db, 'strategie_items', 'id, strategie_id',
    { inCol: 'strategie_id', values: konzepte.map(k => k.id) });
  const koops = await lade(db, 'kooperationen',
    'id, kampagne_id, creator_id, briefing_id, produktion_id, created_at, updated_at, verkaufspreis_netto, einkaufspreis_netto, status, status_id, vertrag_unterschrieben, videoanzahl', nachKampagne);
  const koopIds = koops.map(k => k.id);
  const tagTypen = await lade(db, 'kooperation_tag_typen', 'id, name');
  const koopTags = await lade(db, 'kooperation_tags', 'kooperation_id, tag_id',
    { inCol: 'kooperation_id', values: koopIds, order: 'kooperation_id' });
  const videos = await lade(db, 'kooperation_videos',
    'id, kooperation_id, strategie_item_id, skript_id, verkaufspreis_netto, einkaufspreis_netto', { inCol: 'kooperation_id', values: koopIds });
  const skripte = await lade(db, 'skripte', 'id, kampagne_id, briefing_id, produktion_id, strategie_item_id, updated_at', nachKampagne);
  const vertragKoops = await lade(db, 'vertrag_kooperation', 'vertrag_id, kooperation_id, created_at',
    { inCol: 'kooperation_id', values: koopIds, order: 'vertrag_id' });
  const vertraegeNachKoop = await lade(db, 'vertraege', 'id, typ, kooperation_id, kampagne_id, produktion_id',
    { inCol: 'kooperation_id', values: koopIds });
  const bekannt = new Set(vertraegeNachKoop.map(v => v.id));
  const fehlende = vertragKoops.map(v => v.vertrag_id).filter(id => !bekannt.has(id));
  const vertraegeGedeckt = await lade(db, 'vertraege', 'id, typ, kooperation_id, kampagne_id, produktion_id', { inCol: 'id', values: fehlende });
  const vertraege = [...vertraegeNachKoop, ...vertraegeGedeckt];

  return { kampagnen, auftraege, produktionen, briefings, castings, konzepte, castingItems, strategieItems, koops, tagTypen, koopTags, videos, skripte, vertragKoops, vertraege };
}

function baueKontexte(roh) {
  const tagName = new Map(roh.tagTypen.map(t => [t.id, t.name]));
  const tagsNachKoop = new Map();
  for (const t of roh.koopTags) {
    if (!tagsNachKoop.has(t.kooperation_id)) tagsNachKoop.set(t.kooperation_id, []);
    if (tagName.has(t.tag_id)) tagsNachKoop.get(t.kooperation_id).push(tagName.get(t.tag_id));
  }
  const auftragNachId = new Map(roh.auftraege.map(a => [a.id, a]));
  const nach = (list, key) => {
    const map = new Map();
    for (const row of list) {
      if (!map.has(row[key])) map.set(row[key], []);
      map.get(row[key]).push(row);
    }
    return map;
  };
  const produktionen = nach(roh.produktionen, 'kampagne_id');
  const castings = nach(roh.castings, 'kampagne_id');
  const konzepte = nach(roh.konzepte, 'kampagne_id');
  const koops = nach(roh.koops, 'kampagne_id');
  const skripte = nach(roh.skripte, 'kampagne_id');
  const briefingsNachProduktion = nach(roh.briefings, 'produktion_id');
  const videosNachKoop = nach(roh.videos, 'kooperation_id');
  const itemsNachCasting = nach(roh.castingItems, 'creator_auswahl_id');
  const itemsNachKonzept = nach(roh.strategieItems, 'strategie_id');
  const vertragKoopsNachKoop = nach(roh.vertragKoops, 'kooperation_id');
  const vertragNachId = new Map(roh.vertraege.map(v => [v.id, v]));

  const kontexte = new Map();
  for (const k of roh.kampagnen) {
    const kKoops = (koops.get(k.id) || []).map(x => ({ ...x, tags: tagsNachKoop.get(x.id) || [] }));
    const koopIds = new Set(kKoops.map(x => x.id));
    const kProduktionen = produktionen.get(k.id) || [];
    const kCastings = castings.get(k.id) || [];
    const kKonzepte = konzepte.get(k.id) || [];
    const kVertragKoops = kKoops.flatMap(x => vertragKoopsNachKoop.get(x.id) || []);
    const vertragIds = new Set(kVertragKoops.map(v => v.vertrag_id));
    for (const v of roh.vertraege) if (koopIds.has(v.kooperation_id)) vertragIds.add(v.id);
    kontexte.set(k.id, {
      kampagne: { ...k, auftrag: auftragNachId.get(k.auftrag_id) || null },
      produktionen: kProduktionen,
      briefings: kProduktionen.flatMap(p => briefingsNachProduktion.get(p.id) || []),
      castings: kCastings,
      konzepte: kKonzepte,
      castingItems: kCastings.flatMap(c => itemsNachCasting.get(c.id) || []),
      strategieItems: kKonzepte.flatMap(c => itemsNachKonzept.get(c.id) || []),
      koops: kKoops,
      videos: kKoops.flatMap(x => videosNachKoop.get(x.id) || []),
      skripte: skripte.get(k.id) || [],
      vertraege: [...vertragIds].map(id => vertragNachId.get(id)).filter(Boolean),
      vertragKoops: kVertragKoops,
    });
  }
  return kontexte;
}

// ------------------------------------------------------------ Messung
async function messeKampagne(db, kampagneId) {
  const [k] = await lade(db, 'kampagne', 'id, volumen, creator_budget, is_completed', { inCol: 'id', values: [kampagneId] });
  const nachKampagne = { inCol: 'kampagne_id', values: [kampagneId] };
  const produktionen = await lade(db, 'produktion', 'id, budget', nachKampagne);
  const koops = await lade(db, 'kooperationen',
    'id, kampagne_id, briefing_id, produktion_id, verkaufspreis_netto, einkaufspreis_netto, status, status_id, vertrag_unterschrieben, videoanzahl', nachKampagne);
  const koopIds = koops.map(x => x.id);
  const videos = await lade(db, 'kooperation_videos', 'id, kooperation_id, verkaufspreis_netto, einkaufspreis_netto', { inCol: 'kooperation_id', values: koopIds });
  const rechnungen = await lade(db, 'rechnung', 'id, auftrag_id, netto, vertrag_id', nachKampagne);
  const vertragKoops = await lade(db, 'vertrag_kooperation', 'vertrag_id, kooperation_id', { inCol: 'kooperation_id', values: koopIds, order: 'vertrag_id' });
  const vertraege = await lade(db, 'vertraege', 'id, typ, kampagne_id, produktion_id, kooperation_id', { inCol: 'kooperation_id', values: koopIds });
  return { kampagne: k, produktionen, koops, videos, rechnungen, vertraege, vertragKoopAnzahl: vertragKoops.length };
}

async function globaleZaehlung(db) {
  const tabellen = ['kooperationen', 'kooperation_videos', 'creator_auswahl_items', 'strategie_items', 'rechnung', 'vertraege', 'vertrag_kooperation'];
  const out = {};
  for (const t of tabellen) {
    const { count, error } = await db.from(t).select('*', { count: 'exact', head: true });
    if (error) throw new Error(`${t}: ${error.message}`);
    out[t] = count;
  }
  return out;
}

// -------------------------------------------------------------- Backup
function createBackup(db, laufId) {
  const puffer = [];
  async function flush() {
    while (puffer.length) {
      const teil = puffer.splice(0, 500);
      const { error } = await db.from('legacy_linien_backup').insert(teil);
      if (error) throw new Error(`Backup fehlgeschlagen: ${error.message}`);
    }
  }
  return {
    add(kampagneId, tabelle, zeilenId, aktion, alt = {}, regel = null) {
      puffer.push({ lauf_id: laufId, kampagne_id: kampagneId, tabelle, zeilen_id: zeilenId, aktion, alt, regel });
    },
    flush,
  };
}

async function updateIds(db, table, ids, werte) {
  for (const teil of chunks(ids, 200)) {
    const { error } = await db.from(table).update(werte).in('id', teil);
    if (error) throw new Error(`${table} update: ${error.message}`);
  }
}

async function insertRow(db, table, row) {
  const { error } = await db.from(table).insert(row);
  if (error) throw new Error(`${table} insert: ${error.message}`);
}

// --------------------------------------------------------------- Apply
function istAktiv(ctx, jetzt = Date.now()) {
  const legacy = [
    ...ctx.koops.filter(x => !x.briefing_id),
    ...ctx.castings.filter(x => !x.briefing_id),
    ...ctx.konzepte.filter(x => !x.briefing_id),
    ...ctx.skripte.filter(x => !x.briefing_id),
  ];
  return legacy.some(x => x.updated_at && jetzt - Date.parse(x.updated_at) < AKTIV_FENSTER_MS);
}

async function wendeKampagneAn(db, plan, ctx, laufId) {
  const kampagneId = plan.kampagneId;
  const backup = createBackup(db, laufId);
  const refs = new Map(); // 'neu:<key>' | produktionId -> produktionId
  const kampagne = ctx.kampagne;
  const vorher = await messeKampagne(db, kampagneId);

  try {
    // 1. Produktionen
    for (const ziel of plan.produktionen) {
      if (ziel.neu) {
        const id = crypto.randomUUID();
        backup.add(kampagneId, 'produktion', id, 'angelegt', {}, 'neue_produktion');
        await backup.flush();
        await insertRow(db, 'produktion', { id, kampagne_id: kampagneId, name: ziel.name, budget: null });
        refs.set(ziel.ref, id);
      } else {
        refs.set(ziel.ref, ziel.id);
        if (ziel.umbenennen) {
          backup.add(kampagneId, 'produktion', ziel.id, 'geaendert', { name: ziel.altName }, 'huelle_umbenannt');
          await backup.flush();
          const { error } = await db.from('produktion').update({ name: ziel.name }).eq('id', ziel.id);
          if (error) throw new Error(`produktion rename: ${error.message}`);
        }
      }
    }
    const aufloesen = ref => refs.get(ref) || ref;

    // 2. Linien (Briefing mit ist_altbestand), Casting und Konzept
    const briefingVonLinie = new Map();
    const castingNachId = new Map(ctx.castings.map(c => [c.id, c]));
    const konzeptNachId = new Map(ctx.konzepte.map(c => [c.id, c]));
    const verknuepfungen = [];

    for (const linie of plan.linien) {
      const produktionId = aufloesen(linie.produktionRef);
      let briefingId = linie.briefingId;
      if (!briefingId) {
        briefingId = crypto.randomUUID();
        backup.add(kampagneId, 'campaign_briefings', briefingId, 'angelegt', {}, 'altbestand_linie');
        await backup.flush();
        // INSERT mit aktivierung_name: der Trigger sync_produktion_line_names feuert nur bei UPDATE.
        await insertRow(db, 'campaign_briefings', {
          id: briefingId,
          unternehmen_id: kampagne.unternehmen_id || null,
          marke_id: kampagne.marke_id || null,
          kampagne_id: kampagneId,
          produktion_id: produktionId,
          bereich: linie.bereich,
          aktivierung_name: linie.titel,
          is_draft: false,
          ist_altbestand: true,
        });
      }
      briefingVonLinie.set(linie.key, { briefingId, produktionId });

      const zeile = { briefing_id: briefingId, produktion_id: produktionId };
      for (const castingId of linie.castingIds) {
        const alt = castingNachId.get(castingId);
        backup.add(kampagneId, 'creator_auswahl', castingId, 'geaendert',
          { briefing_id: alt.briefing_id ?? null, produktion_id: alt.produktion_id ?? null, strategie_id: alt.strategie_id ?? null, name: alt.name }, 'casting_zu_linie');
      }
      if (linie.konzeptId) {
        const alt = konzeptNachId.get(linie.konzeptId);
        backup.add(kampagneId, 'strategie', linie.konzeptId, 'geaendert',
          { briefing_id: alt.briefing_id ?? null, produktion_id: alt.produktion_id ?? null, creator_auswahl_id: alt.creator_auswahl_id ?? null, name: alt.name }, 'konzept_zu_linie');
      }
      await backup.flush();
      if (linie.castingIds.length) await updateIds(db, 'creator_auswahl', linie.castingIds, zeile);
      if (linie.konzeptId) await updateIds(db, 'strategie', [linie.konzeptId], zeile);

      // Leere Gegenstuecke: Name wie V2 ("<Titel> Casting"/"<Titel> Konzept"), kein Backup-Name noetig.
      let neuCastingId = null;
      let neuKonzeptId = null;
      const basis = {
        briefing_id: briefingId,
        produktion_id: produktionId,
        kampagne_id: kampagneId,
        unternehmen_id: kampagne.unternehmen_id || null,
        marke_id: kampagne.marke_id || null,
      };
      if (linie.neuCasting) {
        neuCastingId = crypto.randomUUID();
        backup.add(kampagneId, 'creator_auswahl', neuCastingId, 'angelegt', {}, 'leeres_casting');
        await backup.flush();
        await insertRow(db, 'creator_auswahl', { id: neuCastingId, name: `${linie.titel} Casting`, ...basis });
      }
      if (linie.neuKonzept) {
        neuKonzeptId = crypto.randomUUID();
        backup.add(kampagneId, 'strategie', neuKonzeptId, 'angelegt', {}, 'leeres_konzept');
        await backup.flush();
        await insertRow(db, 'strategie', { id: neuKonzeptId, name: `${linie.titel} Konzept`, ...basis });
      }

      const castingId = linie.castingIds[0] || neuCastingId;
      const konzeptId = linie.konzeptId || neuKonzeptId;
      const castingAlt = castingNachId.get(castingId);
      const konzeptAlt = konzeptNachId.get(konzeptId);
      if (castingId && konzeptId && !castingAlt?.strategie_id && !konzeptAlt?.creator_auswahl_id) {
        verknuepfungen.push({ castingId, konzeptId });
      }
    }
    for (const { castingId, konzeptId } of verknuepfungen) {
      await updateIds(db, 'strategie', [konzeptId], { creator_auswahl_id: castingId });
      await updateIds(db, 'creator_auswahl', [castingId], { strategie_id: konzeptId });
    }

    // Castings/Konzepte, die an bestehende Linien anschliessen
    for (const z of plan.castingZuordnung) {
      const alt = castingNachId.get(z.id);
      backup.add(kampagneId, 'creator_auswahl', z.id, 'geaendert',
        { briefing_id: alt.briefing_id ?? null, produktion_id: alt.produktion_id ?? null, strategie_id: alt.strategie_id ?? null, name: alt.name }, 'casting_paar_bestehend');
      await backup.flush();
      await updateIds(db, 'creator_auswahl', [z.id], { briefing_id: z.briefingId, produktion_id: z.produktionId });
    }
    for (const z of plan.konzeptZuordnung) {
      const alt = konzeptNachId.get(z.id);
      backup.add(kampagneId, 'strategie', z.id, 'geaendert',
        { briefing_id: alt.briefing_id ?? null, produktion_id: alt.produktion_id ?? null, creator_auswahl_id: alt.creator_auswahl_id ?? null, name: alt.name }, 'konzept_paar_bestehend');
      await backup.flush();
      await updateIds(db, 'strategie', [z.id], { briefing_id: z.briefingId, produktion_id: z.produktionId });
    }

    // 3. Kooperationen (briefing_id UND produktion_id zusammen)
    const koopNachId = new Map(ctx.koops.map(k => [k.id, k]));
    const erwartetKoops = new Map();
    const nachLinie = new Map();
    for (const z of plan.koopZuordnung) {
      const ziel = briefingVonLinie.get(z.linieKey);
      erwartetKoops.set(z.koopId, { briefingId: ziel.briefingId, produktionId: ziel.produktionId });
      if (!nachLinie.has(z.linieKey)) nachLinie.set(z.linieKey, []);
      nachLinie.get(z.linieKey).push(z.koopId);
      const alt = koopNachId.get(z.koopId);
      backup.add(kampagneId, 'kooperationen', z.koopId, 'geaendert',
        { briefing_id: alt.briefing_id ?? null, produktion_id: alt.produktion_id ?? null }, z.regel);
    }
    await backup.flush();
    for (const [linieKey, ids] of nachLinie) {
      const ziel = briefingVonLinie.get(linieKey);
      await updateIds(db, 'kooperationen', ids, { briefing_id: ziel.briefingId, produktion_id: ziel.produktionId });
    }

    // 4. Skripte
    const skriptNachId = new Map(ctx.skripte.map(s => [s.id, s]));
    for (const z of plan.skriptZuordnung) {
      const ziel = briefingVonLinie.get(z.linieKey);
      const alt = skriptNachId.get(z.skriptId);
      backup.add(kampagneId, 'skripte', z.skriptId, 'geaendert',
        { briefing_id: alt.briefing_id ?? null, produktion_id: alt.produktion_id ?? null }, z.regel);
      await backup.flush();
      await updateIds(db, 'skripte', [z.skriptId], { briefing_id: ziel.briefingId, produktion_id: ziel.produktionId });
    }

    // 5. Vertraege folgen der Erzeuger-Kooperation (nur produktion_id)
    const vertragNachId = new Map(ctx.vertraege.map(v => [v.id, v]));
    const erwartetVertraege = new Map();
    for (const z of plan.vertragZuordnung) {
      const alt = vertragNachId.get(z.vertragId);
      const produktionId = aufloesen(z.produktionRef);
      erwartetVertraege.set(z.vertragId, produktionId);
      if ((alt.produktion_id ?? null) === produktionId) continue;
      backup.add(kampagneId, 'vertraege', z.vertragId, 'geaendert',
        { produktion_id: alt.produktion_id ?? null, kampagne_id: alt.kampagne_id ?? null }, 'vertrag_folgt_koop');
      await backup.flush();
      await updateIds(db, 'vertraege', [z.vertragId], { produktion_id: produktionId });
    }

    // 6. Validierung
    const nachher = await messeKampagne(db, kampagneId);
    const fehler = vergleiche(vorher, nachher, {
      koops: erwartetKoops,
      vertraege: erwartetVertraege,
      koopsOhneProduktion: plan.koopsOhneProduktion,
    });
    if (fehler.length) {
      const err = new Error(`Validierung fehlgeschlagen:\n  - ${fehler.slice(0, 15).join('\n  - ')}${fehler.length > 15 ? `\n  ... ${fehler.length - 15} weitere` : ''}`);
      err.validierung = true;
      throw err;
    }
    return { ok: true };
  } catch (error) {
    await backup.flush().catch(() => {});
    console.error(`  Fehler bei ${plan.name}: ${error.message}`);
    console.error('  Rolle diese Kampagne zurueck ...');
    await rollbackLauf(db, laufId, kampagneId);
    return { ok: false, fehler: error.message };
  }
}

// ------------------------------------------------------------ Rollback
async function rollbackLauf(db, laufId, kampagneId = null) {
  let q = db.from('legacy_linien_backup').select('*').eq('lauf_id', laufId).is('rueckgaengig_am', null).order('created_at').order('id');
  if (kampagneId) q = q.eq('kampagne_id', kampagneId);
  const { data: rows, error } = await q;
  if (error) throw new Error(`Backup lesen: ${error.message}`);
  const erledigt = [];
  const offen = [];

  // neueste Aenderung zuerst, damit am Ende der aelteste (urspruengliche) Zustand steht
  const geaendert = rows.filter(r => r.aktion === 'geaendert').reverse();
  for (const r of geaendert) {
    const { error: e } = await db.from(r.tabelle).update(r.alt).eq('id', r.zeilen_id);
    if (e) { offen.push(`${r.tabelle} ${r.zeilen_id}: ${e.message}`); continue; }
    erledigt.push(r.id);
  }

  const angelegt = rows.filter(r => r.aktion === 'angelegt');
  const zaehle = async (table, col, id) => {
    const { count, error: e } = await db.from(table).select('id', { count: 'exact', head: true }).eq(col, id);
    if (e) throw new Error(`${table}: ${e.message}`);
    return count || 0;
  };
  async function loesche(r, table, referenzen) {
    for (const [refTable, refCol] of referenzen) {
      if (await zaehle(refTable, refCol, r.zeilen_id)) {
        offen.push(`${table} ${r.zeilen_id} nicht geloescht: ${refTable} verweist noch darauf`);
        return;
      }
    }
    const { error: e } = await db.from(table).delete().eq('id', r.zeilen_id);
    if (e) offen.push(`${table} ${r.zeilen_id}: ${e.message}`);
    else erledigt.push(r.id);
  }
  for (const r of angelegt.filter(x => x.tabelle === 'creator_auswahl')) await loesche(r, 'creator_auswahl', [['creator_auswahl_items', 'creator_auswahl_id']]);
  for (const r of angelegt.filter(x => x.tabelle === 'strategie')) await loesche(r, 'strategie', [['strategie_items', 'strategie_id']]);
  for (const r of angelegt.filter(x => x.tabelle === 'campaign_briefings')) {
    await loesche(r, 'campaign_briefings', [['kooperationen', 'briefing_id'], ['skripte', 'briefing_id'], ['creator_auswahl', 'briefing_id'], ['strategie', 'briefing_id']]);
  }
  for (const r of angelegt.filter(x => x.tabelle === 'produktion')) {
    await loesche(r, 'produktion', [['kooperationen', 'produktion_id'], ['campaign_briefings', 'produktion_id']]);
  }

  for (const teil of chunks(erledigt, 200)) {
    await db.from('legacy_linien_backup').update({ rueckgaengig_am: new Date().toISOString() }).in('id', teil);
  }
  console.log(`  Rollback: ${erledigt.length}/${rows.length} Zeilen zurueckgesetzt`);
  for (const o of offen) console.warn(`  ! ${o}`);
  return { erledigt: erledigt.length, offen };
}

// ----------------------------------------------------------- Verschieben
async function verschiebe(db, datei, apply) {
  const zeilen = parseCsv(fs.readFileSync(datei, 'utf8'));
  const laufId = crypto.randomUUID();
  console.log(`Verschieben: ${zeilen.length} Zeilen, Lauf ${laufId}${apply ? '' : ' (Dry-run)'}`);
  for (const z of zeilen) {
    const koopId = z.kooperation_id;
    const zielBriefing = z.ziel_briefing_id;
    if (!koopId || !zielBriefing) { console.warn('  uebersprungen: Zeile ohne kooperation_id/ziel_briefing_id'); continue; }
    const { data: koop } = await db.from('kooperationen').select('id, kampagne_id, briefing_id, produktion_id').eq('id', koopId).maybeSingle();
    const { data: briefing } = await db.from('campaign_briefings').select('id, produktion_id').eq('id', zielBriefing).maybeSingle();
    if (!koop || !briefing?.produktion_id) { console.warn(`  ${koopId}: Kooperation oder Ziel-Linie nicht gefunden`); continue; }
    const { data: produktion } = await db.from('produktion').select('id, kampagne_id, budget').eq('id', briefing.produktion_id).maybeSingle();
    if (!produktion || produktion.kampagne_id !== koop.kampagne_id) {
      console.warn(`  ${koopId}: Ziel liegt in einer anderen Kampagne, Kooperationen wechseln nie die Kampagne`);
      continue;
    }
    if (produktion.budget != null && produktion.id !== koop.produktion_id) {
      const { data: verbrauch } = await db.from('produktion_verbrauch').select('budget_used').eq('produktion_id', produktion.id).maybeSingle();
      const { data: videos } = await db.from('kooperation_videos').select('verkaufspreis_netto').eq('kooperation_id', koopId);
      const neu = (videos || []).reduce((s, v) => s + (parseFloat(v.verkaufspreis_netto) || 0), 0);
      if ((parseFloat(verbrauch?.budget_used) || 0) + neu > parseFloat(produktion.budget)) {
        console.warn(`  ${koopId}: Verbrauch wuerde das Produktionsbudget ueberschreiten, nicht verschoben`);
        continue;
      }
    }
    console.log(`  ${koopId}: Linie ${koop.briefing_id || '-'} -> ${zielBriefing}, Produktion ${koop.produktion_id || '-'} -> ${produktion.id}`);
    if (!apply) continue;

    const vorher = await messeKampagne(db, koop.kampagne_id);
    const backup = createBackup(db, laufId);
    backup.add(koop.kampagne_id, 'kooperationen', koopId, 'geaendert', { briefing_id: koop.briefing_id ?? null, produktion_id: koop.produktion_id ?? null }, 'verschieben');
    const { data: vertraege } = await db.from('vertraege').select('id, typ, kampagne_id, produktion_id').eq('kooperation_id', koopId);
    const erwartetVertraege = new Map();
    for (const v of (vertraege || []).filter(x => String(x.typ).toLowerCase() !== 'contracting')) {
      erwartetVertraege.set(v.id, produktion.id);
      if (v.produktion_id !== produktion.id) {
        backup.add(koop.kampagne_id, 'vertraege', v.id, 'geaendert', { produktion_id: v.produktion_id ?? null, kampagne_id: v.kampagne_id ?? null }, 'verschieben');
      }
    }
    await backup.flush();
    await updateIds(db, 'kooperationen', [koopId], { briefing_id: zielBriefing, produktion_id: produktion.id });
    for (const [vertragId] of erwartetVertraege) await updateIds(db, 'vertraege', [vertragId], { produktion_id: produktion.id });
    const nachher = await messeKampagne(db, koop.kampagne_id);
    const fehler = vergleiche(vorher, nachher, {
      koops: new Map([[koopId, { briefingId: zielBriefing, produktionId: produktion.id }]]),
      vertraege: erwartetVertraege,
    });
    if (fehler.length) {
      console.error(`  Validierung fehlgeschlagen (${fehler[0]}), rolle zurueck`);
      await rollbackLauf(db, laufId, koop.kampagne_id);
    }
  }
  console.log(`Lauf-ID fuer Rollback: ${laufId}`);
}

// ---------------------------------------------------------------- Main
function zeitstempel() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  if (opt.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n/, ''));
    return;
  }

  if (opt.rollback) {
    const db = createDb();
    await rollbackLauf(db, opt.rollback, opt.kampagnen?.[0] || null);
    return;
  }
  if (opt.verschieben) {
    await verschiebe(createDb(), opt.verschieben, opt.apply);
    return;
  }

  let roh;
  let db = null;
  if (opt.snapshot) {
    if (opt.apply) throw new Error('--apply geht nicht mit --snapshot');
    roh = JSON.parse(fs.readFileSync(opt.snapshot, 'utf8'));
  } else {
    db = createDb();
    roh = await ladeRohdaten(db, opt.kampagnen);
  }
  if (opt.exportSnapshot) fs.writeFileSync(opt.exportSnapshot, JSON.stringify(roh));

  const kontexte = baueKontexte(roh);
  const plaene = [];
  for (const ctx of kontexte.values()) {
    if (opt.kampagnen && !opt.kampagnen.includes(ctx.kampagne.id)) continue;
    const plan = planKampagne(ctx);
    if (plan.status !== 'noop') plaene.push(plan);
  }
  plaene.sort((a, b) => a.name.localeCompare(b.name));

  const namen = {
    casting: new Map(roh.castings.map(c => [c.id, c.name])),
    konzept: new Map(roh.konzepte.map(c => [c.id, c.name])),
  };
  const ausgabe = opt.out || path.join(__dirname, '..', 'reports', 'legacy-linien', zeitstempel());
  fs.mkdirSync(ausgabe, { recursive: true });
  const zeilen = berichtZeilen(plaene, namen);
  fs.writeFileSync(path.join(ausgabe, 'kampagnen.csv'), toCsv(KAMPAGNEN_SPALTEN, zeilen.kampagnen));
  fs.writeFileSync(path.join(ausgabe, 'linien.csv'), toCsv(LINIEN_SPALTEN, zeilen.linien));
  fs.writeFileSync(path.join(ausgabe, 'koops.csv'), toCsv(KOOPS_SPALTEN, zeilen.koops));

  const nachStatus = s => plaene.filter(p => p.status === s).length;
  console.log(`Kampagnen mit Altbestand: ${plaene.length} (auto ${nachStatus('auto')}, review ${nachStatus('review')})`);
  console.log(`Neue Produktionen: ${plaene.reduce((s, p) => s + p.stats.produktionenNeu, 0)}, umbenannt: ${plaene.reduce((s, p) => s + p.stats.produktionenUmbenannt, 0)}, neue Linien: ${plaene.reduce((s, p) => s + p.stats.linienNeu, 0)}`);
  console.log(`Kooperationen: ${plaene.reduce((s, p) => s + p.stats.koops, 0)}, Skripte: ${plaene.reduce((s, p) => s + p.stats.skripte, 0)}, Vertraege: ${plaene.reduce((s, p) => s + p.stats.vertraege, 0)}`);
  const warn = plaene.filter(p => p.negativerRest != null);
  if (warn.length) console.log(`Warnliste (Rest wird negativ): ${warn.map(p => `${p.name} ${p.negativerRest}`).join('; ')}`);
  console.log(`Report: ${ausgabe}`);

  if (!opt.apply) {
    console.log('Dry-run: nichts geschrieben. Mit --apply anwenden.');
    return;
  }

  // ---- Auswahl fuer --apply
  const freigegeben = new Set();
  if (opt.reapply) {
    for (const z of parseCsv(fs.readFileSync(opt.reapply, 'utf8'))) {
      if (/^(ja|j|x|1|true)$/i.test(z.freigabe || 'ja') && z.kampagne_id) freigegeben.add(z.kampagne_id);
    }
  }
  const explizit = new Set(opt.kampagnen || []);
  let kandidaten = plaene.filter(p => p.status === 'auto' || explizit.has(p.kampagneId) || freigegeben.has(p.kampagneId));
  if (opt.reapply && !opt.kampagnen) kandidaten = plaene.filter(p => freigegeben.has(p.kampagneId));
  if (opt.limit) kandidaten = kandidaten.slice(0, opt.limit);
  if (!kandidaten.length) { console.log('Keine Kampagne zum Anwenden.'); return; }

  const laufId = crypto.randomUUID();
  console.log(`\nLauf ${laufId}: ${kandidaten.length} Kampagnen (Rollback: --rollback ${laufId})`);
  const zaehlungVorher = await globaleZaehlung(db);
  let ok = 0;
  const fehlgeschlagen = [];
  const uebersprungen = [];
  for (const planAlt of kandidaten) {
    // frisch laden und neu planen, falls V1 zwischenzeitlich weitergearbeitet hat
    const frisch = await ladeRohdaten(db, [planAlt.kampagneId]);
    const ctx = baueKontexte(frisch).get(planAlt.kampagneId);
    if (!opt.ignoreAktiv && istAktiv(ctx)) {
      console.log(`- ${planAlt.name}: Aktivitaet in der letzten Stunde, uebersprungen`);
      uebersprungen.push(planAlt.name);
      continue;
    }
    const plan = planKampagne(ctx);
    if (plan.status === 'noop') continue;
    if (plan.status === 'review' && !explizit.has(plan.kampagneId) && !freigegeben.has(plan.kampagneId)) {
      console.log(`- ${plan.name}: nach frischem Laden im Review (${plan.gruende.join(',')}), uebersprungen`);
      uebersprungen.push(plan.name);
      continue;
    }
    console.log(`- ${plan.name}: ${plan.stats.koops} Koops, ${plan.stats.linienNeu} neue Linien, ${plan.stats.produktionenNeu} neue Produktionen`);
    const ergebnis = await wendeKampagneAn(db, plan, ctx, laufId);
    if (ergebnis.ok) ok += 1;
    else fehlgeschlagen.push(`${plan.name}: ${ergebnis.fehler}`);
  }
  const zaehlungNachher = await globaleZaehlung(db);
  console.log('\nZaehlung vorher/nachher (muss gleich sein, ausser keiner Tabelle mit neuen Zeilen):');
  for (const k of Object.keys(zaehlungVorher)) {
    console.log(`  ${k}: ${zaehlungVorher[k]} -> ${zaehlungNachher[k]}${zaehlungVorher[k] === zaehlungNachher[k] ? '' : '  <-- ABWEICHUNG'}`);
  }
  console.log(`\nFertig: ${ok} ok, ${fehlgeschlagen.length} zurueckgerollt, ${uebersprungen.length} uebersprungen. Lauf ${laufId}`);
  for (const f of fehlgeschlagen) console.log(`  ! ${f}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = { parseArgs, baueKontexte, istAktiv };
