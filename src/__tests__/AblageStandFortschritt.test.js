import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createFakeSupabase } from './fixtures/fakeSupabase.js';

const require = createRequire(import.meta.url);
const { createStand, AKTIONEN } = require('../../netlify/functions/_shared/ablage/stand.js');
const ziel = require('../../netlify/functions/_shared/ablage/ziel.js');

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U1 = id(1);
const U2 = id(2);
const U3 = id(3);
const MEDIEN = new Set(['video', 'story', 'still', 'roh']);

afterEach(() => ziel._reset());

// rpc ablage_umzug_fortschritt wie in 20261222: Zaehler je Unternehmen und Bereich
function fortschrittRpc({ p_drive_id: driveId, p_ids: ids }, db) {
  const gruppen = new Map();
  for (const z of db.ablage_umzug) {
    if (z.drive_id !== driveId || !ids.includes(z.unternehmen_id)) continue;
    const bereich = MEDIEN.has(z.typ) ? 'medien' : 'dokumente';
    const schluessel = `${z.unternehmen_id}:${bereich}`;
    if (!gruppen.has(schluessel)) gruppen.set(schluessel, { unternehmen_id: z.unternehmen_id, bereich, offen: 0, fertig: 0, fehler: 0, uebersprungen: 0 });
    gruppen.get(schluessel)[z.status] += 1;
  }
  return [...gruppen.values()];
}

let nr = 0;
const zeile = (unternehmenId, typ, status, extra = {}) => ({
  id: `z${++nr}`, drive_id: 'd1', unternehmen_id: unternehmenId, typ, status, grund: null, versuche: 0,
  naechster_versuch: '2026-12-02T08:00:00.000Z', quelle_ref: `/A/datei${nr}.mp4`, ziel_name: null, ...extra,
});

function setup({ ablage = true, umzug = [], notschalterDokumente = false } = {}) {
  const supabase = createFakeSupabase({
    tabellen: {
      ablage_umzug: umzug,
      ablage_einstellung: [{ schluessel: 'notschalter', wert: false }, { schluessel: 'notschalter_dokumente', wert: notschalterDokumente }],
      unternehmen: [
        { id: U1, ablage_ziel: 'sharepoint', dokument_ablage_ziel: null },
        { id: U2, ablage_ziel: null, dokument_ablage_ziel: 'sharepoint' },
        { id: U3, ablage_ziel: 'sharepoint', dokument_ablage_ziel: 'sharepoint' },
      ],
    },
    rpc: { ablage_umzug_fortschritt: fortschrittRpc },
  });
  const ab = ablage ? { sp: { driveId: 'd1' }, konfig: { driveId: 'd1' } } : null;
  return { supabase, s: createStand({ supabase, ablage: ab, event: {}, benutzer: { id: 'a1' } }) };
}

describe('ablage-stand: fortschritt', () => {
  it('ist als Aktion freigegeben', () => {
    expect(AKTIONEN.has('fortschritt')).toBe(true);
  });

  it('zaehlt je Unternehmen nach Medien und Dokumenten getrennt, nur fuer die beobachteten', async () => {
    const t = setup({
      umzug: [
        zeile(U1, 'video', 'offen'), zeile(U1, 'still', 'fertig'), zeile(U1, 'roh', 'fehler', { grund: 'x' }),
        zeile(U1, 'vertrag', 'offen'), zeile(U1, 'rechnung_pdf', 'uebersprungen', { grund: 'leer' }),
        zeile(U2, 'story', 'fertig'),
        zeile(U3, 'video', 'offen'),
        { ...zeile(U1, 'video', 'offen'), drive_id: 'anderes' },
      ],
    });
    const r = await t.s.fortschritt({ umzug_ids: [U1, U2] });
    expect(r.umzug).toEqual(expect.arrayContaining([
      { unternehmen_id: U1, offen: 1, fertig: 1, fehler: 1, uebersprungen: 0 },
      { unternehmen_id: U2, offen: 0, fertig: 1, fehler: 0, uebersprungen: 0 },
    ]));
    expect(r.umzug).toHaveLength(2);
    expect(r.dokument_umzug).toEqual([{ unternehmen_id: U1, offen: 1, fertig: 0, fehler: 0, uebersprungen: 1 }]);
    // Kein voller Stand: weder Aggregat-RPCs noch Eingangs-Zaehler
    expect(t.supabase.log.filter((l) => l.rpc).map((l) => l.rpc)).toEqual(['ablage_umzug_fortschritt']);
  });

  it('liefert Notschalter und Weichen (Dropbox als Default) fuer die Pause-Erkennung', async () => {
    const t = setup({ umzug: [zeile(U1, 'video', 'offen')], notschalterDokumente: true });
    const r = await t.s.fortschritt({ umzug_ids: [U1, U2] });
    expect(r.einstellung).toEqual({ notschalter: false, notschalter_dokumente: true });
    expect(r.weichen).toEqual(expect.arrayContaining([
      { id: U1, ablage_ziel: 'sharepoint', dokument_ablage_ziel: 'dropbox' },
      { id: U2, ablage_ziel: 'dropbox', dokument_ablage_ziel: 'sharepoint' },
    ]));
    expect(r.weichen).toHaveLength(2);
  });

  it('Meldungen nur fuer die uebergebenen Unternehmen', async () => {
    const t = setup({
      umzug: [
        zeile(U1, 'video', 'fehler', { grund: 'dropbox_fehlt', versuche: 6 }),
        zeile(U3, 'video', 'fehler', { grund: 'kopie_fehlgeschlagen', versuche: 6 }),
      ],
    });
    const r = await t.s.fortschritt({ umzug_ids: [U1] });
    expect(r.umzug_meldungen).toEqual([expect.objectContaining({ unternehmen_id: U1, bereich: 'medien', status: 'fehler', grund: 'dropbox_fehlt' })]);
  });

  it('ungueltige und doppelte IDs fallen raus; ohne IDs oder ohne SharePoint leere Listen ohne Abfrage', async () => {
    const t = setup({ umzug: [zeile(U1, 'video', 'offen')] });
    await t.s.fortschritt({ umzug_ids: [U1, U1, 'kaputt', 42] });
    expect(t.supabase.log.find((l) => l.rpc === 'ablage_umzug_fortschritt').args.p_ids).toEqual([U1]);

    const leer = { einstellung: null, weichen: [], umzug: [], dokument_umzug: [], umzug_meldungen: [] };
    const ohneIds = setup();
    expect(await ohneIds.s.fortschritt({ umzug_ids: ['kaputt'] })).toEqual(leer);
    expect(await ohneIds.s.fortschritt()).toEqual(leer);
    expect(ohneIds.supabase.log).toEqual([]);

    const ohneAblage = setup({ ablage: false });
    expect(await ohneAblage.s.fortschritt({ umzug_ids: [U1] })).toEqual(leer);
    expect(ohneAblage.supabase.log).toEqual([]);
  });
});
