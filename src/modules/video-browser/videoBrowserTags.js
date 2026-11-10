// videoBrowserTags.js
// Tags an Varianten: zuweisen, entfernen, neu anlegen. Zuweisen und Entfernen laufen optimistisch
// (Zustand in `vb.raw`, Baum neu, Spalten sofort aktuell) und rollen bei einem Fehler zurück.
// Alle Funktionen bekommen den VideoBrowser-Controller (`vb`).

import { createTagTyp, deleteVarianteTag, insertVarianteTag } from './VideoBrowserAdapter.js';
import { buildTree, resolveSelection } from './videoBrowserLogic.js';
import { NEW_TAG_GROUP, cleanTagLabel, findTagByLabel } from './videoBrowserTagLogic.js';

function rebuild(vb) {
  vb.tree = buildTree(vb.raw, { team: vb.team });
  vb._renderNav();
  vb._refreshTagField?.();
}

const sameEntry = (a, b) => a.video_id === b.video_id && a.variant_key === b.variant_key && a.tag_typ_id === b.tag_typ_id;

function target(vb) {
  const { row, item } = resolveSelection(vb.tree, vb.sel);
  if (!vb.canUpload || !row || !item?.variantKey) return null;
  return { row, item, videoId: row.id, variantKey: item.variantKey };
}

/** Tag der gewählten Datei (genauer: ihrer Variante) vergeben. @returns {Promise<boolean>} */
export async function addTag(vb, tagId) {
  const t = target(vb);
  if (!t || t.item.tagIds.includes(tagId)) return false;
  const entry = { video_id: t.videoId, variant_key: t.variantKey, tag_typ_id: tagId, created_at: new Date().toISOString() };
  vb.raw.varianteTags = [...(vb.raw.varianteTags || []), entry];
  rebuild(vb);
  try {
    await insertVarianteTag({ videoId: t.videoId, variantKey: t.variantKey, tagTypId: tagId });
    return true;
  } catch (err) {
    console.error('VideoBrowser: Tag vergeben fehlgeschlagen', err);
    if (vb.destroyed) return false;
    vb.raw.varianteTags = vb.raw.varianteTags.filter(e => !sameEntry(e, entry));
    rebuild(vb);
    vb.toast('error', 'Tag konnte nicht vergeben werden.');
    return false;
  }
}

/** Tag von der Variante der gewählten Datei entfernen. @returns {Promise<boolean>} */
export async function removeTag(vb, tagId) {
  const t = target(vb);
  if (!t || !t.item.tagIds.includes(tagId)) return false;
  const match = { video_id: t.videoId, variant_key: t.variantKey, tag_typ_id: tagId };
  const removed = (vb.raw.varianteTags || []).filter(e => sameEntry(e, match));
  vb.raw.varianteTags = vb.raw.varianteTags.filter(e => !sameEntry(e, match));
  rebuild(vb);
  try {
    await deleteVarianteTag({ videoId: t.videoId, variantKey: t.variantKey, tagTypId: tagId });
    return true;
  } catch (err) {
    console.error('VideoBrowser: Tag entfernen fehlgeschlagen', err);
    if (vb.destroyed) return false;
    vb.raw.varianteTags = [...vb.raw.varianteTags, ...removed];
    rebuild(vb);
    vb.toast('error', 'Tag konnte nicht entfernt werden.');
    return false;
  }
}

/**
 * Neues Tag anlegen (Gruppe "Eigene", Geltung für diese Kampagne) und vergeben. Gibt es das Label
 * schon, ohne Beachtung von Groß- und Kleinschreibung, wird das vorhandene Tag vergeben.
 */
export async function createTag(vb, label) {
  const clean = cleanTagLabel(label);
  if (!clean || !target(vb)) return false;
  const existing = findTagByLabel(vb.raw.tagTypen, clean);
  if (existing) return addTag(vb, existing.id);
  try {
    const tag = await createTagTyp({ label: clean, gruppe: NEW_TAG_GROUP, kampagneId: vb.detail.kampagneId || null });
    if (vb.destroyed) return false;
    vb.raw.tagTypen = [...(vb.raw.tagTypen || []), tag];
    return addTag(vb, tag.id);
  } catch (err) {
    console.error('VideoBrowser: Tag anlegen fehlgeschlagen', err);
    if (!vb.destroyed) vb.toast('error', 'Tag konnte nicht angelegt werden.');
    return false;
  }
}
