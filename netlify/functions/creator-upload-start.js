// creator-upload-start.js
// startUpload(token, targetType, targetId, file): legt Server-Job an und gibt
// eine Signed-Upload-URL (TUS x-signature Token) nur fuer diesen Staging-Key.
// Ziel und FS-Nummer kommen ausschliesslich vom Server.

const crypto = require('crypto');
const {
  STAGING_BUCKET,
  SUPABASE_URL,
  getServiceClient,
  resolveToken,
  resolveTarget,
  validateFile,
  nextVersionNumber,
  checkJobRateLimit,
  createStagingUploadUrl,
  deleteStagingObject,
  json,
  methodGuard,
  parseBody,
} = require('./_shared/creator-upload');

exports.handler = async (event) => {
  const guard = methodGuard(event);
  if (guard) return guard;

  const body = parseBody(event);
  if (!body) return json(400, { error: 'Ungueltiger Request' });

  const { token, targetType, targetId, fileName, fileSize, contentType } = body;
  if (!['video', 'story', 'bilder'].includes(targetType) || !targetId) {
    return json(400, { error: 'Ungueltiges Ziel' });
  }

  try {
    const supabase = getServiceClient();
    const tokenRow = await resolveToken(supabase, token);
    if (!tokenRow) return json(404, { error: 'Link ungültig oder abgelaufen' });

    // Ziel muss zur Live-Membership des Tokens gehoeren
    const targetCtx = await resolveTarget(supabase, tokenRow, targetType, targetId);
    if (!targetCtx) return json(404, { error: 'Link ungültig oder abgelaufen' });

    const fileCheck = validateFile(targetType, fileName, fileSize, contentType);
    if (!fileCheck.ok) return json(400, { error: fileCheck.error, code: fileCheck.code });

    // Rate-Limit: Uploads pro Token
    if (!(await checkJobRateLimit(supabase, tokenRow.id))) {
      return json(429, { error: 'Zu viele Uploads. Bitte später erneut versuchen.', code: 'rate_limited' });
    }

    // FS-Nummer serverseitig (Video/Story); null = alle belegt
    let versionNumber = null;
    if (targetType !== 'bilder') {
      versionNumber = await nextVersionNumber(supabase, targetType, targetId);
      if (versionNumber == null) {
        return json(409, { error: 'Alle Feedbackschleifen sind bereits belegt', code: 'fs_full' });
      }
    }

    const stagingKey = `${tokenRow.id}/${targetType}/${targetId}/${crypto.randomUUID()}.${fileCheck.ext}`;

    // Abandoned Jobs freigeben, sonst blockiert ein geschlossener Laptop-Deckel
    // den Slot bis zur taeglichen GC: pending > 15 Min / processing > 60 Min.
    const now = Date.now();
    const { data: activeJobs } = await supabase
      .from('creator_upload_job')
      .select('id, status, created_at, staging_key')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .in('status', ['pending', 'processing']);
    for (const old of activeJobs || []) {
      const ageMs = now - new Date(old.created_at).getTime();
      const staleMs = old.status === 'pending' ? 15 * 60 * 1000 : 60 * 60 * 1000;
      if (ageMs > staleMs) {
        await supabase.from('creator_upload_job')
          .update({ status: 'aborted', error: 'Verworfen — neuer Upload gestartet', updated_at: new Date().toISOString() })
          .eq('id', old.id);
        await deleteStagingObject(supabase, old.staging_key);
      }
    }

    const { data: job, error: jobErr } = await supabase
      .from('creator_upload_job')
      .insert({
        token_id: tokenRow.id,
        target_type: targetType,
        target_id: targetId,
        staging_key: stagingKey,
        version_number: versionNumber,
        file_name: String(fileName || 'datei').slice(0, 255),
        file_size: Number(fileSize),
        content_type: fileCheck.contentType,
        status: 'pending',
      })
      .select('id')
      .single();

    if (jobErr) {
      // In-Flight-Unique: laeuft bereits ein Upload fuer dieses Ziel
      if (jobErr.code === '23505') {
        return json(409, { error: 'Für dieses Ziel läuft bereits ein Upload', code: 'in_flight' });
      }
      throw jobErr;
    }

    const signed = await createStagingUploadUrl(supabase, stagingKey);

    return json(200, {
      jobId: job.id,
      versionNumber,
      contentType: fileCheck.contentType,
      // TUS: endpoint + x-signature Token (kein Anon-Key noetig)
      uploadToken: signed.token,
      stagingPath: signed.path,
      uploadEndpoint: `${SUPABASE_URL}/storage/v1/upload/resumable/sign`,
      bucket: STAGING_BUCKET,
    });
  } catch (err) {
    console.error('[creator-upload-start]', err);
    return json(500, { error: 'Interner Fehler' });
  }
};
