import { loadBriefingProdukte } from '../../briefing/BriefingProdukte.js';
import { VIDEOIDEE_VORSCHLAG_ERROR } from '../videoideeVorschlag.js';
import {
  assertKeinVorschlag,
  hasSkriptForItem,
  skriptFreigabeClearPatch
} from './strategieItemGuards.js';
import { updateStrategieItem } from './strategieItems.js';

/**
 * Produkte des Briefings an diesem Konzept. Ohne Briefing leer.
 */
export async function getBriefingProdukte(strategieId) {
  if (!strategieId) return [];
  const { data: strategie, error } = await window.supabase
    .from('strategie')
    .select('id, briefing_id')
    .eq('id', strategieId)
    .single();
  if (error || !strategie?.briefing_id) return [];
  return loadBriefingProdukte(strategie.briefing_id);
}

/**
 * Ordnet einer Videoidee ein Produkt aus dem Briefing des Konzepts zu.
 * Eingefroren, sobald ein Skript aus der Idee existiert.
 */
export async function assignProdukt(itemId, produktId) {
  const { data: item, error: iErr } = await window.supabase
    .from('strategie_items')
    .select('id, strategie_id, produkt_id, ist_vorschlag')
    .eq('id', itemId)
    .single();
  if (iErr || !item) throw new Error('Videoidee nicht gefunden');
  if (item.ist_vorschlag) throw new Error(VIDEOIDEE_VORSCHLAG_ERROR);
  if (!produktId) throw new Error('Kein Produkt gewählt.');

  if (item.produkt_id && item.produkt_id !== produktId) {
    if (await hasSkriptForItem(itemId)) {
      throw new Error('Die Zuordnung ist eingefroren, weil bereits ein Skript aus dieser Idee existiert.');
    }
  }

  const produkte = await getBriefingProdukte(item.strategie_id);
  const produkt = produkte.find(p => p.id === produktId);
  if (!produkt) throw new Error('Das Produkt gehört nicht zum Briefing dieses Konzepts.');

  await updateStrategieItem(itemId, { produkt_id: produktId });
  return produkt;
}

/**
 * Loest die Produkt-Zuordnung. Blockt, sobald ein Skript aus der Idee
 * existiert. Nimmt die Skript-Freigabe mit, sonst bliebe eine Freigabe
 * ohne Produkt stehen.
 */
export async function unassignProdukt(itemId) {
  await assertKeinVorschlag(itemId);
  if (await hasSkriptForItem(itemId)) {
    throw new Error('Die Zuordnung ist eingefroren, weil bereits ein Skript aus dieser Idee existiert.');
  }
  await updateStrategieItem(itemId, {
    produkt_id: null,
    ...skriptFreigabeClearPatch()
  });
}

/**
 * Skript-Freigabe setzen oder zuruecknehmen. Gate nur fuer Neuanlage.
 * Freigeben nur mit Casting-Eintrag und ohne „Nicht umsetzen“.
 * Ohne Produkt und mit genau einem Briefing-Produkt wird das gesetzt.
 * Bei mehreren Produkten ohne Zuordnung bleibt die Freigabe zu.
 * Gibt das automatisch gesetzte Produkt zurueck, sonst null.
 */
export async function setSkriptFreigabe(itemId, flag) {
  const { data: item, error } = await window.supabase
    .from('strategie_items')
    .select('id, strategie_id, creator_auswahl_item_id, nicht_umsetzen, ist_vorschlag, produkt_id')
    .eq('id', itemId)
    .single();
  if (error || !item) throw new Error('Videoidee nicht gefunden');
  if (item.ist_vorschlag) throw new Error(VIDEOIDEE_VORSCHLAG_ERROR);

  if (flag) {
    if (!item.creator_auswahl_item_id) {
      throw new Error('Zuerst einen Casting-Eintrag zuordnen.');
    }
    if (item.nicht_umsetzen) {
      throw new Error('Ideen mit „Nicht umsetzen“ können nicht freigegeben werden.');
    }

    let produkt = null;
    if (!item.produkt_id) {
      const produkte = await getBriefingProdukte(item.strategie_id);
      if (produkte.length > 1) {
        throw new Error('Zuerst ein Produkt zuordnen.');
      }
      if (produkte.length === 1) produkt = produkte[0];
    }

    const patch = {
      skript_freigabe: true,
      skript_freigabe_am: new Date().toISOString(),
      skript_freigabe_von: window.currentUser?.id || null
    };
    if (produkt) patch.produkt_id = produkt.id;
    await updateStrategieItem(itemId, patch);
    return produkt;
  }

  await updateStrategieItem(itemId, skriptFreigabeClearPatch());
  return null;
}
