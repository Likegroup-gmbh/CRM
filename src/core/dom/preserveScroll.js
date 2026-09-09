// preserveScroll
// Scroll-Erhalt ueber einen DOM-Tausch hinweg (innerHTML/outerHTML-Replace).
//
// Die Seam: Tabellen rendern sich komplett neu, statt Zeilen zu patchen.
// Ohne Erhalt kollabiert die Scrollposition beim Replace und der Browser
// springt. Dieses Modul ist die eine Stelle, die weiss, wie Scroll-Achsen
// gemerkt und nach dem Tausch wiederhergestellt werden.
//
// Verwendung:
//   preserveScroll(() => { table.outerHTML = ...; });            // nur Fenster
//   preserveScroll(() => { ... }, { keep: [container] });        // + lebender Node
//   preserveScroll(() => { ... }, { keep: ['.grid-wrapper', { sel: '#bar' }] });
//
// Element-Referenzen ueberleben den Tausch nur, wenn der Node selbst nicht
// ersetzt wird (z.B. der Container bei innerHTML). Fuer ersetzte Nodes einen
// Selektor-String uebergeben - er wird nach dem Tausch neu aufgeloest.
// Pro Target werden scrollTop UND scrollLeft wiederhergestellt; window.scrollY
// immer, ausser vertical: false.
// Restore laeuft im naechsten Frame (rAF), wenn der neue Baum layoutet ist.

/**
 * @param {() => any} fn - der eigentliche DOM-Tausch
 * @param {object} [opts]
 * @param {boolean} [opts.vertical] - window.scrollY halten (Default: true)
 * @param {Array<Element|string|{sel:string, scope?:Element}>} [opts.keep]
 * @returns {any} Rueckgabewert von fn()
 */
export function preserveScroll(fn, { vertical = true, keep = [] } = {}) {
  const scrollY = vertical ? window.scrollY : null;

  const targets = keep.map(entry => {
    if (typeof entry === 'string') {
      const el = document.querySelector(entry);
      return { sel: entry, scope: null, top: el?.scrollTop ?? 0, left: el?.scrollLeft ?? 0 };
    }
    if (entry && typeof entry === 'object' && 'sel' in entry) {
      const el = (entry.scope || document).querySelector(entry.sel);
      return { sel: entry.sel, scope: entry.scope || null, top: el?.scrollTop ?? 0, left: el?.scrollLeft ?? 0 };
    }
    // Lebender Node: Referenz bleibt gueltig (nur bei Nodes, die den Tausch ueberleben)
    return { el: entry, top: entry?.scrollTop ?? 0, left: entry?.scrollLeft ?? 0 };
  });

  const result = fn();

  requestAnimationFrame(() => {
    if (scrollY != null) window.scrollTo({ top: scrollY, behavior: 'instant' });

    targets.forEach(t => {
      const el = t.el || (t.scope || document).querySelector(t.sel);
      if (!el) return;
      if (t.top) el.scrollTop = t.top;
      if (t.left) el.scrollLeft = t.left;
    });
  });

  return result;
}
