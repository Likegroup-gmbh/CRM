import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../core/ActionsDropdown.js', () => ({
  actionsDropdown: { getHeroIcon: () => '' }
}));

vi.mock('../core/actions/ActionBuilder.js', () => ({
  actionBuilder: { create: () => '<div class="actions-stub"></div>' }
}));

import { MitarbeiterList } from '../modules/admin/MitarbeiterList.js';

function createChain(result) {
  const neqCalls = [];
  const chain = {
    select: vi.fn(() => chain),
    neq: vi.fn((col, val) => {
      neqCalls.push([col, val]);
      return chain;
    }),
    order: vi.fn(() => Promise.resolve(result))
  };
  chain.neqCalls = neqCalls;
  return chain;
}

describe('MitarbeiterList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.validatorSystem = {
      sanitizeHtml: (value) => value,
      sanitizeUrl: (value) => value
    };
  });

  it('lädt benutzer ohne kunde und gast', async () => {
    const klassenChain = createChain({ data: [], error: null });
    const benutzerChain = createChain({ data: [{ id: 'm1', name: 'Pat', rolle: 'mitarbeiter' }], error: null });
    window.supabase = {
      from: vi.fn((table) => (table === 'mitarbeiter_klasse' ? klassenChain : benutzerChain))
    };

    const list = new MitarbeiterList();
    await list.load();

    expect(window.supabase.from).toHaveBeenCalledWith('benutzer');
    expect(benutzerChain.neqCalls).toContainEqual(['rolle', 'kunde']);
    expect(benutzerChain.neqCalls).toContainEqual(['rolle', 'gast']);
    expect(list.rows).toHaveLength(1);
  });

  it('rendert Profilbild mit table-avatar table-avatar-img', () => {
    const list = new MitarbeiterList();
    const html = list.renderMitarbeiterRow({
      id: 'm1',
      vorname: 'Pat',
      nachname: 'Schmidt',
      email: 'pat@example.com',
      freigeschaltet: true,
      profile_image_thumb_url: 'https://cdn.example/thumb.jpg',
      profile_image_url: 'https://cdn.example/full.jpg'
    });
    const doc = new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
    const img = doc.querySelector('img');
    expect(img).not.toBeNull();
    expect(img.className).toBe('table-avatar table-avatar-img');
    expect(img.getAttribute('src')).toBe('https://cdn.example/thumb.jpg');
    expect(doc.querySelector('.table-logo')).toBeNull();
  });

  it('rendert Initialen als span.table-avatar ohne Bild', () => {
    const list = new MitarbeiterList();
    const html = list.renderMitarbeiterRow({
      id: 'm1',
      vorname: 'Pat',
      nachname: 'Schmidt',
      email: 'pat@example.com',
      freigeschaltet: false
    });
    const doc = new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
    const avatar = doc.querySelector('span.table-avatar');
    expect(avatar).not.toBeNull();
    expect(avatar.textContent).toBe('P');
    expect(doc.querySelector('.table-avatar-placeholder')).toBeNull();
  });

  it('gruppiert Mitarbeiter der Klasse Finanzen', async () => {
    window.content = document.createElement('div');
    window.setContentSafely = (el, html) => { el.innerHTML = html; };

    const list = new MitarbeiterList();
    list.rows = [{
      id: 'f1',
      vorname: 'Fay',
      nachname: 'Nance',
      email: 'fay@example.com',
      rolle: 'mitarbeiter',
      mitarbeiter_klasse: { id: 'k1', name: 'Finanzen' },
      freigeschaltet: true
    }];

    await list.render();

    expect(window.content.innerHTML).toContain('Finanzen');
    expect(window.content.innerHTML).toContain('Fay');
  });
});
