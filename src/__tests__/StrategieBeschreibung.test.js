import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { buildAddItemQueueEntry, buildStrategieItemInsert } from '../modules/strategie/addItemPayload.js';

const require = createRequire(import.meta.url);
const { shouldApplyKiBeschreibung } = require('../../netlify/functions/_shared/ki-beschreibung.js');

describe('shouldApplyKiBeschreibung', () => {
  it('laesst die KI nur bei leerem oder fehlendem Text schreiben', () => {
    expect(shouldApplyKiBeschreibung(null)).toBe(true);
    expect(shouldApplyKiBeschreibung('')).toBe(true);
    expect(shouldApplyKiBeschreibung('   ')).toBe(true);
  });

  it('schuetzt vorhandenen Text', () => {
    expect(shouldApplyKiBeschreibung('Herbstliches Sandwich')).toBe(false);
    expect(shouldApplyKiBeschreibung('  Cheeseburger Toasties  ')).toBe(false);
  });
});

describe('buildAddItemQueueEntry', () => {
  it('behaelt die Beschreibung auch neben einer Video-URL', () => {
    const entry = buildAddItemQueueEntry({
      id: 'q1',
      url: 'https://tiktok.com/@x/video/1',
      kategorie: 'Rezepte',
      beschreibung: '  Herbstliches Sandwich  ',
      platform: 'tiktok'
    });

    expect(entry.url).toBe('https://tiktok.com/@x/video/1');
    expect(entry.beschreibung).toBe('Herbstliches Sandwich');
    expect(entry.kategorie).toBe('Rezepte');
    expect(entry.status).toBe('pending');
  });

  it('laesst die Beschreibung leer, wenn niemand etwas eintraegt', () => {
    const entry = buildAddItemQueueEntry({
      id: 'q2',
      url: 'https://instagram.com/reel/abc',
      beschreibung: '   ',
      platform: 'instagram'
    });

    expect(entry.beschreibung).toBeNull();
  });
});

describe('buildStrategieItemInsert', () => {
  it('markiert mitgebrachten Text als user', () => {
    const insert = buildStrategieItemInsert({
      strategieId: 's1',
      sortierung: 3,
      nextItem: {
        url: 'https://tiktok.com/@x/video/1',
        platform: 'tiktok',
        kategorie: 'Rezepte',
        beschreibung: 'Herbstliches Sandwich'
      }
    });

    expect(insert).toEqual({
      strategie_id: 's1',
      video_link: 'https://tiktok.com/@x/video/1',
      plattform: 'tiktok',
      sortierung: 3,
      teilbereich: 'Rezepte',
      beschreibung: 'Herbstliches Sandwich',
      beschreibung_quelle: 'user',
      verarbeitung_status: 'pending'
    });
  });

  it('laesst quelle leer, damit die KI fuellen darf', () => {
    const insert = buildStrategieItemInsert({
      strategieId: 's1',
      sortierung: 0,
      nextItem: {
        url: 'https://tiktok.com/@x/video/1',
        platform: 'tiktok',
        kategorie: null,
        beschreibung: null
      }
    });

    expect(insert.beschreibung).toBeNull();
    expect(insert.beschreibung_quelle).toBeNull();
    expect(insert.verarbeitung_status).toBe('pending');
  });

  it('legt eine Idee ohne Verarbeitung an', () => {
    const insert = buildStrategieItemInsert({
      strategieId: 's1',
      sortierung: 0,
      nextItem: {
        url: null,
        platform: 'idea',
        kategorie: null,
        beschreibung: 'Nur die Idee'
      }
    });

    expect(insert.video_link).toBeNull();
    expect(insert.plattform).toBeNull();
    expect(insert.beschreibung_quelle).toBe('user');
    expect(insert.verarbeitung_status).toBeNull();
  });
});
