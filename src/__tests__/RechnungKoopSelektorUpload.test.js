// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadKooperationenOhneRechnung } from '../core/form/data/FieldOptionsLoader.js';
import { createFakeSupabase } from './fixtures/fakeSupabase.js';

// Der Kooperations-Selektor der Rechnung bietet nur Kooperationen an,
// zu denen schon ein Video hochgeladen ist.
describe('Rechnungs-Selektor ohne Video-Upload', () => {
  const koop = (id) => ({ id, name: `Koop ${id}`, kampagne_id: 'kamp1', creator_id: `c-${id}`, created_at: '2026-11-01T00:00:00Z', einkaufspreis_netto: 500 });
  const video = (id, kooperationId, over = {}) => ({
    id, kooperation_id: kooperationId, einkaufspreis_netto: null, asset_url: null, kooperation_video_asset: [], ...over,
  });

  const tabellen = () => ({
    rechnung: [],
    kooperationen: [koop('k1'), koop('k2'), koop('k3'), koop('k4')],
    kooperation_videos: [
      video('v1', 'k1', { kooperation_video_asset: [{ id: 'a1' }] }),
      video('v2', 'k2', { link_content: 'https://instagram.com/p/x' }),
      video('v4', 'k4', { asset_url: 'https://cdn.test/v4.mp4' }),
    ],
    kampagne: [{ id: 'kamp1', kampagnenname: 'Herbst', unternehmen_id: 'u1' }],
    kooperation_tags: [],
  });

  beforeEach(() => {
    window.getAllowedUnternehmenIds = async () => null;
  });

  afterEach(() => {
    delete window.supabase;
    delete window.getAllowedUnternehmenIds;
  });

  it('laesst Kooperationen ohne hochgeladenes Video weg', async () => {
    window.supabase = createFakeSupabase({ tabellen: tabellen() });
    const options = await loadKooperationenOhneRechnung();
    expect(options.map((o) => o.value).sort()).toEqual(['k1', 'k4']);
  });

  it('bleibt leer, wenn die Videos nicht geladen werden koennen', async () => {
    const fake = createFakeSupabase({ tabellen: tabellen() });
    const kaputt = {
      select: () => kaputt,
      order: () => kaputt,
      range: () => kaputt,
      then: (res, rej) => Promise.resolve({ data: null, error: { message: 'down' } }).then(res, rej),
    };
    window.supabase = { from: (t) => (t === 'kooperation_videos' ? kaputt : fake.from(t)) };
    expect(await loadKooperationenOhneRechnung()).toEqual([]);
  });
});
