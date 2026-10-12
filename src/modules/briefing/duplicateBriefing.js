// duplicateBriefing.js
// Briefing duplizieren: eine neue Linie, standardmäßig in derselben Produktion,
// auf Wunsch in einer anderen Produktion derselben Kampagne. Inhalt und
// Produkt-Verknüpfungen kommen mit (dieselben Produkte, keine Produkt-Kopien).
// Liky-Daten, Casting, Konzept, Skripte und Kooperationen der Quelle bleiben dort;
// ein finalisiertes Briefing bekommt über ensureBriefingLine ein leeres Casting
// und Konzept. „Produkt übernehmen“ ist etwas anderes (ADR 0052).

import { freierTitel, kopieTitel } from '../produktion/produktionNames.js';
import { addBriefingProdukte } from './BriefingProdukte.js';

// Zeilenidentität und Zeitstempel gehören der neuen Zeile.
const NICHT_KOPIEREN = ['id', 'created_at', 'updated_at'];

const SUCHE_LIMIT = 20;

async function ladeQuelle(sourceId) {
  const { data, error } = await window.supabase
    .from('campaign_briefings')
    .select('*')
    .eq('id', sourceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Briefing nicht gefunden');
  if (!data.produktion_id) {
    throw new Error('Dieses Briefing gehört zu keiner Produktion und lässt sich nicht duplizieren.');
  }
  return data;
}

async function ladeProduktion(produktionId) {
  const { data, error } = await window.supabase
    .from('produktion')
    .select('id, kampagne_id')
    .eq('id', produktionId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.kampagne_id) throw new Error('Produktion nicht gefunden');
  return data;
}

/** Ziel-Produktion mit ihrer Kampagne. Eine andere Produktion muss in derselben Kampagne liegen. */
async function ladeZiel(quelle, produktionId) {
  const zielId = produktionId || quelle.produktion_id;
  const ziel = await ladeProduktion(zielId);
  if (zielId !== quelle.produktion_id) {
    const quellKampagne = quelle.kampagne_id || (await ladeProduktion(quelle.produktion_id)).kampagne_id;
    if (quellKampagne !== ziel.kampagne_id) {
      throw new Error('Das Briefing gehört zu einer anderen Kampagne.');
    }
  }
  return ziel;
}

async function ladeTitelDerProduktion(produktionId) {
  const { data, error } = await window.supabase
    .from('campaign_briefings')
    .select('aktivierung_name')
    .eq('produktion_id', produktionId);
  if (error) throw error;
  return (data || []).map(row => row.aktivierung_name);
}

async function ladeProduktIds(briefingId) {
  const { data, error } = await window.supabase
    .from('campaign_briefing_produkt')
    .select('produkt_id')
    .eq('briefing_id', briefingId);
  if (error) throw error;
  return (data || []).map(row => row.produkt_id);
}

async function raeumeKopieAuf(briefingId) {
  try {
    const { deleteBriefingMitLinie } = await import('../produktion/ProduktionService.js');
    await deleteBriefingMitLinie(briefingId);
  } catch (cleanupError) {
    console.error('Halbe Briefing-Kopie konnte nicht entfernt werden:', cleanupError);
  }
}

/**
 * @param {string} sourceId - Quell-Briefing
 * @param {{ produktionId?: string|null, titel?: string|null }} [opts]
 *   produktionId: Ziel-Produktion derselben Kampagne (Standard: die der Quelle).
 *   titel: Wunschtitel (bei Kollision mit Zähler); ohne Angabe `Titel – Kopie`.
 * @returns {Promise<object>} die neue Briefing-Zeile
 */
export async function duplicateBriefing(sourceId, { produktionId = null, titel = null } = {}) {
  if (!sourceId || !window.supabase) throw new Error('Briefing fehlt');

  const quelle = await ladeQuelle(sourceId);
  const ziel = await ladeZiel(quelle, produktionId);
  const [vorhandene, produktIds] = await Promise.all([
    ladeTitelDerProduktion(ziel.id),
    ladeProduktIds(quelle.id)
  ]);

  const wunsch = String(titel || '').trim();
  const zeile = { ...quelle };
  for (const spalte of NICHT_KOPIEREN) delete zeile[spalte];
  zeile.aktivierung_name = wunsch
    ? freierTitel(wunsch, vorhandene)
    : kopieTitel(quelle.aktivierung_name, vorhandene);
  zeile.kampagne_id = ziel.kampagne_id;
  zeile.produktion_id = ziel.id;

  const { data: kopie, error } = await window.supabase
    .from('campaign_briefings')
    .insert(zeile)
    .select()
    .single();
  if (error) throw error;

  try {
    await addBriefingProdukte(kopie.id, produktIds);
    if (!kopie.is_draft) {
      const { ensureBriefingLine } = await import('../produktion/ProduktionService.js');
      await ensureBriefingLine({
        briefing: kopie,
        kampagneId: ziel.kampagne_id,
        produktId: kopie.produkt_id || null,
        produktionId: ziel.id
      });
    }
  } catch (err) {
    await raeumeKopieAuf(kopie.id);
    throw err;
  }

  return kopie;
}

/**
 * Duplizieren mit Rückmeldung für die UI. Die Aufrufer entscheiden danach, wohin es geht.
 * @param {string} sourceId
 * @param {{ produktionId?: string|null, titel?: string|null }} [opts]
 * @returns {Promise<object|null>} die Kopie, bei Fehler null
 */
export async function duplicateBriefingMitHinweis(sourceId, opts = {}) {
  try {
    const kopie = await duplicateBriefing(sourceId, opts);
    window.toastSystem?.show(`Briefing dupliziert: ${kopie.aktivierung_name}`, 'success');
    window.dispatchEvent(new CustomEvent('entityUpdated', {
      detail: { entity: 'briefing', action: 'created', id: kopie.id }
    }));
    return kopie;
  } catch (err) {
    console.error('Briefing duplizieren fehlgeschlagen:', err);
    window.toastSystem?.show(err.message || 'Briefing konnte nicht dupliziert werden.', 'error');
    return null;
  }
}

const escapeLike = (term) => String(term || '').replace(/[\\%_]/g, (m) => `\\${m}`);

/**
 * Suche nach Briefings der Kampagne als Quelle für eine Kopie (alle Produktionen der Kampagne).
 * Ergebnisform für EntitySearchInput.
 * @returns {Promise<Array<{ id: string, label: string, sub: string, data: object }>>}
 */
export async function listKopierQuellen(kampagneId, term = '') {
  if (!kampagneId || !window.supabase) return [];

  let query = window.supabase
    .from('campaign_briefings')
    .select('id, aktivierung_name, is_draft, created_at, produktion_id, produktion:produktion_id!inner(id, name, kampagne_id)')
    .eq('produktion.kampagne_id', kampagneId)
    .order('created_at', { ascending: false })
    .limit(SUCHE_LIMIT);

  const suchwort = String(term || '').trim();
  if (suchwort) query = query.ilike('aktivierung_name', `%${escapeLike(suchwort)}%`);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    label: row.aktivierung_name || 'Briefing ohne Titel',
    sub: [row.produktion?.name, row.is_draft ? 'Entwurf' : null].filter(Boolean).join(' · '),
    data: row
  }));
}
