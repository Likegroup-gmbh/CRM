import { describe, it, expect } from 'vitest';
import { skriptPdfAbschnitte, zeichneSkriptPdf } from '../modules/skripte/skriptPdf.js';

function mockDoc() {
  const doc = {
    page: 1,
    calls: [],
    lines: [],
    setFont() {},
    setFontSize() {},
    setTextColor() {},
    setDrawColor() {},
    setLineWidth() {},
    addPage() { this.page += 1; },
    line(x1, y1, x2, y2) { this.lines.push({ page: this.page, x1, y1, x2, y2 }); },
    text(t, x, y) { this.calls.push({ page: this.page, t: String(t), x, y }); },
    splitTextToSize(text) {
      const wert = String(text ?? '');
      if (wert.includes('SEHR LANG')) {
        return Array.from({ length: 70 }, (_, i) => `lang-${i}`);
      }
      return wert.split('\n');
    }
  };
  return doc;
}

const SKRIPT = {
  titel: 'Pommes',
  hook: 'Hallo gesagt',
  hook_visuell: 'Zu sehen',
  text_hook: 'Overlay',
  hauptteil: 'Mitte',
  hauptteil_visuell: 'Schublade',
  cta: 'Passt',
  cta_visuell: 'Endframe',
  rezept: '250 g Makkaroni',
  caption: 'Heute Mac'
};

describe('Skript-PDF', () => {
  it('legt Gesagt und Visual als eigene Spalten ab', () => {
    expect(skriptPdfAbschnitte(SKRIPT)).toEqual([
      { art: 'spalten', label: 'Hook', gesagt: 'Hallo gesagt', visual: 'Zu sehen', textHook: 'Overlay' },
      { art: 'spalten', label: 'Hauptteil', gesagt: 'Mitte', visual: 'Schublade', textHook: '' },
      { art: 'spalten', label: 'CTA', gesagt: 'Passt', visual: 'Endframe', textHook: '' },
      { art: 'breit', label: 'Rezept', text: '250 g Makkaroni' },
      { art: 'breit', label: 'Caption', text: 'Heute Mac' }
    ]);
  });

  it('zeichnet die beiden Spalten auf einer Zeile und Rezept darüber hinweg', () => {
    const doc = mockDoc();
    zeichneSkriptPdf(doc, SKRIPT, { nr: 2 });

    const kopfLinks = doc.calls.find((c) => c.t === 'Was gesagt wird');
    const kopfRechts = doc.calls.find((c) => c.t === 'Was zu sehen ist');
    const gesagt = doc.calls.find((c) => c.t === 'Hallo gesagt');
    const visual = doc.calls.find((c) => c.t === 'Zu sehen');
    const overlay = doc.calls.find((c) => c.t === 'Overlay');
    const textHook = doc.calls.find((c) => c.t === 'Text-Hook');
    const rezept = doc.calls.find((c) => c.t === '250 g Makkaroni');

    expect(kopfLinks.y).toBe(kopfRechts.y);
    expect(kopfRechts.x).toBeGreaterThan(kopfLinks.x + 40);
    const mitte = doc.calls.find((c) => c.t === 'Mitte');
    const schublade = doc.calls.find((c) => c.t === 'Schublade');

    expect(gesagt.x).toBe(kopfLinks.x);
    expect(visual.x).toBe(kopfRechts.x);
    expect(gesagt.y).toBe(textHook.y);
    expect(mitte.y).toBe(schublade.y);
    expect(mitte.x).toBe(gesagt.x);
    expect(schublade.x).toBe(visual.x);
    expect(textHook.x).toBe(visual.x);
    expect(overlay.x).toBe(visual.x);
    expect(overlay.y).toBeLessThan(visual.y);
    expect(rezept.x).toBe(gesagt.x);
    expect(doc.calls.some((c) => c.t.includes('Gesagt:'))).toBe(false);
    expect(doc.calls.some((c) => c.t.includes('Visual:'))).toBe(false);
    expect(doc.lines.some((l) => l.x1 === l.x2 && l.x1 > gesagt.x && l.x1 < visual.x)).toBe(true);
    expect(doc.calls.find((c) => c.t === '2. Pommes')).toBeTruthy();
  });

  it('führt eine lange rechte Spalte auf der nächsten Seite mit Kopf weiter', () => {
    const doc = mockDoc();
    zeichneSkriptPdf(doc, {
      titel: 'Lang',
      hook: 'kurz',
      hook_visuell: 'SEHR LANG'
    });

    const seite2 = doc.calls.filter((c) => c.page === 2);
    expect(doc.page).toBeGreaterThan(1);
    expect(seite2.some((c) => c.t === 'Was gesagt wird')).toBe(true);
    expect(seite2.some((c) => c.t === 'Was zu sehen ist')).toBe(true);
    const fortsetzung = seite2.find((c) => c.t.startsWith('lang-'));
    const kopfRechts = seite2.find((c) => c.t === 'Was zu sehen ist');
    expect(fortsetzung.x).toBe(kopfRechts.x);
    expect(seite2.some((c) => c.t === 'Hook')).toBe(true);
  });
});
