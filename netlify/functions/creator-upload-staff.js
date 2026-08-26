// creator-upload-staff.js
// Staff-Aktionen fuer den Creator-Upload (Video-Tabelle Aktionsmenue).
// Alle Aktionen: verifyAuth + requireInternal.

const {
  TOKEN_TTL_DAYS,
  getServiceClient,
  generateRawToken,
  hashToken,
  encryptToken,
  decryptToken,
  checkAndBumpMailRateLimit,
  json,
  methodGuard,
  parseBody,
} = require('./_shared/creator-upload');
const { verifyAuth, requireInternal, authErrorBody } = require('./_shared/verify-auth');
const { sendCreatorUploadMail } = require('./_shared/creator-upload-mail');

function buildPageBaseUrl(event) {
  const proto = event.headers['x-forwarded-proto'] || 'https';
  const host = event.headers.host || 'localhost:3000';
  return `${proto}://${host}/src/upload/creator-upload.html`;
}

async function loadContext(supabase, kampagneId, creatorId) {
  const { data: koop, error } = await supabase
    .from('kooperationen')
    .select(`id, kampagne:kampagne_id(id, kampagnenname, eigener_name,
        unternehmen:unternehmen_id(id, kein_dropbox)),
      creator:creator_id(id, vorname, nachname, mail)`)
    .eq('kampagne_id', kampagneId)
    .eq('creator_id', creatorId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return koop;
}

async function findActiveToken(supabase, kampagneId, creatorId) {
  const { data, error } = await supabase
    .from('creator_upload_token')
    .select('*')
    .eq('kampagne_id', kampagneId)
    .eq('creator_id', creatorId)
    .is('revoked_at', null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function mintToken(supabase, kampagneId, creatorId, benutzerId) {
  // Bestehende (auch abgelaufene) aktive Tokens widerrufen: Partial Unique
  // auf (kampagne, creator) laesst sonst keinen neuen zu.
  await supabase
    .from('creator_upload_token')
    .update({ revoked_at: new Date().toISOString() })
    .eq('kampagne_id', kampagneId)
    .eq('creator_id', creatorId)
    .is('revoked_at', null);

  const raw = generateRawToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('creator_upload_token')
    .insert({
      token_hash: hashToken(raw),
      token_encrypted: encryptToken(raw),
      kampagne_id: kampagneId,
      creator_id: creatorId,
      expires_at: expiresAt,
      created_by: benutzerId,
    })
    .select('id, expires_at')
    .single();
  if (error) throw error;
  return { raw, tokenId: data.id, expiresAt };
}

async function sendMailForToken(supabase, event, tokenRow, rawToken, koop) {
  const allowed = await checkAndBumpMailRateLimit(supabase, tokenRow.id, tokenRow);
  if (!allowed) {
    return { ok: false, status: 429, error: 'Zu viele E-Mails für diesen Creator. Bitte später erneut versuchen.' };
  }
  const link = `${buildPageBaseUrl(event)}#t=${rawToken}`;
  const kamp = koop.kampagne || {};
  const result = await sendCreatorUploadMail({
    to: koop.creator.mail,
    creatorVorname: koop.creator.vorname,
    kampagneName: kamp.kampagnenname || kamp.eigener_name || '',
    link,
    expiresAt: tokenRow.expires_at,
  });
  if (!result.ok) return { ok: false, status: 502, error: `E-Mail-Versand fehlgeschlagen: ${result.error}` };
  return { ok: true, expiresAt: tokenRow.expires_at };
}

exports.handler = async (event) => {
  const guard = methodGuard(event);
  if (guard) return guard;

  try {
    const supabase = getServiceClient();
    const auth = await verifyAuth(event, supabase);
    if (!auth.user) return json(401, authErrorBody(auth));
    const internal = await requireInternal(supabase, auth.user);
    if (!internal.ok) return internal.response;

    const body = parseBody(event);
    if (!body) return json(400, { error: 'Ungueltiger Request' });

    const { action, kampagneId, creatorId } = body;
    if (!kampagneId) return json(400, { error: 'kampagneId fehlt' });

    // Tabellen-Zustand: alle aktiven Tokens der Kampagne
    if (action === 'status') {
      const { data, error } = await supabase
        .from('creator_upload_token')
        .select('creator_id, expires_at, last_sent_at')
        .eq('kampagne_id', kampagneId)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString());
      if (error) throw error;
      return json(200, { tokens: data || [] });
    }

    if (!creatorId) return json(400, { error: 'creatorId fehlt' });

    if (action === 'revoke') {
      const tokenRow = await findActiveToken(supabase, kampagneId, creatorId);
      if (!tokenRow) return json(404, { error: 'Kein aktiver Zugang vorhanden' });
      await supabase.from('creator_upload_token')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', tokenRow.id);
      await supabase.from('creator_upload_job')
        .update({ status: 'aborted', updated_at: new Date().toISOString() })
        .eq('token_id', tokenRow.id)
        .in('status', ['pending', 'processing']);
      return json(200, { revoked: true });
    }

    if (action === 'link') {
      const tokenRow = await findActiveToken(supabase, kampagneId, creatorId);
      if (!tokenRow || new Date(tokenRow.expires_at).getTime() <= Date.now()) {
        return json(404, { error: 'Kein aktiver Link — bitte erst senden' });
      }
      const raw = decryptToken(tokenRow.token_encrypted);
      return json(200, { link: `${buildPageBaseUrl(event)}#t=${raw}`, expiresAt: tokenRow.expires_at });
    }

    if (action === 'send' || action === 'resend') {
      const koop = await loadContext(supabase, kampagneId, creatorId);
      if (!koop) return json(404, { error: 'Keine Kooperation für diesen Creator in dieser Kampagne' });
      if (koop.kampagne?.unternehmen?.kein_dropbox) {
        return json(400, { error: 'Dieses Unternehmen nutzt kein Dropbox — Creator-Upload nicht möglich' });
      }
      if (!koop.creator?.mail) {
        return json(400, { error: 'Keine E-Mail-Adresse beim Creator hinterlegt' });
      }

      const existing = await findActiveToken(supabase, kampagneId, creatorId);
      const existingValid = existing && new Date(existing.expires_at).getTime() > Date.now();

      // send bei gueltigem Token: denselben Link nochmal mailen (nicht rotieren)
      if (action === 'send' && existingValid) {
        const raw = decryptToken(existing.token_encrypted);
        const mailed = await sendMailForToken(supabase, event, existing, raw, koop);
        if (!mailed.ok) return json(mailed.status, { error: mailed.error });
        return json(200, { sent: true, reused: true, expiresAt: mailed.expiresAt });
      }

      // resend ODER abgelaufener/kein Token: rotieren bzw. neu minten
      const minted = await mintToken(supabase, kampagneId, creatorId, internal.benutzer.id);
      const tokenRow = { id: minted.tokenId, expires_at: minted.expiresAt, mail_count: 0, mail_window_start: null };
      const mailed = await sendMailForToken(supabase, event, tokenRow, minted.raw, koop);
      if (!mailed.ok) return json(mailed.status, { error: mailed.error });
      return json(200, { sent: true, reused: false, expiresAt: mailed.expiresAt });
    }

    return json(400, { error: 'Unbekannte Aktion' });
  } catch (err) {
    console.error('[creator-upload-staff]', err);
    return json(500, { error: 'Interner Fehler' });
  }
};
