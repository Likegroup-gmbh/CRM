import { describe, it, expect } from 'vitest';
import { kachelMasse, renderReportPdf } from '../modules/report-pdf/reportPdfVorlage.js';
import { schriftCss } from '../modules/report-pdf/reportPdfStil.js';

function kachel(i, extra = {}) {
  return {
    id: `p${i}`,
    plattform: 'Instagram-Reel',
    creator: `Creator ${i}`,
    unterzeile: `@c${i} · 03.11.2026`,
    posterUrl: `https://projekt.supabase.co/storage/v1/object/sign/poster/${i}.jpg?token=x`,
    werte: [{ label: 'Aufrufe', wert: '12,0K' }, { label: 'Likes', wert: '800' }, { label: 'Kommentare', wert: '40' }, { label: 'Engagement', wert: '7,2 %' }],
    ...extra
  };
}

function vm(anzahl, extra = {}) {
  return {
    titel: 'Produktion 1',
    untertitel: 'Kampagne',
    kunde: { name: 'Kunde', logoUrl: null },
    zeitraum: 'Nov 2026',
    intro: `${anzahl} Posts`,
    kennzahlen: [{ label: 'Aufrufe', wert: '1,2M', sub: 'Ø 120K pro Post' }],
    kacheln: Array.from({ length: anzahl }, (_, i) => kachel(i + 1)),
    ...extra
  };
}

function dom(html) {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('Report-PDF: Vorlage', () => {
  it.each([
    [0, 5, 1],
    [1, 5, 2],
    [8, 5, 3],
    [11, 5, 4],
    [12, 6, 3],
    [7, 3, 4],
  ])('%i Posts bei max %i → %i Seiten (Deckblatt + Kachelseiten)', (anzahl, max, seiten) => {
    const doc = dom(renderReportPdf(vm(anzahl), { maxJeSeite: max }));
    expect(doc.querySelectorAll('.rp-seite')).toHaveLength(seiten);
    expect(doc.querySelectorAll('.rp-kachel')).toHaveLength(anzahl);
    expect(doc.querySelector('.rp-seite:last-child .rp-fuss')?.textContent).toContain(`Seite ${seiten} von ${seiten}`);
  });

  it('beschriftet die Kachelseiten mit dem Bereich', () => {
    const doc = dom(renderReportPdf(vm(11)));
    const labels = [...doc.querySelectorAll('.rp-kachelseite .rp-label')].map(el => el.textContent);
    expect(labels).toEqual(['Posts 1–4 von 11', 'Posts 5–8 von 11', 'Posts 9–11 von 11']);
  });

  it('escaped Creator-Namen und Titel', () => {
    const boese = '<img src=x onerror=alert(1)>';
    const html = renderReportPdf(vm(1, { titel: boese, kacheln: [kachel(1, { creator: boese })] }));
    expect(html).not.toContain(boese);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(dom(html).querySelectorAll('img[onerror]')).toHaveLength(0);
  });

  it('zeigt ohne Poster den Platzhalter und lässt fremde Schemata nicht durch', () => {
    const html = renderReportPdf(vm(1, { kacheln: [kachel(1, { posterUrl: null }), kachel(2, { posterUrl: 'javascript:alert(1)' }), kachel(3, { posterUrl: 'http://unsicher.test/a.jpg' })] }));
    const doc = dom(html);
    expect(doc.querySelectorAll('.rp-kachel__ohne')).toHaveLength(3);
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('http://unsicher.test');
  });

  it('übernimmt https- und data:image-Poster', () => {
    const daten = 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C%2Fsvg%3E';
    const doc = dom(renderReportPdf(vm(1, { kacheln: [kachel(1), kachel(2, { posterUrl: daten })] })));
    const srcs = [...doc.querySelectorAll('.rp-kachel__bild img')].map(img => img.getAttribute('src'));
    expect(srcs).toEqual([kachel(1).posterUrl, daten]);
  });

  it('enthält keine Kosten', () => {
    expect(renderReportPdf(vm(6))).not.toMatch(/kosten|€/i);
  });

  it('setzt A4 quer und bettet die Schrift ein', () => {
    const fontCss = schriftCss({ latin: 'data:font/woff2;base64,AAA', latinExt: 'data:font/woff2;base64,BBB' });
    const html = renderReportPdf(vm(1), { fontCss });
    expect(html).toContain('size: 297mm 210mm');
    expect(html).toContain('@font-face');
    expect(html).toContain('data:font/woff2;base64,AAA');
    expect(renderReportPdf(vm(1))).not.toContain('@font-face');
  });

  it('Kachelmaße: 9:16, Bildhöhe gedeckelt', () => {
    const sechs = kachelMasse(6);
    expect(sechs.bild).toBeCloseTo((sechs.breite * 16) / 9, 0);
    expect(kachelMasse(3).bild).toBe(100);
    expect(kachelMasse(5).breite).toBeGreaterThan(kachelMasse(6).breite);
  });
});
