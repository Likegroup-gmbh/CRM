import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthService } from '../modules/auth/AuthService.js';

// updateHeaderForRole steuert die Sichtbarkeit der Header-Buttons nach
// Rolle. Education bleibt fuer interne User sichtbar, der Admin-Button
// nur fuer Admins (PRD Schritt 8).

function mountHeader() {
  const header = document.createElement('div');
  header.className = 'header-actions';
  header.innerHTML = `
    <a href="/admin" class="secondary-btn admin-btn" style="display: none;"></a>
    <a href="/education" class="secondary-btn education-btn"></a>
  `;
  document.body.appendChild(header);
  return header;
}

describe('AuthService.updateHeaderForRole', () => {
  let header;
  const service = new AuthService();

  beforeEach(() => {
    header = mountHeader();
    window.isAdmin = vi.fn(() => false);
    window.isKunde = vi.fn(() => false);
  });

  afterEach(() => {
    header.remove();
  });

  it('blendet den Admin-Button fuer Admins ein und laesst Education sichtbar', () => {
    window.isAdmin = vi.fn(() => true);
    service.updateHeaderForRole('admin');

    expect(header.querySelector('.admin-btn').style.display).toBe('');
    expect(header.querySelector('.education-btn').style.display).toBe('');
  });

  it('laesst den Admin-Button fuer Mitarbeiter unsichtbar, Education bleibt', () => {
    service.updateHeaderForRole('mitarbeiter');

    expect(header.querySelector('.admin-btn').style.display).toBe('none');
    expect(header.querySelector('.education-btn').style.display).toBe('');
  });

  it('blendet Education fuer Kunden aus und haelt den Admin-Button versteckt', () => {
    window.isKunde = vi.fn(() => true);
    service.updateHeaderForRole('kunde');

    expect(header.querySelector('.admin-btn').style.display).toBe('none');
    expect(header.querySelector('.education-btn').style.display).toBe('none');
  });
});
