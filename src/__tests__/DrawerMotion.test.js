// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { gsap } from '../core/animation/gsap.js';
import {
  initDrawerMotion,
  stopDrawerMotion,
  playDrawer,
  DRAWER_EXIT_MS
} from '../core/animation/drawer.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Spult alle laufenden Timelines ans Ende (inkl. onComplete). */
const finish = () => gsap.globalTimeline.getChildren(false).forEach((t) => t.progress(1));

function mockReducedMotion(matches) {
  window.matchMedia = () => ({ matches });
}

function mountPage() {
  const page = document.createElement('div');
  page.id = 'app-root';
  document.body.append(page);
  return page;
}

function mountDrawer(id = 'test-drawer') {
  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id = `${id}-overlay`;
  const panel = document.createElement('div');
  panel.className = 'drawer-panel';
  panel.id = id;
  panel.innerHTML = `
    <div class="drawer-header">Titel</div>
    <div class="drawer-body"><div class="a">A</div><div class="b">B</div></div>
    <div class="drawer-footer">Fuss</div>
  `;
  document.body.append(overlay, panel);
  return { overlay, panel };
}

beforeEach(() => {
  mockReducedMotion(false);
  initDrawerMotion();
});

afterEach(() => {
  stopDrawerMotion();
  document.body.innerHTML = '';
  delete window.matchMedia;
});

describe('DRAWER_EXIT_MS', () => {
  it('liegt ueber der Schliess-Animation von 0.3s', () => {
    expect(DRAWER_EXIT_MS).toBeGreaterThan(300);
  });
});

describe('playDrawer', () => {
  it('liefert bei reduzierter Bewegung keine Timeline und setzt keinen Zustand', () => {
    mockReducedMotion(true);
    const { panel } = mountDrawer();
    expect(playDrawer(panel, true)).toBeNull();
    expect(panel.dataset.drawerState).toBeUndefined();
  });
});

describe('Beobachter: Oeffnen', () => {
  it('startet beim Anhaengen den Slide und die Section-Staffel', async () => {
    mountPage();
    const { panel, overlay } = mountDrawer();
    await tick();

    expect(panel.dataset.drawerState).toBe('opening');
    expect(panel.style.transform).toContain('translate');
    expect(overlay.style.opacity).not.toBe('');
    expect(panel.querySelector('.drawer-header').style.opacity).not.toBe('');
    expect(panel.querySelector('.drawer-body > .a').style.opacity).not.toBe('');
    expect(panel.querySelector('.drawer-footer').style.opacity).not.toBe('');
  });

  it('raeumt am Ende die inline-Styles von Panel, Sections und Overlay ab, die Seite bleibt skaliert', async () => {
    const page = mountPage();
    const { panel, overlay } = mountDrawer();
    await tick();
    finish();

    expect(panel.dataset.drawerState).toBe('open');
    expect(panel.style.transform).toBe('');
    expect(overlay.style.opacity).toBe('');
    expect(panel.querySelector('.drawer-header').style.opacity).toBe('');
    expect(page.style.transform).toContain('scale(0.98');
  });

  it('das spaetere show per requestAnimationFrame startet nichts doppelt', async () => {
    mountPage();
    const { panel } = mountDrawer();
    await tick();
    panel.classList.add('show');
    await tick();
    expect(panel.dataset.drawerState).toBe('opening');
  });

  it('findet das Overlay auch, wenn das Panel darin steckt (Adressen-Manager)', async () => {
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.innerHTML = '<div class="drawer-panel"><div class="drawer-header">H</div></div>';
    document.body.append(overlay);
    await tick();

    const panel = overlay.querySelector('.drawer-panel');
    expect(panel.dataset.drawerState).toBe('opening');
    expect(overlay.style.opacity).not.toBe('');
  });
});

describe('Beobachter: Schliessen', () => {
  it('startet das Schliessen, sobald show entfernt wird', async () => {
    mountPage();
    const { panel } = mountDrawer();
    panel.classList.add('show');
    await tick();
    finish();

    panel.classList.remove('show');
    await tick();
    expect(panel.dataset.drawerState).toBe('closing');
    finish();
    expect(panel.style.transform).toContain('translate(100%');
  });

  it('Ende des Schliessens setzt die Seite auf Normalgroesse zurueck', async () => {
    const page = mountPage();
    const { panel } = mountDrawer();
    panel.classList.add('show');
    await tick();
    finish();

    panel.classList.remove('show');
    await tick();
    finish();
    expect(page.style.transform).toBe('');
  });

  it('Panel im Overlay schliesst ueber active am Overlay', async () => {
    const overlay = document.createElement('div');
    overlay.className = 'drawer-overlay';
    overlay.innerHTML = '<div class="drawer-panel"><div class="drawer-header">H</div></div>';
    document.body.append(overlay);
    overlay.classList.add('active');
    await tick();
    const panel = overlay.querySelector('.drawer-panel');
    finish();

    overlay.classList.remove('active');
    await tick();
    expect(panel.dataset.drawerState).toBe('closing');
  });

  it('show erneut gesetzt oeffnet ein schliessendes Panel wieder', async () => {
    mountPage();
    const { panel } = mountDrawer();
    panel.classList.add('show');
    await tick();
    panel.classList.remove('show');
    await tick();
    expect(panel.dataset.drawerState).toBe('closing');

    panel.classList.add('show');
    await tick();
    expect(panel.dataset.drawerState).toBe('opening');
  });

  it('Entfernen des Panels waehrend des Oeffnens stellt die Seite wieder her', async () => {
    const page = mountPage();
    const { panel, overlay } = mountDrawer();
    await tick();

    panel.remove();
    overlay.remove();
    await tick();
    finish();
    expect(page.style.transform).toBe('');
    expect(panel.dataset.drawerState).toBeUndefined();
  });
});

describe('Seiten-Scale bei mehreren Drawern', () => {
  it('der zweite Drawer skaliert die Seite nicht noch einmal, sie bleibt bis zum letzten offen', async () => {
    const page = mountPage();
    mountDrawer('first');
    await tick();
    finish();
    expect(page.style.transform).toContain('scale(0.98');

    const second = mountDrawer('second');
    await tick();
    finish();
    expect(page.style.transform).toContain('scale(0.98');

    second.panel.classList.add('show');
    second.panel.classList.remove('show');
    await tick();
    finish();
    expect(second.panel.dataset.drawerState).toBe('closing');
    expect(page.style.transform).toContain('scale(0.98');

    const first = document.getElementById('first');
    first.classList.add('show');
    await tick();
    first.classList.remove('show');
    await tick();
    finish();
    expect(page.style.transform).toBe('');
  });
});
