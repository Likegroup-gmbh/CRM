import { shouldActivateDevMode } from './DevModeAccess.js';

const state = {
  counts: { document: 0, window: 0, element: 0 },
  log: [],
  overlay: null,
  active: false,
  showElements: false,
  maxLogEntries: 200,
};

let patched = false;

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

function patch() {
  const origAdd = EventTarget.prototype.addEventListener;
  const origRemove = EventTarget.prototype.removeEventListener;

  EventTarget.prototype.addEventListener = function patchedAdd(type, fn, opts) {
    const name = getTargetName(this);
    if (name) {
      state.counts[name]++;
    } else {
      state.counts.element++;
    }
    if (state.active) {
      const target = name || (this.id ? `#${this.id}` : this.className?.toString?.().split(' ')[0] || this.tagName || 'element');
      const source = captureSource();
      state.log.push({ action: 'add', target, type, source, ts: Date.now() });
      if (state.log.length > state.maxLogEntries) state.log.shift();
    }

    const sig = (opts && typeof opts === 'object') ? opts.signal : undefined;
    if (sig && !sig.aborted) {
      const self = this;
      sig.addEventListener('abort', () => {
        const n = getTargetName(self);
        if (n) state.counts[n] = Math.max(0, state.counts[n] - 1);
        else state.counts.element = Math.max(0, state.counts.element - 1);
        if (state.active) {
          const t = n || (self.id ? `#${self.id}` : self.className?.toString?.().split(' ')[0] || self.tagName || 'element');
          state.log.push({ action: 'signal-remove', target: t, type, source: '', ts: Date.now() });
          if (state.log.length > state.maxLogEntries) state.log.shift();
        }
        updateUI();
      }, { once: true });
    }

    updateUI();
    return origAdd.call(this, type, fn, opts);
  };

  EventTarget.prototype.removeEventListener = function patchedRemove(type, fn, opts) {
    const name = getTargetName(this);
    if (name) {
      state.counts[name] = Math.max(0, state.counts[name] - 1);
    } else {
      state.counts.element = Math.max(0, state.counts.element - 1);
    }
    if (state.active) {
      const target = name || (this.id ? `#${this.id}` : this.className?.toString?.().split(' ')[0] || this.tagName || 'element');
      state.log.push({ action: 'remove', target, type, source: '', ts: Date.now() });
      if (state.log.length > state.maxLogEntries) state.log.shift();
    }
    updateUI();
    return origRemove.call(this, type, fn, opts);
  };
}

function createOverlay() {
  const el = document.createElement('div');
  el.id = 'listener-monitor';
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '8px',
    right: '8px',
    background: 'rgba(0,0,0,0.85)',
    color: '#0f0',
    fontFamily: 'monospace',
    fontSize: '11px',
    padding: '6px 10px',
    borderRadius: '6px',
    zIndex: '999999',
    pointerEvents: 'auto',
    cursor: 'pointer',
    userSelect: 'none',
    minWidth: '160px',
    lineHeight: '1.4',
    backdropFilter: 'blur(4px)',
  });
  el.title = 'Click = Toggle Log • Shift+Click = Dump • Alt+Click = Toggle Element-Count';

  el.addEventListener('click', (e) => {
    if (e.shiftKey) {
      console.table(state.log.slice(-50));
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
}

function updateUI() {
  if (!state.overlay) return;
  const { document: d, window: w, element: elCount } = state.counts;
  const globalTotal = d + w;
  const total = globalTotal + elCount;
  const warn = globalTotal > 80 ? ' ⚠️' : '';
  const logStatus = state.active ? ' [LOG]' : '';
  const elLine = state.showElements ? `<br>el: <b>${elCount}</b>` : '';
  state.overlay.innerHTML =
    `<b>Listeners${warn}</b>${logStatus}<br>` +
    `doc: <b>${d}</b> &nbsp; win: <b>${w}</b> &nbsp; Σ <b>${globalTotal}</b>` +
    elLine;
  state.overlay.style.color = globalTotal > 120 ? '#f44' : globalTotal > 80 ? '#fa0' : '#0f0';
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

  console.log('🔬 ListenerMonitor aktiv – Click = Toggle Log, Shift+Click = Dump, Alt+Click = Toggle Element-Count');
}

export function initListenerMonitor() {
  ensureListenerMonitor();
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
    state.log.push({ action: 'reset-elements', target: 'element', type: '', source: '', ts: Date.now() });
    if (state.log.length > state.maxLogEntries) state.log.shift();
  }
  updateUI();
}
