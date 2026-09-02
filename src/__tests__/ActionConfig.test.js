import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActionConfig } from '../core/actions/ActionConfig.js';

describe('ActionConfig can_edit Filter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.permissionSystem = {
      getEntityPermissions: vi.fn()
    };
  });

  it('blendet edit/delete aus wenn can_edit false', () => {
    window.permissionSystem.getEntityPermissions.mockReturnValue({
      can_view: true,
      can_edit: false
    });

    const config = ActionConfig.get('kampagne', 'mitarbeiter');
    const ids = config.actions.map(a => a.id);

    expect(ids).toContain('view');
    expect(ids).not.toContain('edit');
    expect(ids).not.toContain('delete');
  });

  it('behält edit wenn can_edit true', () => {
    window.permissionSystem.getEntityPermissions.mockReturnValue({
      can_view: true,
      can_edit: true
    });

    const config = ActionConfig.get('kampagne', 'mitarbeiter');
    const ids = config.actions.map(a => a.id);

    expect(ids).toContain('view');
    expect(ids).toContain('edit');
    expect(ids).toContain('delete');
  });

  it('Admin bekommt Write-Actions unabhängig von can_edit', () => {
    window.permissionSystem.getEntityPermissions.mockReturnValue({
      can_view: true,
      can_edit: false
    });

    const config = ActionConfig.get('kampagne', 'admin');
    const ids = config.actions.map(a => a.id);

    expect(ids).toContain('edit');
    expect(ids).toContain('delete');
  });
});
