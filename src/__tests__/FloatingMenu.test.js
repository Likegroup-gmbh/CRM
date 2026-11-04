// FloatingMenu.test.js
// Layout-Varianten: icon / icon-label / icon-label-sub

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderFloatingMenuItem, openFloatingMenu } from '../core/components/FloatingMenu.js';

describe('renderFloatingMenuItem', () => {
  it('layout icon: nur Icon, kein Label/Subtext', () => {
    const html = renderFloatingMenuItem({
      id: 'k',
      icon: 'clapperboard',
      label: 'Klassisch',
      subtext: 'Ruhige Shots, klare Schnitte',
      layout: 'icon'
    });
    expect(html).toContain('crm-fmenu-item--icon');
    expect(html).toContain('crm-fmenu-icon');
    expect(html).not.toContain('crm-fmenu-label');
    expect(html).not.toContain('crm-fmenu-sub');
    expect(html).toContain('title="Klassisch"');
  });

  it('layout icon-label: Label, kein Subtext', () => {
    const html = renderFloatingMenuItem({
      id: 'k',
      icon: 'clapperboard',
      label: 'Klassisch',
      subtext: 'Ruhige Shots, klare Schnitte',
      layout: 'icon-label'
    });
    expect(html).toContain('crm-fmenu-item--icon-label');
    expect(html).toContain('Klassisch');
    expect(html).not.toContain('Ruhige Shots');
    expect(html).not.toContain('crm-fmenu-sub');
  });

  it('layout icon-label-sub: Label + Subtext', () => {
    const html = renderFloatingMenuItem({
      id: 'd',
      icon: 'spark-doc',
      label: 'Dynamisch',
      subtext: 'Schnelle Wechsel, mehr Szenen',
      layout: 'icon-label-sub',
      data: { modus: 'dynamisch' }
    });
    expect(html).toContain('crm-fmenu-item--icon-label-sub');
    expect(html).toContain('Dynamisch');
    expect(html).toContain('Schnelle Wechsel, mehr Szenen');
    expect(html).toContain('crm-fmenu-sub');
    expect(html).toContain('data-modus="dynamisch"');
  });

  it('active: is-active, Check und aria-checked – inaktiv ohne Check', () => {
    const aktiv = renderFloatingMenuItem({
      id: 'v1',
      label: 'v1.13',
      subtext: 'Manuell · Hook',
      layout: 'icon-label-sub',
      active: true
    });
    expect(aktiv).toContain('is-active');
    expect(aktiv).toContain('crm-fmenu-check');
    expect(aktiv).toContain('aria-checked="true"');
    expect(aktiv).toContain('check-filled');

    const inaktiv = renderFloatingMenuItem({
      id: 'v0',
      label: 'v1',
      layout: 'icon-label'
    });
    expect(inaktiv).not.toContain('is-active');
    expect(inaktiv).not.toContain('crm-fmenu-check');
    expect(inaktiv).not.toContain('aria-checked');
  });

  it('icon-label-sub ohne subtext fällt auf icon-label zurück', () => {
    const html = renderFloatingMenuItem({
      id: 'k',
      icon: 'clapperboard',
      label: 'Klassisch',
      layout: 'icon-label-sub'
    });
    expect(html).toContain('crm-fmenu-item--icon-label');
    expect(html).not.toContain('crm-fmenu-sub');
  });
});

describe('openFloatingMenu', () => {
  let el;

  beforeEach(() => {
    el = document.createElement('div');
    el.hidden = true;
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
  });

  it('rendert Items und ruft onSelect mit id', () => {
    const onSelect = vi.fn();
    openFloatingMenu({
      el,
      items: [
        { id: 'klassisch', icon: 'clapperboard', label: 'Klassisch' },
        { id: 'dynamisch', icon: 'spark-doc', label: 'Dynamisch' }
      ],
      layout: 'icon-label',
      onSelect
    });

    expect(el.hidden).toBe(false);
    expect(el.querySelectorAll('.crm-fmenu-item').length).toBe(2);
    el.querySelector('[data-id="dynamisch"]').click();
    expect(el.hidden).toBe(true);
    expect(onSelect).toHaveBeenCalledWith('dynamisch');
  });

  it('Item mit children rendert Parent-Trigger + Flyout', () => {
    const html = renderFloatingMenuItem({
      id: 'formatierung',
      label: 'Formatierung',
      children: [
        { id: 'fett', icon: 'bold', label: 'Fett' },
        { id: 'kursiv', icon: 'italic', label: 'Kursiv' }
      ]
    });
    expect(html).toContain('crm-fmenu-group');
    expect(html).toContain('crm-fmenu-item--parent');
    expect(html).toContain('data-has-children="true"');
    expect(html).toContain('crm-fmenu-chevron');
    expect(html).toContain('crm-fmenu-flyout');
    expect(html).toContain('data-id="fett"');
    expect(html).toContain('data-id="kursiv"');
  });

  it('Parent-Klick toggelt nur Flyout, Kind-Klick ruft onSelect', () => {
    const onSelect = vi.fn();
    openFloatingMenu({
      el,
      items: [
        { id: 'kommentieren', label: 'Kommentieren' },
        {
          id: 'formatierung',
          label: 'Formatierung',
          children: [{ id: 'fett', label: 'Fett' }]
        }
      ],
      layout: 'icon-label',
      onSelect
    });

    const parent = el.querySelector('[data-id="formatierung"]');
    parent.click();
    expect(onSelect).not.toHaveBeenCalled();
    expect(el.hidden).toBe(false);
    expect(parent.closest('.crm-fmenu-group').classList.contains('is-open')).toBe(true);

    el.querySelector('[data-id="fett"]').click();
    expect(onSelect).toHaveBeenCalledWith('fett');
    expect(el.hidden).toBe(true);
  });

  it('öffnet unter dem Anker, wenn darunter Platz ist', () => {
    const { wrap, restore } = mockViewport({ height: 800, width: 1200 });
    mockSize(el, { height: 180, width: 220 });

    openFloatingMenu({
      el,
      anchor: { top: 200, bottom: 220, left: 40, right: 180 },
      wrap,
      items: [{ id: 'a', label: 'Kommentieren' }]
    });

    // 220 - wrap.top(100) + 6
    expect(el.style.top).toBe('126px');
    expect(el.style.maxHeight).toBe('');
    restore();
  });

  it('öffnet über dem Anker, wenn das Menü unten aus dem Viewport ragen würde', () => {
    const { wrap, restore } = mockViewport({ height: 800, width: 1200 });
    mockSize(el, { height: 320, width: 220 });

    openFloatingMenu({
      el,
      anchor: { top: 720, bottom: 740, left: 40, right: 180 },
      wrap,
      items: [{ id: 'a', label: 'Formatierung' }]
    });

    // 720 - wrap.top(100) - 6 - 320
    expect(el.style.top).toBe('294px');
    expect(el.style.maxHeight).toBe('');
    restore();
  });

  it('begrenzt die Höhe, wenn auch über dem Anker nicht genug Platz ist', () => {
    const { wrap, restore } = mockViewport({ height: 400, width: 1200 });
    mockSize(el, { height: 360, width: 220 });

    openFloatingMenu({
      el,
      anchor: { top: 250, bottom: 270, left: 40, right: 180 },
      wrap,
      items: [{ id: 'a', label: 'Formatierung' }]
    });

    // Editor beginnt bei y=100: darueber ist das Menue geclippt.
    // spaceAbove 144 > spaceBelow 116 → oben, Deckel = 144
    expect(el.style.maxHeight).toBe('144px');
    expect(el.style.overflowY).toBe('auto');
    expect(el.style.top).toBe('0px');
    restore();
  });

  it('klappt das Flyout nach oben, wenn es unten aus dem Viewport ragt', () => {
    const { wrap, restore } = mockViewport({ height: 400, width: 1200 });
    openFloatingMenu({
      el,
      anchor: { top: 40, bottom: 60, left: 40, right: 180 },
      wrap,
      items: [{
        id: 'formatierung',
        label: 'Formatierung',
        children: [{ id: 'fett', label: 'Fett' }]
      }]
    });

    const flyout = el.querySelector('.crm-fmenu-flyout');
    const group = el.querySelector('.crm-fmenu-group');
    group.getBoundingClientRect = () => ({ top: 300, bottom: 340, left: 40, right: 200, width: 160, height: 40 });
    flyout.getBoundingClientRect = () => (
      flyout.classList.contains('crm-fmenu-flyout--up')
        ? { top: 200, bottom: 332, left: 208, right: 360, width: 152, height: 132 }
        : { top: 300, bottom: 460, left: 208, right: 360, width: 152, height: 160 }
    );

    el.querySelector('.crm-fmenu-item--parent').dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(flyout.classList.contains('crm-fmenu-flyout--up')).toBe(true);
    restore();
  });

  it('lässt das Flyout unten, wenn darüber weniger Platz ist', () => {
    const { wrap, restore } = mockViewport({ height: 800, width: 1200 });
    openFloatingMenu({
      el,
      anchor: { top: 40, bottom: 60, left: 40, right: 180 },
      wrap,
      items: [{
        id: 'formatierung',
        label: 'Formatierung',
        children: [{ id: 'fett', label: 'Fett' }]
      }]
    });

    const flyout = el.querySelector('.crm-fmenu-flyout');
    const group = el.querySelector('.crm-fmenu-group');
    group.getBoundingClientRect = () => ({ top: 80, bottom: 120, left: 40, right: 200, width: 160, height: 40 });
    flyout.getBoundingClientRect = () => ({ top: 80, bottom: 200, left: 208, right: 360, width: 152, height: 120 });

    el.querySelector('.crm-fmenu-item--parent').dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(flyout.classList.contains('crm-fmenu-flyout--up')).toBe(false);
    expect(flyout.classList.contains('crm-fmenu-flyout--left')).toBe(false);
    restore();
  });
});

function mockSize(el, { height, width }) {
  Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => height });
  Object.defineProperty(el, 'offsetWidth', { configurable: true, get: () => width });
}

function mockViewport({ height, width }) {
  const prevHeight = window.innerHeight;
  const prevWidth = window.innerWidth;
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });

  const wrap = document.createElement('div');
  wrap.getBoundingClientRect = () => ({
    top: 100, left: 0, bottom: height, right: 900, width: 900, height: height - 100
  });
  Object.defineProperty(wrap, 'clientWidth', { configurable: true, value: 900 });
  document.body.appendChild(wrap);

  return {
    wrap,
    restore() {
      wrap.remove();
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: prevHeight });
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: prevWidth });
    }
  };
}
