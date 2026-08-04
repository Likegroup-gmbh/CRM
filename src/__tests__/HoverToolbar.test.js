// Verhalten der zentralen Hover-Toolbar - gegen eine Minimal-Config, damit die
// Tests die Mechanik pruefen und nicht die Live-Link-Spalte, die sie zufaellig
// als erste nutzt.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { hoverToolbar } from '../core/hoverToolbar/HoverToolbar.js';
import {
  registerHoverToolbar,
  unregisterHoverToolbar,
  getHoverToolbarConfig,
  clearHoverToolbarConfigs
} from '../core/hoverToolbar/HoverToolbarRegistry.js';
import { buildHoverToolbarContent, resolve, visibleActions } from '../core/hoverToolbar/HoverToolbarBuilder.js';

const NAME = 'test-toolbar';

/** Zelle mit dem Markup, das eine Spalte mitbringen muss. */
function makeCell(id = 'x1') {
  const cell = document.createElement('div');
  cell.dataset.hoverToolbar = NAME;
  cell.dataset.id = id;
  cell.innerHTML = '<input type="text"><span data-hover-toolbar-trigger></span>';
  document.body.appendChild(cell);
  return cell;
}

function portal() {
  return document.querySelector('.hover-toolbar');
}

describe('HoverToolbar', () => {
  let cell;

  beforeEach(() => {
    document.body.innerHTML = '';
    hoverToolbar.close();
    clearHoverToolbarConfigs();
    registerHoverToolbar(NAME, {
      label: 'Test-Aktionen',
      resolveContext: (el) => ({ id: el.dataset.id }),
      actions: [{ id: 'go', variant: 'primary', icon: 'chart', label: 'Los', onClick: vi.fn() }]
    });
    cell = makeCell();
  });

  afterEach(() => {
    hoverToolbar.destroy();
    clearHoverToolbarConfigs();
    document.body.innerHTML = '';
  });

  it('oeffnet als Portal an document.body, nicht in der Zelle', () => {
    hoverToolbar.open(cell);

    expect(portal()).not.toBeNull();
    expect(portal().parentElement).toBe(document.body);
    expect(cell.querySelector('.hover-toolbar')).toBeNull();
    expect(cell.classList.contains('has-toolbar')).toBe(true);
  });

  it('nimmt den Namen der Config aus dem Markup', () => {
    hoverToolbar.open(cell);

    expect(portal().dataset.hoverToolbarFor).toBe(NAME);
    expect(portal().getAttribute('aria-label')).toBe('Test-Aktionen');
  });

  it('oeffnet nicht fuer eine Zelle ohne angemeldete Config', () => {
    unregisterHoverToolbar(NAME);

    expect(hoverToolbar.open(cell)).toBeNull();
    expect(portal()).toBeNull();
  });

  it('laesst canOpen entscheiden, ob die Leiste ueberhaupt erscheint', () => {
    registerHoverToolbar(NAME, {
      resolveContext: () => ({ id: 'x1', bereit: false }),
      canOpen: (ctx) => ctx.bereit,
      actions: [{ id: 'go', label: 'Los', onClick: vi.fn() }]
    });

    hoverToolbar.open(cell);
    expect(portal()).toBeNull();
  });

  it('bleibt zu, wenn im aktuellen Zustand keine Aktion sichtbar ist', () => {
    // Sonst klappte eine leere Leiste auf - etwa eine Zelle, deren einzige
    // Aktion ein Extern-Link ohne URL ist.
    registerHoverToolbar(NAME, {
      resolveContext: () => ({ id: 'x1' }),
      actions: [{ id: 'go', label: 'Los', visible: () => false, onClick: vi.fn() }]
    });

    hoverToolbar.open(cell);
    expect(portal()).toBeNull();
  });

  it('laesst nie zwei Leisten gleichzeitig stehen', () => {
    hoverToolbar.open(cell);
    hoverToolbar.open(cell);

    expect(document.querySelectorAll('.hover-toolbar').length).toBe(1);
  });

  it('schliesst bei Escape', () => {
    hoverToolbar.init();
    hoverToolbar.open(cell);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(portal()).toBeNull();
    expect(cell.classList.contains('has-toolbar')).toBe(false);
  });

  it('schliesst beim Scrollen, weil eine fixe Position sonst stehenbliebe', () => {
    hoverToolbar.init();
    hoverToolbar.open(cell);

    window.dispatchEvent(new Event('scroll'));

    expect(portal()).toBeNull();
  });

  it('haelt beim Verlassen kurz nach, damit der Weg zur Leiste nicht abreisst', async () => {
    hoverToolbar.open(cell);

    hoverToolbar.scheduleClose();
    expect(portal()).not.toBeNull();

    await new Promise(r => setTimeout(r, 250));
    expect(portal()).toBeNull();
  });

  it('bleibt waehrend eines laufenden Vorgangs offen', async () => {
    hoverToolbar.open(cell);
    hoverToolbar.pin();

    hoverToolbar.scheduleClose();
    await new Promise(r => setTimeout(r, 250));

    expect(portal()).not.toBeNull();
  });

  it('schliesst nach dem Vorgang selbst, wenn der Zeiger inzwischen weg ist', async () => {
    // Ohne diesen Weg bliebe die Leiste haengen: waehrend des Vorgangs ist sie
    // gepinnt, und ein weiteres mouseout kommt nie.
    hoverToolbar.open(cell);
    hoverToolbar.pin();
    hoverToolbar.scheduleClose();

    hoverToolbar.unpin();
    await new Promise(r => setTimeout(r, 250));

    expect(portal()).toBeNull();
  });

  it('bleibt offen, solange der Fokus in der Zelle steht', async () => {
    hoverToolbar.open(cell);
    cell.querySelector('input').focus();

    // Ein focusout beim Klick auf einen Button der Leiste darf den Klick nicht
    // wegziehen, auf den er reagiert.
    hoverToolbar.scheduleClose();
    await new Promise(r => setTimeout(r, 250));

    expect(portal()).not.toBeNull();
  });

  it('schliesst, wenn die Zelle durch ein Re-Render verschwunden ist', async () => {
    hoverToolbar.open(cell);
    cell.remove();

    hoverToolbar.scheduleClose();
    await new Promise(r => setTimeout(r, 250));

    expect(portal()).toBeNull();
  });

  it('oeffnet zeitversetzt bei Hover, damit ein Zeiger im Vorbeiflug nichts ausloest', async () => {
    hoverToolbar.init();
    cell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

    expect(portal()).toBeNull();

    await new Promise(r => setTimeout(r, 200));
    expect(portal()).not.toBeNull();
  });

  it('oeffnet und schliesst per Tap auf den Indikator, wo es kein Hover gibt', () => {
    hoverToolbar.init();
    const trigger = cell.querySelector('[data-hover-toolbar-trigger]');

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(portal()).not.toBeNull();

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(portal()).toBeNull();
  });

  it('schliesst beim Klick ins Leere', () => {
    hoverToolbar.init();
    hoverToolbar.open(cell);

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(portal()).toBeNull();
  });

  it('fuehrt beim Klick die Aktion mit frisch aufgeloestem Kontext aus', () => {
    // Zwischen Hover und Klick koennen Sekunden liegen, in denen ein
    // Realtime-Update die Zeile veraendert hat.
    const onClick = vi.fn();
    let stand = 'alt';
    registerHoverToolbar(NAME, {
      resolveContext: (el) => ({ id: el.dataset.id, stand }),
      actions: [{ id: 'go', label: 'Los', onClick }]
    });

    hoverToolbar.init();
    hoverToolbar.open(cell);
    stand = 'neu';

    const button = portal().querySelector('[data-hover-action="go"]');
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0][0]).toMatchObject({ id: 'x1', stand: 'neu' });
    expect(onClick.mock.calls[0][1]).toBe(button);
  });

  it('bringt der Refresh den Inhalt auf Stand, ohne zu schliessen', () => {
    let label = 'Abrufen';
    registerHoverToolbar(NAME, {
      resolveContext: (el) => ({ id: el.dataset.id }),
      actions: [{ id: 'go', label: () => label, onClick: vi.fn() }]
    });

    hoverToolbar.open(cell);
    expect(portal().textContent).toContain('Abrufen');

    label = 'Aktualisieren';
    hoverToolbar.refresh();

    expect(portal()).not.toBeNull();
    expect(portal().textContent).toContain('Aktualisieren');
  });

  it('schliesst beim Refresh, wenn canOpen nicht mehr zutrifft', () => {
    let bereit = true;
    registerHoverToolbar(NAME, {
      resolveContext: (el) => ({ id: el.dataset.id }),
      canOpen: () => bereit,
      actions: [{ id: 'go', label: 'Los', onClick: vi.fn() }]
    });

    hoverToolbar.open(cell);
    bereit = false;
    hoverToolbar.refresh();

    expect(portal()).toBeNull();
  });

  // Sourcing ersetzt nach einem Abruf die ganze Zeile per outerHTML. Die Zelle
  // unter der Leiste ist danach ein anderes Element.
  describe('rebind nach Zeilen-Neuaufbau', () => {
    it('haengt sich an die neue Zelle und zeigt den neuen Stand', () => {
      let label = 'Abrufen';
      registerHoverToolbar(NAME, {
        resolveContext: (el) => ({ id: el.dataset.id }),
        actions: [{ id: 'go', label: () => label, onClick: vi.fn() }]
      });

      hoverToolbar.open(cell);
      const alte = cell;

      cell.remove();
      const neue = makeCell('x1');
      label = 'Aktualisieren';
      hoverToolbar.rebind();

      expect(portal()).not.toBeNull();
      expect(portal().textContent).toContain('Aktualisieren');
      expect(hoverToolbar.cell).toBe(neue);
      expect(hoverToolbar.cell).not.toBe(alte);
      expect(neue.classList.contains('has-toolbar')).toBe(true);
    });

    it('schliesst, wenn die Zelle nicht wiederkommt', () => {
      hoverToolbar.open(cell);

      cell.remove();
      hoverToolbar.rebind();

      expect(portal()).toBeNull();
    });

    it('nimmt nicht die Zelle eines anderen Datensatzes', () => {
      hoverToolbar.open(cell);

      cell.remove();
      makeCell('x2');
      hoverToolbar.rebind();

      expect(portal()).toBeNull();
    });

    it('ist bei noch verbundener Zelle ein einfacher Refresh', () => {
      let label = 'Abrufen';
      registerHoverToolbar(NAME, {
        resolveContext: (el) => ({ id: el.dataset.id }),
        actions: [{ id: 'go', label: () => label, onClick: vi.fn() }]
      });

      hoverToolbar.open(cell);
      label = 'Aktualisieren';
      hoverToolbar.rebind();

      expect(hoverToolbar.cell).toBe(cell);
      expect(portal().textContent).toContain('Aktualisieren');
    });

    it('bleibt ohne offene Leiste wirkungslos', () => {
      expect(() => hoverToolbar.rebind()).not.toThrow();
      expect(portal()).toBeNull();
    });
  });
});

describe('HoverToolbarBuilder', () => {
  const ctx = { id: 'v1', url: 'https://example.com/a' };

  it('loest Werte und Resolver gleich auf', () => {
    expect(resolve('fest', ctx)).toBe('fest');
    expect(resolve((c) => c.id, ctx)).toBe('v1');
  });

  it('sortiert Aktionen aus, die im aktuellen Zustand nichts zu tun haetten', () => {
    const actions = [
      { id: 'a' },
      { id: 'b', visible: false },
      { id: 'c', visible: (c) => !!c.url },
      { id: 'd', visible: () => false }
    ];

    expect(visibleActions(actions, ctx).map(a => a.id)).toEqual(['a', 'c']);
  });

  it('rendert Buttons, Links und Trenner mit den passenden Klassen', () => {
    const html = buildHoverToolbarContent({
      actions: [
        { id: 'main', variant: 'primary', label: 'Abrufen' },
        { id: 'open', type: 'link', variant: 'icon', href: (c) => c.url, ariaLabel: 'Oeffnen' },
        { type: 'separator' },
        { id: 'del', variant: 'icon', danger: true, ariaLabel: 'Loeschen' }
      ]
    }, ctx);

    const host = document.createElement('div');
    host.innerHTML = html;

    const main = host.querySelector('[data-hover-action="main"]');
    expect(main.tagName).toBe('BUTTON');
    expect(main.className).toContain('hover-toolbar__btn--primary');
    expect(main.dataset.id).toBe('v1');

    const link = host.querySelector('[data-hover-action="open"]');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe(ctx.url);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');

    expect(host.querySelector('.hover-toolbar__divider')).not.toBeNull();
    expect(host.querySelector('[data-hover-action="del"]').className)
      .toContain('hover-toolbar__btn--danger');
  });

  it('haengt Hinweis- und Fehlerzeilen nur an, wenn sie Text haben', () => {
    const config = {
      actions: [{ id: 'a', label: 'A' }],
      rows: [
        () => ({ kind: 'error', text: 'Kaputt' }),
        () => null,
        () => ({ kind: 'hint', text: '' })
      ]
    };

    const host = document.createElement('div');
    host.innerHTML = buildHoverToolbarContent(config, ctx);

    expect(host.querySelector('.hover-toolbar__error').textContent).toBe('Kaputt');
    expect(host.querySelector('.hover-toolbar__hint')).toBeNull();
  });

  it('escaped Anfuehrungszeichen in Attributen, damit ein href sie nicht sprengt', () => {
    const host = document.createElement('div');
    host.innerHTML = buildHoverToolbarContent({
      actions: [{ id: 'open', type: 'link', href: 'https://x.test/"onmouseover="alert(1)', title: 'a"b' }]
    }, { id: 'v1' });

    const link = host.querySelector('[data-hover-action="open"]');
    expect(link.getAttribute('href')).toBe('https://x.test/"onmouseover="alert(1)');
    expect(link.getAttribute('onmouseover')).toBeNull();
    expect(link.getAttribute('title')).toBe('a"b');
  });

  it('reicht zusaetzliche data-Attribute aus der Config durch', () => {
    const host = document.createElement('div');
    host.innerHTML = buildHoverToolbarContent({
      actions: [{ id: 'a', label: 'A', dataset: (c) => ({ 'video-id': c.id }) }]
    }, ctx);

    expect(host.querySelector('[data-hover-action="a"]').dataset.videoId).toBe('v1');
  });
});

describe('HoverToolbarRegistry', () => {
  beforeEach(() => clearHoverToolbarConfigs());
  afterEach(() => clearHoverToolbarConfigs());

  it('gibt angemeldete Configs zurueck und nach dem Abmelden nichts mehr', () => {
    const config = { actions: [] };
    registerHoverToolbar('a', config);

    expect(getHoverToolbarConfig('a')).toBe(config);

    unregisterHoverToolbar('a');
    expect(getHoverToolbarConfig('a')).toBeNull();
  });

  it('laesst die frische Instanz die alte ueberschreiben', () => {
    // Eine zweimal gemountete Tabelle darf nicht die Config der alten,
    // zerstoerten Instanz hinterlassen.
    registerHoverToolbar('a', { id: 'alt', actions: [] });
    registerHoverToolbar('a', { id: 'neu', actions: [] });

    expect(getHoverToolbarConfig('a').id).toBe('neu');
  });
});
