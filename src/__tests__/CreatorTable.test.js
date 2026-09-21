import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderCreatorNameCell } from '../modules/creator/CreatorTable.js';

function parseCell(html) {
  return new DOMParser().parseFromString(`<table><tbody><tr>${html}</tr></tbody></table>`, 'text/html');
}

describe('renderCreatorNameCell', () => {
  beforeEach(() => {
    window.validatorSystem = {
      sanitizeHtml: (value) => value,
      sanitizeUrl: (value) => value
    };
    window.isKunde = vi.fn(() => false);
    window.canViewPage = vi.fn(() => true);
    window.currentUser = { permissions: { creator: { can_view: true } } };
  });

  it('rendert Dash ohne Creator', () => {
    const doc = parseCell(renderCreatorNameCell(null));
    expect(doc.querySelector('td').textContent).toBe('-');
    expect(doc.querySelector('.col-name-with-icon')).toBeNull();
  });

  it('rendert Dash ohne Namen', () => {
    const doc = parseCell(renderCreatorNameCell({ id: 'c1' }));
    expect(doc.querySelector('td').textContent).toBe('-');
  });

  it('rendert Thumb plus Link', () => {
    const html = renderCreatorNameCell({
      id: 'c1',
      vorname: 'Lea',
      nachname: 'Hoff',
      profilbild_thumb_url: 'https://cdn.example/thumb.jpg',
      profilbild_url: 'https://cdn.example/full.jpg'
    });
    const doc = parseCell(html);
    const img = doc.querySelector('img.table-avatar.table-avatar-img');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('https://cdn.example/thumb.jpg');
    const link = doc.querySelector('a.table-link');
    expect(link.dataset.table).toBe('creator');
    expect(link.dataset.id).toBe('c1');
    expect(link.textContent).toBe('Lea Hoff');
  });

  it('rendert Initiale ohne Bild', () => {
    const doc = parseCell(renderCreatorNameCell({
      id: 'c1',
      vorname: 'Pat',
      nachname: 'Schmidt'
    }));
    const avatar = doc.querySelector('span.table-avatar');
    expect(avatar).not.toBeNull();
    expect(avatar.textContent).toBe('P');
    expect(doc.querySelector('img')).toBeNull();
  });

  it('ohne CRM-id nur Name, kein Link', () => {
    const doc = parseCell(renderCreatorNameCell({
      id: null,
      name: 'Casting Name'
    }));
    expect(doc.querySelector('a')).toBeNull();
    expect(doc.querySelector('.col-name-with-icon').textContent).toContain('Casting Name');
    expect(doc.querySelector('span.table-avatar').textContent).toBe('C');
  });

  it('Kunde sieht Avatar und Name ohne Link', () => {
    window.isKunde = vi.fn(() => true);
    const doc = parseCell(renderCreatorNameCell({
      id: 'c1',
      vorname: 'Lea',
      nachname: 'Hoff',
      profilbild_thumb_url: 'https://cdn.example/thumb.jpg'
    }));
    expect(doc.querySelector('a')).toBeNull();
    expect(doc.querySelector('img.table-avatar')).not.toBeNull();
    expect(doc.querySelector('.col-name-with-icon').textContent).toContain('Lea Hoff');
  });
});
