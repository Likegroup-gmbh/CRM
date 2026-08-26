// creator-upload-complete.js
// Client meldet "Staging-PUT fertig". Der Job arbeitet NUR aus der Server-Row:
// staging_key, Ziel, FS-Nummer. Startet Dropbox save_url (Dropbox zieht die
// Datei serverseitig aus dem Staging — keine Bytes durch diese Function).

const {
  getServiceClient,
  resolveToken,
  resolveTarget,
  loadPathContext,
  buildTargetPath,
  getAccessToken,
  dropboxSaveUrl,
  createStagingDownloadUrl,
  stagingObjectExists,
  deleteStagingObject,
  json,
  methodGuard,
  parseBody,
} = require('./_shared/creator-upload');
const { finalizeJob } = require('./_shared/creator-upload-finalize');

async function loadJob(supabase, tokenRow, jobId) {
  const { data, error } = await supabase
    .from('creator_upload_job')
    .select('*')
    .eq('id', jobId)
    .eq('token_id', tokenRow.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

exports.handler = async (event) => {
  const guard = methodGuard(event);
  if (guard) return guard;

  const body = parseBody(event);
  if (!body) return json(400, { error: 'Ungueltiger Request' });

  try {
    const supabase = getServiceClient();
    const tokenRow = await resolveToken(supabase, body.token);
    if (!tokenRow) return json(404, { error: 'Link ungültig oder abgelaufen' });

    const job = await loadJob(supabase, tokenRow, body.jobId);
    if (!job) return json(404, { error: 'Upload nicht gefunden' });
    if (job.status === 'done') return json(200, { status: 'done', versionNumber: job.version_number });
    if (job.status !== 'pending') return json(409, { error: 'Upload wird bereits verarbeitet' });

    // Staging-Objekt muss existieren (Client-Behauptung reicht nicht)
    if (!(await stagingObjectExists(supabase, job.staging_key))) {
      return json(400, { error: 'Datei nicht hochgeladen' });
    }

    const targetCtx = await resolveTarget(supabase, tokenRow, job.target_type, job.target_id);
    if (!targetCtx) {
      await supabase.from('creator_upload_job').update({ status: 'aborted', error: 'Ziel nicht mehr verfuegbar', updated_at: new Date().toISOString() }).eq('id', job.id);
      await deleteStagingObject(supabase, job.staging_key);
      return json(404, { error: 'Link ungültig oder abgelaufen' });
    }

    job._ext = (job.file_name.split('.').pop() || '').toLowerCase();
    const pathCtx = await loadPathContext(supabase, tokenRow, targetCtx.koop.id);
    const { filePath, folderPath } = buildTargetPath(pathCtx, job, targetCtx);
    job._folderPath = folderPath;

    const downloadUrl = await createStagingDownloadUrl(supabase, job.staging_key);
    if (!downloadUrl) throw new Error('Staging-Download-URL fehlgeschlagen');

    const dropboxToken = await getAccessToken();
    const saveResult = await dropboxSaveUrl(dropboxToken, filePath, downloadUrl);

    if (saveResult['.tag'] === 'complete') {
      const { assetId, version } = await finalizeJob(supabase, job, targetCtx, dropboxToken, filePath);
      await deleteStagingObject(supabase, job.staging_key);
      await supabase.from('creator_upload_job')
        .update({ status: 'done', dropbox_path: filePath, asset_id: assetId, version_number: version ?? job.version_number, updated_at: new Date().toISOString() })
        .eq('id', job.id);
      return json(200, { status: 'done', versionNumber: version ?? job.version_number });
    }

    // async: Dropbox zieht die Datei, Status per creator-upload-status
    await supabase.from('creator_upload_job')
      .update({ status: 'processing', dropbox_path: filePath, dropbox_save_job_id: saveResult.async_job_id, updated_at: new Date().toISOString() })
      .eq('id', job.id);

    return json(200, { status: 'processing' });
  } catch (err) {
    console.error('[creator-upload-complete]', err);
    return json(500, { error: 'Interner Fehler' });
  }
};
