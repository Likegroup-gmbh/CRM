// auswertungErfassenHoehe.js
// Erfassen füllt genau die Höhe des Fensters: die Seite scrollt nicht mit, stattdessen scrollen
// die Arbeitsliste links, das Blatt in der Mitte und das Formular rechts je für sich (CSS in
// auswertung-erfassen.css). Die Höhe hängt davon ab, wie weit oben die Ansicht beginnt (Kopf, Reiter);
// das misst dieses Modul und legt sie als --erfassen-hoehe auf .erfassen.

const VAR = '--erfassen-hoehe';

/** Nächster Vorfahre, der vertikal scrollt (im CRM der Seitenrahmen). */
function scrollRahmen(el) {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(p).overflowY)) return p;
  }
  return document.scrollingElement;
}

const px = (wert) => parseFloat(wert) || 0;

/** Platz, den Ränder und Innenabstände unter der Ansicht bis zum Rand des Rahmens noch belegen. */
function platzDarunter(el, rahmen) {
  let summe = 0;
  for (let n = el; n && n !== rahmen; n = n.parentElement) {
    const s = getComputedStyle(n);
    summe += px(s.marginBottom);
    if (n !== el) summe += px(s.paddingBottom) + px(s.borderBottomWidth);
  }
  if (rahmen && rahmen !== document.scrollingElement) {
    const s = getComputedStyle(rahmen);
    summe += px(s.paddingBottom) + px(s.borderBottomWidth);
  }
  return summe;
}

/**
 * Höhe messen und setzen. Ohne Erfassen-Ansicht passiert nichts.
 * @param {HTMLElement} root - [data-auswertung]
 */
export function passeHoeheAn(root) {
  const el = root?.querySelector('.erfassen');
  if (!el) return;
  const rahmen = scrollRahmen(el);
  if (!rahmen) return;
  const rahmenOben = rahmen === document.scrollingElement ? 0 : rahmen.getBoundingClientRect().top;
  const oben = el.getBoundingClientRect().top - rahmenOben + rahmen.scrollTop;
  const hoehe = Math.floor(rahmen.clientHeight - oben - platzDarunter(el, rahmen));
  if (hoehe > 0) el.style.setProperty(VAR, `${hoehe}px`);
}

/**
 * Misst beim Einsetzen, bei jedem Neuzeichnen des Inhalts und bei Größenänderung des Fensters.
 * Auch für andere Seiten im Erfassen-Layout (PDF-Vorlagen): dort ist `inhalt` die Seite selbst.
 * @param {HTMLElement} root - [data-auswertung], enthält `.erfassen`
 * @param {{ inhalt?: HTMLElement|null }} [opts] - Element, dessen Kinder wechseln (Standard: [data-auswertung-inhalt])
 * @returns {() => void} cleanup
 */
export function bindeErfassenHoehe(root, { inhalt = root?.querySelector('[data-auswertung-inhalt]') } = {}) {
  if (!inhalt) return () => {};
  let frame = 0;
  const messen = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => { if (root.isConnected) passeHoeheAn(root); });
  };
  window.addEventListener('resize', messen);
  const rahmen = scrollRahmen(inhalt);
  const resize = typeof ResizeObserver === 'function' && rahmen ? new ResizeObserver(messen) : null;
  resize?.observe(rahmen === document.scrollingElement ? document.documentElement : rahmen);
  const mutation = new MutationObserver(messen);
  mutation.observe(inhalt, { childList: true });
  passeHoeheAn(root);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', messen);
    resize?.disconnect();
    mutation.disconnect();
  };
}
