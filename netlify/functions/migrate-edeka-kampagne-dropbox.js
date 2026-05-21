/**
 * Netlify Function: Dropbox-Dateien nach Kampagne-Migration verschieben.
 *
 * POST /.netlify/functions/migrate-edeka-kampagne-dropbox
 * Body: { "dryRun": false }
 *
 * Verschiebt Vertrags-, Rechnungs- und Video-Assets von alten Kampagne-Pfaden
 * nach "EDEKA Zentrale - März 2026" und aktualisiert DB-Pfade/URLs.
 */

const { createClient } = require('@supabase/supabase-js');
const { getAccessToken, ensureFolder } = require('./_shared/dropbox');

const TARGET_KAMPAGNE_ID = 'c3c29584-f63e-4db7-907e-214cdd077201';

const PATH_REPLACEMENTS = [
  ['EDEKA Zentrale - 1 Kampagne (März)', 'EDEKA Zentrale - März 2026'],
  ['EDEKA Zentrale - 1 Kampagne (März) ', 'EDEKA Zentrale - März 2026'],
  ['EDEKA ZENTRALE - 3-2', 'EDEKA Zentrale - März 2026'],
];

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Supabase credentials not configured');
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
  } catch {
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
      return { status: 'source_missing', toPath };
    }
    if (resp.status === 409 && text.includes('conflict')) {
      return { status: 'target_exists', toPath };
    }
    throw new Error(`Dropbox move failed: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  return { status: 'moved', toPath: data.metadata?.path_display || toPath };
}

async function collectFiles(sb) {
  const { data: koops } = await sb.from('kooperationen').select('id').eq('kampagne_id', TARGET_KAMPAGNE_ID);
  const koopIds = (koops || []).map(k => k.id);
  if (!koopIds.length) return [];

  const files = [];

  const { data: vertraege } = await sb.from('vertraege').select('id, dropbox_file_path')
    .in('kooperation_id', koopIds).not('dropbox_file_path', 'is', null);
  for (const v of vertraege || []) {
    files.push({ table: 'vertraege', id: v.id, pathField: 'dropbox_file_path', urlField: 'dropbox_file_url', oldPath: v.dropbox_file_path });
  }

  const { data: rechnungen } = await sb.from('rechnung').select('id').in('kooperation_id', koopIds);
  const rechnungIds = (rechnungen || []).map(r => r.id);
  if (rechnungIds.length) {
    const { data: pdfs } = await sb.from('rechnung_pdfs').select('id, file_path')
      .in('rechnung_id', rechnungIds).not('file_path', 'is', null);
    for (const p of pdfs || []) {
      files.push({ table: 'rechnung_pdfs', id: p.id, pathField: 'file_path', urlField: 'file_url', oldPath: p.file_path });
    }
  }

  const { data: videos } = await sb.from('kooperation_videos').select('id').in('kooperation_id', koopIds);
  const videoIds = (videos || []).map(v => v.id);
  if (videoIds.length) {
    const { data: assets } = await sb.from('kooperation_video_asset').select('id, file_path')
      .in('video_id', videoIds).not('file_path', 'is', null);
    for (const a of assets || []) {
      files.push({ table: 'kooperation_video_asset', id: a.id, pathField: 'file_path', urlField: 'file_url', oldPath: a.file_path });
    }
  }

  const seen = new Set();
  return files.filter(f => {
    if (seen.has(f.oldPath)) return false;
    seen.add(f.oldPath);
    return true;
  });
}

async function runMigration(dryRun) {
  const sb = getSupabase();
  const files = await collectFiles(sb);
  const token = dryRun ? null : await getAccessToken();
  const results = [];

  for (const file of files) {
    const newPath = remapPath(file.oldPath);
    const entry = { table: file.table, id: file.id, from: file.oldPath, to: newPath, status: 'skipped' };

    if (newPath === file.oldPath) {
      entry.status = 'no_remap';
      results.push(entry);
      continue;
    }

    if (dryRun) {
      entry.status = 'dry_run';
      results.push(entry);
      continue;
    }

    await ensureFolder(token, parentDir(newPath));
    const moveResult = await dropboxMove(token, file.oldPath, newPath);
    entry.status = moveResult.status;
    entry.to = moveResult.toPath || newPath;

    if (moveResult.status !== 'source_missing') {
      const finalPath = moveResult.toPath || newPath;
      const newUrl = await createSharedLink(token, finalPath);
      const updatePayload = { [file.pathField]: finalPath };
      if (newUrl && file.urlField) updatePayload[file.urlField] = newUrl;
      await sb.from(file.table).update(updatePayload).eq('id', file.id);
      const { data: siblings } = await sb.from(file.table).select('id').eq(file.pathField, file.oldPath);
      for (const s of siblings || []) {
        if (s.id !== file.id) await sb.from(file.table).update(updatePayload).eq('id', s.id);
      }
    }

    results.push(entry);
  }

  return { total: files.length, results };
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { dryRun = false } = JSON.parse(event.body || '{}');
    const summary = await runMigration(dryRun);
    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, dryRun, summary }),
    };
  } catch (err) {
    console.error('migrate-edeka-kampagne-dropbox error:', err);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};

exports.runMigration = runMigration;
exports.remapPath = remapPath;
