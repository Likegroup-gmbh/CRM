/**
 * Global Performance Monitor – self-initialising side-effect module.
 *
 * Active automatically in DEV; in production add ?perf=1 or set
 * localStorage.perfMonitor = '1'.
 *
 * Runtime API via window.__perfMonitor:
 *   .enable()  / .disable()
 *   .dump()          – flush current session now
 *   .exportJSON()    – return all recorded sessions as JSON
 */

const IDLE_TIMEOUT = 500;   // ms without new activity → flush
const HARD_TIMEOUT = 5000;  // safety flush after navigation

// ─── Activation gate ─────────────────────────────────────────────
const shouldActivate = () =>
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
  new URLSearchParams(location.search).has('perf') ||
  localStorage.getItem('perfMonitor') === '1';

if (!shouldActivate()) {
  window.__perfMonitor = {
    enable()  { localStorage.setItem('perfMonitor', '1'); console.log('⏱ PerfMonitor: enabled – reload to start'); },
    disable() { localStorage.removeItem('perfMonitor'); console.log('⏱ PerfMonitor: disabled'); },
    dump()    { console.log('⏱ PerfMonitor: not active'); },
    exportJSON() { return '[]'; },
  };
} else {
  // ═══════════════════════════════════════════════════════════════
  //  Core implementation
  // ═══════════════════════════════════════════════════════════════

  let _enabled = true;
  let _sessionStart = performance.now();
  let _currentRoute = location.pathname;
  const _entries = [];       // current session entries
  const _history = [];       // flushed sessions
  let _idleTimer = null;
  let _hardTimer = null;
  let _pendingFetches = 0;
  const _originalFetch = window.fetch;

  // ─── Helpers ─────────────────────────────────────────────────
  const rel = (absMs) => Math.round(absMs - _sessionStart);

  const shortUrl = (url) => {
    try {
      const u = new URL(url, location.origin);
      let p = u.pathname + u.search;
      if (p.length > 80) p = p.slice(0, 77) + '...';
      return p;
    } catch { return String(url).slice(0, 80); }
  };

  const push = (entry) => {
    if (!_enabled) return;
    _entries.push(entry);
    scheduleFlush();
  };

  // ─── Idle / hard flush ───────────────────────────────────────
  const scheduleFlush = () => {
    clearTimeout(_idleTimer);
    if (_pendingFetches > 0) return;
    _idleTimer = setTimeout(flush, IDLE_TIMEOUT);
  };

  const scheduleHardFlush = () => {
    clearTimeout(_hardTimer);
    _hardTimer = setTimeout(() => {
      if (_entries.length) flush();
    }, HARD_TIMEOUT);
  };

  // ─── Flush → console output ──────────────────────────────────
  const flush = () => {
    clearTimeout(_idleTimer);
    clearTimeout(_hardTimer);
    if (!_entries.length) return;

    const totalMs = Math.round(performance.now() - _sessionStart);
    const fetches = _entries.filter(e => e.type === 'fetch');
    const lcp = _entries.find(e => e.type === 'lcp');
    const longtasks = _entries.filter(e => e.type === 'longtask');

    const header = [
      `⏱ Perf: ${_currentRoute}`,
      `(${totalMs}ms total`,
      `${fetches.length} fetches`,
      lcp ? `LCP ${lcp.start}ms` : null,
      longtasks.length ? `${longtasks.length} long-tasks` : null,
    ].filter(Boolean).join(', ') + ')';

    console.group(header);

    // Table
    const table = _entries
      .sort((a, b) => a.start - b.start)
      .map((e, i) => ({
        '#': i + 1,
        type: e.type,
        name: e.name,
        'start (ms)': e.start,
        'duration (ms)': e.duration ?? '—',
        status: e.status ?? '—',
      }));
    console.table(table);

    // Top 5 slowest
    const slowest = [..._entries]
      .filter(e => typeof e.duration === 'number')
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);
    if (slowest.length) {
      console.log(
        '🐌 Slowest:',
        slowest.map(e => `${e.name} (${e.duration}ms)`).join(', ')
      );
    }

    // Summary
    const networkTime = fetches.reduce((s, e) => s + (e.duration || 0), 0);
    const longtaskTime = longtasks.reduce((s, e) => s + (e.duration || 0), 0);
    console.log(
      `📊 Summary: ${fetches.length} fetches (${Math.round(networkTime)}ms network),`,
      `${_entries.filter(e => e.type === 'resource').length} resources,`,
      lcp ? `LCP ${lcp.start}ms,` : '',
      longtaskTime ? `${Math.round(longtaskTime)}ms in long-tasks` : ''
    );

    console.groupEnd();

    // Archive
    _history.push({
      route: _currentRoute,
      totalMs,
      entries: [..._entries],
      timestamp: new Date().toISOString(),
    });

    _entries.length = 0;
  };

  // ─── Start new session (route change) ────────────────────────
  const startSession = (route) => {
    if (_entries.length) flush();
    _sessionStart = performance.now();
    _currentRoute = route;
    push({ type: 'nav', name: `route-change → ${route}`, start: 0, duration: null });
    scheduleHardFlush();
  };

  // ─── 1) fetch monkey-patch ───────────────────────────────────
  window.fetch = function patchedFetch(input, init) {
    if (!_enabled) return _originalFetch.call(this, input, init);

    const url = typeof input === 'string' ? input : input?.url || String(input);
    const startMs = performance.now();
    _pendingFetches++;

    return _originalFetch.call(this, input, init).then(
      (response) => {
        _pendingFetches--;
        push({
          type: 'fetch',
          name: shortUrl(url),
          start: rel(startMs),
          duration: Math.round(performance.now() - startMs),
          status: response.status,
        });
        return response;
      },
      (err) => {
        _pendingFetches--;
        push({
          type: 'fetch',
          name: shortUrl(url),
          start: rel(startMs),
          duration: Math.round(performance.now() - startMs),
          status: 'ERR',
        });
        throw err;
      }
    );
  };

  // ─── 2) PerformanceObserver – resource timing ────────────────
  try {
    const resObs = new PerformanceObserver((list) => {
      if (!_enabled) return;
      for (const entry of list.getEntries()) {
        if (entry.name.includes('chrome-extension')) continue;
        push({
          type: 'resource',
          name: shortUrl(entry.name),
          start: rel(entry.startTime),
          duration: Math.round(entry.duration),
        });
      }
    });
    resObs.observe({ type: 'resource', buffered: false });
  } catch (e) { /* unsupported */ }

  // ─── 3) PerformanceObserver – LCP ────────────────────────────
  try {
    const lcpObs = new PerformanceObserver((list) => {
      if (!_enabled) return;
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) {
        const el = last.element;
        const tag = el ? `<${el.tagName.toLowerCase()}${el.className ? '.' + el.className.split(' ')[0] : ''}>` : '?';
        push({
          type: 'lcp',
          name: `LCP: ${tag}`,
          start: Math.round(last.startTime),
          duration: null,
        });
      }
    });
    lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) { /* unsupported */ }

  // ─── 4) PerformanceObserver – long tasks ─────────────────────
  try {
    const ltObs = new PerformanceObserver((list) => {
      if (!_enabled) return;
      for (const entry of list.getEntries()) {
        push({
          type: 'longtask',
          name: `long-task (${Math.round(entry.duration)}ms)`,
          start: rel(entry.startTime),
          duration: Math.round(entry.duration),
        });
      }
    });
    ltObs.observe({ type: 'longtask', buffered: true });
  } catch (e) { /* unsupported */ }

  // ─── 5) PerformanceObserver – paint timing ───────────────────
  try {
    const paintObs = new PerformanceObserver((list) => {
      if (!_enabled) return;
      for (const entry of list.getEntries()) {
        push({
          type: 'paint',
          name: entry.name,
          start: Math.round(entry.startTime),
          duration: null,
        });
      }
    });
    paintObs.observe({ type: 'paint', buffered: true });
  } catch (e) { /* unsupported */ }

  // ─── 6) Initial page load events ────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      push({
        type: 'milestone',
        name: 'DOMContentLoaded',
        start: Math.round(performance.now()),
        duration: null,
      });
    });
  }

  window.addEventListener('load', () => {
    push({
      type: 'milestone',
      name: 'window.load',
      start: Math.round(performance.now()),
      duration: null,
    });
  });

  // ─── 7) Monkey-patch moduleRegistry.navigateTo ──────────────
  const hookNavigateTo = () => {
    const reg = window.moduleRegistry;
    if (!reg || reg.__perfPatched) return;

    const original = reg.navigateTo.bind(reg);
    reg.navigateTo = function perfWrappedNavigateTo(route, skipPushState) {
      if (_enabled) startSession(route);
      return original(route, skipPushState);
    };
    reg.__perfPatched = true;
    console.log('⏱ PerfMonitor: navigateTo gepatcht');
  };

  // Poll until moduleRegistry exists (it's created synchronously in main.js
  // but this import runs before it). Once found, patch once.
  const pollHandle = setInterval(() => {
    if (window.moduleRegistry) {
      clearInterval(pollHandle);
      hookNavigateTo();
    }
  }, 50);
  setTimeout(() => clearInterval(pollHandle), 10000);

  // ─── 8) Public API ──────────────────────────────────────────
  window.__perfMonitor = {
    enable() {
      _enabled = true;
      localStorage.setItem('perfMonitor', '1');
      console.log('⏱ PerfMonitor: enabled');
    },
    disable() {
      _enabled = false;
      localStorage.removeItem('perfMonitor');
      if (_entries.length) flush();
      console.log('⏱ PerfMonitor: disabled');
    },
    dump() { flush(); },
    exportJSON() { return JSON.stringify(_history, null, 2); },
    get history() { return _history; },
  };

  // Initial session
  startSession(location.pathname);
  console.log('⏱ PerfMonitor: aktiv – flush nach idle oder via __perfMonitor.dump()');
}
