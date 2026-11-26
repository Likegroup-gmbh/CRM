// Rechnen und Laden für den Budget-Tab der Produktion.
// Verbrauch = Video-Verkaufspreise netto plus Zusatzkosten der Kooperation,
// unabhängig von Vertrag-Status und Rechnungen.

import { budgetOrNull, ladeBudgetStand, roundMoney } from './produktionsbudget.js';
import { istPlatzhalter } from '../kooperation/platzhalter.js';
import { koopGehoertZurLinie } from './ProduktionService.js';
import { normalizeHandle } from '../creator/creatorProfil.js';

export const BUDGET_KOOP_SELECT = `
  id, name, creator_id, briefing_id, produktion_id, verkaufspreis_zusatzkosten,
  creator:creator_id(id, vorname, nachname, instagram, tiktok),
  kooperation_videos(verkaufspreis_netto),
  kooperation_tags(tag_id, kooperation_tag_typen(id, name))
`;

// Runde Zwischenmarken, die näher am Ende liegen, würden das End-Label überdecken.
const TICK_MAX_POS = 80;
// Mindestabstand (Prozent) anderer Marken zur Budget-Marke bei Überschreitung.
const TICK_ABSTAND = 14;

function zahl(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function anteil(betrag, skala) {
  return skala > 0 ? (betrag / skala) * 100 : 0;
}

export function formatEuro(value) {
  const n = roundMoney(value);
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(n);
}

/** Betrag einer Kooperation: Videos (VK netto) plus Zusatzkosten (VK). */
export function koopBetrag(koop) {
  const videos = Array.isArray(koop?.kooperation_videos) ? koop.kooperation_videos : [];
  const honorar = roundMoney(videos.reduce((sum, v) => sum + zahl(v?.verkaufspreis_netto), 0));
  const zusatz = roundMoney(zahl(koop?.verkaufspreis_zusatzkosten));
  return { honorar, zusatz, betrag: roundMoney(honorar + zusatz), videos: videos.length };
}

/** Tags einer Kooperation als [{ id, name }], ohne Doppelte. */
export function koopTags(koop) {
  const rows = Array.isArray(koop?.kooperation_tags) ? koop.kooperation_tags : [];
  const tags = [];
  for (const row of rows) {
    const id = String(row?.tag_id ?? row?.kooperation_tag_typen?.id ?? '');
    const name = row?.kooperation_tag_typen?.name;
    if (id && name && !tags.some(t => t.id === id)) tags.push({ id, name });
  }
  return tags;
}

/** Alle Tags der Kooperationen als Dropdown-Optionen, nach Name sortiert. */
export function verfuegbareTags(koops) {
  const byId = new Map();
  for (const koop of koops || []) {
    for (const tag of koopTags(koop)) {
      if (!byId.has(tag.id)) byId.set(tag.id, tag.name);
    }
  }
  return [...byId]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'de'));
}

/** Kooperationen mit mindestens einem der Tags. Leere Auswahl filtert nicht. */
export function filterKoopsNachTags(koops, tagIds) {
  const ids = new Set((tagIds || []).map(String));
  if (!ids.size) return koops || [];
  return (koops || []).filter(koop => koopTags(koop).some(tag => ids.has(tag.id)));
}

function creatorName(creator) {
  return `${creator?.vorname || ''} ${creator?.nachname || ''}`.trim();
}

function creatorKanal(creator) {
  const instagram = normalizeHandle(creator?.instagram);
  if (instagram) return { handle: instagram, plattform: 'Instagram' };
  const tiktok = normalizeHandle(creator?.tiktok);
  if (tiktok) return { handle: tiktok, plattform: 'TikTok' };
  return null;
}

function creatorZeilen(posten, linieId) {
  const gruppen = new Map();
  for (const p of posten) {
    const creatorId = p.creator?.id || null;
    const key = creatorId ? `c:${creatorId}` : `k:${p.id}`;
    if (!gruppen.has(key)) {
      gruppen.set(key, {
        key,
        creatorId,
        name: creatorName(p.creator) || p.name,
        kanal: creatorId ? creatorKanal(p.creator) : null,
        betrag: 0,
        zusatz: 0,
        dieseLinie: 0,
        videos: 0,
        kooperationen: 0
      });
    }
    const g = gruppen.get(key);
    g.betrag += p.betrag;
    g.zusatz += p.zusatz;
    g.videos += p.videos;
    g.kooperationen += 1;
    if (p.dieseLinie) g.dieseLinie += p.betrag;
  }

  const zeilen = [...gruppen.values()].map(g => ({
    ...g,
    betrag: roundMoney(g.betrag),
    zusatz: roundMoney(g.zusatz),
    dieseLinie: roundMoney(g.dieseLinie)
  }));
  zeilen.sort((a, b) => (b.betrag - a.betrag) || a.name.localeCompare(b.name, 'de'));

  const max = zeilen[0]?.betrag || 0;
  return zeilen.map(z => ({
    ...z,
    anteil: anteil(z.betrag, max),
    linieAnteil: linieId ? anteil(z.dieseLinie, max) : 0
  }));
}

/**
 * Marken auf runden Werten (1, 2, 2,5, 5 × 10^n), dazu das Ende der Skala.
 * Liegt das Budget innerhalb der Skala (Überschreitung), bekommt es eine eigene
 * Marke und verdrängt die Nachbarn.
 */
export function skalaTicks(skala, budget = null) {
  if (!(skala > 0)) return [];
  const roh = skala / 4;
  const potenz = 10 ** Math.floor(Math.log10(roh));
  const schritt = [1, 2, 2.5, 5, 10].map(f => f * potenz).find(s => s >= roh * 0.75);
  const ticks = [];
  for (let wert = 0; (wert / skala) * 100 < TICK_MAX_POS; wert += schritt) {
    ticks.push({ pos: (wert / skala) * 100, wert });
  }
  ticks.push({ pos: 100, wert: roundMoney(skala) });
  if (!(budget > 0)) return ticks;

  const budgetPos = (budget / skala) * 100;
  if (budgetPos >= 100) {
    ticks[ticks.length - 1].budget = true;
    return ticks;
  }
  return [
    ...ticks.filter(t => t.pos === 0 || Math.abs(t.pos - budgetPos) >= TICK_ABSTAND),
    { pos: budgetPos, wert: roundMoney(budget), budget: true, decke: true }
  ].sort((a, b) => a.pos - b.pos);
}

/**
 * Reine Berechnung für den Budget-Tab.
 * @param {object} params
 * @param {Array} params.koops - Kooperationen der Produktion mit kooperation_videos
 * @param {number} [params.andereProduktionen] - Verbrauch der Produktionen, die denselben Topf teilen
 * @param {number|null} [params.decke] - Budget, null = keins hinterlegt
 * @param {string|null} [params.linieId] - hervorgehobene Linie, null = nichts hervorheben
 */
export function berechneBudgetTab({ koops = [], andereProduktionen = 0, decke = null, linieId = null } = {}) {
  const gebucht = (koops || []).filter(koop => !istPlatzhalter(koop));
  const posten = gebucht.map(koop => ({
    id: koop.id,
    name: koop.name || 'Kooperation',
    creator: koop.creator || null,
    dieseLinie: linieId ? koopGehoertZurLinie(koop, linieId) : false,
    ...koopBetrag(koop)
  }));

  const summe = (rows, key = 'betrag') => roundMoney(rows.reduce((sum, r) => sum + r[key], 0));
  const linienPosten = posten.filter(p => p.dieseLinie);

  const verbrauch = summe(posten);
  const zusatzkosten = summe(posten, 'zusatz');
  const andere = roundMoney(Math.max(0, zahl(andereProduktionen)));
  const belegt = roundMoney(verbrauch + andere);
  const hatDecke = decke != null && Number.isFinite(Number(decke));
  const budget = hatDecke ? roundMoney(decke) : null;
  // Negativ = Überschreitung, nicht klemmen (ADR 0007).
  const frei = hatDecke ? roundMoney(budget - belegt) : null;
  const prozent = hatDecke && budget > 0 ? Math.round((belegt / budget) * 100) : null;
  const skala = Math.max(budget || 0, belegt);

  const segmente = posten
    .filter(p => p.betrag > 0)
    .sort((a, b) => (Number(b.dieseLinie) - Number(a.dieseLinie)) || (b.betrag - a.betrag))
    .map(p => ({
      id: p.id,
      name: p.name,
      betrag: p.betrag,
      art: linieId ? (p.dieseLinie ? 'linie' : 'andere') : 'gesamt',
      anteil: anteil(p.betrag, skala)
    }));
  if (andere > 0) {
    segmente.push({
      id: 'andere-produktionen',
      name: 'Andere Produktionen',
      betrag: andere,
      art: 'produktionen',
      anteil: anteil(andere, skala)
    });
  }

  return {
    verbrauch,
    zusatzkosten,
    dieseLinie: linieId ? summe(linienPosten) : null,
    andereLinien: linieId ? roundMoney(verbrauch - summe(linienPosten)) : null,
    anzahl: {
      kooperationen: posten.length,
      dieseLinie: linienPosten.length,
      andereLinien: posten.length - linienPosten.length,
      videos: posten.reduce((sum, p) => sum + p.videos, 0)
    },
    andereProduktionen: andere,
    belegt,
    budget,
    frei,
    prozent,
    skala,
    segmente,
    freiAnteil: hatDecke && frei > 0 ? anteil(frei, skala) : 0,
    deckeMarke: hatDecke && belegt > budget ? anteil(budget, skala) : null,
    ticks: skalaTicks(skala, hatDecke ? budget : null),
    creators: creatorZeilen(posten, linieId)
  };
}

/**
 * Herkunft der Decke für die Überzeile.
 * @param {object|null} stand - Ergebnis von ladeBudgetStand
 * @param {*} eigenesBudget - produktion.budget
 */
export function budgetQuelle(stand, eigenesBudget) {
  if (!stand || stand.decke == null) {
    return { label: 'Kein Budget hinterlegt', hinweis: 'Weder Produktion noch Kampagne haben ein Budget. Gezeigt wird nur der Verbrauch.' };
  }
  if (stand.eigen && budgetOrNull(eigenesBudget) != null) return { label: 'Produktionsbudget', hinweis: '' };
  if (stand.eigen) {
    return { label: 'Kein Produktionsbudget', hinweis: 'Andere Produktionen dieser Kampagne haben ein eigenes Budget, diese nicht.' };
  }
  const hinweis = 'Geteilter Topf: Noch frei gilt für alle Produktionen dieser Kampagne ohne eigenes Budget zusammen, nicht je Produktion.';
  if (stand.quelle === 'volumen') return { label: 'Volumen der Kampagne', hinweis };
  return { label: 'Creator-Budget der Kampagne', hinweis };
}

/**
 * Lädt Decke und Kooperationen. Teilt die Produktion den Topf der Kampagne,
 * kommen die Kooperationen der anderen Produktionen als Summe mit.
 */
export async function ladeBudgetDaten(supabase, { produktionId, kampagneId }) {
  const stand = await ladeBudgetStand(supabase, produktionId);
  const geteilt = Boolean(stand && !stand.eigen && stand.decke != null && kampagneId);

  let query = supabase.from('kooperationen').select(BUDGET_KOOP_SELECT);
  query = geteilt
    ? query.eq('kampagne_id', kampagneId).not('produktion_id', 'is', null)
    : query.eq('produktion_id', produktionId);
  const { data, error } = await query;
  if (error) throw error;

  const rows = data || [];
  const koops = rows.filter(k => k.produktion_id === produktionId);
  const fremd = rows.filter(k => k.produktion_id && k.produktion_id !== produktionId);
  const andereProduktionen = roundMoney(fremd.reduce((sum, k) => sum + koopBetrag(k).betrag, 0));

  return { stand, koops, andereProduktionen };
}
