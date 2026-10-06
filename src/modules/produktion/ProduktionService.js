// ProduktionService.js
// Produktion (Container unter der Kampagne) und ihre Linien (ADR 0045).
// Eine Linie ist ein Briefing mit seinem Casting und Konzept; die Zuordnung steht
// am Briefing (campaign_briefings.produktion_id).

import { fetchAllRows } from '../../core/fetchAllRows.js';
import { geistProduktionName, lineNames } from './produktionNames.js';
import { castingPresetFromBriefing } from './castingPresetFromBriefing.js';
import { berechneHiddenColumns, STANDARD_VERSTECKTE_SPALTEN, wendePresetAn } from '../creator-auswahl/sourcingSpaltenPreset.js';
import { syncBriefingProdukte } from '../briefing/BriefingProdukte.js';

export function scopeByProduktion(query, produktionId) {
  if (!produktionId) return query;
  return query.eq('produktion_id', produktionId);
}

/** Linie einer Produktion eingrenzen: Casting, Konzept, Skripte, Kooperationen tragen briefing_id. */
export function scopeByLinie(query, briefingId) {
  if (!briefingId) return query;
  return query.eq('briefing_id', briefingId);
}

export function uniqueIds(values) {
  return [...new Set((values || []).filter(Boolean))];
}

const BRIEFINGS_EMBED = `briefings:campaign_briefings!produktion_id(
    id, aktivierung_name, bereich, is_draft, content_deadline, persona_ids, created_at,
    produkte:campaign_briefing_produkt(produkt:produkt_id(id, name))
  )`;

/** Linien einer Produktion aus ihren Briefings, älteste zuerst. */
export function linienFromBriefings(briefings) {
  return (briefings || [])
    .filter(b => b?.id)
    .slice()
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
    .map(b => ({
      id: b.id,
      briefing_id: b.id,
      name: b.aktivierung_name || 'Briefing',
      is_draft: !!b.is_draft,
      bereich: b.bereich || null,
      briefing: b
    }));
}

/**
 * Setzt `linien` und `briefing` (die erste finalisierte, sonst die erste Linie)
 * auf eine Produktionszeile. Listen und Karten zeigen damit weiter ein Briefing,
 * `briefings` hält alle.
 */
export function withLinien(row) {
  if (!row) return row;
  const briefings = Array.isArray(row.briefings)
    ? row.briefings
    : (row.briefing ? [row.briefing] : []);
  const linien = linienFromBriefings(briefings);
  const primary = linien.find(l => !l.is_draft) || linien[0] || null;
  return {
    ...row,
    briefings: linien.map(l => l.briefing),
    linien,
    briefing: primary?.briefing || null
  };
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

const PRODUKTION_LIST_SELECT = `
  id, name, budget, kampagne_id, produkt_id, created_at,
  produkt:produkt_id(id, name),
  briefings:campaign_briefings!produktion_id(
    id, aktivierung_name, persona_ids, is_draft, created_at,
    produkte:campaign_briefing_produkt(produkt:produkt_id(id, name))
  ),
  kampagne:kampagne_id(
    id, kampagnenname, eigener_name, volumen, creator_budget, start, deadline,
    unternehmen_id, marke_id,
    unternehmen:unternehmen_id(id, firmenname, logo_url),
    marke:marke_id(id, markenname, logo_url),
    auftrag:auftrag_id(creator_budget, gesamt_budget, nettobetrag, start, ende)
  ),
  creator_auswahl(id, name),
  strategie(id, name),
  skripte(id, titel, hook),
  vertraege(id, name)
`;

async function attachProduktionPersonas(rows) {
  const normalized = (rows || []).map(withLinien);
  const ids = uniqueIds(normalized.flatMap(row => (row.briefings || []).flatMap(b => b.persona_ids || [])));
  if (!ids.length || !window.supabase) return normalized;

  const { data, error } = await window.supabase
    .from('personas')
    .select('id, name')
    .in('id', ids);
  if (error) throw error;

  const byId = new Map((data || []).map(persona => [persona.id, persona]));
  const enrich = briefing => ({
    ...briefing,
    verknuepfte_personas: (briefing.persona_ids || []).map(id => byId.get(id)).filter(Boolean)
  });
  return normalized.map(row => {
    if (!row.briefings.length) return row;
    return withLinien({ ...row, briefings: row.briefings.map(enrich) });
  });
}

export function applyProduktionVerbrauch(rows, verbrauch) {
  const sums = new Map();
  for (const row of verbrauch || []) {
    if (!row?.produktion_id) continue;
    sums.set(row.produktion_id, parseFloat(row.budget_used) || 0);
  }
  return (rows || []).map(row => ({
    ...row,
    budgetUsed: sums.get(row.id) || 0
  }));
}

function loadProduktionVerbrauch() {
  return window.supabase
    .from('produktion_verbrauch')
    .select('produktion_id, budget_used')
    .then(({ data, error }) => {
      if (error) throw error;
      return data || [];
    });
}

/**
 * Alle Produktionen, neueste zuerst (auch ohne Briefing).
 * Verbrauch kommt aus produktion_verbrauch (eine Summe je Produktion), nicht
 * aus allen Video-Zeilen. onRows feuert, sobald die Produktionen da sind —
 * mit budgetUsed, wenn die Summe schon da ist, sonst ohne.
 */
export async function listAllProduktionen({ onRows } = {}) {
  if (!window.supabase) {
    onRows?.([]);
    return [];
  }

  const rowsPromise = fetchAllRows(window.supabase, 'produktion', PRODUKTION_LIST_SELECT)
    .then(rows => {
      rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      return rows;
    });
  const budgetPromise = Promise.resolve()
    .then(loadProduktionVerbrauch)
    .then(
      data => ({ ok: true, data }),
      error => ({ ok: false, error })
    );

  const rows = await attachProduktionPersonas(await rowsPromise);
  const winner = await Promise.race([
    budgetPromise,
    Promise.resolve(null)
  ]);

  if (winner?.ok) {
    const withBudget = applyProduktionVerbrauch(rows, winner.data);
    onRows?.(withBudget);
    return withBudget;
  }

  onRows?.(rows);

  const result = winner || await budgetPromise;
  if (!result.ok) {
    console.error('Produktion-Verbrauch nicht geladen', result.error);
    return rows;
  }
  return applyProduktionVerbrauch(rows, result.data);
}

export async function listProduktionen(kampagneId) {
  if (!kampagneId || !window.supabase) return [];
  const { data, error } = await window.supabase
    .from('produktion')
    .select(`id, name, budget, kampagne_id, produkt_id, created_at, produkt:produkt_id(id, name), ${BRIEFINGS_EMBED}`)
    .eq('kampagne_id', kampagneId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return attachProduktionBudget((data || []).map(withLinien), kampagneId);
}

export async function loadProduktion(produktionId) {
  if (!produktionId || !window.supabase) return null;
  const { data, error } = await window.supabase
    .from('produktion')
    .select(`id, name, budget, kampagne_id, produkt_id, created_at, produkt:produkt_id(id, name), ${BRIEFINGS_EMBED}`)
    .eq('id', produktionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: verbrauch, error: verbrauchError } = await window.supabase
    .from('produktion_verbrauch')
    .select('budget_used')
    .eq('produktion_id', produktionId)
    .maybeSingle();
  if (verbrauchError) throw verbrauchError;
  return {
    ...withLinien(data),
    budgetUsed: parseFloat(verbrauch?.budget_used) || 0
  };
}

/** Linien einer Produktion (Briefings, auch Entwürfe), älteste zuerst. */
export async function listLinien(produktionId) {
  if (!produktionId || !window.supabase) return [];
  const { data, error } = await window.supabase
    .from('campaign_briefings')
    .select('id, aktivierung_name, bereich, is_draft, created_at')
    .eq('produktion_id', produktionId);
  if (error) throw error;
  return linienFromBriefings(data || []);
}

/** Nächste freie Nummer für `Basis – Produktion N`. */
export function nextProduktionNummer(namen) {
  let max = 0;
  for (const name of namen || []) {
    const match = /Produktion (\d+)\s*$/.exec(String(name || ''));
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return Math.max(max, (namen || []).length) + 1;
}

/** Legt von Hand eine weitere Produktion unter der Kampagne an. */
export async function createProduktion({ kampagneId, name = '' } = {}) {
  if (!window.supabase) throw new Error('Supabase nicht verfügbar');
  if (!kampagneId) throw new Error('Kampagne fehlt');

  const [{ data: kampagne, error: kampagneError }, { data: bestand, error: bestandError }] = await Promise.all([
    window.supabase.from('kampagne').select('kampagnenname, eigener_name').eq('id', kampagneId).maybeSingle(),
    window.supabase.from('produktion').select('name').eq('kampagne_id', kampagneId)
  ]);
  if (kampagneError) throw kampagneError;
  if (bestandError) throw bestandError;

  const basis = String(kampagne?.kampagnenname || kampagne?.eigener_name || '').trim();
  const n = nextProduktionNummer((bestand || []).map(row => row.name));
  const { data, error } = await window.supabase
    .from('produktion')
    .insert({
      kampagne_id: kampagneId,
      name: String(name || '').trim() || geistProduktionName(basis, n)
    })
    .select('id, name')
    .single();
  if (error) throw error;
  return data;
}

async function countRows(table, column, value) {
  const { count, error } = await window.supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, value);
  if (error) throw error;
  return count || 0;
}

/** Eine Linie ist nicht löschbar, sobald sie Kooperationen hat. */
export async function canDeleteLinie(briefingId) {
  if (!briefingId || !window.supabase) return { ok: false, reason: 'Linie fehlt' };
  const koops = await countRows('kooperationen', 'briefing_id', briefingId);
  if (koops > 0) {
    return { ok: false, reason: 'Diese Linie hat Kooperationen und kann nicht gelöscht werden.' };
  }
  return { ok: true, reason: '' };
}

/**
 * Löscht Skripte, Konzept und Casting der Linie. Das Briefing selbst löscht der Aufrufer.
 * Vorher mit canDeleteLinie prüfen und bestätigen lassen.
 */
export async function deleteLinieInhalt(briefingId) {
  const gate = await canDeleteLinie(briefingId);
  if (!gate.ok) throw new Error(gate.reason);
  for (const table of ['skripte', 'strategie', 'creator_auswahl']) {
    const { error } = await window.supabase.from(table).delete().eq('briefing_id', briefingId);
    if (error) throw error;
  }
}

/** Briefing samt Linien-Inhalt löschen (Gate: keine Kooperationen). Bestätigung macht der Aufrufer. */
export async function deleteBriefingMitLinie(briefingId) {
  await deleteLinieInhalt(briefingId);
  const { error } = await window.supabase.from('campaign_briefings').delete().eq('id', briefingId);
  if (error) throw error;
}

export const LINIE_LOESCHEN_HINWEIS = 'Casting, Konzept und Skripte dieser Linie werden mit gelöscht.';

/** Eine Produktion ist nur ohne Linien (Entwürfe eingeschlossen) löschbar. */
export async function canDeleteProduktion(produktionId) {
  if (!produktionId || !window.supabase) return { ok: false, reason: 'Produktion fehlt' };
  const linien = await countRows('campaign_briefings', 'produktion_id', produktionId);
  if (linien > 0) {
    return { ok: false, reason: 'Diese Produktion hat Briefings und kann nicht gelöscht werden.' };
  }
  const koops = await countRows('kooperationen', 'produktion_id', produktionId);
  if (koops > 0) {
    return { ok: false, reason: 'Diese Produktion hat Kooperationen und kann nicht gelöscht werden.' };
  }
  return { ok: true, reason: '' };
}

/** Leere Produktion löschen (Gate: keine Briefings/Entwürfe, keine Kooperationen). */
export async function deleteProduktion(produktionId) {
  const gate = await canDeleteProduktion(produktionId);
  if (!gate.ok) throw new Error(gate.reason);
  const { error } = await window.supabase.from('produktion').delete().eq('id', produktionId);
  if (error) throw error;
}

function hiddenForNewList(preset) {
  return [...berechneHiddenColumns(preset), ...STANDARD_VERSTECKTE_SPALTEN];
}

const GEIST_NAME = /Produktion \d+\s*$/;

async function ladeProduktionFuerLinie(produktionId, kampagneId) {
  const { data, error } = await window.supabase
    .from('produktion')
    .select('id, name, kampagne_id')
    .eq('id', produktionId)
    .eq('kampagne_id', kampagneId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Produktion nicht gefunden');
  return data;
}

async function zeileFuerLinie(table, briefingId, produktionId, columns) {
  const own = await window.supabase
    .from(table)
    .select(columns)
    .eq('briefing_id', briefingId)
    .limit(1);
  if (own.error) throw own.error;
  if (own.data?.length) return own.data[0];
  if (!produktionId) return null;

  // Altbestand ohne Briefing-Link in dieser Produktion übernehmen
  const orphan = await window.supabase
    .from(table)
    .select(columns)
    .eq('produktion_id', produktionId)
    .is('briefing_id', null)
    .limit(1);
  if (orphan.error) throw orphan.error;
  return orphan.data?.[0] || null;
}

/**
 * Finalisiertes Briefing: eine Linie mit einem Casting und einem Konzept.
 * Fehlende Kinder werden nachgelegt, vorhandene nicht verdoppelt.
 * Listenwerte kommen aus dem Briefing und überschreiben nur das Casting dieser Linie.
 * Der Produktionsname wird nur beim ersten Finalisieren der ersten Linie übernommen.
 */
export async function ensureBriefingLine({ briefing, kampagneId, produktId, produktionId = null }) {
  if (!briefing?.id) throw new Error('Briefing fehlt');
  if (briefing.is_draft) return null;
  if (!kampagneId) throw new Error('Kampagne ist Pflicht.');

  const zielId = produktionId || briefing.produktion_id || null;
  if (!zielId) throw new Error('Bitte eine Produktion wählen.');

  const produktion = await ladeProduktionFuerLinie(zielId, kampagneId);
  const names = lineNames(briefing.aktivierung_name);

  const vorhandenesCasting = await zeileFuerLinie('creator_auswahl', briefing.id, produktion.id, 'id, briefing_id, hidden_columns, strategie_id');
  if (briefing.produktion_id && briefing.produktion_id !== produktion.id && vorhandenesCasting?.briefing_id) {
    throw new Error('Dieses Briefing gehört schon zu einer anderen Produktion.');
  }

  if (briefing.produktion_id !== produktion.id) {
    const { error } = await window.supabase
      .from('campaign_briefings')
      .update({ produktion_id: produktion.id })
      .eq('id', briefing.id);
    if (error) throw error;
  }

  if (names.produktion && !vorhandenesCasting && GEIST_NAME.test(produktion.name || '')) {
    const { count, error: otherError } = await window.supabase
      .from('campaign_briefings')
      .select('id', { count: 'exact', head: true })
      .eq('produktion_id', produktion.id)
      .eq('is_draft', false)
      .neq('id', briefing.id);
    if (otherError) throw otherError;
    if (!count) {
      const { error } = await window.supabase
        .from('produktion')
        .update({ name: names.produktion })
        .eq('id', produktion.id);
      if (error) throw error;
    }
  }

  if (produktId) await syncBriefingProdukte(briefing.id, [produktId]);

  const preset = castingPresetFromBriefing(briefing);
  await syncCasting(produktion.id, briefing, kampagneId, names, preset);
  await syncKonzept(produktion.id, briefing, kampagneId, names);
  await linkLinePair(briefing.id);
  return produktion;
}

async function syncCasting(produktionId, briefing, kampagneId, names, preset) {
  const liste = await zeileFuerLinie('creator_auswahl', briefing.id, produktionId, 'id, hidden_columns, strategie_id');

  if (!liste) {
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

async function syncKonzept(produktionId, briefing, kampagneId, names) {
  const konzept = await zeileFuerLinie('strategie', briefing.id, produktionId, 'id, creator_auswahl_id');
  if (konzept) {
    const { error } = await window.supabase
      .from('strategie')
      .update({
        name: names.konzept,
        briefing_id: briefing.id
      })
      .eq('id', konzept.id);
    if (error) throw error;
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

async function linkLinePair(briefingId) {
  const casting = await zeileFuerLinie('creator_auswahl', briefingId, null, 'id, strategie_id');
  const konzept = await zeileFuerLinie('strategie', briefingId, null, 'id, creator_auswahl_id');
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
