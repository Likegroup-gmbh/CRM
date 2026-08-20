#!/usr/bin/env node
/**
 * Einmal-Move: Xenia-Celina Mayer 7/7 (DA Direkt KFZ UGC) → DA Direkt - Q3 26 - KFZ - Renewal
 *
 * Nur Kooperation f14eec01… (Tag Renewal, Status Verträge).
 * 4/2 (Abgeschlossen, bezahlte Rechnung) bleibt in KFZ UGC.
 *
 * Usage:
 *   node scripts/move-xenia-kfz-ugc-to-renewal.js --dry-run
 *   node scripts/move-xenia-kfz-ugc-to-renewal.js
 *   node scripts/move-xenia-kfz-ugc-to-renewal.js --db-only
 *   node scripts/move-xenia-kfz-ugc-to-renewal.js --dropbox-only
 *
 * Env: SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY,
 *      DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, DROPBOX_APP_SECRET
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { getAccessToken, ensureFolder } = require('../netlify/functions/_shared/dropbox');

const SOURCE_KAMPAGNE_ID = 'aac1f682-0e28-4846-b34c-3dd25dac9ff1';
const TARGET_KAMPAGNE_ID = '6a28a396-775a-42f1-aa27-451f128ecbac';
const KOOP_ID = 'f14eec01-35af-4059-a5b5-ecd1d45eeb83';
const STAY_KOOP_ID = '57315175-f68f-405a-bca8-9a142c355e65';
const VERTRAG_ID = '1aa30c1a-7cf2-479b-9ddb-32366e4e4a47';
const STAY_RECHNUNG_ID = 'b4359817-1e99-493c-83d3-53ab90c37b4f';

const NEW_KOOP_NAME = 'Xenia-Celina Mayer 4/17';
const NEW_VERTRAG_NAME = 'UGC - DA Direkt - Q3 26 - KFZ - Renewal - Xenia-Celina Mayer';

const DROPBOX_FROM = '/DA Deutsche Allgemeine Versicherung Aktiengesellschaft/DA Direkt KFZ-Versicherung/DA Direkt KFZ UGC/Xenia-Celina Mayer 7-7';
const DROPBOX_TO = '/DA Deutsche Allgemeine Versicherung Aktiengesellschaft/DA Direkt - Q3 26 - KFZ - Renewal/Xenia-Celina Mayer 4-17';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const DB_ONLY = args.includes('--db-only');
const DROPBOX_ONLY = args.includes('--dropbox-only');

function loadEnvFile() {
  for (const name of ['.env.local', '.env']) {
    const envPath = path.join(__dirname, '..', name);
    if (fs.existsSync(envPath)) loadEnvFromPath(envPath);
  }
}

function loadEnvFromPath(envPath) {
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

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_KEY
    || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase credentials missing (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_KEY) {
    if (!DRY_RUN) {
      throw new Error('Live-Run braucht SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY (Anon-Key nur für --dry-run)');
    }
    console.warn('  ⚠ Anon-Key — Dry-Run kann durch RLS unvollständig sein');
  }
  return createClient(url, key);
}

function parentDir(filePath) {
  const idx = filePath.lastIndexOf('/');
  return idx > 0 ? filePath.slice(0, idx) : '/';
}

function remapPath(filePath) {
  if (!filePath) return filePath;
  if (filePath === DROPBOX_FROM || filePath.startsWith(`${DROPBOX_FROM}/`)) {
    return DROPBOX_TO + filePath.slice(DROPBOX_FROM.length);
  }
  return filePath;
}

async function createSharedLink(token, dropboxPath) {
  try {
    const resp = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dropboxPath, settings: { requested_visibility: 'public' } }),
    });
    if (resp.ok) {
      const data = await resp.json();
      return data.url || null;
    }
    if (resp.status === 409) {
      const listResp = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: dropboxPath, direct_only: true }),
      });
      if (listResp.ok) {
        const data = await listResp.json();
        return data.links?.[0]?.url || null;
      }
    }
    console.warn(`  createSharedLink failed (${resp.status}) for ${dropboxPath}`);
    return null;
  } catch (err) {
    console.warn(`  createSharedLink failed for ${dropboxPath}:`, err.message);
    return null;
  }
}

async function dropboxMove(token, fromPath, toPath) {
  const resp = await fetch('https://api.dropboxapi.com/2/files/move_v2', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from_path: fromPath, to_path: toPath, autorename: false }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 409 && text.includes('not_found')) {
      return { status: 'source_missing', fromPath, toPath };
    }
    if (resp.status === 409 && text.includes('conflict')) {
      return { status: 'target_exists', fromPath, toPath };
    }
    throw new Error(`Dropbox move failed (${fromPath} → ${toPath}): ${resp.status} ${text}`);
  }
  const data = await resp.json();
  return { status: 'moved', fromPath, toPath: data.metadata?.path_display || toPath };
}

async function loadState(sb) {
  const { data: koop, error: koopErr } = await sb
    .from('kooperationen')
    .select('id, name, kampagne_id, status, videoanzahl')
    .eq('id', KOOP_ID)
    .maybeSingle();
  if (koopErr) throw new Error(`Load koop failed: ${koopErr.message}`);

  const { data: stayKoop, error: stayErr } = await sb
    .from('kooperationen')
    .select('id, name, kampagne_id, status')
    .eq('id', STAY_KOOP_ID)
    .maybeSingle();
  if (stayErr) throw new Error(`Load stay-koop failed: ${stayErr.message}`);

  const { data: vertrag, error: vErr } = await sb
    .from('vertraege')
    .select('id, name, kampagne_id, kooperation_id, datei_path, datei_url, dropbox_file_path, dropbox_file_url')
    .eq('id', VERTRAG_ID)
    .maybeSingle();
  if (vErr) throw new Error(`Load vertrag failed: ${vErr.message}`);

  const { count: videoCount, error: vidErr } = await sb
    .from('kooperation_videos')
    .select('id', { count: 'exact', head: true })
    .eq('kooperation_id', KOOP_ID);
  if (vidErr) throw new Error(`Count videos failed: ${vidErr.message}`);

  const { data: stayRechnung, error: rErr } = await sb
    .from('rechnung')
    .select('id, kampagne_id, kooperation_id, status')
    .eq('id', STAY_RECHNUNG_ID)
    .maybeSingle();
  if (rErr) throw new Error(`Load stay-rechnung failed: ${rErr.message}`);

  return { koop, stayKoop, vertrag, videoCount: videoCount ?? 0, stayRechnung };
}

function logState(label, state) {
  console.log(`\n=== ${label} ===`);
  console.log(`  koop ${state.koop?.id}: name="${state.koop?.name}" kampagne=${state.koop?.kampagne_id} status=${state.koop?.status} videos=${state.videoCount}`);
  console.log(`  stay-koop ${state.stayKoop?.id}: name="${state.stayKoop?.name}" kampagne=${state.stayKoop?.kampagne_id} status=${state.stayKoop?.status}`);
  console.log(`  vertrag ${state.vertrag?.id}: name="${state.vertrag?.name}" kampagne=${state.vertrag?.kampagne_id}`);
  console.log(`    datei_path: ${state.vertrag?.datei_path || '—'}`);
  console.log(`    dropbox_file_path: ${state.vertrag?.dropbox_file_path || '—'}`);
  console.log(`  stay-rechnung ${state.stayRechnung?.id}: kampagne=${state.stayRechnung?.kampagne_id} koop=${state.stayRechnung?.kooperation_id} status=${state.stayRechnung?.status}`);
}

async function runDbMigration(sb, state) {
  console.log('\n=== DB Migration ===');

  if (!state.koop) throw new Error(`Kooperation ${KOOP_ID} not found`);
  if (state.koop.kampagne_id !== SOURCE_KAMPAGNE_ID && state.koop.kampagne_id !== TARGET_KAMPAGNE_ID) {
    throw new Error(`Koop sits on unexpected kampagne ${state.koop.kampagne_id}`);
  }
  if (!state.vertrag) throw new Error(`Vertrag ${VERTRAG_ID} not found`);
  if (state.vertrag.kooperation_id !== KOOP_ID) {
    throw new Error(`Vertrag is not linked to the 7/7 koop`);
  }

  console.log(`  kooperationen: "${state.koop.name}" → "${NEW_KOOP_NAME}" / kampagne_id=${TARGET_KAMPAGNE_ID}`);
  console.log(`  vertraege: "${state.vertrag.name}" → "${NEW_VERTRAG_NAME}" / kampagne_id=${TARGET_KAMPAGNE_ID}`);

  if (DRY_RUN) return;

  const { error: koopErr } = await sb.from('kooperationen').update({
    kampagne_id: TARGET_KAMPAGNE_ID,
    name: NEW_KOOP_NAME,
  }).eq('id', KOOP_ID);
  if (koopErr) throw new Error(`kooperationen update failed: ${koopErr.message}`);

  const { error: vErr } = await sb.from('vertraege').update({
    kampagne_id: TARGET_KAMPAGNE_ID,
    name: NEW_VERTRAG_NAME,
  }).eq('id', VERTRAG_ID);
  if (vErr) throw new Error(`vertraege update failed: ${vErr.message}`);

  console.log('  DB update ✓');
}

async function runDropboxMigration(sb, state) {
  console.log('\n=== Dropbox Migration ===');
  console.log(`  ${DROPBOX_FROM}`);
  console.log(`  → ${DROPBOX_TO}`);

  const pathFields = [
    { field: 'datei_path', urlField: 'datei_url' },
    { field: 'dropbox_file_path', urlField: 'dropbox_file_url' },
  ];

  if (DRY_RUN) {
    for (const { field } of pathFields) {
      const oldPath = state.vertrag?.[field];
      if (!oldPath) continue;
      console.log(`  [dry-run] ${field}:`);
      console.log(`    ${oldPath}`);
      console.log(`    → ${remapPath(oldPath)}`);
    }
    return { status: 'dry-run' };
  }

  const token = await getAccessToken();
  await ensureFolder(token, parentDir(DROPBOX_TO));
  const result = await dropboxMove(token, DROPBOX_FROM, DROPBOX_TO);
  console.log(`  folder move: ${result.status}`);

  if (result.status === 'source_missing') {
    console.warn('  Source folder missing — remapping DB paths anyway if they still match the old prefix');
  } else if (result.status === 'target_exists') {
    console.warn('  Target folder already exists — remapping DB paths onto the target prefix');
  }

  const updatePayload = {};
  for (const { field, urlField } of pathFields) {
    const oldPath = state.vertrag?.[field];
    if (!oldPath) continue;
    const newPath = remapPath(oldPath);
    if (newPath === oldPath) {
      console.log(`  SKIP (no remap): ${field}=${oldPath}`);
      continue;
    }
    updatePayload[field] = newPath;
    const newUrl = await createSharedLink(token, newPath);
    if (newUrl) updatePayload[urlField] = newUrl;
    console.log(`  ${field}: ${oldPath}`);
    console.log(`    → ${newPath}${newUrl ? ' (link refreshed)' : ''}`);
  }

  if (Object.keys(updatePayload).length) {
    const { error } = await sb.from('vertraege').update(updatePayload).eq('id', VERTRAG_ID);
    if (error) throw new Error(`Vertrag path update failed: ${error.message}`);
  }

  return result;
}

async function validate(sb) {
  console.log('\n=== Validation ===');
  const state = await loadState(sb);
  logState('After', state);
  let ok = true;

  const checks = [
    ['koop on target', state.koop?.kampagne_id === TARGET_KAMPAGNE_ID],
    ['koop name 4/17', state.koop?.name === NEW_KOOP_NAME],
    ['6 videos still on koop', state.videoCount === 6],
    ['vertrag on target', state.vertrag?.kampagne_id === TARGET_KAMPAGNE_ID],
    ['vertrag name Renewal', state.vertrag?.name === NEW_VERTRAG_NAME],
    ['vertrag still on 7/7 koop', state.vertrag?.kooperation_id === KOOP_ID],
    ['stay-koop still on source', state.stayKoop?.kampagne_id === SOURCE_KAMPAGNE_ID],
    ['stay-rechnung still on source', state.stayRechnung?.kampagne_id === SOURCE_KAMPAGNE_ID],
    ['stay-rechnung still on 4/2', state.stayRechnung?.kooperation_id === STAY_KOOP_ID],
  ];

  if (!DB_ONLY) {
    const dateiOk = !state.vertrag?.datei_path || state.vertrag.datei_path.startsWith(DROPBOX_TO);
    const dropboxOk = !state.vertrag?.dropbox_file_path || state.vertrag.dropbox_file_path.startsWith(DROPBOX_TO);
    checks.push(['datei_path on target folder', dateiOk]);
    checks.push(['dropbox_file_path on target folder', dropboxOk]);
  }

  for (const [label, passed] of checks) {
    console.log(`  ${passed ? '✓' : '✗'} ${label}`);
    if (!passed) ok = false;
  }

  return ok;
}

async function main() {
  loadEnvFile();
  const sb = getSupabase();

  console.log('Xenia-Celina Mayer 7/7 → DA Direkt - Q3 26 - KFZ - Renewal');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}${DB_ONLY ? ' (db-only)' : ''}${DROPBOX_ONLY ? ' (dropbox-only)' : ''}`);

  const before = await loadState(sb);
  logState('Before', before);

  if (!DROPBOX_ONLY) {
    await runDbMigration(sb, before);
  }

  if (!DB_ONLY) {
    const afterDb = DROPBOX_ONLY || DRY_RUN ? before : await loadState(sb);
    await runDropboxMigration(sb, afterDb);
  }

  if (DRY_RUN) {
    console.log('\nDry run complete — no changes made.');
    return;
  }

  const ok = await validate(sb);
  process.exit(ok ? 0 : 1);
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
