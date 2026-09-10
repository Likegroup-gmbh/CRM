// job-updater.js
// Gemeinsamer Fortschritts-Updater fuer Job-Tabellen (Default:
// skript_generation_jobs): sammelt Logs im Speicher und serialisiert die
// DB-Updates ueber eine Queue, damit Realtime-Events in der richtigen
// Reihenfolge ankommen.
// progress_steps laeuft ueber appendStep (derselbe Vertrag wie setThinking).
//
// Andere Job-Tabellen (z.B. briefing_pdf_jobs) ueber options.table waehlen;
// mitLogs: false, wenn die Tabelle keine logs-Spalte hat.

const { appendStep } = require('./thinking');

function createJobUpdater(supabase, jobId, { table = 'skript_generation_jobs', withLogs = true } = {}) {
  const logs = [];
  let progressSteps = [];
  let queue = Promise.resolve();

  const withLogPayload = (patch) => (withLogs ? { ...patch, logs } : patch);

  const enqueue = (patch) => {
    queue = queue
      .then(() => supabase.from(table).update(withLogPayload(patch)).eq('id', jobId))
      .catch((e) => console.error(`[${jobId}] Supabase-Write fehlgeschlagen:`, e.message));
  };

  const pushLog = (msg) => {
    logs.push({ ts: new Date().toISOString(), msg });
    console.log(`[${jobId}] ${msg}`);
  };

  return {
    step(progressStep, msg) {
      if (msg) pushLog(msg);
      progressSteps = appendStep(progressSteps, { step: progressStep, label: msg || progressStep });
      enqueue({ progress_step: progressStep, progress_steps: progressSteps, status: 'running' });
    },
    log(msg) {
      pushLog(msg);
      enqueue({});
    },
    async flushAndUpdate(patch) {
      await queue;
      await supabase.from(table).update(withLogPayload(patch)).eq('id', jobId);
    }
  };
}

module.exports = { createJobUpdater };
