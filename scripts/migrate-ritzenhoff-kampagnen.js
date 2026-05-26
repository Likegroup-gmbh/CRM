#!/usr/bin/env node
/**
 * Einmalige Migration: Ritzenhoff Kampagnen 2–4 → Kampagne 1 (Februar)
 *
 * Ziel-Kampagne: "RITZENHOFF: Feb - Jul - 2026" (6b05b54b, bisher "Ritzenhoff - 2/6")
 * Quellen:       Ritzenhoff - 4/6, 5/6, 6/6  (Kampagnen 2, 3, 4)
 * Unberührt:     Ritzenhoff - 3/6 (Influencer Kampagne Niederlande)
 *
 * Usage:
 *   node scripts/migrate-ritzenhoff-kampagnen.js --dry-run
 *   node scripts/migrate-ritzenhoff-kampagnen.js
 *   node scripts/migrate-ritzenhoff-kampagnen.js --db-only
 *   node scripts/migrate-ritzenhoff-kampagnen.js --dropbox-only
 *
 * Env: SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY,
 *      DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, DROPBOX_APP_SECRET
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { getAccessToken, ensureFolder } = require('../netlify/functions/_shared/dropbox');

// --- Config ---
const TARGET_KAMPAGNE_ID = '6b05b54b-1be0-485e-8747-c2c6a98d9a54';
const TARGET_AUFTRAG_ID = 'f32e3bc7-68d1-432c-9f9b-3d1b52dc1b34';
const TARGET_NAME = 'RITZENHOFF: Feb - Jul - 2026';

const SOURCES = [
  {
    id: '18ad362e-eeac-4cd2-8a52-bb9c4936ef27',
    label: 'Ritzenhoff - 4/6 (Kampagne 2 März)',
    heritageTag: 'RITZENHOFF - Kampagne 2 - März',
  },
  {
    id: '991d902f-242b-4d71-bec2-601578b9756b',
    label: 'Ritzenhoff - 5/6 (Kampagne 3 April)',
    heritageTag: 'RITZENHOFF - Kampagne 3 April',
  },
  {
    id: 'e8cc151b-4140-4a79-bc96-4bacf9924d79',
    label: 'Ritzenhoff - 6/6 (Kampagne 4 Mai)',
    heritageTag: 'Ritzenhoff Kamapge 4 Mai',
  },
];

const TARGET_HERITAGE_TAG = 'RITZENHOFF - Kampagne 1 - Februar';

const SOURCE_IDS = SOURCES.map(s => s.id);

const PATH_REPLACEMENTS = [
  ['Ritzenhoff - 4-6', TARGET_NAME],
  ['Ritzenhoff - 5-6', TARGET_NAME],
  ['RITZENHOFF - Kampagne 3 April', TARGET_NAME],
  ['Ritzenhoff Kampagne 3 April', TARGET_NAME],
  ['Ritzenhoff Kamapge 4 Mai', TARGET_NAME],
];

const SOURCE_DROPBOX_FOLDER_CANDIDATES = [
  '/Ritzenhoff Cristal GmbH/Ritzenhoff - 4-6',
  '/Ritzenhoff Cristal GmbH/Ritzenhoff - 5-6',
  '/Ritzenhoff Cristal GmbH/Ritzenhoff Kamapge 4 Mai',
  '/Vertraege/Ritzenhoff Cristal GmbH/RITZENHOFF - Kampagne 3 April',
  '/Vertraege/Ritzenhoff Cristal GmbH/Ritzenhoff Kampagne 3 April',
  '/Vertraege/Ritzenhoff Cristal GmbH/Ritzenhoff - 4-6',
  '/Vertraege/Ritzenhoff Cristal GmbH/Ritzenhoff - 5-6',
];

const KAMPAGNE_ID_TABLES = [
  'kooperationen',
  'strategie',
  'vertraege',
  'rechnung',
  'briefings',
  'creator_auswahl',
  'kampagne_plattformen',
  'kampagne_formate',
  'kampagne_organic_ziele',
  'kampagne_paid_ziele',
  'kampagne_mitarbeiter',
  'kampagne_creator',
  'kampagne_creator_sourcing',
  'kampagne_creator_favoriten',
  'kooperation_tasks',
  'auftrag_kampagnenart_blocks',
  'ansprechpartner_kampagne',
];

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const DB_ONLY = args.includes('--db-only');
const DROPBOX_ONLY = args.includes('--dropbox-only');

// koopId → heritageTag mapping (filled during migration)
const koopTagMap = new Map();
let targetKoopIds = [];

function loadEnvFile() {
  const candidates = ['.env.local', '.env'];
  for (const name of candidates) {
    const envPath = path.join(__dirname, '..', name);
    if (!fs.existsSync(envPath)) continue;
    loadEnvFromPath(envPath);
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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Supabase credentials missing (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
  return createClient(url, key);
}

function remapPath(filePath) {
  if (!filePath) return filePath;
  let result = filePath;
  for (const [from, to] of PATH_REPLACEMENTS) {
    result = result.split(from).join(to);
  }
  return result;
}

function parentDir(filePath) {
  const idx = filePath.lastIndexOf('/');
  return idx > 0 ? filePath.slice(0, idx) : '/';
}

function isDropboxPath(p) {
  return typeof p === 'string' && p.startsWith('/');
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
      return data.url?.replace('?dl=0', '?raw=1') || null;
    }
    if (resp.status === 409) {
      const listResp = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: dropboxPath, direct_only: true }),
      });
      if (listResp.ok) {
        const data = await listResp.json();
        return data.links?.[0]?.url?.replace('?dl=0', '?raw=1') || null;
      }
    }
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
    body: JSON.stringify({ from_path: fromPath, to_path: toPath, autorename: true }),
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

async function dropboxDeleteFolder(token, folderPath) {
  const resp = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: folderPath }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 409 && text.includes('not_found')) {
      return { status: 'already_gone', path: folderPath };
    }
    throw new Error(`Dropbox delete failed (${folderPath}): ${resp.status} ${text}`);
  }
  return { status: 'deleted', path: folderPath };
}

async function migrateJunctionForSource(sb, sourceId, { name, fk, extraMatchKeys = [] }) {
  const selectCols = ['id', fk, ...extraMatchKeys].join(', ');
  const { data: srcRows } = await sb.from(name).select(selectCols).eq('kampagne_id', sourceId);
  const { data: tgtRows } = await sb.from(name).select(selectCols).eq('kampagne_id', TARGET_KAMPAGNE_ID);

  const tgtKeys = new Set(
    (tgtRows || []).map(r => {
      const parts = [r[fk], ...extraMatchKeys.map(k => r[k])];
      return parts.join('\0');
    })
  );

  console.log(`    ${name}: ${(srcRows || []).length} row(s) (junction)`);
  if (DRY_RUN || !(srcRows || []).length) return;

  for (const row of srcRows) {
    const key = [row[fk], ...extraMatchKeys.map(k => row[k])].join('\0');
    if (tgtKeys.has(key)) {
      const del = sb.from(name).delete().eq('kampagne_id', sourceId).eq(fk, row[fk]);
      for (const ek of extraMatchKeys) {
        del.eq(ek, row[ek]);
      }
      const { error } = await del;
      if (error) throw new Error(`${name} duplicate delete failed: ${error.message}`);
    } else {
      const { error } = await sb.from(name).update({ kampagne_id: TARGET_KAMPAGNE_ID }).eq('id', row.id);
      if (error) throw new Error(`${name} update failed: ${error.message}`);
      tgtKeys.add(key);
    }
  }
}

async function migrateAnsprechpartnerForSource(sb, sourceId) {
  const { data: srcAp } = await sb.from('ansprechpartner_kampagne').select('ansprechpartner_id').eq('kampagne_id', sourceId);
  const { data: tgtAp } = await sb.from('ansprechpartner_kampagne').select('ansprechpartner_id').eq('kampagne_id', TARGET_KAMPAGNE_ID);
  const tgtApIds = new Set((tgtAp || []).map(r => r.ansprechpartner_id));
  console.log(`    ansprechpartner_kampagne: ${(srcAp || []).length} row(s)`);
  if (DRY_RUN) return;

  for (const row of srcAp || []) {
    if (tgtApIds.has(row.ansprechpartner_id)) {
      const { error } = await sb.from('ansprechpartner_kampagne').delete()
        .eq('kampagne_id', sourceId)
        .eq('ansprechpartner_id', row.ansprechpartner_id);
      if (error) throw new Error(`ansprechpartner delete failed: ${error.message}`);
    } else {
      const { error } = await sb.from('ansprechpartner_kampagne').update({ kampagne_id: TARGET_KAMPAGNE_ID })
        .eq('kampagne_id', sourceId)
        .eq('ansprechpartner_id', row.ansprechpartner_id);
      if (error) throw new Error(`ansprechpartner update failed: ${error.message}`);
      tgtApIds.add(row.ansprechpartner_id);
    }
  }
}

async function assignHeritageTags(sb) {
  console.log('\n=== Heritage Tags ===');

  const allTagNames = [
    TARGET_HERITAGE_TAG,
    ...SOURCES.map(s => s.heritageTag),
  ];

  for (const tagName of allTagNames) {
    if (DRY_RUN) {
      console.log(`  [dry-run] upsert tag type "${tagName}"`);
      continue;
    }
    const { data: existing } = await sb.from('kooperation_tag_typen').select('id').eq('name', tagName).maybeSingle();
    if (!existing) {
      const { error } = await sb.from('kooperation_tag_typen').insert({ name: tagName });
      if (error && !error.message.includes('duplicate')) throw new Error(`Tag insert failed: ${error.message}`);
      console.log(`  Created tag type: "${tagName}"`);
    } else {
      console.log(`  Tag type exists: "${tagName}"`);
    }
  }

  // Tag existing target koops with Kampagne 1 tag
  if (targetKoopIds.length) {
    console.log(`  ${targetKoopIds.length} bestehende Ziel-Kooperation(en) → "${TARGET_HERITAGE_TAG}"`);
    if (!DRY_RUN) {
      const { data: tagRow } = await sb.from('kooperation_tag_typen').select('id').eq('name', TARGET_HERITAGE_TAG).maybeSingle();
      if (tagRow) {
        for (const koopId of targetKoopIds) {
          const { error } = await sb.from('kooperation_tags').upsert(
            { kooperation_id: koopId, tag_id: tagRow.id },
            { onConflict: 'kooperation_id,tag_id', ignoreDuplicates: true }
          );
          if (error) throw new Error(`Tag assign failed (${koopId}, ${TARGET_HERITAGE_TAG}): ${error.message}`);
        }
      }
    }
  }

  // Tag migrated koops with their source heritage tag
  for (const [koopId, tagName] of koopTagMap.entries()) {
    if (DRY_RUN) continue;
    const { data: tagRow } = await sb.from('kooperation_tag_typen').select('id').eq('name', tagName).maybeSingle();
    if (!tagRow) continue;
    const { error } = await sb.from('kooperation_tags').upsert(
      { kooperation_id: koopId, tag_id: tagRow.id },
      { onConflict: 'kooperation_id,tag_id', ignoreDuplicates: true }
    );
    if (error) throw new Error(`Tag assign failed (${koopId}, ${tagName}): ${error.message}`);
  }

  console.log(`  ${koopTagMap.size} migrierte Kooperation(en) getaggt`);
  console.log('  Tags zugewiesen ✓');
}

async function renameTargetKampagne(sb) {
  console.log('\n=== Rename Target ===');
  console.log(`  "${TARGET_NAME}"`);
  if (DRY_RUN) return;

  const { error } = await sb.from('kampagne').update({
    kampagnenname: TARGET_NAME,
    eigener_name: TARGET_NAME,
  }).eq('id', TARGET_KAMPAGNE_ID);
  if (error) throw new Error(`Rename failed: ${error.message}`);
  console.log('  ✓ renamed');
}

async function runDbMigration(sb) {
  console.log('\n=== DB Migration ===');

  // Collect existing target koops before migration
  const { data: existingKoops } = await sb.from('kooperationen').select('id').eq('kampagne_id', TARGET_KAMPAGNE_ID);
  targetKoopIds = (existingKoops || []).map(k => k.id);
  console.log(`  Existing target koops: ${targetKoopIds.length}`);

  for (const source of SOURCES) {
    console.log(`\n  --- ${source.label} (${source.id.slice(0, 8)}…) ---`);

    // Collect koops to migrate and map them to their heritage tag
    const { data: srcKoops } = await sb.from('kooperationen').select('id').eq('kampagne_id', source.id);
    for (const k of srcKoops || []) {
      koopTagMap.set(k.id, source.heritageTag);
    }
    console.log(`    Kooperationen: ${(srcKoops || []).length}`);

    const simpleTables = [
      { name: 'kooperationen', extra: null },
      { name: 'strategie', extra: null },
      { name: 'vertraege', extra: null },
      { name: 'rechnung', extra: null },
      { name: 'briefings', extra: null },
      { name: 'creator_auswahl', extra: null },
      { name: 'kampagne_creator', extra: null },
      { name: 'kampagne_creator_sourcing', extra: null },
      { name: 'kampagne_creator_favoriten', extra: null },
      { name: 'kooperation_tasks', extra: null },
      { name: 'auftrag_kampagnenart_blocks', extra: null },
    ];

    for (const { name, extra } of simpleTables) {
      const { count } = await sb.from(name).select('id', { count: 'exact', head: true }).eq('kampagne_id', source.id);
      const updatePayload = { kampagne_id: TARGET_KAMPAGNE_ID, ...extra };
      console.log(`    ${name}: ${count ?? 0} row(s)`);

      if (DRY_RUN || (count ?? 0) === 0) continue;
      const { error } = await sb.from(name).update(updatePayload).eq('kampagne_id', source.id);
      if (error) throw new Error(`DB update ${name} failed: ${error.message}`);
    }

    const junctionTables = [
      { name: 'kampagne_plattformen', fk: 'plattform_id' },
      { name: 'kampagne_formate', fk: 'format_id' },
      { name: 'kampagne_organic_ziele', fk: 'ziel_id' },
      { name: 'kampagne_paid_ziele', fk: 'ziel_id' },
      { name: 'kampagne_mitarbeiter', fk: 'mitarbeiter_id', extraMatchKeys: ['role'] },
    ];

    for (const junction of junctionTables) {
      await migrateJunctionForSource(sb, source.id, junction);
    }

    await migrateAnsprechpartnerForSource(sb, source.id);
  }

  await renameTargetKampagne(sb);
  await assignHeritageTags(sb);
}

function addFileEntry(files, seen, entry) {
  if (!entry.oldPath || !isDropboxPath(entry.oldPath) || seen.has(entry.oldPath)) return;
  seen.add(entry.oldPath);
  files.push(entry);
}

async function collectDropboxFiles(sb) {
  const { data: koops } = await sb.from('kooperationen').select('id').eq('kampagne_id', TARGET_KAMPAGNE_ID);
  const koopIds = (koops || []).map(k => k.id);
  const files = [];
  const seen = new Set();

  if (koopIds.length) {
    const { data: vertraegeKoop } = await sb
      .from('vertraege')
      .select('id, dropbox_file_path, dropbox_file_url')
      .in('kooperation_id', koopIds)
      .not('dropbox_file_path', 'is', null);
    for (const v of vertraegeKoop || []) {
      addFileEntry(files, seen, {
        table: 'vertraege', id: v.id, pathField: 'dropbox_file_path', urlField: 'dropbox_file_url', oldPath: v.dropbox_file_path,
      });
    }

    const { data: rechnungen } = await sb.from('rechnung').select('id').in('kooperation_id', koopIds);
    const rechnungIds = (rechnungen || []).map(r => r.id);
    if (rechnungIds.length) {
      const { data: pdfs } = await sb
        .from('rechnung_pdfs')
        .select('id, file_path, file_url')
        .in('rechnung_id', rechnungIds)
        .not('file_path', 'is', null);
      for (const p of pdfs || []) {
        addFileEntry(files, seen, {
          table: 'rechnung_pdfs', id: p.id, pathField: 'file_path', urlField: 'file_url', oldPath: p.file_path,
        });
      }
    }

    const { data: videos } = await sb.from('kooperation_videos').select('id, folder_url, story_folder_url').in('kooperation_id', koopIds);
    const videoIds = (videos || []).map(v => v.id);
    for (const v of videos || []) {
      for (const [pathField] of [['folder_url'], ['story_folder_url']]) {
        if (isDropboxPath(v[pathField])) {
          addFileEntry(files, seen, {
            table: 'kooperation_videos', id: v.id, pathField, urlField: null, oldPath: v[pathField],
          });
        }
      }
    }

    if (videoIds.length) {
      const { data: assets } = await sb
        .from('kooperation_video_asset')
        .select('id, file_path, file_url')
        .in('video_id', videoIds)
        .not('file_path', 'is', null);
      for (const a of assets || []) {
        addFileEntry(files, seen, {
          table: 'kooperation_video_asset', id: a.id, pathField: 'file_path', urlField: 'file_url', oldPath: a.file_path,
        });
      }
    }
  }

  const { data: vertraegeKamp } = await sb
    .from('vertraege')
    .select('id, dropbox_file_path, dropbox_file_url')
    .eq('kampagne_id', TARGET_KAMPAGNE_ID)
    .not('dropbox_file_path', 'is', null);
  for (const v of vertraegeKamp || []) {
    addFileEntry(files, seen, {
      table: 'vertraege', id: v.id, pathField: 'dropbox_file_path', urlField: 'dropbox_file_url', oldPath: v.dropbox_file_path,
    });
  }

  return files;
}

async function runDropboxMigration(sb) {
  console.log('\n=== Dropbox Migration ===');
  const files = await collectDropboxFiles(sb);
  console.log(`  ${files.length} unique file path(s) to process`);

  if (!files.length) return { moved: 0, skipped: 0, errors: [] };

  const token = await getAccessToken();
  let moved = 0;
  let skipped = 0;
  const errors = [];

  for (const file of files) {
    const newPath = remapPath(file.oldPath);
    if (newPath === file.oldPath) {
      console.log(`  SKIP (no remap): ${file.oldPath}`);
      skipped++;
      continue;
    }

    console.log(`  ${file.table}/${file.id}:`);
    console.log(`    ${file.oldPath}`);
    console.log(`    → ${newPath}`);

    if (DRY_RUN) continue;

    try {
      await ensureFolder(token, parentDir(newPath));
      const result = await dropboxMove(token, file.oldPath, newPath);
      console.log(`    status: ${result.status}`);

      if (result.status === 'source_missing') {
        skipped++;
        continue;
      }

      const finalPath = result.toPath || newPath;
      const newUrl = file.urlField ? await createSharedLink(token, finalPath) : null;

      const updatePayload = { [file.pathField]: finalPath };
      if (newUrl && file.urlField) updatePayload[file.urlField] = newUrl;

      const { error } = await sb.from(file.table).update(updatePayload).eq('id', file.id);
      if (error) throw new Error(`DB path update failed: ${error.message}`);

      const { data: siblings } = await sb.from(file.table).select('id').eq(file.pathField, file.oldPath);
      for (const s of siblings || []) {
        if (s.id === file.id) continue;
        await sb.from(file.table).update(updatePayload).eq('id', s.id);
      }

      moved++;
    } catch (err) {
      console.error(`    ERROR: ${err.message}`);
      errors.push({ file, error: err.message });
    }
  }

  return { moved, skipped, errors };
}

async function countOnKampagne(sb, table, kampagneId) {
  const { count, error } = await sb.from(table).select('id', { count: 'exact', head: true }).eq('kampagne_id', kampagneId);
  if (error) throw error;
  return count ?? 0;
}

async function validate(sb) {
  console.log('\n=== Validation ===');
  let allOk = true;

  for (const source of SOURCES) {
    console.log(`\n  Source: ${source.label}`);
    for (const table of KAMPAGNE_ID_TABLES) {
      const srcCount = await countOnKampagne(sb, table, source.id);
      const ok = srcCount === 0;
      console.log(`    ${ok ? '✓' : '✗'} ${table}: ${srcCount} (expected 0)`);
      if (!ok) allOk = false;
    }
  }

  console.log('\n  Target counts:');
  const targetChecks = [
    { label: 'kooperationen', table: 'kooperationen', expected: 24 },
    { label: 'vertraege', table: 'vertraege', expected: 24 },
    { label: 'rechnung', table: 'rechnung', expected: 17 },
    { label: 'strategie', table: 'strategie', expected: 4 },
  ];

  for (const c of targetChecks) {
    const count = await countOnKampagne(sb, c.table, TARGET_KAMPAGNE_ID);
    const ok = count === c.expected;
    console.log(`    ${ok ? '✓' : '✗'} ${c.label}: ${count} (expected ${c.expected})`);
    if (!ok) allOk = false;
  }

  // Verify rechnung.auftrag_id
  const { data: rechnungen } = await sb.from('rechnung').select('rechnung_nr, auftrag_id').eq('kampagne_id', TARGET_KAMPAGNE_ID);
  for (const r of rechnungen || []) {
    const ok = r.auftrag_id === TARGET_AUFTRAG_ID;
    console.log(`    ${ok ? '✓' : '✗'} rechnung "${r.rechnung_nr}" auftrag_id=${r.auftrag_id?.slice(0, 8)}…`);
    if (!ok) allOk = false;
  }

  // Verify Niederlande untouched
  const NL_ID = 'b608539f-33f5-4caf-9102-08d582b7c4c4';
  const nlKoops = await countOnKampagne(sb, 'kooperationen', NL_ID);
  const nlVertraege = await countOnKampagne(sb, 'vertraege', NL_ID);
  const nlRechnung = await countOnKampagne(sb, 'rechnung', NL_ID);
  console.log(`\n  Niederlande (unberührt):`);
  console.log(`    ${nlKoops === 2 ? '✓' : '✗'} kooperationen: ${nlKoops} (expected 2)`);
  console.log(`    ${nlVertraege === 3 ? '✓' : '✗'} vertraege: ${nlVertraege} (expected 3)`);
  console.log(`    ${nlRechnung === 1 ? '✓' : '✗'} rechnung: ${nlRechnung} (expected 1)`);
  if (nlKoops !== 2 || nlVertraege !== 3 || nlRechnung !== 1) allOk = false;

  // Verify heritage tags
  console.log('\n  Heritage Tags:');
  const allKoopIds = [...koopTagMap.keys(), ...targetKoopIds];
  if (allKoopIds.length) {
    const { data: tagCheck } = await sb
      .from('kooperationen')
      .select('id, name, kooperation_tags(kooperation_tag_typen(name))')
      .in('id', allKoopIds);
    let taggedOk = 0;
    let taggedFail = 0;
    for (const k of tagCheck || []) {
      const tags = (k.kooperation_tags || []).map(t => t.kooperation_tag_typen?.name).filter(Boolean);
      const expectedTag = koopTagMap.get(k.id) || TARGET_HERITAGE_TAG;
      const hasTag = tags.includes(expectedTag);
      if (hasTag) { taggedOk++; } else { taggedFail++; allOk = false; }
      if (!hasTag) console.log(`    ✗ ${k.name}: missing "${expectedTag}" (has: [${tags.join(', ')}])`);
    }
    console.log(`    ${taggedOk} ok, ${taggedFail} missing`);
  }

  // Check source kampagne rows
  for (const source of SOURCES) {
    const { data: srcK } = await sb.from('kampagne').select('id').eq('id', source.id).maybeSingle();
    if (srcK) {
      console.log(`  ℹ ${source.label} still exists (delete step follows)`);
    } else {
      console.log(`  ✓ ${source.label} deleted`);
    }
  }

  return allOk;
}

async function deleteSourceKampagnen(sb) {
  console.log('\n=== Delete Source Kampagnen ===');

  for (const source of SOURCES) {
    for (const table of KAMPAGNE_ID_TABLES) {
      const count = await countOnKampagne(sb, table, source.id);
      if (count > 0) {
        throw new Error(`Cannot delete ${source.label}: ${count} row(s) still in ${table}`);
      }
    }
  }

  if (DRY_RUN) {
    console.log('  [dry-run] would delete 3 kampagne rows + optional Dropbox folders');
    return;
  }

  for (const source of SOURCES) {
    const { error } = await sb.from('kampagne').delete().eq('id', source.id);
    if (error) throw new Error(`Delete ${source.label} failed: ${error.message}`);
    console.log(`  ✓ deleted ${source.label} (${source.id.slice(0, 8)}…)`);
  }

  try {
    const token = await getAccessToken();
    for (const folderPath of SOURCE_DROPBOX_FOLDER_CANDIDATES) {
      const result = await dropboxDeleteFolder(token, folderPath);
      console.log(`  Dropbox folder ${folderPath}: ${result.status}`);
    }
  } catch (err) {
    console.warn(`  Dropbox folder cleanup skipped: ${err.message}`);
  }
}

async function main() {
  loadEnvFile();
  const sb = getSupabase();

  console.log('Ritzenhoff Kampagne Migration: Kampagnen 2–4 → Kampagne 1');
  console.log(`  Target: ${TARGET_KAMPAGNE_ID} → "${TARGET_NAME}"`);
  for (const s of SOURCES) console.log(`  Source: ${s.id.slice(0, 8)}… (${s.label})`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}${DB_ONLY ? ' (db-only)' : ''}${DROPBOX_ONLY ? ' (dropbox-only)' : ''}`);

  if (!DROPBOX_ONLY) {
    await runDbMigration(sb);
  } else {
    // In dropbox-only mode, resolve koopIds from heritage tags
    for (const source of SOURCES) {
      const { data: tagRow } = await sb.from('kooperation_tag_typen').select('id').eq('name', source.heritageTag).maybeSingle();
      if (tagRow?.id) {
        const { data: tagged } = await sb.from('kooperation_tags').select('kooperation_id').eq('tag_id', tagRow.id);
        for (const t of tagged || []) koopTagMap.set(t.kooperation_id, source.heritageTag);
      }
    }
    const { data: targetTagRow } = await sb.from('kooperation_tag_typen').select('id').eq('name', TARGET_HERITAGE_TAG).maybeSingle();
    if (targetTagRow?.id) {
      const { data: tagged } = await sb.from('kooperation_tags').select('kooperation_id').eq('tag_id', targetTagRow.id);
      targetKoopIds = (tagged || []).map(t => t.kooperation_id);
    }
  }

  if (!DB_ONLY) {
    const dropboxResult = await runDropboxMigration(sb);
    if (dropboxResult?.errors?.length) {
      console.warn(`\n⚠ ${dropboxResult.errors.length} Dropbox error(s) — see log above`);
    }
  }

  if (DRY_RUN) {
    console.log('\nDry run complete — no changes made.');
    return;
  }

  const ok = await validate(sb);
  if (!ok) {
    console.error('\nValidation failed — source kampagnen NOT deleted.');
    process.exit(1);
  }

  const fullRun = !DB_ONLY && !DROPBOX_ONLY;
  if (fullRun) {
    await deleteSourceKampagnen(sb);
    const okAfterDelete = await validate(sb);
    process.exit(okAfterDelete ? 0 : 1);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
