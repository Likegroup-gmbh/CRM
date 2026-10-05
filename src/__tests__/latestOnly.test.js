import { describe, it, expect } from 'vitest';
import { createLatestOnly, STALE } from '../core/list/latestOnly.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('latestOnly', () => {
  it('liefert den Wert des einzigen Requests', async () => {
    const latest = createLatestOnly();
    const req = latest.start();
    expect(await req.resolve(Promise.resolve(42))).toBe(42);
    expect(req.isCurrent()).toBe(true);
  });

  it('akzeptiert auch Nicht-Promises', async () => {
    const latest = createLatestOnly();
    expect(await latest.start().resolve('x')).toBe('x');
  });

  it('veralteter Request liefert STALE, der neueste den Wert', async () => {
    const latest = createLatestOnly();
    const a = deferred();
    const b = deferred();
    const reqA = latest.start();
    const pA = reqA.resolve(a.promise);
    const reqB = latest.start();
    const pB = reqB.resolve(b.promise);

    expect(reqA.isCurrent()).toBe(false);
    expect(reqB.isCurrent()).toBe(true);

    b.resolve('B');
    a.resolve('A');
    expect(await pB).toBe('B');
    expect(await pA).toBe(STALE);
  });

  it('Reihenfolge der Auflösung ist egal', async () => {
    const latest = createLatestOnly();
    const a = deferred();
    const b = deferred();
    const pA = latest.start().resolve(a.promise);
    const pB = latest.start().resolve(b.promise);

    a.resolve('A');
    expect(await pA).toBe(STALE);
    b.resolve('B');
    expect(await pB).toBe('B');
  });

  it('Fehler des aktuellen Requests werden weitergereicht', async () => {
    const latest = createLatestOnly();
    const d = deferred();
    const p = latest.start().resolve(d.promise);
    d.reject(new Error('boom'));
    await expect(p).rejects.toThrow('boom');
  });

  it('Fehler veralteter Requests werden verschluckt', async () => {
    const latest = createLatestOnly();
    const a = deferred();
    const pA = latest.start().resolve(a.promise);
    latest.start();
    a.reject(new Error('alt'));
    expect(await pA).toBe(STALE);
  });

  it('ein Request wird durch jeden späteren ungültig, nicht nur den direkten Nachfolger', () => {
    const latest = createLatestOnly();
    const r1 = latest.start();
    const r2 = latest.start();
    const r3 = latest.start();
    expect(r1.isCurrent()).toBe(false);
    expect(r2.isCurrent()).toBe(false);
    expect(r3.isCurrent()).toBe(true);
  });

  it('Instanzen sind unabhängig', async () => {
    const one = createLatestOnly();
    const two = createLatestOnly();
    const r1 = one.start();
    two.start();
    expect(r1.isCurrent()).toBe(true);
    expect(await r1.resolve('x')).toBe('x');
  });

  it('run() startet einen Request und reicht ihn an fn', async () => {
    const latest = createLatestOnly();
    let seen;
    const result = await latest.run((req) => { seen = req; return Promise.resolve(7); });
    expect(result).toBe(7);
    expect(seen.isCurrent()).toBe(true);
  });

  it('run(): überholter Aufruf liefert STALE', async () => {
    const latest = createLatestOnly();
    const a = deferred();
    const pA = latest.run(() => a.promise);
    await latest.run(() => Promise.resolve('B'));
    a.resolve('A');
    expect(await pA).toBe(STALE);
  });
});
