// thinking.js
// Einziger Schreib-Weg fuer progress_steps. Jobs rufen setThinking
// (oder appendStep + denselben Patch wie job-updater) mit { step, label }.

const OPEN_STATUSES = ['pending', 'running'];

function asItem(item) {
  const step = String(item?.step || '').trim();
  const label = String(item?.label || '').trim();
  return step && label ? { step, label } : null;
}

function appendStep(steps, item) {
  const next = Array.isArray(steps) ? steps.map(asItem).filter(Boolean) : [];
  const add = asItem(item);
  if (!add) return next;
  const last = next[next.length - 1];
  if (last?.step === add.step) {
    next[next.length - 1] = add;
    return next;
  }
  next.push(add);
  return next;
}

/**
 * Haengt { step, label } an progress_steps, nur wenn der Job noch offen ist.
 * @returns {object|null} aktualisierte Row-Id oder null
 */
async function setThinking(supabase, table, id, item) {
  if (!supabase || !table || !id || !asItem(item)) return null;

  const { data, error } = await supabase.from(table)
    .select('status, progress_steps')
    .eq('id', id)
    .maybeSingle();
  if (error || !data || !OPEN_STATUSES.includes(data.status)) return null;

  const progress_steps = appendStep(data.progress_steps, item);
  const { data: updated, error: writeError } = await supabase.from(table)
    .update({ progress_steps })
    .eq('id', id)
    .in('status', OPEN_STATUSES)
    .select('id')
    .maybeSingle();
  if (writeError) {
    console.error(`[thinking] ${table}/${id}:`, writeError.message);
    return null;
  }
  return updated || null;
}

module.exports = { appendStep, setThinking, OPEN_STATUSES };
