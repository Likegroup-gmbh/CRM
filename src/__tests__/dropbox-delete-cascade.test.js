import { describe, it, expect } from 'vitest';
import { buildDropboxPath } from '../../netlify/functions/dropbox-upload.js';

describe('Dropbox-Pfad-Konsistenz (Upload ↔ Delete)', () => {
  it('buildDropboxPath erzeugt vorhersagbaren Pfad mit Feedbackschleife_N Segment', () => {
    const path = buildDropboxPath({
      unternehmen: 'AcmeCorp',
      marke: 'SuperMarke',
      kampagne: 'Sommeraktion',
      kooperation: 'MaxMustermann',
      videoPosition: 2,
      videoThema: 'Unboxing',
      versionNumber: 3,
      fileName: 'V3_Unboxing.mp4',
    });

    expect(path).toBe('/AcmeCorp/SuperMarke/Sommeraktion/MaxMustermann/Videos/Video_2_Unboxing/Feedbackschleife_3/V3_Unboxing.mp4');
  });

  it('default Version ist 1', () => {
    const path = buildDropboxPath({
      unternehmen: 'Firma',
      marke: 'Marke',
      kampagne: 'Kampagne',
      kooperation: 'Creator',
      videoPosition: 1,
      videoThema: 'Test',
      fileName: 'file.mp4',
    });

    expect(path).toContain('/Feedbackschleife_1/');
  });

  it('Pfad enthält alle Segmente in korrekter Reihenfolge (Unternehmen → Marke → Kampagne → Kooperation → Videos → Video_N → Feedbackschleife_N → Datei)', () => {
    const path = buildDropboxPath({
      unternehmen: 'U',
      marke: 'M',
      kampagne: 'K',
      kooperation: 'C',
      videoPosition: 1,
      videoThema: 'T',
      versionNumber: 2,
      fileName: 'f.mp4',
    });

    const parts = path.split('/').filter(Boolean);
    expect(parts[0]).toBe('U');
    expect(parts[1]).toBe('M');
    expect(parts[2]).toBe('K');
    expect(parts[3]).toBe('C');
    expect(parts[4]).toBe('Videos');
    expect(parts[5]).toBe('Video_1_T');
    expect(parts[6]).toBe('Feedbackschleife_2');
    expect(parts[7]).toBe('f.mp4');
  });
});
