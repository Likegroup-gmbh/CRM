// Chrome scrollt eine Achse nicht per Rad oder Trackpad, wenn die andere
// overflow: clip ist. Tabellen nutzen clip auf der Y-Achse, damit der
// Seitenbereich senkrecht scrollt und der Kopf kleben bleibt. Diese Brücke
// schiebt nur die waagerechte Geste nach, die der Browser sonst verwirft.

const LINE_PX = 16;

export function horizontalDelta(event) {
  const axisX = event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX;
  const axisY = event.shiftKey && event.deltaX === 0 ? 0 : event.deltaY;
  const scale = event.deltaMode === 1 ? LINE_PX : 1;
  return { x: axisX * scale, y: axisY * scale };
}

function startElement(target) {
  if (target instanceof Element) return target;
  return target?.parentElement || null;
}

export function scrollClipOnWheel(event) {
  const { x, y } = horizontalDelta(event);
  if (x === 0 || Math.abs(x) <= Math.abs(y)) return;

  for (let el = startElement(event.target); el && el !== document.documentElement; el = el.parentElement) {
    const style = getComputedStyle(el);
    const overflowX = style.overflowX;
    if (overflowX !== 'auto' && overflowX !== 'scroll') continue;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 1) continue;
    if (style.overflowY !== 'clip') return;

    const next = Math.min(max, Math.max(0, el.scrollLeft + x));
    if (next === el.scrollLeft) return;
    el.scrollLeft = next;
    event.preventDefault();
    return;
  }
}

export function bindHorizontalClipWheel() {
  document.addEventListener('wheel', scrollClipOnWheel, { passive: false, capture: true });
}
