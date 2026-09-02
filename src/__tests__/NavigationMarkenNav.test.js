import { describe, it, expect, beforeEach } from 'vitest';
import { NavigationSystem } from '../modules/navigation/NavigationSystem.js';

describe('NavigationSystem – Stammdaten ohne Marken-Liste', () => {
  beforeEach(() => {
    document.body.innerHTML = '<nav id="main-nav"></nav>';
    window.currentUser = {
      rolle: 'admin',
      permissions: { unternehmen: { can_view: true }, marke: { can_view: true } }
    };
    window.canViewPage = () => undefined;
    window.canCreateProject = () => false;
    window.isInternal = () => true;
    window.isAdmin = () => true;
  });

  it('zeigt keinen Nav-Eintrag zur Marken-Liste', () => {
    const nav = new NavigationSystem();
    nav.renderNavigation();
    const html = document.getElementById('main-nav').innerHTML;
    expect(html).not.toContain('url="/marke"');
    expect(html).not.toContain('>Marken<');
    expect(html).not.toMatch(/href="\/marke"/);
  });
});
