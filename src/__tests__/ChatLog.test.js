// ChatLog.test.js
// Follow-State und Pin. CSS-Anker (margin-top:auto) hat jsdom nicht.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { isNearEnd, scrollToEnd, bindChatLog } from '../core/chat/chatLog.js';

function fakeLog({ scrollHeight = 400, clientHeight = 200, scrollTop = 0 } = {}) {
  const el = document.createElement('div');
  el._sh = scrollHeight;
  el._ch = clientHeight;
  el._st = scrollTop;
  Object.defineProperties(el, {
    scrollHeight: { get: () => el._sh, configurable: true },
    clientHeight: { get: () => el._ch, configurable: true },
    scrollTop: {
      get: () => el._st,
      set: (v) => { el._st = v; },
      configurable: true
    }
  });
  return el;
}

describe('isNearEnd', () => {
  it('true wenn Rest unter der Schwelle, sonst false', () => {
    expect(isNearEnd(fakeLog({ scrollHeight: 400, clientHeight: 200, scrollTop: 200 }))).toBe(true);
    expect(isNearEnd(fakeLog({ scrollHeight: 400, clientHeight: 200, scrollTop: 150 }))).toBe(true);
    expect(isNearEnd(fakeLog({ scrollHeight: 400, clientHeight: 200, scrollTop: 100 }))).toBe(false);
  });

  it('ohne Element false', () => {
    expect(isNearEnd(null)).toBe(false);
  });
});

describe('scrollToEnd', () => {
  it('setzt scrollTop auf scrollHeight', () => {
    const el = fakeLog({ scrollHeight: 500, scrollTop: 10 });
    scrollToEnd(el);
    expect(el.scrollTop).toBe(500);
  });

  it('ohne Element no-op', () => {
    expect(() => scrollToEnd(null)).not.toThrow();
  });
});

describe('bindChatLog', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ohne Element bleibt pin ein No-Op', () => {
    const log = bindChatLog(null);
    expect(log.isFollowing()).toBe(false);
    expect(() => log.pin()).not.toThrow();
    expect(() => log.destroy()).not.toThrow();
  });

  it('pin setzt scrollTop nur bei Follow, force ueberstimmt', () => {
    const el = fakeLog({ scrollHeight: 400, clientHeight: 200, scrollTop: 0 });
    const log = bindChatLog(el);
    expect(log.isFollowing()).toBe(false);

    log.pin();
    expect(el.scrollTop).toBe(0);

    log.pin({ force: true });
    expect(el.scrollTop).toBe(400);
    expect(log.isFollowing()).toBe(true);

    el._sh = 600;
    log.pin();
    expect(el.scrollTop).toBe(600);
    log.destroy();
  });

  it('Scroll nach oben beendet Follow', () => {
    const el = fakeLog({ scrollHeight: 400, clientHeight: 200, scrollTop: 200 });
    const log = bindChatLog(el);
    expect(log.isFollowing()).toBe(true);

    el._st = 0;
    el.dispatchEvent(new Event('scroll'));
    expect(log.isFollowing()).toBe(false);
    log.destroy();
  });

  it('ResizeObserver pinnt nur bei Follow', () => {
    let cb = null;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(fn) { cb = fn; }
      observe = observe;
      disconnect = disconnect;
    });

    const el = fakeLog({ scrollHeight: 400, clientHeight: 200, scrollTop: 200 });
    const log = bindChatLog(el);
    expect(observe).toHaveBeenCalledWith(el);

    el._sh = 520;
    cb();
    expect(el.scrollTop).toBe(520);

    el._st = 0;
    el.dispatchEvent(new Event('scroll'));
    el._sh = 700;
    cb();
    expect(el.scrollTop).toBe(0);

    log.destroy();
    expect(disconnect).toHaveBeenCalled();
  });
});
