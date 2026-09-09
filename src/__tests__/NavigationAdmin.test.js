import { describe, it, expect, beforeEach } from 'vitest';
import { NavigationSystem } from '../modules/navigation/NavigationSystem.js';

// Adminbereich (PRD Schritt 8): auf /admin-Routen rendert die Sidebar die
// reduzierte Admin-Navigation statt der vollen Hauptnavigation. Der
// Bereichswechsel laeuft ueber syncWithRoute, das die ModuleRegistry nach
// jeder Navigation aufruft (auch Header-Buttons und Browser-Zurueck).
describe('NavigationSystem Adminbereich', () => {
  beforeEach(() => {
    document.body.innerHTML = '<nav id="main-nav"></nav>';
    window.currentUser = { permissions: {} };
    window.canViewPage = () => undefined;
    window.canCreateProject = () => false;
    window.isInternal = () => true;
    window.isAdmin = () => true;
  });

  it('zeigt auf /admin-Routen die reduzierte Admin-Navigation', () => {
    const nav = new NavigationSystem();
    nav.renderNavigation('/admin/datenqualitaet');
    const html = document.getElementById('main-nav').innerHTML;

    expect(html).toContain('/admin/datenqualitaet');
    expect(html).toContain('Datenqualität');
    expect(html).toContain('Zurück zur App');
    // Volle Hauptnavigation ist im Adminbereich nicht sichtbar
    expect(html).not.toContain('Aufträge');
    expect(html).not.toContain('Briefings');
  });

  it('wechselt ueber syncWithRoute zwischen Haupt- und Admin-Navigation', () => {
    const nav = new NavigationSystem();
    nav.renderNavigation('/dashboard');
    expect(document.getElementById('main-nav').innerHTML).toContain('Aufträge');

    nav.syncWithRoute('/admin');
    expect(document.getElementById('main-nav').innerHTML).toContain('Datenqualität');

    nav.syncWithRoute('/dashboard');
    expect(document.getElementById('main-nav').innerHTML).toContain('Aufträge');
  });

  it('markiert /admin ohne Unterseite als aktive Datenqualitaet', () => {
    const nav = new NavigationSystem();
    nav.renderNavigation('/dashboard');
    nav.syncWithRoute('/admin');

    const aktiverLink = document.querySelector('.nav-link.active');
    expect(aktiverLink?.getAttribute('data-route')).toBe('/admin/datenqualitaet');
  });

  it('haelt den Adminbereich auf /admin/kunden aktiv (Alias-Route)', () => {
    const nav = new NavigationSystem();
    nav.renderNavigation('/dashboard');
    // Die ModuleRegistry ruft syncWithRoute mit dem Pfad vor dem
    // /admin/kunden-Rewrite auf — der Bereich bleibt Admin.
    nav.syncWithRoute('/admin/kunden');
    const html = document.getElementById('main-nav').innerHTML;
    expect(html).toContain('Datenqualität');
    expect(document.querySelector('.nav-link.active')?.getAttribute('data-route')).toBe('/admin/kunden');
  });
});
