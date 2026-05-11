/**
 * PageTransitionHelper.js
 * Zentraler Helper fuer Seiten-/Wizard-Uebergaenge mit Fade-Animation.
 * Einmal aendern = ueberall geaendert.
 *
 * Zwei Modi:
 *   - Full-Swap: renderFn ersetzt das Element komplett (neues Element per newElementSelector finden)
 *   - In-Place: renderFn aktualisiert Inhalt, aeusseres Element bleibt bestehen
 */

export const PageTransitionHelper = {
  config: {
    fadeOutDuration: 220,
    fadeInDuration: 300,
    fadeOutClass: 'pe-fade-out',
    fadeInClass: 'pe-fade-in',
    fallbackTimeout: 400
  },

  /**
   * Animierter Seitenwechsel
   * @param {HTMLElement} element - Das aktuelle DOM-Element das ausgefadet wird
   * @param {Function} renderFn - (async) Funktion die das neue DOM erzeugt
   * @param {Object} [opts]
   * @param {string} [opts.newElementSelector] - CSS-Selector fuer das neue Element nach Full-Swap
   */
  async transition(element, renderFn, opts = {}) {
    const { newElementSelector } = opts;
    if (!element) { await renderFn(); return; }

    element.classList.add(this.config.fadeOutClass);
    await new Promise(r => setTimeout(r, this.config.fadeOutDuration));

    await renderFn();

    const target = newElementSelector
      ? document.querySelector(newElementSelector)
      : element;
    if (!target) return;

    target.classList.remove(this.config.fadeOutClass);
    target.classList.add(this.config.fadeInClass);

    await new Promise(resolve => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        target.classList.remove(this.config.fadeInClass);
        target.removeEventListener('animationend', onDone);
        clearTimeout(fallbackTimer);
        resolve();
      };
      const onDone = () => settle();
      target.addEventListener('animationend', onDone);
      const fallbackTimer = setTimeout(settle, this.config.fallbackTimeout);
    });
  }
};
