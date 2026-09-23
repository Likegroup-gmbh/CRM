import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PersonaForm } from '../modules/persona/PersonaForm.js';
import { resolveOwnerContext } from '../core/OwnerContext.js';

vi.mock('../modules/persona/PersonaService.js', () => ({
  PersonaService: {
    loadOne: vi.fn(),
    loadMarkenIds: vi.fn(),
    loadProduktIds: vi.fn(),
    loadAudienceSituations: vi.fn(async () => []),
    syncAudienceSituations: vi.fn(async () => new Map()),
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
    loadProdukteForPersona: vi.fn(async () => []),
    starteAudienceSituationJobs: vi.fn(async () => 0)
  }
}));

vi.mock('../modules/briefing/BriefingPersonas.js', () => ({
  loadBriefingIdsForPersona: vi.fn(async () => []),
  setPersonaBriefings: vi.fn(async () => {})
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
    expect(doc.querySelector('#persona-audience-situations-panel')).not.toBeNull();
    expect(doc.querySelector('.doc__side')).not.toBeNull();
    expect(doc.querySelector('#persona-liky-input')?.disabled).toBeFalsy();
    expect(doc.querySelector('#persona-liky-send')?.disabled).toBeFalsy();
    expect(doc.querySelector('[data-doc-field="unternehmen_id"]')).not.toBeNull();
    expect(doc.querySelector('[data-doc-field="marke_ids"]')).not.toBeNull();
    expect(doc.querySelector('[data-doc-field="briefing_ids"]')).not.toBeNull();

    // Produkte-Band wurde mit den verknuepften Produkten befuellt
    expect(ProduktPersonaService.loadProdukteForPersona).toHaveBeenCalledWith('p1');
    expect(form.produktPanel.getProduktIds()).toEqual(['prod-1']);

    const { loadBriefingIdsForPersona } = await import('../modules/briefing/BriefingPersonas.js');
    expect(loadBriefingIdsForPersona).toHaveBeenCalledWith('p1', { nurFinalisiert: true });
  });

  it('standalone new ohne Zuordnung geht zur Liste zurück', async () => {
    setPath('/persona/new');

    await form.init('new');

    expect(window.navigateTo).toHaveBeenCalledWith('/persona');
    expect(window.content.querySelector('#persona-form')).toBeNull();
  });

  it('standalone new versteckt die Zuordnung und setzt das Produkt', async () => {
    setPath('/persona/new?unternehmen=u1&marke=m1&briefing=b1&produkt=p1');

    await form.init('new');

    const doc = window.content.querySelector('form#persona-form');
    expect(doc).not.toBeNull();
    expect(doc.querySelector('[data-doc-field="unternehmen_id"]')).toBeNull();
    expect(doc.querySelector('[data-doc-field="marke_ids"]')).toBeNull();
    expect(doc.querySelector('[data-doc-field="briefing_ids"]')).toBeNull();
    expect(doc.querySelector('input[type="hidden"][name="unternehmen_id"]').value).toBe('u1');
    expect(form.collectMarkenIds({})).toEqual(['m1']);
    expect(form.collectBriefingIds({})).toEqual(['b1']);
    expect(doc.querySelector('[data-rel-action="add-produkt"]')).toBeNull();
    expect(doc.querySelector('[data-rel-action="entfernen"]')).toBeNull();
    expect(doc.querySelector('[data-rel-action="open"]')).not.toBeNull();
    expect(form.produktPanel.getProduktIds()).toEqual(['p1']);
  });

  it('standalone new ohne Produkt lässt das Band offen', async () => {
    setPath('/persona/new?unternehmen=u1&marke=m1&briefing=b1');

    await form.init('new');

    const doc = window.content.querySelector('form#persona-form');
    expect(doc).not.toBeNull();
    expect(doc.querySelector('[data-rel-action="add-produkt"]')).not.toBeNull();
    expect(form.produktPanel.getProduktIds()).toEqual([]);
    expect(form.createScope.produktId).toBeNull();
  });

  it('nested create ohne Briefing und Produkt geht zum Personas-Tab', async () => {
    setPath('/unternehmen/u1/persona');
    resolveOwnerContext.mockResolvedValue({
      markeId: null,
      unternehmenId: 'u1',
      owner: { id: 'u1' },
      basePath: '/unternehmen/u1',
      listPath: '/unternehmen',
      listLabel: 'Unternehmen',
      ownerLabel: 'Acme',
      markenAnzahl: 2
    });

    await form.init('u1');

    expect(window.navigateTo).toHaveBeenCalledWith('/unternehmen/u1?tab=personas');
    expect(window.content.querySelector('#persona-form')).toBeNull();
  });

  it('standalone: Persona nicht gefunden leitet zur Liste', async () => {
    setPath('/persona/p1');
    const { PersonaService } = await import('../modules/persona/PersonaService.js');
    PersonaService.loadOne.mockResolvedValue(null);

    await form.init('p1');

    expect(window.toastSystem.error).toHaveBeenCalledWith('Persona nicht gefunden');
    expect(window.navigateTo).toHaveBeenCalledWith('/persona');
  });

  it('speichern ohne Produkt startet Audience Situations', async () => {
    setPath('/persona/new?unternehmen=u1&marke=m1&briefing=b1');
    const { PersonaService } = await import('../modules/persona/PersonaService.js');
    const { ProduktPersonaService } = await import('../modules/produkt/ProduktPersonaService.js');
    PersonaService.create.mockResolvedValue({ id: 'p-neu' });
    ProduktPersonaService.starteAudienceSituationJobs.mockResolvedValueOnce(1);
    window.validatorSystem = { validateForm: vi.fn(() => ({ isValid: true, errors: {} })) };
    window.formSystem.collectSubmitData.mockReturnValue({ name: 'Sarah', unternehmen_id: 'u1' });

    await form.init('new');
    await form.handleSubmit();

    expect(ProduktPersonaService.saveForPersona).toHaveBeenCalledWith('p-neu', []);
    expect(ProduktPersonaService.starteAudienceSituationJobs).toHaveBeenCalledWith(['p-neu'], {
      produktId: null,
      produkt: {}
    });
  });

  it('speichern mit Produkt startet keine Audience Situations', async () => {
    setPath('/persona/new?unternehmen=u1&marke=m1&briefing=b1&produkt=p1');
    const { PersonaService } = await import('../modules/persona/PersonaService.js');
    const { ProduktPersonaService } = await import('../modules/produkt/ProduktPersonaService.js');
    PersonaService.create.mockResolvedValue({ id: 'p-neu' });
    window.validatorSystem = { validateForm: vi.fn(() => ({ isValid: true, errors: {} })) };
    window.formSystem.collectSubmitData.mockReturnValue({ name: 'Sarah', unternehmen_id: 'u1' });

    await form.init('new');
    await form.handleSubmit();

    expect(ProduktPersonaService.saveForPersona).toHaveBeenCalledWith('p-neu', ['p1']);
    expect(ProduktPersonaService.starteAudienceSituationJobs).not.toHaveBeenCalled();
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

  it('collectBriefingIds normalisiert das Tag-Feld auf ein Array', () => {
    setPath('/persona/new');
    expect(form.collectBriefingIds({ briefing_ids: ['b1', 'b2'] })).toEqual(['b1', 'b2']);
    expect(form.collectBriefingIds({ briefing_ids: 'b1' })).toEqual(['b1']);
    expect(form.collectBriefingIds({})).toEqual([]);
  });
});
