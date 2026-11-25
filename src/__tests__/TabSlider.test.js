// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { gsap } from '../core/animation/gsap.js';
import { initTabSlider, stopTabSlider } from '../core/animation/tabSlider.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Spult alle laufenden Timelines ans Ende (inkl. onComplete). */
const finish = () => gsap.globalTimeline.getChildren(false).forEach((t) => t.progress(1));

function mockReducedMotion(matches) {
  window.matchMedia = () => ({ matches });
}

/** jsdom kennt kein Layout: Position und Breite je Element vorgeben. */
function stubLayout(el, { left, width, parent }) {
  Object.defineProperty(el, 'offsetLeft', { configurable: true, get: () => left });
  Object.defineProperty(el, 'offsetWidth', { configurable: true, get: () => width });
  Object.defineProperty(el, 'offsetParent', { configurable: true, get: () => parent });
}

/** Tabs nebeneinander, je 80 px breit mit 10 px Abstand: left = 10, 100, 190 … */
function layoutTabs(nav) {
  nav.querySelectorAll('.tab-button, .drawer-tab-btn').forEach((tab, i) => {
    stubLayout(tab, { left: 10 + i * 90, width: 80, parent: nav });
  });
}

function buttons(active, labels = ['A', 'B', 'C']) {
  return labels.map((label, i) => `<button class="tab-button${i === active ? ' active' : ''}" data-tab="${label}">${label}</button>`).join('');
}

function mountNav({ active = 0, className = 'tab-navigation', attrs = '' } = {}) {
  const host = document.createElement('div');
  host.innerHTML = `<div class="${className}"${attrs}>${buttons(active)}</div>`;
  const nav = host.firstElementChild;
  layoutTabs(nav);
  document.body.append(nav);
  return nav;
}

const barOf = (nav) => nav.querySelector('[data-tab-slider-bar]');
const x = (el) => gsap.getProperty(el, 'x');
/** Echter Tween am Element (gsap.set hat Dauer 0), auch vor seinem ersten Frame. */
const animating = (el) => gsap.getTweensOf(el).some((t) => t.duration() > 0);

function activate(nav, index) {
  nav.querySelectorAll('.tab-button').forEach((btn, i) => btn.classList.toggle('active', i === index));
}

beforeEach(() => {
  mockReducedMotion(false);
  // Zeit anhalten: unter Last rendert der Ticker sonst schon zwischen Mutation und Assertion einen Frame.
  // pause() geht nicht, dann rendert auch gsap.set nicht sofort.
  gsap.ticker.remove(gsap.updateRoot);
  initTabSlider();
});

afterEach(() => {
  gsap.globalTimeline.clear();
  gsap.ticker.add(gsap.updateRoot);
  stopTabSlider();
  document.body.innerHTML = '';
  delete window.matchMedia;
});

describe('Balken', () => {
  it('neue Leiste: genau ein Balken, sofort unter dem aktiven Tab', async () => {
    const nav = mountNav({ active: 1 });
    await tick();

    expect(nav.getAttribute('data-tab-slider')).toBe('on');
    expect(nav.querySelectorAll('[data-tab-slider-bar]')).toHaveLength(1);
    const bar = barOf(nav);
    expect(bar.getAttribute('aria-hidden')).toBe('true');
    expect(animating(bar)).toBe(false);
    expect(x(bar)).toBe(100);
    expect(bar.style.width).toBe('80px');
  });

  it('Wechsel von .active: der Balken gleitet zum neuen Tab', async () => {
    const nav = mountNav({ active: 0 });
    await tick();
    const bar = barOf(nav);
    expect(x(bar)).toBe(10);

    activate(nav, 2);
    await tick();
    expect(animating(bar)).toBe(true);
    finish();
    expect(x(bar)).toBe(190);
  });

  it('reagiert auch auf aria-selected (Tabs mit role="tab")', async () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <div class="tab-navigation" role="tablist">
        <button role="tab" aria-selected="true">A</button>
        <button role="tab" aria-selected="false">B</button>
      </div>`;
    const nav = host.firstElementChild;
    nav.querySelectorAll('[role="tab"]').forEach((tab, i) => stubLayout(tab, { left: i * 50, width: 40, parent: nav }));
    document.body.append(nav);
    await tick();

    const [first, second] = nav.querySelectorAll('[role="tab"]');
    first.setAttribute('aria-selected', 'false');
    second.setAttribute('aria-selected', 'true');
    await tick();
    finish();
    expect(x(barOf(nav))).toBe(50);
  });

  it('Buttons neu gerendert: weiterhin ein Balken, er startet an der alten Position', async () => {
    const nav = mountNav({ active: 0 });
    await tick();

    nav.innerHTML = buttons(2);
    layoutTabs(nav);
    await tick();

    expect(nav.querySelectorAll('[data-tab-slider-bar]')).toHaveLength(1);
    const bar = barOf(nav);
    expect(animating(bar)).toBe(true);
    expect(x(bar)).toBe(10);
    finish();
    expect(x(bar)).toBe(190);
  });

  it('Leiste komplett ersetzt: der Balken der neuen Leiste springt ohne Gleiten', async () => {
    const wrap = document.createElement('div');
    document.body.append(wrap);
    wrap.innerHTML = `<div class="tab-navigation">${buttons(0)}</div>`;
    layoutTabs(wrap.firstElementChild);
    await tick();

    wrap.innerHTML = `<div class="tab-navigation">${buttons(1)}</div>`;
    const nav = wrap.firstElementChild;
    layoutTabs(nav);
    await tick();

    expect(animating(barOf(nav))).toBe(false);
    expect(x(barOf(nav))).toBe(100);
  });

  it('Zaehler aendert sich: der Balken zieht die Breite nach', async () => {
    const nav = mountNav({ active: 0 });
    await tick();
    const tab = nav.querySelector('.tab-button');
    stubLayout(tab, { left: 10, width: 120, parent: nav });

    tab.textContent = 'A 12';
    await tick();
    finish();
    expect(barOf(nav).style.width).toBe('120px');
  });

  it('reduzierte Bewegung: kein Gleiten, der Balken springt', async () => {
    mockReducedMotion(true);
    const nav = mountNav({ active: 0 });
    await tick();

    activate(nav, 1);
    await tick();
    const bar = barOf(nav);
    expect(animating(bar)).toBe(false);
    expect(x(bar)).toBe(100);
  });

  it('kein aktiver Tab: der Balken wird ausgeblendet', async () => {
    const nav = mountNav({ active: 0 });
    await tick();

    activate(nav, -1);
    await tick();
    expect(barOf(nav).style.visibility).toBe('hidden');
  });

  it('Drawer-Tabs bekommen den Balken, eine statische Leiste wird relative', async () => {
    const host = document.createElement('div');
    host.innerHTML = `<div class="drawer-tab-nav" style="position: static"><button class="drawer-tab-btn active">A</button><button class="drawer-tab-btn">B</button></div>`;
    const nav = host.firstElementChild;
    layoutTabs(nav);
    document.body.append(nav);
    await tick();

    expect(nav.style.position).toBe('relative');
    expect(x(barOf(nav))).toBe(10);
  });

  it('data-tab-slider="off" bleibt ohne Balken', async () => {
    const nav = mountNav({ attrs: ' data-tab-slider="off"' });
    await tick();
    expect(barOf(nav)).toBeNull();
  });
});

describe('Inhalt einblenden', () => {
  function mountPanes() {
    document.body.innerHTML = `
      <div class="tab-pane active" id="one"><p>a</p><p>b</p></div>
      <div class="tab-pane" id="two"><p>c</p><p>d</p></div>`;
    return [document.getElementById('one'), document.getElementById('two')];
  }

  it('erstes Rendern blendet nichts ein', async () => {
    const [one] = mountPanes();
    await tick();
    expect(animating(one.firstElementChild)).toBe(false);
  });

  it('.tab-pane bekommt active: die Kinder blenden ein und sind danach sauber', async () => {
    const [one, two] = mountPanes();
    await tick();

    one.classList.remove('active');
    two.classList.add('active');
    await tick();
    expect(animating(two.firstElementChild)).toBe(true);
    expect(animating(one.firstElementChild)).toBe(false);

    finish();
    expect(two.firstElementChild.style.opacity).toBe('');
    expect(two.firstElementChild.style.transform).toBe('');
  });

  it('remove und add am selben Pane ist kein Wechsel', async () => {
    const [one] = mountPanes();
    await tick();

    one.classList.remove('active');
    one.classList.add('active');
    await tick();
    expect(animating(one.firstElementChild)).toBe(false);
  });

  it('Pane mit Spinner: blendet erst ein, wenn der Inhalt kommt', async () => {
    document.body.innerHTML = '<div class="workflow-pane" hidden></div>';
    const pane = document.querySelector('.workflow-pane');
    await tick();

    pane.hidden = false;
    pane.innerHTML = '<div class="table-loading-container"><div class="table-loading-spinner"></div></div>';
    await tick();
    expect(animating(pane.firstElementChild)).toBe(false);

    pane.innerHTML = '<table><tbody><tr><td>x</td></tr></tbody></table>';
    await tick();
    expect(animating(pane.firstElementChild)).toBe(true);
  });

  it('Video-Browser-Panels und data-tab-fade="off" bleiben unberuehrt', async () => {
    document.body.innerHTML = `
      <div role="tabpanel" data-vb-panel="details" hidden><p>vb</p></div>
      <div class="workflow-pane" data-tab-fade="off" hidden><p>videos</p></div>`;
    const [vb, videos] = document.body.children;
    await tick();

    vb.hidden = false;
    videos.hidden = false;
    await tick();
    expect(animating(vb.firstElementChild)).toBe(false);
    expect(animating(videos.firstElementChild)).toBe(false);
  });

  it('reduzierte Bewegung: kein Einblenden', async () => {
    mockReducedMotion(true);
    const [one, two] = mountPanes();
    await tick();

    one.classList.remove('active');
    two.classList.add('active');
    await tick();
    expect(animating(two.firstElementChild)).toBe(false);
  });
});
