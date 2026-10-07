import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CreatorAuswahlDetail } from '../modules/creator-auswahl/CreatorAuswahlDetail.js';
import { creatorAuswahlService } from '../modules/creator-auswahl/CreatorAuswahlService.js';

// Casting-Detail nutzt SelectionBar und bindCheckboxSelection (core/list/SelectionBar.js)
describe('Casting-Detail Auswahl und Leiste', () => {
  let detail;
  let root;

  const render = () => {
    root.innerHTML = `
      <table>
        <thead><tr><th><input type="checkbox" class="sourcing-select-all"></th></tr></thead>
        <tbody>
          <tr class="kategorie-header-row"><td><input type="checkbox" class="sourcing-group-select"></td></tr>
          <tr class="item-row" data-item-id="i1"><td><input type="checkbox" class="sourcing-item-check" data-item-id="i1"></td></tr>
          <tr class="item-row" data-item-id="i2"><td><input type="checkbox" class="sourcing-item-check" data-item-id="i2"></td></tr>
        </tbody>
      </table>`;
  };

  beforeEach(() => {
    document.body.innerHTML = '';
    root = document.createElement('div');
    document.body.appendChild(root);
    detail = new CreatorAuswahlDetail();
    detail.root = root;
    detail.liste = { teilbereich: 'Food, Sport' };
    detail.items = [{ id: 'i1' }, { id: 'i2' }];
    detail.rerenderTable = vi.fn();
    render();
    detail.renderBulkBar();
    detail.bindSelectionEvents();
  });

  afterEach(() => {
    detail._selectionAbort?.abort();
    detail.selectionBar?.destroy();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    delete window.toastSystem;
    delete window.confirmationModal;
    delete window.permissionSystem;
  });

  const check = (id, checked = true) => {
    const cb = root.querySelector(`.sourcing-item-check[data-item-id="${id}"]`);
    cb.checked = checked;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const bar = () => document.getElementById('sourcing-bulk-bar');

  it('zeigt die Leiste mit Zähler ab der ersten Auswahl', () => {
    expect(bar().style.display).toBe('none');
    check('i1');
    expect(bar().style.display).toBe('flex');
    expect(bar().querySelector('.bulk-count').textContent).toBe('1 Creator ausgewählt');
    check('i1', false);
    expect(bar().style.display).toBe('none');
  });

  it('führt Gruppen- und Select-All-Zustand mit', () => {
    check('i1');
    const group = root.querySelector('.sourcing-group-select');
    const all = root.querySelector('.sourcing-select-all');
    expect(group.indeterminate).toBe(true);
    expect(all.indeterminate).toBe(true);

    check('i2');
    expect(group.checked).toBe(true);
    expect(all.checked).toBe(true);

    all.checked = false;
    all.dispatchEvent(new Event('change', { bubbles: true }));
    expect(detail.selectedItems.size).toBe(0);
    expect(group.checked).toBe(false);
  });

  it('behält die Auswahl nach dem Neurendern und verwirft verschwundene Zeilen', () => {
    check('i1');
    detail.selectedItems.add('weg');
    render();
    detail.bindSelectionEvents();
    expect(root.querySelector('.sourcing-item-check[data-item-id="i1"]').checked).toBe(true);
    expect([...detail.selectedItems]).toEqual(['i1']);
    check('i2');
    expect(detail.selectedItems.size).toBe(2);
  });

  it('Auswahl aufheben leert Zeilen, Gruppen und Leiste', () => {
    check('i1');
    check('i2');
    bar().querySelector('[data-selection-deselect]').click();
    expect(detail.selectedItems.size).toBe(0);
    expect(root.querySelectorAll('.sourcing-item-check:checked')).toHaveLength(0);
    expect(root.querySelector('.sourcing-select-all').checked).toBe(false);
    expect(bar().style.display).toBe('none');
  });

  it('Zuweisen schreibt die Kategorie genau einmal, auch nach mehrfachem Rebind', async () => {
    window.toastSystem = { show: vi.fn() };
    const update = vi.spyOn(creatorAuswahlService, 'updateItemsGroup').mockResolvedValue();
    detail.bindSelectionEvents();
    detail.bindSelectionEvents();

    check('i1');
    check('i2');
    document.getElementById('sourcing-bulk-kategorie').value = 'Food';
    bar().querySelector('[data-selection-action="assign"]').click();

    await vi.waitFor(() => expect(detail.rerenderTable).toHaveBeenCalled());
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(['i1', 'i2'], { kategorie: 'Food', nicht_umsetzen: false });
    expect(detail.selectedItems.size).toBe(0);
    expect(bar().style.display).toBe('none');
  });

  it('Zuweisen ohne Kategorie warnt und schreibt nichts', () => {
    window.toastSystem = { show: vi.fn() };
    const update = vi.spyOn(creatorAuswahlService, 'updateItemsGroup').mockResolvedValue();
    check('i1');
    bar().querySelector('[data-selection-action="assign"]').click();
    expect(update).not.toHaveBeenCalled();
    expect(window.toastSystem.show).toHaveBeenCalledWith('Bitte eine Kategorie auswählen', 'warning');
  });

  describe('Bulk-Löschen', () => {
    const deleteBtn = () => bar().querySelector('[data-selection-action="delete"]');

    const mountMitDeleteRecht = () => {
      window.permissionSystem = { can: () => true };
      detail.renderBulkBar();
    };

    it('zeigt Löschen nur mit delete-Recht', () => {
      expect(deleteBtn()).toBeNull();
      mountMitDeleteRecht();
      expect(deleteBtn()).not.toBeNull();
    });

    it('löscht nach Bestätigung alle markierten Einträge', async () => {
      window.toastSystem = { show: vi.fn() };
      window.confirmationModal = { open: vi.fn().mockResolvedValue({ confirmed: true }) };
      const del = vi.spyOn(creatorAuswahlService, 'deleteItem').mockResolvedValue();
      mountMitDeleteRecht();

      check('i1');
      check('i2');
      deleteBtn().click();

      await vi.waitFor(() => expect(detail.rerenderTable).toHaveBeenCalled());
      expect(del.mock.calls.map(c => c[0])).toEqual(['i1', 'i2']);
      expect(detail.items).toEqual([]);
      expect(detail.selectedItems.size).toBe(0);
      expect(bar().style.display).toBe('none');
      expect(window.toastSystem.show).toHaveBeenCalledWith('2 Creator entfernt', 'success');
    });

    it('Abbrechen löscht nichts', async () => {
      window.confirmationModal = { open: vi.fn().mockResolvedValue({ confirmed: false }) };
      const del = vi.spyOn(creatorAuswahlService, 'deleteItem').mockResolvedValue();
      mountMitDeleteRecht();

      check('i1');
      deleteBtn().click();

      await vi.waitFor(() => expect(window.confirmationModal.open).toHaveBeenCalled());
      await Promise.resolve();
      expect(del).not.toHaveBeenCalled();
      expect(detail.items).toHaveLength(2);
      expect(detail.selectedItems.size).toBe(1);
    });

    it('blockierter Eintrag bleibt markiert, der Rest ist weg', async () => {
      window.toastSystem = { show: vi.fn() };
      window.confirmationModal = { open: vi.fn().mockResolvedValue({ confirmed: true }) };
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(creatorAuswahlService, 'deleteItem').mockImplementation(async (id) => {
        if (id === 'i2') throw new Error('Skript vorhanden');
      });
      mountMitDeleteRecht();

      check('i1');
      check('i2');
      deleteBtn().click();

      await vi.waitFor(() => expect(detail.rerenderTable).toHaveBeenCalled());
      expect(detail.items.map(i => i.id)).toEqual(['i2']);
      expect([...detail.selectedItems]).toEqual(['i2']);
      expect(window.toastSystem.show).toHaveBeenCalledWith(
        '1 Creator entfernt, 1 nicht: Skript vorhanden',
        'warning'
      );
    });
  });
});
