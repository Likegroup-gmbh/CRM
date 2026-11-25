// Summe der Creator-Kosten aus den Kooperationen (Auftragsdetails).
// Dasselbe Soll wie die Fakturierung: gepflegter Video-EK schlaegt den
// Kooperations-EK, Selbstzahler-KSK kommt dazu. Kooperationen ohne Rechnung
// zaehlen mit.

import { fetchAllRows, fetchAllRowsWave } from '../../core/fetchAllRows.js';
import { isFinalAuftrag } from '../../core/finalisiert.js';
import { sollFuerKoop, videoSollNachKoop } from '../../core/budget/koopFakturierung.js';

function betrag(value) {
  return parseFloat(value) || 0;
}

export function sumKooperationCreatorKosten(kooperationen, videos) {
  const videoSoll = videoSollNachKoop(videos || []);

  return (kooperationen || []).reduce((sum, koop) => {
    const ek = sollFuerKoop(koop, videoSoll);
    const ksk = koop.ksk_selbstzahler ? betrag(koop.ksk_betrag) : 0;
    return sum + ek + ksk;
  }, 0);
}

export async function loadKooperationCreatorKosten({ allowed, unternehmenIds } = {}) {
  const supabase = window.supabase;
  if (!supabase) return 0;

  const [auftraege, kampagnen, koops, videos] = await Promise.all([
    fetchAllRows(supabase, 'auftrag', 'id, unternehmen_id, is_draft'),
    fetchAllRows(supabase, 'kampagne', 'id, auftrag_id'),
    // Grosse Tabellen ohne COUNT(*) und mit paralleler Welle (wie finanzbestand.js).
    fetchAllRowsWave(supabase, 'kooperationen', 'id, kampagne_id, einkaufspreis_netto, ksk_selbstzahler, ksk_betrag'),
    fetchAllRowsWave(supabase, 'kooperation_videos', 'id, kooperation_id, einkaufspreis_netto')
  ]);

  const unternehmenFilter = Array.isArray(unternehmenIds) && unternehmenIds.length > 0
    ? new Set(unternehmenIds)
    : null;
  const koopScope = Array.isArray(allowed?.koopIds) && allowed.koopIds.length > 0
    ? new Set(allowed.koopIds)
    : null;

  const gueltigeAuftragIds = new Set(
    (auftraege || [])
      .filter(auftrag => isFinalAuftrag(auftrag) && (!unternehmenFilter || unternehmenFilter.has(auftrag.unternehmen_id)))
      .map(auftrag => auftrag.id)
  );
  const kampagneToAuftrag = new Map((kampagnen || []).map(kampagne => [kampagne.id, kampagne.auftrag_id]));

  const kooperationen = (koops || []).filter(koop => {
    if (koopScope && !koopScope.has(koop.id)) return false;
    const auftragId = kampagneToAuftrag.get(koop.kampagne_id);
    return Boolean(auftragId && gueltigeAuftragIds.has(auftragId));
  });
  const koopIds = new Set(kooperationen.map(koop => koop.id));
  const passendeVideos = (videos || []).filter(video => koopIds.has(video.kooperation_id));

  return sumKooperationCreatorKosten(kooperationen, passendeVideos);
}
