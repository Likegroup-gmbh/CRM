// SmokeMagicLink.test.js
// Prueflogik des Magic-Link-Smoke-Tests (scripts/smoke-magic-link.cjs).
// Stellt den Ausfall vom 27.10.2026 nach: DB sperrt magic_links fuer anon, die live
// ausgelieferte Seite liest die Tabelle noch direkt.

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  checkHtml,
  checkEntryBundle,
  extractSupabaseConfig,
  checkRpcResponse,
  checkTableClosed,
} = require('../../scripts/smoke/magic-link-checks.cjs');

const HTML_OK = '<html><script type="module" crossorigin src="/assets/magicRegister-abc.js"></script><body></body></html>';
const FAKE_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJlMTIzNDU2';

describe('checkHtml', () => {
  it('akzeptiert die ausgelieferte Seite', () => {
    expect(checkHtml(HTML_OK)).toEqual([]);
  });

  it('erkennt rohes ${icon()} (Fehlericon wurde als Text angezeigt)', () => {
    const html = `${HTML_OK}<div>\${icon('exclamation-circle')}</div>`;
    expect(checkHtml(html)).toHaveLength(1);
  });

  it('erkennt fehlendes Modul-Script', () => {
    expect(checkHtml('<html><body></body></html>')).toHaveLength(1);
  });
});

describe('checkEntryBundle', () => {
  it('akzeptiert Bundle mit RPC und ohne Tabellenzugriff', () => {
    const js = 'const r = await s.rpc("magic_link_vorschau",{p_token:t});';
    expect(checkEntryBundle(js)).toEqual([]);
  });

  it('erkennt den alten Stand vom 27.10.: Direktzugriff auf magic_links, kein RPC', () => {
    const alt = 'const {data}=await s.from("magic_links").select("*").eq("token",t).single();';
    const fehler = checkEntryBundle(alt);
    expect(fehler).toHaveLength(2);
    expect(fehler.join(' ')).toMatch(/magic_link_vorschau/);
    expect(fehler.join(' ')).toMatch(/406/);
  });

  it('erkennt Direktzugriff auch mit einfachen Anfuehrungszeichen', () => {
    const js = "rpc('magic_link_vorschau'); s.from('magic_links')";
    expect(checkEntryBundle(js)).toHaveLength(1);
  });
});

describe('extractSupabaseConfig', () => {
  it('liest URL und Anon-Key aus den Bundles', () => {
    const bundles = ['x', `const u="https://yktycclozgsgaasduyol.supabase.co",k="${FAKE_JWT}";`];
    expect(extractSupabaseConfig(bundles)).toEqual({
      url: 'https://yktycclozgsgaasduyol.supabase.co',
      anonKey: FAKE_JWT,
    });
  });

  it('liefert null, wenn nichts gefunden wird', () => {
    expect(extractSupabaseConfig(['nichts'])).toEqual({ url: null, anonKey: null });
  });
});

describe('checkRpcResponse', () => {
  it('akzeptiert die Antwort auf einen unbekannten Token', () => {
    expect(checkRpcResponse(200, { valid: false, error: 'not_found' })).toEqual([]);
  });

  it('meldet fehlende oder gesperrte Funktion (404/401/403)', () => {
    for (const status of [404, 401, 403]) {
      expect(checkRpcResponse(status, { message: 'x' })).toHaveLength(1);
    }
  });

  it('meldet unerwartete Antwortform', () => {
    expect(checkRpcResponse(200, { valid: true })).toHaveLength(1);
    expect(checkRpcResponse(200, null)).toHaveLength(1);
  });
});

describe('checkTableClosed', () => {
  it('akzeptiert leere Liste und 4xx', () => {
    expect(checkTableClosed(200, [])).toEqual([]);
    expect(checkTableClosed(401, { message: 'denied' })).toEqual([]);
    expect(checkTableClosed(406, null)).toEqual([]);
  });

  it('meldet Zeilen als Token-Leck', () => {
    expect(checkTableClosed(200, [{ id: 'x' }])).toHaveLength(1);
  });

  it('meldet Serverfehler', () => {
    expect(checkTableClosed(500, null)).toHaveLength(1);
  });
});
