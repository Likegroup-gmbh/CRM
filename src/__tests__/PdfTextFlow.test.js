import { describe, it, expect, vi } from 'vitest';
import { ensureSpace, renderPaginatedText, renderZusatzBestimmung } from '../modules/vertrag/create/pdf/PdfTextFlow.js';

/** Mock-jsPDF: splitTextToSize bricht bei \n und alle `charsPerLine` Zeichen um */
function createMockDoc(charsPerLine = 100) {
  return {
    texts: [],
    splitTextToSize(text, _maxWidth) {
      const result = [];
      String(text).split('\n').forEach(raw => {
        if (raw.length === 0) { result.push(''); return; }
        for (let i = 0; i < raw.length; i += charsPerLine) {
          result.push(raw.slice(i, i + charsPerLine));
        }
      });
      return result;
    },
    text(line, x, y) {
      this.texts.push({ line, x, y });
    },
    setFontSize() {},
    setFont() {}
  };
}

describe('ensureSpace', () => {
  it('lässt y unverändert, wenn genug Platz ist', () => {
    const onPageBreak = vi.fn();
    expect(ensureSpace(100, 50, 250, onPageBreak)).toBe(100);
    expect(onPageBreak).not.toHaveBeenCalled();
  });

  it('bricht um, wenn der Block nicht mehr passt', () => {
    const onPageBreak = vi.fn(() => 20);
    expect(ensureSpace(230, 50, 250, onPageBreak)).toBe(20);
    expect(onPageBreak).toHaveBeenCalledTimes(1);
  });

  it('bricht auch bei exakt fehlendem 1mm um (Grenzfall y + needed > max)', () => {
    const onPageBreak = vi.fn(() => 20);
    expect(ensureSpace(201, 50, 250, onPageBreak)).toBe(20);
    // Genau passend: kein Umbruch
    const noBreak = vi.fn(() => 20);
    expect(ensureSpace(200, 50, 250, noBreak)).toBe(200);
    expect(noBreak).not.toHaveBeenCalled();
  });
});

describe('renderPaginatedText', () => {
  it('rendert kurzen Text ohne Seitenumbruch und liefert Folge-Y', () => {
    const doc = createMockDoc();
    const onPageBreak = vi.fn();
    const y = renderPaginatedText(doc, 'Zeile 1\nZeile 2', {
      x: 14, y: 100, maxWidth: 180, lineHeight: 5, maxContentY: 250, onPageBreak
    });

    expect(onPageBreak).not.toHaveBeenCalled();
    expect(doc.texts.map(t => t.y)).toEqual([100, 105]);
    expect(y).toBe(110);
  });

  it('bricht bei langem Text um: keine Zeile landet unter maxContentY', () => {
    const doc = createMockDoc(10);
    // 40 Zeilen à 5mm ab y=200 -> läuft weit über 250 hinaus
    const langerText = 'x'.repeat(400);
    let pageBreaks = 0;
    const onPageBreak = () => { pageBreaks++; return 20; };

    renderPaginatedText(doc, langerText, {
      y: 200, maxWidth: 180, lineHeight: 5, maxContentY: 250, onPageBreak
    });

    expect(pageBreaks).toBeGreaterThan(0);
    // Keine gezeichnete Zeile überschreitet das Content-Limit
    expect(doc.texts.every(t => t.y <= 250)).toBe(true);
    // Alle 40 Zeilen wurden gezeichnet (nichts abgeschnitten)
    expect(doc.texts.length).toBe(40);
  });

  it('setzt nach Seitenumbruch bei Start-Y der neuen Seite fort', () => {
    const doc = createMockDoc(10);
    const onPageBreak = vi.fn(() => 20);

    renderPaginatedText(doc, 'x'.repeat(30), {
      y: 248, maxWidth: 180, lineHeight: 5, maxContentY: 250, onPageBreak
    });

    // Zeile 1 bei 248, dann Umbruch, Zeilen 2+3 bei 20/25
    expect(doc.texts.map(t => t.y)).toEqual([248, 20, 25]);
    expect(onPageBreak).toHaveBeenCalledTimes(1);
  });

  it('verwendet Default-Werte für x, maxWidth und lineHeight', () => {
    const doc = createMockDoc();
    const y = renderPaginatedText(doc, 'Test', { y: 50, maxContentY: 250, onPageBreak: () => 20 });
    expect(doc.texts).toEqual([{ line: 'Test', x: 14, y: 50 }]);
    expect(y).toBe(55);
  });

  it('stellt Font-Größe/-Stil nach onPageBreak wieder her (Regression: 8pt-Fußzeile)', () => {
    // Mock-Doc mit Font-Zustand: jede gezeichnete Zeile merkt sich die aktive Größe
    const doc = {
      fontSize: 10,
      font: { fontName: 'helvetica', fontStyle: 'normal' },
      texts: [],
      splitTextToSize(text) {
        const result = [];
        const raw = String(text);
        for (let i = 0; i < raw.length; i += 10) result.push(raw.slice(i, i + 10));
        return result;
      },
      getFontSize() { return this.fontSize; },
      setFontSize(size) { this.fontSize = size; },
      getFont() { return { ...this.font }; },
      setFont(fontName, fontStyle) { this.font = { fontName, fontStyle }; },
      text(line, x, y) {
        this.texts.push({ line, x, y, fontSize: this.fontSize, fontStyle: this.font.fontStyle });
      }
    };

    // onPageBreak simuliert eine Fußzeile, die den Font-Zustand NICHT zurücksetzt
    const onPageBreak = () => {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      return 20;
    };

    renderPaginatedText(doc, 'x'.repeat(30), {
      y: 248, maxWidth: 180, lineHeight: 5, maxContentY: 250, onPageBreak
    });

    // Alle Zeilen – auch nach dem Umbruch – mit der ursprünglichen 10pt/normal
    expect(doc.texts.map(t => t.fontSize)).toEqual([10, 10, 10]);
    expect(doc.texts.map(t => t.fontStyle)).toEqual(['normal', 'normal', 'normal']);
    expect(doc.texts.map(t => t.y)).toEqual([248, 20, 25]);
  });
});

describe('renderZusatzBestimmung', () => {
  it('liefert y unverändert zurück, wenn kein Text vorhanden ist', () => {
    const doc = createMockDoc();
    expect(renderZusatzBestimmung(doc, '', { y: 100, maxContentY: 250, onPageBreak: () => 20 })).toBe(100);
    expect(renderZusatzBestimmung(doc, undefined, { y: 100, maxContentY: 250, onPageBreak: () => 20 })).toBe(100);
    expect(doc.texts).toEqual([]);
  });

  it('setzt 8mm Abstand vor dem Label (wie Sub-Headings)', () => {
    const doc = createMockDoc();
    const onPageBreak = vi.fn();
    const y = renderZusatzBestimmung(doc, 'Zusatztext', { y: 100, maxContentY: 250, onPageBreak });

    expect(onPageBreak).not.toHaveBeenCalled();
    // Label bei 100 + 8, Freitext 6mm darunter
    expect(doc.texts.map(t => ({ line: t.line, y: t.y }))).toEqual([
      { line: 'Zusätzliche Bestimmung:', y: 108 },
      { line: 'Zusatztext', y: 114 }
    ]);
    expect(y).toBe(119);
  });

  it('bricht um, wenn Label + Textzeilen nicht mehr passen', () => {
    const doc = createMockDoc();
    const onPageBreak = vi.fn(() => 20);
    // y=245: 245 + 8 + 16 > 250 -> Label und Text starten auf neuer Seite
    renderZusatzBestimmung(doc, 'Zusatztext', { y: 245, maxContentY: 250, onPageBreak });

    expect(onPageBreak).toHaveBeenCalledTimes(1);
    expect(doc.texts.map(t => ({ line: t.line, y: t.y }))).toEqual([
      { line: 'Zusätzliche Bestimmung:', y: 20 },
      { line: 'Zusatztext', y: 26 }
    ]);
  });
});
