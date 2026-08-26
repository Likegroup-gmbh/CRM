// creator-upload-abort.js
// Client bricht einen gestarteten Upload ab (Fehler, Seitenwechsel). Gibt den
// In-Flight-Lock sofort frei, sonst blockiert der Slot bis zur Stale-GC.
// Nur pending ist abbrechbar: processing laeuft bereits in Dropbox/Finalize.

const {
  getServiceClient,
  resolveToken,
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

  try {
    const supabase = getServiceClient();
    const tokenRow = await resolveToken(supabase, body.token);
    if (!tokenRow) return json(404, { error: 'Link ungültig oder abgelaufen' });

    const { data: job, error } = await supabase
      .from('creator_upload_job')
      .select('id, status, staging_key')
      .eq('id', body.jobId)
      .eq('token_id', tokenRow.id)
      .maybeSingle();
    if (error) throw error;
    if (!job) return json(404, { error: 'Upload nicht gefunden' });

    if (job.status === 'pending') {
      await supabase.from('creator_upload_job')
        .update({ status: 'aborted', error: 'Abgebrochen', updated_at: new Date().toISOString() })
        .eq('id', job.id);
      await deleteStagingObject(supabase, job.staging_key);
    }

    return json(200, { status: 'aborted' });
  } catch (err) {
    console.error('[creator-upload-abort]', err);
    return json(500, { error: 'Interner Fehler' });
  }
};
