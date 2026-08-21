// load-referenz.js
// Videovorlage serverseitig validieren. Neue Quelle: strategie_item.
// Legacy: transcription_jobs / manuelles Transkript (bestehende Stubs).

const { kuerzeTranskript } = require('./formatter');

const REF_MANUELL_MIN_ZEICHEN = 50;

async function loadStrategieItemReferenz(supabase, payload, ref) {
  const itemId = ref.strategie_item_id;
  if (!itemId) throw new Error('Videovorlage ohne Strategie-Item');
  if (!payload.kampagne_id) {
    throw new Error('Videovorlage braucht eine Kampagne');
  }

  const { data: item, error } = await supabase.from('strategie_items')
    .select('id, video_link, plattform, beschreibung, caption, transkript, strategie:strategie_id!inner(id, kampagne_id)')
    .eq('id', itemId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!item) throw new Error('Strategie-Item der Videovorlage nicht gefunden');
  if (item.strategie?.kampagne_id !== payload.kampagne_id) {
    throw new Error('Videovorlage gehoert nicht zur gewaehlten Kampagne');
  }

  // Das Transkript ist DB-Sache, nicht Client-Sache: der Client-Snapshot
  // gilt nur noch als Override, wenn er bewusst abweicht (manuell
  // editiert) - und wird dann hart gekuerzt. Sonst vertraut der Prompt
  // einem beliebigen Client-Text.
  const clientText = String(ref.transkript_verwendet || '').trim();
  const dbText = String(item.transkript || '').trim();
  let transkript = dbText || null;
  if (clientText && clientText !== dbText) {
    transkript = kuerzeTranskript(clientText);
  }
  if (!transkript) return null;

  return {
    quelle: 'strategie_item',
    strategie_item_id: item.id,
    url: item.video_link || String(ref.url || '').trim() || null,
    transkript_verwendet: transkript,
    beschreibung: String(ref.beschreibung || '').trim() || item.beschreibung || null,
    caption: String(ref.caption || '').trim() || item.caption || null,
    platform: item.plattform || ref.platform || null,
    duration_seconds: null,
    author_name: null,
    metrics: { likes: null, comments: null, shares: null, saves: null }
  };
}

async function loadLegacyReferenz(supabase, ref, url, transkript) {
  if (!url || !transkript) {
    throw new Error('Videovorlage unvollstaendig - sie braucht URL UND Transkript');
  }

  const referenz = {
    url,
    transcription_job_id: ref.transcription_job_id || null,
    quelle: ref.transcription_job_id ? 'job' : 'manual',
    transkript_verwendet: transkript,
    beschreibung: String(ref.beschreibung || '').trim() || null,
    caption: String(ref.caption || '').trim() || null,
    platform: null,
    duration_seconds: null,
    author_name: null,
    metrics: { likes: null, comments: null, shares: null, saves: null }
  };

  if (referenz.quelle === 'job') {
    const { data: job } = await supabase.from('transcription_jobs')
      .select('id, url, status, platform, duration_seconds, author_name, description, caption, likes_count, comments_count, shares_count, saves_count')
      .eq('id', referenz.transcription_job_id).single();
    if (!job) throw new Error('Transkriptions-Job der Videovorlage nicht gefunden');
    if (job.status !== 'done') throw new Error('Transkription der Videovorlage ist noch nicht abgeschlossen');
    if (job.url !== referenz.url) throw new Error('URL der Videovorlage passt nicht zum Transkriptions-Job');

    referenz.platform = job.platform || null;
    referenz.duration_seconds = job.duration_seconds ?? null;
    referenz.author_name = job.author_name || null;
    referenz.beschreibung = referenz.beschreibung || job.description || null;
    referenz.caption = referenz.caption || job.caption || null;
    referenz.metrics = {
      likes: job.likes_count ?? null,
      comments: job.comments_count ?? null,
      shares: job.shares_count ?? null,
      saves: job.saves_count ?? null
    };
  } else if (transkript.length < REF_MANUELL_MIN_ZEICHEN) {
    throw new Error('Manuelles Transkript der Videovorlage ist zu kurz (min. 50 Zeichen)');
  }

  return referenz;
}

/**
 * Client-Angaben validieren und aus der DB anreichern.
 * Metadaten kommen aus der Row; bei strategie_item auch das Transkript
 * (Client-Text nur noch als abweichender Override). Legacy-Quellen
 * (transcription_jobs / manuell) behalten den Client-Snapshot.
 */
async function loadReferenzVideo(supabase, payload) {
  const ref = payload.referenz_video;
  const url = String(ref?.url || '').trim();
  const transkript = String(ref?.transkript_verwendet || '').trim();
  if (!ref || (!url && !transkript && !ref.strategie_item_id)) return null;

  const istStrategie = ref.quelle === 'strategie_item' || !!ref.strategie_item_id;
  if (istStrategie) {
    return loadStrategieItemReferenz(supabase, payload, ref);
  }

  return loadLegacyReferenz(supabase, ref, url, transkript);
}

module.exports = { loadReferenzVideo };
