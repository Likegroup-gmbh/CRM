// ProduktionService.js
// Anlegen der Produktion zum Briefing und Auflisten unter der Kampagne.

import { lineNames } from './produktionNames.js';
import { castingPresetFromBriefing } from './castingPresetFromBriefing.js';
import { berechneHiddenColumns, STANDARD_VERSTECKTE_SPALTEN, wendePresetAn } from '../creator-auswahl/sourcingSpaltenPreset.js';
import { syncBriefingProdukte } from '../briefing/BriefingProdukte.js';

const CHILD_BRIEFING_TABLES = ['creator_auswahl', 'strategie', 'skripte', 'kooperationen'];

export function scopeByProduktion(query, produktionId) {
  if (!produktionId) return query;
  return query.eq('produktion_id', produktionId);
}

export function uniqueIds(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function uniqueProducts(products) {
  const map = new Map();
  for (const produkt of products || []) {
    if (produkt?.id && !map.has(produkt.id)) map.set(produkt.id, produkt);
  }
  return [...map.values()];
}

/**
 * Briefing einer Produktion: eigene FK, sonst die eine gemeinsame briefing_id
 * der Kinder. Produkt: eigene FK, sonst das eine Produkt dieses Briefings.
 * Mehrdeutige Treffer werden nicht geraten.
 */
export function resolveProduktionLinks({
  produktion,
  childBriefingIds = [],
  briefingProdukte = [],
  takenBriefingIds = [],
  briefing = null
}) {
  const ownBriefing = produktion?.briefing_id || null;
  const fromChildren = uniqueIds(childBriefingIds);
  const taken = new Set((takenBriefingIds || []).filter(id => id && id !== ownBriefing));

  let briefingIds = [];
  let ambiguous = false;
  if (ownBriefing) {
    briefingIds = [ownBriefing];
  } else if (fromChildren.length === 1) {
    briefingIds = fromChildren;
  } else if (fromChildren.length > 1) {
    briefingIds = fromChildren;
    ambiguous = true;
  }

  const briefingId = ambiguous ? null : (briefingIds[0] || null);
  let produktId = produktion?.produkt_id || null;
  let produkt = null;
  if (!produktId && briefingId) {
    const products = uniqueProducts(briefingProdukte);
    if (products.length === 1) {
      produktId = products[0].id;
      produkt = products[0];
    }
  }

  const patch = {};
  if (briefingId && !ownBriefing && !taken.has(briefingId)) {
    patch.briefing_id = briefingId;
    const titel = String(briefing?.aktivierung_name || '').trim();
    if (titel) patch.name = titel;
  }
  if (produktId && !produktion?.produkt_id) {
    patch.produkt_id = produktId;
  }

  return {
    briefingIds,
    briefingId,
    produktId: produktId || null,
    produkt,
    ambiguous,
    patch: Object.keys(patch).length ? patch : null
  };
}

/** Genau eine Produktion ohne Briefing: deren Id, sonst null. */
export function emptyProduktionId(produktionen) {
  const empty = (produktionen || []).filter(p => {
    if (p?.briefing_id) return false;
    return (p?.resolvedBriefingIds || []).length === 0;
  });
  return empty.length === 1 ? empty[0].id : null;
}

export function sumBudgetByProduktion(kooperationen, videos) {
  const koopToProd = new Map();
  for (const koop of kooperationen || []) {
    if (koop?.id && koop.produktion_id) koopToProd.set(koop.id, koop.produktion_id);
  }
  const sums = new Map();
  for (const video of videos || []) {
    const produktionId = koopToProd.get(video?.kooperation_id);
    if (!produktionId) continue;
    const amount = parseFloat(video.verkaufspreis_netto) || 0;
    sums.set(produktionId, (sums.get(produktionId) || 0) + amount);
  }
  return sums;
}

async function loadChildBriefingIds(produktionIds) {
  const map = new Map();
  if (!produktionIds.length || !window.supabase) return map;
  const results = await Promise.all(CHILD_BRIEFING_TABLES.map(table =>
    window.supabase
      .from(table)
      .select('produktion_id, briefing_id')
      .in('produktion_id', produktionIds)
  ));
  for (const result of results) {
    if (result.error) throw result.error;
    for (const row of result.data || []) {
      if (!row.produktion_id || !row.briefing_id) continue;
      const list = map.get(row.produktion_id) || [];
      list.push(row.briefing_id);
      map.set(row.produktion_id, list);
    }
  }
  return map;
}

async function loadBriefings(ids) {
  const map = new Map();
  if (!ids.length || !window.supabase) return map;
  const { data, error } = await window.supabase
    .from('campaign_briefings')
    .select('id, aktivierung_name, bereich, is_draft, content_deadline, created_at')
    .in('id', ids);
  if (error) throw error;
  for (const row of data || []) map.set(row.id, row);
  return map;
}

async function loadProdukteByBriefing(briefingIds) {
  const map = new Map();
  if (!briefingIds.length || !window.supabase) return map;
  const { data, error } = await window.supabase
    .from('campaign_briefing_produkt')
    .select('briefing_id, produkt:produkt_id(id, name)')
    .in('briefing_id', briefingIds);
  if (error) throw error;
  for (const row of data || []) {
    if (!row.produkt?.id) continue;
    const list = map.get(row.briefing_id) || [];
    list.push(row.produkt);
    map.set(row.briefing_id, list);
  }
  return map;
}

async function persistPatch(id, patch) {
  const { error } = await window.supabase.from('produktion').update(patch).eq('id', id);
  if (!error) return { ...patch };
  if (error.code === '23505' && patch.briefing_id && patch.produkt_id) {
    const rest = { produkt_id: patch.produkt_id };
    const retry = await window.supabase.from('produktion').update(rest).eq('id', id);
    if (!retry.error) return rest;
    console.error('Produktion-Produkt nicht geschrieben', retry.error);
    return {};
  }
  console.error('Produktion-Verknüpfung nicht geschrieben', error);
  return {};
}

export async function attachProduktionLinks(rows) {
  if (!rows?.length || !window.supabase) return rows || [];

  const needsChildren = rows.filter(row => !row.briefing_id).map(row => row.id);
  const childMap = await loadChildBriefingIds(needsChildren);
  const taken = new Set(rows.map(row => row.briefing_id).filter(Boolean));

  const planned = rows.map(row => {
    const childBriefingIds = childMap.get(row.id) || [];
    const preview = resolveProduktionLinks({
      produktion: row,
      childBriefingIds,
      takenBriefingIds: [...taken]
    });
    return { row, childBriefingIds, preview };
  });

  const briefingIds = uniqueIds(planned.flatMap(item => item.preview.briefingIds));
  const [briefingsById, productsByBriefing] = await Promise.all([
    loadBriefings(briefingIds),
    loadProdukteByBriefing(uniqueIds(
      planned.filter(item => item.preview.briefingId && !item.row.produkt_id).map(item => item.preview.briefingId)
    ))
  ]);

  const next = [];
  for (const item of planned) {
    const briefing = item.preview.briefingId ? briefingsById.get(item.preview.briefingId) || null : null;
    const resolution = resolveProduktionLinks({
      produktion: item.row,
      childBriefingIds: item.childBriefingIds,
      briefingProdukte: item.preview.briefingId ? (productsByBriefing.get(item.preview.briefingId) || []) : [],
      takenBriefingIds: [...taken],
      briefing
    });
    let row = {
      ...item.row,
      resolvedBriefingIds: resolution.briefingIds
    };
    if (briefing) row.briefing = briefing;
    if (resolution.produkt) row.produkt = resolution.produkt;
    if (resolution.patch) {
      const applied = await persistPatch(row.id, resolution.patch);
      row = { ...row, ...applied };
      if (applied.briefing_id) taken.add(applied.briefing_id);
    }
    next.push(row);
  }
  return next;
}

async function attachProduktionBudget(rows, kampagneId) {
  if (!rows.length || !window.supabase) return rows;
  const { data: koops, error } = await window.supabase
    .from('kooperationen')
    .select('id, produktion_id')
    .eq('kampagne_id', kampagneId);
  if (error) throw error;

  const koopIds = (koops || []).map(koop => koop.id).filter(Boolean);
  let videos = [];
  if (koopIds.length) {
    const { data, error: videoError } = await window.supabase
      .from('kooperation_videos')
      .select('kooperation_id, verkaufspreis_netto')
      .in('kooperation_id', koopIds);
    if (videoError) throw videoError;
    videos = data || [];
  }

  const sums = sumBudgetByProduktion(koops || [], videos);
  return rows.map(row => ({ ...row, budgetUsed: sums.get(row.id) || 0 }));
}

export async function listProduktionen(kampagneId) {
  if (!kampagneId || !window.supabase) return [];
  const { data, error } = await window.supabase
    .from('produktion')
    .select('id, name, kampagne_id, produkt_id, briefing_id, created_at, produkt:produkt_id(id, name), briefing:briefing_id(id, aktivierung_name)')
    .eq('kampagne_id', kampagneId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const linked = await attachProduktionLinks(data || []);
  return attachProduktionBudget(linked, kampagneId);
}

export async function loadProduktion(produktionId) {
  if (!produktionId || !window.supabase) return null;
  const { data, error } = await window.supabase
    .from('produktion')
    .select('id, name, kampagne_id, produkt_id, briefing_id, created_at, produkt:produkt_id(id, name), briefing:briefing_id(id, aktivierung_name, bereich, is_draft, content_deadline, created_at)')
    .eq('id', produktionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [linked] = await attachProduktionLinks([data]);
  return linked;
}

export async function createProduktionForBriefing({ kampagneId, briefingId, produktId, titel, produktionId = null }) {
  if (!window.supabase) throw new Error('Supabase nicht verfügbar');
  if (!kampagneId) throw new Error('Kampagne fehlt');
  if (!briefingId) throw new Error('Briefing fehlt');

  const names = lineNames(titel);
  const payload = {
    briefing_id: briefingId,
    name: names.produktion || titel || 'Produktion'
  };
  if (produktId) payload.produkt_id = produktId;

  if (produktionId) {
    const { data, error } = await window.supabase
      .from('produktion')
      .update(payload)
      .eq('id', produktionId)
      .eq('kampagne_id', kampagneId)
      .select('id')
      .single();
    if (error) throw error;
    return data;
  }

  const { data: existing, error: existingError } = await window.supabase
    .from('produktion')
    .select('id')
    .eq('briefing_id', briefingId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) return existing;

  const { data, error } = await window.supabase
    .from('produktion')
    .insert({
      kampagne_id: kampagneId,
      ...payload
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

async function rowsForProduktion(table, produktionId, columns) {
  const { data, error } = await window.supabase
    .from(table)
    .select(columns)
    .eq('produktion_id', produktionId);
  if (error) throw error;
  return data || [];
}

function hiddenForNewList(preset) {
  return [...berechneHiddenColumns(preset), ...STANDARD_VERSTECKTE_SPALTEN];
}

/**
 * Finalisiertes Briefing: eine Produktion, ein Casting, ein Konzept.
 * Fehlende Kinder werden nachgelegt, vorhandene nicht verdoppelt.
 * Listenwerte kommen aus dem Briefing und überschreiben Mix-Bestand dieser Produktion.
 */
export async function ensureBriefingLine({ briefing, kampagneId, produktId, produktionId = null }) {
  if (!briefing?.id) throw new Error('Briefing fehlt');
  if (briefing.is_draft) return null;
  if (!kampagneId) throw new Error('Kampagne ist Pflicht.');

  const produktion = await createProduktionForBriefing({
    kampagneId,
    briefingId: briefing.id,
    produktId,
    titel: briefing.aktivierung_name,
    produktionId
  });

  const names = lineNames(briefing.aktivierung_name);
  const patch = {
    briefing_id: briefing.id,
    name: names.produktion || briefing.aktivierung_name || 'Produktion'
  };
  if (produktId) patch.produkt_id = produktId;
  const { error: patchError } = await window.supabase
    .from('produktion')
    .update(patch)
    .eq('id', produktion.id);
  if (patchError) throw patchError;

  if (produktId) await syncBriefingProdukte(briefing.id, [produktId]);

  const preset = castingPresetFromBriefing(briefing);
  await syncCastings(produktion.id, briefing, kampagneId, names, preset);
  await syncKonzept(produktion.id, briefing, kampagneId, names);
  await linkLinePair(produktion.id);
  return produktion;
}

async function syncCastings(produktionId, briefing, kampagneId, names, preset) {
  const listen = await rowsForProduktion(
    'creator_auswahl',
    produktionId,
    'id, hidden_columns, strategie_id'
  );

  if (!listen.length) {
    const { error } = await window.supabase
      .from('creator_auswahl')
      .insert({
        name: names.casting,
        briefing_id: briefing.id,
        produktion_id: produktionId,
        kampagne_id: kampagneId,
        unternehmen_id: briefing.unternehmen_id || null,
        marke_id: briefing.marke_id || null,
        liste_typ: preset.liste_typ,
        plattformen: preset.plattformen,
        ig_formate: preset.ig_formate,
        tkp: preset.tkp,
        hidden_columns: hiddenForNewList(preset),
        created_by: window.currentUser?.id || null
      });
    if (error) throw error;
    return;
  }

  for (const liste of listen) {
    const { error } = await window.supabase
      .from('creator_auswahl')
      .update({
        name: names.casting,
        briefing_id: briefing.id,
        liste_typ: preset.liste_typ,
        plattformen: preset.plattformen,
        ig_formate: preset.ig_formate,
        tkp: preset.tkp,
        hidden_columns: wendePresetAn(liste.hidden_columns || [], preset)
      })
      .eq('id', liste.id);
    if (error) throw error;
  }
}

async function syncKonzept(produktionId, briefing, kampagneId, names) {
  const konzepte = await rowsForProduktion('strategie', produktionId, 'id, creator_auswahl_id');
  if (konzepte.length) {
    for (const konzept of konzepte) {
      const { error } = await window.supabase
        .from('strategie')
        .update({
          name: names.konzept,
          briefing_id: briefing.id
        })
        .eq('id', konzept.id);
      if (error) throw error;
    }
    return;
  }

  const { error } = await window.supabase
    .from('strategie')
    .insert({
      name: names.konzept,
      briefing_id: briefing.id,
      produktion_id: produktionId,
      kampagne_id: kampagneId,
      unternehmen_id: briefing.unternehmen_id || null,
      marke_id: briefing.marke_id || null,
      created_by: window.currentUser?.id || null
    });
  if (error) throw error;
}

async function linkLinePair(produktionId) {
  const listen = await rowsForProduktion('creator_auswahl', produktionId, 'id, strategie_id');
  const konzepte = await rowsForProduktion('strategie', produktionId, 'id, creator_auswahl_id');
  const casting = listen[0];
  const konzept = konzepte[0];
  if (!casting || !konzept) return;
  if (casting.strategie_id || konzept.creator_auswahl_id) return;

  const { error: konzeptError } = await window.supabase
    .from('strategie')
    .update({ creator_auswahl_id: casting.id })
    .eq('id', konzept.id);
  if (konzeptError) throw konzeptError;

  const { error: castingError } = await window.supabase
    .from('creator_auswahl')
    .update({ strategie_id: konzept.id })
    .eq('id', casting.id);
  if (castingError) throw castingError;
}
