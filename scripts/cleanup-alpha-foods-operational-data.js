#!/usr/bin/env node
/**
 * Einmalige Bereinigung: Alpha Foods — operative Daten entfernen.
 *
 * Löscht: Rechnungen, Verträge, Briefings, Creator-Auswahlen, Strategien,
 *         Kampagnen (+ Kooperationen via CASCADE), Aufträge, Produkte.
 * Behält: Unternehmen, Marken (Grüne Kraft, Lila Kraft, Rote Kraft),
 *         Ansprechpartner, globale Creator-Datensätze.
 *
 * Usage:
 *   node scripts/cleanup-alpha-foods-operational-data.js --dry-run
 *   node scripts/cleanup-alpha-foods-operational-data.js
 *   node scripts/cleanup-alpha-foods-operational-data.js --db-only
 *   node scripts/cleanup-alpha-foods-operational-data.js --dropbox-only
 *
 * Env: SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY,
 *      DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, DROPBOX_APP_SECRET
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const ALPHA_FOODS_ID = '3e8606e0-106e-4801-a95a-4bad42df6419';

const DELETE_STEPS = [
  { table: 'rechnung', filter: { unternehmen_id: ALPHA_FOODS_ID } },
  { table: 'vertraege', filter: { kunde_unternehmen_id: ALPHA_FOODS_ID } },
  { table: 'briefings', filter: { unternehmen_id: ALPHA_FOODS_ID } },
  { table: 'creator_auswahl', filter: { unternehmen_id: ALPHA_FOODS_ID } },
  { table: 'strategie', filter: { unternehmen_id: ALPHA_FOODS_ID } },
  // kampagne delete cascades kooperationen + all junction tables
  { table: 'kampagne', filter: { unternehmen_id: ALPHA_FOODS_ID } },
  { table: 'auftrag', filter: { unternehmen_id: ALPHA_FOODS_ID } },
  { table: 'produkt', filter: { unternehmen_id: ALPHA_FOODS_ID } },
];

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const DB_ONLY = args.includes('--db-only');
const DROPBOX_ONLY = args.includes('--dropbox-only');

function loadEnvFile() {
  const candidates = ['.env.local', '.env'];
  for (const name of candidates) {
    const envPath = path.join(__dirname, '..', name);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Supabase credentials missing (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
  return createClient(url, key);
}

async function getDropboxToken() {
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  if (!refreshToken || !appKey || !appSecret) return null;

  const resp = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: appKey,
      client_secret: appSecret,
    }),
  });
  if (!resp.ok) throw new Error(`Dropbox token refresh failed: ${resp.status}`);
  const data = await resp.json();
  return data.access_token;
}

async function dropboxDeleteFolder(token, folderPath) {
  const resp = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: folderPath }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 409 && text.includes('not_found')) {
      return { status: 'not_found', path: folderPath };
    }
    return { status: 'error', path: folderPath, error: `${resp.status} ${text.slice(0, 200)}` };
  }
  return { status: 'deleted', path: folderPath };
}

async function collectDropboxIds(sb) {
  const { data: kampagnen } = await sb.from('kampagne').select('id, kampagnenname').eq('unternehmen_id', ALPHA_FOODS_ID);
  const { data: koops } = await sb.from('kooperationen').select('id, name').eq('unternehmen_id', ALPHA_FOODS_ID);
  return { kampagnen: kampagnen || [], kooperationen: koops || [] };
}

async function cleanupDropbox(token, kampagnen, kooperationen) {
  const results = [];

  for (const k of kampagnen) {
    const folderPath = `/Alpha Foods/${k.kampagnenname || k.id}`;
    console.log(`  Dropbox kampagne: ${folderPath}`);
    if (!DRY_RUN) {
      const r = await dropboxDeleteFolder(token, folderPath);
      results.push(r);
      console.log(`    → ${r.status}`);
    }
  }

  for (const k of kooperationen) {
    const folderPath = `/Vertraege/Alpha Foods/${k.name || k.id}`;
    console.log(`  Dropbox kooperation: ${folderPath}`);
    if (!DRY_RUN) {
      const r = await dropboxDeleteFolder(token, folderPath);
      results.push(r);
      console.log(`    → ${r.status}`);
    }
  }

  return results;
}

async function verify(sb) {
  console.log('\n=== Verifikation ===');
  const checks = [
    { label: 'unternehmen', query: sb.from('unternehmen').select('id', { count: 'exact', head: true }).eq('id', ALPHA_FOODS_ID) },
    { label: 'marke', query: sb.from('marke').select('id', { count: 'exact', head: true }).eq('unternehmen_id', ALPHA_FOODS_ID) },
    { label: 'auftrag', query: sb.from('auftrag').select('id', { count: 'exact', head: true }).eq('unternehmen_id', ALPHA_FOODS_ID) },
    { label: 'kampagne', query: sb.from('kampagne').select('id', { count: 'exact', head: true }).eq('unternehmen_id', ALPHA_FOODS_ID) },
    { label: 'kooperationen', query: sb.from('kooperationen').select('id', { count: 'exact', head: true }).eq('unternehmen_id', ALPHA_FOODS_ID) },
    { label: 'rechnung', query: sb.from('rechnung').select('id', { count: 'exact', head: true }).eq('unternehmen_id', ALPHA_FOODS_ID) },
    { label: 'vertraege', query: sb.from('vertraege').select('id', { count: 'exact', head: true }).eq('kunde_unternehmen_id', ALPHA_FOODS_ID) },
    { label: 'briefings', query: sb.from('briefings').select('id', { count: 'exact', head: true }).eq('unternehmen_id', ALPHA_FOODS_ID) },
    { label: 'strategie', query: sb.from('strategie').select('id', { count: 'exact', head: true }).eq('unternehmen_id', ALPHA_FOODS_ID) },
    { label: 'creator_auswahl', query: sb.from('creator_auswahl').select('id', { count: 'exact', head: true }).eq('unternehmen_id', ALPHA_FOODS_ID) },
    { label: 'produkt', query: sb.from('produkt').select('id', { count: 'exact', head: true }).eq('unternehmen_id', ALPHA_FOODS_ID) },
  ];

  let allGood = true;
  for (const { label, query } of checks) {
    const { count, error } = await query;
    const expected = (label === 'unternehmen') ? 1 : (label === 'marke') ? 3 : 0;
    const ok = count === expected;
    if (!ok) allGood = false;
    console.log(`  ${ok ? '✓' : '✗'} ${label}: ${count} (erwartet: ${expected})${error ? ` [ERROR: ${error.message}]` : ''}`);
  }

  return allGood;
}

async function main() {
  loadEnvFile();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Alpha Foods Cleanup ${DRY_RUN ? '(DRY RUN)' : '🔴 LIVE'}`);
  console.log(`${'='.repeat(60)}\n`);
  console.log(`  Unternehmen-ID: ${ALPHA_FOODS_ID}`);
  console.log(`  Flags: dry-run=${DRY_RUN}, db-only=${DB_ONLY}, dropbox-only=${DROPBOX_ONLY}\n`);

  const sb = getSupabase();

  // Collect IDs for Dropbox before deleting from DB
  const dropboxData = await collectDropboxIds(sb);
  console.log(`  Kampagnen für Dropbox: ${dropboxData.kampagnen.length}`);
  console.log(`  Kooperationen für Dropbox: ${dropboxData.kooperationen.length}\n`);

  // --- Dropbox Cleanup ---
  if (!DB_ONLY) {
    console.log('--- Dropbox Cleanup ---');
    const token = await getDropboxToken();
    if (token) {
      await cleanupDropbox(token, dropboxData.kampagnen, dropboxData.kooperationen);
    } else {
      console.log('  ⚠ Dropbox-Credentials fehlen, überspringe Dropbox-Cleanup.');
    }
    console.log('');
  }

  // --- DB Cleanup ---
  if (!DROPBOX_ONLY) {
    console.log('--- DB Cleanup ---');
    for (const step of DELETE_STEPS) {
      const [[filterCol, filterVal]] = Object.entries(step.filter);
      const { count, error: countErr } = await sb
        .from(step.table)
        .select('id', { count: 'exact', head: true })
        .eq(filterCol, filterVal);

      console.log(`  ${step.table}: ${count ?? '?'} Datensätze`);
      if (countErr) {
        console.log(`    ⚠ Count-Fehler: ${countErr.message}`);
      }

      if (!DRY_RUN && count > 0) {
        const { error } = await sb.from(step.table).delete().eq(filterCol, filterVal);
        if (error) {
          console.log(`    ✗ Delete-Fehler: ${error.message}`);
        } else {
          console.log(`    ✓ ${count} gelöscht`);
        }
      }
    }
    console.log('');

    // Verification
    if (!DRY_RUN) {
      const ok = await verify(sb);
      console.log(ok ? '\n✅ Cleanup erfolgreich!' : '\n⚠ Verifikation fehlgeschlagen — bitte manuell prüfen.');
    }
  }

  console.log('\nFertig.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
