import { shouldActivateDevMode } from './DevModeAccess.js';

const COLLAPSED_KEY = 'listenerMonitorCollapsed';

const state = {
  counts: { document: 0, window: 0, element: 0 },
  log: [],
  overlay: null,
  body: null,
  collapseBtn: null,
  active: false,
  collapsed: false,
  showElements: false,
  maxLogEntries: 200,
};

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed) {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // privater Modus o.ä.
  }
}

// doc/win: eine Registry, Key = type|capture|fn. Der Browser ignoriert ein
// zweites add derselben Kombination und entfernt sie genau einmal — der Zähler
// muss dasselbe tun, sonst driften Doppel-add, Signal+removeEventListener und
// once auseinander.
const registries = {
  document: new Map(),
  window: new Map(),
};

let patched = false;
let nextFnId = 1;
const fnIds = new WeakMap();

function fnId(fn) {
  if (fn == null || (typeof fn !== 'function' && typeof fn !== 'object')) return 0;
  let id = fnIds.get(fn);
  if (!id) {
    id = nextFnId++;
    fnIds.set(fn, id);
  }
  return id;
}

function isCapture(opts) {
  if (opts === true) return true;
  return !!(opts && typeof opts === 'object' && opts.capture);
}

function isOnce(opts) {
  return !!(opts && typeof opts === 'object' && opts.once);
}

function listenerKey(type, capture, fn) {
  return `${type}|${capture ? 1 : 0}|${fnId(fn)}`;
}

function captureSource() {
  const stack = new Error().stack || '';
  const lines = stack.split('\n').filter(l => !l.includes('ListenerMonitor'));
  return lines[1]?.trim() || 'unknown';
}

function getTargetName(obj) {
  if (obj === document) return 'document';
  if (obj === window) return 'window';
  return null;
}

function targetLabel(obj, name) {
  if (name) return name;
  return obj.id ? `#${obj.id}` : obj.className?.toString?.().split(' ')[0] || obj.tagName || 'element';
}

function pushLog(entry) {
  state.log.push(entry);
  if (state.log.length > state.maxLogEntries) state.log.shift();
}

function syncCount(name) {
  state.counts[name] = registries[name].size;
}

// true, wenn der Key neu war (der Browser den Listener also wirklich anhängt).
function trackAdd(name, type, fn, opts) {
  const capture = isCapture(opts);
  const key = listenerKey(type, capture, fn);
  const reg = registries[name];
  if (reg.has(key)) return null;
  reg.set(key, { type, capture, once: isOnce(opts), source: captureSource() });
  syncCount(name);
  return { key, capture };
}

// true, wenn der Key noch da war. Zweites remove oder Signal nach remove ist ein No-op.
function forget(name, key) {
  const reg = registries[name];
  if (!reg?.has(key)) return false;
  reg.delete(key);
  syncCount(name);
  return true;
}

function trackRemove(name, type, fn, opts) {
  return forget(name, listenerKey(type, isCapture(opts), fn));
}

function patch() {
  const origAdd = EventTarget.prototype.addEventListener;
  const origRemove = EventTarget.prototype.removeEventListener;

  EventTarget.prototype.addEventListener = function patchedAdd(type, fn, opts) {
    const name = getTargetName(this);
    const sig = (opts && typeof opts === 'object') ? opts.signal : undefined;

    if (sig?.aborted) {
      return origAdd.call(this, type, fn, opts);
    }

    if (!name) {
      state.counts.element++;
      if (state.active) {
        pushLog({ action: 'add', target: targetLabel(this, null), type, source: captureSource(), ts: Date.now() });
      }
      if (sig) {
        origAdd.call(sig, 'abort', () => {
          state.counts.element = Math.max(0, state.counts.element - 1);
          if (state.active) {
            pushLog({ action: 'signal-remove', target: targetLabel(this, null), type, source: '', ts: Date.now() });
          }
          updateUI();
        }, { once: true });
      }
    } else {
      const tracked = trackAdd(name, type, fn, opts);
      if (tracked) {
        const drop = () => {
          if (!forget(name, tracked.key)) return;
          if (state.active) {
            pushLog({ action: 'signal-remove', target: name, type, source: '', ts: Date.now() });
          }
          updateUI();
        };
        if (sig) origAdd.call(sig, 'abort', drop, { once: true });
        // once fällt nach dem Feuern weg, ohne removeEventListener. Eigener
        // Listener über origAdd, damit er selbst nicht mitgezählt wird.
        if (isOnce(opts)) {
          origAdd.call(this, type, drop, { once: true, capture: tracked.capture });
        }
        if (state.active) {
          pushLog({ action: 'add', target: name, type, source: registries[name].get(tracked.key)?.source || '', ts: Date.now() });
        }
      }
    }

    updateUI();
    return origAdd.call(this, type, fn, opts);
  };

  EventTarget.prototype.removeEventListener = function patchedRemove(type, fn, opts) {
    const name = getTargetName(this);
    if (!name) {
      state.counts.element = Math.max(0, state.counts.element - 1);
      if (state.active) {
        pushLog({ action: 'remove', target: targetLabel(this, null), type, source: '', ts: Date.now() });
      }
    } else if (trackRemove(name, type, fn, opts) && state.active) {
      pushLog({ action: 'remove', target: name, type, source: '', ts: Date.now() });
    }
    updateUI();
    return origRemove.call(this, type, fn, opts);
  };
}

function dumpActive() {
  for (const name of ['document', 'window']) {
    const bySource = new Map();
    for (const entry of registries[name].values()) {
      const list = bySource.get(entry.source) || [];
      list.push(entry);
      bySource.set(entry.source, list);
    }
    console.group(`Listeners on ${name} (${registries[name].size})`);
    const rows = [...bySource.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [source, entries] of rows) {
      console.group(`${entries.length}× ${source}`);
      console.table(entries.map(e => ({ type: e.type, capture: e.capture, once: e.once })));
      console.groupEnd();
    }
    console.groupEnd();
  }
}

function setCollapsed(collapsed) {
  state.collapsed = collapsed;
  writeCollapsed(collapsed);
  updateUI();
}

function createOverlay() {
  state.collapsed = readCollapsed();

  const el = document.createElement('div');
  el.id = 'listener-monitor';
  Object.assign(el.style, {
    position: 'fixed',
    background: 'rgba(0,0,0,0.85)',
    color: '#0f0',
    fontFamily: 'monospace',
    fontSize: '11px',
    zIndex: '999999',
    pointerEvents: 'auto',
    cursor: 'pointer',
    userSelect: 'none',
    lineHeight: '1.4',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  });

  const body = document.createElement('div');
  body.className = 'lm-body';

  const collapseBtn = document.createElement('button');
  collapseBtn.type = 'button';
  collapseBtn.dataset.action = 'collapse';
  collapseBtn.textContent = 'aus';
  collapseBtn.title = 'Ausblenden';
  Object.assign(collapseBtn.style, {
    margin: '0',
    padding: '0 4px',
    border: '1px solid currentColor',
    borderRadius: '3px',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    lineHeight: '1.4',
    cursor: 'pointer',
    flexShrink: '0',
  });
  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setCollapsed(true);
  });

  el.append(body, collapseBtn);

  el.addEventListener('click', (e) => {
    if (state.collapsed) {
      setCollapsed(false);
      return;
    }
    if (e.shiftKey) {
      dumpActive();
      return;
    }
    if (e.altKey) {
      state.showElements = !state.showElements;
      updateUI();
      return;
    }
    state.active = !state.active;
    updateUI();
  });

  document.body.appendChild(el);
  state.overlay = el;
  state.body = body;
  state.collapseBtn = collapseBtn;
  updateUI();
}

function applyChrome() {
  const el = state.overlay;
  if (!el) return;
  const btn = state.collapseBtn;
  if (state.collapsed) {
    el.classList.add('is-collapsed');
    Object.assign(el.style, {
      top: 'auto',
      bottom: '96px',
      right: '0px',
      minWidth: '0',
      padding: '6px 5px',
      borderRadius: '6px 0 0 6px',
    });
    if (btn) btn.hidden = true;
    el.title = 'Listener einblenden';
    return;
  }
  el.classList.remove('is-collapsed');
  Object.assign(el.style, {
    top: 'auto',
    bottom: '8px',
    right: '8px',
    minWidth: '180px',
    padding: '6px 10px',
    borderRadius: '6px',
  });
  if (btn) btn.hidden = false;
  el.title = 'Click = Toggle Log • Shift+Click = Dump • Alt+Click = Element-Count • aus = einklappen';
}

function updateUI() {
  if (!state.overlay) return;
  const { document: d, window: w, element: elCount } = state.counts;
  const globalTotal = d + w;
  const warn = globalTotal > 80 ? ' ⚠️' : '';
  const body = state.body;
  if (body) {
    if (state.collapsed) {
      body.innerHTML = `L <b>${globalTotal}</b>${warn}`;
    } else {
      const logStatus = state.active ? ' [LOG]' : '';
      const elLine = state.showElements ? `<br>el: <b>${elCount}</b>` : '';
      body.innerHTML =
        `<b>Listeners${warn}</b>${logStatus}<br>` +
        `doc: <b>${d}</b> &nbsp; win: <b>${w}</b> &nbsp; Σ <b>${globalTotal}</b>` +
        elLine;
    }
  }
  state.overlay.style.color = globalTotal > 120 ? '#f44' : globalTotal > 80 ? '#fa0' : '#0f0';
  applyChrome();
}

function mountOverlay() {
  if (state.overlay) return;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createOverlay, { once: true });
    return;
  }

  if (document.body) {
    createOverlay();
  } else {
    document.addEventListener('DOMContentLoaded', createOverlay, { once: true });
  }
}

export function ensureListenerMonitor() {
  if (typeof window === 'undefined') return;
  if (!shouldActivateDevMode()) return;

  if (!patched) {
    patch();
    patched = true;
  }

  mountOverlay();
  if (state.overlay) {
    updateUI();
  }

  console.log('🔬 ListenerMonitor aktiv – Click = Toggle Log, Shift+Click = Dump, Alt+Click = Element-Count, aus = einklappen');
}

export function initListenerMonitor() {
  ensureListenerMonitor();
}

/**
 * Entfernt das Overlay aus dem DOM. Der addEventListener-Patch bleibt bestehen
 * (nicht rückbaubar ohne Referenzverlust), zaehlt aber nur noch unsichtbar weiter.
 */
export function hideListenerMonitor() {
  if (!state.overlay) return;
  state.overlay.remove();
  state.overlay = null;
  state.body = null;
  state.collapseBtn = null;
  state.active = false;
}

/**
 * Resettet den Element-Counter. Sinnvoll bei Routenwechsel, da Element-Listener
 * durch DOM-Removal (innerHTML =) ohnehin inaktiv sind, der Counter aber nicht
 * automatisch dekrementiert wird (kein removeEventListener-Call).
 * Beeinflusst NICHT die doc/win-Counter (echte Leaks bleiben sichtbar).
 */
export function resetElementCount() {
  state.counts.element = 0;
  if (state.active) {
    pushLog({ action: 'reset-elements', target: 'element', type: '', source: '', ts: Date.now() });
  }
  updateUI();
}
