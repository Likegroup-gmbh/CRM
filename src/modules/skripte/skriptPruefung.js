// skriptPruefung.js
// ESM-Spiegel von pruefeSkript aus netlify/functions/_shared/skript-context/formatter.js.
// Nur markieren (ADR 0035): Laenge, verbotene Claims, Hook-Zeit, Satz-Doppelung.
// Beim Annehmen und manuellen Speichern haelt das skripte.pruefung auf dem
// Stand des Dokuments. Paritaet sichert SkriptSekunden.test.js.

import { zaehleWoerter, WOERTER_PRO_SEKUNDE } from './skriptSekunden.js';

export function wortBudget(spanne) {
  if (!spanne) return null;
  const [von, bis] = String(spanne).split('-').map((n) => parseInt(n, 10));
  if (!Number.isFinite(von) || !Number.isFinite(bis) || bis <= 0) return null;
  const rund5 = (n) => Math.max(5, Math.round(n / 5) * 5);
  return { von, bis, min: rund5(von * WOERTER_PRO_SEKUNDE), max: rund5(bis * WOERTER_PRO_SEKUNDE) };
}

function claimListe(raw) {
  return String(raw || '').split(/[\n,;]+/).map((s) => s.trim()).filter((s) => s.length >= 4);
}

export function hookSekundenMax(hookVorgaben) {
  const t = String(hookVorgaben || '');
  const muster = [
    /hook\s*\(\s*\d+\s*[–-]\s*(\d+)\s*sek/i,
    /ersten\s+(?:\d+\s*[–-]\s*)?(\d+)\s+sekunden/i,
    /sekunden?\s+\d+\s*[–-]\s*(\d+)/i
  ];
  for (const re of muster) {
    const m = t.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

const HOOK_TOLERANZ_SEK = 1;

function pruefeHookZeit(hook, hookVorgaben) {
  const max = hookSekundenMax(hookVorgaben);
  if (!max || !String(hook || '').trim()) return null;
  const sekunden = Math.round(zaehleWoerter(hook) / WOERTER_PRO_SEKUNDE);
  return { sekunden, max, status: sekunden > max + HOOK_TOLERANZ_SEK ? 'ueber' : 'ok' };
}

const DOPPEL_WORTE = 5;
const ZELLEN = ['hook', 'hauptteil', 'cta'];

function normWorte(text) {
  return String(text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
}

function saetze(text) {
  return String(text || '').split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

function schindeln(worte) {
  const set = new Set();
  for (let i = 0; i + DOPPEL_WORTE <= worte.length; i++) set.add(worte.slice(i, i + DOPPEL_WORTE).join(' '));
  return set;
}

export function findeDoppelungen(felder) {
  const sets = ZELLEN.map((z) => schindeln(normWorte(felder?.[z])));
  const treffer = [];
  for (let a = 0; a < ZELLEN.length; a++) {
    for (let b = a + 1; b < ZELLEN.length; b++) {
      for (const satz of saetze(felder?.[ZELLEN[a]])) {
        const eigene = schindeln(normWorte(satz));
        if ([...eigene].some((s) => sets[b].has(s))) treffer.push({ satz, zellen: [ZELLEN[a], ZELLEN[b]] });
      }
    }
  }
  return treffer;
}

export function pruefeSkript(felder, { video_laenge, verbotene_claims, hook_vorgaben } = {}) {
  const budget = wortBudget(video_laenge);
  const worte = zaehleWoerter(felder?.hook) + zaehleWoerter(felder?.hauptteil) + zaehleWoerter(felder?.cta);
  let laenge = null;
  if (budget) {
    let status = 'ok';
    if (worte < budget.min) status = 'unter';
    else if (worte > budget.max) status = 'ueber';
    laenge = { status, worte, min: budget.min, max: budget.max };
  }
  const hay = [felder?.hook, felder?.hauptteil, felder?.cta].filter(Boolean).join('\n').toLowerCase();
  const claims = claimListe(verbotene_claims).filter((c) => hay.includes(c.toLowerCase()));
  return {
    laenge,
    claims,
    hook_zeit: pruefeHookZeit(felder?.hook, hook_vorgaben),
    doppelungen: findeDoppelungen(felder)
  };
}

/** Pruefung fuer den Dokumentstand eines Skripts (Optionen aus Skript, Produkt und Briefing). */
export function pruefeDokument(skript) {
  return pruefeSkript(skript, {
    video_laenge: skript?.video_laenge,
    verbotene_claims: skript?.produkt?.verbotene_claims,
    hook_vorgaben: skript?.briefing?.hook_vorgaben
  });
}
