import { describe, it, expect } from 'vitest';
import {
  buildStrategieItemPickerOptions,
  buildSkriptVorlagePickerOptions
} from '../modules/strategie/strategieItemPicker.js';

const STRATEGIEN = [
  { id: 'st1', name: 'Board A' },
  { id: 'st2', name: 'Board B' }
];

const ITEMS = [
  { id: 'i1', beschreibung: 'Morgenroutine', strategie_id: 'st1', video_link: 'https://tiktok.com/x' },
  { id: 'i2', beschreibung: 'Nur Idee', strategie_id: 'st2', video_link: null },
  { id: 'i3', beschreibung: 'Schon vergeben', strategie_id: 'st1', video_link: 'https://tiktok.com/y' }
];

describe('buildStrategieItemPickerOptions (Drawer)', () => {
  it('laesst freie Items durch und filtert fremd-verknuepfte', () => {
    const linked = new Map([['i3', 'video-other']]);
    const opts = buildStrategieItemPickerOptions(STRATEGIEN, ITEMS, linked, 'video-current');
    expect(opts.map((o) => o.value)).toEqual(['i1', 'i2']);
  });

  it('behaelt das Item, das am aktuellen Video haengt', () => {
    const linked = new Map([['i1', 'video-current']]);
    const opts = buildStrategieItemPickerOptions(STRATEGIEN, ITEMS, linked, 'video-current');
    expect(opts.map((o) => o.value)).toContain('i1');
  });

  it('gruppiert nach Strategie-Name und setzt die Drawer-Subtitles', () => {
    const opts = buildStrategieItemPickerOptions(STRATEGIEN, ITEMS, new Map(), null);
    const routine = opts.find((o) => o.value === 'i1');
    expect(routine.group).toBe('Board A');
    expect(routine.subtitle).toBe('Mit Referenz-Video');
    expect(opts.find((o) => o.value === 'i2').subtitle).toBe('Idee ohne Link');
  });
});

describe('buildSkriptVorlagePickerOptions', () => {
  it('filtert nicht_umsetzen und markiert vorhandenes Transkript', () => {
    const items = [
      {
        id: 'a',
        beschreibung: 'Hook',
        nicht_umsetzen: false,
        transkript: 'Gesprochener Text',
        video_link: 'https://tiktok.com/a',
        strategie: { name: 'S1' }
      },
      {
        id: 'b',
        beschreibung: 'Skip',
        nicht_umsetzen: true,
        transkript: 'egal',
        strategie: { name: 'S1' }
      },
      {
        id: 'c',
        beschreibung: 'Idee',
        nicht_umsetzen: false,
        transkript: null,
        strategie: { name: 'S1' }
      }
    ];

    const opts = buildSkriptVorlagePickerOptions(items);
    expect(opts.map((o) => o.value)).toEqual(['a', 'c']);
    expect(opts[0].subtitle).toBe('Mit Referenz-Video · Mit Transkript');
    expect(opts[1].subtitle).toBe('Idee ohne Link');
    expect(opts[0].group).toBe('S1');
  });
});
