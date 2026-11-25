// management-anfrage-send.js
// Management-Anfrage: eine Mail pro Empfaenger, eigener Link, kein PDF.
// Der Server loest die Adresse auf, legt den Link an und verschickt.
// Schlaegt der Versand fehl, wird der Link wieder geloescht.

const crypto = require('crypto');
const { verifyAuth, requireInternal, authErrorBody } = require('./_shared/verify-auth');
const { sendResendMail } = require('./_shared/resend');
const { managementAnfrageMail } = require('./_shared/mail-system');
const { hashToken, getServiceClient, json, parseBody } = require('./_shared/bewerbung');

const CONCURRENCY = 5;
const MAX_BETREFF = 200;
const MAX_BODY = 8000;

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textToHtml(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function pageBaseFromEvent(event) {
  const configured = String(process.env.APP_BASE_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  const headers = event?.headers || {};
  const origin = String(headers.origin || headers.Origin || '').trim().replace(/\/$/, '');
  if (/^https?:\/\//i.test(origin)) return origin;
  const proto = headers['x-forwarded-proto'] || 'https';
  const host = headers['x-forwarded-host'] || headers.host;
  if (host) return `${proto}://${host}`.replace(/\/$/, '');
  return '';
}

function linkUrl(pageBase, token) {
  return `${pageBase}/src/bewerbung/bewerbung.html?token=${encodeURIComponent(token)}`;
}

function dedupe(empfaenger) {
  const seen = new Set();
  const unique = [];
  for (const row of empfaenger) {
    const managementId = row?.managementId || row?.management_id;
    const ansprechpartnerId = row?.ansprechpartnerId || row?.ansprechpartner_id || null;
    if (!managementId) continue;
    const key = `${managementId}:${ansprechpartnerId || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ managementId, ansprechpartnerId });
  }
  return unique;
}

async function resolveRecipient(supabase, { managementId, ansprechpartnerId }) {
  const { data: management, error } = await supabase
    .from('management')
    .select('id, firmenname, email')
    .eq('id', managementId)
    .maybeSingle();
  if (error) throw error;
  if (!management) return { error: 'Management nicht gefunden' };

  if (!ansprechpartnerId) {
    if (!management.email) {
      return { error: `${management.firmenname || 'Management'} hat keine E-Mail`, name: management.firmenname || '' };
    }
    return {
      email: management.email,
      name: management.firmenname || management.email,
      managementId: management.id,
      ansprechpartnerId: null,
    };
  }

  const { data: person, error: personError } = await supabase
    .from('ansprechpartner')
    .select('id, vorname, nachname, email, management_id')
    .eq('id', ansprechpartnerId)
    .maybeSingle();
  if (personError) throw personError;
  const name = [person?.vorname, person?.nachname].filter(Boolean).join(' ');
  if (!person || person.management_id !== managementId) {
    return { error: 'Ansprechpartner gehört nicht zum Management', name: management.firmenname || '' };
  }
  if (!person.email) {
    return { error: `${name || 'Ansprechpartner'} hat keine E-Mail`, name };
  }
  return {
    email: person.email,
    name: name || person.email,
    managementId: management.id,
    ansprechpartnerId: person.id,
  };
}

async function sendManagementAnfragen({ supabase, sendMail, benutzerId, pageBase }, payload) {
  const castingId = payload?.castingId;
  const betreff = String(payload?.betreff || '').trim();
  const mailBody = String(payload?.body || '').trim();
  const empfaenger = dedupe(Array.isArray(payload?.empfaenger) ? payload.empfaenger : []);

  if (!castingId) return { status: 400, body: { error: 'Wähle ein Casting.' } };
  if (!betreff || !mailBody) return { status: 400, body: { error: 'Betreff und Text sind Pflicht.' } };
  if (betreff.length > MAX_BETREFF || mailBody.length > MAX_BODY) {
    return { status: 400, body: { error: 'Betreff oder Text ist zu lang.' } };
  }
  if (!empfaenger.length) return { status: 400, body: { error: 'Wähle mindestens ein Management.' } };
  if (!pageBase) return { status: 500, body: { error: 'Basis-URL fehlt' } };

  const { data: casting, error: castingError } = await supabase
    .from('creator_auswahl')
    .select('id')
    .eq('id', castingId)
    .maybeSingle();
  if (castingError) throw castingError;
  if (!casting) return { status: 400, body: { error: 'Casting nicht gefunden' } };

  let sent = 0;
  let failed = 0;
  const errors = [];

  const sendOne = async (target) => {
    const resolved = await resolveRecipient(supabase, target);
    if (resolved.error) {
      failed += 1;
      errors.push({ name: resolved.name || '', email: '', error: resolved.error });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const { data: row, error: insertError } = await supabase
      .from('management_anfrage_link')
      .insert({
        creator_auswahl_id: castingId,
        management_id: resolved.managementId,
        ansprechpartner_id: resolved.ansprechpartnerId,
        email: resolved.email,
        token_hash: hashToken(token),
        betreff,
        body: mailBody,
        created_by: benutzerId || null,
      })
      .select('id')
      .single();
    if (insertError || !row?.id) {
      failed += 1;
      errors.push({ name: resolved.name, email: resolved.email, error: insertError?.message || 'Link konnte nicht angelegt werden' });
      return;
    }

    const link = linkUrl(pageBase, token);
    const { html } = managementAnfrageMail({
      betreff,
      textHtml: textToHtml(mailBody),
      link,
      basisUrl: pageBase,
    });
    let result;
    try {
      result = await sendMail({ to: resolved.email, subject: betreff, html });
    } catch (err) {
      result = { ok: false, error: err?.message || 'Versand fehlgeschlagen' };
    }
    if (result?.ok) {
      sent += 1;
      return;
    }

    failed += 1;
    errors.push({ name: resolved.name, email: resolved.email, error: result?.error || 'Versand fehlgeschlagen' });
    const { error: deleteError } = await supabase
      .from('management_anfrage_link')
      .delete()
      .eq('id', row.id);
    if (deleteError) console.error('[management-anfrage-send] Link nach Fehlversand nicht geloescht:', deleteError);
  };

  for (let i = 0; i < empfaenger.length; i += CONCURRENCY) {
    const chunk = empfaenger.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(chunk.map(sendOne));
    for (const r of results) {
      if (r.status === 'rejected') {
        failed += 1;
        errors.push({ name: '', email: '', error: 'Versand fehlgeschlagen' });
        console.error('[management-anfrage-send] Empfaenger fehlgeschlagen:', r.reason);
      }
    }
  }

  return { status: 200, body: { sent, failed, total: empfaenger.length, errors } };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const supabase = getServiceClient();
    const auth = await verifyAuth(event, supabase);
    if (!auth.user) return json(401, authErrorBody(auth));
    const internal = await requireInternal(supabase, auth.user);
    if (!internal.ok) return internal.response;

    const body = parseBody(event);
    if (!body) return json(400, { error: 'Ungueltiger Request' });

    const result = await sendManagementAnfragen(
      {
        supabase,
        sendMail: sendResendMail,
        benutzerId: internal.benutzer.id,
        pageBase: pageBaseFromEvent(event),
      },
      body
    );
    return json(result.status, result.body);
  } catch (err) {
    console.error('[management-anfrage-send]', err);
    return json(500, { error: 'Interner Fehler' });
  }
};

module.exports.sendManagementAnfragen = sendManagementAnfragen;
module.exports.pageBaseFromEvent = pageBaseFromEvent;
module.exports.textToHtml = textToHtml;
