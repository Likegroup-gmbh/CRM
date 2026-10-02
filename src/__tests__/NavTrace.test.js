import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildTrace, createNavTrace } from '../core/dev/navTrace.js';

function uhr(start = 0) {
  let t = start;
  const fn = () => t;
  fn.set = (v) => { t = v; };
  return fn;
}

function fakeResponse(bytes, status = 200) {
  const body = new Uint8Array(bytes);
  const make = () => ({
    status,
    clone: () => make(),
    arrayBuffer: async () => body.buffer.slice(0),
  });
  return make();
}

describe('buildTrace', () => {
  it('ordnet Marken, vergibt negative Zeiten vor nav:start', () => {
    const trace = buildTrace({
      marks: [
        { name: 'render:done', t: 1500 },
        { name: 'prefetch:start', t: 400 },
        { name: 'nav:start', t: 1000 },
        { name: 'skeleton:shown', t: 1120 },
      ],
      requests: [],
      navStart: 1000,
      endAt: 1500,
    });
    expect(trace.phases).toEqual([
      { phase: 'prefetch:start', 't (ms)': -600, 'Delta (ms)': 0 },
      { phase: 'nav:start', 't (ms)': 0, 'Delta (ms)': 600 },
      { phase: 'skeleton:shown', 't (ms)': 120, 'Delta (ms)': 120 },
      { phase: 'render:done', 't (ms)': 500, 'Delta (ms)': 380 },
    ]);
    expect(trace.totalMs).toBe(500);
  });

  it('ueberspringt fehlende Marken statt Luecken zu erfinden', () => {
    const trace = buildTrace({
      marks: [{ name: 'nav:start', t: 10 }, { name: 'render:done', t: 30 }],
      requests: [],
      navStart: 10,
      endAt: 30,
    });
    expect(trace.phases.map((p) => p.phase)).toEqual(['nav:start', 'render:done']);
  });

  it('rechnet Header, Body, KB und KB/s je Request', () => {
    const trace = buildTrace({
      marks: [],
      requests: [{
        name: '/rest/v1/rpc/x', status: 200, start: 100,
        headersAt: 1363, bodyEndAt: 4363, bytes: 2048 * 1024,
      }],
      navStart: 100,
      endAt: 5000,
    });
    expect(trace.requests[0]).toMatchObject({
      request: '/rest/v1/rpc/x',
      'start (ms)': 0,
      'Header (ms)': 1263,
      'Body (ms)': 3000,
      KB: 2048,
      'KB/s': 683,
    });
  });

  it('zeigt offene Requests ohne Body mit Strich', () => {
    const trace = buildTrace({
      marks: [],
      requests: [{ name: '/a', start: 0, headersAt: 50, bodyEndAt: null, bytes: null }],
      navStart: 0,
      endAt: 100,
    });
    expect(trace.requests[0]).toMatchObject({ 'Header (ms)': 50, 'Body (ms)': '—', KB: '—', 'KB/s': '—' });
  });

  it('summiert nur Long-Tasks im Fenster', () => {
    const trace = buildTrace({
      marks: [],
      requests: [],
      longTasks: [{ start: 5, duration: 99 }, { start: 20, duration: 60 }, { start: 40, duration: 40 }],
      navStart: 10,
      endAt: 50,
    });
    expect(trace.longTasks).toEqual({ count: 2, ms: 100 });
  });
});

describe('createNavTrace', () => {
  afterEach(() => vi.useRealTimers());

  it('inaktiv: navMark tut nichts, tracedFetch gibt den Fetch unveraendert zurueck', () => {
    const print = vi.fn();
    const nav = createNavTrace({ active: () => false, print });
    const base = vi.fn();
    expect(nav.tracedFetch(base)).toBe(base);
    nav.navMark('nav:start');
    nav.navMark('render:done');
    expect(print).not.toHaveBeenCalled();
    expect(nav.last()).toBeNull();
  });

  it('gibt die Spur bei render:done aus, inkl. Marken vor nav:start', () => {
    const now = uhr(100);
    const print = vi.fn();
    const nav = createNavTrace({ active: () => true, now, print, route: () => '/admin' });
    nav.navMark('prefetch:start');
    now.set(500);
    nav.navMark('nav:start');
    now.set(900);
    nav.navMark('render:done');

    expect(print).toHaveBeenCalledTimes(1);
    const trace = print.mock.calls[0][0];
    expect(trace.route).toBe('/admin');
    expect(trace.ende).toBe('render:done');
    expect(trace.phases.map((p) => [p.phase, p['t (ms)']])).toEqual([
      ['prefetch:start', -400],
      ['nav:start', 0],
      ['render:done', 400],
    ]);
  });

  it('tracedFetch misst Header-Zeit, Body-Zeit und Bytes', async () => {
    const now = uhr(0);
    const print = vi.fn();
    const nav = createNavTrace({ active: () => true, now, print });
    const base = vi.fn(async () => {
      now.set(80);
      return fakeResponse(4096);
    });
    const traced = nav.tracedFetch(base);

    now.set(10);
    nav.navMark('nav:start');
    const res = await traced('https://x.supabase.co/rest/v1/rpc/stakeholder_finanzbestand');
    expect(res.status).toBe(200);
    now.set(130);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    nav.navMark('render:done');

    const [row] = print.mock.calls[0][0].requests;
    expect(row.request).toBe('/rest/v1/rpc/stakeholder_finanzbestand');
    expect(row['Header (ms)']).toBe(70);
    expect(row.KB).toBe(4);
  });

  it('Storage-Downloads werden nicht geklont', async () => {
    const nav = createNavTrace({ active: () => true, now: uhr(0), print: vi.fn() });
    const res = fakeResponse(10);
    const clone = vi.spyOn(res, 'clone');
    await nav.tracedFetch(async () => res)('https://x.supabase.co/storage/v1/object/a.png');
    expect(clone).not.toHaveBeenCalled();
  });

  it('Fallback: ohne render:done erscheint die Spur nach 10 s', () => {
    vi.useFakeTimers();
    const print = vi.fn();
    const nav = createNavTrace({ active: () => true, now: () => performance.now(), print });
    nav.navMark('nav:start');
    vi.advanceTimersByTime(9999);
    expect(print).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(print).toHaveBeenCalledTimes(1);
    expect(print.mock.calls[0][0].ende).toBe('timeout');
  });

  it('ein neuer nav:start verwirft die noch offene Spur', () => {
    vi.useFakeTimers();
    const print = vi.fn();
    const nav = createNavTrace({ active: () => true, now: () => performance.now(), print });
    nav.navMark('nav:start');
    nav.navMark('nav:start');
    nav.navMark('render:done');
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('die zweite Spur enthaelt nichts aus der ersten', () => {
    const now = uhr(0);
    const print = vi.fn();
    const nav = createNavTrace({ active: () => true, now, print });
    now.set(10); nav.navMark('nav:start');
    now.set(20); nav.navMark('render:done');
    now.set(30); nav.navMark('nav:start');
    now.set(40); nav.navMark('render:done');
    const zweite = print.mock.calls[1][0];
    expect(zweite.phases.map((p) => p['t (ms)'])).toEqual([0, 10]);
  });
});
