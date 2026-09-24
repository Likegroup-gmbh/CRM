// BriefingPersonas.js
// Membership Briefing <-> Persona (campaign_briefings.persona_ids) und
// die daraus abgeleiteten Briefing-Produkte (ADR 0021).

import { recomputeBriefingProdukte } from './BriefingProdukte.js';
import { applyFinalisiertFilter, isFinalisiert } from '../../core/finalisiert.js';

function uniqueIds(ids) {
  return [...new Set((ids || []).filter(Boolean))];
}

export async function loadBriefingIdsForPersona(personaId, { nurFinalisiert = false } = {}) {
  if (!personaId || !window.supabase) return [];
  let query = window.supabase
    .from('campaign_briefings')
    .select('id')
    .contains('persona_ids', [personaId]);
  if (nurFinalisiert) query = applyFinalisiertFilter(query, 'campaign_briefings');
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(r => r.id).filter(Boolean);
}

export async function recomputeBriefingProdukteForPersona(personaId) {
  const briefingIds = await loadBriefingIdsForPersona(personaId);
  for (const id of briefingIds) {
    await recomputeBriefingProdukte(id);
  }
}

async function ensurePersonaMarke(personaId, markeId) {
  if (!personaId || !markeId || !window.supabase) return;
  const { data, error } = await window.supabase
    .from('persona_marke')
    .select('marke_id')
    .eq('persona_id', personaId)
    .eq('marke_id', markeId)
    .maybeSingle();
  if (error) throw error;
  if (data) return;
  const { error: insertError } = await window.supabase
    .from('persona_marke')
    .insert({ persona_id: personaId, marke_id: markeId });
  if (insertError) throw insertError;
}

export async function setBriefingPersonas(briefingId, personaIds) {
  if (!briefingId || !window.supabase) return;
  const wanted = uniqueIds(personaIds);

  const { data: briefing, error: bErr } = await window.supabase
    .from('campaign_briefings')
    .select('id, unternehmen_id, marke_id, persona_ids')
    .eq('id', briefingId)
    .single();
  if (bErr) throw bErr;

  let next = [];
  if (wanted.length) {
    const { data: personas, error: pErr } = await window.supabase
      .from('personas')
      .select('id, unternehmen_id')
      .in('id', wanted);
    if (pErr) throw pErr;
    const allowed = new Set(
      (personas || [])
        .filter(p => p.unternehmen_id === briefing.unternehmen_id)
        .map(p => p.id)
    );
    next = wanted.filter(id => allowed.has(id));
  }

  const { error } = await window.supabase
    .from('campaign_briefings')
    .update({ persona_ids: next })
    .eq('id', briefingId);
  if (error) throw error;

  const prev = new Set((briefing.persona_ids || []).filter(Boolean));
  if (briefing.marke_id) {
    for (const personaId of next.filter(id => !prev.has(id))) {
      await ensurePersonaMarke(personaId, briefing.marke_id);
    }
  }

  await recomputeBriefingProdukte(briefingId);
}

export async function setPersonaBriefings(personaId, briefingIds) {
  if (!personaId || !window.supabase) return;
  const soll = uniqueIds(briefingIds);

  const { data: persona, error: pErr } = await window.supabase
    .from('personas')
    .select('id, unternehmen_id')
    .eq('id', personaId)
    .single();
  if (pErr) throw pErr;

  const currentIds = await loadBriefingIdsForPersona(personaId);
  const currentSet = new Set(currentIds);
  const sollSet = new Set(soll);
  const toAdd = soll.filter(id => !currentSet.has(id));
  const toRemove = currentIds.filter(id => !sollSet.has(id));
  const touched = uniqueIds([...toAdd, ...toRemove]);
  if (!touched.length) return;

  const { data: briefings, error: bErr } = await window.supabase
    .from('campaign_briefings')
    .select('id, unternehmen_id, marke_id, persona_ids, is_draft')
    .in('id', touched);
  if (bErr) throw bErr;

  const addSet = new Set(toAdd);
  const removeSet = new Set(toRemove);

  for (const briefing of briefings || []) {
    if (!isFinalisiert(briefing)) continue;
    if (briefing.unternehmen_id !== persona.unternehmen_id) continue;
    const members = new Set((briefing.persona_ids || []).filter(Boolean));
    if (addSet.has(briefing.id)) {
      members.add(personaId);
      if (briefing.marke_id) await ensurePersonaMarke(personaId, briefing.marke_id);
    }
    if (removeSet.has(briefing.id)) members.delete(personaId);
    const { error } = await window.supabase
      .from('campaign_briefings')
      .update({ persona_ids: [...members] })
      .eq('id', briefing.id);
    if (error) throw error;
    await recomputeBriefingProdukte(briefing.id);
  }
}
