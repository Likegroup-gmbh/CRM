// _shared/creator-upload-finalize.js
// Finalisiert einen Creator-Upload, nachdem die Datei in Dropbox liegt:
// Asset-Row + is_current-Flip + Shared-Links + folder_url + Staging-Delete.
// Spiegelt runVideoUploadJob/runStorysUploadJob/BilderTabHandler (Staff).

const {
  MAX_VERSIONS,
  nextVersionNumber,
  dropboxEnsureSharedLink,
  deleteStagingObject,
} = require('./creator-upload');

async function flipCurrentFlags(supabase, table, fk, targetId) {
  const { data: assets } = await supabase
    .from(table)
    .select('id, version_number, is_final')
    .eq(fk, targetId);
  const all = (assets || []).filter(a => !a.is_final);
  if (all.length === 0) return;
  const maxVersion = Math.max(...all.map(a => a.version_number));
  const nonCurrent = all.filter(a => a.version_number !== maxVersion).map(a => a.id);
  const current = all.filter(a => a.version_number === maxVersion).map(a => a.id);
  if (nonCurrent.length > 0) {
    await supabase.from(table).update({ is_current: false }).in('id', nonCurrent);
  }
  if (current.length > 0) {
    await supabase.from(table).update({ is_current: true }).in('id', current);
  }
}

// Falls Staff zwischen startUpload und jetzt dieselbe FS belegt hat: naechste
// freie nehmen (Ordnername weicht dann ab, wird geloggt).
async function ensureFreeVersion(supabase, job) {
  if (job.target_type === 'bilder') return null;
  const table = job.target_type === 'video' ? 'kooperation_video_asset' : 'kooperation_story_asset';
  const fk = job.target_type === 'video' ? 'video_id' : 'story_id';
  const { data } = await supabase
    .from(table)
    .select('id')
    .eq(fk, job.target_id)
    .eq('version_number', job.version_number)
    .eq('is_final', false)
    .limit(1);
  if (!data || data.length === 0) return job.version_number;
  const next = await nextVersionNumber(supabase, job.target_type, job.target_id);
  if (next == null) throw new Error('Alle Feedbackschleifen sind inzwischen belegt');
  console.warn(`[creator-upload] FS ${job.version_number} war belegt, verschiebe auf ${next} (Job ${job.id})`);
  return next;
}

// Bilder: kein Ueberschreiben — bei Kollision _2, _3, ... vor der Extension.
async function resolveBilderCollision(supabase, kooperationId, filePath) {
  const { data } = await supabase
    .from('kooperation_bilder_asset')
    .select('file_path')
    .eq('kooperation_id', kooperationId);
  const taken = new Set((data || []).map(r => r.file_path));
  if (!taken.has(filePath)) return filePath;
  const dir = filePath.substring(0, filePath.lastIndexOf('/'));
  const name = filePath.substring(filePath.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 2; i < 100; i++) {
    const candidate = `${dir}/${stem}_${i}${ext}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error('Dateiname kollidiert zu oft');
}

/**
 * @param {object} supabase Service-Client
 * @param {object} job creator_upload_job-Row
 * @param {object} targetCtx Ergebnis von resolveTarget()
 * @param {string} dropboxToken
 * @param {string} dropboxPath tatsaechlicher Ablagepfad
 */
async function finalizeJob(supabase, job, targetCtx, dropboxToken, dropboxPath) {
  const version = await ensureFreeVersion(supabase, job);

  let fileUrl = await dropboxEnsureSharedLink(dropboxToken, dropboxPath);

  if (job.target_type === 'video') {
    const { data: asset, error } = await supabase
      .from('kooperation_video_asset')
      .insert({
        video_id: job.target_id,
        file_url: fileUrl,
        file_path: dropboxPath,
        file_name: job.file_name,
        file_size: job.file_size,
        version_number: version,
        variant_name: null,
        is_current: true,
        is_final: false,
        description: null,
        uploaded_by: null,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) throw error;

    await flipCurrentFlags(supabase, 'kooperation_video_asset', 'video_id', job.target_id);

    const folderUrl = await dropboxEnsureSharedLink(dropboxToken, job._folderPath);
    const updateData = {};
    if (fileUrl) updateData.link_content = fileUrl;
    if (folderUrl) updateData.folder_url = folderUrl;
    if (Object.keys(updateData).length > 0) {
      await supabase.from('kooperation_videos').update(updateData).eq('id', job.target_id);
    }
    return { assetId: asset.id, version };
  }

  if (job.target_type === 'story') {
    const { data: asset, error } = await supabase
      .from('kooperation_story_asset')
      .insert({
        story_id: job.target_id,
        video_id: targetCtx.video.id,
        file_url: fileUrl,
        file_path: dropboxPath,
        file_name: job.file_name,
        file_size: job.file_size,
        version_number: version,
        variant_name: null,
        is_current: true,
        is_final: false,
        uploaded_by: null,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) throw error;

    await flipCurrentFlags(supabase, 'kooperation_story_asset', 'story_id', job.target_id);

    const folderUrl = await dropboxEnsureSharedLink(dropboxToken, job._folderPath);
    if (folderUrl) {
      await supabase.from('kooperation_videos').update({ story_folder_url: folderUrl }).eq('id', targetCtx.video.id);
    }
    return { assetId: asset.id, version };
  }

  // bilder
  const finalPath = await resolveBilderCollision(supabase, job.target_id, dropboxPath);
  if (finalPath !== dropboxPath) {
    // save_url hat bereits unter dropboxPath abgelegt -> verschieben
    const moveResp = await fetch('https://api.dropboxapi.com/2/files/move_v2', {
      method: 'POST',
      headers: { Authorization: `Bearer ${dropboxToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_path: dropboxPath, to_path: finalPath, autorename: false }),
    });
    if (!moveResp.ok) {
      const err = await moveResp.json().catch(() => ({}));
      throw new Error(`Dropbox move fehlgeschlagen: ${err.error_summary || moveResp.status}`);
    }
    fileUrl = await dropboxEnsureSharedLink(dropboxToken, finalPath);
  }

  const { data: asset, error } = await supabase
    .from('kooperation_bilder_asset')
    .insert({
      kooperation_id: job.target_id,
      video_id: null,
      file_url: fileUrl,
      file_path: finalPath,
      file_name: finalPath.substring(finalPath.lastIndexOf('/') + 1),
      file_size: job.file_size,
      version_number: 1,
      is_current: true,
      is_final: false,
      variant_name: null,
      uploaded_by: null,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;

  const folderUrl = await dropboxEnsureSharedLink(dropboxToken, job._folderPath);
  if (folderUrl) {
    await supabase.from('kooperationen').update({ bilder_folder_url: folderUrl }).eq('id', job.target_id);
  }
  return { assetId: asset.id, version: null };
}

module.exports = { finalizeJob, deleteStagingObject, MAX_VERSIONS };
