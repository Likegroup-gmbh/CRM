/**
 * Netlify Function: migrate-uploads-to-dropbox
 *
 * Einmalige Migration bestehender Dateien aus Supabase Storage nach Dropbox.
 * Migriert:
 *   - rechnung_pdfs        (Bucket: rechnungen)
 *   - rechnung_belege      (Bucket: rechnung-belege)
 *   - vertraege.datei_path (Bucket: vertraege)
 *
 * Aufruf:
 *   POST /.netlify/functions/migrate-uploads-to-dropbox
 *   Body:
 *     {
 *       "type": "rechnung_pdfs" | "rechnung_belege" | "vertraege" | "all",
 *       "limit": 10,        // Wie viele Dateien pro Aufruf migrieren (default 5)
 *       "dryRun": false     // Wenn true, nur listen was migriert würde
 *     }
 *
 * Wegen Netlify Timeout (10s synchron) sollte limit klein gehalten werden
 * und der Aufruf iterativ ausgeführt werden. Bereits migrierte Dateien
 * (file_path beginnt mit "/") werden übersprungen.
 *
 * Voraussetzungen:
 *   - SUPABASE_URL / VITE_SUPABASE_URL gesetzt
 *   - SUPABASE_SERVICE_ROLE_KEY oder SUPABASE_SERVICE_KEY gesetzt
 *   - DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, DROPBOX_APP_SECRET gesetzt
 */

const { createClient } = require('@supabase/supabase-js');
const { getAccessToken, sanitizePath, buildUnifiedBasePath, ensureFolder } = require('./_shared/dropbox');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

// Pfadbau für migrierte Dateien (muss zu dropbox-upload-rechnung.js und
// dropbox-upload-vertrag.js passen)
function buildMigratedRechnungPdfPath({ unternehmen, marke, kampagne, kooperation, rechnungsNr, fileName }) {
  return buildRechnungPath({ unternehmen, marke, kampagne, kooperation, rechnungsNr, fileName, kind: 'pdf' });
}

function buildMigratedBelegPath({ unternehmen, marke, kampagne, kooperation, rechnungsNr, fileName }) {
  return buildRechnungPath({ unternehmen, marke, kampagne, kooperation, rechnungsNr, fileName, kind: 'beleg' });
}

function buildRechnungPath({ unternehmen, marke, kampagne, kooperation, rechnungsNr, kind, fileName }) {
  const hasKampagne = !!kampagne;
  let parts;
  if (!hasKampagne && unternehmen) {
    parts = ['/' + sanitizePath(unternehmen), 'Contracting', 'Rechnungen'];
  } else {
    const base = buildUnifiedBasePath({ unternehmen, marke, kampagne, kooperation });
    parts = [base, 'Rechnungen'];
  }
  const nr = sanitizePath(rechnungsNr || '') || `Rechnung_${Date.now()}`;
  parts.push(nr);
  if (kind === 'beleg') parts.push('Belege');
  parts.push(sanitizePath(fileName) || (kind === 'beleg' ? `beleg_${Date.now()}` : `rechnung_${Date.now()}.pdf`));
  return parts.join('/');
}

function buildVertragMigratedPath({ unternehmen, marke, kampagne, kooperation, creator, vertragstyp, fileName }) {
  const base = buildUnifiedBasePath({ unternehmen, marke, kampagne, kooperation });
  const parts = [base, 'Vertraege'];
  const creatorPart = sanitizePath(creator || '');
  const typPart = sanitizePath(vertragstyp || '');
  let leaf = '';
  if (creatorPart && typPart) leaf = `${creatorPart}_${typPart}`;
  else if (creatorPart) leaf = creatorPart;
  else if (typPart) leaf = typPart;
  if (leaf) parts.push(leaf);
  parts.push(sanitizePath(fileName) || `Vertrag_${Date.now()}.pdf`);
  return parts.join('/');
}

async function dropboxUpload(token, dropboxPath, buffer, contentType) {
  // Dropbox content endpoint, mode=overwrite damit Migration idempotent ist.
  const resp = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path: dropboxPath,
        mode: 'overwrite',
        autorename: false,
        mute: true,
      }),
    },
    body: buffer,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Dropbox upload fehlgeschlagen: ${resp.status} – ${text}`);
  }
  return resp.json();
}

async function createSharedLink(token, dropboxPath) {
  try {
    const resp = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dropboxPath, settings: { requested_visibility: 'public' } }),
    });
    if (resp.ok) {
      const data = await resp.json();
      return data.url?.replace('?dl=0', '?raw=1') || null;
    }
    // 409 = link existiert schon → vorhandenen Link holen
    if (resp.status === 409) {
      const listResp = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: dropboxPath, direct_only: true }),
      });
      if (listResp.ok) {
        const data = await listResp.json();
        const link = data.links?.[0]?.url;
        return link?.replace('?dl=0', '?raw=1') || null;
      }
    }
    return null;
  } catch (err) {
    console.warn('createSharedLink fehlgeschlagen:', err.message);
    return null;
  }
}

async function downloadFromSupabase(sb, bucket, filePath) {
  const { data, error } = await sb.storage.from(bucket).download(filePath);
  if (error) throw new Error(`Supabase download fehlgeschlagen (${bucket}/${filePath}): ${error.message}`);
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function migrateRechnungPdfs(sb, token, limit, dryRun) {
  const { data: rows, error } = await sb
    .from('rechnung_pdfs')
    .select(`
      id, file_name, file_path, file_url, content_type,
      rechnung:rechnung_id(
        id, rechnung_nr, unternehmen_id, kampagne_id, kooperation_id,
        unternehmen:unternehmen_id(firmenname),
        kampagne:kampagne_id(kampagnenname, eigener_name, marke:marke_id(markenname)),
        kooperation:kooperation_id(name)
      )
    `)
    .not('file_path', 'is', null)
    .limit(limit * 3);
  if (error) throw error;

  const candidates = (rows || []).filter(r => r.file_path && !r.file_path.startsWith('/')).slice(0, limit);
  if (candidates.length === 0) return { migrated: 0, remaining: 0, results: [] };

  const results = [];
  for (const row of candidates) {
    const r = row.rechnung || {};
    const meta = {
      unternehmen: r.unternehmen?.firmenname || '',
      marke: r.kampagne?.marke?.markenname || '',
      kampagne: r.kampagne?.eigener_name || r.kampagne?.kampagnenname || '',
      kooperation: r.kooperation?.name || '',
      rechnungsNr: r.rechnung_nr || row.file_name,
      fileName: row.file_name,
    };
    const newPath = buildMigratedRechnungPdfPath(meta);
    if (dryRun) {
      results.push({ id: row.id, oldPath: row.file_path, newPath, action: 'would_migrate' });
      continue;
    }

    try {
      const buffer = await downloadFromSupabase(sb, 'rechnungen', row.file_path);
      const folder = newPath.substring(0, newPath.lastIndexOf('/'));
      await ensureFolder(token, folder);
      await dropboxUpload(token, newPath, buffer, row.content_type || 'application/pdf');
      const sharedLink = await createSharedLink(token, newPath);

      const { error: updErr } = await sb.from('rechnung_pdfs').update({
        file_path: newPath,
        file_url: sharedLink || newPath,
      }).eq('id', row.id);
      if (updErr) throw updErr;

      results.push({ id: row.id, oldPath: row.file_path, newPath, action: 'migrated' });
    } catch (err) {
      results.push({ id: row.id, oldPath: row.file_path, error: err.message });
    }
  }

  // Verbleibende Anzahl unmigrierter Einträge
  const { count } = await sb.from('rechnung_pdfs')
    .select('*', { count: 'exact', head: true })
    .not('file_path', 'is', null);
  return { migrated: results.filter(r => r.action === 'migrated').length, remaining: count || 0, results };
}

async function migrateRechnungBelege(sb, token, limit, dryRun) {
  const { data: rows, error } = await sb
    .from('rechnung_belege')
    .select(`
      id, file_name, file_path, file_url, content_type,
      rechnung:rechnung_id(
        id, rechnung_nr, unternehmen_id, kampagne_id, kooperation_id,
        unternehmen:unternehmen_id(firmenname),
        kampagne:kampagne_id(kampagnenname, eigener_name, marke:marke_id(markenname)),
        kooperation:kooperation_id(name)
      )
    `)
    .not('file_path', 'is', null)
    .limit(limit * 3);
  if (error) throw error;

  const candidates = (rows || []).filter(r => r.file_path && !r.file_path.startsWith('/')).slice(0, limit);
  if (candidates.length === 0) return { migrated: 0, remaining: 0, results: [] };

  const results = [];
  for (const row of candidates) {
    const r = row.rechnung || {};
    const meta = {
      unternehmen: r.unternehmen?.firmenname || '',
      marke: r.kampagne?.marke?.markenname || '',
      kampagne: r.kampagne?.eigener_name || r.kampagne?.kampagnenname || '',
      kooperation: r.kooperation?.name || '',
      rechnungsNr: r.rechnung_nr || row.file_name,
      fileName: row.file_name,
    };
    const newPath = buildMigratedBelegPath(meta);
    if (dryRun) {
      results.push({ id: row.id, oldPath: row.file_path, newPath, action: 'would_migrate' });
      continue;
    }

    try {
      const buffer = await downloadFromSupabase(sb, 'rechnung-belege', row.file_path);
      const folder = newPath.substring(0, newPath.lastIndexOf('/'));
      await ensureFolder(token, folder);
      await dropboxUpload(token, newPath, buffer, row.content_type || 'application/octet-stream');
      const sharedLink = await createSharedLink(token, newPath);

      const { error: updErr } = await sb.from('rechnung_belege').update({
        file_path: newPath,
        file_url: sharedLink || newPath,
      }).eq('id', row.id);
      if (updErr) throw updErr;

      results.push({ id: row.id, oldPath: row.file_path, newPath, action: 'migrated' });
    } catch (err) {
      results.push({ id: row.id, oldPath: row.file_path, error: err.message });
    }
  }

  return { migrated: results.filter(r => r.action === 'migrated').length, remaining: -1, results };
}

async function migrateVertraege(sb, token, limit, dryRun) {
  const { data: rows, error } = await sb
    .from('vertraege')
    .select(`
      id, name, typ, datei_path, datei_url,
      kunde:kunde_unternehmen_id(firmenname),
      kampagne:kampagne_id(kampagnenname, eigener_name, marke:marke_id(markenname)),
      kooperation:kooperation_id(name),
      creator:creator_id(vorname, nachname)
    `)
    .not('datei_path', 'is', null)
    .limit(limit * 3);
  if (error) throw error;

  const candidates = (rows || []).filter(r => r.datei_path && !r.datei_path.startsWith('/')).slice(0, limit);
  if (candidates.length === 0) return { migrated: 0, remaining: 0, results: [] };

  const results = [];
  for (const row of candidates) {
    const fileName = row.datei_path.split('/').pop() || `Vertrag_${row.id}.pdf`;
    const creatorName = row.creator
      ? `${row.creator.vorname || ''} ${row.creator.nachname || ''}`.trim()
      : '';
    const meta = {
      unternehmen: row.kunde?.firmenname || '',
      marke: row.kampagne?.marke?.markenname || '',
      kampagne: row.kampagne?.eigener_name || row.kampagne?.kampagnenname || '',
      kooperation: row.kooperation?.name || '',
      creator: creatorName,
      vertragstyp: row.typ || '',
      fileName,
    };
    const newPath = buildVertragMigratedPath(meta);
    if (dryRun) {
      results.push({ id: row.id, oldPath: row.datei_path, newPath, action: 'would_migrate' });
      continue;
    }

    try {
      const buffer = await downloadFromSupabase(sb, 'vertraege', row.datei_path);
      const folder = newPath.substring(0, newPath.lastIndexOf('/'));
      await ensureFolder(token, folder);
      await dropboxUpload(token, newPath, buffer, 'application/pdf');
      const sharedLink = await createSharedLink(token, newPath);

      const { error: updErr } = await sb.from('vertraege').update({
        datei_path: newPath,
        datei_url: sharedLink || newPath,
      }).eq('id', row.id);
      if (updErr) throw updErr;

      results.push({ id: row.id, oldPath: row.datei_path, newPath, action: 'migrated' });
    } catch (err) {
      results.push({ id: row.id, oldPath: row.datei_path, error: err.message });
    }
  }

  return { migrated: results.filter(r => r.action === 'migrated').length, remaining: -1, results };
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const type = body.type || 'all';
    const limit = Math.max(1, Math.min(20, Number(body.limit) || 5));
    const dryRun = !!body.dryRun;

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token = dryRun ? null : await getAccessToken();

    const summary = {};
    if (type === 'rechnung_pdfs' || type === 'all') {
      summary.rechnung_pdfs = await migrateRechnungPdfs(sb, token, limit, dryRun);
    }
    if (type === 'rechnung_belege' || type === 'all') {
      summary.rechnung_belege = await migrateRechnungBelege(sb, token, limit, dryRun);
    }
    if (type === 'vertraege' || type === 'all') {
      summary.vertraege = await migrateVertraege(sb, token, limit, dryRun);
    }

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, dryRun, summary }),
    };
  } catch (err) {
    console.error('migrate-uploads-to-dropbox error:', err);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Migration fehlgeschlagen' }),
    };
  }
};
