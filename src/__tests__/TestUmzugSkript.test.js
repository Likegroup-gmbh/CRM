import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { createFakeSupabase, createFakeSharePoint, ORDNER_UNIQUE } from './fixtures/fakeSupabase.js';
import {
  quelleVon, zielOrdnerPfad, zielPlan, kollisionen, ohneZaehler, klonZeilen,
} from '../../scripts/medienablage/test-umzug.mjs';

const require = createRequire(import.meta.url);
const { createOrdner } = require('../../netlify/functions/_shared/ablage/ordner.js');

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U1 = id(1);
const UT = id(2);
const KA1 = id(3);
const K1 = id(4);
const V1 = id(5);
const V2 = id(6);

const unternehmen = { id: U1, firmenname: 'LikeBase Testkunde', ablage_ziel: 'sharepoint', ist_test: false };
const kampagne = { id: KA1, kampagnenname: 'Canon organischer Content (Umzugstest)', eigener_name: null, unternehmen_id: U1, marke_id: null };
const kooperation = { id: K1, name: 'Ioannis Grigoriadis 2/27', kampagne_id: KA1 };
const videos = [
  { id: V1, kooperation_id: K1, position: 1, thema: null },
  { id: V2, kooperation_id: K1, position: 2, thema: 'Neues Hobby' },
];

function ordnerMit(u) {
  const supabase = createFakeSupabase({
    tabellen: {
      ablage_stand: [{ drive_id: 'd1', root_item_id: 'root' }],
      ablage_ordner: [],
      kooperationen: [{ ...kooperation, kampagne: { ...kampagne, unternehmen: u, marke: null } }],
      kooperation_videos: videos,
    },
    unique: { ablage_ordner: ORDNER_UNIQUE },
  });
  return createOrdner({ supabase, sp: createFakeSharePoint(), schlafen: async () => {} });
}

describe('test-umzug: Zielpfad wie ordner.zielOrdner', () => {
  const faelle = [
    ['Feedbackschleife', { video_id: V1, version_number: 1, is_final: false, variant_name: 'Ioannis_Day in the life' }],
    ['spaetere Schleife', { video_id: V2, version_number: 3, is_final: false, variant_name: 'Korrektur' }],
    ['Finale mit Format', { video_id: V1, version_number: 1, is_final: true, variant_name: '9:16' }],
    ['Finale ohne Format', { video_id: V2, version_number: 1, is_final: true, variant_name: 'Final A' }],
  ];

  for (const [name, asset] of faelle) {
    it(name, async () => {
      const ordner = ordnerMit(unternehmen);
      const { ordner: ziel } = await ordner.zielOrdner({
        typ: 'video', kooperation_id: K1, kooperation_video_id: asset.video_id,
        version_number: asset.version_number, is_final: asset.is_final, variant_name: asset.variant_name,
      });
      const video = videos.find((v) => v.id === asset.video_id);
      expect(zielOrdnerPfad({ unternehmen, kampagne, kooperation, video, asset })).toBe(ziel.pfad);
    });
  }

  it('Testunternehmen unter _Test', async () => {
    const u = { ...unternehmen, id: UT, ist_test: true };
    const { ordner: ziel } = await ordnerMit(u).zielOrdner({ typ: 'video', kooperation_id: K1, kooperation_video_id: V1, version_number: 2 });
    expect(zielOrdnerPfad({ unternehmen: u, kampagne, kooperation, video: videos[0], asset: { version_number: 2 } })).toBe(ziel.pfad);
    expect(ziel.pfad).toBe('/_Test/LikeBase Testkunde/Medien/Canon organischer Content (Umzugstest)/Ioannis Grigoriadis 2-27/Videos/Video_1/Feedbackschleife_2');
  });
});

describe('test-umzug: Plan', () => {
  const assets = [
    { id: 'a1', video_id: V1, version_number: 1, is_final: false, file_path: '/Canon/Ioannis/Video_1/Feedbackschleife_1/Day/clip_v1.mp4' },
    { id: 'a2', video_id: V1, version_number: 1, is_final: false, file_path: '/Canon/Ioannis/Video_1/Feedbackschleife_1/Korrektur/clip_v1.mp4' },
    { id: 'a3', video_id: V1, version_number: 1, is_final: false, file_path: '/Canon/Ioannis/Video_1/Feedbackschleife_1/Day/clip_v1.mov' },
    { id: 'a4', video_id: V2, version_number: 1, is_final: false, file_path: null, file_url: 'https://firma-my.sharepoint.com/:v:/g/personal/x/abc' },
    { id: 'a5', video_id: V2, version_number: 1, is_final: false, file_path: null, file_url: null },
    { id: 'p1', video_id: V1, is_final: true, source_asset_id: 'a1', file_path: '/Canon/Ioannis/Video_1/Feedbackschleife_1/Day/clip_v1.mp4' },
  ];

  it('Quelle wie ablage_umzug_anlegen', () => {
    expect(assets.map(quelleVon)).toEqual(['dropbox', 'dropbox', 'dropbox', 'onedrive', null, 'dropbox']);
  });

  it('nur Originale, flach in der Schleife; gleiche Namen aus verschiedenen Varianten kollidieren', () => {
    const plan = zielPlan({ unternehmen, kampagne, kooperationen: [kooperation], videos, assets });
    expect(plan.map((p) => p.asset.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
    expect(plan[0]).toMatchObject({
      quelle: 'dropbox',
      ordner: '/LikeBase Testkunde/Medien/Canon organischer Content (Umzugstest)/Ioannis Grigoriadis 2-27/Videos/Video_1/Feedbackschleife_1',
      name: 'clip_v1.mp4',
    });
    const k = kollisionen(plan);
    expect(k).toHaveLength(1);
    expect(k[0].map((p) => p.asset.id)).toEqual(['a1', 'a2']);
  });

  it('Ordnervergleich ignoriert " (2)"-Zaehler', () => {
    expect(ohneZaehler('/Firma (2)/Kampagne/Lisa (3)/Videos')).toBe('/Firma/Kampagne/Lisa/Videos');
  });
});

describe('test-umzug: Klon', () => {
  let n = 0;
  const neueId = () => `neu-${++n}`;
  const quelle = {
    kampagne: { id: 'ka', kampagnenname: 'Canon organischer Content', eigener_name: null, unternehmen_id: 'canon', marke_id: 'm1', volumen: 5000 },
    kooperationen: [{ id: 'k1', name: 'Lisa', kampagne_id: 'ka', creator_id: 'c1', unternehmen_id: 'canon', produktion_id: 'p', verkaufspreis_netto: 900, briefing_id: 'b' }],
    videos: [{ id: 'v1', kooperation_id: 'k1', position: 2, thema: 'Rezept', verkaufspreis_netto: 300, folder_url: 'https://dropbox/x' }],
    assets: [
      { id: 'pr', video_id: 'v1', source_asset_id: 'a1', is_final: true, file_path: '/x.mp4', ablage: 'dropbox' },
      { id: 'a1', video_id: 'v1', version_number: 2, variant_name: 'B', file_path: '/x.mp4', created_at: '2026-01-01T00:00:00Z', ablage: 'dropbox', item_id: 'alt' },
      { id: 'fremd', video_id: 'v1', source_asset_id: 'gibtsnicht', is_final: true, file_path: '/y.mp4' },
    ],
  };

  it('neue IDs, Verweise umgehaengt, ohne Preise/Produktion/Ablage-Spalten', () => {
    const { map, zeilen } = klonZeilen(quelle, 'test', neueId);
    expect(zeilen.kampagne).toEqual(expect.objectContaining({ id: map.kampagne, kampagnenname: 'Canon organischer Content (Umzugstest)', unternehmen_id: 'test' }));
    expect(zeilen.kampagne).not.toHaveProperty('marke_id');
    expect(zeilen.kampagne).not.toHaveProperty('volumen');

    expect(zeilen.kooperationen).toEqual([expect.objectContaining({ id: map.kooperationen.k1, kampagne_id: map.kampagne, creator_id: 'c1', unternehmen_id: 'test', name: 'Lisa' })]);
    for (const k of ['produktion_id', 'verkaufspreis_netto', 'briefing_id']) expect(zeilen.kooperationen[0]).not.toHaveProperty(k);

    expect(zeilen.videos).toEqual([expect.objectContaining({ id: map.videos.v1, kooperation_id: map.kooperationen.k1, position: 2, thema: 'Rezept' })]);
    expect(zeilen.videos[0]).not.toHaveProperty('verkaufspreis_netto');
    expect(zeilen.videos[0]).not.toHaveProperty('folder_url');

    expect(zeilen.originale).toEqual([expect.objectContaining({
      id: map.assets.a1, video_id: map.videos.v1, source_asset_id: null, file_path: '/x.mp4', version_number: 2,
      variant_name: 'B', created_at: '2026-01-01T00:00:00Z', ablage: 'dropbox',
    })]);
    expect(zeilen.originale[0]).not.toHaveProperty('item_id');
    expect(zeilen.promotes).toEqual([expect.objectContaining({ id: map.assets.pr, source_asset_id: map.assets.a1, is_final: true })]);
    expect(map.assets).not.toHaveProperty('fremd');
  });
});
