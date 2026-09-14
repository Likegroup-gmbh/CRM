// PdfBrand: eine Quelle fuer Logo-Layout und LikeGroup-Footer.
import { describe, it, expect } from 'vitest';
import {
  LIKEGROUP,
  LIKEGROUP_FOOTER_DE,
  likeGroupFooterLine,
  drawLikeGroupLogo,
  drawLikeGroupFooter,
  PDF_BRAND,
} from '../core/pdf/PdfBrand.js';

function mockDoc() {
  return {
    texts: [],
    images: [],
    _size: 10,
    _font: { fontName: 'helvetica', fontStyle: 'normal' },
    setFontSize(s) { this._size = s; },
    getFontSize() { return this._size; },
    setFont(name, style) { this._font = { fontName: name, fontStyle: style }; },
    getFont() { return this._font; },
    setTextColor() {},
    text(t, x, y, opts) { this.texts.push({ t: String(t), x, y, opts }); },
    addImage(src, type, x, y, w, h) { this.images.push({ src, type, x, y, w, h }); },
  };
}

describe('PdfBrand', () => {
  it('baut die Vertrags-Fusszeile DE unveraendert', () => {
    expect(likeGroupFooterLine()).toBe(LIKEGROUP_FOOTER_DE);
    expect(likeGroupFooterLine('de')).toBe(
      'LikeGroup GmbH | Jakob-Latscha-Str. 3 | 60314 Frankfurt am Main | Deutschland'
    );
    expect(likeGroupFooterLine('en')).toContain(LIKEGROUP.zip);
    expect(likeGroupFooterLine('en')).toContain('Germany');
  });

  it('zeichnet Logo links oben', () => {
    const doc = mockDoc();
    drawLikeGroupLogo(doc, 'data:image/png;base64,AAA', { align: 'left' });
    expect(doc.images[0]).toMatchObject({
      x: PDF_BRAND.logoLeft.x,
      y: PDF_BRAND.logoLeft.y,
      w: PDF_BRAND.logoLeft.w,
      h: PDF_BRAND.logoLeft.h,
    });
  });

  it('zeichnet Logo zentriert (Vertraege)', () => {
    const doc = mockDoc();
    drawLikeGroupLogo(doc, 'data:image/png;base64,AAA', { align: 'center' });
    expect(doc.images[0]).toMatchObject({ x: PDF_BRAND.logoCenter.x, y: PDF_BRAND.logoCenter.y });
  });

  it('schreibt Adresse und Seitenzahl in die Fusszeile', () => {
    const doc = mockDoc();
    drawLikeGroupFooter(doc, { page: 2 });
    const joined = doc.texts.map((t) => t.t).join('\n');
    expect(joined).toContain(LIKEGROUP_FOOTER_DE);
    expect(joined).toContain('Seite 2');
  });
});
