// koopAbrechenbarkeitLaden.js
// Eine Quelle fuer die Abrechenbarkeits-Daten (Rechnungen + Video-EK).
// Selektor, Rechnungsformular und PDF-Vorschlag rechnen dasselbe Soll.

import { calculateKoopAbrechenbarkeit } from './koopFakturierung.js';

export const RECHNUNG_ABRECHEN_SELECT = 'kooperation_id, nettobetrag, nettobetrag_steuerfrei, ksk_betrag, ist_schlussrechnung';
export const VIDEO_EK_SELECT = 'kooperation_id, einkaufspreis_netto';

// Laedt Rechnungen und Video-EK fuer die uebergebenen Kooperationen und
// rechnet die Abrechenbarkeit. ids leer -> leere Map, kein Request.
export async function ladeAbrechenbarkeit(supabase, kooperationen = []) {
  const ids = [...new Set((kooperationen || []).map(k => k.id).filter(Boolean))];
  if (!ids.length) {
    return {
      rechnungen: [],
      videos: [],
      abrechenbarkeit: calculateKoopAbrechenbarkeit({ kooperationen })
    };
  }

  const [rechnungenResult, videosResult] = await Promise.all([
    supabase.from('rechnung').select(RECHNUNG_ABRECHEN_SELECT).in('kooperation_id', ids),
    supabase.from('kooperation_videos').select(VIDEO_EK_SELECT).in('kooperation_id', ids)
  ]);
  if (rechnungenResult.error) throw rechnungenResult.error;
  if (videosResult.error) throw videosResult.error;

  const rechnungen = rechnungenResult.data || [];
  const videos = videosResult.data || [];
  return {
    rechnungen,
    videos,
    abrechenbarkeit: calculateKoopAbrechenbarkeit({ kooperationen, videos, rechnungen })
  };
}
