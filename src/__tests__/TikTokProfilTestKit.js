// Gemeinsame Fakes fuer den TikTok-Profilabruf (Function und Bausteine).
import { vi } from 'vitest';

export const RUN_ID = '3KH8gEpp4d8uQSe8T';
export const ITEM_ID = '11111111-2222-4333-8444-555555555555';
export const JETZT = Date.parse('2026-11-25T12:00:00.000Z');
const TAG_MS = 24 * 60 * 60 * 1000;

export const autor = (extra = {}) => ({
  name: 'lea.m', nickName: 'Lea M', fans: 50000, heart: 900000, video: 120, following: 10,
  verified: false, avatar: 'https://p16.tiktokcdn.com/a.jpeg', signature: 'Kooperationen: lea@example.com', ...extra,
});

/** Roh-Item wie vom Actor; alterTage relativ zu JETZT */
export const videoItem = (nr, { alterTage = nr + 5, views = 1000, autorMeta = autor(), ...extra } = {}) => ({
  id: `v${nr}`, text: `Video ${nr} mit eigenem Text`, createTimeISO: new Date(JETZT - alterTage * TAG_MS).toISOString(),
  authorMeta: autorMeta, webVideoUrl: `https://www.tiktok.com/@${autorMeta.name}/video/${nr}`,
  playCount: views, diggCount: 50, commentCount: 10, shareCount: 1, collectCount: 1,
  isAd: false, isSponsored: false, isPinned: false, ...extra,
});

export const profilItems = (anzahl = 35, autorMeta = autor()) => Array.from({ length: anzahl }, (_, i) => videoItem(i + 1, { autorMeta }));

export const run = (status, extra = {}) => ({ id: RUN_ID, status, defaultDatasetId: 'ds1', startedAt: '2026-11-25T11:59:00.000Z', finishedAt: null, usageTotalUsd: 0.02, ...extra });
export const antwort = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) });

/**
 * Supabase-Fake mit select/eq/maybeSingle, update/eq(/select/single) und upsert/select/single.
 * Zeilen liegen in tabellen[name] als Array; log haelt jede Schreiboperation fest.
 */
export function fakeSupabase(start = {}) {
  const tabellen = { creator_auswahl_items: [], sourcing_creator_tiktok: [], ...structuredClone(start) };
  const log = [];

  const from = (tabelle) => {
    const q = { op: 'select', werte: null, filter: null };
    const zeilen = () => (tabellen[tabelle] ||= []);
    const treffer = () => zeilen().filter((z) => !q.filter || z[q.filter[0]] === q.filter[1]);
    const ausfuehren = () => {
      if (q.op === 'update') {
        log.push({ tabelle, op: 'update', werte: q.werte, filter: q.filter });
        treffer().forEach((z) => Object.assign(z, q.werte));
        return treffer()[0] || null;
      }
      if (q.op === 'upsert') {
        log.push({ tabelle, op: 'upsert', werte: q.werte });
        const alt = zeilen().find((z) => z.tt_username === q.werte.tt_username);
        if (alt) return Object.assign(alt, q.werte);
        const neu = { id: `pool-${zeilen().length + 1}`, ...q.werte };
        zeilen().push(neu);
        return neu;
      }
      return treffer()[0] || null;
    };
    const api = {
      select: () => api,
      eq: (feld, wert) => { q.filter = [feld, wert]; return api; },
      update: (werte) => { q.op = 'update'; q.werte = werte; return api; },
      upsert: (werte) => { q.op = 'upsert'; q.werte = werte; return api; },
      maybeSingle: async () => ({ data: ausfuehren(), error: null }),
      single: async () => ({ data: ausfuehren(), error: null }),
      then: (ok, fehler) => Promise.resolve({ data: ausfuehren(), error: null }).then(ok, fehler),
    };
    return api;
  };

  return { from, tabellen, log };
}

export const itemZeile = (extra = {}) => ({
  id: ITEM_ID, name: '', link_tiktok: 'https://www.tiktok.com/@lea.m', email: null, telefon: null,
  wohnort: null, notiz: null, profile_image_url: null, ...extra,
});
