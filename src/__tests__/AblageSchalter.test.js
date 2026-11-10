import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';
import schalterDatei from '../core/ablage/schalter.json';

const require = createRequire(import.meta.url);
const { dropboxUpload } = require('../../netlify/functions/_shared/ablage/schalter.js');
const { istKonfiguriert } = require('../../netlify/functions/_shared/ablage/konfig.js');
const { createSchreiben } = require('../../netlify/functions/_shared/ablage/schreiben.js');
const { createCreatorAblage } = require('../../netlify/functions/_shared/ablage/creator.js');

const server = vi.hoisted(() => ({ calls: [] }));

vi.mock('../core/auth/getAccessToken.js', () => ({
  authorizedFetch: vi.fn(async (url, opts) => {
    server.calls.push({ fn: String(url).split('/').pop(), body: JSON.parse(opts.body) });
    return { ok: true, status: 200, json: async () => ({ ziel: 'sharepoint', upload_id: 'up1', upload_url: 'https://graph.example/s' }) };
  }),
}));

const KONFIG = { tenantId: 't', clientId: 'c', siteUrl: 'https://x.sharepoint.com/sites/m', host: 'x.sharepoint.com', siteId: 's1', driveId: 'd1' };
const ZIEL_BODY = { typ: 'video', kooperation_id: 'k1', kooperation_video_id: 'v1', file_name: 'a.mp4', file_size: 10 };

// Jeder Zugriff auf die DB ist ein Fehler: mit Schalter an gibt es auf Live keine ablage-Spalten
const keineDb = new Proxy({}, { get: (_, prop) => { throw new Error(`DB angefasst: ${String(prop)}`); } });

async function client(wert) {
  vi.stubEnv('VITE_DROPBOX_UPLOAD', wert);
  vi.resetModules();
  server.calls = [];
  return {
    ...(await import('../core/ablage/schalter.js')),
    ...(await import('../core/ablage/ablageLink.js')),
    ...(await import('../core/ablage/ablageUpload.js')),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Schalter an (Dropbox-Upload)', () => {
  it('ablageZielHolen fragt den Server nicht', async () => {
    const { DROPBOX_UPLOAD, ablageZielHolen } = await client('on');
    expect(DROPBOX_UPLOAD).toBe(true);
    await expect(ablageZielHolen(ZIEL_BODY)).resolves.toEqual({ ziel: 'dropbox' });
    expect(server.calls).toEqual([]);
  });

  it('mitAblage lässt die Ablage-Spalten weg', async () => {
    const { mitAblage } = await client('on');
    expect(mitAblage('id, file_path, created_at')).toBe('id, file_path, created_at');
    expect(mitAblage('id, file_path', 'ablage, etag')).toBe('id, file_path');
  });

  it('Server: SharePoint gilt als nicht konfiguriert', () => {
    vi.stubEnv('VITE_DROPBOX_UPLOAD', 'on');
    expect(dropboxUpload()).toBe(true);
    expect(istKonfiguriert(KONFIG)).toBe(false);
  });

  it('Server: uploadZiel und Creator-Start antworten dropbox, ohne die DB zu lesen', async () => {
    vi.stubEnv('VITE_DROPBOX_UPLOAD', 'on');
    const s = createSchreiben({ supabase: keineDb, ablage: null });
    await expect(s.uploadZiel({ benutzer: { id: 'b1', rolle: 'mitarbeiter' }, caller: keineDb, body: ZIEL_BODY }))
      .resolves.toEqual({ ziel: 'dropbox' });
    const c = createCreatorAblage({ supabase: keineDb, ablage: null });
    await expect(c.start({ token: 'a'.repeat(64), targetType: 'video', targetId: 'v1', fileName: 'a.mp4', fileSize: 10 }))
      .resolves.toEqual({ ziel: 'dropbox' });
  });
});

describe('Schalter aus (SharePoint-Weg)', () => {
  it('ablageZielHolen fragt ablage-upload-ziel', async () => {
    const { DROPBOX_UPLOAD, ablageZielHolen } = await client('off');
    expect(DROPBOX_UPLOAD).toBe(false);
    await expect(ablageZielHolen(ZIEL_BODY)).resolves.toMatchObject({ ziel: 'sharepoint' });
    expect(server.calls).toEqual([{ fn: 'ablage-upload-ziel', body: ZIEL_BODY }]);
  });

  it('mitAblage hängt die Ablage-Spalten an', async () => {
    const { mitAblage, ABLAGE_SELECT } = await client('off');
    expect(mitAblage('id, created_at')).toBe(`id, created_at, ${ABLAGE_SELECT}`);
    expect(mitAblage('id', 'ablage')).toBe('id, ablage');
  });

  it('Server: vollständige Konfiguration zählt wieder', () => {
    vi.stubEnv('VITE_DROPBOX_UPLOAD', 'off');
    expect(dropboxUpload()).toBe(false);
    expect(istKonfiguriert(KONFIG)).toBe(true);
  });
});

describe('ohne Env gilt schalter.json', () => {
  it('Client und Server lesen denselben Wert', async () => {
    const { DROPBOX_UPLOAD } = await client('');
    expect(DROPBOX_UPLOAD).toBe(schalterDatei.dropboxUpload !== false);
    expect(dropboxUpload()).toBe(DROPBOX_UPLOAD);
  });

  it('Env schlägt die Datei, Groß-/Kleinschreibung egal', () => {
    expect(dropboxUpload({ VITE_DROPBOX_UPLOAD: 'ON' })).toBe(true);
    expect(dropboxUpload({ VITE_DROPBOX_UPLOAD: 'Off' })).toBe(false);
    expect(dropboxUpload({})).toBe(schalterDatei.dropboxUpload !== false);
  });
});
