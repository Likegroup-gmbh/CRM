import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../core/actions/ActionBuilder.js', () => ({
  actionBuilder: { create: () => '<div class="actions-stub"></div>' }
}));

import { renderItemsRows, renderItemsView } from '../modules/skripte/SkriptListRenderer.js';

function parseTable(html) {
  return new DOMParser().parseFromString(html, 'text/html');
}

function listStub() {
  return {
    sanitize: (value) => String(value ?? ''),
    hasActiveFilters: () => false,
    listViewMode: 'list'
  };
}

function skript(overrides = {}) {
  return {
    id: 's1',
    titel: 'Hook Test',
    status: 'entwurf',
    created_at: '2026-09-01T10:00:00Z',
    ...overrides
  };
}

describe('SkriptListRenderer Items', () => {
  beforeEach(() => {
    window.validatorSystem = {
      sanitizeHtml: (value) => value,
      sanitizeUrl: (value) => value
    };
    window.isKunde = vi.fn(() => false);
    window.canViewPage = vi.fn(() => true);
    window.canCreate = vi.fn(() => false);
    window.currentUser = { permissions: { creator: { can_view: true } } };
  });

  it('Header-Reihenfolge Titel Creator Status Erstellt am Aktionen', () => {
    const doc = parseTable(renderItemsView(listStub()));
    const headers = Array.from(doc.querySelectorAll('thead th')).map((th) => th.textContent.trim());
    expect(headers).toEqual(['Titel', 'Creator', 'Status', 'Erstellt am', 'Aktionen']);
    expect(doc.querySelector('.loading').getAttribute('colspan')).toBe('5');
  });

  it('Creator-Zelle steht an Position 2 mit Avatar und Link', () => {
    const html = renderItemsRows(listStub(), [skript({
      strategie_item: {
        casting_eintrag: {
          name: 'Casting',
          creator: {
            id: 'c1',
            vorname: 'Lea',
            nachname: 'Hoff',
            profilbild_thumb_url: 'https://cdn.example/thumb.jpg'
          }
        }
      }
    })]);
    const doc = parseTable(`<table><tbody>${html}</tbody></table>`);
    const cells = doc.querySelectorAll('td');
    expect(cells).toHaveLength(5);
    expect(cells[0].textContent.trim()).toBe('Hook Test');
    expect(cells[1].classList.contains('col-name-with-icon')).toBe(true);
    const link = cells[1].querySelector('a.table-link');
    expect(link.dataset.table).toBe('creator');
    expect(link.dataset.id).toBe('c1');
    expect(link.textContent).toBe('Lea Hoff');
    expect(cells[1].querySelector('img.table-avatar')).not.toBeNull();
  });

  it('ohne Creator Dash in Spalte 2', () => {
    const html = renderItemsRows(listStub(), [skript()]);
    const doc = parseTable(`<table><tbody>${html}</tbody></table>`);
    const cells = doc.querySelectorAll('td');
    expect(cells[1].textContent).toBe('-');
    expect(cells[1].querySelector('a')).toBeNull();
  });
});
