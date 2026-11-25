import { describe, it, expect, beforeEach, vi } from 'vitest';
import { actionBuilder } from '../core/actions/ActionBuilder.js';
import { kampagneAbschlussOptions, setKampagneAbschluss } from '../core/actions/kampagneAbschluss.js';
import { GLOBAL_ACTIONS } from '../core/ActionsDropdownHandlers.js';

const render = (kampagne) =>
  actionBuilder.create('kampagne', 'k1', { rolle: 'admin' }, kampagneAbschlussOptions(kampagne));

describe('Kampagne manuell abschließen', () => {
  beforeEach(() => {
    window.permissionSystem = { can: vi.fn().mockReturnValue(true) };
  });

  it('offene Kampagne: Eintrag „Als abgeschlossen markieren“ mit Ziel true', () => {
    const html = render({ is_completed: false, abschluss_manuell: false });
    expect(html).toContain('data-action="abschliessen"');
    expect(html).toContain('Als abgeschlossen markieren');
    expect(html).toContain('data-abschluss="true"');
  });

  it('manuell abgeschlossen: „Wieder öffnen“ mit Ziel false', () => {
    const html = render({ is_completed: true, abschluss_manuell: true });
    expect(html).toContain('Wieder öffnen');
    expect(html).toContain('data-abschluss="false"');
  });

  it('über Freigabe abgeschlossen: Eintrag ausgeblendet', () => {
    const html = render({ is_completed: true, abschluss_manuell: false });
    expect(html).not.toContain('data-action="abschliessen"');
    expect(html).toContain('data-action="edit"');
  });

  it('Flags nicht geladen: Eintrag ausgeblendet', () => {
    expect(render({})).not.toContain('data-action="abschliessen"');
  });

  it('nutzt das Check-Icon und andere Einträge bekommen kein data-abschluss', () => {
    const html = render({ is_completed: false, abschluss_manuell: false });
    const edit = html.match(/<a[^>]*data-action="edit"[^>]*>/)[0];
    expect(edit).not.toContain('data-abschluss');
  });

  it('Aktion ist als globale Aktion registriert', () => {
    expect(GLOBAL_ACTIONS.has('abschliessen')).toBe(true);
  });

  it('setKampagneAbschluss schreibt abschluss_manuell und feuert entityUpdated', async () => {
    const select = vi.fn().mockResolvedValue({ data: [{ id: 'k1' }], error: null });
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    window.supabase = { from: vi.fn(() => ({ update })) };
    const listener = vi.fn();
    window.addEventListener('entityUpdated', listener);

    await setKampagneAbschluss('k1', true);

    expect(window.supabase.from).toHaveBeenCalledWith('kampagne');
    expect(update).toHaveBeenCalledWith({ abschluss_manuell: true });
    expect(eq).toHaveBeenCalledWith('id', 'k1');
    expect(listener.mock.calls[0][0].detail).toMatchObject({ entity: 'kampagne', action: 'updated', id: 'k1' });
    window.removeEventListener('entityUpdated', listener);
  });

  it('setKampagneAbschluss meldet RLS-Ablehnung (0 Zeilen) ohne Event', async () => {
    const select = vi.fn().mockResolvedValue({ data: [], error: null });
    window.supabase = { from: () => ({ update: () => ({ eq: () => ({ select }) }) }) };
    window.toastSystem = { show: vi.fn() };
    const listener = vi.fn();
    window.addEventListener('entityUpdated', listener);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await setKampagneAbschluss('k1', true);

    expect(listener).not.toHaveBeenCalled();
    expect(window.toastSystem.show).toHaveBeenCalledWith('Aktualisierung fehlgeschlagen', 'error');
    window.removeEventListener('entityUpdated', listener);
  });
});
