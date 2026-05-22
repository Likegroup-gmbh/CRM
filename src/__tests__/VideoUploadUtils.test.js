import { describe, it, expect } from 'vitest';
import {
  buildVersionedFileName,
  getAvailableVersions,
  normalizeExternalUrl,
  isValidExternalUrl,
  getAssetDisplayLabel,
  isExternalAsset,
  isDirectImageUrl,
} from '../core/VideoUploadUtils.js';

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

describe('normalizeExternalUrl', () => {
  it('fügt https:// hinzu wenn Protokoll fehlt', () => {
    expect(normalizeExternalUrl('drive.google.com/file/123')).toBe('https://drive.google.com/file/123');
  });

  it('lässt bestehende https:// URL unverändert', () => {
    expect(normalizeExternalUrl('https://example.com/video')).toBe('https://example.com/video');
  });

  it('lässt http:// URL unverändert', () => {
    expect(normalizeExternalUrl('http://example.com/video')).toBe('http://example.com/video');
  });

  it('trimmt Whitespace', () => {
    expect(normalizeExternalUrl('  https://example.com  ')).toBe('https://example.com');
  });

  it('gibt leeren String für null/undefined zurück', () => {
    expect(normalizeExternalUrl(null)).toBe('');
    expect(normalizeExternalUrl(undefined)).toBe('');
    expect(normalizeExternalUrl('')).toBe('');
  });
});

describe('isValidExternalUrl', () => {
  it('akzeptiert gültige https URL', () => {
    expect(isValidExternalUrl('https://drive.google.com/file/123')).toBe(true);
  });

  it('akzeptiert gültige http URL', () => {
    expect(isValidExternalUrl('http://example.com')).toBe(true);
  });

  it('lehnt ftp-Protokoll ab', () => {
    expect(isValidExternalUrl('ftp://files.example.com')).toBe(false);
  });

  it('lehnt ungültige URL ab', () => {
    expect(isValidExternalUrl('not a url')).toBe(false);
  });

  it('lehnt leere/null Werte ab', () => {
    expect(isValidExternalUrl('')).toBe(false);
    expect(isValidExternalUrl(null)).toBe(false);
  });
});

describe('getAssetDisplayLabel', () => {
  it('bevorzugt variant_name', () => {
    expect(getAssetDisplayLabel({ variant_name: 'Haupt', file_name: 'a.mp4' })).toBe('Haupt');
  });

  it('nutzt Host/Dateiname aus file_url wenn kein Pfad', () => {
    expect(getAssetDisplayLabel({
      file_url: 'https://cdn.example.com/pfad/bild.png',
      file_path: null,
    })).toBe('bild.png');
  });

  it('nutzt letztes Segment von file_path', () => {
    expect(getAssetDisplayLabel({ file_path: '/dropbox/foo/bar.mp4' })).toBe('bar.mp4');
  });
});

describe('isExternalAsset', () => {
  it('ist true bei file_url ohne file_path', () => {
    expect(isExternalAsset({ file_url: 'https://x.com/v', file_path: null })).toBe(true);
  });

  it('ist false bei Dropbox-Asset', () => {
    expect(isExternalAsset({ file_url: 'https://dl.dropbox.com/x', file_path: '/a/b.mp4' })).toBe(false);
  });
});

describe('isDirectImageUrl', () => {
  it('erkennt Bild-URLs an der Pfadendung', () => {
    expect(isDirectImageUrl('https://example.com/photo.jpg')).toBe(true);
  });

  it('lehnt Video-URLs ab', () => {
    expect(isDirectImageUrl('https://example.com/clip.mp4')).toBe(false);
  });
});
