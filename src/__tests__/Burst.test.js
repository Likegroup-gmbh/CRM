// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { burstLayers, playBurst } from '../core/animation/burst.js';
import { renderFavorit, patchFavorit } from '../modules/creator/creatorFavorit.js';

function host(iconKey = 'star') {
  const el = document.createElement('button');
  el.setAttribute('data-burst', '');
  el.innerHTML = burstLayers(iconKey);
  document.body.append(el);
  return el;
}

function mockReducedMotion(matches) {
  window.matchMedia = () => ({ matches });
}

afterEach(() => {
  document.body.innerHTML = '';
  delete window.matchMedia;
  delete window.currentUser;
});

describe('burstLayers', () => {
  it('baut Glyph, Fill und acht Funken fuer beliebige Icons', () => {
    const el = host('heart');
    expect(el.querySelector('[data-burst-glyph] use').getAttribute('href')).toBe('#crm-icon-heart');
    expect(el.querySelector('[data-burst-fill] use').getAttribute('href')).toBe('#crm-icon-heart');
    expect(el.querySelectorAll('[data-burst-spark]')).toHaveLength(8);
  });
});

describe('playBurst', () => {
  it('setzt bei reduzierter Bewegung nur die Klasse', () => {
    mockReducedMotion(true);
    const el = host();
    expect(playBurst(el, true)).toBeNull();
    expect(el.classList.contains('is-on')).toBe(true);
    expect(playBurst(el, false)).toBeNull();
    expect(el.classList.contains('is-on')).toBe(false);
  });

  it('macht ohne Burst-Schichten nur den Klassenwechsel', () => {
    const el = document.createElement('button');
    expect(playBurst(el, true)).toBeNull();
    expect(el.classList.contains('is-on')).toBe(true);
  });

  it('Merken setzt is-on sofort, Entfernen erst am Ende', () => {
    mockReducedMotion(false);
    const el = host();
    const timeline = playBurst(el, true);
    expect(timeline).not.toBeNull();
    expect(el.classList.contains('is-on')).toBe(true);
    timeline.progress(1);

    const out = playBurst(el, false);
    expect(el.classList.contains('is-on')).toBe(true);
    out.progress(1);
    expect(el.classList.contains('is-on')).toBe(false);
    expect(el.querySelector('[data-burst-fill]').style.opacity).toBe('');
  });

  it('bricht eine laufende Timeline am selben Host ab', () => {
    mockReducedMotion(false);
    const el = host();
    const first = playBurst(el, true);
    const second = playBurst(el, true);
    expect(first).not.toBe(second);
    expect(first.isActive()).toBe(false);
  });
});

describe('Favorit-Stern', () => {
  it('rendert den Stern als Burst-Host', () => {
    window.currentUser = { auth_user_id: 'u1' };
    const wrap = document.createElement('div');
    wrap.innerHTML = renderFavorit({ id: 'c1', favoriten: [{ user_id: 'u1', name: 'A' }] });
    const star = wrap.querySelector('.creator-favorit__star');
    expect(star.hasAttribute('data-burst')).toBe(true);
    expect(star.classList.contains('is-on')).toBe(true);
    expect(star.querySelectorAll('[data-burst-spark]')).toHaveLength(8);
  });

  it('patcht Zaehler und Beschriftung, ohne den Stern zu ersetzen', () => {
    window.currentUser = { auth_user_id: 'u1' };
    const wrap = document.createElement('div');
    wrap.innerHTML = renderFavorit({ id: 'c1', favoriten: [] });
    const star = wrap.querySelector('.creator-favorit__star');
    expect(wrap.querySelector('.creator-favorit__count')).toBeNull();

    patchFavorit(wrap, [{ user_id: 'u1', name: 'A' }], 'c1');
    expect(wrap.querySelector('.creator-favorit__star')).toBe(star);
    expect(star.getAttribute('aria-pressed')).toBe('true');
    expect(star.getAttribute('aria-label')).toBe('Favorit entfernen');
    expect(wrap.querySelector('.creator-favorit__count').textContent).toBe('1');

    patchFavorit(wrap, [], 'c1');
    expect(star.getAttribute('aria-pressed')).toBe('false');
    expect(wrap.querySelector('.creator-favorit__count')).toBeNull();
  });
});
