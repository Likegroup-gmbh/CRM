// Setzt die Freigabe aller Videos einer Kampagne.
// kampagne.is_completed setzt danach der bestehende Trigger.

const CHUNK = 200;

function koopLabel(count) {
  return count === 1
    ? 'Eine Kooperation hat kein Video.'
    : `${count} Kooperationen haben kein Video.`;
}

export function completionMessage({ koopCount = 0, ohneVideo = 0, isCompleted = false } = {}) {
  if (koopCount === 0) {
    return { text: 'Diese Kampagne hat keine Kooperationen und bleibt offen.', type: 'warning' };
  }
  if (ohneVideo > 0) {
    return { text: `${koopLabel(ohneVideo)} Die Kampagne bleibt offen.`, type: 'warning' };
  }
  if (isCompleted) {
    return { text: 'Kampagne abgeschlossen.', type: 'success' };
  }
  return { text: 'Die Videos sind freigegeben. Die Kampagne ist noch nicht abgeschlossen.', type: 'warning' };
}

async function selectInChunks(supabase, table, columns, column, ids) {
  const rows = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { data, error } = await supabase.from(table).select(columns).in(column, chunk);
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

async function approveVideos(supabase, ids) {
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { error } = await supabase.from('kooperation_videos').update({ freigabe: true }).in('id', chunk);
    if (error) throw error;
  }
}

async function defaultConfirm() {
  const result = await window.confirmationModal?.open({
    title: 'Kampagne abschließen',
    message: 'Alle Videos dieser Kampagne werden freigegeben.',
    confirmText: 'Kampagne abschließen',
    cancelText: 'Abbrechen'
  });
  return !!result?.confirmed;
}

function defaultToast(text, type) {
  window.toastSystem?.show(text, type);
}

export async function completeKampagne(kampagneId, {
  supabase = window.supabase,
  confirm = defaultConfirm,
  toast = defaultToast
} = {}) {
  if (!kampagneId) throw new Error('Kampagne fehlt');
  if (!(await confirm())) return { cancelled: true };

  const { data: koops, error: koopError } = await supabase
    .from('kooperationen')
    .select('id')
    .eq('kampagne_id', kampagneId);
  if (koopError) throw koopError;

  const koopIds = (koops || []).map((koop) => koop.id).filter(Boolean);
  let ohneVideo = 0;

  if (koopIds.length) {
    const videos = await selectInChunks(
      supabase,
      'kooperation_videos',
      'id, kooperation_id, freigabe',
      'kooperation_id',
      koopIds
    );
    const withVideo = new Set(videos.map((video) => video.kooperation_id));
    ohneVideo = koopIds.filter((id) => !withVideo.has(id)).length;
    const pending = videos.filter((video) => video.freigabe !== true).map((video) => video.id);
    if (pending.length) await approveVideos(supabase, pending);
  }

  let isCompleted = false;
  if (koopIds.length && ohneVideo === 0) {
    const { data: row, error: flagError } = await supabase
      .from('kampagne')
      .select('is_completed')
      .eq('id', kampagneId)
      .maybeSingle();
    if (flagError) throw flagError;
    isCompleted = row?.is_completed === true;
  }

  const message = completionMessage({ koopCount: koopIds.length, ohneVideo, isCompleted });
  toast(message.text, message.type);
  window.dispatchEvent(new CustomEvent('entityUpdated', {
    detail: { entity: 'kampagne', action: 'completed', id: kampagneId }
  }));

  return { cancelled: false, isCompleted, ohneVideo, koopCount: koopIds.length };
}
