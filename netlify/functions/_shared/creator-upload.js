// _shared/creator-upload.js
// Gemeinsame Server-Logik fuer den tokenisierten Creator-Upload.
// NUR service role. Kein Client-Zugriff auf Token-/Job-Tabellen (RLS deny-all).

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { getAccessToken, sanitizePath, buildUnifiedBasePath } = require('./dropbox');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const STAGING_BUCKET = 'creator-upload-staging';
const TOKEN_TTL_DAYS = 90;
const MAX_VERSIONS = 3;

// Rate-Limits (DB-basiert)
const MAX_JOBS_PER_TOKEN_PER_HOUR = 40;
const MAX_MAILS_PER_TOKEN_PER_HOUR = 5;

// Groessen-Caps pro Zieltyp (Bytes)
const SIZE_CAPS = {
  video: 2 * 1024 * 1024 * 1024,   // 2 GB
  story: 500 * 1024 * 1024,        // 500 MB
  bilder: 55 * 1024 * 1024,        // 55 MB
};

const EXT_BY_TYPE = {
  video: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
  story: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
  bilder: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'tiff', 'tif', 'avif'],
};

const MIME_BY_EXT = {
  mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
  mkv: 'video/x-matroska', webm: 'video/webm',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif', gif: 'image/gif', bmp: 'image/bmp',
  tiff: 'image/tiff', tif: 'image/tiff', avif: 'image/avif',
};

// ─── Supabase Service Client ────────────────────────────────

let _client = null;
function getServiceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('Supabase Service-Konfiguration fehlt (SUPABASE_URL / SUPABASE_SERVICE_KEY)');
  }
  if (!_client) {
    _client = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

// ─── Token Crypto ───────────────────────────────────────────
// Roh-Token: 32 Bytes hex (64 Zeichen). DB speichert SHA-256-Hash (Lookup)
// und AES-256-GCM verschluesselten Roh-Token (erneutes Mailen desselben Links).

function generateRawToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function getTokenKey() {
  const hex = process.env.CREATOR_UPLOAD_TOKEN_KEY || '';
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('CREATOR_UPLOAD_TOKEN_KEY fehlt oder ist kein 64-stelliger Hex-String');
  }
  return Buffer.from(hex, 'hex');
}

function encryptToken(raw) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getTokenKey(), iv);
  const enc = Buffer.concat([cipher.update(String(raw), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

function decryptToken(payload) {
  const [ivB64, tagB64, dataB64] = String(payload || '').split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Token-Verschluesselung korrupt');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getTokenKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

// ─── Token aufloesen ────────────────────────────────────────
// Einheitliches "null" bei ungueltig/abgelaufen/widerrufen — kein Orakel.

async function resolveToken(supabase, raw) {
  if (!raw || typeof raw !== 'string' || !/^[0-9a-f]{64}$/i.test(raw)) return null;
  const { data, error } = await supabase
    .from('creator_upload_token')
    .select('id, kampagne_id, creator_id, expires_at, revoked_at')
    .eq('token_hash', hashToken(raw))
    .maybeSingle();
  if (error || !data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data;
}

// ─── Live-Membership ────────────────────────────────────────
// Laedt die aktuellen Kooperationen des Creators in der Kampagne inkl. Slots
// und belegten Feedbackschleifen. Keine URLs, keine Pfade, keine Preise.

async function loadMembership(supabase, tokenRow) {
  const { data: koops, error: koopErr } = await supabase
    .from('kooperationen')
    .select('id, name, kampagne:kampagne_id(id, kampagnenname, eigener_name)')
    .eq('kampagne_id', tokenRow.kampagne_id)
    .eq('creator_id', tokenRow.creator_id)
    .order('created_at', { ascending: true });
  if (koopErr) throw koopErr;

  const koopList = koops || [];
  if (koopList.length === 0) {
    return { kampagne: '', kooperationen: [] };
  }

  const koopIds = koopList.map(k => k.id);

  const { data: videos, error: vidErr } = await supabase
    .from('kooperation_videos')
    .select('id, kooperation_id, position, thema, video_name')
    .in('kooperation_id', koopIds)
    .order('position', { ascending: true });
  if (vidErr) throw vidErr;

  const videoList = videos || [];
  const videoIds = videoList.map(v => v.id);

  const { data: storySlotRows, error: storyErr } = videoIds.length
    ? await supabase.from('kooperation_story').select('id, video_id, slot_index, slot_name').in('video_id', videoIds).order('slot_index', { ascending: true })
    : { data: [], error: null };
  if (storyErr) throw storyErr;

  const storySlots = storySlotRows || [];
  const storyIds = storySlots.map(s => s.id);

  const [videoAssetsRes, storyAssetsRes, bilderRes] = await Promise.all([
    videoIds.length
      ? supabase.from('kooperation_video_asset').select('video_id, version_number').in('video_id', videoIds).eq('is_final', false)
      : Promise.resolve({ data: [], error: null }),
    storyIds.length
      ? supabase.from('kooperation_story_asset').select('story_id, version_number').in('story_id', storyIds).eq('is_final', false)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('kooperation_bilder_asset').select('kooperation_id').in('kooperation_id', koopIds),
  ]);

  const storyAssets = storyAssetsRes.data || [];
  const videoAssets = videoAssetsRes.data || [];
  const bilderRows = bilderRes.data || [];

  const fsByVideo = {};
  videoAssets.forEach(a => {
    if (!fsByVideo[a.video_id]) fsByVideo[a.video_id] = [];
    if (a.version_number != null) fsByVideo[a.video_id].push(a.version_number);
  });
  const fsByStory = {};
  storyAssets.forEach(a => {
    if (!fsByStory[a.story_id]) fsByStory[a.story_id] = [];
    if (a.version_number != null) fsByStory[a.story_id].push(a.version_number);
  });
  const bilderCountByKoop = {};
  bilderRows.forEach(b => {
    bilderCountByKoop[b.kooperation_id] = (bilderCountByKoop[b.kooperation_id] || 0) + 1;
  });

  const storysByVideo = {};
  storySlots.forEach(s => {
    if (!storysByVideo[s.video_id]) storysByVideo[s.video_id] = [];
    storysByVideo[s.video_id].push({
      id: s.id,
      slotIndex: s.slot_index,
      slotName: s.slot_name || null,
      fs: (fsByStory[s.id] || []).sort((a, b) => a - b),
    });
  });

  const videosByKoop = {};
  videoList.forEach(v => {
    if (!videosByKoop[v.kooperation_id]) videosByKoop[v.kooperation_id] = [];
    videosByKoop[v.kooperation_id].push({
      id: v.id,
      position: v.position,
      thema: v.thema || null,
      titel: v.video_name || null,
      fs: (fsByVideo[v.id] || []).sort((a, b) => a - b),
      storys: storysByVideo[v.id] || [],
    });
  });

  const firstKamp = koopList[0].kampagne;
  return {
    kampagne: firstKamp ? (firstKamp.kampagnenname || firstKamp.eigener_name || '') : '',
    kooperationen: koopList.map(k => ({
      id: k.id,
      name: k.name || '',
      videos: videosByKoop[k.id] || [],
      bilderCount: bilderCountByKoop[k.id] || 0,
    })),
  };
}

// ─── Ziel-Validierung gegen Membership ──────────────────────
// Gibt Kontext fuer Pfad/DB-Zeile zurueck oder null (Ziel gehoert nicht zum Token).

async function resolveTarget(supabase, tokenRow, targetType, targetId) {
  const membership = await loadMembership(supabase, tokenRow);
  const koopIds = membership.kooperationen.map(k => k.id);

  if (targetType === 'video') {
    for (const koop of membership.kooperationen) {
      const video = koop.videos.find(v => v.id === targetId);
      if (video) return { kind: 'video', koop, video, membership };
    }
    return null;
  }

  if (targetType === 'story') {
    for (const koop of membership.kooperationen) {
      for (const video of koop.videos) {
        const story = video.storys.find(s => s.id === targetId);
        if (story) return { kind: 'story', koop, video, story, membership };
      }
    }
    return null;
  }

  if (targetType === 'bilder') {
    const koop = membership.kooperationen.find(k => k.id === targetId);
    if (koop && koopIds.includes(targetId)) return { kind: 'bilder', koop, membership };
    return null;
  }

  return null;
}

// ─── Datei-Validierung ──────────────────────────────────────

function validateFile(targetType, fileName, fileSize, contentType) {
  const ext = (String(fileName || '').split('.').pop() || '').toLowerCase();
  if (!EXT_BY_TYPE[targetType].includes(ext)) {
    return { ok: false, code: 'bad_type', error: `Dateityp .${ext} ist hier nicht erlaubt` };
  }
  const size = Number(fileSize) || 0;
  if (size <= 0) return { ok: false, code: 'empty', error: 'Datei ist leer' };
  if (size > SIZE_CAPS[targetType]) {
    return { ok: false, code: 'too_large', error: `Datei zu gross (max. ${Math.round(SIZE_CAPS[targetType] / 1024 / 1024)} MB)` };
  }
  // MIME immer aus der Extension ableiten: Browser melden mkv/heic teils
  // falsch oder gar nicht, die Extension-Allowlist ist der eigentliche Guard.
  return { ok: true, ext, contentType: MIME_BY_EXT[ext] };
}

// ─── Naechste FS-Nummer ─────────────────────────────────────

async function nextVersionNumber(supabase, targetType, targetId) {
  const table = targetType === 'video' ? 'kooperation_video_asset' : 'kooperation_story_asset';
  const fk = targetType === 'video' ? 'video_id' : 'story_id';
  const { data, error } = await supabase
    .from(table)
    .select('version_number')
    .eq(fk, targetId)
    .eq('is_final', false);
  if (error) throw error;
  const used = (data || []).map(a => a.version_number).filter(v => v != null);
  for (let v = 1; v <= MAX_VERSIONS; v++) {
    if (!used.includes(v)) return v;
  }
  return null; // alle FS belegt
}

// ─── Rate-Limits ────────────────────────────────────────────

async function checkJobRateLimit(supabase, tokenId) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('creator_upload_job')
    .select('id', { count: 'exact', head: true })
    .eq('token_id', tokenId)
    .gte('created_at', since);
  if (error) throw error;
  return (count || 0) < MAX_JOBS_PER_TOKEN_PER_HOUR;
}

async function checkAndBumpMailRateLimit(supabase, tokenId, row) {
  const now = Date.now();
  const windowStart = row.mail_window_start ? new Date(row.mail_window_start).getTime() : 0;
  const inWindow = windowStart > now - 60 * 60 * 1000;
  const count = inWindow ? (row.mail_count || 0) : 0;
  if (count >= MAX_MAILS_PER_TOKEN_PER_HOUR) return false;
  await supabase
    .from('creator_upload_token')
    .update({
      mail_count: count + 1,
      mail_window_start: inWindow ? row.mail_window_start : new Date(now).toISOString(),
      last_sent_at: new Date(now).toISOString(),
    })
    .eq('id', tokenId);
  return true;
}

// ─── Dropbox: Pfade + save_url + Links ──────────────────────

function sanitizeFilePart(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

function buildVersionedFileName(creatorName, unternehmen, kampagne, version, ext) {
  const parts = [creatorName, unternehmen, kampagne].map(sanitizeFilePart).filter(Boolean);
  parts.push(`v${version}`);
  return parts.join('_') + '.' + ext;
}

// Laedt die Namen fuer den Dropbox-Pfad (Unternehmen/Marke/Kampagne/Kooperation/Creator)
async function loadPathContext(supabase, tokenRow, koopId) {
  const { data: koop, error } = await supabase
    .from('kooperationen')
    .select(`id, name,
      kampagne:kampagne_id(id, kampagnenname, eigener_name,
        unternehmen:unternehmen_id(id, firmenname),
        marke:marke_id(id, markenname)),
      creator:creator_id(id, vorname, nachname)`)
    .eq('id', koopId)
    .single();
  if (error || !koop) throw new Error('Kooperation fuer Pfad nicht gefunden');
  const kamp = koop.kampagne || {};
  return {
    unternehmen: kamp.unternehmen?.firmenname || '',
    marke: kamp.marke?.markenname || '',
    kampagne: kamp.kampagnenname || kamp.eigener_name || '',
    kooperation: koop.name || '',
    creatorName: [koop.creator?.vorname, koop.creator?.nachname].filter(Boolean).join(' '),
  };
}

function buildTargetPath(ctx, job, targetCtx) {
  const base = buildUnifiedBasePath({
    unternehmen: ctx.unternehmen,
    marke: ctx.marke,
    kampagne: ctx.kampagne,
    kooperation: ctx.kooperation,
  });
  const pos = targetCtx.video?.position || 1;
  const thema = sanitizePath(targetCtx.video?.thema || '');
  const videoFolder = thema ? `Video_${pos}_${thema}` : `Video_${pos}`;

  if (job.target_type === 'video') {
    const name = buildVersionedFileName(ctx.creatorName, ctx.unternehmen, ctx.kampagne, job.version_number, job._ext);
    return {
      filePath: `${base}/Videos/${videoFolder}/Feedbackschleife_${job.version_number}/${name}`,
      folderPath: `${base}/Videos/${videoFolder}`,
    };
  }

  if (job.target_type === 'story') {
    const slotIdx = targetCtx.story?.slotIndex || 1;
    const name = buildVersionedFileName(ctx.creatorName, ctx.unternehmen, ctx.kampagne, job.version_number, job._ext);
    return {
      filePath: `${base}/Storys/${videoFolder}/Story_${slotIdx}/Feedbackschleife_${job.version_number}/${name}`,
      folderPath: `${base}/Storys/${videoFolder}`,
    };
  }

  // bilder: Kooperations-Ebene, Originalname (sanitized), Kollision -> _n
  const safeName = sanitizePath(job.file_name) || `bild.${job._ext}`;
  return {
    filePath: `${base}/Bilder/${safeName}`,
    folderPath: `${base}/Bilder`,
  };
}

async function dropboxSaveUrl(token, path, url) {
  const resp = await fetch('https://api.dropboxapi.com/2/files/save_url', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, url }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`Dropbox save_url fehlgeschlagen (${resp.status}): ${data.error_summary || 'unbekannt'}`);
  }
  return data; // { ".tag": "async_job_id", async_job_id } | { ".tag": "complete", ... }
}

async function dropboxCheckSaveUrl(token, asyncJobId) {
  const resp = await fetch('https://api.dropboxapi.com/2/files/save_url/check_job_status', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ async_job_id: asyncJobId }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`Dropbox save_url-Status fehlgeschlagen (${resp.status}): ${data.error_summary || 'unbekannt'}`);
  }
  return data; // in_progress | complete | failed
}

async function dropboxEnsureSharedLink(token, path) {
  const create = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (create.ok) {
    const data = await create.json();
    return data.url ? data.url.replace(/([?&])dl=0\b/i, '$1raw=1') : null;
  }
  const err = await create.json().catch(() => ({}));
  if (!/shared_link_already_exists/i.test(err.error_summary || '')) {
    console.warn('[creator-upload] shared-link fehlgeschlagen:', err.error_summary || create.status);
    return null;
  }
  const list = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, direct_only: true }),
  });
  if (!list.ok) return null;
  const data = await list.json();
  const url = data.links?.[0]?.url || null;
  return url ? url.replace(/([?&])dl=0\b/i, '$1raw=1') : null;
}

async function dropboxDelete(token, path) {
  try {
    await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
  } catch (err) {
    console.warn('[creator-upload] Dropbox-Delete fehlgeschlagen:', err.message || err);
  }
}

// ─── Staging ────────────────────────────────────────────────

async function createStagingUploadUrl(supabase, stagingKey) {
  const { data, error } = await supabase.storage
    .from(STAGING_BUCKET)
    .createSignedUploadUrl(stagingKey);
  if (error) throw error;
  return data; // { signedUrl, token, path }
}

async function createStagingDownloadUrl(supabase, stagingKey, expiresInSeconds = 7200) {
  const { data, error } = await supabase.storage
    .from(STAGING_BUCKET)
    .createSignedUrl(stagingKey, expiresInSeconds);
  if (error) throw error;
  return data?.signedUrl || null;
}

async function stagingObjectExists(supabase, stagingKey) {
  const dir = stagingKey.substring(0, stagingKey.lastIndexOf('/'));
  const name = stagingKey.substring(stagingKey.lastIndexOf('/') + 1);
  const { data, error } = await supabase.storage.from(STAGING_BUCKET).list(dir, { search: name });
  if (error) return false;
  return (data || []).some(o => o.name === name);
}

async function deleteStagingObject(supabase, stagingKey) {
  try {
    await supabase.storage.from(STAGING_BUCKET).remove([stagingKey]);
  } catch (err) {
    console.warn('[creator-upload] Staging-Delete fehlgeschlagen:', err.message || err);
  }
}

// ─── HTTP ───────────────────────────────────────────────────
// Gleiche Origin wie die Upload-Seite -> bewusst KEINE CORS-Header.

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

function methodGuard(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }
  return null;
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return null;
  }
}

module.exports = {
  STAGING_BUCKET,
  SUPABASE_URL,
  TOKEN_TTL_DAYS,
  MAX_VERSIONS,
  SIZE_CAPS,
  getServiceClient,
  generateRawToken,
  hashToken,
  encryptToken,
  decryptToken,
  resolveToken,
  loadMembership,
  resolveTarget,
  validateFile,
  nextVersionNumber,
  checkJobRateLimit,
  checkAndBumpMailRateLimit,
  loadPathContext,
  buildTargetPath,
  buildVersionedFileName,
  getAccessToken,
  dropboxSaveUrl,
  dropboxCheckSaveUrl,
  dropboxEnsureSharedLink,
  dropboxDelete,
  createStagingUploadUrl,
  createStagingDownloadUrl,
  stagingObjectExists,
  deleteStagingObject,
  json,
  methodGuard,
  parseBody,
};
