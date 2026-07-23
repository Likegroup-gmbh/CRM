#!/usr/bin/env node
/**
 * Einmaliger Merge: Multilind_Flight 2 → Multilind_Flight 1 (Ziel),
 * Ziel wird umbenannt in "Multilind UGC 2026".
 *
 * - Alle kampagne_id-Referenzen der Quelle auf das Ziel umschreiben
 * - Ziel: eigener_name='Multilind UGC 2026', videoanzahl=18, creatoranzahl=5
 * - Herkunfts-Tags pro Kooperation (eigener_name der Ursprungskampagne, auch Ziel-Koops)
 * - Dropbox: Vertrags-PDFs und Rechnungs-PDFs physisch nach
 *   /Vertraege/STADA Arzneimittel AG/Multilind UGC 2026 verschieben, DB-Pfade + URLs updaten
 * - Validierung, danach Quellkampagne löschen + leere Alt-Ordner aufräumen
 *
 * Usage:
 *   node scripts/merge-multilind-flights.js --dry-run
 *   node scripts/merge-multilind-flights.js
 *   node scripts/merge-multilind-flights.js --db-only
 *   node scripts/merge-multilind-flights.js --dropbox-only
 *
 * Env: SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY,
 *      DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, DROPBOX_APP_SECRET
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { getAccessToken, ensureFolder, sanitizePath } = require('../netlify/functions/_shared/dropbox');

// --- Config ---
const TARGET_KAMPAGNE_ID = 'b47bed5b-0e5d-4a5d-8b16-246b1e127241'; // Multilind_Flight 1
const NEW_EIGENER_NAME = 'Multilind UGC 2026';
const NEW_VIDEOANZAHL = 18; // 9 + 9
const NEW_CREATORANZAHL = 5; // 3 + 2 Kooperationen

const TARGET_HERITAGE_TAG = 'Multilind_Flight 1';

const SOURCES = [
  {
    id: 'a82cc75e-7bfa-4b1e-a8bf-951ae2b75016',
    label: 'Multilind_Flight 2',
    heritageTag: 'Multilind_Flight 2',
  },
];

const ALL_KAMPAGNE_IDS = [TARGET_KAMPAGNE_ID, ...SOURCES.map(s => s.id)];

const TARGET_DROPBOX_BASE = '/Vertraege/STADA Arzneimittel AG/Multilind UGC 2026';

// Alte Kampagnen-Ordner, die nach dem Merge gelöscht werden — aber nur, wenn
// sie keine Dateien mehr enthalten (delete-if-empty, kein blindes Löschen).
const OLD_FOLDER_CANDIDATES = [
  '/Vertraege/STADA Arzneimittel AG/Multilind_Flight 1',
  '/Vertraege/STADA Arzneimittel AG/Multilind_Flight 2',
  '/STADA Arzneimittel AG/Multilind/Multilind_Flight 1',
  '/STADA Arzneimittel AG/Multilind/Multilind_Flight 2',
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

const koopTagMap = new Map(); // koopId -> heritage tag name

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

function isDropboxPath(p) {
  return typeof p === 'string' && p.startsWith('/');
}

function isShareLink(p) {
  return typeof p === 'string' && /^https:\/\/(www\.)?dropbox\.com\//.test(p);
}

function fileName(p) {
  const idx = p.lastIndexOf('/');
  return idx >= 0 ? p.slice(idx + 1) : p;
}

function parentDir(filePath) {
  const idx = filePath.lastIndexOf('/');
  return idx > 0 ? filePath.slice(0, idx) : '/';
}

// --- Dropbox API helpers ---

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

async function resolveSharedLink(token, url) {
  const resp = await fetch('https://api.dropboxapi.com/2/sharing/get_shared_link_metadata', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    console.warn(`  resolveSharedLink failed (${resp.status}): ${text.slice(0, 200)}`);
    return null;
  }
  const data = await resp.json();
  return { path: data.path_lower || null, name: data.name || null, tag: data['.tag'] || null };
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

async function folderHasFiles(token, folderPath) {
  let cursor = null;
  let first = true;
  while (first || cursor) {
    const endpoint = first
      ? 'https://api.dropboxapi.com/2/files/list_folder'
      : 'https://api.dropboxapi.com/2/files/list_folder/continue';
    const body = first ? { path: folderPath, recursive: true, limit: 500 } : { cursor };
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text();
      if (resp.status === 409 && text.includes('not_found')) return { exists: false, hasFiles: false };
      throw new Error(`list_folder failed (${folderPath}): ${resp.status} ${text}`);
    }
    const data = await resp.json();
    if ((data.entries || []).some(e => e['.tag'] === 'file')) return { exists: true, hasFiles: true };
    cursor = data.has_more ? data.cursor : null;
    first = false;
  }
  return { exists: true, hasFiles: false };
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

// --- DB Merge ---

async function migrateJunctionForSource(sb, sourceId, { name, fk, extraMatchKeys = [] }) {
  const selectCols = ['id', fk, ...extraMatchKeys].join(', ');
  const { data: srcRows } = await sb.from(name).select(selectCols).eq('kampagne_id', sourceId);
  const { data: tgtRows } = await sb.from(name).select(selectCols).eq('kampagne_id', TARGET_KAMPAGNE_ID);

  const tgtKeys = new Set(
    (tgtRows || []).map(r => [r[fk], ...extraMatchKeys.map(k => r[k])].join('\0'))
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

async function runFullMigration(sb, source) {
  console.log(`\n  --- ${source.label} (${source.id.slice(0, 8)}…) ---`);

  const simpleTables = [
    'kooperationen',
    'strategie',
    'vertraege',
    'rechnung',
    'briefings',
    'creator_auswahl',
    'kampagne_creator',
    'kampagne_creator_sourcing',
    'kampagne_creator_favoriten',
    'kooperation_tasks',
    'auftrag_kampagnenart_blocks',
  ];

  for (const name of simpleTables) {
    const { count } = await sb.from(name).select('id', { count: 'exact', head: true }).eq('kampagne_id', source.id);
    console.log(`    ${name}: ${count ?? 0} row(s)`);

    if (DRY_RUN || (count ?? 0) === 0) continue;
    const { error } = await sb.from(name).update({ kampagne_id: TARGET_KAMPAGNE_ID }).eq('kampagne_id', source.id);
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

async function collectKoopTagMap(sb) {
  // Alle Koops aller 3 Kampagnen bekommen den Herkunfts-Tag ihrer Ursprungskampagne.
  // Muss VOR dem Merge laufen (danach hängen alle am Ziel). Bei --dropbox-only wird
  // die Zuordnung über bereits existierende Tags rekonstruiert.
  const heritageByKampagne = new Map([
    [TARGET_KAMPAGNE_ID, TARGET_HERITAGE_TAG],
    ...SOURCES.map(s => [s.id, s.heritageTag]),
  ]);
  const allHeritageTags = new Set(heritageByKampagne.values());

  // Idempotenz: Bei einem Re-Run hängen bereits gemergete Koops am Ziel und würden
  // fälschlich den Ziel-Tag bekommen. Bereits vorhandene Heritage-Tags haben Vorrang.
  const { data: existingTags } = await sb
    .from('kooperation_tags')
    .select('kooperation_id, kooperation_tag_typen(name)');
  const existingHeritage = new Map();
  for (const t of existingTags || []) {
    const name = t.kooperation_tag_typen?.name;
    if (name && allHeritageTags.has(name)) existingHeritage.set(t.kooperation_id, name);
  }

  for (const [kampagneId, tag] of heritageByKampagne.entries()) {
    const { data: koops } = await sb.from('kooperationen').select('id').eq('kampagne_id', kampagneId);
    for (const k of koops || []) {
      koopTagMap.set(k.id, existingHeritage.get(k.id) || tag);
    }
  }
  console.log(`  ${koopTagMap.size} Kooperation(en) für Herkunfts-Tags erfasst`);
}

async function renameTarget(sb) {
  console.log('\n=== Umbenennen + Zähler ===');
  console.log(`  eigener_name → "${NEW_EIGENER_NAME}", videoanzahl → ${NEW_VIDEOANZAHL}, creatoranzahl → ${NEW_CREATORANZAHL}`);
  if (DRY_RUN) return;
  const { error } = await sb.from('kampagne')
    .update({ eigener_name: NEW_EIGENER_NAME, videoanzahl: NEW_VIDEOANZAHL, creatoranzahl: NEW_CREATORANZAHL })
    .eq('id', TARGET_KAMPAGNE_ID);
  if (error) throw new Error(`Rename failed: ${error.message}`);
}

async function assignHeritageTags(sb) {
  console.log('\n=== Heritage Tags ===');

  const allTagNames = [...new Set([...koopTagMap.values()])];

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

  console.log(`  ${koopTagMap.size} Kooperation(en) für Tag-Zuweisung`);
  if (DRY_RUN) return;

  for (const [koopId, tagName] of koopTagMap.entries()) {
    const { data: tagRow } = await sb.from('kooperation_tag_typen').select('id').eq('name', tagName).maybeSingle();
    if (!tagRow) continue;
    const { error } = await sb.from('kooperation_tags').upsert(
      { kooperation_id: koopId, tag_id: tagRow.id },
      { onConflict: 'kooperation_id,tag_id', ignoreDuplicates: true }
    );
    if (error) throw new Error(`Tag assign failed (${koopId}, ${tagName}): ${error.message}`);
  }

  console.log('  Tags zugewiesen ✓');
}

async function runDbMigration(sb) {
  console.log('\n=== DB Migration ===');
  await collectKoopTagMap(sb);
  for (const source of SOURCES) {
    await runFullMigration(sb, source);
  }
  await renameTarget(sb);
  await assignHeritageTags(sb);
}

// --- Dropbox ---

async function getKoopCreatorFolders(sb) {
  // koopId -> sanitized "Vorname Nachname" (Ordnername im Zielordner)
  const { data: koops } = await sb
    .from('kooperationen')
    .select('id, kampagne_id, creator:creator_id ( vorname, nachname )')
    .in('kampagne_id', ALL_KAMPAGNE_IDS);
  const map = new Map();
  for (const k of koops || []) {
    const name = `${k.creator?.vorname || ''} ${k.creator?.nachname || ''}`.trim() || '_sonstige';
    map.set(k.id, sanitizePath(name));
  }
  return map;
}

async function buildMoveMap(sb, token) {
  const koopFolders = await getKoopCreatorFolders(sb);
  const koopIds = [...koopFolders.keys()];
  const moves = [];
  const seen = new Set();

  const addMove = (entry) => {
    if (!entry.oldPath || seen.has(entry.oldPath)) return;
    seen.add(entry.oldPath);
    moves.push(entry);
  };

  // 1) Vertrags-PDFs (via kooperation_id UND via kampagne_id, dedupliziert)
  const { data: vertraegeKoop } = await sb
    .from('vertraege')
    .select('id, kooperation_id, dropbox_file_path')
    .in('kooperation_id', koopIds)
    .not('dropbox_file_path', 'is', null);
  const { data: vertraegeKamp } = await sb
    .from('vertraege')
    .select('id, kooperation_id, dropbox_file_path')
    .in('kampagne_id', ALL_KAMPAGNE_IDS)
    .not('dropbox_file_path', 'is', null);

  const vertragRows = new Map();
  for (const v of [...(vertraegeKoop || []), ...(vertraegeKamp || [])]) {
    vertragRows.set(v.id, v);
  }
  for (const v of vertragRows.values()) {
    if (!isDropboxPath(v.dropbox_file_path)) continue;
    const creatorFolder = koopFolders.get(v.kooperation_id) || '_sonstige';
    addMove({
      kind: 'vertrag',
      table: 'vertraege',
      id: v.id,
      pathField: 'dropbox_file_path',
      urlField: 'dropbox_file_url',
      oldPath: v.dropbox_file_path,
      newPath: `${TARGET_DROPBOX_BASE}/${creatorFolder}/Vertraege/${fileName(v.dropbox_file_path)}`,
    });
  }

  // 2) Rechnungs-PDFs in Dropbox (Supabase-Storage-Pfade bleiben unangetastet)
  const { data: rechnungen } = await sb.from('rechnung').select('id, kooperation_id').in('kooperation_id', koopIds);
  const rechnungKoop = new Map((rechnungen || []).map(r => [r.id, r.kooperation_id]));
  const rechnungIds = [...rechnungKoop.keys()];
  if (rechnungIds.length) {
    const { data: pdfs } = await sb
      .from('rechnung_pdfs')
      .select('id, rechnung_id, file_path')
      .in('rechnung_id', rechnungIds)
      .not('file_path', 'is', null);
    for (const p of pdfs || []) {
      if (!isDropboxPath(p.file_path)) continue;
      const creatorFolder = koopFolders.get(rechnungKoop.get(p.rechnung_id)) || '_sonstige';
      addMove({
        kind: 'rechnung_pdf',
        table: 'rechnung_pdfs',
        id: p.id,
        pathField: 'file_path',
        urlField: 'file_url',
        oldPath: p.file_path,
        newPath: `${TARGET_DROPBOX_BASE}/${creatorFolder}/Rechnungen/${fileName(p.file_path)}`,
      });
    }
  }

  // 3) Video-Ordner: folder_url/story_folder_url können Pfade ODER Share-Links sein
  const { data: videos } = await sb
    .from('kooperation_videos')
    .select('id, kooperation_id, folder_url, story_folder_url')
    .in('kooperation_id', koopIds);
  for (const v of videos || []) {
    for (const field of ['folder_url', 'story_folder_url']) {
      const val = v[field];
      if (!val) continue;
      const creatorFolder = koopFolders.get(v.kooperation_id) || '_sonstige';

      if (isDropboxPath(val)) {
        addMove({
          kind: 'video_folder',
          table: 'kooperation_videos',
          id: v.id,
          pathField: field,
          urlField: null,
          oldPath: val,
          newPath: `${TARGET_DROPBOX_BASE}/${creatorFolder}/Content/${fileName(val)}`,
        });
      } else if (isShareLink(val)) {
        // Share-Link → echten Pfad via Dropbox-API auflösen
        const resolved = token ? await resolveSharedLink(token, val) : null;
        if (!resolved?.path) {
          console.warn(`  ⚠ Share-Link nicht auflösbar (${field}, video ${v.id}): ${val.slice(0, 80)}…`);
          continue;
        }
        addMove({
          kind: 'video_folder_link',
          table: 'kooperation_videos',
          id: v.id,
          pathField: field,
          urlField: field, // Feld enthält den Share-Link → neuen Link reinschreiben
          oldPath: resolved.path,
          oldUrl: val,
          newPath: `${TARGET_DROPBOX_BASE}/${creatorFolder}/Content/${sanitizePath(resolved.name || fileName(resolved.path))}`,
        });
      }
    }
  }

  return moves;
}

async function runDropboxMigration(sb) {
  console.log('\n=== Dropbox Migration ===');

  let token = null;
  try {
    token = await getAccessToken();
  } catch (err) {
    if (DRY_RUN) {
      console.warn(`  ⚠ Kein Dropbox-Token (${err.message}) — Dry-Run zeigt Share-Links unaufgelöst`);
    } else {
      throw err;
    }
  }

  const moves = await buildMoveMap(sb, token);
  console.log(`  ${moves.length} Move(s) geplant:`);
  for (const m of moves) {
    console.log(`  [${m.kind}] ${m.table}/${m.id}`);
    console.log(`    ${m.oldPath}`);
    console.log(`    → ${m.newPath}`);
  }

  if (DRY_RUN) return { moved: 0, skipped: 0, errors: [] };
  if (!moves.length) return { moved: 0, skipped: 0, errors: [] };

  let moved = 0;
  let skipped = 0;
  const errors = [];

  for (const m of moves) {
    // Idempotenz: bereits verschobene Dateien nicht erneut anfassen
    // (sonst würde autorename Duplikate wie "Video_3 (1)" erzeugen)
    if (m.oldPath.toLowerCase() === m.newPath.toLowerCase()) {
      console.log(`  SKIP (already at target): ${m.oldPath}`);
      skipped++;
      continue;
    }
    console.log(`  ${m.table}/${m.id}: ${m.oldPath} → ${m.newPath}`);
    try {
      await ensureFolder(token, parentDir(m.newPath));
      const result = await dropboxMove(token, m.oldPath, m.newPath);
      console.log(`    status: ${result.status}`);

      if (result.status === 'source_missing') {
        skipped++;
        continue;
      }

      const finalPath = result.toPath || m.newPath;
      const updatePayload = {};

      if (m.kind === 'video_folder_link') {
        // Feld enthält den Share-Link; neuen Link für den verschobenen Ordner erzeugen
        const newUrl = await createSharedLink(token, finalPath);
        if (newUrl) {
          updatePayload[m.pathField] = newUrl;
        } else {
          console.warn(`    ⚠ Kein neuer Share-Link für ${finalPath} — alter Link bleibt in DB`);
        }
      } else {
        updatePayload[m.pathField] = finalPath;
        if (m.urlField) {
          const newUrl = await createSharedLink(token, finalPath);
          if (newUrl) updatePayload[m.urlField] = newUrl;
        }
      }

      if (Object.keys(updatePayload).length) {
        const { error } = await sb.from(m.table).update(updatePayload).eq('id', m.id);
        if (error) throw new Error(`DB path update failed: ${error.message}`);

        // Zeilen, die denselben alten Wert teilen, mitziehen
        const matchValue = m.kind === 'video_folder_link' ? m.oldUrl : m.oldPath;
        const matchField = m.pathField;
        const { data: siblings } = await sb.from(m.table).select('id').eq(matchField, matchValue);
        for (const s of siblings || []) {
          if (s.id === m.id) continue;
          await sb.from(m.table).update(updatePayload).eq('id', s.id);
        }
      }

      moved++;
    } catch (err) {
      console.error(`    ERROR: ${err.message}`);
      errors.push({ move: m, error: err.message });
    }
  }

  return { moved, skipped, errors };
}

async function cleanupOldFolders() {
  console.log('\n=== Alte Ordner aufräumen (nur wenn leer) ===');
  let token;
  try {
    token = await getAccessToken();
  } catch (err) {
    console.warn(`  Übersprungen: ${err.message}`);
    return;
  }

  for (const folderPath of OLD_FOLDER_CANDIDATES) {
    try {
      const { exists, hasFiles } = await folderHasFiles(token, folderPath);
      if (!exists) {
        console.log(`  ${folderPath}: existiert nicht`);
        continue;
      }
      if (hasFiles) {
        console.log(`  ${folderPath}: enthält noch Dateien — NICHT gelöscht`);
        continue;
      }
      if (DRY_RUN) {
        console.log(`  [dry-run] würde löschen: ${folderPath}`);
        continue;
      }
      const result = await dropboxDeleteFolder(token, folderPath);
      console.log(`  ${folderPath}: ${result.status}`);
    } catch (err) {
      console.warn(`  ${folderPath}: Fehler — ${err.message}`);
    }
  }
}

// --- Validierung + Löschen ---

async function countOnKampagne(sb, table, kampagneId) {
  // select('*') statt select('id'): einige Junction-Tabellen (z.B. kampagne_creator,
  // ansprechpartner_kampagne) haben keine id-Spalte
  const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true }).eq('kampagne_id', kampagneId);
  if (error) throw new Error(`count ${table} failed: ${error.message}`);
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
    { label: 'kooperationen', table: 'kooperationen', expected: 5 },
    { label: 'vertraege', table: 'vertraege', expected: 5 },
    { label: 'rechnung', table: 'rechnung', expected: 3 },
  ];

  for (const c of targetChecks) {
    const count = await countOnKampagne(sb, c.table, TARGET_KAMPAGNE_ID);
    const ok = count === c.expected;
    console.log(`    ${ok ? '✓' : '✗'} ${c.label}: ${count} (expected ${c.expected})`);
    if (!ok) allOk = false;
  }

  const { data: target } = await sb.from('kampagne').select('eigener_name, videoanzahl, creatoranzahl').eq('id', TARGET_KAMPAGNE_ID).single();
  const renameOk = target?.eigener_name === NEW_EIGENER_NAME && target?.videoanzahl === NEW_VIDEOANZAHL && target?.creatoranzahl === NEW_CREATORANZAHL;
  console.log(`    ${renameOk ? '✓' : '✗'} kampagne: eigener_name="${target?.eigener_name}", videoanzahl=${target?.videoanzahl}, creatoranzahl=${target?.creatoranzahl}`);
  if (!renameOk) allOk = false;

  console.log('\n  Heritage Tags:');
  const allKoopIds = [...koopTagMap.keys()];
  if (allKoopIds.length) {
    const { data: tagCheck } = await sb
      .from('kooperationen')
      .select('id, name, kooperation_tags(kooperation_tag_typen(name))')
      .in('id', allKoopIds);
    let taggedOk = 0;
    let taggedFail = 0;
    for (const k of tagCheck || []) {
      const tags = (k.kooperation_tags || []).map(t => t.kooperation_tag_typen?.name).filter(Boolean);
      const expectedTag = koopTagMap.get(k.id);
      const hasTag = tags.includes(expectedTag);
      if (hasTag) { taggedOk++; } else { taggedFail++; allOk = false; }
      if (!hasTag) console.log(`    ✗ ${k.name}: missing "${expectedTag}" (has: [${tags.join(', ')}])`);
    }
    console.log(`    ${taggedOk} ok, ${taggedFail} missing`);
  }

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

    if (DRY_RUN) {
      console.log(`  [dry-run] would delete ${source.label}`);
      continue;
    }

    const { error } = await sb.from('kampagne').delete().eq('id', source.id);
    if (error) throw new Error(`Delete ${source.label} failed: ${error.message}`);
    console.log(`  ✓ deleted ${source.label} (${source.id.slice(0, 8)}…)`);
  }

  await cleanupOldFolders();
}

// --- Main ---

async function main() {
  loadEnvFile();
  const sb = getSupabase();

  console.log('Multilind Merge: Flight 2 → Flight 1 (= "Multilind UGC 2026")');
  console.log(`  Target: ${TARGET_KAMPAGNE_ID} (wird umbenannt)`);
  for (const s of SOURCES) console.log(`  Source: ${s.id.slice(0, 8)}… (${s.label})`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}${DB_ONLY ? ' (db-only)' : ''}${DROPBOX_ONLY ? ' (dropbox-only)' : ''}`);

  if (!DROPBOX_ONLY) {
    await runDbMigration(sb);
  } else {
    // Tag-Map aus existierenden Tags rekonstruieren (für Validierung)
    const allTags = [TARGET_HERITAGE_TAG, ...SOURCES.map(s => s.heritageTag)];
    for (const tagName of allTags) {
      const { data: tagRow } = await sb.from('kooperation_tag_typen').select('id').eq('name', tagName).maybeSingle();
      if (tagRow?.id) {
        const { data: tagged } = await sb.from('kooperation_tags').select('kooperation_id').eq('tag_id', tagRow.id);
        for (const t of tagged || []) koopTagMap.set(t.kooperation_id, tagName);
      }
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
