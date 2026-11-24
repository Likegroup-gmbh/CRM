// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { gsap } from '../core/animation/gsap.js';
import { initViewToggleSlider, stopViewToggleSlider } from '../core/animation/viewToggleSlider.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Spult alle laufenden Timelines ans Ende (inkl. onComplete). */
const finish = () => gsap.globalTimeline.getChildren(false).forEach((t) => t.progress(1));

function mockReducedMotion(matches) {
  window.matchMedia = () => ({ matches });
}

/** jsdom kennt kein Layout: Buttons nebeneinander, je 80 x 28 px, 4 px Innenabstand: left = 4, 94, 184 … */
function layoutButtons(toggle) {
  toggle.querySelectorAll('.mdc-btn').forEach((btn, i) => {
    Object.defineProperties(btn, {
      offsetLeft: { configurable: true, get: () => 4 + i * 90 },
      offsetTop: { configurable: true, get: () => 4 },
      offsetWidth: { configurable: true, get: () => 80 },
      offsetHeight: { configurable: true, get: () => 28 },
      offsetParent: { configurable: true, get: () => toggle }
    });
  });
}

function toggleHtml(active, { ids = ['btn-view-list', 'btn-view-grid', 'btn-view-calendar'], className = 'view-toggle', attrs = '' } = {}) {
  const buttons = ids.map((id, i) => `<button id="${id}" class="mdc-btn mdc-btn--secondary${i === active ? ' active' : ''}">${id}</button>`).join('');
  return `<div class="${className}"${attrs}>${buttons}</div>`;
}

/** Umschalter in einen Wrapper schreiben, wie es eine Seite beim (Neu-)Rendern tut. */
function render(wrap, active, opts) {
  wrap.innerHTML = toggleHtml(active, opts);
  const toggle = wrap.firstElementChild;
  layoutButtons(toggle);
  return toggle;
}

function mount(active = 0, opts) {
  const wrap = document.createElement('div');
  document.body.append(wrap);
  return { wrap, toggle: render(wrap, active, opts) };
}

const thumbOf = (toggle) => toggle.querySelector('[data-view-slider-thumb]');
const x = (el) => gsap.getProperty(el, 'x');
/** Echter Tween am Element (gsap.set hat Dauer 0), auch vor seinem ersten Frame. */
const animating = (el) => gsap.getTweensOf(el).some((t) => t.duration() > 0);

function activate(toggle, index) {
  toggle.querySelectorAll('.mdc-btn').forEach((btn, i) => btn.classList.toggle('active', i === index));
}

beforeEach(() => {
  mockReducedMotion(false);
  window.history.replaceState({}, '', '/produkt');
  // Zeit anhalten: unter Last rendert der Ticker sonst schon zwischen Mutation und Assertion einen Frame.
  gsap.ticker.remove(gsap.updateRoot);
  initViewToggleSlider();
});

afterEach(() => {
  gsap.globalTimeline.clear();
  gsap.ticker.add(gsap.updateRoot);
  stopViewToggleSlider();
  document.body.innerHTML = '';
  delete window.matchMedia;
  vi.restoreAllMocks();
});

describe('Thumb', () => {
  it('neuer Umschalter: genau ein Thumb, sofort unter dem aktiven Button, statischer Umschalter wird relative', async () => {
    const { toggle } = mount(1, { attrs: ' style="position: static"' });
    await tick();

    expect(toggle.getAttribute('data-view-slider')).toBe('on');
    expect(toggle.style.position).toBe('relative');
    expect(toggle.querySelectorAll('[data-view-slider-thumb]')).toHaveLength(1);
    const thumb = thumbOf(toggle);
    expect(thumb.getAttribute('aria-hidden')).toBe('true');
    expect(animating(thumb)).toBe(false);
    expect(x(thumb)).toBe(94);
    expect(gsap.getProperty(thumb, 'y')).toBe(4);
    expect(thumb.style.width).toBe('80px');
    expect(thumb.style.height).toBe('28px');
  });

  it('Wechsel von .active: der Thumb gleitet zum neuen Button', async () => {
    const { toggle } = mount(0);
    await tick();
    const thumb = thumbOf(toggle);
    expect(x(thumb)).toBe(4);

    activate(toggle, 2);
    await tick();
    expect(animating(thumb)).toBe(true);
    finish();
    expect(x(thumb)).toBe(184);
  });

  it('kein aktiver Button: der Thumb wird ausgeblendet', async () => {
    const { toggle } = mount(0);
    await tick();

    activate(toggle, -1);
    await tick();
    expect(thumbOf(toggle).style.visibility).toBe('hidden');
  });

  it('reduzierte Bewegung: kein Gleiten, der Thumb springt', async () => {
    mockReducedMotion(true);
    const { toggle } = mount(0);
    await tick();

    activate(toggle, 1);
    await tick();
    const thumb = thumbOf(toggle);
    expect(animating(thumb)).toBe(false);
    expect(x(thumb)).toBe(94);
  });

  it('.segment-switch und data-view-slider="off" bleiben ohne Thumb', async () => {
    const seg = mount(0, { className: 'view-toggle segment-switch' }).toggle;
    const off = mount(0, { attrs: ' data-view-slider="off"' }).toggle;
    await tick();

    expect(thumbOf(seg)).toBeNull();
    expect(thumbOf(off)).toBeNull();
    expect(seg.hasAttribute('data-view-slider')).toBe(false);
  });
});

describe('Neu-Rendern beim Klick', () => {
  it('Umschalter ersetzt: der neue Thumb startet an der alten Position und gleitet', async () => {
    const { wrap } = mount(0);
    await tick();

    const toggle = render(wrap, 1);
    await tick();
    const thumb = thumbOf(toggle);
    expect(animating(thumb)).toBe(true);
    expect(x(thumb)).toBe(4);
    finish();
    expect(x(thumb)).toBe(94);
  });

  it('ersetzt mitten im Gleiten: der Nachfolger startet an der Zwischenposition', async () => {
    const { wrap, toggle } = mount(0);
    await tick();
    activate(toggle, 2);
    await tick();
    gsap.getTweensOf(thumbOf(toggle)).find((t) => t.duration() > 0).progress(0.5);
    const mitte = x(thumbOf(toggle));
    expect(mitte).toBeGreaterThan(4);
    expect(mitte).toBeLessThan(184);

    const next = render(wrap, 2);
    await tick();
    expect(x(thumbOf(next))).toBe(mitte);
    finish();
    expect(x(thumbOf(next))).toBe(184);
  });

  it('Seitenwechsel (anderer Pfad): der neue Thumb sitzt sofort', async () => {
    const { wrap } = mount(0);
    await tick();

    window.history.pushState({}, '', '/briefing');
    const toggle = render(wrap, 1);
    await tick();
    expect(animating(thumbOf(toggle))).toBe(false);
    expect(x(thumbOf(toggle))).toBe(94);
  });

  it('andere Buttons: kein Gleiten', async () => {
    const { wrap } = mount(0);
    await tick();

    const toggle = render(wrap, 1, { ids: ['a', 'b'] });
    await tick();
    expect(animating(thumbOf(toggle))).toBe(false);
  });

  it('zu spaet neu gerendert: kein Gleiten', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const { wrap } = mount(0);
    await tick();
    wrap.innerHTML = '';
    await tick();

    now.mockReturnValue(1000 + 5000);
    const toggle = render(wrap, 1);
    await tick();
    expect(animating(thumbOf(toggle))).toBe(false);
  });

  it('die Position wird nur einmal uebergeben', async () => {
    const { wrap } = mount(0);
    await tick();
    wrap.innerHTML = '';
    await tick();

    const first = render(document.body.appendChild(document.createElement('div')), 1);
    const second = render(document.body.appendChild(document.createElement('div')), 1);
    await tick();
    expect(animating(thumbOf(first))).toBe(true);
    expect(animating(thumbOf(second))).toBe(false);
  });
});
