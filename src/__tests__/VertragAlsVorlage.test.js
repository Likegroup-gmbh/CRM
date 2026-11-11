import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderVertragActions } from '../modules/vertrag/VertraegeListRenderers.js';
import { handleVertragListAction } from '../modules/vertrag/VertraegeListHandlers.js';
import { handleAction } from '../core/ActionsDropdownHandlers.js';
import { VertraegeCreate } from '../modules/vertrag/create/VertraegeCreateCore.js';

const finalVertrag = {
  id: 'v1',
  typ: 'UGC',
  is_draft: false,
  datei_url: 'https://example.com/test.pdf',
};

describe('Vertrag als Vorlage verwenden', () => {
  beforeEach(() => {
    window.ActionsDropdown = { getHeroIcon: () => '' };
    window.navigateTo = vi.fn();
    window.toastSystem = { show: vi.fn() };
  });

  afterEach(() => {
    delete window.ActionsDropdown;
    delete window.navigateTo;
    delete window.toastSystem;
    window.history.replaceState({}, '', '/');
  });

  it('zeigt die Aktion bei finalisierten Verträgen mit canEdit', () => {
    const html = renderVertragActions(finalVertrag, false, true, false);
    expect(html).toContain('data-action="vertrag-als-vorlage"');
    expect(html).toContain('Als Vorlage verwenden');
  });

  it('zeigt die Aktion nicht ohne canEdit', () => {
    const html = renderVertragActions(finalVertrag, false, false, false);
    expect(html).not.toContain('data-action="vertrag-als-vorlage"');
  });

  it('navigiert zur Neuanlage mit Vorlage-ID', async () => {
    const list = { getVertragPermissions: () => ({ canEdit: true }) };
    await handleVertragListAction(list, 'vertrag-als-vorlage', 'v1');
    expect(window.navigateTo).toHaveBeenCalledWith('/vertraege/new?vorlage=v1');
  });

  it('navigiert nicht ohne Bearbeitungsrecht', async () => {
    const list = { getVertragPermissions: () => ({ canEdit: false }) };
    await handleVertragListAction(list, 'vertrag-als-vorlage', 'v1');
    expect(window.navigateTo).not.toHaveBeenCalled();
  });

  it('leitet die Aktion aus dem Portal-Dropdown an die Liste weiter', async () => {
    const seen = [];
    const onAction = (e) => seen.push(e.detail);
    window.addEventListener('vertrag-list-action', onAction);
    try {
      await handleAction({}, 'vertrag-als-vorlage', 'v1', 'vertraege');
    } finally {
      window.removeEventListener('vertrag-list-action', onAction);
    }
    expect(seen).toEqual([{ action: 'vertrag-als-vorlage', vertragId: 'v1' }]);
  });

  it('lädt die Vorlage ins Formular, ohne sie als Edit-ID zu übernehmen', async () => {
    window.history.replaceState({}, '', '/vertraege/new?vorlage=v1');
    const create = new VertraegeCreate();
    create.loadDraftFromDB = vi.fn(async function () {
      this.formData = { typ: 'UGC', kampagne_id: 'k1' };
    });

    await create.applyQueryPrefill();

    expect(create.loadDraftFromDB).toHaveBeenCalledWith('v1');
    expect(create.editId).toBeNull();
    expect(create.formData.kampagne_id).toBe('k1');
  });
});
