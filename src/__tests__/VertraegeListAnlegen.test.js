import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  renderFoldersView,
  renderVertraegeView,
  renderVertraegeTableBody
} from '../modules/vertrag/VertraegeListRenderers.js';
import { VertraegeCreate } from '../modules/vertrag/create/VertraegeCreateCore.js';
import { renderWorkflowCreateChrome } from '../modules/kampagne/KampagneWorkflowCreate.js';

const vertrag = {
  id: 'v1',
  typ: 'UGC',
  is_draft: false,
  datei_url: 'https://example.com/test.pdf',
  creator: { id: 'c1', vorname: 'Max', nachname: 'Muster' }
};

describe('Verträge anlegen', () => {
  beforeEach(() => {
    window.ActionsDropdown = { getHeroIcon: () => '' };
    window.validatorSystem = { sanitizeHtml: (s) => s };
    window.navigateTo = vi.fn();
    window.setHeadline = vi.fn();
    window.breadcrumbSystem = { updateDetailLabel: vi.fn() };
    window.toastSystem = { show: vi.fn() };
    window.canCreate = () => true;
  });

  afterEach(() => {
    delete window.ActionsDropdown;
    delete window.validatorSystem;
    delete window.navigateTo;
    delete window.setHeadline;
    delete window.breadcrumbSystem;
    delete window.toastSystem;
    delete window.canCreate;
    window.history.replaceState({}, '', '/');
  });

  it('zeigt auf der Vertragsliste keinen Button zum Anlegen', () => {
    expect(renderFoldersView('grid')).not.toContain('Neuen Vertrag anlegen');
    expect(renderFoldersView('list')).not.toContain('btn-vertrag-new');
    const firma = renderVertraegeView({ isAdmin: true, canBulkDelete: true, canEdit: true });
    expect(firma).not.toContain('Neuen Vertrag anlegen');
    expect(firma).not.toContain('/vertraege/new');
  });

  it('bietet auf der Liste keine Vorlage als neuen Vertrag', () => {
    const html = renderVertraegeTableBody([vertrag], { canBulkDelete: false, canEdit: true, isAdmin: false });
    expect(html).not.toContain('vertrag-als-vorlage');
    expect(html).toContain('data-action="edit"');
  });

  it('bietet die Vorlage im Produktionstab an', () => {
    const html = renderVertraegeTableBody([vertrag], {
      canBulkDelete: false,
      canEdit: true,
      isAdmin: false,
      canCreate: true
    });
    expect(html).toContain('Als Vorlage verwenden');
  });

  it('legt in der Produktion weiter über Vertrag anlegen an', () => {
    const html = renderWorkflowCreateChrome('vertraege', {
      kampagneId: 'k1',
      produktionId: 'p1',
      kampagneData: { unternehmen_id: 'u1' }
    });
    expect(html).toContain('Vertrag anlegen');
    expect(html).toContain('data-create-action="vertraege"');
  });

  it('öffnet das Formular nicht ohne Produktion, Vorlage oder Contracting', async () => {
    window.history.replaceState({}, '', '/vertraege/new?unternehmen=u1');
    const create = new VertraegeCreate();
    create.getVertragPermissions = () => ({ canEdit: true });
    create.loadStammdaten = vi.fn();
    create.render = vi.fn();

    await create.init();

    expect(create.darfVertragAnlegen()).toBe(false);
    expect(window.navigateTo).toHaveBeenCalledWith('/vertraege');
    expect(create.loadStammdaten).not.toHaveBeenCalled();
  });

  it('öffnet das Formular aus einer Produktion, als Vorlage und für Contracting', () => {
    const create = new VertraegeCreate();
    window.history.replaceState({}, '', '/vertraege/new?produktion=p1');
    expect(create.darfVertragAnlegen()).toBe(true);
    window.history.replaceState({}, '', '/vertraege/new?vorlage=v1');
    expect(create.darfVertragAnlegen()).toBe(true);
    window.history.replaceState({}, '', '/vertraege/new?typ=Contracting&auftrag=a1');
    expect(create.darfVertragAnlegen()).toBe(true);
  });

  it('lässt einen bestehenden Vertrag weiter bearbeiten', async () => {
    window.history.replaceState({}, '', '/vertraege/v1/edit');
    const create = new VertraegeCreate();
    create.getVertragPermissions = () => ({ canEdit: true });
    create.loadStammdaten = vi.fn();
    create.loadDraftFromDB = vi.fn();
    create.render = vi.fn();

    await create.init('v1');

    expect(window.navigateTo).not.toHaveBeenCalled();
    expect(create.loadDraftFromDB).toHaveBeenCalledWith('v1');
  });
});
