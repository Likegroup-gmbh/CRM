import { describe, it, expect } from 'vitest';
import { koopsMitUpload, videoHatUpload, pruefeKoopUpload, UPLOAD_FEHLT } from '../core/budget/koopVideoUpload.js';
import { ladeAbrechenbarkeit } from '../core/budget/koopAbrechenbarkeitLaden.js';
import { createFakeSupabase } from './fixtures/fakeSupabase.js';

// Eine Creator-Rechnung setzt ein hochgeladenes Video zur Kooperation voraus.
// Zaehlt: Datei in kooperation_video_asset oder altes asset_url. Ein externer
// Link (link_content) ist kein Upload.
describe('Video-Upload als Voraussetzung der Rechnung', () => {
  const video = (over = {}) => ({
    id: 'v1',
    kooperation_id: 'k1',
    einkaufspreis_netto: null,
    asset_url: null,
    link_content: null,
    kooperation_video_asset: [],
    ...over,
  });

  it('Video ohne Datei zaehlt nicht, auch nicht mit externem Link', () => {
    expect(videoHatUpload(video())).toBe(false);
    expect(videoHatUpload(video({ link_content: 'https://instagram.com/p/x' }))).toBe(false);
    expect(videoHatUpload(video({ asset_url: '   ' }))).toBe(false);
    expect(videoHatUpload(null)).toBe(false);
  });

  it('Datei in der Ablage oder altes asset_url zaehlt', () => {
    expect(videoHatUpload(video({ kooperation_video_asset: [{ id: 'a1' }] }))).toBe(true);
    expect(videoHatUpload(video({ asset_url: 'https://cdn.test/v1.mp4' }))).toBe(true);
  });

  it('sammelt Kooperationen mit mindestens einem hochgeladenen Video', () => {
    const ids = koopsMitUpload([
      video({ id: 'v1', kooperation_id: 'k1' }),
      video({ id: 'v2', kooperation_id: 'k1', kooperation_video_asset: [{ id: 'a1' }] }),
      video({ id: 'v3', kooperation_id: 'k2' }),
      video({ id: 'v4', kooperation_id: 'k3', asset_url: 'https://cdn.test/v4.mp4' }),
      video({ id: 'v5', kooperation_id: null, kooperation_video_asset: [{ id: 'a2' }] }),
    ]);
    expect([...ids].sort()).toEqual(['k1', 'k3']);
  });

  it('pruefeKoopUpload sperrt ohne Upload und gibt mit Upload frei', async () => {
    const supabase = createFakeSupabase({
      tabellen: {
        kooperation_videos: [
          video({ id: 'v1', kooperation_id: 'k1', kooperation_video_asset: [{ id: 'a1' }] }),
          video({ id: 'v2', kooperation_id: 'k2' }),
        ],
      },
    });
    expect(await pruefeKoopUpload(supabase, 'k1')).toEqual({ ok: true, message: null });
    expect(await pruefeKoopUpload(supabase, 'k2')).toEqual({ ok: false, message: UPLOAD_FEHLT.text });
    expect(await pruefeKoopUpload(supabase, 'k-ohne-videos')).toEqual({ ok: false, message: UPLOAD_FEHLT.text });
    expect((await pruefeKoopUpload(supabase, null)).ok).toBe(false);
  });

  it('pruefeKoopUpload sperrt, wenn der Stand nicht lesbar ist', async () => {
    const kaputt = {
      from: () => ({
        select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'down' } }) }),
      }),
    };
    const ergebnis = await pruefeKoopUpload(kaputt, 'k1');
    expect(ergebnis.ok).toBe(false);
    expect(ergebnis.message).toContain('nicht geprüft');
  });

  it('ladeAbrechenbarkeit liefert den Upload-Stand mit', async () => {
    const supabase = createFakeSupabase({
      tabellen: {
        rechnung: [],
        kooperation_videos: [
          video({ id: 'v1', kooperation_id: 'k1', kooperation_video_asset: [{ id: 'a1' }] }),
          video({ id: 'v2', kooperation_id: 'k2' }),
        ],
      },
    });
    const { mitUpload } = await ladeAbrechenbarkeit(supabase, [{ id: 'k1' }, { id: 'k2' }]);
    expect(mitUpload.has('k1')).toBe(true);
    expect(mitUpload.has('k2')).toBe(false);

    const leer = await ladeAbrechenbarkeit(supabase, []);
    expect(leer.mitUpload.size).toBe(0);
  });
});
