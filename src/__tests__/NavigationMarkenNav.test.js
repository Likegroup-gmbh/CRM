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

  it('zeigt Personas und Produkte in Stammdaten zwischen Unternehmen und Ansprechpartner', () => {
    window.currentUser.permissions = {
      ...window.currentUser.permissions,
      produkt: { can_view: true },
      persona: { can_view: true },
      ansprechpartner: { can_view: true }
    };
    const nav = new NavigationSystem();
    nav.renderNavigation();
    const html = document.getElementById('main-nav').innerHTML;
    const unternehmen = html.indexOf('href="/unternehmen"');
    const persona = html.indexOf('href="/persona"');
    const produkt = html.indexOf('href="/produkt"');
    const ansprechpartner = html.indexOf('href="/ansprechpartner"');
    expect(unternehmen).toBeGreaterThan(-1);
    expect(persona).toBeGreaterThan(unternehmen);
    expect(produkt).toBeGreaterThan(persona);
    expect(ansprechpartner).toBeGreaterThan(produkt);
  });

  it('zeigt Stakeholder in der Admin-Sektion fuer Admins', () => {
    const nav = new NavigationSystem();
    nav.renderNavigation();
    const html = document.getElementById('main-nav').innerHTML;
    expect(html).toMatch(/href="\/stakeholder"/);
    expect(html).toContain('>Stakeholder<');
  });

  it('blendet Stakeholder fuer Nicht-Admins aus', () => {
    window.isAdmin = () => false;
    window.canViewPage = () => undefined;
    window.currentUser = {
      rolle: 'mitarbeiter',
      permissions: {}
    };
    const nav = new NavigationSystem();
    nav.renderNavigation();
    const html = document.getElementById('main-nav').innerHTML;
    expect(html).not.toMatch(/href="\/stakeholder"/);
  });
});
