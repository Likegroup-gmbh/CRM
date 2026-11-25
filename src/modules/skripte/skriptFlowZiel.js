// skriptFlowZiel.js
// Skripte mit Linie öffnen in der Produktion, Tab Skripte (ADR 0074, 0079).
// Gäste, Skripte ohne Linie und wer Produktion oder Skripte-Tab nicht sieht, bleiben im eigenständigen Tool.

import { canViewTab } from '../../core/TabUtils.js';
import { flowUrl } from '../kampagne/produktionFlowZiele.js';

export function skriptFlowUrl({ produktionId, linieId = null, skriptId = null }) {
  return flowUrl({ produktionId, tab: 'skripte', linieId, id: skriptId });
}

export function darfSkriptImFlow() {
  if (window.guestShare || window.permissionSystem?.isGast || window.isGast?.()) return false;
  return canViewTab('skripte');
}

/**
 * Ziel-URL ohne DB-Abfrage, wenn die Produktion schon offen ist und das Skript
 * seine Linie (briefing_id) mitbringt. null = Fallback auf /skripte/:id.
 */
export function skriptFlowUrlSync({ produktionId, skript }) {
  if (!produktionId || !skript?.id || !skript.briefing_id || !darfSkriptImFlow()) return null;
  return skriptFlowUrl({ produktionId, linieId: skript.briefing_id, skriptId: skript.id });
}

/**
 * Ziel-URL in der Produktion oder null. Der Join auf produktion läuft durch die RLS:
 * wer die Produktion nicht lesen darf, bekommt null zurück und bleibt im Tool.
 */
export async function ladeSkriptFlowZiel(skriptId, db = window.supabase) {
  if (!skriptId || !db || !darfSkriptImFlow()) return null;
  const { data, error } = await db.from('skripte')
    .select('id, briefing_id, produktion:produktion_id(id)')
    .eq('id', skriptId)
    .maybeSingle();
  if (error || !data?.briefing_id || !data.produktion?.id) return null;
  return skriptFlowUrl({ produktionId: data.produktion.id, linieId: data.briefing_id, skriptId: data.id });
}
