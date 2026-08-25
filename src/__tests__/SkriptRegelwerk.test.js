// Regelwerk-Liste navigiert, Detail legt beim ersten Save die Row an.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SkriptRegelwerkList } from '../modules/skripte/regelwerk/SkriptRegelwerkList.js';
import { SkriptRegelwerkDetail } from '../modules/skripte/regelwerk/SkriptRegelwerkDetail.js';

function fakeAdapter(overrides = {}) {
  return {
    kind: 'dna',
    listPath: '/skripte/dna',
    label: 'DNA',
    headline: 'Skript-DNA',
    neuLabel: 'DNA anlegen',
    titlePlaceholder: 'Name',
    bodyPlaceholder: 'Text',
    columns: ['Name', 'Status'],
    titleOf: (d) => d.name || 'DNA',
    metaBadgesHtml: () => '<span>badge</span>',
    metaFormHtml: () => '<select id="rw-layer"><option value="global">Global</option></select>',
    bindMetaForm: () => {},
    readMeta: () => ({ layer_typ: 'global' }),
    metaGueltig: () => true,
    metaFehler: () => 'Meta fehlt',
    loadAll: vi.fn(async () => []),
    loadOne: vi.fn(async () => null),
    create: vi.fn(async (p) => ({
      id: 'd1', name: p.name, inhalt: p.inhalt, version: 1, status: 'entwurf', layer_typ: 'global'
    })),
    update: vi.fn(async () => {}),
    activate: vi.fn(async () => {}),
    archive: vi.fn(async () => {}),
    rowCells: (d) => [d.name, d.status],
    ...overrides
  };
}

describe('SkriptRegelwerkList', () => {
  beforeEach(() => {
    window.navigateTo = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('Neu und Oeffnen navigieren, kein Drawer', async () => {
    const adapter = fakeAdapter({
      loadAll: vi.fn(async () => [{ id: 'x1', name: 'Hook-DNA', status: 'entwurf' }])
    });
    const list = new SkriptRegelwerkList(adapter);
    const root = document.createElement('div');
    document.body.appendChild(root);
    await list.render(root);

    expect(root.querySelector('.drawer-overlay')).toBeNull();
    expect(root.textContent).toContain('Hook-DNA');

    root.querySelector('[data-rw-neu]').click();
    expect(window.navigateTo).toHaveBeenCalledWith('/skripte/dna/new');

    root.querySelector('[data-rw-open]').click();
    expect(window.navigateTo).toHaveBeenCalledWith('/skripte/dna/x1');
  });
});

describe('SkriptRegelwerkDetail erster Save', () => {
  beforeEach(() => {
    window.toastSystem = { error: vi.fn(), success: vi.fn() };
    window.breadcrumbSystem = { setFromRoute: vi.fn(), updateDetailLabel: vi.fn() };
    window.setHeadline = vi.fn();
    window.history.replaceState = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('legt die Row an und wechselt die URL', async () => {
    const adapter = fakeAdapter();
    const detail = new SkriptRegelwerkDetail();
    detail.adapter = adapter;
    detail.container = document.createElement('div');
    detail.container.innerHTML = '<div data-rw-toolbar></div>';
    detail.handle = { readFeld: (f) => (f === 'name' ? 'Hook-DNA' : '# hi') };
    detail.doc = null;

    await detail.persist('inhalt', '# hi');

    expect(adapter.create).toHaveBeenCalledWith({
      layer_typ: 'global',
      name: 'Hook-DNA',
      inhalt: '# hi'
    });
    expect(window.history.replaceState).toHaveBeenCalledWith(
      { route: '/skripte/dna/d1' },
      '',
      '/skripte/dna/d1'
    );
    expect(detail.doc.id).toBe('d1');
  });

  it('blockiert Create wenn Meta ungueltig', async () => {
    const adapter = fakeAdapter({
      metaGueltig: () => false,
      metaFehler: () => 'Layer und Scope wählen'
    });
    const detail = new SkriptRegelwerkDetail();
    detail.adapter = adapter;
    detail.container = document.createElement('div');
    detail.handle = { readFeld: () => '' };
    detail.doc = null;

    await expect(detail.persist('name', 'X')).rejects.toThrow('Layer und Scope wählen');
    expect(adapter.create).not.toHaveBeenCalled();
    expect(window.toastSystem.error).toHaveBeenCalled();
  });
});
