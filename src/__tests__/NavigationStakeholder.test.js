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
    window.canViewAccounting = () => false;
    window.canCreateProject = () => false;
  });

  it('zeigt das Accounting-Dashboard nur in der Accounting-Navigation', () => {
    window.isAdmin = () => true;
    window.isInternal = () => true;
    const nav = new NavigationSystem();
    nav.renderNavigation('/dashboard');
    const main = document.getElementById('main-nav').innerHTML;
    expect(main).not.toContain('/stakeholder');
    expect(main).not.toContain('Creatorrechnungen');
    expect(main).toContain('Geteilte Listen');

    nav.syncWithRoute('/admin/stakeholder');
    const admin = document.getElementById('main-nav').innerHTML;
    expect(admin).toContain('data-route="/admin"');
    expect(admin).toContain('Datenqualität');
    expect(admin).toContain('Creatorrechnungen');
  });

  it('zeigt das Accounting-Dashboard für Investoren ohne Datenqualität', () => {
    window.isAdmin = () => false;
    window.isInternal = () => false;
    window.canViewAccounting = () => true;
    window.canCreateProject = () => false;
    const nav = new NavigationSystem();
    nav.renderNavigation('/admin');
    const html = document.getElementById('main-nav').innerHTML;
    expect(html).toContain('data-route="/admin"');
    expect(html).toContain('Creatorrechnungen');
    expect(html).not.toContain('Datenqualität');
  });

  it('versteckt das Accounting-Dashboard für Nicht-Admins auch wenn canViewPage true', () => {
    window.isAdmin = () => false;
    window.canViewPage = () => true;
    const nav = new NavigationSystem();
    nav.renderNavigation();
    expect(document.getElementById('main-nav').innerHTML).not.toContain('/stakeholder');
    nav.renderNavigation('/admin');
    const html = document.getElementById('main-nav').innerHTML;
    expect(html).not.toContain('Datenqualität');
    expect(html).not.toContain('Creatorrechnungen');
  });
});
