import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleAction } from '../core/ActionsDropdownHandlers.js';
import { renderVertraegePane } from '../modules/kampagne/KampagneDetailWorkflow.js';

const baseVertrag = {
  id: 'v1',
  name: 'UGC Max',
  typ: 'UGC',
  is_draft: false,
  status: 'erstellt',
  datei_url: 'https://example.com/test.pdf',
  created_at: '2026-01-01',
  creator: { id: 'c1', vorname: 'Max', nachname: 'Muster', mail: 'max@x.de' },
  kampagne: { id: 'k1', kampagnenname: 'Launch', eigener_name: null },
};

function detail(vertraege, overrides = {}) {
  return {
    isKunde: false,
    kampagneId: 'k1',
    _workflowData: { vertraege },
    ...overrides,
  };
}

describe('Kampagne Vertraege-Pane', () => {
  beforeEach(() => {
    window.isInternal = () => true;
    window.isAdmin = () => false;
    window.canBulkDelete = () => true;
    window.currentUser = { permissions: { vertraege: { can_edit: true } } };
    window.ActionsDropdown = { getHeroIcon: (name) => (name === 'anschreiben' ? 'ICON-ANSCHREIBEN' : '') };
    window.validatorSystem = { sanitizeHtml: (s) => s };
  });

  afterEach(() => {
    delete window.isInternal;
    delete window.isAdmin;
    delete window.canBulkDelete;
    delete window.currentUser;
    delete window.ActionsDropdown;
    delete window.validatorSystem;
  });

  it('zeigt die Listen-Spalten inkl. Unterschrieben und Kontext', async () => {
    const html = await renderVertraegePane(detail([baseVertrag]));
    expect(html).toContain('id="vertraege-table-body"');
    expect(html).toContain('col-kampagne');
    expect(html).toContain('col-signed');
    expect(html).toContain('col-actions');
    expect(html).toContain('status-badge status-erstellt');
    expect(html).not.toContain('status-select-wrapper');
    expect(html).toContain('contract-signed-action--upload');
    expect(html).not.toContain('col-checkbox');
  });

  it('zeigt Aktionsmenue und Anschreiben bei finalisiertem PDF', async () => {
    const html = await renderVertraegePane(detail([baseVertrag]));
    expect(html).toContain('col-actions');
    expect(html).toContain('data-action="anschreiben"');
    expect(html).toContain('Vertrag verschicken');
    expect(html).toContain('ICON-ANSCHREIBEN');
    expect(html).toContain('Erstellt');
    expect(html).not.toContain('Finalisiert');
  });

  it('zeigt kein Anschreiben bei Entwurf', async () => {
    const draft = { ...baseVertrag, is_draft: true, datei_url: null, status: 'entwurf' };
    const html = await renderVertraegePane(detail([draft]));
    expect(html).toContain('col-actions');
    expect(html).not.toContain('data-action="anschreiben"');
    expect(html).not.toContain('data-action="generate-pdf"');
    expect(html).toContain('Entwurf');
  });

  it('zeigt PDF erzeugen wenn finalisiert ohne Datei', async () => {
    const ohneDatei = { ...baseVertrag, datei_url: null };
    const html = await renderVertraegePane(detail([ohneDatei]));
    expect(html).toContain('data-action="generate-pdf"');
    expect(html).toContain('PDF erzeugen');
    expect(html).not.toContain('data-action="anschreiben"');
  });

  it('dispatcht vertrag-list-action fuer view, download, delete und generate-pdf', async () => {
    const seen = [];
    const onAction = (e) => seen.push(e.detail);
    window.addEventListener('vertrag-list-action', onAction);
    window.navigateTo = () => {};
    try {
      await handleAction({}, 'view', 'v1', 'vertraege');
      await handleAction({}, 'download', 'v1', 'vertraege');
      await handleAction({}, 'delete', 'v1', 'vertraege');
      await handleAction({}, 'generate-pdf', 'v1', 'vertraege');
    } finally {
      window.removeEventListener('vertrag-list-action', onAction);
      delete window.navigateTo;
    }
    expect(seen).toEqual([
      { action: 'view', vertragId: 'v1' },
      { action: 'download', vertragId: 'v1' },
      { action: 'delete', vertragId: 'v1' },
      { action: 'generate-pdf', vertragId: 'v1' },
    ]);
  });
});
