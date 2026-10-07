// CreatorTauschService.js
// Laden, Pruefen und Ausfuehren des Creator-Tauschs. Die Umbuchung selbst
// macht die RPC creator_tausch in einer Transaktion.

import {
  ersatzSperre, datenSperre, tauschFehlerKey, tauschGrundText
} from './creatorTauschSperren.js';

const ITEM_COLS = 'id, creator_auswahl_id, creator_id, persona_id, name, prio_1, prio_2, zusage, gebucht, absage, '
  + 'creator:creator_id(id, vorname, nachname), persona:persona_id(name, oberbegriff)';

const db = () => window.supabase;

export function creatorName(creator, fallback = 'Creator') {
  return `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim() || fallback;
}

export function itemCreatorName(item) {
  return creatorName(item?.creator, item?.name || 'Creator');
}

async function einzeln(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

/** Vertraege, Rechnungen und Videos des Abspringers in dieser Produktion. */
async function ladeAbspringerDaten(creatorId, produktionId, briefingId = null) {
  if (!creatorId || !produktionId) return { vertraege: [], rechnungen: [], videos: [] };
  // Nur die Kooperationen der Linie der Casting-Liste (Kooperation ohne Linie = Altbestand)
  let koopQuery = db().from('kooperationen').select('id')
    .eq('creator_id', creatorId).eq('produktion_id', produktionId);
  if (briefingId) koopQuery = koopQuery.or(`briefing_id.eq.${briefingId},briefing_id.is.null`);
  const koops = await einzeln(koopQuery);
  const koopIds = (koops || []).map((k) => k.id);

  // Vertraege ohne Kooperation kennen keine Linie: nur bei genau einer Linie eindeutig
  const { count } = await db().from('campaign_briefings')
    .select('id', { count: 'exact', head: true }).eq('produktion_id', produktionId);
  const ohneKoop = (count ?? 0) <= 1
    ? `and(kooperation_id.is.null,creator_id.eq.${creatorId},produktion_id.eq.${produktionId})`
    : null;
  // Vertraege, die eine dieser Kooperationen decken (ADR 0047), samt aller ihrer Mitglieder
  const gedeckt = koopIds.length
    ? await einzeln(db().from('vertrag_kooperation').select('vertrag_id').in('kooperation_id', koopIds))
    : [];
  const gedecktIds = [...new Set((gedeckt || []).map((r) => r.vertrag_id))];
  const mitglieder = gedecktIds.length
    ? await einzeln(db().from('vertrag_kooperation').select('vertrag_id, kooperation_id').in('vertrag_id', gedecktIds))
    : [];
  const vertragFilter = [
    koopIds.length ? `kooperation_id.in.(${koopIds.join(',')})` : null,
    gedecktIds.length ? `id.in.(${gedecktIds.join(',')})` : null,
    ohneKoop
  ].filter(Boolean).join(',');
  const vertraege = vertragFilter
    ? await einzeln(db().from('vertraege')
      .select('id, status, dropbox_file_url, unterschriebener_vertrag_url').or(vertragFilter))
    : [];
  if (!koopIds.length) return { vertraege: vertraege || [], rechnungen: [], videos: [] };

  // Rechnungen anderer gedeckter Kooperationen sperren nicht: nur Vertraege zaehlen,
  // die nach dem Tausch keine andere Kooperation mehr decken
  const koopSet = new Set(koopIds);
  const vertragIds = (vertraege || []).map((v) => v.id).filter((id) => (mitglieder || [])
    .filter((m) => m.vertrag_id === id).every((m) => koopSet.has(m.kooperation_id)));
  const rechnungFilter = vertragIds.length
    ? `kooperation_id.in.(${koopIds.join(',')}),vertrag_id.in.(${vertragIds.join(',')})`
    : `kooperation_id.in.(${koopIds.join(',')})`;
  const [rechnungen, videos] = await Promise.all([
    einzeln(db().from('rechnung').select('id').or(rechnungFilter)),
    einzeln(db().from('kooperation_videos').select('id, asset_url').in('kooperation_id', koopIds))
  ]);
  return { vertraege: vertraege || [], rechnungen: rechnungen || [], videos: videos || [] };
}

/**
 * Alles fuer den Dialog: abspringender Eintrag, Ersatz-Kandidaten mit Sperrgrund
 * (null = waehlbar), Persona-Abweichung und Sperrgrund aus den Daten des Abspringers.
 */
export async function ladeTauschKontext(alterItemId) {
  const alt = await einzeln(db().from('creator_auswahl_items')
    .select(ITEM_COLS).eq('id', alterItemId).single());
  const liste = await einzeln(db().from('creator_auswahl')
    .select('produktion_id, briefing_id').eq('id', alt.creator_auswahl_id).single());
  const items = await einzeln(db().from('creator_auswahl_items').select(ITEM_COLS)
    .eq('creator_auswahl_id', alt.creator_auswahl_id).neq('id', alterItemId)
    .not('creator_id', 'is', null).order('name'));
  const daten = await ladeAbspringerDaten(alt.creator_id, liste?.produktion_id, liste?.briefing_id);

  return {
    alt,
    datenSperre: datenSperre(daten),
    kandidaten: (items || []).map((item) => ({
      item,
      sperre: ersatzSperre(alt, item),
      anderePersona: (item.persona_id || null) !== (alt.persona_id || null)
    }))
  };
}

/**
 * Casting-Eintrag zu einem Skript: ueber die Videoidee, sonst ueber den Creator
 * der Kooperation in der Produktion des Skripts. null bei Altbestand ohne Eintrag.
 */
export async function findeAlterEintragFuerSkript(skript, verknuepfungen = []) {
  if (skript?.strategie_item_id) {
    const idee = await einzeln(db().from('strategie_items')
      .select('creator_auswahl_item_id').eq('id', skript.strategie_item_id).maybeSingle());
    if (idee?.creator_auswahl_item_id) return idee.creator_auswahl_item_id;
  }
  const creatorId = verknuepfungen.map((v) => v.kooperation?.creator?.id).find(Boolean);
  if (!creatorId || !skript?.produktion_id) return null;
  let trefferQuery = db().from('creator_auswahl_items')
    .select('id, creator_auswahl:creator_auswahl_id!inner(produktion_id, briefing_id)')
    .eq('creator_id', creatorId).eq('absage', false)
    .eq('creator_auswahl.produktion_id', skript.produktion_id);
  if (skript.briefing_id) trefferQuery = trefferQuery.eq('creator_auswahl.briefing_id', skript.briefing_id);
  const treffer = await einzeln(trefferQuery.limit(1));
  return treffer?.[0]?.id || null;
}

export async function tauscheCreator({ alterItemId, ersatzItemId, grund = '' }) {
  const { data, error } = await db().rpc('creator_tausch', {
    p_alter_item: alterItemId,
    p_ersatz_item: ersatzItemId,
    p_grund: grund?.trim() || null
  });
  if (error) {
    const key = tauschFehlerKey(error);
    throw new Error(key ? tauschGrundText(key) : error.message);
  }
  return data;
}
