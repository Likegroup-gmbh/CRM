// navTrace.js
// Navigations-Spur: eine Tabelle pro Navigation, von Klick (nav:start) bis
// render:done. Ersetzt PerformanceMonitor und navPerf.
//
// Interface: navMark(name) setzt eine Marke, tracedFetch(fetch) misst die
// Supabase-Requests (Header-Zeit, Body-Zeit, dekodierte Bytes), crmPerf()
// gibt die letzte Spur noch einmal aus. Alles andere ist implementation.
//
// Warum ueber den Fetch und nicht ueber Resource Timing: Supabase sendet
// kein Timing-Allow-Origin, cross-origin liefert Resource Timing dann
// weder Groessen noch responseStart. Die komprimierte Groesse ist im Browser
// nicht erreichbar (DevTools Network: Size vs. Resource size).
//
// Aktiv in DEV, mit ?perf=1 oder localStorage.perfMonitor = '1'. Inaktiv ist
// navMark ein No-op und tracedFetch gibt den Fetch unveraendert zurueck.

const MAX_MARKS = 200;
const MAX_HISTORY = 20;
const FALLBACK_MS = 10000;
// Nur diese Pfade werden geklont, um die Body-Groesse zu messen. Storage-
// Downloads koennen gross sein und gehoeren nicht in die Spur.
const MESSBARE_PFADE = /\/(rest|auth|functions)\/v1\//;

function shortUrl(url, base = 'http://localhost') {
  try {
    const u = new URL(url, base);
    const p = u.pathname + u.search;
    return p.length > 80 ? `${p.slice(0, 77)}...` : p;
  } catch {
    return String(url).slice(0, 80);
  }
}

function requestUrl(input) {
  return typeof input === 'string' ? input : input?.url || String(input);
}

const runden = (n) => Math.round(n);

// Reine Funktion: Marken, Requests und Long-Tasks im Fenster -> Tabellen.
// Zeiten sind relativ zu navStart; negativ heisst: lief davor an
// (Boot-Prefetch, Hover-Prefetch).
export function buildTrace({ marks, requests, longTasks = [], navStart, endAt }) {
  const sortiert = [...marks].sort((a, b) => a.t - b.t);
  let davor = null;
  const phases = sortiert.map((m) => {
    const row = {
      phase: m.name,
      't (ms)': runden(m.t - navStart),
      'Delta (ms)': davor === null ? 0 : runden(m.t - davor),
    };
    davor = m.t;
    return row;
  });

  const requestRows = [...requests]
    .sort((a, b) => a.start - b.start)
    .map((r) => {
      const header = r.headersAt == null ? null : r.headersAt - r.start;
      const body = r.bodyEndAt == null ? null : r.bodyEndAt - r.headersAt;
      const kb = r.bytes == null ? null : r.bytes / 1024;
      return {
        request: r.name,
        status: r.status ?? '—',
        'start (ms)': runden(r.start - navStart),
        'Header (ms)': header === null ? '—' : runden(header),
        'Body (ms)': body === null ? '—' : runden(body),
        KB: kb === null ? '—' : Math.round(kb * 10) / 10,
        'KB/s': kb !== null && body > 0 ? runden(kb / (body / 1000)) : '—',
      };
    });

  const imFenster = longTasks.filter((l) => l.start >= navStart && l.start <= endAt);
  return {
    totalMs: runden(endAt - navStart),
    phases,
    requests: requestRows,
    longTasks: {
      count: imFenster.length,
      ms: runden(imFenster.reduce((s, l) => s + l.duration, 0)),
    },
  };
}

// Env ist die Naht fuer Tests: Uhr, Aktivierung, Ausgabe, Timer.
export function createNavTrace(env = {}) {
  const now = env.now || (() => performance.now());
  const aktiv = env.active || (() => false);
  const ausgabe = env.print || printTrace;
  const route = env.route || (() => globalThis.location?.pathname || '');

  let marks = [];
  let requests = [];
  let longTasks = [];
  let fensterStart = -Infinity; // Alles bis hierhin gehoert zu einer frueheren Spur.
  let offen = null; // { navStart, route, timer }
  let letzte = null;
  const verlauf = [];

  function schliesse(grund) {
    if (!offen) return null;
    const { navStart, route: pfad, timer } = offen;
    (env.clearTimeout || globalThis.clearTimeout)(timer);
    offen = null;
    const endAt = now();
    const trace = buildTrace({
      marks: marks.filter((m) => m.t > fensterStart),
      requests: requests.filter((r) => r.start > fensterStart),
      longTasks,
      navStart,
      endAt,
    });
    trace.route = pfad;
    trace.ende = grund;
    letzte = trace;
    verlauf.push(trace);
    if (verlauf.length > MAX_HISTORY) verlauf.shift();
    fensterStart = endAt;
    marks = marks.filter((m) => m.t > fensterStart);
    requests = requests.filter((r) => r.start > fensterStart);
    longTasks = longTasks.filter((l) => l.start > fensterStart);
    ausgabe(trace);
    return trace;
  }

  function navMark(name) {
    if (!aktiv()) return;
    const t = now();
    marks.push({ name, t });
    if (marks.length > MAX_MARKS) marks.shift();

    if (name === 'nav:start') {
      // Eine noch offene Spur wird verworfen: der Klick hat sie ueberholt.
      if (offen) (env.clearTimeout || globalThis.clearTimeout)(offen.timer);
      const timer = (env.setTimeout || globalThis.setTimeout)(
        () => schliesse('timeout'),
        FALLBACK_MS,
      );
      offen = { navStart: t, route: route(), timer };
      return;
    }
    if (name === 'render:done') schliesse('render:done');
  }

  function tracedFetch(baseFetch) {
    if (!aktiv()) return baseFetch;
    return async function tracedFetchImpl(input, init) {
      const start = now();
      const url = requestUrl(input);
      const res = await baseFetch(input, init);
      const rec = {
        name: shortUrl(url),
        start,
        headersAt: now(),
        bodyEndAt: null,
        bytes: null,
        status: res?.status,
      };
      requests.push(rec);
      if (MESSBARE_PFADE.test(url) && typeof res?.clone === 'function') {
        try {
          res.clone().arrayBuffer().then((buf) => {
            rec.bodyEndAt = now();
            rec.bytes = buf.byteLength;
          }).catch(() => { /* abgebrochen: Zeile bleibt ohne Body */ });
        } catch { /* Body schon gelesen */ }
      }
      return res;
    };
  }

  function recordLongTask(start, duration) {
    if (!aktiv()) return;
    longTasks.push({ start, duration });
  }

  return {
    navMark,
    tracedFetch,
    recordLongTask,
    last: () => letzte,
    history: () => [...verlauf],
    dump: () => {
      if (letzte) ausgabe(letzte);
      return letzte;
    },
  };
}

function printTrace(trace) {
  console.group(`🧭 Spur ${trace.route}: ${trace.totalMs} ms (${trace.ende})`);
  console.table(trace.phases);
  if (trace.requests.length) console.table(trace.requests);
  if (trace.longTasks.count) {
    console.log(`⚠️ ${trace.longTasks.count} Long-Tasks, ${trace.longTasks.ms} ms`);
  }
  console.groupEnd();
}

function browserAktiv() {
  try {
    if (import.meta.env?.DEV && import.meta.env?.MODE !== 'test') return true;
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('perf')) return true;
    return globalThis.localStorage?.getItem('perfMonitor') === '1';
  } catch {
    return false;
  }
}

let aktivCache = null;
const nav = createNavTrace({
  active: () => {
    if (aktivCache === null) aktivCache = browserAktiv();
    return aktivCache;
  },
});

export const navMark = nav.navMark;
export const tracedFetch = nav.tracedFetch;
export const crmPerf = nav.dump;

if (typeof window !== 'undefined') {
  window.crmPerf = crmPerf;
  // Alias: bisheriger Befehl bleibt, Start wirkt nach Reload.
  window.__perfMonitor = {
    enable() {
      globalThis.localStorage?.setItem('perfMonitor', '1');
      console.log('🧭 Navigations-Spur: an, Seite neu laden');
    },
    disable() {
      globalThis.localStorage?.removeItem('perfMonitor');
      console.log('🧭 Navigations-Spur: aus nach Reload');
    },
    dump: crmPerf,
    exportJSON: () => JSON.stringify(nav.history(), null, 2),
    get history() { return nav.history(); },
  };

  if (browserAktiv()) {
    try {
      new PerformanceObserver((list) => {
        list.getEntries().forEach((e) => nav.recordLongTask(e.startTime, e.duration));
      }).observe({ type: 'longtask', buffered: true });
    } catch { /* Long-Task-API fehlt */ }
  }
}
