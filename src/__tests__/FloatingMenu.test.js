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
});
