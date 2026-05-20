import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Konfigurierbarer XHR-Mock mit URL-Pattern-Matching
let responders = []; // [{ match: (url) => bool, handler: (xhr) => void }]
let allRequests = [];

class MockXHR {
  constructor() {
    this.headers = {};
    this.upload = {
      addEventListener: (evt, cb) => {
        if (evt === 'progress') this._progressCb = cb;
      },
    };
    this.status = 0;
    this.responseText = '';
    allRequests.push(this);
  }
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader(k, v) { this.headers[k] = v; }
  send(body) {
    this.body = body;
    queueMicrotask(() => this._dispatch());
  }
  abort() {
    if (this._aborted) return;
    this._aborted = true;
    queueMicrotask(() => this.onabort?.());
  }
  _dispatch() {
    if (this._aborted) return;
    const r = responders.find(r => r.match(this));
    if (!r) {
      this.status = 500;
      this.responseText = 'no responder';
      this.onload?.();
      return;
    }
    r.handler(this);
  }
  _ok(data, status = 200) {
    if (this._aborted) return;
    this.status = status;
    this.responseText = typeof data === 'string' ? data : JSON.stringify(data);
    this.onload?.();
  }
  _fail(status, text = '') {
    if (this._aborted) return;
    this.status = status;
    this.responseText = text;
    this.onload?.();
  }
  _net() {
    if (this._aborted) return;
    this.onerror?.();
  }
}

vi.stubGlobal('XMLHttpRequest', MockXHR);

describe('DropboxDirectUploader', () => {
  let uploadFileDirect;

  beforeEach(async () => {
    responders = [];
    allRequests = [];
    vi.resetModules();
    ({ uploadFileDirect } = await import('../core/DropboxDirectUploader.js'));
  });

  afterEach(() => {
    responders = [];
  });

  it('lädt eine kleine Datei via /upload hoch', async () => {
    responders.push({
      match: (xhr) => xhr.url.endsWith('/files/upload'),
      handler: (xhr) => xhr._ok({ path_display: '/x/small.mp4' }),
    });

    const file = new File([new Uint8Array(1024)], 'small.mp4', { type: 'video/mp4' });
    const result = await uploadFileDirect({
      file, dropboxPath: '/x/small.mp4', token: 'tok-1',
      chunkSize: 8 * 1024 * 1024, allowProxyFallback: false,
    });

    expect(result.path_display).toBe('/x/small.mp4');
    const r = allRequests.find(x => x.url.endsWith('/files/upload'));
    expect(r.headers['Authorization']).toBe('Bearer tok-1');
    expect(r.headers['Dropbox-API-Arg']).toContain('/x/small.mp4');
  });

  it('große Datei (concurrent-session): leerer start, N parallele appends, letzter mit close:true, leerer finish', async () => {
    responders.push({
      match: (xhr) => xhr.url.endsWith('/upload_session/start'),
      handler: (xhr) => xhr._ok({ session_id: 'sess-1' }),
    });
    responders.push({
      match: (xhr) => xhr.url.endsWith('/upload_session/append_v2'),
      handler: (xhr) => xhr._ok({}),
    });
    responders.push({
      match: (xhr) => xhr.url.endsWith('/upload_session/finish'),
      handler: (xhr) => xhr._ok({ path_display: '/x/big.mp4' }),
    });

    // 5 Chunks à 2 KB → 1 leerer start, 5 appends (letzter close:true), 1 leerer finish
    const buf = new Uint8Array(10 * 1024);
    const file = new File([buf], 'big.mp4', { type: 'video/mp4' });

    const progress = [];
    const result = await uploadFileDirect({
      file, dropboxPath: '/x/big.mp4', token: 'tok-1',
      chunkSize: 2 * 1024, concurrency: 2,
      onProgress: (p) => progress.push(p.loaded),
      allowProxyFallback: false,
    });

    expect(result.path_display).toBe('/x/big.mp4');
    const starts = allRequests.filter(r => r.url.endsWith('/upload_session/start'));
    const appends = allRequests.filter(r => r.url.endsWith('/upload_session/append_v2'));
    const finishes = allRequests.filter(r => r.url.endsWith('/upload_session/finish'));
    expect(starts).toHaveLength(1);
    expect(appends).toHaveLength(5);
    expect(finishes).toHaveLength(1);
    // start und finish duerfen keinen Datei-Inhalt tragen
    expect(starts[0].body?.size ?? 0).toBe(0);
    expect(finishes[0].body?.size ?? 0).toBe(0);
    // start muss session_type:concurrent setzen
    expect(starts[0].headers['Dropbox-API-Arg']).toContain('concurrent');
    // finish muss Cursor auf totalSize zeigen
    expect(finishes[0].headers['Dropbox-API-Arg']).toContain('"offset":10240');
    // genau ein Append mit close:true, alle anderen close:false
    const closeFlags = appends.map(a => /"close":(true|false)/.exec(a.headers['Dropbox-API-Arg'])?.[1]);
    expect(closeFlags.filter(c => c === 'true')).toHaveLength(1);
    expect(closeFlags.filter(c => c === 'false')).toHaveLength(4);
    // Der close:true-Append muss derjenige mit Offset 8192 sein (Datei = 5 * 2 KB)
    const closing = appends.find(a => /"close":true/.test(a.headers['Dropbox-API-Arg']));
    expect(closing.headers['Dropbox-API-Arg']).toContain('"offset":8192');
    expect(progress[progress.length - 1]).toBe(10 * 1024);
  });

  it('Datei mit Rest-Chunk: letzter append darf nicht 4-MB-Vielfaches sein, close:true noetig', async () => {
    responders.push({
      match: (xhr) => xhr.url.endsWith('/upload_session/start'),
      handler: (xhr) => xhr._ok({ session_id: 'sess-rest' }),
    });
    responders.push({
      match: (xhr) => xhr.url.endsWith('/upload_session/append_v2'),
      handler: (xhr) => xhr._ok({}),
    });
    responders.push({
      match: (xhr) => xhr.url.endsWith('/upload_session/finish'),
      handler: (xhr) => xhr._ok({ path_display: '/x/rest.mp4' }),
    });

    // 12 KB bei chunkSize 4 KB → 3 volle Chunks, kein Rest
    // Aber 10 KB bei chunkSize 4 KB → 2 volle + 1 Rest (2 KB) als close:true
    const file = new File([new Uint8Array(10 * 1024)], 'rest.mp4');
    await uploadFileDirect({
      file, dropboxPath: '/x/rest.mp4', token: 'tok-1',
      chunkSize: 4 * 1024, concurrency: 4, allowProxyFallback: false,
    });

    const appends = allRequests.filter(r => r.url.endsWith('/upload_session/append_v2'));
    expect(appends).toHaveLength(3);
    const closing = appends.find(a => /"close":true/.test(a.headers['Dropbox-API-Arg']));
    expect(closing).toBeDefined();
    // Rest-Chunk = 2 KB, NICHT 4 KB
    expect(closing.body?.size).toBe(2048);
    // Cursor des close-Append zeigt auf den Offset des Rest-Chunks
    expect(closing.headers['Dropbox-API-Arg']).toContain('"offset":8192');
  });

  it('Retry bei 503, dann Erfolg', async () => {
    let attempts = 0;
    responders.push({
      match: (xhr) => xhr.url.endsWith('/files/upload'),
      handler: (xhr) => {
        attempts++;
        if (attempts === 1) xhr._fail(503, 'srv error');
        else xhr._ok({ path_display: '/x/t.mp4' });
      },
    });

    const file = new File([new Uint8Array(100)], 't.mp4');
    const result = await uploadFileDirect({
      file, dropboxPath: '/x/t.mp4', token: 'tok-1',
      chunkSize: 8 * 1024 * 1024, allowProxyFallback: false,
    });
    expect(result.path_display).toBe('/x/t.mp4');
    expect(attempts).toBe(2);
  }, 15000);

  it('AbortSignal bricht den Upload sofort ab', async () => {
    // Responder, der nichts beantwortet (Request hängt) → Abort muss greifen
    responders.push({
      match: () => true,
      handler: () => { /* hängt */ },
    });

    const ctrl = new AbortController();
    queueMicrotask(() => ctrl.abort());

    const file = new File([new Uint8Array(100)], 't.mp4');
    await expect(uploadFileDirect({
      file, dropboxPath: '/x/t.mp4', token: 'tok-1',
      signal: ctrl.signal, allowProxyFallback: false,
    })).rejects.toThrow(/Abort/);
  });

  it('401 löst Token-Refresh aus, dann Erfolg', async () => {
    let attempts = 0;
    let tokenUsed = null;
    responders.push({
      match: (xhr) => xhr.url.endsWith('/files/upload'),
      handler: (xhr) => {
        attempts++;
        tokenUsed = xhr.headers['Authorization'];
        if (attempts === 1) xhr._fail(401, 'expired');
        else xhr._ok({ path_display: '/x/t.mp4' });
      },
    });

    const file = new File([new Uint8Array(100)], 't.mp4');
    const result = await uploadFileDirect({
      file, dropboxPath: '/x/t.mp4', token: 'tok-old',
      getToken: async () => 'tok-new',
      chunkSize: 8 * 1024 * 1024, allowProxyFallback: false,
    });
    expect(result.path_display).toBe('/x/t.mp4');
    expect(tokenUsed).toBe('Bearer tok-new');
    expect(attempts).toBe(2);
  });
});
