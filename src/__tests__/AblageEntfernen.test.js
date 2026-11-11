import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { entfernenNachItem, TABELLE } = require('../../netlify/functions/_shared/ablage/asset.js');

// Spalten, die es in der Live-Datenbank je Tabelle wirklich gibt (Regressionstest: eine
// unbekannte Spalte im select liess das Entfernen still mit 0 Zeilen scheitern)
const SPALTEN = {
  kooperation_video_asset: ['id', 'video_id', 'drive_id', 'item_id'],
  kooperation_story_asset: ['id', 'video_id', 'story_id', 'drive_id', 'item_id'],
  kooperation_bilder_asset: ['id', 'video_id', 'drive_id', 'item_id'],
  kooperation_rohmaterial_asset: ['id', 'kooperation_id', 'drive_id', 'item_id'],
};

function fakeSupabase(zeilenJeTabelle) {
  const geloescht = [];
  return {
    geloescht,
    from(tabelle) {
      const state = { tabelle };
      const b = {
        select(cols) {
          const unbekannt = cols.split(',').map((c) => c.trim()).filter((c) => !SPALTEN[tabelle].includes(c));
          state.fehler = unbekannt.length ? { message: `column ${unbekannt[0]} does not exist` } : null;
          return b;
        },
        eq: () => b,
        in: () => b,
        update: () => b,
        is: () => b,
        delete() { state.loeschen = true; return b; },
        then(resolve) {
          if (state.loeschen) { geloescht.push(tabelle); return resolve({ error: null }); }
          if (state.fehler) return resolve({ data: null, error: state.fehler });
          return resolve({ data: zeilenJeTabelle[tabelle] || [], error: null });
        },
      };
      return b;
    },
  };
}

describe('entfernenNachItem', () => {
  for (const [typ, tabelle] of Object.entries(TABELLE)) {
    it(`entfernt die Zeile in ${tabelle}`, async () => {
      const sb = fakeSupabase({ [tabelle]: [{ id: 'a1', video_id: null, story_id: null }] });
      const n = await entfernenNachItem(sb, typ, 'drive', 'item');
      expect(n).toBe(1);
      expect(sb.geloescht).toEqual([tabelle]);
    });
  }
});
