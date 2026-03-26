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

export async function deleteUnternehmenCascade(unternehmenId, { supabase, onProgress, userId } = {}) {
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
