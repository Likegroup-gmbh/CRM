import { describe, it, expect } from 'vitest';
import {
  berechneHiddenColumns,
  IG_BASIS_SPALTEN,
  IG_REELS_SPALTEN,
  IG_STORY_SPALTEN,
  TT_SPALTEN
} from '../modules/creator-auswahl/sourcingSpaltenPreset.js';
import { SOURCING_SPALTEN } from '../modules/creator-auswahl/CreatorAuswahlTemplates.js';

/** Alle Spalten, die das Preset ueberhaupt anfassen kann */
const STEUERBAR = [...IG_BASIS_SPALTEN, ...IG_REELS_SPALTEN, ...IG_STORY_SPALTEN, ...TT_SPALTEN];

/** Was von den steuerbaren Spalten sichtbar bleibt */
function sichtbar(auswahl) {
  const hidden = berechneHiddenColumns(auswahl);
  return STEUERBAR.filter(col => !hidden.includes(col));
}

describe('Sourcing-Spalten-Preset – Matrix', () => {
  it('UGC: nur Link und Follower Instagram, keine Preise, keine Story, kein TikTok', () => {
    expect(sichtbar({ liste_typ: 'ugc' })).toEqual(IG_BASIS_SPALTEN);
  });

  it('Mix: blendet nichts aus', () => {
    expect(berechneHiddenColumns({ liste_typ: 'mix' })).toEqual([]);
    expect(sichtbar({ liste_typ: 'mix' })).toEqual(STEUERBAR);
  });

  it('Influencer + nur TikTok: alle Instagram-Spalten aus', () => {
    const auswahl = { liste_typ: 'influencer', plattformen: 'tiktok' };

    expect(sichtbar(auswahl)).toEqual(TT_SPALTEN);
  });

  it('Influencer + Instagram + nur Reel: Story aus, TikTok aus', () => {
    const auswahl = { liste_typ: 'influencer', plattformen: 'instagram', ig_formate: 'reel' };

    expect(sichtbar(auswahl)).toEqual([...IG_BASIS_SPALTEN, ...IG_REELS_SPALTEN]);
  });

  it('Influencer + Instagram + nur Story: die Reels-Preise sind aus', () => {
    const auswahl = { liste_typ: 'influencer', plattformen: 'instagram', ig_formate: 'story' };

    expect(sichtbar(auswahl)).toEqual([...IG_BASIS_SPALTEN, ...IG_STORY_SPALTEN]);
  });

  it('Influencer + Instagram + Reel und Story: kompletter Instagram-Block', () => {
    const auswahl = { liste_typ: 'influencer', plattformen: 'instagram', ig_formate: 'reel,story' };

    expect(sichtbar(auswahl)).toEqual([
      ...IG_BASIS_SPALTEN, ...IG_REELS_SPALTEN, ...IG_STORY_SPALTEN
    ]);
  });

  it('Influencer + beide Plattformen: Instagram-Auswahl plus TikTok-Block', () => {
    const auswahl = {
      liste_typ: 'influencer',
      plattformen: 'instagram,tiktok',
      ig_formate: 'reel'
    };

    expect(sichtbar(auswahl)).toEqual([
      ...IG_BASIS_SPALTEN, ...IG_REELS_SPALTEN, ...TT_SPALTEN
    ]);
  });
});

describe('Sourcing-Spalten-Preset – Randfaelle', () => {
  it('nimmt auch Arrays statt Komma-Listen', () => {
    const alsString = berechneHiddenColumns({
      liste_typ: 'influencer', plattformen: 'instagram', ig_formate: 'story'
    });
    const alsArray = berechneHiddenColumns({
      liste_typ: 'influencer', plattformen: ['instagram'], ig_formate: ['story']
    });

    expect(alsArray).toEqual(alsString);
  });

  it('zeigt bei fehlender Plattform- und Formatangabe alles', () => {
    expect(berechneHiddenColumns({ liste_typ: 'influencer' })).toEqual([]);
  });

  it('blendet ohne Listentyp nichts aus (Bestandslisten)', () => {
    expect(berechneHiddenColumns({})).toEqual([]);
    expect(berechneHiddenColumns()).toEqual([]);
  });

  it('ignoriert Gross-/Kleinschreibung im Listentyp', () => {
    expect(berechneHiddenColumns({ liste_typ: 'UGC' }))
      .toEqual(berechneHiddenColumns({ liste_typ: 'ugc' }));
  });

  it('nennt nur Spalten, die es in der Tabelle wirklich gibt', () => {
    const alle = [
      berechneHiddenColumns({ liste_typ: 'ugc' }),
      berechneHiddenColumns({ liste_typ: 'influencer', plattformen: 'tiktok' }),
      berechneHiddenColumns({ liste_typ: 'influencer', plattformen: 'instagram', ig_formate: 'story' })
    ].flat();

    for (const col of alle) {
      expect(SOURCING_SPALTEN).toContain(col);
    }
  });
});
