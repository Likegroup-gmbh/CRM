import { describe, it, expect } from 'vitest';
import { buildVersionedFileName, getAvailableVersions } from '../core/VideoUploadUtils.js';

describe('buildVersionedFileName', () => {
  it('erzeugt Dateinamen im Format creator_unternehmen_kampagne_v{n}.ext', () => {
    const name = buildVersionedFileName('Max Mueller', 'Firma GmbH', 'Sommer 2025', 2, 'mov');
    expect(name).toBe('max_mueller_firma_gmbh_sommer_2025_v2.mov');
  });

  it('ersetzt Sonderzeichen durch Unterstriche', () => {
    const name = buildVersionedFileName('Müller & Co.', 'Firma/X', 'Kampagne#1', 1, 'mp4');
    expect(name).not.toMatch(/[&/#üÜ]/);
    expect(name).toMatch(/^[a-z0-9_]+_v1\.mp4$/);
  });

  it('kollabiert Doppel-Unterstriche', () => {
    const name = buildVersionedFileName('Max  Mueller', 'Firma   GmbH', 'Test', 1, 'mp4');
    expect(name).not.toContain('__');
  });

  it('überspringt leere Felder', () => {
    const name = buildVersionedFileName('', 'Firma', '', 3, 'mp4');
    expect(name).toBe('firma_v3.mp4');
  });

  it('behandelt komplett leere Felder', () => {
    const name = buildVersionedFileName('', '', '', 1, 'mp4');
    expect(name).toBe('v1.mp4');
  });

  it('behält die Originale Dateiendung bei', () => {
    const name = buildVersionedFileName('Creator', 'Firma', 'Kampagne', 2, 'webm');
    expect(name).toMatch(/\.webm$/);
  });
});

describe('getAvailableVersions', () => {
  it('gibt alle Versionen zurück wenn keine existieren', () => {
    expect(getAvailableVersions([], 3)).toEqual([1, 2, 3]);
  });

  it('filtert bereits existierende Versionen heraus', () => {
    expect(getAvailableVersions([1, 3], 3)).toEqual([2]);
  });

  it('gibt leeres Array zurück wenn alle Versionen belegt', () => {
    expect(getAvailableVersions([1, 2, 3], 3)).toEqual([]);
  });

  it('respektiert benutzerdefiniertes Maximum', () => {
    expect(getAvailableVersions([1], 5)).toEqual([2, 3, 4, 5]);
  });

  it('nutzt Default maxVersions=3', () => {
    expect(getAvailableVersions([])).toEqual([1, 2, 3]);
  });
});
