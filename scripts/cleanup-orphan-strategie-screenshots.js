#!/usr/bin/env node
/**
 * Einmalige Bereinigung: Screenshots im Bucket strategie-screenshots,
 * die von keinem strategie_items.screenshot_url mehr referenziert werden.
 *
 * Usage:
 *   node scripts/cleanup-orphan-strategie-screenshots.js --dry-run
 *   node scripts/cleanup-orphan-strategie-screenshots.js
 *
 * Env: SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const {
  SCREENSHOT_BUCKET,
  findUnreferencedScreenshotPaths
} = require('../netlify/functions/_shared/strategie-screenshot.js');

const REMOVE_CHUNK = 100;
const DRY_RUN = process.argv.includes('--dry-run');

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
  if (!url || !key) {
    throw new Error('Supabase credentials missing (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
  }
  return createClient(url, key);
}

async function listBucketNames(supabase) {
  const { data, error } = await supabase
    .schema('storage')
    .from('objects')
    .select('name')
    .eq('bucket_id', SCREENSHOT_BUCKET);

  if (error) throw new Error(`storage.objects: ${error.message}`);
  return (data || []).map((row) => row.name).filter(Boolean);
}

async function listReferencedUrls(supabase) {
  const { data, error } = await supabase
    .from('strategie_items')
    .select('screenshot_url')
    .not('screenshot_url', 'is', null);

  if (error) throw new Error(`strategie_items: ${error.message}`);
  return (data || []).map((row) => row.screenshot_url).filter(Boolean);
}

async function removePaths(supabase, paths) {
  let removed = 0;
  for (let i = 0; i < paths.length; i += REMOVE_CHUNK) {
    const chunk = paths.slice(i, i + REMOVE_CHUNK);
    const { error } = await supabase.storage.from(SCREENSHOT_BUCKET).remove(chunk);
    if (error) throw new Error(`storage.remove: ${error.message}`);
    removed += chunk.length;
  }
  return removed;
}

async function main() {
  loadEnvFile();
  const supabase = getSupabase();

  const [objectNames, referencedUrls] = await Promise.all([
    listBucketNames(supabase),
    listReferencedUrls(supabase)
  ]);

  const orphans = findUnreferencedScreenshotPaths(objectNames, referencedUrls);

  console.log(`Bucket: ${objectNames.length} Dateien`);
  console.log(`Referenziert: ${referencedUrls.length} URLs`);
  console.log(`Orphans: ${orphans.length}`);

  if (orphans.length === 0) {
    console.log('Nichts zu tun.');
    return;
  }

  if (DRY_RUN) {
    for (const name of orphans.slice(0, 20)) console.log(`  ${name}`);
    if (orphans.length > 20) console.log(`  … +${orphans.length - 20} weitere`);
    console.log('Dry-run. Ohne --dry-run werden die Dateien geloescht.');
    return;
  }

  const removed = await removePaths(supabase, orphans);
  console.log(`Geloescht: ${removed}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = { listBucketNames, listReferencedUrls, removePaths };
