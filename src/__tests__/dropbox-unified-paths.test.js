import { describe, it, expect } from 'vitest';
import { buildUnifiedBasePath, sanitizePath } from '../../netlify/functions/_shared/dropbox.js';
import { buildDropboxPath } from '../../netlify/functions/dropbox-upload.js';
import { buildVertragPath } from '../../netlify/functions/dropbox-upload-vertrag.js';
import { buildRechnungPath } from '../../netlify/functions/dropbox-upload-rechnung.js';
import { buildBilderFolderPath } from '../../netlify/functions/dropbox-upload-bilder.js';
import { buildStorysBaseFolderPath, buildVideoFolderPath, buildStorysVersionFolderPath } from '../../netlify/functions/dropbox-upload-storys.js';

describe('buildUnifiedBasePath (Phase 1)', () => {
  it('baut den Basis-Pfad aus allen 4 Segmenten', () => {
    const p = buildUnifiedBasePath({
      unternehmen: 'AcmeCorp',
      marke: 'SuperMarke',
      kampagne: 'Sommer',
      kooperation: 'Creator',
    });
    expect(p).toBe('/AcmeCorp/SuperMarke/Sommer/Creator');
  });

  it('überspringt fehlende Segmente', () => {
    const p = buildUnifiedBasePath({ unternehmen: 'Firma', kampagne: 'K' });
    expect(p).toBe('/Firma/K');
  });

  it('liefert /_unzugeordnet wenn alles fehlt', () => {
    expect(buildUnifiedBasePath({})).toBe('/_unzugeordnet');
  });

  it('sanitized Sonderzeichen', () => {
    const p = buildUnifiedBasePath({ unternehmen: 'A:B', marke: 'X/Y' });
    expect(p).toBe('/A-B/X-Y');
  });

  it('sanitizePath ersetzt verbotene Zeichen', () => {
    expect(sanitizePath('a<b>c|d')).toBe('a-b-c-d');
  });
});

describe('Vertrag-Pfad (Phase 2)', () => {
  it('baut Pfad mit Creator + Vertragstyp Leaf-Ordner', () => {
    const p = buildVertragPath({
      unternehmen: 'Firma',
      marke: 'Marke',
      kampagne: 'Kampagne',
      kooperation: 'Koop',
      creator: 'Max Muster',
      vertragstyp: 'UGC',
      fileName: 'Vertrag.pdf',
    });
    expect(p).toBe('/Firma/Marke/Kampagne/Koop/Vertraege/Max Muster_UGC/Vertrag.pdf');
  });

  it('funktioniert ohne Marke/Kooperation', () => {
    const p = buildVertragPath({
      unternehmen: 'Firma',
      kampagne: 'Kampagne',
      creator: 'Max',
      vertragstyp: 'UGC',
      fileName: 'V.pdf',
    });
    expect(p).toBe('/Firma/Kampagne/Vertraege/Max_UGC/V.pdf');
  });

  it('Fallback Dateiname wenn nicht angegeben', () => {
    const p = buildVertragPath({ unternehmen: 'Firma', creator: 'X', vertragstyp: 'Y' });
    expect(p).toMatch(/^\/Firma\/Vertraege\/X_Y\/Vertrag_\d+\.pdf$/);
  });
});

describe('Rechnung-Pfad (Phase 3)', () => {
  it('baut Pfad mit Kampagne + Kooperation', () => {
    const p = buildRechnungPath({
      unternehmen: 'Firma',
      marke: 'Marke',
      kampagne: 'Kampagne',
      kooperation: 'Koop',
      rechnungsNr: 'R-2025-001',
      kind: 'pdf',
      fileName: 'rechnung.pdf',
    });
    expect(p).toBe('/Firma/Marke/Kampagne/Koop/Rechnungen/R-2025-001/rechnung.pdf');
  });

  it('Beleg-Pfad enthält /Belege/ Subordner', () => {
    const p = buildRechnungPath({
      unternehmen: 'Firma',
      marke: 'Marke',
      kampagne: 'Kampagne',
      rechnungsNr: 'R-001',
      kind: 'beleg',
      fileName: 'beleg.jpg',
    });
    expect(p).toBe('/Firma/Marke/Kampagne/Rechnungen/R-001/Belege/beleg.jpg');
  });

  it('Contracting-Rechnung (keine Kampagne) landet unter /Contracting/Rechnungen/', () => {
    const p = buildRechnungPath({
      unternehmen: 'Firma',
      rechnungsNr: 'CTR-001',
      kind: 'pdf',
      fileName: 'r.pdf',
    });
    expect(p).toBe('/Firma/Contracting/Rechnungen/CTR-001/r.pdf');
  });

  it('Fallback-Rechnungsnummer wenn fehlt', () => {
    const p = buildRechnungPath({
      unternehmen: 'Firma',
      kampagne: 'K',
      kind: 'pdf',
      fileName: 'r.pdf',
    });
    expect(p).toMatch(/^\/Firma\/K\/Rechnungen\/Rechnung_\d+\/r\.pdf$/);
  });
});

describe('Video-Pfad nach Re-Root (Phase 6)', () => {
  it('hat /Videos/ als Unterordner unter Kooperation', () => {
    const p = buildDropboxPath({
      unternehmen: 'U',
      marke: 'M',
      kampagne: 'K',
      kooperation: 'C',
      videoPosition: 1,
      videoThema: 'Test',
      versionNumber: 1,
      fileName: 'v.mp4',
    });
    expect(p).toBe('/U/M/K/C/Videos/Video_1_Test/Feedbackschleife_1/v.mp4');
  });
});

describe('Bilder-Pfad nach Re-Root (Phase 6)', () => {
  it('hat /Bilder als Unterordner unter Kooperation', () => {
    const p = buildBilderFolderPath({ unternehmen: 'U', marke: 'M', kampagne: 'K', kooperation: 'C' });
    expect(p).toBe('/U/M/K/C/Bilder');
  });
});

describe('Storys-Pfad nach Re-Root (Phase 6)', () => {
  it('Base-Pfad enthält /Storys', () => {
    const p = buildStorysBaseFolderPath({ unternehmen: 'U', marke: 'M', kampagne: 'K', kooperation: 'C' });
    expect(p).toBe('/U/M/K/C/Storys');
  });

  it('Video-Folder hat Position und Thema', () => {
    const p = buildVideoFolderPath({
      unternehmen: 'U', marke: 'M', kampagne: 'K', kooperation: 'C',
      videoPosition: 2, videoThema: 'TestStory',
    });
    expect(p).toBe('/U/M/K/C/Storys/Video_2_TestStory');
  });

  it('Version-Folder hat Story_X und Feedbackschleife_X', () => {
    const p = buildStorysVersionFolderPath({
      unternehmen: 'U', marke: 'M', kampagne: 'K', kooperation: 'C',
      videoPosition: 1, slotIndex: 3, versionNumber: 2,
    });
    expect(p).toBe('/U/M/K/C/Storys/Video_1/Story_3/Feedbackschleife_2');
  });
});
