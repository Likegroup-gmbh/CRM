// VerbindlicheIdeen.test.js
// Verbindliche Umsetzungsideen werden einmalig 1:1 zu Vorschlägen (ADR 0073):
// Text als Idee, Link als Videoreferenz, nie doppelt, verworfene kommen nicht wieder.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  verbindlicheIdeen,
  offeneVerbindlicheIdeen,
  frueherAngelegt,
  buildVerbindlichInsert,
  funnelStufenFuer,
  konzeptTool
} = require('../../netlify/functions/_shared/strategie-idee.js');

const BRIEFING = {
  bereich: 'paid_creator_ads',
  umsetzungsideen_eintraege: [
    { text: 'Hook mit dem Etiketten-Check', verbindlich: true },
    { text: 'So wie hier: https://www.tiktok.com/@marke/video/123?is_from_webapp=1', verbindlich: true },
    { text: 'Morgenroutine', verbindlich: false }
  ]
};

describe('verbindlicheIdeen', () => {
  it('nimmt nur verbindliche Einträge, trennt Link und Resttext', () => {
    expect(verbindlicheIdeen(BRIEFING)).toEqual([
      { text: 'Hook mit dem Etiketten-Check', url: null, rest: 'Hook mit dem Etiketten-Check', schluessel: 'text:hook mit dem etiketten-check' },
      {
        text: 'So wie hier: https://www.tiktok.com/@marke/video/123?is_from_webapp=1',
        url: 'https://www.tiktok.com/@marke/video/123?is_from_webapp=1',
        rest: 'So wie hier:',
        schluessel: 'link:tiktok.com/@marke/video/123'
      }
    ]);
  });

  it('ohne Einträge oder nur Inspiration: nichts', () => {
    expect(verbindlicheIdeen({ bereich: 'owned_social' })).toEqual([]);
    expect(verbindlicheIdeen({ umsetzungsideen_eintraege: [{ text: 'A', verbindlich: false }] })).toEqual([]);
  });
});

describe('offeneVerbindlicheIdeen', () => {
  it('überspringt, was schon im Konzept steht: gleicher Link oder gleiche erste Zeile', () => {
    const items = [
      { video_link: 'http://tiktok.com/@marke/video/123/?utm_source=copy' },
      { beschreibung: 'Hook mit dem  Etiketten-Check\nAblauf: …' }
    ];
    expect(offeneVerbindlicheIdeen({ briefing: BRIEFING, items })).toEqual([]);
  });

  it('YouTube-Videos unterscheiden sich über ?v=', () => {
    const briefing = { umsetzungsideen_eintraege: [
      { text: 'https://www.youtube.com/watch?v=abc&si=x', verbindlich: true },
      { text: 'https://youtube.com/watch?v=def', verbindlich: true }
    ] };
    expect(verbindlicheIdeen(briefing).map(i => i.schluessel)).toEqual(['link:youtube.com/watch?v=abc', 'link:youtube.com/watch?v=def']);
    expect(offeneVerbindlicheIdeen({ briefing, items: [{ video_link: 'https://youtube.com/watch?v=abc' }] })).toHaveLength(1);
  });

  it('zweiter Lauf legt nichts doppelt an, auch wenn der Vorschlag verworfen wurde', () => {
    const erster = offeneVerbindlicheIdeen({ briefing: BRIEFING, items: [] });
    expect(erster).toHaveLength(2);
    const frueher = erster.map(i => i.schluessel);
    expect(offeneVerbindlicheIdeen({ briefing: BRIEFING, items: [], frueher })).toEqual([]);
  });

  it('eine neue verbindliche Idee im Briefing kommt beim nächsten Lauf dazu', () => {
    const frueher = verbindlicheIdeen(BRIEFING).map(i => i.schluessel);
    const erweitert = {
      ...BRIEFING,
      umsetzungsideen_eintraege: [...BRIEFING.umsetzungsideen_eintraege, { text: 'Vorher-Nachher', verbindlich: true }]
    };
    expect(offeneVerbindlicheIdeen({ briefing: erweitert, frueher }).map(i => i.text)).toEqual(['Vorher-Nachher']);
  });

  it('doppelte Einträge im Briefing werden eine Idee', () => {
    const briefing = { umsetzungsideen_eintraege: [{ text: 'Unboxing', verbindlich: true }, { text: ' unboxing ', verbindlich: true }] };
    expect(offeneVerbindlicheIdeen({ briefing })).toHaveLength(1);
  });

  it('frueherAngelegt sammelt die Schlüssel aller Läufe des Konzepts', async () => {
    const filter = [];
    const supabase = {
      from: () => ({
        select: () => ({
          eq: async (k, v) => {
            filter.push([k, v]);
            return { data: [{ result: { verbindlich: ['text:a'] } }, { result: null }, { result: { verbindlich: ['link:b'] } }] };
          }
        })
      })
    };
    expect(await frueherAngelegt(supabase, 's1')).toEqual(['text:a', 'link:b']);
    expect(filter).toEqual([['strategie_id', 's1']]);
  });
});

describe('buildVerbindlichInsert', () => {
  const [text, link] = verbindlicheIdeen(BRIEFING);

  it('Text wird eine Idee, vom User und vor KI-Überschreiben geschützt', () => {
    expect(buildVerbindlichInsert({ strategieId: 's1', idee: text, sortierung: 3, createdBy: 'b1', produktId: 'p1' })).toEqual({
      produkt_id: 'p1',
      strategie_id: 's1',
      sortierung: 3,
      teilbereich: null,
      ist_vorschlag: true,
      created_by: 'b1',
      video_link: null,
      plattform: null,
      kurzbeschreibung: 'Hook mit dem Etiketten-Check',
      beschreibung: 'Hook mit dem Etiketten-Check',
      beschreibung_quelle: 'user'
    });
  });

  it('ein Link wird eine Videoreferenz, der Resttext die Umsetzungsvorgabe', () => {
    const insert = buildVerbindlichInsert({ strategieId: 's1', idee: link, sortierung: 4, createdBy: null });
    expect(insert).toMatchObject({
      video_link: 'https://www.tiktok.com/@marke/video/123?is_from_webapp=1',
      plattform: 'tiktok',
      umsetzungsvorgabe: 'So wie hier:',
      verarbeitung_status: 'pending',
      ist_vorschlag: true
    });
    expect(insert).not.toHaveProperty('produkt_id');
    expect(insert).not.toHaveProperty('beschreibung_quelle');
  });
});

describe('Funnel bei Paid', () => {
  it('das Tool bietet bei Paid alle drei Stufen, sonst keine', () => {
    const paid = konzeptTool(3, funnelStufenFuer({ bereich: 'paid_creator_ads' })).input_schema.properties.ideen.items;
    expect(paid.properties.funnel_stufe.enum).toEqual(['upper', 'mid', 'lower']);
    const organic = konzeptTool(3, funnelStufenFuer({ bereich: 'owned_social' })).input_schema.properties.ideen.items;
    expect(organic.properties.funnel_stufe).toBeUndefined();
  });
});
