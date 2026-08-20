// job-updater.js
// Gemeinsamer Fortschritts-Updater fuer skript_generation_jobs:
// sammelt Logs im Speicher und serialisiert die DB-Updates ueber eine Queue,
// damit Realtime-Events in der richtigen Reihenfolge ankommen.

function createJobUpdater(supabase, jobId) {
  const logs = [];
  let queue = Promise.resolve();

  const enqueue = (patch) => {
    queue = queue
      .then(() => supabase.from('skript_generation_jobs').update({ ...patch, logs }).eq('id', jobId))
      .catch((e) => console.error(`[${jobId}] Supabase-Write fehlgeschlagen:`, e.message));
  };

  const pushLog = (msg) => {
    logs.push({ ts: new Date().toISOString(), msg });
    console.log(`[${jobId}] ${msg}`);
  };

  return {
    step(progressStep, msg) {
      if (msg) pushLog(msg);
      enqueue({ progress_step: progressStep, status: 'running' });
    },
    log(msg) {
      pushLog(msg);
      enqueue({});
    },
    async flushAndUpdate(patch) {
      await queue;
      await supabase.from('skript_generation_jobs').update({ ...patch, logs }).eq('id', jobId);
    }
  };
}

module.exports = { createJobUpdater };
