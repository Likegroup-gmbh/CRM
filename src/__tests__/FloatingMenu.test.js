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
});
