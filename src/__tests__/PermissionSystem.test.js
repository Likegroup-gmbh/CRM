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
      ['admin',        { isAdmin: true,  isKunde: false, isKundeEditor: false, isMitarbeiter: false, isInvestor: false, isPending: false, isInternal: true }],
      ['mitarbeiter',  { isAdmin: false, isKunde: false, isKundeEditor: false, isMitarbeiter: true,  isInvestor: false, isPending: false, isInternal: true }],
      ['kunde',        { isAdmin: false, isKunde: true,  isKundeEditor: false, isMitarbeiter: false, isInvestor: false, isPending: false, isInternal: false }],
      ['kunde_editor', { isAdmin: false, isKunde: true,  isKundeEditor: true,  isMitarbeiter: false, isInvestor: false, isPending: false, isInternal: false }],
      ['pending',      { isAdmin: false, isKunde: false, isKundeEditor: false, isMitarbeiter: false, isInvestor: false, isPending: true,  isInternal: false }],
      ['gast',         { isAdmin: false, isKunde: true,  isKundeEditor: false, isMitarbeiter: false, isInvestor: false, isPending: false, isInternal: false }],
      ['investor',     { isAdmin: false, isKunde: false, isKundeEditor: false, isMitarbeiter: false, isInvestor: true,  isPending: false, isInternal: false }],
    ];

    it.each(cases)('Rolle "%s" liefert korrekte Helper-Werte', (rolle, expected) => {
      ps.setUserPermissions(makeUser(rolle));

      expect(ps.isAdmin).toBe(expected.isAdmin);
      expect(ps.isKunde).toBe(expected.isKunde);
      expect(ps.isKundeEditor).toBe(expected.isKundeEditor);
      expect(ps.isMitarbeiter).toBe(expected.isMitarbeiter);
      expect(ps.isInvestor).toBe(expected.isInvestor);
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
      expect(ps.canViewAccounting).toBe(false);
      expect(ps.canBulkDelete).toBe(true);
      expect(ps.canCreateProject).toBe(true);
      expect(ps.canUseGlobalSearch).toBe(true);
    });

    it('Lead hat kein Accounting und keine Mitarbeiterverwaltung', () => {
      ps.setUserPermissions(makeUser('mitarbeiter', {
        mitarbeiter_klasse: { name: 'Lead' }
      }));
      expect(ps.isMitarbeiter).toBe(true);
      expect(ps.isInvestor).toBe(false);
      expect(ps.canViewAccounting).toBe(false);
      expect(ps.canManageStaff).toBe(false);
      expect(ps.canCreateProject).toBe(true);
    });

    it('Kunde hat keine internen Capabilities', () => {
      ps.setUserPermissions(makeUser('kunde'));
      expect(ps.canSeePricing).toBe(false);
      expect(ps.canManageStaff).toBe(false);
      expect(ps.canBulkDelete).toBe(false);
      expect(ps.canCreateProject).toBe(false);
      expect(ps.canUseGlobalSearch).toBe(true);
    });

    it('kunde_editor hat gleiche Capabilities wie kunde', () => {
      ps.setUserPermissions(makeUser('kunde_editor'));
      expect(ps.canSeePricing).toBe(false);
      expect(ps.canBulkDelete).toBe(false);
    });

    it('Investor sieht Accounting und Preise, legt kein Projekt an', () => {
      ps.setUserPermissions(makeUser('investor'));
      expect(ps.canSeePricing).toBe(true);
      expect(ps.canViewAccounting).toBe(true);
      expect(ps.canViewContracts).toBe(true);
      expect(ps.isUnscoped).toBe(true);
      expect(ps.canManageStaff).toBe(false);
      expect(ps.canBulkDelete).toBe(false);
      expect(ps.canCreateProject).toBe(false);
      expect(ps.isInternal).toBe(false);
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

    it('Kunde kann Skripte nur sehen', () => {
      ps.setUserPermissions(makeUser('kunde'));
      expect(ps.checkPermission('skripte', 'view')).toBe(true);
      expect(ps.checkPermission('skripte', 'edit')).toBe(false);
      expect(ps.checkPermission('skripte', 'delete')).toBe(false);
      expect(ps.canViewPage('skripte')).toBe(true);
    });

    it('Kunde hat kein Persona-Recht (RLS blockiert Schreiben)', () => {
      ps.setUserPermissions(makeUser('kunde'));
      expect(ps.checkPermission('persona', 'view')).toBe(false);
      expect(ps.checkPermission('persona', 'edit')).toBe(false);
      expect(ps.checkPermission('persona', 'delete')).toBe(false);
    });

    it('Mitarbeiter kann Personas voll verwalten', () => {
      ps.setUserPermissions(makeUser('mitarbeiter'));
      expect(ps.checkPermission('persona', 'view')).toBe(true);
      expect(ps.checkPermission('persona', 'edit')).toBe(true);
      expect(ps.checkPermission('persona', 'delete')).toBe(true);
    });

    it('Admin kann Personas voll verwalten', () => {
      ps.setUserPermissions(makeUser('admin'));
      expect(ps.checkPermission('persona', 'view')).toBe(true);
      expect(ps.checkPermission('persona', 'edit')).toBe(true);
      expect(ps.checkPermission('persona', 'delete')).toBe(true);
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

    it('Investor sieht Entities, aber nicht edit/delete und keine Verwaltung', () => {
      ps.setUserPermissions(makeUser('investor'));
      expect(ps.checkPermission('kampagne', 'view')).toBe(true);
      expect(ps.checkPermission('kampagne', 'edit')).toBe(false);
      expect(ps.checkPermission('kampagne', 'delete')).toBe(false);
      expect(ps.checkPermission('auftrag', 'view')).toBe(true);
      expect(ps.checkPermission('rechnung', 'view')).toBe(true);
      expect(ps.checkPermission('rechnung', 'edit')).toBe(false);
      expect(ps.checkPermission('unternehmen', 'view')).toBe(true);
      expect(ps.checkPermission('mitarbeiter', 'view')).toBe(false);
      expect(ps.checkPermission('kunden-admin', 'view')).toBe(false);
    });

    it('Gast sieht geteilte Entitäten, sonst nichts', () => {
      ps.setUserPermissions(makeUser('gast'));
      expect(ps.isGast).toBe(true);
      expect(ps.checkPermission('kampagne', 'view')).toBe(true);
      expect(ps.checkPermission('sourcing', 'view')).toBe(true);
      expect(ps.checkPermission('strategie', 'view')).toBe(true);
      expect(ps.checkPermission('kampagne', 'edit')).toBe(false);
      expect(ps.checkPermission('mitarbeiter', 'view')).toBe(false);
      expect(ps.checkPermission('rechnung', 'view')).toBe(false);
    });

    it('isGastReadonly folgt window.guestShare.rechte', () => {
      ps.setUserPermissions(makeUser('gast'));
      window.guestShare = { rechte: 'ansehen' };
      expect(ps.isGastReadonly).toBe(true);
      window.guestShare = { rechte: 'feedback' };
      expect(ps.isGastReadonly).toBe(false);
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

  it('window.isInvestor() und canViewAccounting delegieren an Singleton', () => {
    permissionSystem.setUserPermissions(makeUser('investor'));
    expect(window.isInvestor()).toBe(true);
    expect(window.canViewAccounting()).toBe(true);
    expect(window.canSeePricing()).toBe(true);
    expect(window.canCreateProject()).toBe(false);
    expect(window.isInternal()).toBe(false);

    permissionSystem.setUserPermissions(makeUser('admin'));
    expect(window.isInvestor()).toBe(false);
    expect(window.canViewAccounting()).toBe(true);
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

describe('Finanzen-Klassen-Preset', () => {
  let ps;

  function finanzenUser(overrides = {}) {
    return {
      id: 'u1',
      rolle: 'mitarbeiter',
      zugriffsrechte: null,
      mitarbeiter_klasse: { id: 'k1', name: 'Finanzen' },
      ...overrides
    };
  }

  beforeEach(() => {
    ps = new PermissionSystem();
  });

  it('liest die ganze Plattform view-only (wie rolle=investor), bearbeitet nichts', () => {
    ps.setUserPermissions(finanzenUser());

    expect(ps.canView('dashboard')).toBe(true);
    expect(ps.canView('auftrag')).toBe(true);
    expect(ps.canView('auftragsdetails')).toBe(true);
    expect(ps.canView('kampagne')).toBe(true);
    // Voll lesen wie Investor, aber keine Verwaltung
    expect(ps.canView('creator')).toBe(true);
    expect(ps.canView('unternehmen')).toBe(true);
    expect(ps.canView('briefing')).toBe(true);
    expect(ps.canView('mitarbeiter')).toBe(false);
    // Nichts schreiben
    expect(ps.canEdit('auftrag')).toBe(false);
    expect(ps.canEdit('kampagne')).toBe(false);
    expect(ps.canCreate('kampagne')).toBe(false);
  });

  it('ist unscoped, darf kein Projekt anlegen, sieht Preise', () => {
    ps.setUserPermissions(finanzenUser());

    expect(ps.isUnscoped).toBe(true);
    expect(ps.isInternal).toBe(true);
    expect(ps.canCreateProject).toBe(false);
    expect(ps.canBulkDelete).toBe(false);
    expect(ps.canSeePricing).toBe(true);
  });

  it('zugriffsrechte schlagen die Klassen-Zeile (Q2 = B)', () => {
    ps.setUserPermissions(finanzenUser({
      zugriffsrechte: { creator: { can_view: true, can_edit: true } }
    }));

    // Klasse ist Startzeile, nicht hartes Preset: Admin-Toggle dreht creator auf.
    expect(ps.canView('creator')).toBe(true);
    expect(ps.canEdit('creator')).toBe(true);
    expect(ps.canView('auftrag')).toBe(true);
  });

  it('erkennt Klasse auch über mitarbeiter_klasse_name', () => {
    ps.setUserPermissions({
      id: 'u1',
      rolle: 'mitarbeiter',
      mitarbeiter_klasse_name: 'Finanzen'
    });
    expect(ps.canView('kampagne')).toBe(true);
    expect(ps.canCreateProject).toBe(false);
  });

  // Investor = Finanzen-Klasse: view-only, kein create/edit/delete irgendwo,
  // obwohl isInternal/isKunde=false (Pricing bleibt sichtbar).
  it('Investor (Finanzen) ist view-only: keine Write-Capabilities', () => {
    ps.setUserPermissions(finanzenUser());

    for (const entity of ['kampagne', 'sourcing', 'strategie', 'skripte', 'creator', 'kooperation', 'briefing']) {
      expect(ps.can(entity, 'create')).toBe(false);
      expect(ps.can(entity, 'edit')).toBe(false);
      expect(ps.can(entity, 'delete')).toBe(false);
    }
    expect(ps.canCreate('kampagne')).toBe(false);
    expect(ps.canEdit('sourcing')).toBe(false);
    // Views, die der Investor braucht
    expect(ps.canView('kampagne')).toBe(true);
    expect(ps.canView('auftrag')).toBe(true);
    // Intern: Preise sichtbar, aber nichts anlegbar
    expect(ps.isInternal).toBe(true);
    expect(ps.isInvestor).toBe(true);
    expect(ps.canSeePricing).toBe(true);
    expect(ps.canBulkDelete).toBe(false);
  });
});

describe('canView / canEdit bool', () => {
  let ps;

  beforeEach(() => {
    ps = new PermissionSystem();
  });

  it('Admin kann alles', () => {
    ps.setUserPermissions(makeUser('admin'));
    expect(ps.canView('mitarbeiter')).toBe(true);
    expect(ps.canEdit('auftrag')).toBe(true);
  });

  it('unbekannte Entity ist false, nicht undefined', () => {
    ps.setUserPermissions(makeUser('mitarbeiter'));
    expect(ps.canView('gibt-es-nicht')).toBe(false);
    expect(ps.canEdit('gibt-es-nicht')).toBe(false);
  });
});

describe('Entity-Alias creator_auswahl → sourcing', () => {
  let ps;

  beforeEach(() => {
    ps = new PermissionSystem();
  });

  it('Mitarbeiter: creator_auswahl loest auf sourcing auf (volle Rechte)', () => {
    ps.setUserPermissions(makeUser('mitarbeiter'));
    expect(ps.can('creator_auswahl', 'view')).toBe(true);
    expect(ps.can('creator_auswahl', 'edit')).toBe(true);
    expect(ps.can('creator_auswahl', 'delete')).toBe(true);
    expect(ps.canEdit('creator_auswahl')).toBe(true);
    expect(ps.checkPermission('creator_auswahl', 'edit')).toBe(true);
  });

  it('Investor: creator_auswahl ist view-only wie sourcing', () => {
    ps.setUserPermissions(makeUser('investor'));
    expect(ps.can('creator_auswahl', 'view')).toBe(true);
    expect(ps.can('creator_auswahl', 'create')).toBe(false);
    expect(ps.can('creator_auswahl', 'edit')).toBe(false);
    expect(ps.can('creator_auswahl', 'delete')).toBe(false);
    expect(ps.canEdit('creator_auswahl')).toBe(false);
  });

  it('Kunde: creator_auswahl erbt sourcing view-only', () => {
    ps.setUserPermissions(makeUser('kunde'));
    expect(ps.can('creator_auswahl', 'view')).toBe(true);
    expect(ps.canEdit('creator_auswahl')).toBe(false);
  });

  it('zugriffsrechte-Override auf sourcing gilt auch fuer creator_auswahl', () => {
    ps.setUserPermissions(makeUser('mitarbeiter', {
      zugriffsrechte: { sourcing: { can_edit: false, can_delete: false } }
    }));
    expect(ps.canEdit('creator_auswahl')).toBe(false);
    expect(ps.can('creator_auswahl', 'delete')).toBe(false);
    expect(ps.can('creator_auswahl', 'view')).toBe(true);
  });

  it('getEntityPermissions loest den Alias auf', () => {
    ps.setUserPermissions(makeUser('investor'));
    expect(ps.getEntityPermissions('creator_auswahl')).toEqual(ps.getEntityPermissions('sourcing'));
  });
});
