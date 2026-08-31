import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getScrollContainer,
  getScrollTop,
  saveScrollToCurrentHistory,
  applyScrollAfterNavigation,
  enableManualScrollRestoration,
  rememberScrollForRoute,
  savedScrollFor,
  historyScrollFor,
  clearSavedScrollPositions
} from '../core/NavigationScroll.js';

function mountScroller({ height = 200, contentHeight = 2000, scrollTop = 0 } = {}) {
  document.body.innerHTML = `
    <div class="main-wrapper" style="height:${height}px;overflow:auto">
      <div style="height:${contentHeight}px"></div>
    </div>
  `;
  const el = document.querySelector('.main-wrapper');
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: height });
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: contentHeight, writable: true });
  el.scrollTop = scrollTop;
  return el;
}

/**
 * Scroll-Container, der scrollTop wie ein echter Browser auf
 * scrollHeight - clientHeight begrenzt. jsdom tut das nicht, deshalb sind
 * Tests ohne dieses Verhalten blind fuer das eigentliche Problem:
 * zu frueh gesetztes scrollTop landet knapp unter dem Listenanfang.
 */
function mountClampingScroller({ height = 800, contentHeight = 2000 } = {}) {
  document.body.innerHTML = '<div class="creator-views view-grid"><div class="main-wrapper"></div></div>';
  const el = document.querySelector('.main-wrapper');
  let current = 0;
  let content = contentHeight;

  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => height });
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => content });
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => current,
    set: (value) => {
      const max = Math.max(0, content - height);
      current = Math.min(Math.max(0, Number(value) || 0), max);
    }
  });

  return {
    el,
    grow(by) {
      content += by;
    },
    addCard(id) {
      el.insertAdjacentHTML('beforeend', `<article class="creator-card" data-id="${id}"></article>`);
    }
  };
}

describe('NavigationScroll', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    clearSavedScrollPositions();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('findet .main-wrapper als Scroll-Container', () => {
    mountScroller();
    expect(getScrollContainer()).toBe(document.querySelector('.main-wrapper'));
  });

  it('speichert scrollTop im aktuellen History-Eintrag', () => {
    mountScroller({ scrollTop: 420 });
    const replaceSpy = vi.spyOn(window.history, 'replaceState');
    saveScrollToCurrentHistory();
    expect(replaceSpy).toHaveBeenCalled();
    const state = replaceSpy.mock.calls[0][0];
    expect(state.scrollTop).toBe(420);
    replaceSpy.mockRestore();
  });

  it('setzt Scroll auf 0 ohne gespeicherte Zielposition', async () => {
    mountScroller({ scrollTop: 800 });
    await applyScrollAfterNavigation({ top: 0 });
    expect(getScrollTop()).toBe(0);
  });

  it('stellt scrollTop wieder her, auch bei programmatischer Rückkehr', async () => {
    mountScroller({ scrollTop: 0 });
    await applyScrollAfterNavigation({ top: 640 });
    expect(getScrollTop()).toBe(640);
  });

  it('lädt weitere Chunks bis die Zielposition erreichbar ist', async () => {
    const el = mountScroller({ height: 200, contentHeight: 300, scrollTop: 0 });
    let contentHeight = 300;
    const loadMore = vi.fn(async () => {
      contentHeight += 400;
      Object.defineProperty(el, 'scrollHeight', { configurable: true, value: contentHeight });
      return true;
    });

    await applyScrollAfterNavigation({
      top: 700,
      loadMore
    });

    expect(loadMore).toHaveBeenCalled();
    expect(getScrollTop()).toBe(700);
  });

  it('lädt Chunks bis die angeklickte Karte existiert und scrollt sie in den Blick', async () => {
    const wrapper = mountScroller({ height: 200, contentHeight: 400, scrollTop: 0 });
    let present = false;
    const loadMore = vi.fn(async () => {
      present = true;
      wrapper.insertAdjacentHTML('beforeend', '<article class="creator-card" data-id="c42">Card</article>');
      Object.defineProperty(wrapper, 'scrollHeight', { configurable: true, value: 2000 });
      return true;
    });
    await applyScrollAfterNavigation({
      top: 900,
      anchorId: 'c42',
      loadMore
    });

    expect(loadMore).toHaveBeenCalled();
    expect(present).toBe(true);
    expect(getScrollTop()).toBe(900);
  });

  it('stellt die Listenposition wieder her, wenn die Karte schon geladen ist', async () => {
    mountScroller({ height: 200, contentHeight: 2000, scrollTop: 0 });
    document.querySelector('.main-wrapper').insertAdjacentHTML(
      'beforeend',
      '<article class="creator-card" data-id="c7">Card</article>'
    );

    await applyScrollAfterNavigation({ top: 640, anchorId: 'c7' });

    expect(getScrollTop()).toBe(640);
  });

  it('ignoriert den unsichtbaren Treffer, wenn Liste und Grid gleichzeitig im DOM liegen', async () => {
    mountScroller({ height: 200, contentHeight: 2000, scrollTop: 0 });
    const wrapper = document.querySelector('.main-wrapper');
    wrapper.insertAdjacentHTML('beforeend', `
      <table><tbody><tr data-id="c5"><td>versteckte Tabellenzeile</td></tr></tbody></table>
      <article class="creator-card" data-id="c5">sichtbare Karte</article>
    `);
    const card = wrapper.querySelector('.creator-card[data-id="c5"]');
    const row = wrapper.querySelector('tr[data-id="c5"]');
    Object.defineProperty(row, 'offsetParent', { configurable: true, value: null });
    Object.defineProperty(card, 'offsetParent', { configurable: true, value: wrapper });
    card.getBoundingClientRect = () => ({ top: 1000, height: 400 });

    await applyScrollAfterNavigation({ top: 900, anchorId: 'c5' });

    // Die Karte bestimmt die Feinausrichtung, nicht die versteckte Zeile.
    expect(getScrollTop()).toBe(1000 + 900 - 100 + 200);
  });

  it('landet bei der angeklickten Karte, obwohl der Browser scrollTop zwischendurch kappt', async () => {
    const scroller = mountClampingScroller({ height: 800, contentHeight: 2000 });
    let chunks = 0;
    const loadMore = vi.fn(async () => {
      chunks += 1;
      scroller.grow(2000);
      if (chunks === 4) scroller.addCard('c90');
      return true;
    });
    Element.prototype.scrollIntoView = vi.fn();

    await applyScrollAfterNavigation({
      top: 5000,
      anchorId: 'c90',
      loadMore
    });

    expect(document.querySelector('[data-id="c90"]')).not.toBeNull();
    expect(getScrollTop()).toBe(5000);
  });

  it('lädt weiter, wenn ein Chunk wegen paralleler Ladevorgänge kurz nichts liefert', async () => {
    const scroller = mountClampingScroller({ height: 800, contentHeight: 2000 });
    let calls = 0;
    const loadMore = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return false; // Race: Hintergrund-Chunk lief gerade
      scroller.grow(4000);
      return true;
    });

    await applyScrollAfterNavigation({ top: 4200, loadMore });

    expect(loadMore.mock.calls.length).toBeGreaterThan(1);
    expect(getScrollTop()).toBe(4200);
  });

  it('gibt auf, wenn die Liste wirklich zu Ende ist, statt endlos nachzuladen', async () => {
    mountClampingScroller({ height: 800, contentHeight: 2000 });
    const loadMore = vi.fn(async () => false);

    await applyScrollAfterNavigation({ top: 5000, anchorId: 'weg', loadMore });

    expect(loadMore.mock.calls.length).toBeLessThan(6);
    expect(getScrollTop()).toBe(1200);
  });

  it('setzt history.scrollRestoration auf manual wenn verfügbar', () => {
    Object.defineProperty(window.history, 'scrollRestoration', {
      configurable: true,
      writable: true,
      value: 'auto'
    });
    enableManualScrollRestoration();
    expect(window.history.scrollRestoration).toBe('manual');
  });

  it('merkt sich scrollTop pro Route und gibt ihn beim Zurückkehren zurück', () => {
    mountScroller({ scrollTop: 520 });
    rememberScrollForRoute('/creator');
    expect(savedScrollFor('/creator').top).toBe(520);
    expect(savedScrollFor('/creator/abc').top).toBe(0);
  });

  it('liest scrollTop aus history.state wenn die Route übereinstimmt', () => {
    const spy = vi.spyOn(window.history, 'state', 'get').mockReturnValue({ route: '/creator', scrollTop: 880 });
    expect(historyScrollFor('/creator').top).toBe(880);
    expect(historyScrollFor('/creator/abc').top).toBe(0);
    spy.mockRestore();
  });

  it('schreibt die angeklickte Karte in den History-Eintrag', () => {
    mountScroller({ scrollTop: 420 });
    rememberScrollForRoute('/creator', { anchorId: 'c42' });
    window.history.replaceState({ route: '/creator' }, '', '/creator');
    saveScrollToCurrentHistory();
    expect(historyScrollFor('/creator')).toEqual({ top: 420, anchorId: 'c42' });
  });
});
