const DELETE_ORDER = [
  { table: 'vertraege', fk: 'kunde_unternehmen_id' },
  { table: 'briefings', fk: 'unternehmen_id' },
  { table: 'kampagne', fk: 'unternehmen_id' },
  { table: 'auftrag', fk: 'unternehmen_id' },
  { table: 'produkt', fk: 'unternehmen_id' },
  { table: 'marke', fk: 'unternehmen_id' },
];

export async function collectDependentIds(unternehmenId, { supabase } = {}) {
  const sb = supabase || window.supabase;
  const deps = {};

  for (const { table, fk } of DELETE_ORDER) {
    try {
      const { data: rows } = await sb.from(table).select('id').eq(fk, unternehmenId);
      deps[table] = (rows || []).map(r => r.id);
    } catch {
      deps[table] = [];
    }
  }

  return deps;
}

export async function persistDeleteErrors(unternehmenId, errors, { supabase, userId } = {}) {
  if (!errors || errors.length === 0) return;

  const sb = supabase || window.supabase;
  const rows = errors.map(e => ({
    deleted_entity_type: 'unternehmen',
    deleted_entity_id: unternehmenId,
    failed_step: e.step,
    failed_entity_id: e.entityId || null,
    error_message: e.error,
    created_by: userId || null,
  }));

  try {
    const { error } = await sb.from('delete_logs').insert(rows);
    if (error) {
      console.error('delete_logs Insert fehlgeschlagen, Fallback Console:', error, rows);
    }
  } catch (err) {
    console.error('delete_logs Insert Exception, Fallback Console:', err, rows);
  }
}

const STORAGE_PATHS = [
  { bucket: 'logos', prefix: 'unternehmen' },
  { bucket: 'vertraege', prefix: 'unternehmen' },
];

export async function cleanupStorage(unternehmenId, { supabase } = {}) {
  const sb = supabase || window.supabase;
  const errors = [];

  for (const { bucket, prefix } of STORAGE_PATHS) {
    const path = `${prefix}/${unternehmenId}`;
    try {
      const { data: files, error: listError } = await sb.storage.from(bucket).list(path);
      if (listError) {
        errors.push({ step: `storage_${bucket}`, error: listError.message || String(listError) });
        continue;
      }
      if (files && files.length > 0) {
        const filePaths = files.map(f => `${path}/${f.name}`);
        const { error: removeError } = await sb.storage.from(bucket).remove(filePaths);
        if (removeError) {
          errors.push({ step: `storage_${bucket}`, error: removeError.message || String(removeError) });
        }
      }
    } catch (err) {
      errors.push({ step: `storage_${bucket}`, error: err.message || String(err) });
    }
  }

  return { errors };
}

export async function cleanupDropbox(kampagneIds, kooperationIds, { fetch: fetchFn } = {}) {
  const _fetch = fetchFn || globalThis.fetch;
  const errors = [];

  for (const id of kampagneIds) {
    try {
      const resp = await _fetch('/.netlify/functions/dropbox-delete-cascade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: 'kampagne', entityId: id }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        errors.push({ step: `dropbox_kampagne_${id}`, error: err.error || `HTTP ${resp.status}` });
      }
    } catch (err) {
      errors.push({ step: `dropbox_kampagne_${id}`, error: err.message || String(err) });
    }
  }

  for (const id of kooperationIds) {
    try {
      const resp = await _fetch('/.netlify/functions/dropbox-delete-cascade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: 'kooperation', entityId: id }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        errors.push({ step: `dropbox_kooperation_${id}`, error: err.error || `HTTP ${resp.status}` });
      }
    } catch (err) {
      errors.push({ step: `dropbox_kooperation_${id}`, error: err.message || String(err) });
    }
  }

  return { errors };
}

export async function deleteUnternehmenCascade(unternehmenId, { supabase, onProgress, userId, fetch: fetchFn } = {}) {
  const sb = supabase || window.supabase;
  const progress = onProgress || (() => {});
  const result = { success: true, deleted: {}, errors: [] };

  const deps = await collectDependentIds(unternehmenId, { supabase: sb });

  for (const { table } of DELETE_ORDER) {
    const ids = deps[table] || [];
    if (ids.length === 0) continue;

    progress({ step: table, count: ids.length });

    try {
      const { error } = await sb.from(table).delete().in('id', ids);
      if (error) {
        result.errors.push({ step: table, error: error.message || String(error) });
      } else {
        result.deleted[table] = ids.length;
      }
    } catch (err) {
      result.errors.push({ step: table, error: err.message || String(err) });
    }
  }

  const kampagneIds = deps.kampagne || [];
  const kooperationIds = (deps._kooperationen || []);
  if (kampagneIds.length > 0 || kooperationIds.length > 0) {
    progress({ step: 'dropbox', count: kampagneIds.length + kooperationIds.length });
    const dropboxResult = await cleanupDropbox(kampagneIds, kooperationIds, { fetch: fetchFn });
    result.errors.push(...dropboxResult.errors);
  }

  progress({ step: 'storage', count: STORAGE_PATHS.length });
  const storageResult = await cleanupStorage(unternehmenId, { supabase: sb });
  result.errors.push(...storageResult.errors);

  progress({ step: 'unternehmen', count: 1 });

  try {
    const { error } = await sb.from('unternehmen').delete().eq('id', unternehmenId);
    if (error) {
      result.success = false;
      result.errors.push({ step: 'unternehmen', error: error.message || String(error) });
    } else {
      result.deleted.unternehmen = 1;
    }
  } catch (err) {
    result.success = false;
    result.errors.push({ step: 'unternehmen', error: err.message || String(err) });
  }

  await persistDeleteErrors(unternehmenId, result.errors, { supabase: sb, userId });

  return result;
}
