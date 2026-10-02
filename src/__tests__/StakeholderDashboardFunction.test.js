import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createHandler } = require('../../netlify/functions/stakeholder-dashboard.js');

// Netlify-Function stakeholder-dashboard: Token wird an die RPC durchgereicht
// (Rollenpruefung dort), der Rechenkern laeuft auf dem Ergebnis, nichts wird
// gecacht. Supabase und Zeit sind injiziert.

const BUNDLE = {
  auftraege: [
    { id: 'a1', nettobetrag: 1000, is_draft: false, unternehmen_id: 'u1', start: '2026-01-01' },
    { id: 'a2', nettobetrag: 500, is_draft: true, unternehmen_id: 'u1' },
    { id: 'a3', nettobetrag: 700, is_draft: false, unternehmen_id: 'ut' },
  ],
  unternehmen: [
    { id: 'u1', firmenname: 'Firma', ist_test: false },
    { id: 'ut', firmenname: 'Test', ist_test: true },
  ],
};

function bauHandler({ rpcResult, env } = {}) {
  const rpc = vi.fn(async () => rpcResult || { data: BUNDLE, error: null });
  const createSupabase = vi.fn(() => ({ rpc }));
  const handler = createHandler({
    createSupabase,
    env: env || (() => ({ url: 'https://x.supabase.co', key: 'anon' })),
    jetzt: () => 1000,
  });
  return { handler, rpc, createSupabase };
}

const mitToken = (extra = {}) => ({ httpMethod: 'POST', headers: { authorization: 'Bearer abc' }, ...extra });

describe('stakeholder-dashboard Function', () => {
  it('lehnt Aufrufe ohne Token ab', async () => {
    const { handler, rpc } = bauHandler();
    const res = await handler({ httpMethod: 'POST', headers: {} });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toMatchObject({ code: 'no_token', session_dead: true });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('lehnt andere Methoden ab', async () => {
    const { handler } = bauHandler();
    const res = await handler({ httpMethod: 'DELETE', headers: { authorization: 'Bearer abc' } });
    expect(res.statusCode).toBe(405);
  });

  it('meldet fehlende Serverkonfiguration', async () => {
    const { handler } = bauHandler({ env: () => ({ url: '', key: '' }) });
    const res = await handler(mitToken());
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).code).toBe('config_missing');
  });

  it('ruft die RPC mit dem JWT des Aufrufers, nicht mit dem Service-Key', async () => {
    const { handler, rpc, createSupabase } = bauHandler();
    await handler(mitToken());

    expect(rpc).toHaveBeenCalledWith('stakeholder_finanzbestand');
    const [url, key, optionen] = createSupabase.mock.calls[0];
    expect(url).toBe('https://x.supabase.co');
    expect(key).toBe('anon');
    expect(optionen.global.headers.Authorization).toBe('Bearer abc');
    expect(optionen.auth.persistSession).toBe(false);
  });

  it('antwortet mit gerechneten Zeilen, ohne Entwuerfe und Testunternehmen, nie gecacht', async () => {
    const { handler } = bauHandler();
    const res = await handler(mitToken());
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.headers['Content-Type']).toBe('application/json');
    expect(res.headers['Server-Timing']).toMatch(/rpc;dur=\d+, rechnen;dur=\d+/);
    expect(body.version).toBe(1);
    expect(body.geladenAm).toBe(1000);
    expect(body.zeilen.map(z => z.id)).toEqual(['a1']);
    expect(body.zeilen[0].volumen_netto).toBe(1000);
    expect(body.monatsauswertung).toBeTruthy();
  });

  it('uebersetzt forbidden der RPC in 403', async () => {
    const { handler } = bauHandler({
      rpcResult: { data: null, error: { code: '42501', message: 'forbidden' } },
    });
    const res = await handler(mitToken());
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).code).toBe('forbidden');
  });

  it('meldet eine fehlende RPC als 501, damit der Client zurueckfaellt', async () => {
    const { handler } = bauHandler({
      rpcResult: { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } },
    });
    const res = await handler(mitToken());
    expect(res.statusCode).toBe(501);
    expect(JSON.parse(res.body).code).toBe('rpc_missing');
  });

  it('meldet ein ungueltiges JWT als 401', async () => {
    const { handler } = bauHandler({
      rpcResult: { data: null, error: { code: 'PGRST301', message: 'JWT expired' } },
    });
    const res = await handler(mitToken());
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).session_dead).toBe(true);
  });

  it('meldet sonstige RPC-Fehler als 502 ohne Interna', async () => {
    const { handler } = bauHandler({
      rpcResult: { data: null, error: { code: 'XX000', message: 'interner Detailtext' } },
    });
    const res = await handler(mitToken());
    expect(res.statusCode).toBe(502);
    expect(res.body).not.toContain('interner Detailtext');
  });

  it('weist eine RPC-Antwort ohne Objekt ab', async () => {
    const { handler } = bauHandler({ rpcResult: { data: [1, 2], error: null } });
    const res = await handler(mitToken());
    expect(res.statusCode).toBe(502);
  });
});
