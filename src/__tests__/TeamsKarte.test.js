import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const karte = require('../../netlify/functions/_shared/teams/karte.js');
const { pruefeUrl, senden } = require('../../netlify/functions/_shared/teams/webhook.js');

const BASIS = 'https://crm.example.de';
const WEBHOOK = 'https://prod-01.westeurope.logic.azure.com/workflows/abc/triggers/manual/paths/invoke?sig=x';

function kommentar(extra = {}) {
  return {
    id: 'c1',
    video_id: 'v1',
    runde: 2,
    text: 'Bitte  den Schnitt\nbei 0:12 kürzen',
    author_name: 'Kim Kunde',
    author_benutzer_id: 'b1',
    video: {
      id: 'v1',
      position: 3,
      kooperation: {
        id: 'k1', name: 'Koop Lea', briefing_id: 'br1', produktion_id: 'p1', kampagne_id: 'ka1',
        creator: { vorname: 'Lea', nachname: 'Sommer' },
        produktion: { id: 'p1', name: 'Sommer-Dreh' },
        kampagne: {
          id: 'ka1', kampagnenname: 'Launch 2027', eigener_name: null,
          unternehmen: { firmenname: 'FORGEWORKS AG' },
          marke: { markenname: 'Forge Tools' },
        },
      },
    },
    ...extra,
  };
}

const inhalt = (n) => n.attachments[0].content;
const fakten = (n) => Object.fromEntries(inhalt(n).body.find((b) => b.type === 'FactSet').facts.map((f) => [f.title, f.value]));
const texte = (n) => inhalt(n).body.filter((b) => b.type === 'TextBlock').map((b) => b.text);

describe('Teams-Karte', () => {
  it('Kommentar-Karte nennt Unternehmen, Marke, Kampagne, Produktion, Video, Schleife und Autor', () => {
    const n = karte.kommentarKarte(kommentar(), BASIS);
    expect(n.type).toBe('message');
    expect(n.attachments[0].contentType).toBe('application/vnd.microsoft.card.adaptive');
    expect(inhalt(n).version).toBe('1.4');
    expect(texte(n)).toEqual(['Neuer Kundenkommentar', 'FORGEWORKS AG · Forge Tools']);
    expect(fakten(n)).toEqual({
      Kampagne: 'Launch 2027',
      Produktion: 'Sommer-Dreh',
      Video: 'Lea Sommer – Video 3',
      Feedbackschleife: 'v2',
      Von: 'Kim Kunde',
    });
    const zitat = inhalt(n).body.find((b) => b.type === 'Container').items[0].text;
    expect(zitat).toBe('Bitte den Schnitt bei 0:12 kürzen');
    expect(inhalt(n).actions).toEqual([{
      type: 'Action.OpenUrl', title: 'Im CRM öffnen',
      url: `${BASIS}/produktion/p1?tab=videos&linie=br1&k=k1&v=v1`,
    }]);
  });

  it('Marke gleich Unternehmen steht nur einmal, eigener Kampagnenname geht vor', () => {
    const c = kommentar();
    c.video.kooperation.kampagne.marke.markenname = 'FORGEWORKS AG';
    c.video.kooperation.kampagne.eigener_name = 'Forge Herbst';
    const n = karte.kommentarKarte(c, BASIS);
    expect(texte(n)[1]).toBe('FORGEWORKS AG');
    expect(fakten(n).Kampagne).toBe('Forge Herbst');
  });

  it('kürzt lange Texte auf 300 Zeichen', () => {
    const n = karte.kommentarKarte(kommentar({ text: 'x'.repeat(500) }), BASIS);
    const zitat = inhalt(n).body.find((b) => b.type === 'Container').items[0].text;
    expect(zitat).toHaveLength(karte.TEXT_MAX);
    expect(zitat.endsWith('…')).toBe(true);
  });

  it('markiert Gäste, ohne doppelt zu markieren', () => {
    expect(karte.autorName({ author_name: 'Gabi', author_benutzer_id: null })).toBe('Gabi (Gast)');
    expect(karte.autorName({ author_name: 'Gabi (Gast)', author_benutzer_id: null })).toBe('Gabi (Gast)');
    expect(karte.autorName({ author_name: 'Kim', author_benutzer_id: 'b1' })).toBe('Kim');
    expect(karte.autorName({ author_name: '  ', author_benutzer_id: 'b1' })).toBe('Unbekannt');
  });

  it('Link: ohne Briefing alle Linien, ohne Produktion die Kampagne, ohne Basis keiner', () => {
    expect(karte.crmLink(BASIS + '/', { produktionId: 'p1', kooperationId: 'k1', videoId: 'v1' }))
      .toBe(`${BASIS}/produktion/p1?tab=videos&linie=alle&k=k1&v=v1`);
    expect(karte.crmLink(BASIS, { kampagneId: 'ka1' })).toBe(`${BASIS}/kampagne/ka1`);
    expect(karte.crmLink('', { produktionId: 'p1' })).toBe('');
    const ohneLink = karte.kommentarKarte(kommentar(), '');
    expect(inhalt(ohneLink).actions).toEqual([]);
  });

  it('Creator-Name fällt auf den Kooperationsnamen zurück, ohne Position keine Nummer', () => {
    const c = kommentar();
    c.video.kooperation.creator = null;
    c.video.position = null;
    expect(karte.kontextAus(c, BASIS).video).toBe('Koop Lea');
  });

  it('Nachtrag bündelt Kommentare und lässt die Schleife weg, wenn sie sich unterscheidet', () => {
    const eins = karte.entferntKarte([kommentar()], BASIS);
    expect(texte(eins)[0]).toBe('Kundenkommentar entfernt');
    expect(fakten(eins).Feedbackschleife).toBe('v2');

    const zwei = karte.entferntKarte([kommentar(), kommentar({ id: 'c2', runde: 3, text: 'Zweiter', author_benutzer_id: null, author_name: 'Gabi' })], BASIS);
    expect(texte(zwei)[0]).toBe('2 Kundenkommentare entfernt');
    expect(fakten(zwei).Feedbackschleife).toBeUndefined();
    expect(texte(zwei)).toContain('Gabi (Gast): „Zweiter“');
  });

  it('Testkarte nennt den Kanal und hat keinen Link', () => {
    const n = karte.testKarte('Team Beauty');
    expect(texte(n).join(' ')).toContain('„Team Beauty“');
    expect(inhalt(n).actions).toEqual([]);
  });
});

describe('Teams-Webhook', () => {
  const antwort = (status, body = '') => ({ status, text: async () => body });

  it('erlaubt nur https auf Workflow-Hosts', () => {
    expect(pruefeUrl(WEBHOOK)).toBeNull();
    expect(pruefeUrl('https://default123.environment.api.powerplatform.com/powerautomate/x')).toBeNull();
    expect(pruefeUrl('http://prod-01.logic.azure.com/x')).toMatch(/https/);
    expect(pruefeUrl('https://evil.example.com/logic.azure.com')).toMatch(/Microsoft Workflows/);
    expect(pruefeUrl('kein link')).toMatch(/ungültig/);
  });

  it('202 ist Erfolg und schickt die Karte als JSON', async () => {
    const fetchImpl = vi.fn(async () => antwort(202));
    const r = await senden(WEBHOOK, { type: 'message' }, { fetchImpl });
    expect(r).toEqual({ ok: true, status: 202 });
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe(WEBHOOK);
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ type: 'message' });
  });

  it('4xx ist endgültig, 429 und 5xx nicht; Fehlertext aus der Antwort', async () => {
    const r404 = await senden(WEBHOOK, {}, { fetchImpl: async () => antwort(404, JSON.stringify({ error: { message: 'Workflow not found' } })) });
    expect(r404).toMatchObject({ ok: false, permanent: true, status: 404, fehler: 'HTTP 404: Workflow not found' });
    const r429 = await senden(WEBHOOK, {}, { fetchImpl: async () => antwort(429) });
    expect(r429).toMatchObject({ ok: false, permanent: false, fehler: 'HTTP 429' });
    const r502 = await senden(WEBHOOK, {}, { fetchImpl: async () => antwort(502, 'Bad gateway') });
    expect(r502).toMatchObject({ ok: false, permanent: false, fehler: 'HTTP 502: Bad gateway' });
  });

  it('fremde Hosts gehen gar nicht erst raus', async () => {
    const fetchImpl = vi.fn();
    const r = await senden('https://example.com/hook', {}, { fetchImpl });
    expect(r).toMatchObject({ ok: false, permanent: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('Zeitüberschreitung ist nicht endgültig', async () => {
    const fetchImpl = (_url, { signal }) => new Promise((_res, rej) => {
      signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
    const r = await senden(WEBHOOK, {}, { fetchImpl, timeoutMs: 5 });
    expect(r).toEqual({ ok: false, permanent: false, fehler: 'Zeitüberschreitung beim Workflow' });
  });
});
