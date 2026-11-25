// igFetchBudget.js
// Haelt Instagram-Abrufe einer Casting-Liste hintereinander und reicht den
// letzten Meta-Stand (X-App-Usage) an den naechsten Creator weiter.
// Liegt der Stand bei >= 95 %, fragt die Function nicht mehr an, sondern
// nimmt den Pool oder lehnt neue Creator ab. Nach zehn Minuten wird der
// Stand verworfen, damit ein einzelner Abruf das Kontingent neu misst.
// Wiederholte 95-%-Meldungen setzen die Uhr nicht zurueck.

const USAGE_MAX_AGE_MS = 10 * 60 * 1000;
const HOT = 95;

let lastUsage = null;
let usageNotedAt = 0;
let tail = Promise.resolve();

function hottest(usage) {
  if (!usage) return 0;
  return Math.max(
    Number(usage.call_count) || 0,
    Number(usage.total_time) || 0,
    Number(usage.total_cputime) || 0
  );
}

export function resetIgFetchBudget() {
  lastUsage = null;
  usageNotedAt = 0;
  tail = Promise.resolve();
}

export function noteMetaUsage(usage, now = Date.now()) {
  if (!usage || typeof usage !== 'object') return;
  const stillHot = hottest(lastUsage) >= HOT && hottest(usage) >= HOT;
  lastUsage = usage;
  if (!stillHot) usageNotedAt = now;
}

export function currentMetaUsage(now = Date.now()) {
  if (lastUsage && hottest(lastUsage) >= HOT && usageNotedAt && now - usageNotedAt >= USAGE_MAX_AGE_MS) {
    lastUsage = null;
    usageNotedAt = 0;
  }
  return lastUsage;
}

/**
 * Abrufe strikt nacheinander. Der Task bekommt den letzten Kontingent-Stand
 * und sein Ergebnis (auch im Fehler) aktualisiert ihn, bevor der naechste
 * Creator drankommt.
 */
export function enqueueIgFetch(task) {
  const run = tail.then(async () => {
    const usage = currentMetaUsage();
    try {
      const result = await task(usage);
      if (result?.metaUsage) noteMetaUsage(result.metaUsage);
      return result;
    } catch (error) {
      if (error?.metaUsage) noteMetaUsage(error.metaUsage);
      throw error;
    }
  });
  tail = run.then(() => {}, () => {});
  return run;
}
