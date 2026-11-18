import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderTableAvatar, renderTableIdentity, safeImageUrl } from '../core/format/tableIdentity.js';

function dom(html) {
  return new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstElementChild;
}

let validator;

beforeEach(() => {
  validator = window.validatorSystem;
  window.validatorSystem = { sanitizeUrl: (url) => (/^https?:\/\//.test(url) ? url : null) };
});

afterEach(() => {
  window.validatorSystem = validator;
});

describe('safeImageUrl', () => {
  it('laesst http(s) durch und verwirft alles andere', () => {
    expect(safeImageUrl('https://cdn.test/a.avif')).toBe('https://cdn.test/a.avif');
    expect(safeImageUrl('javascript:alert(1)')).toBeNull();
    expect(safeImageUrl('')).toBeNull();
    expect(safeImageUrl(null)).toBeNull();
  });

  it('prueft ohne ValidatorSystem selbst auf http(s)', () => {
    window.validatorSystem = undefined;
    expect(safeImageUrl(' https://cdn.test/a.avif ')).toBe('https://cdn.test/a.avif');
    expect(safeImageUrl('data:image/png;base64,AAA')).toBeNull();
  });
});

describe('renderTableAvatar', () => {
  it('zeigt das Bild als Foto, ohne doppelten Alt-Text', () => {
    const img = dom(renderTableAvatar({ url: 'https://cdn.test/a.avif', name: 'Mia' })).querySelector('img');
    expect(img.className).toBe('table-avatar table-avatar-img');
    expect(img.getAttribute('src')).toBe('https://cdn.test/a.avif');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.hasAttribute('width')).toBe(false);
  });

  it('markiert Logos, damit sie nicht beschnitten werden', () => {
    const img = dom(renderTableAvatar({ url: 'https://cdn.test/logo.png', logo: true })).querySelector('img');
    expect(img.classList.contains('table-avatar--logo')).toBe(true);
  });

  it('faellt auf den Initial des Namens zurueck', () => {
    expect(dom(renderTableAvatar({ name: 'mia muster' })).querySelector('span.table-avatar').textContent).toBe('M');
    expect(dom(renderTableAvatar({ name: '@handle' })).textContent).toBe('H');
    expect(dom(renderTableAvatar({ name: 'Mia', initial: 'x' })).textContent).toBe('X');
    expect(dom(renderTableAvatar({})).textContent).toBe('?');
  });

  it('nimmt den Initial auch bei unsicherer URL', () => {
    const el = dom(renderTableAvatar({ url: 'javascript:alert(1)', name: 'Mia' }));
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toBe('M');
  });

  it('zeigt statt des Initials ein Icon, wenn eins mitkommt', () => {
    const el = dom(renderTableAvatar({ name: 'Ordner', iconHtml: '<svg data-icon="folder"></svg>' }));
    expect(el.querySelector('span.table-avatar--icon svg[data-icon="folder"]')).not.toBeNull();
  });

  it('escaped URL und Initial', () => {
    const img = dom(renderTableAvatar({ url: 'https://cdn.test/a.avif?x="><b>' })).querySelector('img');
    expect(img.getAttribute('src')).toBe('https://cdn.test/a.avif?x="><b>');
    expect(dom(renderTableAvatar({ initial: '<' })).querySelector('b')).toBeNull();
  });
});

describe('renderTableIdentity', () => {
  it('stellt Bild und Name nebeneinander in eine Zeile', () => {
    const el = dom(renderTableIdentity({ url: 'https://cdn.test/a.avif', name: 'Mia Muster' }));
    const zelle = el.querySelector('.table-identity');
    expect([...zelle.children].map(c => c.className)).toEqual(['table-identity__media', 'table-identity__text']);
    expect(zelle.querySelector('.table-identity__text').textContent).toBe('Mia Muster');
  });

  it('escaped den Namen, wenn kein Markup mitkommt', () => {
    const el = dom(renderTableIdentity({ name: '<b>Mia</b>' }));
    expect(el.querySelector('b')).toBeNull();
    expect(el.querySelector('.table-identity__text').textContent).toBe('<b>Mia</b>');
  });

  it('uebernimmt Link, zweite Zeile, Badge und Prefix', () => {
    const el = dom(renderTableIdentity({
      name: 'Mia',
      nameHtml: '<a class="table-link">Mia</a>',
      subHtml: '<div class="sub">@mia</div>',
      badgeHtml: '<span class="sourcing-avatar__dot"></span>',
      prefixHtml: '<button class="toggle"></button>'
    }));
    const zelle = el.querySelector('.table-identity');
    expect(zelle.firstElementChild.className).toBe('toggle');
    expect(zelle.querySelector('.table-identity__media .sourcing-avatar__dot')).not.toBeNull();
    expect(zelle.querySelector('.table-identity__text a.table-link').textContent).toBe('Mia');
    expect(zelle.querySelector('.table-identity__text .sub').textContent).toBe('@mia');
  });

  it('nimmt ein fertiges Bild und laesst es mit leerem avatarHtml weg', () => {
    const eigenes = dom(renderTableIdentity({ avatarHtml: '<i class="eigen"></i>', name: 'X' }));
    expect(eigenes.querySelector('.table-identity__media .eigen')).not.toBeNull();
    const ohne = dom(renderTableIdentity({ avatarHtml: '', name: 'X' }));
    expect(ohne.querySelector('.table-identity__media')).toBeNull();
    expect(ohne.querySelector('.table-identity__text').textContent).toBe('X');
  });
});
