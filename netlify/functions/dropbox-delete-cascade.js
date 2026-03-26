const { getAccessToken } = require('./_shared/dropbox');
const { createClient } = require('@supabase/supabase-js');

const DROPBOX_DELETE_URL = 'https://api.dropboxapi.com/2/files/delete_v2';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase credentials not configured');
  return createClient(url, key);
}

async function dropboxDeletePath(token, filePath) {
  const resp = await fetch(DROPBOX_DELETE_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 409 && text.includes('not_found')) {
      return { path: filePath, status: 'already_gone' };
    }
    return { path: filePath, status: 'failed', error: `${resp.status}: ${text}` };
  }
  return { path: filePath, status: 'deleted' };
}

async function collectAssetPaths(supabase, videoIds) {
  if (!videoIds.length) return [];
  const { data } = await supabase
    .from('kooperation_video_asset')
    .select('file_path')
    .in('video_id', videoIds)
    .not('file_path', 'is', null);
  return (data || []).map(a => a.file_path).filter(Boolean);
}

async function collectVertragPaths(supabase, entityType, entityId) {
  let query = supabase.from('vertraege').select('vertragsdatei_pfad, signierter_vertrag_pfad');
  if (entityType === 'kampagne') {
    query = query.eq('kampagne_id', entityId);
  } else if (entityType === 'kooperation') {
    query = query.eq('kooperation_id', entityId);
  } else {
    return [];
  }
  const { data } = await query;
  const paths = [];
  (data || []).forEach(v => {
    if (v.vertragsdatei_pfad) paths.push(v.vertragsdatei_pfad);
    if (v.signierter_vertrag_pfad) paths.push(v.signierter_vertrag_pfad);
  });
  return paths;
}

async function getVideoIdsForKampagne(supabase, kampagneId) {
  const { data: koops } = await supabase
    .from('kooperationen')
    .select('id')
    .eq('kampagne_id', kampagneId);
  const koopIds = (koops || []).map(k => k.id);
  if (!koopIds.length) return [];
  const { data: videos } = await supabase
    .from('kooperation_videos')
    .select('id')
    .in('kooperation_id', koopIds);
  return (videos || []).map(v => v.id);
}

async function getVideoIdsForKooperation(supabase, kooperationId) {
  const { data: videos } = await supabase
    .from('kooperation_videos')
    .select('id')
    .eq('kooperation_id', kooperationId);
  return (videos || []).map(v => v.id);
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
    const { entityType, entityId } = JSON.parse(event.body || '{}');

    if (!entityType || !entityId) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'entityType and entityId are required' }),
      };
    }

    if (!['kampagne', 'kooperation', 'video'].includes(entityType)) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Unsupported entityType: ${entityType}` }),
      };
    }

    console.log(`dropbox-delete-cascade: ${entityType} ${entityId}`);

    const supabase = getSupabase();
    const token = await getAccessToken();

    let videoIds = [];
    if (entityType === 'kampagne') {
      videoIds = await getVideoIdsForKampagne(supabase, entityId);
    } else if (entityType === 'kooperation') {
      videoIds = await getVideoIdsForKooperation(supabase, entityId);
    } else {
      videoIds = [entityId];
    }

    const assetPaths = await collectAssetPaths(supabase, videoIds);
    const vertragPaths = entityType !== 'video'
      ? await collectVertragPaths(supabase, entityType, entityId)
      : [];

    const allPaths = [...assetPaths, ...vertragPaths];

    console.log(`dropbox-delete-cascade: ${allPaths.length} files to delete for ${entityType} ${entityId}`);

    const results = await Promise.allSettled(
      allPaths.map(p => dropboxDeletePath(token, p))
    );

    const summary = {
      totalFiles: allPaths.length,
      deleted: 0,
      alreadyGone: 0,
      failed: 0,
      failures: [],
    };

    for (const r of results) {
      if (r.status === 'fulfilled') {
        const v = r.value;
        if (v.status === 'deleted') summary.deleted++;
        else if (v.status === 'already_gone') summary.alreadyGone++;
        else {
          summary.failed++;
          summary.failures.push(v);
        }
      } else {
        summary.failed++;
        summary.failures.push({ path: 'unknown', status: 'rejected', error: r.reason?.message });
      }
    }

    console.log(`dropbox-delete-cascade result:`, JSON.stringify(summary));

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, ...summary }),
    };
  } catch (err) {
    console.error('dropbox-delete-cascade error:', err);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Cascade delete failed' }),
    };
  }
};
