import {
  castingUmsetzungGate,
  CASTING_UMSETZUNG_GATE_ERROR,
  CASTING_CREATOR_PFLICHT_ERROR
} from '../../creator-auswahl/sourcingStatusOptions.js';
import { VIDEOIDEE_VORSCHLAG_ERROR } from '../videoideeVorschlag.js';
import {
  assertKeinVorschlag,
  hasSkriptForItem,
  skriptFreigabeClearPatch
} from './strategieItemGuards.js';
import { updateStrategieItem } from './strategieItems.js';

/**
 * Verknuepft ein Konzept mit einem Casting (1:1). Beide muessen dieselbe
 * Kampagne und dasselbe briefing_id tragen (inkl. beide NULL). Das
 * Gegenstueck muss unverknuepft sein. Schreibt beide Seiten.
 */
export async function linkCasting(strategieId, creatorAuswahlId) {
  const { data: strategie, error: sErr } = await window.supabase
    .from('strategie')
    .select('id, kampagne_id, briefing_id, creator_auswahl_id')
    .eq('id', strategieId)
    .single();
  if (sErr || !strategie) throw new Error('Konzept nicht gefunden');

  const { data: casting, error: cErr } = await window.supabase
    .from('creator_auswahl')
    .select('id, kampagne_id, briefing_id, strategie_id')
    .eq('id', creatorAuswahlId)
    .single();
  if (cErr || !casting) throw new Error('Casting nicht gefunden');

  if (strategie.creator_auswahl_id) {
    throw new Error('Dieses Konzept ist bereits mit einem Casting verknüpft.');
  }
  if (casting.strategie_id) {
    throw new Error('Dieses Casting ist bereits mit einem Konzept verknüpft.');
  }
  if ((strategie.kampagne_id || null) !== (casting.kampagne_id || null)) {
    throw new Error('Konzept und Casting gehören zu unterschiedlichen Kampagnen.');
  }
  if ((strategie.briefing_id || null) !== (casting.briefing_id || null)) {
    throw new Error('Konzept und Casting haben unterschiedliche Briefings.');
  }

  const { error: upErr } = await window.supabase
    .from('strategie')
    .update({ creator_auswahl_id: creatorAuswahlId })
    .eq('id', strategieId);
  if (upErr) throw upErr;

  const { error: upErr2 } = await window.supabase
    .from('creator_auswahl')
    .update({ strategie_id: strategieId })
    .eq('id', creatorAuswahlId);
  if (upErr2) {
    // Rueckgaengig, damit kein halbes Paar stehen bleibt
    await window.supabase.from('strategie').update({ creator_auswahl_id: null }).eq('id', strategieId);
    throw upErr2;
  }
}

/**
 * Loesung des Paars. Nur moeglich, solange keine Videoidee einen
 * Casting-Eintrag aus diesem Casting traegt - sonst wuerden Zuordnungen
 * ihre Quelle verlieren.
 */
export async function unlinkCasting(strategieId) {
  const { data: strategie, error: sErr } = await window.supabase
    .from('strategie')
    .select('id, creator_auswahl_id')
    .eq('id', strategieId)
    .single();
  if (sErr || !strategie) throw new Error('Konzept nicht gefunden');
  if (!strategie.creator_auswahl_id) return;

  const { count, error: cntErr } = await window.supabase
    .from('strategie_items')
    .select('id', { count: 'exact', head: true })
    .eq('strategie_id', strategieId)
    .not('creator_auswahl_item_id', 'is', null);
  if (cntErr) throw cntErr;
  if ((count || 0) > 0) {
    throw new Error('Es sind noch Videoideen mit einem Casting-Eintrag verknüpft. Zuerst dort lösen.');
  }

  const castingId = strategie.creator_auswahl_id;
  const { error: upErr } = await window.supabase
    .from('strategie')
    .update({ creator_auswahl_id: null })
    .eq('id', strategieId);
  if (upErr) throw upErr;

  await window.supabase
    .from('creator_auswahl')
    .update({ strategie_id: null })
    .eq('id', castingId);
}

/**
 * Ordnet einer Videoidee einen Casting-Eintrag zu. Gates:
 * - Konzept muss mit dem Casting des Eintrags verknuepft sein
 * - Eintrag: Kunden-Prio plus Zusage oder Gebucht plus creator_id
 * - Zuordnung ist eingefroren, sobald ein Skript aus der Idee existiert
 */
export async function assignCastingItem(itemId, auswahlItemId) {
  const { data: item, error: iErr } = await window.supabase
    .from('strategie_items')
    .select('id, strategie_id, creator_auswahl_item_id, ist_vorschlag')
    .eq('id', itemId)
    .single();
  if (iErr || !item) throw new Error('Videoidee nicht gefunden');
  if (item.ist_vorschlag) throw new Error(VIDEOIDEE_VORSCHLAG_ERROR);

  const { data: strategie, error: sErr } = await window.supabase
    .from('strategie')
    .select('id, creator_auswahl_id')
    .eq('id', item.strategie_id)
    .single();
  if (sErr || !strategie) throw new Error('Konzept nicht gefunden');
  if (!strategie.creator_auswahl_id) {
    throw new Error('Dieses Konzept ist mit keinem Casting verknüpft.');
  }

  const { data: eintrag, error: eErr } = await window.supabase
    .from('creator_auswahl_items')
    .select('id, creator_auswahl_id, zusage, gebucht, prio_1, prio_2, name, creator_id')
    .eq('id', auswahlItemId)
    .single();
  if (eErr || !eintrag) throw new Error('Casting-Eintrag nicht gefunden');

  if (eintrag.creator_auswahl_id !== strategie.creator_auswahl_id) {
    throw new Error('Der Eintrag gehört nicht zum verknüpften Casting.');
  }
  if (!castingUmsetzungGate(eintrag)) {
    throw new Error(CASTING_UMSETZUNG_GATE_ERROR);
  }
  if (!eintrag.creator_id) {
    throw new Error(CASTING_CREATOR_PFLICHT_ERROR);
  }

  if (item.creator_auswahl_item_id && item.creator_auswahl_item_id !== auswahlItemId) {
    if (await hasSkriptForItem(itemId)) {
      throw new Error('Die Zuordnung ist eingefroren, weil bereits ein Skript aus dieser Idee existiert.');
    }
  }

  await updateStrategieItem(itemId, { creator_auswahl_item_id: auswahlItemId });
}

/**
 * Loesung der Zuordnung. Blockt, sobald ein Skript aus der Idee existiert.
 */
export async function unassignCastingItem(itemId) {
  await assertKeinVorschlag(itemId);
  if (await hasSkriptForItem(itemId)) {
    throw new Error('Die Zuordnung ist eingefroren, weil bereits ein Skript aus dieser Idee existiert.');
  }
  await updateStrategieItem(itemId, {
    creator_auswahl_item_id: null,
    ...skriptFreigabeClearPatch()
  });
}

/**
 * Eintraege des mit einem Konzept verknuepften Castings, die einer
 * Videoidee zugeordnet werden duerfen (Prio plus Zusage/Gebucht).
 * Ohne creator_id bleiben sie waehlbar — der Drawer legt den Creator zuerst an.
 */
export async function getZuordbareCastingItems(strategieId) {
  const { data: strategie, error: sErr } = await window.supabase
    .from('strategie')
    .select('id, creator_auswahl_id')
    .eq('id', strategieId)
    .single();
  if (sErr || !strategie || !strategie.creator_auswahl_id) return { castingId: null, items: [] };

  const { data, error } = await window.supabase
    .from('creator_auswahl_items')
    .select('id, name, creator_id, link_instagram, link_tiktok, zusage, gebucht, prio_1, prio_2')
    .eq('creator_auswahl_id', strategie.creator_auswahl_id)
    .order('sortierung', { ascending: true });
  if (error) throw error;

  return {
    castingId: strategie.creator_auswahl_id,
    items: (data || []).filter(i => castingUmsetzungGate(i))
  };
}

/**
 * Videoideen des mit einem Casting gepaarten Konzepts, die diesem
 * Casting-Eintrag zugeordnet werden duerfen. Frei oder bereits dieser
 * Eintrag: waehlbar. Anderer Eintrag oder Skript-Freeze: disabled.
 */
export async function getZuordbareVideoideen(strategieId, auswahlItemId) {
  const { data: strategie, error: sErr } = await window.supabase
    .from('strategie')
    .select('id, creator_auswahl_id')
    .eq('id', strategieId)
    .single();
  if (sErr || !strategie) throw new Error('Konzept nicht gefunden');
  if (!strategie.creator_auswahl_id) return { strategieId: null, items: [] };

  const { data, error } = await window.supabase
    .from('strategie_items')
    .select(`
      id, beschreibung, video_link, creator_auswahl_item_id, ist_vorschlag,
      casting_eintrag:creator_auswahl_item_id(id, name)
    `)
    .eq('strategie_id', strategieId)
    .order('sortierung', { ascending: true });
  if (error) throw error;

  const items = (data || []).filter(i => !i.ist_vorschlag);
  const ids = items.map(i => i.id);
  const frozenIds = new Set();
  if (ids.length) {
    const { data: skripte, error: skErr } = await window.supabase
      .from('skripte')
      .select('strategie_item_id')
      .in('strategie_item_id', ids);
    if (skErr) throw skErr;
    (skripte || []).forEach(s => {
      if (s.strategie_item_id) frozenIds.add(s.strategie_item_id);
    });
  }

  return {
    strategieId: strategie.id,
    items: items.map(item => {
      const eigen = item.creator_auswahl_item_id === auswahlItemId;
      const fremd = !!item.creator_auswahl_item_id && !eigen;
      const frozen = frozenIds.has(item.id);
      const disabled = fremd || (frozen && !eigen);
      let disabledReason = '';
      if (fremd) {
        const name = item.casting_eintrag?.name;
        disabledReason = name
          ? `Hängt schon an ${name}`
          : 'Bereits einem anderen Eintrag zugeordnet';
      } else if (frozen && !eigen) {
        disabledReason = 'Zuordnung eingefroren (Skript existiert)';
      }
      return { ...item, eigen, fremd, frozen, disabled, disabledReason };
    })
  };
}
