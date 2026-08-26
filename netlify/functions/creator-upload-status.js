// creator-upload-status.js
// Pollt den Dropbox-save_url-Status eines processing-Jobs und finalisiert
// (Asset-Row, is_current, Links, folder_url, Staging-Delete).

const {
  getServiceClient,
  resolveToken,
  resolveTarget,
  loadPathContext,
  buildTargetPath,
  getAccessToken,
  dropboxCheckSaveUrl,
  dropboxDelete,
  deleteStagingObject,
  json,
  methodGuard,
  parseBody,
} = require('./_shared/creator-upload');
const { finalizeJob } = require('./_shared/creator-upload-finalize');

exports.handler = async (event) => {
  const guard = methodGuard(event);
  if (guard) return guard;

  const body = parseBody(event);
  if (!body) return json(400, { error: 'Ungueltiger Request' });

  try {
    const supabase = getServiceClient();
    const tokenRow = await resolveToken(supabase, body.token);

    const { data: job, error: jobErr } = await supabase
      .from('creator_upload_job')
      .select('*')
      .eq('id', body.jobId)
      .maybeSingle();
    if (jobErr) throw jobErr;
    if (!job || !tokenRow || job.token_id !== tokenRow.id) {
      return json(404, { error: 'Upload nicht gefunden' });
    }

    if (job.status === 'done') return json(200, { status: 'done', versionNumber: job.version_number });
    if (job.status === 'failed') return json(200, { status: 'failed', error: 'Verarbeitung fehlgeschlagen' });
    if (job.status === 'aborted') return json(200, { status: 'failed', error: 'Upload wurde abgebrochen' });
    if (job.status === 'pending') return json(200, { status: 'pending' });

    // processing: Widerruf waehrend des Transfers -> aufraeumen, nichts eintragen
    const stillValid = await resolveToken(supabase, body.token);
    if (!stillValid) {
      await supabase.from('creator_upload_job').update({ status: 'aborted', updated_at: new Date().toISOString() }).eq('id', job.id);
      await deleteStagingObject(supabase, job.staging_key);
      if (job.dropbox_path) {
        const dropboxToken = await getAccessToken();
        await dropboxDelete(dropboxToken, job.dropbox_path);
      }
      return json(404, { error: 'Link ungültig oder abgelaufen' });
    }

    if (!job.dropbox_save_job_id) {
      return json(409, { error: 'Upload in ungueltigem Zustand' });
    }

    const dropboxToken = await getAccessToken();
    const saveStatus = await dropboxCheckSaveUrl(dropboxToken, job.dropbox_save_job_id);
    const tag = saveStatus['.tag'];

    if (tag === 'in_progress') {
      return json(200, { status: 'processing' });
    }

    if (tag === 'failed') {
      console.warn('[creator-upload-status] save_url failed:', JSON.stringify(saveStatus.error || {}));
      await supabase.from('creator_upload_job')
        .update({ status: 'failed', error: 'Dropbox-Transfer fehlgeschlagen', updated_at: new Date().toISOString() })
        .eq('id', job.id);
      await deleteStagingObject(supabase, job.staging_key);
      return json(200, { status: 'failed', error: 'Verarbeitung fehlgeschlagen' });
    }

    // complete
    const targetCtx = await resolveTarget(supabase, tokenRow, job.target_type, job.target_id);
    if (!targetCtx) {
      await supabase.from('creator_upload_job').update({ status: 'aborted', updated_at: new Date().toISOString() }).eq('id', job.id);
      await deleteStagingObject(supabase, job.staging_key);
      await dropboxDelete(dropboxToken, job.dropbox_path);
      return json(404, { error: 'Link ungültig oder abgelaufen' });
    }

    job._ext = (job.file_name.split('.').pop() || '').toLowerCase();
    const pathCtx = await loadPathContext(supabase, tokenRow, targetCtx.koop.id);
    const { folderPath } = buildTargetPath(pathCtx, job, targetCtx);
    job._folderPath = folderPath;

    const { assetId, version } = await finalizeJob(supabase, job, targetCtx, dropboxToken, job.dropbox_path);
    await deleteStagingObject(supabase, job.staging_key);
    await supabase.from('creator_upload_job')
      .update({ status: 'done', asset_id: assetId, version_number: version ?? job.version_number, updated_at: new Date().toISOString() })
      .eq('id', job.id);

    return json(200, { status: 'done', versionNumber: version ?? job.version_number });
  } catch (err) {
    console.error('[creator-upload-status]', err);
    return json(500, { error: 'Interner Fehler' });
  }
};
