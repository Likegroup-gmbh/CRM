import { describe, it, expect } from 'vitest';
import { likyCanExtractPdf } from '../core/chat/likyCapabilities.js';
import { renderProduktDoc } from '../modules/produkt/ProduktDoc.js';
import { parseProduktPdfPath } from '../../netlify/functions/_shared/produkt-pdf-path.js';

const USER = '11111111-1111-1111-1111-111111111111';

describe('Produkt-PDF Schalter', () => {
  it('ist am Produkt an, Persona und Briefing bleiben an', () => {
    expect(likyCanExtractPdf('produkt')).toBe(true);
    expect(likyCanExtractPdf('persona')).toBe(true);
    expect(likyCanExtractPdf('briefing')).toBe(true);
    expect(likyCanExtractPdf('unternehmen')).toBe(false);
    expect(likyCanExtractPdf('marke')).toBe(false);
  });

  it('zeigt den PDF-Chip im Produkt-Composer', () => {
    const html = renderProduktDoc(null, { mitMarkenFeld: true, mitUnternehmenFeld: false, unternehmenId: 'u1' });
    expect(html).toContain('id="produkt-liky-chips"');
    expect(html).toContain('Shop-URL oder PDF');
    expect(html).toContain('name="url"');
  });

  it('akzeptiert nur den eigenen Produkt-PDF-Pfad', () => {
    const ok = `pdf:produkt-pdfs/${USER}/1_datenblatt.pdf`;
    expect(parseProduktPdfPath(ok, USER)).toBe(`produkt-pdfs/${USER}/1_datenblatt.pdf`);
    expect(parseProduktPdfPath(ok, '22222222-2222-2222-2222-222222222222')).toBeNull();
    expect(parseProduktPdfPath('pdf:kundenbriefings/x.pdf', USER)).toBeNull();
    expect(parseProduktPdfPath('https://shop.example/p', USER)).toBeNull();
  });
});
