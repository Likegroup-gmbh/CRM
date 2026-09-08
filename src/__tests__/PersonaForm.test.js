import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PersonaForm } from '../modules/persona/PersonaForm.js';

vi.mock('../modules/persona/PersonaService.js', () => ({
  PersonaService: {
    loadOne: vi.fn(),
    loadMarkenIds: vi.fn(),
    loadProduktIds: vi.fn(),
    searchByName: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    saveMarken: vi.fn(),
    label: vi.fn((p) => [p?.oberbegriff, p?.name].filter(Boolean).join(' · ') || 'Persona')
  }
}));

vi.mock('../modules/produkt/ProduktPersonaService.js', () => ({
  ProduktPersonaService: {
    saveForPersona: vi.fn(async () => {}),
    loadProdukteForPersona: vi.fn(async () => [])
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
      bindFormEvents: vi.fn(),
      collectSubmitData: vi.fn(() => ({}))
    };
    window.navigateTo = vi.fn();
    window.toastSystem = { error: vi.fn(), success: vi.fn(), warning: vi.fn() };
    window.ErrorHandler = { handle: vi.fn() };
    window.content = document.createElement('div');
    document.body.appendChild(window.content);
  });

  afterEach(() => {
    form.destroy();
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

  it('standalone edit: laedt Persona ohne Owner-Kontext und rendert das Doc', async () => {
    setPath('/persona/p1');
    const { PersonaService } = await import('../modules/persona/PersonaService.js');
    const { ProduktPersonaService } = await import('../modules/produkt/ProduktPersonaService.js');
    PersonaService.loadOne.mockResolvedValue({ id: 'p1', name: 'Sarah', unternehmen_id: 'u1' });
    PersonaService.loadMarkenIds.mockResolvedValue(['m1']);
    ProduktPersonaService.loadProdukteForPersona.mockResolvedValue([
      { produkt_id: 'prod-1', produkt: { id: 'prod-1', name: 'Clear Case', kurzbeschreibung: '' } }
    ]);

    await form.init('p1');

    expect(PersonaService.loadOne).toHaveBeenCalledWith('p1');
    expect(form.personaId).toBe('p1');
    expect(form.markenIds).toEqual(['m1']);
    expect(window.breadcrumbSystem.updateBreadcrumb).toHaveBeenCalledWith(
      expect.any(Array),
      null,
      { switcher: { segment: 'persona', id: 'p1' } }
    );

    // Doc-Layout: Worksheet-Form mit Produkte-Slot und Liky-Spalte
    const doc = window.content.querySelector('form#persona-form.doc');
    expect(doc).not.toBeNull();
    expect(doc.querySelector('#persona-produkt-panel')).not.toBeNull();
    expect(doc.querySelector('.doc__side')).not.toBeNull();

    // Produkte-Band wurde mit den verknuepften Produkten befuellt
    expect(ProduktPersonaService.loadProdukteForPersona).toHaveBeenCalledWith('p1');
    expect(form.produktPanel.getProduktIds()).toEqual(['prod-1']);
  });

  it('standalone new: kein Laden, leerer Kontext', async () => {
    setPath('/persona/new');

    await form.init('new');

    expect(form.personaId).toBeNull();
    expect(form.persona).toBeNull();
    expect(form.ctx.listPath).toBe('/persona');
    expect(window.breadcrumbSystem.updateBreadcrumb).toHaveBeenCalledWith(
      expect.any(Array),
      null,
      { switcher: null }
    );
  });

  it('standalone: Persona nicht gefunden leitet zur Liste', async () => {
    setPath('/persona/p1');
    const { PersonaService } = await import('../modules/persona/PersonaService.js');
    PersonaService.loadOne.mockResolvedValue(null);

    await form.init('p1');

    expect(window.toastSystem.error).toHaveBeenCalledWith('Persona nicht gefunden');
    expect(window.navigateTo).toHaveBeenCalledWith('/persona');
  });

  it('blockiert den Save, wenn das Produkt-Panel einen Ladefehler hat', async () => {
    setPath('/persona/p1');
    const { PersonaService } = await import('../modules/persona/PersonaService.js');
    const { ProduktPersonaService } = await import('../modules/produkt/ProduktPersonaService.js');
    PersonaService.loadOne.mockResolvedValue({ id: 'p1', name: 'Sarah', unternehmen_id: 'u1' });
    PersonaService.loadMarkenIds.mockResolvedValue([]);
    ProduktPersonaService.loadProdukteForPersona.mockRejectedValue(new Error('Netzwerk weg'));
    window.validatorSystem = { validateForm: vi.fn(() => ({ isValid: true, errors: {} })) };

    await form.init('p1');
    expect(form.produktPanel.loadFehler).toBe(true);

    await form.handleSubmit();

    // Nichts schreiben: weder Persona noch der Produkt-Diff gegen []
    expect(PersonaService.update).not.toHaveBeenCalled();
    expect(ProduktPersonaService.saveForPersona).not.toHaveBeenCalled();
    expect(window.toastSystem.error).toHaveBeenCalledWith(expect.stringContaining('nichts gespeichert'));
  });

  it('collectMarkenIds normalisiert das Tag-Feld auf ein Array', () => {
    setPath('/persona/new');
    expect(form.collectMarkenIds({ marke_ids: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(form.collectMarkenIds({ marke_ids: 'a' })).toEqual(['a']);
    expect(form.collectMarkenIds({})).toEqual([]);
  });
});
