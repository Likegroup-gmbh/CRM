// skriptCreateKontext.js
// Ableitung des Generator-Payloads aus Videoidee → Konzept → Casting-Eintrag.
// Persona: die der Videoidee, sonst die des Casting-Eintrags.
// Produkt: die ID an der Videoidee. Ohne die bleibt der Persona-Fit
// (genau ein accepted Fit, sonst null) fuer Altbestand vor der Spalte.

import { funnelFuerSkript } from '../strategie/strategieFunnelOptions.js';
import { getStrategieVideolaenge } from '../strategie/strategieVideolaenge.js';
import { skriptSchluessel } from '../briefing/videolaenge.js';

/** Dauer der Videoidee als Skript-Schlüssel ("15-20"), leer: null. */
export function videolaengeSchluesselVonItem(item) {
  const iv = getStrategieVideolaenge(item);
  return iv ? skriptSchluessel(iv.von, iv.bis) : null;
}

/** Persona fürs Skript: Videoidee, sonst Casting-Eintrag, sonst keine. */
export function personaIdFuerSkript(item) {
  return item?.persona_id || item?.casting_eintrag?.persona_id || null;
}

export function pickProduktId(produktIds) {
  const ids = [...new Set((produktIds || []).filter(Boolean))];
  return ids.length === 1 ? ids[0] : null;
}

/**
 * Warnhinweis im Create-Drawer: Paid-Videoidee ohne Funnel-Stufe. Kein Gate,
 * Anlegen bleibt möglich; Liky fragt dann in den Rückfragen nach.
 */
export function funnelWarnung(item) {
  if (!item) return '';
  if (item.strategie?.briefing?.bereich !== 'paid_creator_ads') return '';
  if (funnelFuerSkript(item.funnel_stufe)) return '';
  return 'Im Konzept ist keine Funnel-Stufe gesetzt. Liky fragt in den Rückfragen danach.';
}

/**
 * Warnhinweis im Create-Drawer: weder Videoidee noch Casting-Eintrag nennen eine
 * Persona, das Briefing hat aber welche. Kein Gate; Liky fragt in den Rückfragen.
 */
export function personaWarnung(item) {
  if (!item || personaIdFuerSkript(item)) return '';
  const personaIds = item.strategie?.briefing?.persona_ids;
  if (!Array.isArray(personaIds) || !personaIds.length) return '';
  return 'Die Videoidee hat keine Persona. Liky fragt in den Rückfragen, welche Persona aus dem Briefing gilt.';
}

export function resolveSkriptCreatePayload(item, { produktIds = [] } = {}) {
  const strategie = item?.strategie || {};
  const unternehmen = strategie.unternehmen || {};
  const marke = strategie.marke || {};
  const briefing = strategie.briefing || null;
  const eintrag = item?.casting_eintrag || null;

  return {
    unternehmen_id: strategie.unternehmen_id || unternehmen.id || null,
    marke_id: strategie.marke_id || marke.id || null,
    kampagne_id: strategie.kampagne_id || strategie.kampagne?.id || null,
    produktion_id: strategie.produktion_id || null,
    briefing_id: strategie.briefing_id || briefing?.id || null,
    briefing,
    bereich: briefing?.bereich || null,
    branche_id: marke.branche_id || unternehmen.branche_id || null,
    // Konzept schlägt Casting: die Persona der Videoidee gilt, leer fällt auf den Casting-Eintrag zurück.
    persona_id: personaIdFuerSkript(item),
    produkt_id: item?.produkt_id || pickProduktId(produktIds),
    strategie_item_id: item?.id || null,
    video_idee: (item?.beschreibung || '').trim() || null,
    // Konzept schlägt Briefing: leer heißt keine Vorgabe, nie ein Briefing-Fallback.
    funnel_stufe: funnelFuerSkript(item?.funnel_stufe),
    // Konzept schlägt Briefing: die Dauer der Videoidee gilt. Leer bleibt null, dann
    // füllt SkripteService sie beim Anlegen aus dem Briefing (Fallback).
    video_laenge: videolaengeSchluesselVonItem(item)
  };
}
