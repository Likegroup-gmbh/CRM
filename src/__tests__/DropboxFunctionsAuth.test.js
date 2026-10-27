import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

// Alle Dropbox-/Migrations-Functions pruefen den Login wie anschreiben-send:
// ohne Token 401, Kunde 403, Admin/Mitarbeiter kommt durch. dropbox-proxy laesst
// Kunden/Gaeste nur Lese-Links fuer Dateien holen, die sie per RLS sehen.

const require = createRequire(import.meta.url);

// Fake-Supabase: Token -> Benutzer, JWT -> sichtbare Assets (RLS-Ersatz)
const USERS = {
  'tok-staff': { id: 'u-staff', rolle: 'mitarbeiter' },
  'tok-admin': { id: 'u-admin', rolle: 'admin' },
  'tok-kunde': { id: 'u-kunde', rolle: 'kunde' },
};
const SICHTBAR = {
  'tok-kunde': { '/Firma/Kampagne/video.mp4': 'kooperation_video_asset' },
  'gast-jwt': { '/Firma/Kampagne/video.mp4': 'kooperation_video_asset' },
};
const getUser = vi.fn(async (token) => (
  USERS[token]
    ? { data: { user: { id: USERS[token].id } }, error: null }
    : { data: { user: null }, error: { status: 401, code: 'bad_jwt', message: 'bad jwt' } }
));

function fakeCreateClient(url, key, options) {
  const jwt = String(options?.global?.headers?.Authorization || '').replace(/^Bearer\s+/i, '');
  return {
    auth: { getUser },
    from(table) {
      const filters = {};
      const chain = {
        select: () => chain,
        eq: (col, val) => { filters[col] = val; return chain; },
        limit: () => chain,
        maybeSingle: async () => {
          const u = Object.values(USERS).find((x) => x.id === filters.auth_user_id);
          return { data: u ? { id: `b-${u.id}`, rolle: u.rolle } : null, error: null };
        },
        then: (resolve) => resolve({
          data: SICHTBAR[jwt]?.[filters.file_path] === table ? [{ id: 1 }] : [],
          error: null,
        }),
      };
      return chain;
    },
  };
}

let handlers;
let verifyAuth;

beforeAll(() => {
  process.env.SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_SERVICE_KEY = 'service';
  process.env.VITE_SUPABASE_ANON_KEY = 'anon';
  process.env.DROPBOX_REFRESH_TOKEN = 'refresh-token';
  process.env.DROPBOX_APP_KEY = 'key';
  process.env.DROPBOX_APP_SECRET = 'secret';

  // supabase-js vor dem ersten Laden von verify-auth austauschen
  const supabasePath = require.resolve('@supabase/supabase-js');
  require.cache[supabasePath] = {
    id: supabasePath,
    filename: supabasePath,
    loaded: true,
    exports: { createClient: fakeCreateClient },
  };

  verifyAuth = require('../../netlify/functions/_shared/verify-auth.js');
  const laden = (name) => require(`../../netlify/functions/${name}.js`).handler;
  handlers = {
    delete: laden('dropbox-delete'),
    deleteVertrag: laden('dropbox-delete-vertrag'),
    cascade: laden('dropbox-delete-cascade'),
    backfill: laden('backfill-thumbnails'),
    proxy: laden('dropbox-proxy'),
    uploads: [
      'dropbox-upload', 'dropbox-upload-auftragsbestaetigung', 'dropbox-upload-bilder',
      'dropbox-upload-custom', 'dropbox-upload-rechnung', 'dropbox-upload-rohmaterial',
      'dropbox-upload-storys', 'dropbox-upload-vertrag',
    ].map((name) => [name, laden(name)]),
    migrations: ['migrate-uploads-to-dropbox', 'migrate-edeka-kampagne-dropbox']
      .map((name) => [name, laden(name)]),
  };
});

const dropboxFetch = vi.fn();

beforeEach(() => {
  verifyAuth._clearStaffCache();
  getUser.mockClear();
  dropboxFetch.mockReset();
  dropboxFetch.mockImplementation(async (url) => {
    if (String(url).includes('oauth2/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'x'.repeat(30), expires_in: 14400 }) };
    }
    if (String(url).includes('get_temporary_link')) {
      return { ok: true, status: 200, json: async () => ({ link: 'https://dl.example/video' }) };
    }
    return { ok: true, status: 200, text: async () => '', json: async () => ({}) };
  });
  vi.stubGlobal('fetch', dropboxFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const event = (token, body = {}, method = 'POST') => ({
  httpMethod: method,
  headers: token ? { authorization: `Bearer ${token}` } : {},
  body: JSON.stringify(body),
});

/** Dropbox-API-Aufrufe (ohne Token-Refresh) */
const dropboxCalls = () => dropboxFetch.mock.calls.filter(([url]) => !String(url).includes('oauth2/token'));

describe('Login-Pflicht auf allen Dropbox-/Migrations-Functions', () => {
  const alle = () => [
    ['dropbox-delete', handlers.delete],
    ['dropbox-delete-vertrag', handlers.deleteVertrag],
    ['dropbox-delete-cascade', handlers.cascade],
    ['backfill-thumbnails', handlers.backfill],
    ['dropbox-proxy', handlers.proxy],
    ...handlers.uploads,
    ...handlers.migrations,
  ];

  it('lehnt Aufrufe ohne Token mit 401 ab, ohne Dropbox anzufassen', async () => {
    for (const [name, handler] of alle()) {
      const res = await handler(event(null, { filePath: '/a/b.mp4', entityType: 'video', entityId: 'x', action: 'upload-small' }));
      expect(res.statusCode, name).toBe(401);
      expect(JSON.parse(res.body).session_dead, name).toBe(true);
    }
    expect(dropboxFetch).not.toHaveBeenCalled();
  });

  it('lehnt ungueltige Tokens mit 401 ab', async () => {
    for (const [name, handler] of alle()) {
      const res = await handler(event('kaputt', { filePath: '/a/b.mp4' }));
      expect(res.statusCode, name).toBe(401);
    }
    expect(dropboxFetch).not.toHaveBeenCalled();
  });

  it('lehnt Kunden mit 403 ab', async () => {
    for (const [name, handler] of alle()) {
      const res = await handler(event('tok-kunde', { filePath: '/a/b.mp4', entityType: 'video', entityId: 'x', action: 'upload-small' }));
      expect(res.statusCode, name).toBe(403);
    }
    expect(dropboxFetch).not.toHaveBeenCalled();
  });

  it('laesst Admin und Mitarbeiter bei den Upload-Vorbereitungen durch (kein 401/403)', async () => {
    for (const token of ['tok-staff', 'tok-admin']) {
      for (const [name, handler] of handlers.uploads) {
        const res = await handler(event(token, { unternehmen: 'Firma', fileName: 'a.mp4' }));
        expect([401, 403], `${name} / ${token}`).not.toContain(res.statusCode);
      }
    }
  });

  it('Preflight (OPTIONS) und falsche Methoden brauchen keinen Login', async () => {
    const opt = await handlers.delete({ httpMethod: 'OPTIONS', headers: {} });
    expect(opt.statusCode).toBe(204);
    const get = await handlers.delete({ httpMethod: 'GET', headers: {} });
    expect(get.statusCode).toBe(405);
  });

  it('Allow-Origin * ist weg, Authorization ist erlaubter Header', async () => {
    const res = await handlers.delete({ httpMethod: 'OPTIONS', headers: {} });
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(res.headers['Access-Control-Allow-Headers']).toContain('Authorization');
  });
});

describe('requireStaff Cache', () => {
  it('fragt GoTrue pro Token nur einmal, auch bei mehreren Aufrufen', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await handlers.delete(event('tok-staff', { filePath: '/a/b.mp4' }));
      expect(res.statusCode).toBe(200);
    }
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('cached keine Ablehnungen', async () => {
    await handlers.delete(event('tok-kunde', { filePath: '/a/b.mp4' }));
    await handlers.delete(event('tok-kunde', { filePath: '/a/b.mp4' }));
    expect(getUser).toHaveBeenCalledTimes(2);
  });
});

describe('dropbox-delete / dropbox-delete-vertrag', () => {
  it('loescht fuer Staff den uebergebenen Pfad', async () => {
    const res = await handlers.delete(event('tok-staff', { filePath: '/Firma/Kampagne/video.mp4' }));
    expect(res.statusCode).toBe(200);
    const [url, opts] = dropboxCalls()[0];
    expect(url).toContain('files/delete_v2');
    expect(JSON.parse(opts.body)).toEqual({ path: '/Firma/Kampagne/video.mp4' });
  });

  it.each([
    ['Wurzel', '/'],
    ['relativer Pfad', 'Firma/video.mp4'],
    ['Parent-Traversal', '/Firma/../Anderer/video.mp4'],
    ['Nicht-String', 42],
    ['Steuerzeichen', '/Firma/\u0000x'],
  ])('lehnt %s mit 400 ab, ohne Dropbox aufzurufen', async (_label, filePath) => {
    for (const handler of [handlers.delete, handlers.deleteVertrag]) {
      const res = await handler(event('tok-staff', { filePath }));
      expect(res.statusCode).toBe(400);
    }
    expect(dropboxFetch).not.toHaveBeenCalled();
  });

  it('erlaubt auch Ordnerpfade (Bilder-Wurzelordner)', async () => {
    const res = await handlers.delete(event('tok-staff', { filePath: '/Firma/Kampagne/Koop/Bilder' }));
    expect(res.statusCode).toBe(200);
  });
});

describe('dropbox-delete-cascade', () => {
  it('lehnt eine Nicht-UUID als entityId mit 400 ab', async () => {
    const res = await handlers.cascade(event('tok-staff', { entityType: 'kampagne', entityId: "x' or 1=1" }));
    expect(res.statusCode).toBe(400);
    expect(dropboxFetch).not.toHaveBeenCalled();
  });
});

describe('dropbox-proxy', () => {
  const sichtbarerPfad = '/Firma/Kampagne/video.mp4';

  it('Kunde darf nicht schreiben (upload-small, session-*, move, diagnose)', async () => {
    for (const action of ['upload-small', 'session-start', 'session-append', 'session-finish', 'move', 'diagnose']) {
      const res = await handlers.proxy(event('tok-kunde', { action, path: sichtbarerPfad }));
      expect(res.statusCode, action).toBe(403);
    }
    expect(dropboxFetch).not.toHaveBeenCalled();
  });

  it('Kunde bekommt temporary-link und shared-link fuer ein Asset, das er sehen darf', async () => {
    const res = await handlers.proxy(event('tok-kunde', { action: 'temporary-link', path: sichtbarerPfad }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).link).toBe('https://dl.example/video');

    const shared = await handlers.proxy(event('tok-kunde', { action: 'shared-link', path: sichtbarerPfad }));
    expect(shared.statusCode).toBe(200);
  });

  it('Gast mit Gast-JWT (kein Auth-User) bekommt den Link ebenfalls', async () => {
    const res = await handlers.proxy(event('gast-jwt', { action: 'temporary-link', path: sichtbarerPfad }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).link).toBe('https://dl.example/video');
  });

  it('Kunde und Gast bekommen keinen Link fuer fremde Pfade (403)', async () => {
    for (const token of ['tok-kunde', 'gast-jwt']) {
      const res = await handlers.proxy(event(token, { action: 'temporary-link', path: '/Andere/Firma/geheim.mp4' }));
      expect(res.statusCode, token).toBe(403);
    }
    expect(dropboxCalls()).toHaveLength(0);
  });

  it('lehnt unsichere Pfade fuer Nicht-Staff mit 400 ab', async () => {
    const res = await handlers.proxy(event('tok-kunde', { action: 'temporary-link', path: '/Firma/../geheim.mp4' }));
    expect(res.statusCode).toBe(400);
  });

  it('Nicht-Staff nutzt nie ein mitgeschicktes Dropbox-Token', async () => {
    await handlers.proxy(event('tok-kunde', { action: 'temporary-link', path: sichtbarerPfad, token: 'fremdes-token' }));
    const [, opts] = dropboxCalls()[0];
    expect(opts.headers.Authorization).not.toContain('fremdes-token');
  });

  it('Staff darf Links fuer beliebige Pfade holen und nutzt dabei das mitgeschickte Token', async () => {
    const res = await handlers.proxy(event('tok-staff', { action: 'temporary-link', path: '/Neuer/Ordner/datei.mp4', token: 'client-token' }));
    expect(res.statusCode).toBe(200);
    const [, opts] = dropboxCalls()[0];
    expect(opts.headers.Authorization).toBe('Bearer client-token');
  });

  it('Staff darf schreiben (move)', async () => {
    dropboxFetch.mockImplementation(async () => ({
      ok: true, status: 200, json: async () => ({ metadata: { path_display: '/neu/pfad' } }),
    }));
    const res = await handlers.proxy(event('tok-staff', { action: 'move', fromPath: '/a', toPath: '/neu/pfad', token: 'client-token' }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).path).toBe('/neu/pfad');
  });
});

describe('canReadAssetPath', () => {
  it('prueft alle Asset-Tabellen und meldet Konfigurationsfehler', async () => {
    const { canReadAssetPath, ASSET_TABLES } = require('../../netlify/functions/_shared/dropbox-read-access.js');
    const gefragt = [];
    const clientFactory = () => ({
      from(table) {
        gefragt.push(table);
        const chain = { select: () => chain, eq: () => chain, limit: () => chain, then: (r) => r({ data: [], error: null }) };
        return chain;
      },
    });
    const res = await canReadAssetPath(event('tok-kunde'), '/a/b.mp4', { clientFactory });
    expect(res).toMatchObject({ ok: false, status: 403 });
    expect(gefragt).toEqual(ASSET_TABLES);

    const keinClient = await canReadAssetPath(event('tok-kunde'), '/a/b.mp4', { clientFactory: () => null });
    expect(keinClient).toMatchObject({ ok: false, status: 500 });
  });

  it('ueberspringt Tabellen mit Fehler und findet das Asset in der naechsten', async () => {
    const { canReadAssetPath } = require('../../netlify/functions/_shared/dropbox-read-access.js');
    let n = 0;
    const clientFactory = () => ({
      from() {
        n += 1;
        const result = n === 1 ? { data: null, error: { message: 'relation missing' } } : { data: [{ id: 1 }], error: null };
        const chain = { select: () => chain, eq: () => chain, limit: () => chain, then: (r) => r(result) };
        return chain;
      },
    });
    const res = await canReadAssetPath(event('tok-kunde'), '/a/b.mp4', { clientFactory });
    expect(res.ok).toBe(true);
  });
});
