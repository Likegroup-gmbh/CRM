// SekundenSpanne.js
// Slider fuer ein Sekundenintervall (von/bis inklusive), gemeinsam genutzt von
// Briefing (Videolaenge) und Konzept (Dauer der Videoidee). Zwei Griffe auf einer
// Schiene, dazu zwei Zahlenfelder und "Leeren". Leer heisst: keine Vorgabe.
//
// Der Zustand liegt am Root-Element (data-von/data-bis, data-min/data-max), das
// Markup kommt aus renderSekundenSpanne(). Wer auf eine Aenderung reagieren will,
// gibt bei bindSekundenSpanne einen onCommit-Callback mit: er feuert, wenn ein Zug
// endet, ein Zahlenfeld verlassen oder "Leeren" geklickt wird - nicht bei jeder
// Pixelbewegung.

import {
  VIDEOLAENGE_MIN,
  VIDEOLAENGE_MAX,
  commitZahl,
  intervallOderNull,
  sekundeAnPosition,
  spreize,
  zieheGriff
} from '../../modules/briefing/videolaenge.js';

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function prozent(n, min, max) {
  if (max === min) return 0;
  return ((n - min) / (max - min)) * 100;
}

function gueltig(von, bis) {
  return Number.isFinite(von) && Number.isFinite(bis) ? { von, bis } : null;
}

/** Attribute fuers Root-Element: data-sekunden-spanne, min/max und der Startwert. */
export function sekundenSpanneAttrs({ name = '', von = null, bis = null, min = VIDEOLAENGE_MIN, max = VIDEOLAENGE_MAX } = {}) {
  const iv = gueltig(von, bis);
  return `data-sekunden-spanne="${escapeAttr(name)}" data-min="${min}" data-max="${max}" data-von="${iv ? iv.von : ''}" data-bis="${iv ? iv.bis : ''}"`;
}

/** Inneres Markup (Schiene, Griffe, Zahlenfelder). Gehoert in ein Root mit sekundenSpanneAttrs(). */
export function renderSekundenSpanne({ von = null, bis = null, min = VIDEOLAENGE_MIN, max = VIDEOLAENGE_MAX } = {}) {
  const iv = gueltig(von, bis);
  const leer = !iv;
  const vonPct = leer ? 0 : prozent(iv.von, min, max);
  const bisPct = leer ? 0 : prozent(iv.bis, min, max);
  const fill = `left:${vonPct}%;width:${Math.max(0, bisPct - vonPct)}%`;
  return `
      <div class="sek-spanne${leer ? ' is-empty' : ''}">
        <div class="sek-spanne__track" data-track>
          <div class="sek-spanne__rail"></div>
          <div class="sek-spanne__fill" data-fill style="${fill}"></div>
          <button type="button" class="sek-spanne__handle" data-handle="von" style="left:${vonPct}%" aria-label="Von"></button>
          <button type="button" class="sek-spanne__handle" data-handle="bis" style="left:${bisPct}%" aria-label="Bis"></button>
        </div>
        <div class="sek-spanne__nums">
          <input type="text" inputmode="numeric" autocomplete="off" data-sek="von" placeholder="von" value="${leer ? '' : iv.von}" aria-label="Von Sekunden">
          <span class="sek-spanne__bis">bis</span>
          <input type="text" inputmode="numeric" autocomplete="off" data-sek="bis" placeholder="bis" value="${leer ? '' : iv.bis}" aria-label="Bis Sekunden">
          <button type="button" class="sek-spanne__leeren" data-leeren>Leeren</button>
        </div>
      </div>`;
}

/** Aktuelles Intervall am Root oder null. */
export function sekundenSpanneWert(root) {
  const von = root?.dataset?.von;
  const bis = root?.dataset?.bis;
  if (von === '' || bis === '' || von == null || bis == null) return null;
  return intervallOderNull(von, bis);
}

/** Setzt Intervall (oder leer) am Root und zieht Griffe, Strich und Zahlenfelder nach. */
export function setSekundenSpanne(root, iv, { forceInputs = false } = {}) {
  if (!root) return;
  const min = Number(root.dataset.min) || VIDEOLAENGE_MIN;
  const max = Number(root.dataset.max) || VIDEOLAENGE_MAX;
  const leer = !iv;
  root.dataset.von = leer ? '' : String(iv.von);
  root.dataset.bis = leer ? '' : String(iv.bis);
  root.querySelector('.sek-spanne')?.classList.toggle('is-empty', leer);

  const vonPct = leer ? 0 : prozent(iv.von, min, max);
  const bisPct = leer ? 0 : prozent(iv.bis, min, max);
  const fill = root.querySelector('[data-fill]');
  if (fill) {
    fill.style.left = `${vonPct}%`;
    fill.style.width = `${Math.max(0, bisPct - vonPct)}%`;
  }
  const vonHandle = root.querySelector('[data-handle="von"]');
  const bisHandle = root.querySelector('[data-handle="bis"]');
  if (vonHandle) vonHandle.style.left = `${vonPct}%`;
  if (bisHandle) bisHandle.style.left = `${bisPct}%`;

  const aktiv = forceInputs ? null : document.activeElement;
  const vonInput = root.querySelector('[data-sek="von"]');
  const bisInput = root.querySelector('[data-sek="bis"]');
  if (vonInput && aktiv !== vonInput) vonInput.value = leer ? '' : String(iv.von);
  if (bisInput && aktiv !== bisInput) bisInput.value = leer ? '' : String(iv.bis);
}

function sekundeAmZeiger(root, event) {
  const track = root.querySelector('[data-track]');
  const rect = track.getBoundingClientRect();
  const ratio = rect.width ? (event.clientX - rect.left) / rect.width : 0;
  return sekundeAnPosition(ratio, Number(root.dataset.min) || VIDEOLAENGE_MIN, Number(root.dataset.max) || VIDEOLAENGE_MAX);
}

/**
 * Verdrahtet einen Slider. Mehrfaches Binden am selben Root ist wirkungslos.
 * @param {HTMLElement} root  Element mit data-sekunden-spanne
 * @param {{ onCommit?: (iv: {von:number,bis:number}|null) => void }} [opts]
 */
export function bindSekundenSpanne(root, { onCommit = null } = {}) {
  if (!root || root.dataset.sekBound === '1') return;
  root.dataset.sekBound = '1';
  const commit = () => onCommit?.(sekundenSpanneWert(root));

  const track = root.querySelector('[data-track]');
  track?.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return;
    const handle = e.target.closest?.('[data-handle]');
    const start = sekundenSpanneWert(root);
    if (start && start.von !== start.bis && !handle) return;

    const sek = sekundeAmZeiger(root, e);
    let mode;
    let anchor = null;
    if (start && start.von !== start.bis && handle) {
      mode = handle.dataset.handle;
    } else {
      mode = 'spread';
      anchor = (start && start.von === start.bis && handle) ? start.von : sek;
      setSekundenSpanne(root, { von: anchor, bis: anchor });
    }

    const move = (ev) => {
      const jetzt = sekundeAmZeiger(root, ev);
      const next = mode === 'spread'
        ? spreize(anchor, jetzt)
        : zieheGriff({ von: start.von, bis: start.bis, seite: mode, sekunde: jetzt });
      if (next) setSekundenSpanne(root, next);
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      commit();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  });

  root.querySelectorAll('[data-sek]').forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
    });
    input.addEventListener('blur', () => {
      const state = sekundenSpanneWert(root);
      const next = commitZahl({
        von: state?.von ?? null,
        bis: state?.bis ?? null,
        seite: input.dataset.sek,
        roh: input.value
      });
      setSekundenSpanne(root, next, { forceInputs: true });
      commit();
    });
  });

  root.querySelector('[data-leeren]')?.addEventListener('click', () => {
    setSekundenSpanne(root, null, { forceInputs: true });
    commit();
  });
}
