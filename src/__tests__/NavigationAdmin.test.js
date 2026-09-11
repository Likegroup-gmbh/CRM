import { describe, it, expect, beforeEach } from 'vitest';
import { NavigationSystem } from '../modules/navigation/NavigationSystem.js';

// Accounting-Bereich: auf /admin-Routen rendert die Sidebar die
// reduzierte Accounting-Navigation statt der vollen Hauptnavigation.
// Der Bereichswechsel laeuft ueber syncWithRoute.
describe('NavigationSystem Accounting-Bereich', () => {
  beforeEach(() => {
    document.body.innerHTML = '<nav id="main-nav"></nav>';
    window.currentUser = { permissions: {} };
    window.canViewPage = () => undefined;
    window.canCreateProject = () => false;
    window.isInternal = () => true;
    window.isAdmin = () => true;
    window.canViewAccounting = () => window.isAdmin();
  });

  it('zeigt auf /admin-Routen die reduzierte Accounting-Navigation', () => {
    const nav = new NavigationSystem();
    nav.renderNavigation('/admin/datenqualitaet');
    const html = document.getElementById('main-nav').innerHTML;

    expect(html).toContain('Accounting');
    expect(html).toContain('/admin/datenqualitaet');
    expect(html).toContain('Datenqualität');
    expect(html).toContain('data-route="/admin"');
    expect(html).toContain('Dashboard');
    expect(html).toContain('/admin/projekt-erstellen');
    expect(html).toContain('/admin/auftrag');
    expect(html).toContain('/admin/ausgangsrechnungen');
    expect(html).toContain('/admin/rechnung');
    expect(html).toContain('Creatorrechnungen');
    expect(html).toContain('Zurück zur App');
    expect(html).not.toContain('/admin/unternehmen');
    expect(html).not.toContain('Mitarbeiter');
    expect(html).not.toContain('Briefings');
  });

  it('wechselt ueber syncWithRoute zwischen Haupt- und Accounting-Navigation', () => {
    const nav = new NavigationSystem();
    nav.renderNavigation('/dashboard');
    const main = document.getElementById('main-nav').innerHTML;
    expect(main).toContain('Aufträge');
    expect(main).toContain('Kundenrechnungen');
    expect(main).toContain('Mitarbeiter');
    expect(main).toContain('Geteilte Listen');
    expect(main).toContain('Kundendaten');
    expect(main).not.toContain('href="/projekt-erstellen"');
    expect(main).not.toContain('Creatorrechnungen');
    expect(main).not.toContain('Stammdaten');
    expect(main).not.toContain('Content & Konzepte');

    nav.syncWithRoute('/admin');
    const accounting = document.getElementById('main-nav').innerHTML;
    expect(accounting).toContain('Datenqualität');
    expect(accounting).toContain('Creatorrechnungen');

    nav.syncWithRoute('/dashboard');
    const back = document.getElementById('main-nav').innerHTML;
    expect(back).toContain('Aufträge');
    expect(back).toContain('Unternehmen');
    expect(back).toContain('Mitarbeiter');
    expect(back).not.toContain('Creatorrechnungen');
  });

  it('markiert /admin ohne Unterseite als aktives Dashboard', () => {
    const nav = new NavigationSystem();
    nav.renderNavigation('/dashboard');
    nav.syncWithRoute('/admin');

    const aktiverLink = document.querySelector('.nav-link.active');
    expect(aktiverLink?.getAttribute('data-route')).toBe('/admin');
  });

  it('markiert /admin/stakeholder und /admin/dashboard als Dashboard', () => {
    const nav = new NavigationSystem();
    nav.renderNavigation('/admin/datenqualitaet');
    nav.syncWithRoute('/admin/stakeholder');
    expect(document.querySelector('.nav-link.active')?.getAttribute('data-route')).toBe('/admin');

    nav.syncWithRoute('/admin/dashboard');
    expect(document.querySelector('.nav-link.active')?.getAttribute('data-route')).toBe('/admin');
  });

  it('haelt den Accounting-Bereich auf /admin/auftrag aktiv', () => {
    const nav = new NavigationSystem();
    nav.renderNavigation('/dashboard');
    nav.syncWithRoute('/admin/auftrag');
    const html = document.getElementById('main-nav').innerHTML;
    expect(html).toContain('Datenqualität');
    expect(html).toContain('Creatorrechnungen');
    expect(document.querySelector('.nav-link.active')?.getAttribute('data-route')).toBe('/admin/auftrag');
  });

  it('blendet Accounting-Punkte fuer Nicht-Admins aus', () => {
    window.isAdmin = () => false;
    const nav = new NavigationSystem();
    nav.renderNavigation('/admin');
    const html = document.getElementById('main-nav').innerHTML;
    expect(html).toContain('Zurück zur App');
    expect(html).not.toContain('Datenqualität');
    expect(html).not.toContain('Creatorrechnungen');
  });

  it('zeigt Mitarbeitern und Leads kein Accounting, auch mit canCreateProject', () => {
    window.isAdmin = () => false;
    window.canViewAccounting = () => false;
    window.canCreateProject = () => true;
    const nav = new NavigationSystem();
    nav.renderNavigation('/admin');
    const html = document.getElementById('main-nav').innerHTML;
    expect(html).toContain('Zurück zur App');
    expect(html).not.toContain('Datenqualität');
    expect(html).not.toContain('Creatorrechnungen');
    expect(html).not.toContain('/admin/projekt-erstellen');
    expect(html).not.toContain('/admin/auftrag');
  });

  it('hat in der Hauptnav keinen Projekt-anlegen-CTA', () => {
    const nav = new NavigationSystem();
    nav.renderNavigation('/dashboard');
    const main = document.getElementById('main-nav').innerHTML;
    expect(main).not.toContain('href="/projekt-erstellen"');
    expect(main).toContain('Aufträge');
    expect(main).toContain('Kundenrechnungen');

    nav.syncWithRoute('/admin');
    expect(document.getElementById('main-nav').innerHTML).toContain('/admin/projekt-erstellen');
  });

  it('zeigt Verwaltung und KI in der Hauptnav nur fuer Admins', () => {
    const nav = new NavigationSystem();
    nav.renderNavigation('/dashboard');
    expect(document.getElementById('main-nav').innerHTML).toContain('Mitarbeiter');
    expect(document.getElementById('main-nav').innerHTML).toContain('KI-Nutzung');

    window.isAdmin = () => false;
    window.isInternal = () => false;
    nav.renderNavigation('/dashboard');
    const html = document.getElementById('main-nav').innerHTML;
    expect(html).not.toContain('Mitarbeiter');
    expect(html).not.toContain('KI-Nutzung');
    expect(html).not.toContain('Geteilte Listen');
  });

  it('zeigt dem Investor Accounting ohne Datenqualität, Projekt anlegen, Verwaltung, KI und Listen', () => {
    window.isAdmin = () => false;
    window.isInternal = () => false;
    window.isInvestor = () => true;
    window.canViewAccounting = () => true;
    window.canCreateProject = () => false;
    window.currentUser = {
      permissions: {
        unternehmen: { can_view: true },
        creator: { can_view: true },
        auftrag: { can_view: true },
        rechnung: { can_view: true },
        mitarbeiter: { can_view: false },
        'kunden-admin': { can_view: false }
      }
    };

    const nav = new NavigationSystem();
    nav.renderNavigation('/admin');
    const accounting = document.getElementById('main-nav').innerHTML;
    expect(accounting).toContain('data-route="/admin"');
    expect(accounting).toContain('Creatorrechnungen');
    expect(accounting).toContain('Zurück zur App');
    expect(accounting).not.toContain('Datenqualität');
    expect(accounting).not.toContain('/admin/projekt-erstellen');

    nav.renderNavigation('/dashboard');
    const main = document.getElementById('main-nav').innerHTML;
    expect(main).toContain('Unternehmen');
    expect(main).not.toContain('Mitarbeiter');
    expect(main).not.toContain('KI-Nutzung');
    expect(main).not.toContain('Geteilte Listen');
  });
});
