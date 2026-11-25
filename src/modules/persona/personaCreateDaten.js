// personaCreateDaten.js
// Ladefunktionen für den Persona-Create-Drawer. Marke ist optional: ohne Marke
// zählen nur Briefings ohne Marke, Produkte kommen dann aus dem Unternehmen.

import { applyFinalisiertFilter } from '../../core/finalisiert.js';

async function allowedIds(fn) {
  const ids = await fn?.();
  return ids ?? null;
}

export async function loadUnternehmen() {
  const allowed = await allowedIds(window.getAllowedUnternehmenIds);
  if (allowed !== null && allowed.length === 0) return [];

  let query = window.supabase.from('unternehmen').select('id, firmenname').order('firmenname');
  if (allowed !== null) query = query.in('id', allowed);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function loadMarken(unternehmenId) {
  const allowed = await allowedIds(window.getAllowedMarkenIds);
  if (allowed !== null && allowed.length === 0) return [];

  let query = window.supabase
    .from('marke')
    .select('id, markenname')
    .eq('unternehmen_id', unternehmenId)
    .order('markenname');
  if (allowed !== null) query = query.in('id', allowed);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function loadBriefings(unternehmenId, markeId) {
  let query = window.supabase
    .from('campaign_briefings')
    .select('id, aktivierung_name')
    .eq('unternehmen_id', unternehmenId);
  query = markeId ? query.eq('marke_id', markeId) : query.is('marke_id', null);
  query = applyFinalisiertFilter(query, 'campaign_briefings')
    .order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function loadProdukte(unternehmenId, markeId) {
  if (!markeId) {
    const { data, error } = await window.supabase
      .from('produkt')
      .select('id, name, unternehmen_id')
      .eq('unternehmen_id', unternehmenId)
      .order('name');
    if (error) throw error;
    return data || [];
  }
  const { data, error } = await window.supabase
    .from('produkt_marke')
    .select('produkt:produkt_id(id, name, unternehmen_id)')
    .eq('marke_id', markeId);
  if (error) throw error;
  return (data || [])
    .map((row) => row.produkt)
    .filter((produkt) => produkt && produkt.unternehmen_id === unternehmenId)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'de'));
}

export async function loadMarkeRow(markeId) {
  const { data, error } = await window.supabase
    .from('marke')
    .select('id, markenname, unternehmen_id, unternehmen:unternehmen_id(firmenname)')
    .eq('id', markeId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
