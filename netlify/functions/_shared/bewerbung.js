// Oeffentliche Bewerbungsseite: Token-Hash, Pruefung der Zeilen, Briefing ohne interne Felder.
// Service-Role only fuer Lesen und Anlegen. Das Team liest die Tabelle direkt.

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const BRIEFING_FELDER = [
  ['beschreibung', 'Schwerpunkt'],
  ['aufgabe', 'Aufgabe'],
  ['plattformmechanik', 'Plattformmechanik'],
  ['veroeffentlichungszeitraum', 'Veröffentlichungszeitraum'],
  ['content_deadline', 'Content-Deadline'],
  ['go_live', 'Go-Live'],
  ['freigabeprozess', 'Freigabeprozess'],
  ['voraussetzungen_sonstiges', 'Sonstige Voraussetzungen'],
  ['vorgaben_ausschluesse', 'Vorgaben und Ausschlüsse'],
];

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function clean(value) {
  return String(value ?? '').trim();
}

function profileUrl(value, build) {
  const raw = clean(value);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return build(raw.replace(/^@/, ''));
}

function validateZeile(row) {
  const vorname = clean(row?.vorname);
  const nachname = clean(row?.nachname);
  const linkInstagram = profileUrl(
    row?.link_instagram ?? row?.instagram,
    (handle) => `https://instagram.com/${handle}`
  );
  const linkTiktok = profileUrl(
    row?.link_tiktok ?? row?.tiktok,
    (handle) => `https://www.tiktok.com/@${handle}`
  );
  if (!vorname || !nachname) return { ok: false, error: 'Vorname und Nachname sind Pflicht.' };
  if (!linkInstagram && !linkTiktok) {
    return { ok: false, error: 'Mindestens ein Instagram- oder TikTok-Link ist Pflicht.' };
  }
  return {
    ok: true,
    zeile: {
      vorname,
      nachname,
      link_instagram: linkInstagram || null,
      link_tiktok: linkTiktok || null,
    },
  };
}

function briefingAbschnitte(row) {
  if (!row) return [];
  return BRIEFING_FELDER
    .map(([key, label]) => {
      const text = clean(row[key]);
      return text ? { label, text } : null;
    })
    .filter(Boolean);
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return null;
  }
}

let _client = null;
function getServiceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('Supabase Service-Konfiguration fehlt');
  }
  if (!_client) {
    _client = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

async function loadByToken(supabase, rawToken) {
  const tokenHash = hashToken(rawToken || '');
  const { data: link, error } = await supabase
    .from('management_anfrage_link')
    .select(`
      id, email, creator_auswahl_id, management_id, ansprechpartner_id, betreff,
      management:management_id(firmenname),
      ansprechpartner:ansprechpartner_id(vorname, nachname),
      casting:creator_auswahl_id(id, name, briefing_id)
    `)
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error) throw error;
  if (!link) return null;

  const { data: bewerbungen, error: listError } = await supabase
    .from('bewerbung')
    .select('id, vorname, nachname, link_instagram, link_tiktok, created_at')
    .eq('link_id', link.id)
    .order('created_at', { ascending: true });
  if (listError) throw listError;

  let briefing = null;
  const briefingId = link.casting?.briefing_id;
  if (briefingId) {
    const { data } = await supabase
      .from('campaign_briefings')
      .select('aktivierung_name, beschreibung, aufgabe, plattformmechanik, veroeffentlichungszeitraum, content_deadline, go_live, freigabeprozess, voraussetzungen_sonstiges, vorgaben_ausschluesse')
      .eq('id', briefingId)
      .maybeSingle();
    briefing = data;
  }

  const person = [link.ansprechpartner?.vorname, link.ansprechpartner?.nachname].filter(Boolean).join(' ');
  return {
    link,
    payload: {
      management: link.management?.firmenname || '',
      ansprechpartner: person || null,
      casting: link.casting?.name || '',
      briefing: {
        title: briefing?.aktivierung_name || link.casting?.name || 'Briefing',
        sections: briefingAbschnitte(briefing),
      },
      bewerbungen: bewerbungen || [],
    },
  };
}

module.exports = {
  hashToken,
  validateZeile,
  briefingAbschnitte,
  json,
  parseBody,
  getServiceClient,
  loadByToken,
};
