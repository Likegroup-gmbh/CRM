// creator-upload-cleanup.js
// Scheduled Function (taeglich): raeumt haengengebliebene Creator-Uploads auf.
// Jobs pending/processing aelter als 24h -> aborted + Staging-Objekt loeschen.
// Sonst waere ein geleakter Link ein Speicher-DoS.

const {
  getServiceClient,
  deleteStagingObject,
} = require('./_shared/creator-upload');

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

exports.handler = async () => {
  try {
    const supabase = getServiceClient();
    const cutoff = new Date(Date.now() - MAX_AGE_MS).toISOString();

    const { data: stale, error } = await supabase
      .from('creator_upload_job')
      .select('id, staging_key')
      .in('status', ['pending', 'processing'])
      .lt('created_at', cutoff);
    if (error) throw error;

    let cleaned = 0;
    for (const job of stale || []) {
      await deleteStagingObject(supabase, job.staging_key);
      await supabase.from('creator_upload_job')
        .update({ status: 'aborted', error: 'Timeout — Upload nicht abgeschlossen', updated_at: new Date().toISOString() })
        .eq('id', job.id);
      cleaned++;
    }

    console.log(`[creator-upload-cleanup] ${cleaned} Jobs aufgeraeumt`);
    return { statusCode: 200, body: JSON.stringify({ cleaned }) };
  } catch (err) {
    console.error('[creator-upload-cleanup]', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
