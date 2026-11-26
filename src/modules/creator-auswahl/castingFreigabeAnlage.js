// castingFreigabeAnlage.js
// Datenseite der Kooperationsfreigabe: Creator sicherstellen (ohne Drawer),
// Kooperation der Linie minimal anlegen, freigegebene Creator einer Linie laden.
// Die Kooperation haengt an Kampagne, Produktion, Briefing und Creator, nicht an
// Konzept oder Skript - beides kann spaeter dazukommen.

import { creatorAuswahlService } from './CreatorAuswahlService.js';
import { findCreatorByInstagram } from './castingCreatorVerknuepfung.js';
import { instagramHandleFromItem, prefillFromCastingItem } from './ensureCastingEintragHatCreator.js';
import { findKooperationForCreator } from '../kooperation/produktionStart.js';
import { buildKooperationsName, hatProduktionsKontext } from './castingFreigabeLogik.js';

/** creator_ids, die in der Linie dieses Castings schon eine Kooperation haben. */
export async function ladeFreigegebeneCreatorIds(client, liste) {
  if (!client || !hatProduktionsKontext(liste)) return new Set();
  let query = client
    .from('kooperationen')
    .select('creator_id')
    .eq('produktion_id', liste.produktion_id);
  if (liste.briefing_id) query = query.eq('briefing_id', liste.briefing_id);
  const { data, error } = await query;
  if (error) throw new Error(error.message || 'Kooperationen konnten nicht geladen werden');
  return new Set((data || []).map(k => k.creator_id).filter(Boolean));
}

/** Minimaler Creator aus den Angaben des Eintrags. Leere Felder bleiben weg. */
export function buildMinimalCreatorPayload(item) {
  const prefill = prefillFromCastingItem(item);
  const payload = {
    vorname: prefill.vorname || prefill.instagram || prefill.tiktok || 'Creator',
    nachname: prefill.nachname,
    mail: prefill.mail,
    telefonnummer: prefill.telefonnummer,
    instagram: prefill.instagram,
    tiktok: prefill.tiktok,
    instagram_follower: item?.follower_instagram ?? null,
    tiktok_follower: item?.follower_tiktok ?? null,
    lieferadresse_stadt: prefill.lieferadresse_stadt,
    profilbild_url: prefill.profilbild_url
  };
  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== '' && v != null));
}

/**
 * creator_id des Eintrags: vorhanden, per Instagram-Handle verknuepft oder neu angelegt.
 * @returns {Promise<{ creatorId: string, neu: boolean }>}
 */
export async function sichereCreatorOhneDrawer(item, { dataService = window.dataService } = {}) {
  if (item.creator_id) return { creatorId: item.creator_id, neu: false };

  const handle = instagramHandleFromItem(item);
  const vorhanden = handle ? await findCreatorByInstagram(handle) : null;
  let creatorId = vorhanden?.id || null;

  if (!creatorId) {
    const result = await dataService.createEntity('creator', buildMinimalCreatorPayload(item));
    if (!result?.success) throw new Error(result?.error || 'Creator konnte nicht angelegt werden');
    creatorId = result.id;
  }

  await creatorAuswahlService.updateItem(item.id, { creator_id: creatorId });
  item.creator_id = creatorId;
  return { creatorId, neu: !vorhanden };
}

/**
 * Kooperation der Linie ohne Videos und Preise. Gibt es fuer den Creator in
 * der Linie schon eine, wird sie zurueckgegeben statt eine zweite anzulegen.
 * @returns {Promise<{ id: string, schonDa: boolean }>}
 */
export async function legeKooperationAn(liste, creatorId, { client = window.supabase, dataService = window.dataService } = {}) {
  const briefingId = liste.briefing_id || null;
  const existing = await findKooperationForCreator(client, {
    produktionId: liste.produktion_id,
    creatorId,
    briefingId
  });
  if (existing) return { id: existing.id, schonDa: true };

  const [kampagneRes, koopsRes, creatorRes] = await Promise.all([
    client.from('kampagne').select('id, creatoranzahl, unternehmen_id').eq('id', liste.kampagne_id).single(),
    client.from('kooperationen').select('name').eq('kampagne_id', liste.kampagne_id),
    client.from('creator').select('vorname, nachname, instagram').eq('id', creatorId).single()
  ]);
  const fehler = kampagneRes.error || koopsRes.error || creatorRes.error;
  if (fehler) throw new Error(fehler.message || 'Kampagne oder Creator nicht gefunden');

  const unternehmenId = liste.unternehmen_id || kampagneRes.data?.unternehmen_id;
  if (!unternehmenId) throw new Error('Am Casting hängt kein Unternehmen');

  const result = await dataService.createEntity('kooperation', {
    name: buildKooperationsName(
      creatorRes.data,
      (koopsRes.data || []).map(k => k.name),
      kampagneRes.data?.creatoranzahl
    ),
    creator_id: creatorId,
    kampagne_id: liste.kampagne_id,
    produktion_id: liste.produktion_id,
    briefing_id: briefingId,
    unternehmen_id: unternehmenId
  });
  if (!result?.success) throw new Error(result?.error || 'Kooperation konnte nicht angelegt werden');
  return { id: result.id, schonDa: false };
}
