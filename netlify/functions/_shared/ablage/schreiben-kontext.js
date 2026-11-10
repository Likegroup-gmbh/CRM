// _shared/ablage/schreiben-kontext.js
// Gemeinsame Helfer der Schreibpfade: Fachkontext aus Body/Zeile bauen und gegen die DB
// pruefen, Pfad-/Namensteile, Fehler bei fehlender Konfiguration.

const { istUuid } = require('./konfig');
const { AblageFehler } = require('./http');

const ordnerVon = (pfad) => (pfad ? pfad.slice(0, pfad.lastIndexOf('/')) : '');
const endung = (name) => {
  const i = String(name || '').lastIndexOf('.');
  return i > 0 ? name.slice(i) : '';
};

function nichtKonfiguriert() {
  return new AblageFehler(503, 'Medienablage ist nicht eingerichtet', 'nicht_konfiguriert');
}

function kontextAusBody(typ, body) {
  return {
    typ,
    kooperation_id: body.kooperation_id,
    kooperation_video_id: body.kooperation_video_id || null,
    story_id: body.story_id || null,
    version_number: Number(body.version_number) || 1,
    is_final: !!body.is_final,
    variant_name: body.variant_name ? String(body.variant_name).trim() : null,
  };
}

function kontextAusZeile(typ, row, kooperationId) {
  return {
    typ,
    kooperation_id: row.kooperation_id || kooperationId,
    kooperation_video_id: row.video_id || null,
    story_id: row.story_id || null,
    version_number: row.version_number || 1,
    is_final: !!row.is_final,
    variant_name: row.variant_name || null,
  };
}

async function einzel(supabase, tabelle, select, id) {
  const { data, error } = await supabase.from(tabelle).select(select).eq('id', id).maybeSingle();
  if (error) throw error;
  return data || null;
}

/** Video/Story muessen zur Kooperation gehoeren (der Body kommt vom Client). */
async function kontextPruefen(supabase, ctx) {
  if (ctx.typ === 'video' && !ctx.kooperation_video_id) throw new AblageFehler(400, 'kooperation_video_id fehlt');
  if (ctx.typ === 'story' && !istUuid(ctx.story_id)) throw new AblageFehler(400, 'story_id fehlt');
  if (ctx.typ === 'story') {
    const slot = await einzel(supabase, 'kooperation_story', 'id, video_id', ctx.story_id);
    if (!slot) throw new AblageFehler(404, 'Story-Slot nicht gefunden');
    if (ctx.kooperation_video_id && ctx.kooperation_video_id !== slot.video_id) throw new AblageFehler(400, 'Story-Slot gehört zu einem anderen Video');
    ctx.kooperation_video_id = slot.video_id;
  }
  if (ctx.kooperation_video_id) {
    if (!istUuid(ctx.kooperation_video_id)) throw new AblageFehler(400, 'kooperation_video_id ungültig');
    const video = await einzel(supabase, 'kooperation_videos', 'id, kooperation_id', ctx.kooperation_video_id);
    if (!video || video.kooperation_id !== ctx.kooperation_id) throw new AblageFehler(404, 'Video nicht gefunden');
  }
  return ctx;
}

module.exports = { ordnerVon, endung, nichtKonfiguriert, kontextAusBody, kontextAusZeile, kontextPruefen };
