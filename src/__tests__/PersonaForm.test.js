import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PersonaForm } from '../modules/persona/PersonaForm.js';

vi.mock('../modules/persona/PersonaService.js', () => ({
  PersonaService: {
    loadOne: vi.fn(),
    loadMarkenIds: vi.fn(),
    label: vi.fn((p) => [p?.oberbegriff, p?.name].filter(Boolean).join(' · ') || 'Persona')
  }
}));

vi.mock('../core/OwnerContext.js', () => ({
  resolveOwnerContext: vi.fn()
}));

function setPath(path) {
  window.history.replaceState({}, '', path);
}

describe('PersonaForm', () => {
  let form;

  beforeEach(() => {
    vi.clearAllMocks();
    form = new PersonaForm();
    window.setHeadline = vi.fn();
    window.breadcrumbSystem = { updateBreadcrumb: vi.fn() };
    window.formSystem = {
      renderFormOnly: vi.fn(() => '<form id="persona-form"></form>'),
      bindFormEvents: vi.fn()
    };
    window.navigateTo = vi.fn();
    window.toastSystem = { error: vi.fn(), success: vi.fn() };
    window.ErrorHandler = { handle: vi.fn() };
    window.content = document.createElement('div');
    document.body.appendChild(window.content);
  });

  afterEach(() => {
    window.content?.remove();
    delete window.content;
  });

  it('erkennt standalone an der URL', () => {
    setPath('/persona/new');
    expect(form.isStandalone).toBe(true);
    expect(form.returnRoute).toBe('/persona');

    setPath('/unternehmen/u1/persona');
    expect(form.isStandalone).toBe(false);
  });

  it('nested: returnRoute zeigt auf den Tab', () => {
    setPath('/unternehmen/u1/persona');
    form.ctx = { basePath: '/unternehmen/u1' };
    expect(form.returnRoute).toBe('/unternehmen/u1?tab=personas');
  });

  it('standalone edit: laedt Persona ohne Owner-Kontext', async () => {
    setPath('/persona/p1');
    const { PersonaService } = await import('../modules/persona/PersonaService.js');
    PersonaService.loadOne.mockResolvedValue({ id: 'p1', name: 'Sarah', unternehmen_id: 'u1' });
    PersonaService.loadMarkenIds.mockResolvedValue(['m1']);

    await form.init('p1');

    expect(PersonaService.loadOne).toHaveBeenCalledWith('p1');
    expect(form.personaId).toBe('p1');
    expect(form.markenIds).toEqual(['m1']);
  });

  it('standalone new: kein Laden, leerer Kontext', async () => {
    setPath('/persona/new');

    await form.init('new');

    expect(form.personaId).toBeNull();
    expect(form.persona).toBeNull();
    expect(form.ctx.listPath).toBe('/persona');
  });

  it('standalone: Persona nicht gefunden leitet zur Liste', async () => {
    setPath('/persona/p1');
    const { PersonaService } = await import('../modules/persona/PersonaService.js');
    PersonaService.loadOne.mockResolvedValue(null);

    await form.init('p1');

    expect(window.toastSystem.error).toHaveBeenCalledWith('Persona nicht gefunden');
    expect(window.navigateTo).toHaveBeenCalledWith('/persona');
  });
});
