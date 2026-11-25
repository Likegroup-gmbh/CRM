// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { stampMenu, playMenu, closeMenu, discardMenu } from '../core/animation/menu.js';
import { ActionsDropdown } from '../core/ActionsDropdown.js';

const MENU_HTML = `
  <a href="#" class="action-item" data-action="view">Ansehen</a>
  <div class="action-separator"></div>
  <div class="action-submenu">
    <a href="#" class="action-item has-submenu">Status</a>
    <div class="submenu"><a href="#" class="submenu-item" data-action="set-field">Offen</a></div>
  </div>
  <a href="#" class="action-item action-danger" data-action="delete">Loeschen</a>
`;

function portal() {
  const el = document.createElement('div');
  el.className = 'actions-dropdown-portal';
  el.innerHTML = MENU_HTML;
  document.body.append(el);
  return el;
}

function mockReducedMotion(matches) {
  window.matchMedia = () => ({ matches });
}

afterEach(() => {
  document.body.innerHTML = '';
  delete window.matchMedia;
});

describe('stampMenu', () => {
  it('taggt das Portal und nur direkte Zeilen, nicht verschachtelte Submenue-Items', () => {
    const el = portal();
    const rows = stampMenu(el);
    expect(el.hasAttribute('data-menu')).toBe(true);
    expect(rows).toHaveLength(4);
    expect(el.querySelectorAll('[data-menu-item]')).toHaveLength(4);
    expect(el.querySelector('.submenu-item').hasAttribute('data-menu-item')).toBe(false);
    expect(el.querySelector('.has-submenu').hasAttribute('data-menu-item')).toBe(false);
  });
});

describe('playMenu', () => {
  it('liefert bei reduzierter Bewegung keine Timeline und macht das Menue sichtbar', () => {
    mockReducedMotion(true);
    const el = portal();
    expect(playMenu(el, true)).toBeNull();
    // GSAP autoAlpha: sichtbar = visibility inherit + opacity 1 (ueberstimmt den CSS-Startzustand)
    expect(el.style.visibility).toBe('inherit');
    expect(el.style.opacity).toBe('1');
    expect(playMenu(el, false)).toBeNull();
  });

  it('Oeffnen liefert eine Timeline und raeumt inline-Styles der Items am Ende ab', () => {
    mockReducedMotion(false);
    const el = portal();
    const timeline = playMenu(el, true);
    expect(timeline).not.toBeNull();
    const first = el.querySelector('[data-menu-item]');
    expect(first.style.opacity).toBe('0');
    timeline.progress(1);
    expect(first.style.opacity).toBe('');
    expect(first.style.transform).toBe('');
    expect(el.style.visibility).toBe('inherit');
    expect(el.style.opacity).toBe('1');
  });

  it('bricht eine laufende Timeline am selben Portal ab', () => {
    mockReducedMotion(false);
    const el = portal();
    const first = playMenu(el, true);
    const second = playMenu(el, false);
    expect(first.isActive()).toBe(false);
    expect(second).not.toBe(first);
  });
});

describe('closeMenu', () => {
  it('entfernt das Portal erst nach Ende der Timeline', () => {
    mockReducedMotion(false);
    const el = portal();
    playMenu(el, true).progress(1);
    closeMenu(el);
    expect(document.body.contains(el)).toBe(true);
    expect(el.dataset.menuState).toBe('closing');
    expect(el.style.pointerEvents).toBe('none');
  });

  it('entfernt sofort bei reduzierter Bewegung', () => {
    mockReducedMotion(true);
    const el = portal();
    closeMenu(el);
    expect(document.body.contains(el)).toBe(false);
  });

  it('discardMenu entfernt sofort', () => {
    mockReducedMotion(false);
    const el = portal();
    playMenu(el, true);
    discardMenu(el);
    expect(document.body.contains(el)).toBe(false);
  });
});

describe('ActionsDropdown.toggleDropdown', () => {
  function setup() {
    document.body.innerHTML = `
      <div class="actions-dropdown-container" data-entity-type="kampagne">
        <button class="actions-toggle" aria-expanded="false">...</button>
        <div class="actions-dropdown">${MENU_HTML}</div>
      </div>
      <div class="actions-dropdown-container" data-entity-type="kampagne">
        <button class="actions-toggle" id="second" aria-expanded="false">...</button>
        <div class="actions-dropdown">${MENU_HTML}</div>
      </div>
    `;
    return new ActionsDropdown();
  }

  it('stempelt das Portal beim Oeffnen', () => {
    mockReducedMotion(false);
    const dd = setup();
    dd.toggleDropdown(document.querySelector('.actions-toggle'));
    const el = document.querySelector('.actions-dropdown-portal');
    expect(el.hasAttribute('data-menu')).toBe(true);
    expect(el.querySelectorAll('[data-menu-item]')).toHaveLength(4);
    expect(el.dataset.menuState).toBe('open');
  });

  it('zweiter Klick am selben Button schliesst animiert, Wechsel entfernt sofort', () => {
    mockReducedMotion(false);
    const dd = setup();
    const first = document.querySelector('.actions-toggle');
    dd.toggleDropdown(first);
    dd.toggleDropdown(first);
    const closing = document.querySelector('.actions-dropdown-portal');
    expect(closing.dataset.menuState).toBe('closing');
    expect(first.getAttribute('aria-expanded')).toBe('false');

    // Waehrend des Ausblendens oeffnet derselbe Button wieder ein frisches Menue
    dd.toggleDropdown(first);
    const portals = document.querySelectorAll('.actions-dropdown-portal');
    expect(portals).toHaveLength(1);
    expect(portals[0].dataset.menuState).toBe('open');

    dd.toggleDropdown(document.getElementById('second'));
    const after = document.querySelectorAll('.actions-dropdown-portal');
    expect(after).toHaveLength(1);
    expect(after[0]._sourceToggle.id).toBe('second');
  });

  it('closeAllDropdowns({ immediate }) entfernt ohne Animation', () => {
    mockReducedMotion(false);
    const dd = setup();
    dd.toggleDropdown(document.querySelector('.actions-toggle'));
    dd.closeAllDropdowns({ immediate: true });
    expect(document.querySelector('.actions-dropdown-portal')).toBeNull();
  });
});
