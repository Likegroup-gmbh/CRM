import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
import { createFakeSupabase } from './fixtures/fakeSupabase.js';

const require = createRequire(import.meta.url);
const { createUmzugRest } = require('../../netlify/functions/_shared/ablage/umzug-rest.js');
const { createStand } = require('../../netlify/functions/_shared/ablage/stand.js');

const U1 = '00000000-0000-4000-8000-000000000001';

function setup(umzug) {
  return createFakeSupabase({
    tabellen: {
      ablage_umzug: umzug.map((z) => ({ drive_id: 'd1', unternehmen_id: U1, versuche: 0, ...z })),
      kooperation_video_asset: [{ id: 'a1', video_id: 'v1', file_name: 'clip.mp4' }],
      kooperation_bilder_asset: [{ id: 'a2', kooperation_id: 'k1', file_name: null, titel: 'Produktbild' }],
      kooperation_videos: [{ id: 'v1', kooperation_id: 'k1' }],
      kooperationen: [{ id: 'k1', name: 'Anna Beispiel', kampagne_id: 'ka1' }],
      kampagne: [{ id: 'ka1', kampagnenname: 'Sommer' }],
    },
  });
}

describe('Umzug-Rest: was nach dem Umzug übrig ist', () => {
  it('liefert nur Fehler, Übersprungene und Wiederholungen, nicht Fertiges oder normal Laufendes', async () => {
    const supabase = setup([
      { id: 'z1', typ: 'video', asset_id: 'a1', quelle: 'onedrive', quelle_ref: 'https://x.sharepoint.com/:v:/g/personal/a/b', status: 'fehler', grund: 'onedrive_kein_zugriff', versuche: 6 },
      { id: 'z2', typ: 'video', asset_id: 'x', quelle: 'dropbox', quelle_ref: '/A/ok.mp4', status: 'fertig' },
      { id: 'z3', typ: 'video', asset_id: 'x', quelle: 'dropbox', quelle_ref: '/A/laeuft.mp4', status: 'offen', grund: 'fortsetzen', versuche: 0 },
      { id: 'z4', typ: 'still', asset_id: 'a2', quelle: 'dropbox', quelle_ref: '/A/bild.jpg', status: 'offen', grund: 'groesse_falsch', versuche: 1 },
      { id: 'z5', typ: 'video', asset_id: 'x', quelle: 'dropbox', quelle_ref: '', status: 'uebersprungen', grund: 'ohne_quelle' },
    ]);
    const liste = await createUmzugRest({ supabase, driveId: 'd1' }).laden();
    expect(liste.map((z) => z.id).sort()).toEqual(['z1', 'z4', 'z5']);
  });

  it('reichert Medien mit Datei, Kooperation und Kampagne an, auch über das Video', async () => {
    const supabase = setup([
      { id: 'z1', typ: 'video', asset_id: 'a1', quelle: 'onedrive', quelle_ref: 'https://x.sharepoint.com/:v:/g/personal/a/b', status: 'fehler', grund: 'onedrive_kein_zugriff' },
      { id: 'z2', typ: 'still', asset_id: 'a2', quelle: 'dropbox', quelle_ref: '/A/bild.jpg', status: 'fehler', grund: 'dropbox_fehlt' },
    ]);
    const liste = await createUmzugRest({ supabase, driveId: 'd1' }).laden();
    const je = Object.fromEntries(liste.map((z) => [z.id, z]));
    expect(je.z1).toMatchObject({ bereich: 'medien', datei: 'clip.mp4', kooperation: 'Anna Beispiel', kampagne: 'Sommer', unternehmen_id: U1 });
    expect(je.z2).toMatchObject({ datei: 'Produktbild', kooperation: 'Anna Beispiel', kampagne: 'Sommer' });
  });

  it('nimmt bei Dokumenten den Dateinamen aus dem Pfad und bei OneDrive-Links ohne Asset keinen Link-Teil', async () => {
    const supabase = setup([
      { id: 'z1', typ: 'rechnung', asset_id: 'r1', quelle: 'dropbox', quelle_ref: '/Rechnungen/Re%202026-01.pdf', status: 'fehler', grund: 'dropbox_fehlt' },
      { id: 'z2', typ: 'video', asset_id: 'weg', quelle: 'onedrive', quelle_ref: 'https://x.sharepoint.com/:v:/g/personal/a/TOKEN', status: 'fehler', grund: 'onedrive_weg' },
    ]);
    const liste = await createUmzugRest({ supabase, driveId: 'd1' }).laden();
    const je = Object.fromEntries(liste.map((z) => [z.id, z]));
    expect(je.z1).toMatchObject({ bereich: 'dokumente', datei: 'Re 2026-01.pdf', kampagne: null });
    expect(je.z2.datei).toBeNull();
  });

  it('bleibt mit Zeilen ohne Kontext benutzbar, wenn das Anreichern scheitert', async () => {
    const supabase = setup([
      { id: 'z1', typ: 'video', asset_id: 'a1', quelle: 'dropbox', quelle_ref: '/A/clip.mp4', ziel_name: 'clip.mp4', status: 'fehler', grund: 'dropbox_fehlt' },
    ]);
    const original = supabase.from;
    supabase.from = (t) => (t === 'kooperation_video_asset' ? { select: () => ({ in: () => Promise.resolve({ data: null, error: new Error('kaputt') }) }) } : original(t));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const liste = await createUmzugRest({ supabase, driveId: 'd1' }).laden();
    warn.mockRestore();
    expect(liste).toEqual([expect.objectContaining({ id: 'z1', datei: 'clip.mp4', kampagne: null })]);
  });
});

describe('ablage-stand: umzug_rest', () => {
  const ablage = { sp: { driveId: 'd1' }, konfig: { siteUrl: 'https://t.sharepoint.com/sites/M', driveId: 'd1' } };
  const stand = (umzugRest) => createStand({
    supabase: createFakeSupabase({
      tabellen: { ablage_einstellung: [], ablage_stand: [], ablage_eingang: [], ablage_unzugeordnet: [], ablage_umzug: [] },
      rpc: { ablage_unternehmen_stand: () => [], ablage_dokumente_stand: () => [] },
    }),
    ablage, event: {}, benutzer: { id: 'a1' }, umzugRest,
  }).stand();

  it('liefert die Zeilen im Stand mit', async () => {
    const zeile = { id: 'z1', unternehmen_id: U1, bereich: 'medien', typ: 'video', status: 'fehler', grund: 'dropbox_fehlt', versuche: 6, datei: 'a.mp4', kampagne: null, kooperation: null };
    const r = await stand({ laden: async () => [zeile] });
    expect(r.umzug_rest).toEqual([zeile]);
  });

  it('lässt den Stand benutzbar, wenn der Rest nicht lädt', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await stand({ laden: async () => { throw new Error('db weg'); } });
    warn.mockRestore();
    expect(r.umzug_rest).toEqual([]);
    expect(r.konfig.konfiguriert).toBe(true);
  });
});
