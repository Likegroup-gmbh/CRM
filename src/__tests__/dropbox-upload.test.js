import { describe, it, expect } from 'vitest';
import { buildDropboxPath } from '../../netlify/functions/dropbox-upload.js';

describe('buildDropboxPath (unified root)', () => {
  it('fügt Video_N_Thema und Feedbackschleife_N zwischen Kooperation und Dateiname ein', () => {
    const path = buildDropboxPath({
      unternehmen: 'FirmaX',
      marke: 'MarkeY',
      kampagne: 'Sommer2025',
      kooperation: 'CreatorZ',
      videoPosition: 2,
      videoThema: 'Unboxing',
      versionNumber: '2',
      fileName: 'video.mp4'
    });

    expect(path).toBe('/FirmaX/MarkeY/Sommer2025/CreatorZ/Videos/Video_2_Unboxing/Feedbackschleife_2/video.mp4');
  });

  it('nutzt Video_1 / Feedbackschleife_1 als Fallback wenn Position/Version fehlt', () => {
    const path = buildDropboxPath({
      unternehmen: 'FirmaX',
      marke: 'MarkeY',
      kampagne: 'Sommer2025',
      kooperation: 'CreatorZ',
      fileName: 'video.mp4'
    });

    expect(path).toBe('/FirmaX/MarkeY/Sommer2025/CreatorZ/Videos/Video_1/Feedbackschleife_1/video.mp4');
  });

  it('lässt Thema im Ordnernamen weg wenn leer', () => {
    const path = buildDropboxPath({
      unternehmen: 'FirmaX',
      marke: 'MarkeY',
      kampagne: 'Sommer2025',
      kooperation: 'CreatorZ',
      videoPosition: 3,
      versionNumber: '1',
      fileName: 'video.mp4'
    });

    expect(path).toBe('/FirmaX/MarkeY/Sommer2025/CreatorZ/Videos/Video_3/Feedbackschleife_1/video.mp4');
  });

  it('nutzt Fallback-Dateiname wenn fileName leer ist', () => {
    const path = buildDropboxPath({
      unternehmen: 'FirmaX',
      marke: 'MarkeY',
      kampagne: 'Sommer2025',
      kooperation: 'CreatorZ',
      videoPosition: 1,
      videoTitel: 'Unboxing',
      versionNumber: '3'
    });

    expect(path).toBe('/FirmaX/MarkeY/Sommer2025/CreatorZ/Videos/Video_1/Feedbackschleife_3/V3_Unboxing.mp4');
  });

  it('sanitized Sonderzeichen in Pfadteilen inkl. videoThema', () => {
    const path = buildDropboxPath({
      unternehmen: 'Firma<X>',
      marke: 'Marke:Y',
      kampagne: 'Sommer|2025',
      kooperation: 'Creator"Z"',
      videoPosition: 1,
      videoThema: 'Review<Test>',
      versionNumber: '1',
      fileName: 'video.mp4'
    });

    expect(path).toBe('/Firma-X-/Marke-Y/Sommer-2025/Creator-Z-/Videos/Video_1_Review-Test-/Feedbackschleife_1/video.mp4');
  });
});
