import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareRoute } from '../core/navigation/prepareRoute.js';
import { PermissionSystem } from '../core/PermissionSystem.js';

function asRole(rolle) {
  const ps = new PermissionSystem();
  ps.setUserPermissions({ id: 'u1', rolle, zugriffsrechte: null });
  window.permissionSystem = ps;
  window.canEdit = (entity) => ps.canEdit(entity);
  window.canCreate = (entity) => ps.canCreate(entity);
  window.canViewAccounting = () => rolle === 'admin';
  window.isAdmin = () => rolle === 'admin';
  window.currentUser = { rolle, isBlocked: false };
  window.toastSystem = { show: vi.fn() };
  delete window.guestShare;
}

describe('Projekt-Wizard für Mitarbeitende', () => {
  const registry = { modules: new Map() };

  beforeEach(() => {
    asRole('mitarbeiter');
  });

  it('zeigt den Bearbeiten-Wizard nicht', async () => {
    const result = await prepareRoute(registry, '/projekt-erstellen/edit/a1?step=kampagnen', true);
    expect(result.proceed).toBe(false);
    expect(window.toastSystem.show).toHaveBeenCalled();
  });

  it('blockiert auch /projekt-erstellen/:id/edit', async () => {
    const result = await prepareRoute(registry, '/projekt-erstellen/a1/edit', true);
    expect(result.proceed).toBe(false);
  });

  it('lässt Projekt anlegen offen', async () => {
    const result = await prepareRoute(registry, '/projekt-erstellen', true);
    expect(result.proceed).toBe(true);
  });

  it('lässt Admins in den Wizard', async () => {
    asRole('admin');
    const result = await prepareRoute(registry, '/projekt-erstellen/edit/a1', true);
    expect(result.proceed).toBe(true);
  });
});
