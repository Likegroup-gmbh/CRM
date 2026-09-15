import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  extractStrategieScreenshotPath,
  findUnreferencedScreenshotPaths,
  deletePreviousScreenshot
} = require('../../netlify/functions/_shared/strategie-screenshot.js');

const OLD_URL = 'https://xxx.supabase.co/storage/v1/object/public/strategie-screenshots/screenshots/old.jpg';
const NEW_URL = 'https://xxx.supabase.co/storage/v1/object/public/strategie-screenshots/screenshots/new.jpg';

function mockSupabase(removeImpl) {
  const remove = vi.fn(removeImpl || (async () => ({ error: null })));
  return {
    storage: {
      from: vi.fn(() => ({ remove }))
    },
    remove
  };
}

describe('extractStrategieScreenshotPath', () => {
  it('zieht den Pfad hinter dem Bucket', () => {
    expect(extractStrategieScreenshotPath(OLD_URL)).toBe('screenshots/old.jpg');
  });

  it('laesst leere Werte durch', () => {
    expect(extractStrategieScreenshotPath(null)).toBeNull();
    expect(extractStrategieScreenshotPath('')).toBeNull();
  });
});

describe('findUnreferencedScreenshotPaths', () => {
  it('behaelt Dateien, die noch an einem Item haengen', () => {
    expect(findUnreferencedScreenshotPaths(
      ['screenshots/old.jpg', 'screenshots/keep.jpg'],
      [NEW_URL.replace('new.jpg', 'keep.jpg')]
    )).toEqual(['screenshots/old.jpg']);
  });

  it('wirft nichts weg, wenn alles referenziert ist', () => {
    expect(findUnreferencedScreenshotPaths(
      ['screenshots/old.jpg'],
      [OLD_URL]
    )).toEqual([]);
  });
});

describe('deletePreviousScreenshot', () => {
  it('loescht den alten Pfad, wenn die URL gewechselt hat', async () => {
    const supabase = mockSupabase();
    await expect(deletePreviousScreenshot(supabase, OLD_URL, NEW_URL)).resolves.toBe(true);
    expect(supabase.storage.from).toHaveBeenCalledWith('strategie-screenshots');
    expect(supabase.remove).toHaveBeenCalledWith(['screenshots/old.jpg']);
  });

  it('fasst denselben Pfad nicht an', async () => {
    const supabase = mockSupabase();
    await expect(deletePreviousScreenshot(supabase, OLD_URL, OLD_URL)).resolves.toBe(false);
    expect(supabase.remove).not.toHaveBeenCalled();
  });

  it('no-opt ohne alte URL', async () => {
    const supabase = mockSupabase();
    await expect(deletePreviousScreenshot(supabase, null, NEW_URL)).resolves.toBe(false);
    expect(supabase.remove).not.toHaveBeenCalled();
  });

  it('schlaegt bei Storage-Fehlern nicht hart fehl', async () => {
    const supabase = mockSupabase(async () => ({ error: { message: 'denied' } }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(deletePreviousScreenshot(supabase, OLD_URL, NEW_URL)).resolves.toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
