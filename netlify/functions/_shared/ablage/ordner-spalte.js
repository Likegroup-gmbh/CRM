// _shared/ablage/ordner-spalte.js
// Ordner der Upload-Spalten einer Kampagne (custom_columns, field_type = 'upload'):
//   <Kooperation>/<Spaltenname>/                    Spalte auf Kooperationsebene, Dateien direkt hier
//   <Kooperation>/<Spaltenname>/Video_<N>_<Thema>/  Spalte auf Videoebene, ein Ordner je Video
// Die Namen fuehrt das CRM (abgleich-pflege), wie bei Video-Ordnern.
// `o` ist das Register aus ordner.js (sicherstellen, kette, ladeVideo).

const { NAMEN } = require('./pfad');
const { koopBesitz } = require('./ordner-medien');

const SPALTE_SELECT = 'id, name, field_type, entity_type, kampagne_id';

async function ladeSpalte(supabase, id) {
  const { data, error } = await supabase.from('custom_columns').select(SPALTE_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data || null;
}

function createSpalteOrdner(o, { supabase }) {
  /** Ordner der Spalte unter der Kooperation (art spalte bzw. spalte_videos bei Spalten auf Videoebene). */
  async function spalteOrdner(kooperationRow, spalte) {
    const art = spalte.entity_type === 'video' ? 'spalte_videos' : 'spalte';
    return o.sicherstellen(kooperationRow, { art, custom_column_id: spalte.id, kooperation_id: kooperationRow.kooperation_id },
      NAMEN.spalte(spalte), koopBesitz(kooperationRow));
  }

  async function spalteVideoOrdner(spalteRow, video) {
    return o.sicherstellen(spalteRow, { art: 'spalte_video', kooperation_video_id: video.id }, NAMEN.video(video), {
      ...koopBesitz(spalteRow), custom_column_id: spalteRow.custom_column_id,
    });
  }

  /**
   * Zielordner einer Spalten-Datei. Ordner und Link sind derselbe Ordner (die Zelle zeigt ihn).
   * @param {{ custom_column_id: string, kooperation_id: string, kooperation_video_id?: string|null }} ctx
   * @param {{ koop?: object, spalte?: object, video?: object }} [vorab] schon geladene Zeilen
   */
  async function spalteZiel(ctx, { koop, spalte, video } = {}) {
    const s = spalte || await ladeSpalte(supabase, ctx.custom_column_id);
    if (!s) throw new Error('Spalte nicht gefunden');
    const k = await o.kette(koop || ctx.kooperation_id);
    const ordner = await spalteOrdner(k.kooperation, s);
    if (s.entity_type !== 'video') return { ordner, link: ordner, kette: k };
    const v = video || await o.ladeVideo(ctx.kooperation_video_id);
    const videoOrdner = await spalteVideoOrdner(ordner, v);
    return { ordner: videoOrdner, link: videoOrdner, kette: k, kooperation_video_id: v.id };
  }

  return { spalteOrdner, spalteVideoOrdner, spalteZiel };
}

module.exports = { createSpalteOrdner, ladeSpalte, SPALTE_SELECT };
