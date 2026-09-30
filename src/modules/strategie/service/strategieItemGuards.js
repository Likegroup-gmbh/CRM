import { VIDEOIDEE_VORSCHLAG_ERROR } from '../videoideeVorschlag.js';

/**
 * Skript-Freeze: existiert mindestens ein Skript mit dieser Videoidee als
 * Vorlage, ist die Creator-Zuordnung eingefroren. Escape ist die Vorlage
 * am Skript loesen (strategie_item_id auf NULL), nicht die Zuordnung.
 */
export async function hasSkriptForItem(itemId) {
  if (!itemId) return false;
  const { count, error } = await window.supabase
    .from('skripte')
    .select('id', { count: 'exact', head: true })
    .eq('strategie_item_id', itemId);
  if (error) throw error;
  return (count || 0) > 0;
}

export async function assertKeinVorschlag(itemId) {
  const { data, error } = await window.supabase
    .from('strategie_items')
    .select('ist_vorschlag')
    .eq('id', itemId)
    .single();
  if (error || !data) throw new Error('Videoidee nicht gefunden');
  if (data.ist_vorschlag) throw new Error(VIDEOIDEE_VORSCHLAG_ERROR);
}

export function skriptFreigabeClearPatch() {
  return {
    skript_freigabe: false,
    skript_freigabe_am: null,
    skript_freigabe_von: null
  };
}
