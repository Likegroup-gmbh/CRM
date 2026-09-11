import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ActionConfig } from '../core/actions/ActionConfig.js';
import { CreatorAuswahlList } from '../modules/creator-auswahl/CreatorAuswahlList.js';
import { renderItemsRows as renderStrategieRows } from '../modules/strategie/StrategieListRenderer.js';
import { renderItemsTable, renderItemRow } from '../modules/strategie/StrategieDetailRenderer.js';
import { renderVertragActions } from '../modules/vertrag/VertraegeListRenderers.js';

// Investor = intern (isKunde false), aber view-only: permissionSystem.can
// liefert fuer alle Verben false. Die Write-UI muss ueberall wegfallen,
// Sichtbarkeit interner Spalten (Preise etc.) bleibt.

describe('ActionConfig – Listen-Configs fuer view-only Rollen', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.permissionSystem = { can: vi.fn() };
  });

  it('creator_auswahl_liste: Investor sieht nur view-liste', () => {
    window.permissionSystem.can.mockReturnValue(false);

    const config = ActionConfig.get('creator_auswahl_liste', 'investor');
    const ids = config.actions.map(a => a.id);

    expect(ids).toContain('view-liste');
    expect(ids).not.toContain('rename-liste');
    expect(ids).not.toContain('edit-liste');
    expect(ids).not.toContain('delete-liste');
  });

  it('strategie_liste: Investor sieht nur view-strategie', () => {
    window.permissionSystem.can.mockReturnValue(false);

    const config = ActionConfig.get('strategie_liste', 'investor');
    const ids = config.actions.map(a => a.id);

    expect(ids).toEqual(['view-strategie']);
  });

  it('creator_auswahl_liste fragt die sourcing-Matrix (Alias-Regression fuer Mitarbeiter)', () => {
    // Der stille Bug: frueher wurde mit dem UI-Key 'creator_auswahl' gefragt,
    // der in der Matrix nicht existiert -> Mitarbeiter sahen nur "Details anzeigen".
    window.permissionSystem.can.mockImplementation((entity) => entity === 'sourcing');

    const config = ActionConfig.get('creator_auswahl_liste', 'mitarbeiter');
    const ids = config.actions.map(a => a.id);

    expect(window.permissionSystem.can).toHaveBeenCalledWith('sourcing', 'edit');
    expect(ids).toContain('view-liste');
    expect(ids).toContain('rename-liste');
    expect(ids).toContain('edit-liste');
    expect(ids).toContain('delete-liste');
  });

  it('strategie_liste: Mitarbeiter mit strategie-Rechten sieht alle Actions', () => {
    window.permissionSystem.can.mockImplementation((entity) => entity === 'strategie');

    const config = ActionConfig.get('strategie_liste', 'mitarbeiter');
    const ids = config.actions.map(a => a.id);

    expect(ids).toContain('view-strategie');
    expect(ids).toContain('edit-strategie');
    expect(ids).toContain('delete-strategie');
  });
});

describe('Folder-Listen – Investor-HTML ohne Write-Actions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.currentUser = { id: 'u1', rolle: 'investor', name: 'Investor' };
    window.permissionSystem = { can: vi.fn().mockReturnValue(false) };
  });

  afterEach(() => {
    delete window.currentUser;
  });

  it('CreatorAuswahlList: Zeile enthaelt nur view-liste', () => {
    const list = Object.create(CreatorAuswahlList.prototype);
    list.sanitize = (s) => s;

    const html = list.renderItemsRows([{ id: 'l1', name: 'Liste A', created_at: '2026-01-01' }]);

    expect(html).toContain('data-action="view-liste"');
    expect(html).not.toContain('data-action="rename-liste"');
    expect(html).not.toContain('data-action="edit-liste"');
    expect(html).not.toContain('data-action="delete-liste"');
  });

  it('CreatorAuswahlList: Mitarbeiter mit sourcing-Rechten bekommt rename-liste inkl. data-name', () => {
    window.currentUser = { id: 'u2', rolle: 'mitarbeiter', name: 'MA' };
    window.permissionSystem.can.mockImplementation((entity) => entity === 'sourcing');

    const list = Object.create(CreatorAuswahlList.prototype);
    list.sanitize = (s) => s;

    const html = list.renderItemsRows([{ id: 'l1', name: 'Liste A', created_at: '2026-01-01' }]);

    expect(html).toContain('data-action="rename-liste"');
    expect(html).toContain('data-name="Liste A"');
    expect(html).toContain('data-action="edit-liste"');
    expect(html).toContain('data-action="delete-liste"');
  });

  it('StrategieListRenderer: Zeile enthaelt nur view-strategie', () => {
    const html = renderStrategieRows({ sanitize: (s) => s }, [{ id: 's1', name: 'Konzept A' }]);

    expect(html).toContain('data-action="view-strategie"');
    expect(html).not.toContain('data-action="edit-strategie"');
    expect(html).not.toContain('data-action="delete-strategie"');
  });
});

describe('StrategieDetailRenderer – Investor read-only', () => {
  const detail = (overrides = {}) => ({
    items: [{ id: 'v1', video_link: 'https://tiktok.com/x', plattform: 'tiktok', beschreibung: 'B' }],
    isKunde: false,
    canEdit: false,
    canCreate: false,
    hiddenColumns: [],
    customColumns: null,
    getTeilbereicheFromStrategie: () => [],
    ...overrides
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    window.isGastReadonly = vi.fn().mockReturnValue(false);
  });

  it('Tabelle ohne Drag- und Aktions-Spalte', () => {
    const html = renderItemsTable(detail());

    expect(html).not.toContain('col-drag');
    expect(html).not.toContain('col-actions');
    expect(html).not.toContain('actions-toggle');
  });

  it('Zeile ohne Aktionsmenue, Textareas readonly', () => {
    const html = renderItemRow(detail(), detail().items[0], 0);

    expect(html).not.toContain('actions-dropdown-container');
    expect(html).not.toContain('item-row draggable');

    const doc = new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
    doc.querySelectorAll('textarea').forEach(ta => {
      expect(ta.hasAttribute('readonly')).toBe(true);
    });
  });

  it('Mitarbeiter (canEdit true) bekommt Drag-, Aktions-Spalte und editierbare Felder', () => {
    const d = detail({ canEdit: true, canCreate: true });
    const html = renderItemsTable(d);

    expect(html).toContain('col-drag');
    expect(html).toContain('col-actions');

    const rowHtml = renderItemRow(d, d.items[0], 0);
    expect(rowHtml).toContain('actions-dropdown-container');
  });
});

describe('VertraegeListRenderers – Signed-Actions nur mit canEdit', () => {
  const vertragOhneSigned = { id: 'vt1', is_draft: false, datei_url: 'https://x/pdf' };
  const vertragMitSigned = { id: 'vt2', is_draft: false, datei_url: 'https://x/pdf', dropbox_file_url: 'https://dbx/signed.pdf' };

  it('Investor (canEdit false) sieht keine add-signed/remove-signed Actions', () => {
    const htmlOhne = renderVertragActions(vertragOhneSigned, false, false, false);
    expect(htmlOhne).not.toContain('data-action="add-signed"');
    expect(htmlOhne).toContain('data-action="view"');

    const htmlMit = renderVertragActions(vertragMitSigned, false, false, false);
    expect(htmlMit).not.toContain('data-action="replace-signed"');
    expect(htmlMit).not.toContain('data-action="remove-signed"');
  });

  it('Mitarbeiter (canEdit true) sieht die Signed-Actions', () => {
    const htmlOhne = renderVertragActions(vertragOhneSigned, false, true, false);
    expect(htmlOhne).toContain('data-action="add-signed"');

    const htmlMit = renderVertragActions(vertragMitSigned, false, true, false);
    expect(htmlMit).toContain('data-action="replace-signed"');
    expect(htmlMit).toContain('data-action="remove-signed"');
  });
});
