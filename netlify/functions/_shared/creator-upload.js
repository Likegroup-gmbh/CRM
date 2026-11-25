// _shared/creator-upload.js
// Gemeinsame Server-Logik fuer den tokenisierten Creator-Upload: Token, Ziel, Datei-Regeln.
// Hochgeladen wird direkt nach SharePoint (ablage/creator.js).
// NUR service role. Kein Client-Zugriff auf Token-/Job-Tabellen (RLS deny-all).

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { loadMembership, resolveTarget } = require('./creator-upload-ziel');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const TOKEN_TTL_DAYS = 90;
const MAX_VERSIONS = 3;

// Rate-Limits (DB-basiert)
const MAX_JOBS_PER_TOKEN_PER_HOUR = 40;
const MAX_MAILS_PER_TOKEN_PER_HOUR = 5;

// Groessen-Caps pro Zieltyp (Bytes)
const SIZE_CAPS = {
  video: 2 * 1024 * 1024 * 1024,        // 2 GB
  story: 500 * 1024 * 1024,             // 500 MB
  bilder: 55 * 1024 * 1024,             // 55 MB
  rohmaterial: 10 * 1024 * 1024 * 1024, // 10 GB (unkomprimierte Clips)
};

const EXT_BY_TYPE = {
  video: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
  story: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
  bilder: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'tiff', 'tif', 'avif'],
  rohmaterial: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'zip',
    'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'tiff', 'tif', 'avif'],
};

const MIME_BY_EXT = {
  mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
  mkv: 'video/x-matroska', webm: 'video/webm',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif', gif: 'image/gif', bmp: 'image/bmp',
  tiff: 'image/tiff', tif: 'image/tiff', avif: 'image/avif',
  zip: 'application/zip',
};

// Zieltyp-Regeln. Beide Flags haengen an derselben Frage — nimmt ein Ziel genau
// eine Datei pro Abgabe auf?
//   versioned:      Datei belegt eine Feedbackschleife (serverseitige FS-Nummer)
//   singleInFlight: nur ein aktiver Upload pro Ziel. Deckungsgleich mit dem
//                   Unique-Index creator_upload_job_inflight_unique; Rohmaterial
//                   ist ein Multi-Datei-Dump auf dieselbe Kooperation und darf
//                   dort nicht gesperrt werden.
const TARGET_RULES = {
  video:       { versioned: true,  singleInFlight: true },
  story:       { versioned: true,  singleInFlight: true },
  bilder:      { versioned: false, singleInFlight: true },
  rohmaterial: { versioned: false, singleInFlight: false },
};

function isKnownTarget(targetType) {
  return Object.prototype.hasOwnProperty.call(TARGET_RULES, targetType);
}

function isVersionedTarget(targetType) {
  return !!TARGET_RULES[targetType]?.versioned;
}

function holdsInFlightLock(targetType) {
  return !!TARGET_RULES[targetType]?.singleInFlight;
}

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

// ─── Datei-Validierung ──────────────────────────────────────

function validateFile(targetType, fileName, fileSize, contentType) {
  const ext = (String(fileName || '').split('.').pop() || '').toLowerCase();
  if (!EXT_BY_TYPE[targetType]?.includes(ext)) {
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

// ─── Dateiname + Namen fuer die Ablage ──────────────────────

function sanitizeFilePart(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

function buildVersionedFileName(creatorName, unternehmen, kampagne, videoPosition, version, ext) {
  const parts = [creatorName, unternehmen, kampagne].map(sanitizeFilePart).filter(Boolean);
  parts.push(String(videoPosition || 1));
  parts.push(`v${version}`);
  return parts.join('_') + '.' + ext;
}

// Namen fuer Dateiname und Creator-Ordner (Unternehmen/Marke/Kampagne/Kooperation/Creator)
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
  SUPABASE_URL,
  TOKEN_TTL_DAYS,
  MAX_VERSIONS,
  SIZE_CAPS,
  EXT_BY_TYPE,
  TARGET_RULES,
  isKnownTarget,
  isVersionedTarget,
  holdsInFlightLock,
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
  buildVersionedFileName,
  json,
  methodGuard,
  parseBody,
};
