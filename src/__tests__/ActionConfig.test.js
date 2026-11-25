import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActionConfig } from '../core/actions/ActionConfig.js';

describe('ActionConfig Capability-Filter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.permissionSystem = { can: vi.fn() };
  });

  it('blendet edit/delete aus wenn can(edit/delete) false', () => {
    window.permissionSystem.can.mockReturnValue(false);

    const config = ActionConfig.get('kampagne', 'mitarbeiter');
    const ids = config.actions.map(a => a.id);

    expect(ids).toContain('view');
    expect(ids).not.toContain('edit');
    expect(ids).not.toContain('delete');
  });

  it('behält edit wenn can(edit) true, delete bleibt bei can(delete) false', () => {
    window.permissionSystem.can.mockImplementation((entity, verb) => verb === 'edit');

    const config = ActionConfig.get('kampagne', 'mitarbeiter');
    const ids = config.actions.map(a => a.id);

    expect(ids).toContain('view');
    expect(ids).toContain('edit');
    expect(ids).not.toContain('delete');
  });

  it('Admin bekommt Write-Actions unabhängig von can()', () => {
    window.permissionSystem.can.mockReturnValue(false);

    const config = ActionConfig.get('kampagne', 'admin');
    const ids = config.actions.map(a => a.id);

    expect(ids).toContain('edit');
    expect(ids).toContain('delete');
  });

  it('Produkt anlegen am Unternehmen fragt produkt.create', () => {
    window.permissionSystem.can.mockImplementation((entity, verb) => (
      entity === 'produkt' && verb === 'create'
    ));

    const config = ActionConfig.get('unternehmen', 'mitarbeiter');
    const ids = config.actions.map(a => a.id);

    expect(ids).toContain('add_produkt');
    expect(window.permissionSystem.can).toHaveBeenCalledWith('produkt', 'create');
  });

  it('ohne produkt.create bleibt Produkt anlegen am Unternehmen verborgen', () => {
    window.permissionSystem.can.mockImplementation((entity, verb) => (
      entity === 'unternehmen' && verb === 'create'
    ));

    const config = ActionConfig.get('unternehmen', 'mitarbeiter');
    const ids = config.actions.map(a => a.id);

    expect(ids).not.toContain('add_produkt');
  });

  it('Mitarbeiter ohne Kampagnen-Edit sieht Abschluss, aber nicht Bearbeiten', () => {
    window.permissionSystem.can.mockImplementation((_entity, verb) => verb === 'delete' || verb === 'view');

    const config = ActionConfig.get('kampagne', 'mitarbeiter');
    const ids = config.actions.map(a => a.id);

    expect(ids).not.toContain('edit');
    expect(ids).toContain('abschliessen');
    expect(ids).toContain('delete');
  });

  it('Investor (mitarbeiter, kein edit-Recht) sieht nur view', () => {
    window.permissionSystem.can.mockReturnValue(false);

    const config = ActionConfig.get('kampagne', 'mitarbeiter');
    const ids = config.actions.map(a => a.id);

    expect(ids).toEqual(['view']);
  });
});
