// castingCreatorVerknuepfung
// Der gruene Punkt am Bild ist die gespeicherte creator_id, keine Live-Suche.
// Instagram steht mal als Handle, mal als volle URL. Verknuepft wird nur,
// wenn genau ein Creator denselben Handle hat und auf diesem Casting
// noch nicht haengt.

import { normalizeHandle } from '../creator/creatorProfil.js';
import { instagramProfilHandle } from './instagramDrawerFill.js';

function escapeIlike(value) {
  return String(value).replace(/[\\%_]/g, '\\$&');
}

export function creatorAnzeigename(creator) {
  return `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim() || 'Creator';
}

/** Genau ein Creator mit diesem Handle, sonst null. */
export function eindeutigerCreator(creators, handle) {
  const ziel = normalizeHandle(handle);
  if (!ziel) return null;
  const treffer = (creators || []).filter(creator => normalizeHandle(creator.instagram) === ziel);
  return treffer.length === 1 ? treffer[0] : null;
}

/**
 * Offene Eintraege, die einen eindeutigen Creator treffen.
 * Ein Creator wird hoechstens einer Zeile zugeordnet.
 */
export function verknuepfungenFuerItems(items, creators) {
  const belegt = new Set((items || []).map(item => item.creator_id).filter(Boolean));
  const links = [];

  for (const item of items || []) {
    if (item.creator_id || item.isVorschlag) continue;
    const handle = instagramProfilHandle(item.link_instagram);
    if (!handle) continue;
    const creator = eindeutigerCreator(creators, handle);
    if (!creator || belegt.has(creator.id)) continue;
    belegt.add(creator.id);
    links.push({
      itemId: item.id,
      creatorId: creator.id,
      name: creatorAnzeigename(creator)
    });
  }

  return links;
}

export function verknuepfungsText(links) {
  if (!links?.length) return '';
  if (links.length === 1) {
    return `${links[0].name} ist schon in der Datenbank und wurde verknüpft`;
  }
  return `${links.length} Creator waren schon in der Datenbank und wurden verknüpft`;
}

export async function findCreatorByInstagram(handle) {
  const ziel = normalizeHandle(handle);
  if (!ziel || !window.supabase) return null;
  const creators = await ladeCreatorFuerHandles([ziel]);
  return eindeutigerCreator(creators, ziel);
}

export async function ladeCreatorFuerHandles(handles) {
  const liste = [...new Set((handles || []).map(handle => normalizeHandle(handle)).filter(Boolean))];
  if (!liste.length || !window.supabase) return [];

  const gruppen = await Promise.all(liste.map(async (handle) => {
    const { data, error } = await window.supabase
      .from('creator')
      .select('id, vorname, nachname, instagram')
      .ilike('instagram', `%${escapeIlike(handle)}%`)
      .limit(50);
    if (error) throw error;
    return data || [];
  }));

  const nachId = new Map();
  for (const creator of gruppen.flat()) nachId.set(creator.id, creator);
  return [...nachId.values()];
}

export async function verknuepfeOffeneEintraege(items, updateItem) {
  const offen = (items || []).filter(item => (
    !item.creator_id && !item.isVorschlag && instagramProfilHandle(item.link_instagram)
  ));
  if (!offen.length) return [];

  const creators = await ladeCreatorFuerHandles(offen.map(item => item.link_instagram));
  const links = verknuepfungenFuerItems(items, creators);
  for (const link of links) {
    await updateItem(link.itemId, { creator_id: link.creatorId });
    const item = items.find(entry => entry.id === link.itemId);
    if (item) item.creator_id = link.creatorId;
  }
  return links;
}

export async function verknuepfeEintrag(item, items, updateItem) {
  if (!item?.id) return [];
  return (await verknuepfeOffeneEintraege(
    (items || []).filter(entry => entry.creator_id || entry.id === item.id),
    updateItem
  )).filter(link => link.itemId === item.id);
}
