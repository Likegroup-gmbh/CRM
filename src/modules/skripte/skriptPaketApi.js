// Laden und Speichern eines Skript-Pakets. Der Drawer und die Gastliste
// lesen hier, nicht über die übrigen Skript-Queries.

import { skripteService } from './SkripteService.js';
import { creatorAusZeile, SKRIPT_FREIGEGEBEN } from './skriptPaketModel.js';

function db() {
  return skripteService.db;
}

/** Skripte der Kampagne, Creator wie in der Skripte-Tabelle, sortiert nach Nr. */
export async function loadKampagneSkripteFuerPaket(kampagneId) {
  const rows = await skripteService.loadSkripte({ kampagneId });
  return rows.map((row) => {
    const creator = creatorAusZeile(row);
    return {
      id: row.id,
      titel: row.titel || row.hook || 'Ohne Titel',
      status: row.status,
      nr: row.skript_nr ?? null,
      creator,
      creatorId: creator?.id || null
    };
  }).sort((a, b) => (a.nr ?? 9999) - (b.nr ?? 9999) || String(a.titel).localeCompare(String(b.titel), 'de'));
}

export async function loadSkriptPaket(kampagneId, creatorId) {
  const { data: paket, error } = await db().from('skript_pakete')
    .select('id')
    .eq('kampagne_id', kampagneId)
    .eq('creator_id', creatorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!paket) return { paket: null, share: null, skriptIds: [] };
  const [eintraegeRes, shareRes] = await Promise.all([
    db().from('skript_paket_eintraege').select('skript_id').eq('paket_id', paket.id),
    db().from('list_shares')
      .select('id, token, label, rechte, empfaenger_emails')
      .eq('entity_type', 'skript_paket')
      .eq('entity_id', paket.id)
      .is('revoked_at', null)
      .maybeSingle()
  ]);
  if (eintraegeRes.error) throw new Error(eintraegeRes.error.message);
  if (shareRes.error) throw new Error(shareRes.error.message);
  return {
    paket,
    share: shareRes.data || null,
    skriptIds: (eintraegeRes.data || []).map((row) => row.skript_id)
  };
}

export async function ensureSkriptPaket(kampagneId, creatorId) {
  const vorhanden = await loadSkriptPaket(kampagneId, creatorId);
  if (vorhanden.paket) return vorhanden.paket;
  const { data, error } = await db().from('skript_pakete')
    .insert({ kampagne_id: kampagneId, creator_id: creatorId })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function setPaketSkripte(paketId, skriptIds) {
  const { error: deleteError } = await db().from('skript_paket_eintraege')
    .delete()
    .eq('paket_id', paketId);
  if (deleteError) throw new Error(deleteError.message);
  if (!skriptIds.length) return;
  const { data: erlaubt, error: leseFehler } = await db().from('skripte')
    .select('id')
    .in('id', skriptIds)
    .eq('status', SKRIPT_FREIGEGEBEN);
  if (leseFehler) throw new Error(leseFehler.message);
  const zeilen = (erlaubt || []).map((row) => ({ paket_id: paketId, skript_id: row.id }));
  if (!zeilen.length) return;
  const { error } = await db().from('skript_paket_eintraege').insert(zeilen);
  if (error) throw new Error(error.message);
}

/** Freigegebene Skripte, die der Gast-JWT sehen darf, in Nr.-Reihenfolge. */
export async function loadGastPaketSkripte() {
  const { data, error } = await db().from('skripte')
    .select(`id, titel, status, created_at, hook, hauptteil, cta, hook_visuell, hauptteil_visuell, cta_visuell, rezept, caption, text_hook,
      marke:marke_id(markenname, logo_url), unternehmen:unternehmen_id(firmenname, logo_url),
      produkt:produkt_id(name), kampagne:kampagne_id(kampagnenname, eigener_name),
      strategie_item:strategie_item_id(id, strategie_id, creator_name, video_link, casting_eintrag:creator_auswahl_item_id(id, name, link_instagram, creator:creator_id(id, vorname, nachname, profilbild_url, instagram)))`)
    .eq('status', SKRIPT_FREIGEGEBEN)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  const mitNr = await skripteService.attachSkriptNummern(data || []);
  return mitNr.sort((a, b) => (a.skript_nr ?? 9999) - (b.skript_nr ?? 9999));
}
