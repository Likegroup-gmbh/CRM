import { describe, it, expect } from 'vitest';
import { buildDropboxPath } from '../../netlify/functions/dropbox-upload.js';

describe('buildDropboxPath', () => {
  it('fügt Version_N Ordner zwischen Kooperation und Dateiname ein', () => {
    const path = buildDropboxPath({
      unternehmen: 'FirmaX',
      marke: 'MarkeY',
      kampagne: 'Sommer2025',
      kooperation: 'CreatorZ',
      versionNumber: '2',
      fileName: 'video.mp4'
    });

    expect(path).toBe('/Videos/FirmaX/MarkeY/Sommer2025/CreatorZ/Version_2/video.mp4');
  });

  it('fällt auf Version_1 zurück wenn versionNumber fehlt', () => {
    const path = buildDropboxPath({
      unternehmen: 'FirmaX',
      marke: 'MarkeY',
      kampagne: 'Sommer2025',
      kooperation: 'CreatorZ',
      fileName: 'video.mp4'
    });

    expect(path).toBe('/Videos/FirmaX/MarkeY/Sommer2025/CreatorZ/Version_1/video.mp4');
  });

  it('nutzt Fallback-Dateiname wenn fileName leer ist', () => {
    const path = buildDropboxPath({
      unternehmen: 'FirmaX',
      marke: 'MarkeY',
      kampagne: 'Sommer2025',
      kooperation: 'CreatorZ',
      videoTitel: 'Unboxing',
      versionNumber: '3'
    });

    expect(path).toBe('/Videos/FirmaX/MarkeY/Sommer2025/CreatorZ/Version_3/V3_Unboxing.mp4');
  });

  it('sanitized Sonderzeichen in Pfadteilen', () => {
    const path = buildDropboxPath({
      unternehmen: 'Firma<X>',
      marke: 'Marke:Y',
      kampagne: 'Sommer|2025',
      kooperation: 'Creator"Z"',
      versionNumber: '1',
      fileName: 'video.mp4'
    });

    expect(path).toBe('/Videos/Firma-X-/Marke-Y/Sommer-2025/Creator-Z-/Version_1/video.mp4');
  });
});
