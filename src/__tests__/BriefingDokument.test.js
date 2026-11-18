// BriefingDokument.test.js
// Dokument und Creator-PDF folgen den drei Sektionen des Creator-Briefings;
// „Frühere Angaben“ nur fürs Team, nie im PDF.

import { describe, it, expect } from 'vitest';
import { briefingSektionen, fruehereAngaben } from '../modules/briefing/briefingDokument.js';
import { renderBriefingDoc } from '../modules/briefing/BriefingDocView.js';
import { buildBriefingPdfModel } from '../modules/briefing/briefingPdfModell.js';
import { makeDetail } from './briefingDocTestKit.js';

const NEU = {
  id: 'b1',
  bereich: 'paid_creator_ads',
  is_draft: false,
  aktivierung_name: 'Sommer-Launch',
  nutzung_paid_media: true,
  nutzung_markenkanal: false,
  plattformen: ['instagram', 'tiktok'],
  plattformen_weitere: 'Snapchat',
  seitenverhaeltnisse: ['9:16'],
  videolaenge_von: 30,
  videolaenge_bis: null,
  content_deadline: '2026-12-01',
  content_deadline_bis: '2026-12-05',
  go_live: '2026-12-10',
  beschreibung: 'Idee <b>fett</b>',
  kernbotschaft: 'Bleibt hängen',
  aufgabe: 'Zeig das Produkt',
  vorgabe_dos: 'Lachen',
  vorgabe_donts: 'Konkurrenz zeigen',
  umsetzungsideen_eintraege: [
    { text: 'https://www.tiktok.com/@x/video/1', verbindlich: true },
    { text: 'Unboxing', verbindlich: false }
  ],
  verhandlungshinweis: 'Budget max 500',
  tkp: 25,
  produkte: [{ id: 'p1', name: 'Clear Case', url: 'https://shop.de/clear', kurzbeschreibung: 'Hülle', usp: 'Dünn', loesung: null }]
};

describe('briefingSektionen', () => {
  it('liefert die drei PDF-Sektionen in Reihenfolge', () => {
    const sektionen = briefingSektionen(makeDetail(NEU));
    expect(sektionen.map(s => s.titel)).toEqual([
      'Kampagnenübersicht & Rahmen',
      'Produkt & Kampagnenidee',
      'Deine Aufgabe & Umsetzung'
    ]);
  });

  it('fasst Gruppen zusammen: Häkchen, Liste plus Weitere, Zeitraum', () => {
    const [rahmen] = briefingSektionen(makeDetail(NEU));
    const zeilen = Object.fromEntries(rahmen.eintraege.filter(e => e.art === 'zeile').map(e => [e.label, e]));
    expect(zeilen['Wie wird der Content verwendet?'].text).toBe('Paid Ads');
    expect(zeilen.Plattformen.text).toBe('Instagram, TikTok, Snapchat');
    expect(zeilen['Videolänge'].html).toBe('ab 30 Sek.');
    expect(zeilen['Content-Abgabe'].html).toBe('1.12.2026 bis 5.12.2026');
    expect(zeilen['Veröffentlichung'].html).toBe('10.12.2026');
  });

  it('zeigt Produkte live mit ihren Feldern', () => {
    const produkt = briefingSektionen(makeDetail(NEU))[1].eintraege.find(e => e.art === 'produkt');
    expect(produkt.name).toBe('Clear Case');
    expect(produkt.zeilen.map(z => z.label)).toEqual(['Kurzbeschreibung', 'Produkteigenschaften']);
  });

  it('liefert leere Textfelder nur mit mitLeeren', () => {
    const ohne = briefingSektionen(makeDetail(NEU))[2].eintraege.map(e => e.field?.name);
    const mit = briefingSektionen(makeDetail(NEU), { mitLeeren: true })[2].eintraege.map(e => e.field?.name);
    expect(ohne).not.toContain('vorgabe_pflicht');
    expect(mit).toContain('vorgabe_pflicht');
  });
});

describe('Frühere Angaben', () => {
  it('sammelt befüllte Altfelder', () => {
    const labels = fruehereAngaben(makeDetail(NEU)).map(r => r.name);
    expect(labels).toEqual(expect.arrayContaining(['verhandlungshinweis', 'tkp']));
  });

  it('erscheint nur mit Recht und nie im PDF', () => {
    const detail = makeDetail(NEU);
    expect(renderBriefingDoc({ detail, fruehereAngaben: true })).toContain('Budget max 500');
    expect(renderBriefingDoc({ detail, fruehereAngaben: false })).not.toContain('Budget max 500');
    expect(JSON.stringify(buildBriefingPdfModel(detail))).not.toContain('Budget max 500');
  });

  it('nimmt bei v1-Briefings den Präfix-Katalog dazu', () => {
    const detail = makeDetail({ id: 'v1', bereich: 'influencer_marketing', im_umsetzung: 'Alt-Aufgabe', im_code: 'RABATT' });
    const rows = fruehereAngaben(detail).map(r => r.label);
    expect(rows).toContain('Code');
    // Aufgabe kommt über den Fallback trotzdem in Sektion 3
    const aufgabe = briefingSektionen(detail)[2].eintraege.find(e => e.field?.name === 'aufgabe');
    expect(aufgabe.html).toBe('Alt-Aufgabe');
  });
});

describe('Creator-PDF', () => {
  it('baut Blöcke je Sektion mit Produkt und Ideen als Klartext', () => {
    const model = buildBriefingPdfModel(makeDetail(NEU));
    expect(model.title).toBe('Sommer-Launch');
    expect(model.products).toBe('Clear Case');
    const [, produkt, umsetzung] = model.sections;
    expect(produkt.blocks[0]).toEqual({ type: 'sub', text: 'Clear Case' });
    expect(umsetzung.blocks[0].type).toBe('prose');
    const ideen = umsetzung.blocks.find(b => b.label === 'Umsetzungsideen & Referenzen (optional)');
    expect(ideen.text).toBe('Verbindlich: https://www.tiktok.com/@x/video/1\nInspiration: Unboxing');
  });

  it('escaped Freitext im Dokument', () => {
    expect(renderBriefingDoc({ detail: makeDetail(NEU) })).toContain('Idee &lt;b&gt;fett&lt;/b&gt;');
  });
});
