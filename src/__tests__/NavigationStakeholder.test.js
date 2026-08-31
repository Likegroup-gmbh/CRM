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

  it('zeigt Stakeholder nur für Admins', () => {
    window.isAdmin = () => true;
    const nav = new NavigationSystem();
    nav.renderNavigation();
    expect(document.getElementById('main-nav').innerHTML).toContain('/stakeholder');
    expect(document.getElementById('main-nav').innerHTML).toContain('Stakeholder');
  });

  it('versteckt Stakeholder für Nicht-Admins auch wenn canViewPage true', () => {
    window.isAdmin = () => false;
    window.canViewPage = () => true;
    const nav = new NavigationSystem();
    nav.renderNavigation();
    expect(document.getElementById('main-nav').innerHTML).not.toContain('/stakeholder');
  });
});
