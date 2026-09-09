import { describe, it, expect, beforeEach } from 'vitest';
import { NavigationSystem } from '../modules/navigation/NavigationSystem.js';

describe('NavigationSystem Stakeholder', () => {
  beforeEach(() => {
    document.body.innerHTML = '<nav id="main-nav"></nav>';
    window.currentUser = { permissions: { auftrag: { can_view: true }, kampagne: { can_view: true } } };
    window.canViewPage = () => undefined;
    window.canCreateProject = () => false;
    window.isInternal = () => false;
    window.isAdmin = () => false;
  });

  it('zeigt Stakeholder nur in der Admin-Navigation, nicht in der Hauptnavigation', () => {
    window.isAdmin = () => true;
    window.isInternal = () => true;
    const nav = new NavigationSystem();
    nav.renderNavigation('/dashboard');
    const main = document.getElementById('main-nav').innerHTML;
    expect(main).not.toContain('/stakeholder');
    expect(main).not.toContain('Stakeholder');
    expect(main).not.toContain('Geteilte Listen');

    nav.syncWithRoute('/admin/stakeholder');
    const admin = document.getElementById('main-nav').innerHTML;
    expect(admin).toContain('/admin/stakeholder');
    expect(admin).toContain('Stakeholder');
  });

  it('versteckt Stakeholder für Nicht-Admins auch wenn canViewPage true', () => {
    window.isAdmin = () => false;
    window.canViewPage = () => true;
    const nav = new NavigationSystem();
    nav.renderNavigation();
    expect(document.getElementById('main-nav').innerHTML).not.toContain('/stakeholder');
    nav.renderNavigation('/admin');
    expect(document.getElementById('main-nav').innerHTML).not.toContain('Stakeholder');
  });
});
