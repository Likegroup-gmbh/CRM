import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PermissionSystem, permissionSystem } from '../core/PermissionSystem.js';

function makeUser(rolle, overrides = {}) {
  return { id: 'u1', rolle, zugriffsrechte: null, ...overrides };
}

describe('PermissionSystem', () => {
  let ps;

  beforeEach(() => {
    ps = new PermissionSystem();
  });

  // ===========================================
  // Rollen-Helper fuer jede Rolle
  // ===========================================

  describe('Rollen-Helper', () => {
    const cases = [
      ['admin',        { isAdmin: true,  isKunde: false, isKundeEditor: false, isMitarbeiter: false, isPending: false, isInternal: true }],
      ['mitarbeiter',  { isAdmin: false, isKunde: false, isKundeEditor: false, isMitarbeiter: true,  isPending: false, isInternal: true }],
      ['kunde',        { isAdmin: false, isKunde: true,  isKundeEditor: false, isMitarbeiter: false, isPending: false, isInternal: false }],
      ['kunde_editor', { isAdmin: false, isKunde: true,  isKundeEditor: true,  isMitarbeiter: false, isPending: false, isInternal: false }],
      ['pending',      { isAdmin: false, isKunde: false, isKundeEditor: false, isMitarbeiter: false, isPending: true,  isInternal: false }],
    ];

    it.each(cases)('Rolle "%s" liefert korrekte Helper-Werte', (rolle, expected) => {
      ps.setUserPermissions(makeUser(rolle));

      expect(ps.isAdmin).toBe(expected.isAdmin);
      expect(ps.isKunde).toBe(expected.isKunde);
      expect(ps.isKundeEditor).toBe(expected.isKundeEditor);
      expect(ps.isMitarbeiter).toBe(expected.isMitarbeiter);
      expect(ps.isPending).toBe(expected.isPending);
      expect(ps.isInternal).toBe(expected.isInternal);
    });
  });

  // ===========================================
  // Feature-Capabilities
  // ===========================================

  describe('Feature-Capabilities', () => {
    it('Admin hat alle Capabilities', () => {
      ps.setUserPermissions(makeUser('admin'));
      expect(ps.canSeePricing).toBe(true);
      expect(ps.canManageStaff).toBe(true);
      expect(ps.canBulkDelete).toBe(true);
      expect(ps.canCreateProject).toBe(true);
      expect(ps.canUseGlobalSearch).toBe(true);
    });

    it('Mitarbeiter hat interne Capabilities, aber kein canManageStaff', () => {
      ps.setUserPermissions(makeUser('mitarbeiter'));
      expect(ps.canSeePricing).toBe(true);
      expect(ps.canManageStaff).toBe(false);
      expect(ps.canBulkDelete).toBe(true);
      expect(ps.canCreateProject).toBe(true);
      expect(ps.canUseGlobalSearch).toBe(true);
    });

    it('Kunde hat keine internen Capabilities', () => {
      ps.setUserPermissions(makeUser('kunde'));
      expect(ps.canSeePricing).toBe(false);
      expect(ps.canManageStaff).toBe(false);
      expect(ps.canBulkDelete).toBe(false);
      expect(ps.canCreateProject).toBe(false);
      expect(ps.canUseGlobalSearch).toBe(false);
    });

    it('kunde_editor hat gleiche Capabilities wie kunde', () => {
      ps.setUserPermissions(makeUser('kunde_editor'));
      expect(ps.canSeePricing).toBe(false);
      expect(ps.canBulkDelete).toBe(false);
    });
  });

  // ===========================================
  // Permission-Matrix
  // ===========================================

  describe('Permission-Matrix', () => {
    it('Admin kann alles', () => {
      ps.setUserPermissions(makeUser('admin'));
      expect(ps.checkPermission('kampagne', 'view')).toBe(true);
      expect(ps.checkPermission('kampagne', 'edit')).toBe(true);
      expect(ps.checkPermission('kampagne', 'delete')).toBe(true);
      expect(ps.checkPermission('rechnung', 'edit')).toBe(true);
      expect(ps.checkPermission('mitarbeiter', 'view')).toBe(true);
    });

    it('Mitarbeiter kann Auftrag nicht sehen (per Matrix)', () => {
      ps.setUserPermissions(makeUser('mitarbeiter'));
      expect(ps.checkPermission('auftrag', 'view')).toBe(false);
      expect(ps.checkPermission('auftrag', 'edit')).toBe(false);
    });

    it('Mitarbeiter kann Kampagne sehen und bearbeiten', () => {
      ps.setUserPermissions(makeUser('mitarbeiter'));
      expect(ps.checkPermission('kampagne', 'view')).toBe(true);
      expect(ps.checkPermission('kampagne', 'edit')).toBe(true);
      expect(ps.checkPermission('kampagne', 'delete')).toBe(true);
    });

    it('Kunde kann Kampagne nur sehen', () => {
      ps.setUserPermissions(makeUser('kunde'));
      expect(ps.checkPermission('kampagne', 'view')).toBe(true);
      expect(ps.checkPermission('kampagne', 'edit')).toBe(false);
      expect(ps.checkPermission('kampagne', 'delete')).toBe(false);
    });

    it('kunde_editor hat identische Matrix wie kunde', () => {
      const psKunde = new PermissionSystem();
      psKunde.setUserPermissions(makeUser('kunde'));

      const psEditor = new PermissionSystem();
      psEditor.setUserPermissions(makeUser('kunde_editor'));

      expect(psEditor.checkPermission('kampagne', 'view')).toBe(psKunde.checkPermission('kampagne', 'view'));
      expect(psEditor.checkPermission('creator', 'edit')).toBe(psKunde.checkPermission('creator', 'edit'));
      expect(psEditor.checkPermission('rechnung', 'view')).toBe(psKunde.checkPermission('rechnung', 'view'));
    });

    it('Pending-User sieht nur Dashboard', () => {
      ps.setUserPermissions(makeUser('pending'));
      expect(ps.checkPermission('dashboard', 'view')).toBe(true);
      expect(ps.checkPermission('kampagne', 'view')).toBe(false);
      expect(ps.checkPermission('creator', 'view')).toBe(false);
    });

    it('Unbekannte Rolle bekommt Default-Permissions', () => {
      ps.setUserPermissions(makeUser('unbekannt'));
      expect(ps.checkPermission('dashboard', 'view')).toBe(true);
      expect(ps.checkPermission('feedback', 'view')).toBe(true);
      expect(ps.checkPermission('kampagne', 'view')).toBe(false);
    });
  });

  // ===========================================
  // view vs can_view Normalisierung
  // ===========================================

  describe('Action-Normalisierung', () => {
    it('akzeptiert sowohl "view" als auch "can_view"', () => {
      ps.setUserPermissions(makeUser('kunde'));
      expect(ps.checkPermission('kampagne', 'view')).toBe(true);
      expect(ps.checkPermission('kampagne', 'can_view')).toBe(true);
    });

    it('akzeptiert sowohl "edit" als auch "can_edit"', () => {
      ps.setUserPermissions(makeUser('mitarbeiter'));
      expect(ps.checkPermission('kampagne', 'edit')).toBe(true);
      expect(ps.checkPermission('kampagne', 'can_edit')).toBe(true);
    });
  });

  // ===========================================
  // Overrides (zugriffsrechte)
  // ===========================================

  describe('Overrides', () => {
    it('zugriffsrechte ueberschreibt Matrix-Werte', () => {
      ps.setUserPermissions(makeUser('kunde', {
        zugriffsrechte: { rechnung: { can_view: true } }
      }));
      expect(ps.checkPermission('rechnung', 'view')).toBe(true);
    });

    it('boolean Override setzt nur can_view', () => {
      ps.setUserPermissions(makeUser('kunde', {
        zugriffsrechte: { creator: true }
      }));
      expect(ps.checkPermission('creator', 'view')).toBe(true);
      expect(ps.checkPermission('creator', 'edit')).toBe(false);
    });
  });

  // ===========================================
  // Page-Scoped Overrides
  // ===========================================

  describe('Page-Scoped Overrides', () => {
    it('pagePermissions ueberschreiben Matrix fuer can_view', () => {
      ps.setUserPermissions(makeUser('mitarbeiter'));
      ps.setScopedPermissions([
        { page_id: 'auftrag', table_id: null, can_view: true, can_edit: false, can_delete: false }
      ]);

      expect(ps.checkPermission('auftrag', 'view')).toBe(true);
    });

    it('tablePermissions ueberschreiben canViewTable', () => {
      ps.setUserPermissions(makeUser('mitarbeiter'));
      ps.setScopedPermissions([
        { page_id: 'kampagne', table_id: 'videos', can_view: false, can_edit: false, can_delete: false }
      ]);

      expect(ps.canViewTable('kampagne', 'videos')).toBe(false);
    });
  });

  // ===========================================
  // clearPermissions
  // ===========================================

  describe('clearPermissions', () => {
    it('setzt alle States zurueck', () => {
      ps.setUserPermissions(makeUser('admin'));
      ps.setScopedPermissions([
        { page_id: 'kampagne', table_id: null, can_view: true, can_edit: false, can_delete: false }
      ]);

      expect(ps.isAdmin).toBe(true);
      expect(Object.keys(ps.calculatedPermissions).length).toBeGreaterThan(0);
      expect(Object.keys(ps.pagePermissions).length).toBeGreaterThan(0);

      ps.clearPermissions();

      expect(ps.isAdmin).toBe(false);
      expect(ps.isKunde).toBe(false);
      expect(ps.isMitarbeiter).toBe(false);
      expect(ps._normalizedRole).toBe('');
      expect(ps.userRole).toBeNull();
      expect(ps.calculatedPermissions).toEqual({});
      expect(ps.pagePermissions).toEqual({});
      expect(ps.tablePermissions).toEqual({});
    });
  });

  // ===========================================
  // Robustheit (Edge Cases)
  // ===========================================

  describe('Edge Cases', () => {
    it('fehlende Rolle gibt false zurueck', () => {
      expect(ps.checkPermission('kampagne', 'view')).toBe(false);
    });

    it('Rolle mit Whitespace/Gross-Kleinschreibung wird normalisiert', () => {
      ps.setUserPermissions(makeUser('  Admin  '));
      expect(ps.isAdmin).toBe(true);
    });

    it('null/undefined Rolle wird graceful behandelt', () => {
      ps.setUserPermissions({ id: 'u1', rolle: null });
      expect(ps.isAdmin).toBe(false);
      expect(ps.isKunde).toBe(false);
      expect(ps._normalizedRole).toBe('');
    });
  });
});

// ===========================================
// Window-Exports (Singleton)
// ===========================================

describe('Window-Exports (Singleton)', () => {
  beforeEach(() => {
    permissionSystem.clearPermissions();
    window.currentUser = null;
  });

  it('window.isAdmin() delegiert an Singleton', () => {
    permissionSystem.setUserPermissions(makeUser('admin'));
    expect(window.isAdmin()).toBe(true);
    expect(window.isKunde()).toBe(false);
    expect(window.isMitarbeiter()).toBe(false);
  });

  it('window.isKunde() erkennt sowohl kunde als auch kunde_editor', () => {
    permissionSystem.setUserPermissions(makeUser('kunde'));
    expect(window.isKunde()).toBe(true);

    permissionSystem.setUserPermissions(makeUser('kunde_editor'));
    expect(window.isKunde()).toBe(true);
  });

  it('window.isMitarbeiter() funktioniert korrekt', () => {
    permissionSystem.setUserPermissions(makeUser('mitarbeiter'));
    expect(window.isMitarbeiter()).toBe(true);
    expect(window.isInternal()).toBe(true);
  });

  it('window.canSeePricing() ist false fuer Kunden', () => {
    permissionSystem.setUserPermissions(makeUser('kunde'));
    expect(window.canSeePricing()).toBe(false);
  });

  it('window.canBulkDelete() ist true fuer Interne', () => {
    permissionSystem.setUserPermissions(makeUser('mitarbeiter'));
    expect(window.canBulkDelete()).toBe(true);

    permissionSystem.setUserPermissions(makeUser('admin'));
    expect(window.canBulkDelete()).toBe(true);
  });

  it('nach clearPermissions liefern alle Helper false', () => {
    permissionSystem.setUserPermissions(makeUser('admin'));
    expect(window.isAdmin()).toBe(true);

    permissionSystem.clearPermissions();
    expect(window.isAdmin()).toBe(false);
    expect(window.isKunde()).toBe(false);
    expect(window.canBulkDelete()).toBe(false);
  });

  it('window.checkUserPermission delegiert korrekt', () => {
    permissionSystem.setUserPermissions(makeUser('mitarbeiter'));
    expect(window.checkUserPermission('kampagne', 'view')).toBe(true);
    expect(window.checkUserPermission('auftrag', 'view')).toBe(false);
  });
});
