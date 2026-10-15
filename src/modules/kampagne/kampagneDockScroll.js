// Die Budget-Karten scrollen mit der Seite weg. Titel und Tabs docken
// oben an. Die Tabelle fuellt danach den Rest bis zum unteren Rand und
// scrollt selbst, der Spaltenkopf bleibt stehen.
//
// Solange die Karten noch sichtbar sind, geht das Scrollen an die Seite,
// nicht in die Tabelle. Sonst schiebt sich die Tabelle ueber die Karten
// und der Kopf laeuft mit weg.

function contentTop(el, scroller) {
  return el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
}

function documentTop(el) {
  let y = 0;
  let node = el;
  const seen = new Set();
  while (node && !seen.has(node)) {
    seen.add(node);
    y += node.offsetTop;
    node = node.offsetParent;
  }
  return y;
}

export function bindKampagneDockScroll() {
  const mw = document.querySelector('.main-wrapper');
  const dock = document.querySelector('.kampagne-dock');
  const host = document.querySelector('.main-content');
  if (!mw || !dock || !host) return () => {};

  let frame = 0;

  const applyHeight = () => {
    const grid = mw.querySelector('.grid-wrapper');
    if (!grid) return;
    const gap = contentTop(grid, mw) - contentTop(dock, mw) - dock.offsetHeight;
    const available = Math.max(160, Math.round(mw.clientHeight - dock.offsetHeight - Math.max(0, gap)));
    const next = available + 'px';
    if (mw.style.getPropertyValue('--kampagne-table-h') !== next) {
      mw.style.setProperty('--kampagne-table-h', next);
    }
  };

  const cardsStillVisible = () => dock.getBoundingClientRect().top - mw.getBoundingClientRect().top > 1;

  // Weiter als bis zum Andocken darf die Seite nicht scrollen. Sonst
  // schiebt sich die Tabelle unter den Kopf und unten bleibt Leerraum.
  const pageLimit = () => Math.max(0, documentTop(dock) - documentTop(mw));

  const clampPage = () => {
    const limit = pageLimit();
    if (mw.scrollTop > limit) mw.scrollTop = limit;
  };

  const onWheel = (event) => {
    const grid = mw.querySelector('.grid-wrapper');
    if (!grid) return;
    if (event.deltaY > 0 && cardsStillVisible()) {
      event.preventDefault();
      mw.scrollTop = Math.min(pageLimit(), mw.scrollTop + event.deltaY);
      return;
    }
    if (event.deltaY < 0 && grid.scrollTop <= 0 && mw.scrollTop > 0) {
      event.preventDefault();
      mw.scrollTop = Math.max(0, mw.scrollTop + event.deltaY);
    }
  };

  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(applyHeight);
  };

  schedule();
  const ro = new ResizeObserver(schedule);
  ro.observe(dock);
  ro.observe(mw);
  const summary = mw.querySelector('.auftragsdetails-summary');
  if (summary) ro.observe(summary);

  const container = document.getElementById('kooperationen-videos-container');
  const mo = new MutationObserver(schedule);
  if (container) mo.observe(container, { childList: true });

  mw.addEventListener('scroll', clampPage, { passive: true });
  mw.addEventListener('wheel', onWheel, { passive: false, capture: true });
  window.addEventListener('resize', schedule);

  return () => {
    cancelAnimationFrame(frame);
    ro.disconnect();
    mo.disconnect();
    mw.removeEventListener('scroll', clampPage);
    mw.removeEventListener('wheel', onWheel, { capture: true });
    window.removeEventListener('resize', schedule);
    mw.style.removeProperty('--kampagne-table-h');
  };
}
