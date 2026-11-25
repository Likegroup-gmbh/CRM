#!/usr/bin/env node
// scripts/preisfenster-12-nachrechnen.mjs
// Einmaliger Nachlauf zu ADR 0084 (kurzes Preisfenster 12 statt 8 Videos). Rechnet die
// 12er-Werte aus den gespeicherten Videos nach, ohne Meta oder Apify zu fragen, und schreibt
// sie in Casting-Zeilen und Pool. 30er-Werte und calc_version bleiben unberuehrt, der naechste
// Abruf holt also wie gewohnt frische Daten. Die 8er-Schluessel in den Stats bleiben fuer den
// alten Client stehen, deshalb darf das Script schon vor dem Deploy laufen. Nach dem Deploy
// noch einmal laufen lassen: das holt die Zeilen nach, die alter Code inzwischen geschrieben hat.
//
// Aufruf aus dem Repo-Root:
//   node scripts/preisfenster-12-nachrechnen.mjs [--env .env.local] [--apply]
//
//   ohne --apply  Dry-Run: zaehlt je Ziel und zeigt Stichproben
//   --apply       schreibt
//
// Voraussetzung: Migration 20261231_preisfenster_12.sql ist eingespielt.
// Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY aus der Datei hinter --env (Default .env).

import { createRequire } from 'node:module';
import { ladeEnv, argumente, supabaseService } from './medienablage/_env.mjs';

const require = createRequire(import.meta.url);
const { CALC_VERSION } = require('../netlify/functions/_shared/instagram-cpm.js');
const { aufKurzesFenster } = require('../netlify/functions/_shared/instagram-cpm-nachrechnen.js');

const ZIELE = [
  { tabelle: 'creator_auswahl_items', stats: 'ig_stats', views: 'ig_views_12', cpm: 'cpm_ig_12', lang: 'ig_views_30' },
  { tabelle: 'creator_auswahl_items', stats: 'tt_stats', views: 'tt_views_12', lang: 'tt_views_30' },
  { tabelle: 'sourcing_creator', stats: 'ig_stats', views: 'ig_views_12', cpm: 'cpm_ig_12', lang: 'ig_views_30' },
  { tabelle: 'sourcing_creator_tiktok', stats: 'tt_stats', views: 'tt_views_12', lang: 'tt_views_30' }
];

// Ab Version 4 ist stats.videos die Liste, auf der die Fenster gewaehlt werden. Ab
// CALC_VERSION hat der Abruf selbst schon 12er-Werte geschrieben, und zwar aus der vollen Liste.
const MIN_VERSION = 4;
const SEITE = 500;
const PARALLEL = 8;
const STICHPROBEN = 5;

const version = (stats) => Number(stats?.calc_version || 0);

async function* zeilen(supabase, ziel) {
  let nachId = null;
  for (;;) {
    let query = supabase
      .from(ziel.tabelle)
      .select(`id, ${ziel.stats}, ${ziel.lang}`)
      .order('id')
      .limit(SEITE);
    if (nachId) query = query.gt('id', nachId);
    const { data, error } = await query;
    if (error) throw new Error(`${ziel.tabelle} nicht lesbar: ${error.message}`);
    if (!data.length) return;
    yield* data;
    nachId = data[data.length - 1].id;
  }
}

/** Fuehrt die Updates mit begrenzter Parallelitaet aus; liefert die Fehler */
async function schreibe(supabase, ziel, updates) {
  const fehler = [];
  for (let i = 0; i < updates.length; i += PARALLEL) {
    const block = updates.slice(i, i + PARALLEL);
    const ergebnisse = await Promise.all(block.map(({ id, werte }) => (
      supabase.from(ziel.tabelle).update(werte).eq('id', id)
    )));
    ergebnisse.forEach(({ error }, j) => {
      if (error) fehler.push(`${block[j].id}: ${error.message}`);
    });
  }
  return fehler;
}

async function bearbeite(supabase, ziel, apply) {
  const zaehler = { gesamt: 0, alt: 0, ohneVideos: 0, aktuell: 0, ohneWert: 0, neu: 0 };
  const updates = [];
  const proben = [];

  for await (const zeile of zeilen(supabase, ziel)) {
    zaehler.gesamt += 1;
    const stats = zeile[ziel.stats];
    if (version(stats) >= CALC_VERSION) { zaehler.aktuell += 1; continue; }
    if (version(stats) < MIN_VERSION) { zaehler.alt += 1; continue; }
    const ergebnis = aufKurzesFenster(stats);
    if (!ergebnis) { zaehler.ohneVideos += 1; continue; }
    if (ergebnis.views == null) zaehler.ohneWert += 1;
    else zaehler.neu += 1;

    const werte = { [ziel.views]: ergebnis.views, [ziel.stats]: ergebnis.stats };
    if (ziel.cpm) werte[ziel.cpm] = ergebnis.cpm;
    updates.push({ id: zeile.id, werte });
    if (proben.length < STICHPROBEN && ergebnis.views != null) {
      proben.push({
        id: zeile.id,
        views_12: ergebnis.views,
        views_30: zeile[ziel.lang],
        sample_12: ergebnis.stats.sample_12,
        ohne_trials_12: ergebnis.stats.ohne_trials?.views_12 ?? null
      });
    }
  }

  console.log(`\n${ziel.tabelle} (${ziel.stats})`);
  console.log(`  ${zaehler.gesamt} Zeilen, ${updates.length} nachgerechnet: ${zaehler.neu} mit 12er-Wert, `
    + `${zaehler.ohneWert} mit weniger als 12 Videos`);
  console.log(`  uebersprungen: ${zaehler.aktuell} schon Version ${CALC_VERSION}, `
    + `${zaehler.alt} vor Version ${MIN_VERSION}, ${zaehler.ohneVideos} ohne gespeicherte Videos`);
  if (proben.length) console.table(proben);
  if (!apply || !updates.length) return 0;

  const fehler = await schreibe(supabase, ziel, updates);
  console.log(`  geschrieben: ${updates.length - fehler.length}, Fehler: ${fehler.length}`);
  for (const f of fehler.slice(0, 10)) console.error(`  ${f}`);
  return fehler.length;
}

const args = argumente();
ladeEnv(typeof args.env === 'string' ? args.env : '.env');
const supabase = supabaseService();
const apply = args.apply === true;

console.log(apply ? 'Schreibt die 12er-Werte.' : 'Dry-Run, nichts wird geschrieben (--apply zum Schreiben).');
let fehlerGesamt = 0;
try {
  for (const ziel of ZIELE) fehlerGesamt += await bearbeite(supabase, ziel, apply);
} catch (err) {
  console.error(`Abgebrochen: ${err.message}`);
  process.exit(1);
}
if (fehlerGesamt) process.exit(1);
