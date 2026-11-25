import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
import { createFakeSupabase } from './fixtures/fakeSupabase.js';

const require = createRequire(import.meta.url);
const { createVerteiler, BACKOFF_MS, NACHTRAG_WARTEN_MS, MAX_VERSUCHE } = require('../../netlify/functions/_shared/teams/verteilen.js');

const START = Date.parse('2026-12-08T09:00:00Z');
const iso = (t) => new Date(t).toISOString();
const URL_A = 'https://prod-01.westeurope.logic.azure.com/workflows/a/invoke?sig=1';
const URL_B = 'https://prod-02.westeurope.logic.azure.com/workflows/b/invoke?sig=2';

function zeitkommentar(id, extra = {}) {
  return {
    id, video_id: 'v1', runde: 1, text: `Text ${id}`, author_name: 'Kim Kunde', author_benutzer_id: 'b1', deleted_at: null,
    video: {
      id: 'v1', position: 1,
      kooperation: {
        id: 'k1', name: 'Koop', briefing_id: null, produktion_id: 'p1', kampagne_id: 'ka1',
        creator: { vorname: 'Lea', nachname: 'Sommer' },
        produktion: { id: 'p1', name: 'Dreh' },
        kampagne: { id: 'ka1', kampagnenname: 'Launch', unternehmen: { firmenname: 'FORGEWORKS AG' }, marke: null },
      },
    },
    ...extra,
  };
}

let n = 0;
function meldung(kanalId, kommentarId, extra = {}) {
  n += 1;
  return {
    id: `m${n}`, kanal_id: kanalId, art: 'kommentar', zeitkommentar_id: kommentarId, status: 'offen', versuche: 0,
    naechster_versuch: iso(START - 1000), gesperrt_bis: null, fehler: null, txid: 100,
    created_at: iso(START - 10000 + n), gesendet_at: null, ...extra,
  };
}

function setup({ meldungen, kommentare = [zeitkommentar('c1')], kanaele, antwort = () => ({ status: 202 }), schritt = 0 } = {}) {
  const uhr = { t: START };
  const supabase = createFakeSupabase({
    tabellen: {
      teams_kanal: kanaele || [
        { id: 'kA', name: 'Test', webhook_url: URL_A, aktiv: true },
        { id: 'kB', name: 'Beauty', webhook_url: URL_B, aktiv: true },
      ],
      kooperation_video_zeitkommentar: kommentare,
      teams_meldung: meldungen,
    },
    rpc: {
      teams_meldungen_holen: ({ p_limit, p_lease_sek }, db) => {
        const faellig = db.teams_meldung
          .filter((r) => (r.status === 'offen' && Date.parse(r.naechster_versuch) <= uhr.t)
            || (r.status === 'in_arbeit' && Date.parse(r.gesperrt_bis) < uhr.t))
          .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
          .slice(0, p_limit);
        for (const r of faellig) Object.assign(r, { status: 'in_arbeit', gesperrt_bis: iso(uhr.t + p_lease_sek * 1000) });
        return faellig.map((r) => ({ ...r }));
      },
    },
  });
  const fetchImpl = vi.fn(async (url, opts) => {
    const a = antwort(url, JSON.parse(opts.body));
    return { status: a.status, text: async () => a.body || '' };
  });
  const jetzt = () => {
    const t = uhr.t;
    uhr.t += schritt;
    return t;
  };
  const v = createVerteiler({ supabase, fetchImpl, basisUrl: 'https://crm.example.de', jetzt });
  const zeile = (id) => supabase.db.teams_meldung.find((r) => r.id === id);
  const kanal = (id) => supabase.db.teams_kanal.find((k) => k.id === id);
  const titel = (call) => JSON.parse(call[1].body).attachments[0].content.body[0].text;
  return { uhr, supabase, db: supabase.db, v, fetchImpl, zeile, kanal, titel };
}

describe('Teams-Meldungen verteilen', () => {
  it('ohne fällige Zeilen passiert nichts', async () => {
    const t = setup({ meldungen: [meldung('kA', 'c1', { status: 'gesendet' })] });
    expect(await t.v.verteilen()).toEqual({ gesendet: 0, fehler: 0, verschoben: 0, verworfen: 0 });
    expect(t.fetchImpl).not.toHaveBeenCalled();
  });

  it('schickt je Kanal eine Meldung und hält den Stand fest', async () => {
    const a = meldung('kA', 'c1');
    const b = meldung('kB', 'c1');
    const t = setup({ meldungen: [a, b] });

    expect(await t.v.verteilen()).toEqual({ gesendet: 2, fehler: 0, verschoben: 0, verworfen: 0 });
    expect(t.fetchImpl.mock.calls.map(([url]) => url).sort()).toEqual([URL_A, URL_B]);
    expect(t.titel(t.fetchImpl.mock.calls[0])).toBe('Neuer Kundenkommentar');
    expect(t.zeile(a.id)).toMatchObject({ status: 'gesendet', gesendet_at: iso(START), gesperrt_bis: null });
    expect(t.kanal('kA')).toMatchObject({ letzte_meldung_at: iso(START), letzter_fehler: null });

    // Zweiter Lauf findet nichts mehr
    expect((await t.v.verteilen()).gesendet).toBe(0);
    expect(t.fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('verwirft die Meldung, wenn der Kommentar vor dem Senden entfernt wurde', async () => {
    const a = meldung('kA', 'c1');
    const t = setup({ meldungen: [a], kommentare: [zeitkommentar('c1', { deleted_at: iso(START - 500) })] });
    expect(await t.v.verteilen()).toMatchObject({ gesendet: 0, verworfen: 1 });
    expect(t.zeile(a.id)).toBeUndefined();
    expect(t.fetchImpl).not.toHaveBeenCalled();
  });

  it('deaktivierter Kanal: Fehler an der Zeile, nichts gesendet', async () => {
    const a = meldung('kA', 'c1');
    const t = setup({ meldungen: [a], kanaele: [{ id: 'kA', name: 'Test', webhook_url: URL_A, aktiv: false }] });
    expect(await t.v.verteilen()).toMatchObject({ fehler: 1 });
    expect(t.zeile(a.id)).toMatchObject({ status: 'fehler', fehler: 'Kanal deaktiviert' });
    expect(t.fetchImpl).not.toHaveBeenCalled();
  });

  it('Serverfehler: später erneut mit Backoff, nach dem letzten Versuch endgültig', async () => {
    const a = meldung('kA', 'c1');
    const t = setup({ meldungen: [a], antwort: () => ({ status: 502, body: 'Bad gateway' }) });

    expect(await t.v.verteilen()).toMatchObject({ verschoben: 1 });
    expect(t.zeile(a.id)).toMatchObject({ status: 'offen', versuche: 1, fehler: 'HTTP 502: Bad gateway', naechster_versuch: iso(START + BACKOFF_MS) });
    expect(t.kanal('kA')).toMatchObject({ letzter_fehler: 'HTTP 502: Bad gateway', letzter_fehler_at: iso(START) });

    // Vor dem Backoff nicht fällig
    expect(await t.v.verteilen()).toMatchObject({ verschoben: 0 });

    t.zeile(a.id).versuche = MAX_VERSUCHE - 1;
    t.uhr.t += 60 * 60 * 1000;
    expect(await t.v.verteilen()).toMatchObject({ fehler: 1 });
    expect(t.zeile(a.id)).toMatchObject({ status: 'fehler', versuche: MAX_VERSUCHE });
  });

  it('404 vom Workflow ist sofort endgültig', async () => {
    const a = meldung('kA', 'c1');
    const t = setup({ meldungen: [a], antwort: () => ({ status: 404 }) });
    expect(await t.v.verteilen()).toMatchObject({ fehler: 1 });
    expect(t.zeile(a.id)).toMatchObject({ status: 'fehler', versuche: 1, fehler: 'HTTP 404' });
  });

  it('Nachtrag: entfernte Kommentare eines Videos und Vorgangs gehen als eine Karte raus', async () => {
    const gesendet = { status: 'gesendet', gesendet_at: iso(START - 5000) };
    const e1 = meldung('kA', 'c1', { art: 'entfernt', txid: 200 });
    const e2 = meldung('kA', 'c2', { art: 'entfernt', txid: 200 });
    const t = setup({
      meldungen: [meldung('kA', 'c1', gesendet), meldung('kA', 'c2', gesendet), e1, e2],
      kommentare: [zeitkommentar('c1', { deleted_at: iso(START) }), zeitkommentar('c2', { deleted_at: iso(START) })],
    });

    expect(await t.v.verteilen()).toMatchObject({ gesendet: 2 });
    expect(t.fetchImpl).toHaveBeenCalledTimes(1);
    expect(t.titel(t.fetchImpl.mock.calls[0])).toBe('2 Kundenkommentare entfernt');
    expect(t.zeile(e1.id).status).toBe('gesendet');
    expect(t.zeile(e2.id).status).toBe('gesendet');
  });

  it('Nachtrag wartet, solange die Meldung noch nicht raus ist', async () => {
    const k = meldung('kA', 'c1');
    const e = meldung('kA', 'c1', { art: 'entfernt' });
    const t = setup({ meldungen: [k, e], antwort: () => ({ status: 503 }) });

    // Kommentar noch da: Meldung scheitert, Nachtrag wartet
    expect(await t.v.verteilen()).toMatchObject({ verschoben: 2 });
    expect(t.zeile(e.id)).toMatchObject({ status: 'offen', naechster_versuch: iso(START + NACHTRAG_WARTEN_MS) });
  });

  it('Nachtrag fällt weg, wenn die Meldung nie rausging', async () => {
    const e = meldung('kA', 'c1', { art: 'entfernt' });
    const t = setup({
      meldungen: [meldung('kA', 'c1', { status: 'fehler' }), e],
      kommentare: [zeitkommentar('c1', { deleted_at: iso(START) })],
    });
    expect(await t.v.verteilen()).toMatchObject({ verworfen: 1, gesendet: 0 });
    expect(t.zeile(e.id)).toBeUndefined();
    expect(t.fetchImpl).not.toHaveBeenCalled();
  });

  it('gibt nach dem Budget alles Übrige sofort frei', async () => {
    const a = meldung('kA', 'c1');
    const b = meldung('kB', 'c1');
    const t = setup({ meldungen: [a, b], schritt: 5000 });

    expect(await t.v.verteilen({ budgetMs: 8000 })).toMatchObject({ gesendet: 1 });
    const offen = [t.zeile(a.id), t.zeile(b.id)].find((z) => z.status !== 'gesendet');
    expect(offen).toMatchObject({ status: 'offen', gesperrt_bis: null });
  });
});
