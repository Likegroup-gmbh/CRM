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

  it('zeigt in Kundendaten nur Unternehmen und Ansprechpartner', () => {
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
    expect(unternehmen).toBeGreaterThan(-1);
    expect(ansprechpartner).toBeGreaterThan(unternehmen);
    const kundendaten = document.querySelector('[data-section="Kundendaten"]');
    const hrefs = [...kundendaten.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/unternehmen', '/ansprechpartner']);
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

  it('legt Kampagnen unter Projektmanagement und die operativen Seiten unter Kampagnenmanagement', () => {
    const nav = new NavigationSystem();
    nav.renderNavigation('/dashboard');

    const sections = [...document.querySelectorAll('.nav-section')].map((el) => el.dataset.section);
    const projektIdx = sections.indexOf('Projektmanagement');
    const kampagnenIdx = sections.indexOf('Kampagnenmanagement');
    expect(projektIdx).toBeGreaterThan(-1);
    expect(kampagnenIdx).toBe(projektIdx + 1);

    const projekt = document.querySelector('[data-section="Projektmanagement"]');
    const hrefs = [...projekt.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/auftrag', '/ausgangsrechnungen', '/auftragsdetails', '/kampagne']);

    const kampagnen = document.querySelector('[data-section="Kampagnenmanagement"]');
    const kampagnenHrefs = [...kampagnen.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
    expect(kampagnenHrefs).toEqual([
      '/briefing',
      '/persona',
      '/produkt',
      '/castings',
      '/konzepte',
      '/skripte',
      '/vertraege',
      '/rechnung',
      '/videos'
    ]);
    expect(projekt.innerHTML).not.toContain('Briefings');
    expect(kampagnen.innerHTML).toContain('Briefings');
    expect(kampagnen.innerHTML).toContain('Castings');
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
