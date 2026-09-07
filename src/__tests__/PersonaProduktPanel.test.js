import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PersonaProduktPanel } from '../modules/persona/PersonaProduktPanel.js';

vi.mock('../modules/produkt/ProduktPersonaService.js', () => ({
  ProduktPersonaService: {
    loadProdukteForPersona: vi.fn(async () => [])
  }
}));

vi.mock('../modules/produkt/ProduktService.js', () => ({
  ProduktService: {
    searchByName: vi.fn(async () => [])
  }
}));

function formMitSlot() {
  const form = document.createElement('form');
  form.innerHTML = '<div id="persona-produkt-panel"></div>';
  document.body.appendChild(form);
  return form;
}

describe('PersonaProduktPanel', () => {
  let form;
  let panel;

  beforeEach(() => {
    vi.clearAllMocks();
    form = formMitSlot();
    panel = new PersonaProduktPanel();
    window.toastSystem = { warning: vi.fn() };
    window.navigateTo = vi.fn();
  });

  afterEach(() => {
    panel.destroy();
    form.remove();
  });

  it('rendert den Leerzustand ohne verknuepfte Produkte', async () => {
    await panel.mount(form, { personaId: null, getUnternehmenId: () => 'u1' });

    expect(form.querySelector('.rel-panel__title')?.textContent).toBe('Produkte');
    expect(form.querySelector('.rel-grid--leer')).not.toBeNull();
    expect(panel.getProduktIds()).toEqual([]);
  });

  it('laedt verknuepfte Produkte als Karten', async () => {
    const { ProduktPersonaService } = await import('../modules/produkt/ProduktPersonaService.js');
    ProduktPersonaService.loadProdukteForPersona.mockResolvedValue([
      { produkt_id: 'prod-1', produkt: { id: 'prod-1', name: 'Clear Case', kurzbeschreibung: 'Schutzhülle' } },
      { produkt_id: 'prod-2', produkt: { id: 'prod-2', name: 'Powerbank', kurzbeschreibung: '' } }
    ]);

    await panel.mount(form, { personaId: 'p1', getUnternehmenId: () => 'u1' });

    expect(ProduktPersonaService.loadProdukteForPersona).toHaveBeenCalledWith('p1');
    expect(form.querySelectorAll('.rel-card').length).toBe(2);
    expect(panel.getProduktIds()).toEqual(['prod-1', 'prod-2']);
  });

  it('fuegt per Suche gewaehlte Produkte hinzu und entfernt sie wieder', async () => {
    await panel.mount(form, { personaId: null, getUnternehmenId: () => 'u1' });

    panel.addProdukt({ id: 'prod-1', label: 'Clear Case', data: { kurzbeschreibung: 'x' } });
    panel.addProdukt({ id: 'prod-1', label: 'Clear Case' }); // Duplikat ignoriert
    expect(panel.getProduktIds()).toEqual(['prod-1']);

    panel.entfernProdukt(panel.produkte[0].key);
    expect(panel.getProduktIds()).toEqual([]);
    expect(form.querySelector('.rel-grid--leer')).not.toBeNull();
  });

  it('schliesst bereits verknuepfte Produkte aus der Suche aus', async () => {
    const { ProduktService } = await import('../modules/produkt/ProduktService.js');
    ProduktService.searchByName.mockResolvedValue([]);

    await panel.mount(form, { personaId: null, getUnternehmenId: () => 'u1' });
    panel.addProdukt({ id: 'prod-1', label: 'Clear Case' });

    await panel.sucheProdukte('u1', 'case');

    expect(ProduktService.searchByName).toHaveBeenCalledWith('u1', 'case', { excludeIds: ['prod-1'] });
  });

  it('warnt beim Oeffnen der Suche ohne gewaehltes Unternehmen', async () => {
    await panel.mount(form, { personaId: null, getUnternehmenId: () => null });

    panel.toggleSuche();

    expect(window.toastSystem.warning).toHaveBeenCalledWith('Bitte zuerst ein Unternehmen wählen');
    expect(panel.suche).toBeNull();
  });

  it('markiert loadFehler, damit der Save nicht gegen einen leeren Stand diffed', async () => {
    const { ProduktPersonaService } = await import('../modules/produkt/ProduktPersonaService.js');
    ProduktPersonaService.loadProdukteForPersona.mockRejectedValue(new Error('Netzwerk weg'));

    await panel.mount(form, { personaId: 'p1', getUnternehmenId: () => 'u1' });

    expect(panel.loadFehler).toBe(true);
    expect(panel.getProduktIds()).toEqual([]);
  });

  it('leert die Auswahl, wenn das Unternehmen wechselt', async () => {
    await panel.mount(form, { personaId: null, getUnternehmenId: () => 'u1' });
    panel.addProdukt({ id: 'prod-1', label: 'Clear Case' });

    const select = document.createElement('select');
    select.name = 'unternehmen_id';
    form.appendChild(select);
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(panel.getProduktIds()).toEqual([]);
  });
});
