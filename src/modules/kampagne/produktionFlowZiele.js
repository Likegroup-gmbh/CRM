// produktionFlowZiele.js
// Welche Adressen im Produktionsflow bleiben (ADR 0079). Je Entity: der Tab, der
// sie zeigt, und wie sich die Linie ermitteln lässt. Neue Ziele kommen nur hierher.
// Briefing, Produkt und Persona prüft die Produktion zuerst an ihren geladenen Linien,
// alles andere (und veraltete Linien) per Abfrage, die durch die RLS läuft.

import { pathOf } from '../../core/breadcrumbTrail.js';

/** URL-Parameter je Tab. ansicht: ersetzt die Liste (Skript, Produkt, Persona), sonst nur Auswahl. */
export const TAB_PARAM = {
  skripte: { param: 'skript', ansicht: true },
  produkte: { param: 'produkt', ansicht: true },
  personas: { param: 'persona', ansicht: true },
  konzepte: { param: 'konzept', ansicht: false },
  casting: { param: 'casting', ansicht: false }
};

/** Sprungziel im Tab (Kooperation, Videoidee). Einmalig: die URL verliert es, sobald es angesprungen ist. */
export const FOKUS_PARAM = 'fokus';

/** Linie eines Ziels in einer Produktion ohne Linien: es gehört zur Produktion. */
export const OHNE_LINIE = '';

export function flowUrl({ produktionId, tab, linieId = null, id = null, fokus = null }) {
  const params = new URLSearchParams({ tab });
  if (linieId) params.set('linie', linieId);
  const param = TAB_PARAM[tab]?.param;
  if (param && id) params.set(param, id);
  if (fokus) params.set(FOKUS_PARAM, fokus);
  return `/produktion/${produktionId}?${params}`;
}

const linienIds = (detail) => (detail?.linien || []).map(l => l.id);

/**
 * Linien-IDs aus einer Zeile mit briefing_id (Skript, Konzept, Casting-Liste).
 * Ohne Linien lädt der Tab nach Produktion, dann zählt nur produktion_id.
 * altbestand: der Tab zeigt Zeilen ohne Linie in jeder Linie, sie bleiben in der aktiven.
 */
function briefingIdAus(tabelle, { altbestand = false } = {}) {
  return async (db, detail, id) => {
    const { data, error } = await db.from(tabelle).select('briefing_id, produktion_id').eq('id', id).maybeSingle();
    if (error) throw error;
    const eigene = Boolean(data?.produktion_id) && data.produktion_id === detail.produktionId;
    if (!linienIds(detail).length) return eigene ? [OHNE_LINIE] : [];
    if (data?.briefing_id) return [data.briefing_id];
    return altbestand && eigene && detail.linieId ? [detail.linieId] : [];
  };
}

const NICHT_ID = new Set(['new', 'neu']);
const segment = (name) => new RegExp(`^/${name}/([^/]+)$`);
const besitzerSeite = (name) => new RegExp(`^/(?:marke|unternehmen)/[^/]+/${name}$`);

export const FLOW_ZIELE = {
  briefing: {
    tab: 'briefing',
    muster: [{ pfad: segment('briefing') }],
    ausLinien: (detail, id) => linienIds(detail).filter(l => l === id)
  },
  produkt: {
    tab: 'produkte',
    muster: [{ pfad: segment('produkt') }, { pfad: besitzerSeite('produkt'), query: 'produkt' }],
    ausLinien: (detail, id) => (detail?.linien || [])
      .filter(l => (l.briefing?.produkte || []).some(row => row?.produkt?.id === id))
      .map(l => l.id),
    abfrage: async (db, detail, id) => {
      if (!linienIds(detail).length) return [];
      const { data, error } = await db.from('campaign_briefing_produkt')
        .select('briefing_id').eq('produkt_id', id).in('briefing_id', linienIds(detail));
      if (error) throw error;
      return (data || []).map(row => row.briefing_id);
    }
  },
  persona: {
    tab: 'personas',
    muster: [{ pfad: segment('persona') }, { pfad: besitzerSeite('persona'), query: 'persona' }],
    ausLinien: (detail, id) => (detail?.linien || [])
      .filter(l => (l.briefing?.persona_ids || []).includes(id))
      .map(l => l.id),
    abfrage: async (db, detail, id) => {
      if (!linienIds(detail).length) return [];
      const { data, error } = await db.from('campaign_briefings')
        .select('id').in('id', linienIds(detail)).contains('persona_ids', [id]);
      if (error) throw error;
      return (data || []).map(row => row.id);
    }
  },
  skript: { tab: 'skripte', muster: [{ pfad: segment('skripte') }], abfrage: briefingIdAus('skripte') },
  konzept: { tab: 'konzepte', muster: [{ pfad: segment('konzepte') }], abfrage: briefingIdAus('strategie', { altbestand: true }) },
  casting: { tab: 'casting', muster: [{ pfad: segment('castings') }], abfrage: briefingIdAus('creator_auswahl') }
};

/**
 * Entity hinter einer Adresse. hinweis: ?briefing= (ProduktList hängt die Linie an),
 * fokus: ?fokus= (Sprungziel im Tab, z. B. die Videoidee im Konzept).
 * @returns {{ kind: string, tab: string, id: string, hinweis: string|null, fokus: string|null }|null}
 */
export function erkenneZiel(route) {
  let url;
  try {
    url = new URL(route, 'http://local');
  } catch {
    return null;
  }
  const pfad = pathOf(url.pathname);
  for (const [kind, ziel] of Object.entries(FLOW_ZIELE)) {
    for (const { pfad: muster, query } of ziel.muster) {
      const treffer = pfad.match(muster);
      if (!treffer) continue;
      const id = query ? url.searchParams.get(query) : decodeURIComponent(treffer[1]);
      if (!id || NICHT_ID.has(id)) return null;
      return { kind, tab: ziel.tab, id, hinweis: url.searchParams.get('briefing'), fokus: url.searchParams.get(FOKUS_PARAM) };
    }
  }
  return null;
}

/** Aus den Kandidaten: Hinweis, dann aktive Linie, dann die erste in Reihenfolge der Linien. */
function waehleLinie(detail, kandidaten, hinweis) {
  const erlaubt = new Set(linienIds(detail));
  const liste = (kandidaten || []).filter(id => erlaubt.has(id));
  if (!liste.length) return null;
  if (hinweis && liste.includes(hinweis)) return hinweis;
  if (detail.linieId && liste.includes(detail.linieId)) return detail.linieId;
  return linienIds(detail).find(id => liste.includes(id)) || null;
}

/** Linie aus den geladenen Linien oder null (dann ggf. linieAbfragen). */
export function linieSync(detail, treffer) {
  const ziel = FLOW_ZIELE[treffer?.kind];
  if (!ziel?.ausLinien) return null;
  return waehleLinie(detail, ziel.ausLinien(detail, treffer.id), treffer.hinweis);
}

export function hatAbfrage(treffer) {
  return Boolean(FLOW_ZIELE[treffer?.kind]?.abfrage);
}

/**
 * Linie per Abfrage. OHNE_LINIE = gehört zu dieser Produktion, die keine Linien hat.
 * null = gehört nicht zu dieser Produktion oder ist nicht lesbar.
 */
export async function linieAbfragen(detail, treffer, db = window.supabase) {
  const ziel = FLOW_ZIELE[treffer?.kind];
  if (!ziel?.abfrage || !db) return null;
  const kandidaten = await ziel.abfrage(db, detail, treffer.id);
  if (!linienIds(detail).length) return kandidaten.includes(OHNE_LINIE) ? OHNE_LINIE : null;
  return waehleLinie(detail, kandidaten, treffer.hinweis);
}
