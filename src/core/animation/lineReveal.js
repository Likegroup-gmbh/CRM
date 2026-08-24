// lineReveal.js
// Generischer Zeile-fuer-Zeile-Reveal: Text wird progressiv angehaengt,
// jede neue Zeile fadet per WAAPI ein. Wiederverwendbar auf jeder Seite.
// Ein neuer Aufruf auf demselben Element bricht den laufenden Reveal ab.

const runningReveals = new WeakMap();

const DEFAULT_STAGGER = 90;
const DEFAULT_DURATION = 220;
const DEFAULT_MAX_TOTAL = 2500;
const DEFAULT_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function splitLines(text) {
  return String(text ?? '').split('\n');
}

function makeLineSpan(line) {
  const span = document.createElement('span');
  span.style.display = 'block';
  // Leerzeile braucht eine sichtbare Zeilenhoehe (Original: white-space: pre-wrap)
  span.append(document.createTextNode(line === '' ? '\u00A0' : line));
  return span;
}

function paintAllLines(el, lines) {
  el.replaceChildren(...lines.map(makeLineSpan));
}

function paintRemaining(el, lines) {
  for (let i = el.children.length; i < lines.length; i += 1) {
    el.append(makeLineSpan(lines[i]));
  }
}

function stopRunning(el) {
  const running = runningReveals.get(el);
  if (!running) return null;
  if (running.timer) clearTimeout(running.timer);
  runningReveals.delete(el);
  running.resolve();
  return running;
}

export function isRevealing(el) {
  return runningReveals.has(el);
}

/**
 * Bricht den laufenden Reveal ab und zeigt den restlichen Text sofort.
 * onDone des abgebrochenen Aufrufs feuert nicht.
 */
export function cancelLineReveal(el) {
  const running = stopRunning(el);
  if (!running) return;
  paintRemaining(el, running.lines);
}

/**
 * Baut den Textinhalt von `el` Zeile fuer Zeile wieder auf.
 * Jede neue Zeile wird angehaengt (Container waechst) und fadet ein.
 *
 * @param {HTMLElement} el
 * @param {object} [options]
 * @param {number} [options.stagger=90] Pause zwischen Zeilen in ms
 * @param {number} [options.duration=220] Fade-Dauer einer Zeile in ms
 * @param {number} [options.maxTotal=2500] Deckel fuer die Gesamtdauer (stagger wird gekuerzt)
 * @param {string} [options.text] Expliziter Text (sonst el.textContent)
 * @param {(index: number, line: string) => void} [options.onLine] nach jeder angehaengten Zeile
 * @param {() => void} [options.onDone] nach der letzten Zeile (nicht bei Abbruch)
 * @returns {Promise<void>}
 */
export function revealLines(el, options = {}) {
  if (!el) return Promise.resolve();

  const staggerIn = options.stagger ?? DEFAULT_STAGGER;
  const duration = options.duration ?? DEFAULT_DURATION;
  const maxTotal = options.maxTotal ?? DEFAULT_MAX_TOTAL;
  const onLine = options.onLine;
  const onDone = options.onDone;

  const prev = stopRunning(el);
  const raw = options.text ?? el.textContent ?? '';
  const lines = prev?.lines ?? splitLines(raw);

  const snap = prefersReducedMotion()
    || staggerIn <= 0
    || lines.length === 0
    || raw === '' && !prev
    || !el.isConnected;

  if (snap) {
    if (raw !== '' || prev) paintAllLines(el, lines);
    onDone?.();
    return Promise.resolve();
  }

  const stagger = Math.min(staggerIn, maxTotal / lines.length);
  el.replaceChildren();

  return new Promise((resolve) => {
    let index = 0;
    const state = { timer: 0, lines, resolve };
    runningReveals.set(el, state);

    const finish = (aborted) => {
      if (runningReveals.get(el) !== state) return;
      if (state.timer) clearTimeout(state.timer);
      runningReveals.delete(el);
      if (!aborted) onDone?.();
      resolve();
    };

    const tick = () => {
      if (runningReveals.get(el) !== state) return;
      if (!el.isConnected) {
        finish(true);
        return;
      }

      const line = lines[index];
      const span = makeLineSpan(line);
      el.append(span);
      if (typeof span.animate === 'function') {
        span.animate(
          [
            { opacity: 0, transform: 'translateY(4px)' },
            { opacity: 1, transform: 'translateY(0)' }
          ],
          { duration, easing: DEFAULT_EASING, fill: 'forwards' }
        );
      }

      onLine?.(index, line);
      index += 1;

      if (index >= lines.length) {
        finish(false);
        return;
      }
      state.timer = setTimeout(tick, stagger);
    };

    tick();
  });
}
