import { describe, it, expect, beforeEach } from 'vitest';
import { NavigationSystem } from '../modules/navigation/NavigationSystem.js';

describe('NavigationSystem – Kundendaten ohne Marken-Liste', () => {
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

  it('zeigt Personas und Produkte in Kundendaten nach Unternehmen und Ansprechpartner', () => {
    window.currentUser.permissions = {
      ...window.currentUser.permissions,
      produkt: { can_view: true },
      persona: { can_view: true },
      ansprechpartner: { can_view: true }
    };
    const nav = new NavigationSystem();
    nav.renderNavigation();
    const html = document.getElementById('main-nav').innerHTML;
    expect(html).toContain('Kundendaten');
    expect(html).toContain('Creatordaten');
    const unternehmen = html.indexOf('href="/unternehmen"');
    const ansprechpartner = html.indexOf('href="/ansprechpartner"');
    const persona = html.indexOf('href="/persona"');
    const produkt = html.indexOf('href="/produkt"');
    expect(unternehmen).toBeGreaterThan(-1);
    expect(ansprechpartner).toBeGreaterThan(unternehmen);
    expect(persona).toBeGreaterThan(ansprechpartner);
    expect(produkt).toBeGreaterThan(persona);
  });

  it('zeigt das Accounting-Dashboard nur im Accounting-Bereich, nicht als Stakeholder in der Hauptnavigation', () => {
    const nav = new NavigationSystem();
    nav.renderNavigation('/dashboard');
    expect(document.getElementById('main-nav').innerHTML).not.toMatch(/href="\/stakeholder"/);

    nav.syncWithRoute('/admin');
    const html = document.getElementById('main-nav').innerHTML;
    expect(html).toContain('data-route="/admin"');
    expect(html).toContain('Creatorrechnungen');
    expect(html).not.toContain('>Stakeholder<');
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
