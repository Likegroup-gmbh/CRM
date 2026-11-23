import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityCustomColumnsDrawer } from '../core/customColumns/EntityCustomColumnsDrawer.js';
import { CustomColumnsDrawer } from '../modules/kampagne/columns/CustomColumnsDrawer.js';

function zieh(griff, quelle, ziel) {
  griff.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  const dataTransfer = {
    effectAllowed: '',
    dropEffect: '',
    setData() {},
    setDragImage() {}
  };
  const feuer = (type, target) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    event.dataTransfer = dataTransfer;
    target.dispatchEvent(event);
  };
  feuer('dragstart', quelle);
  feuer('dragover', ziel);
  feuer('dragend', quelle);
}

async function warten() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('Dropdown-Optionen', () => {
  it('zeigt den Spalten-Griff und speichert die gezogene Reihenfolge', async () => {
    const updateDropdownOption = vi.fn(async () => {});
    const onChange = vi.fn();
    const columns = [{
      id: 'c1',
      name: 'Status',
      field_type: 'dropdown',
      visible_for_kunden: false,
      _dropdownOptions: [
        { id: 'o1', label: 'Contacted', position: 0 },
        { id: 'o2', label: 'Interested', position: 1 }
      ]
    }];
    const drawer = new EntityCustomColumnsDrawer({
      dataLoader: { updateDropdownOption },
      columns,
      order: [],
      onChange
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    drawer.mountIn(host, { columnId: 'custom:c1', onBack: vi.fn() });

    expect(host.querySelector('.dropdown-opt-move-up')).toBeNull();
    expect(host.querySelector('.dropdown-opt-move-down')).toBeNull();
    expect(host.innerHTML).toContain('crm-icon-bars-3');
    expect(host.querySelectorAll('[data-action="drag-option"]').length).toBe(2);

    const list = host.querySelector('.dd-opts-list');
    const erste = list.querySelector('[data-option-id="o1"]');
    const zweite = list.querySelector('[data-option-id="o2"]');
    zieh(zweite.querySelector('[data-action="drag-option"]'), zweite, erste);
    await warten();

    const ids = [...list.querySelectorAll('.dd-opt-row')].map(row => row.dataset.optionId);
    expect(ids).toEqual(['o2', 'o1']);
    expect(columns[0]._dropdownOptions.find(opt => opt.id === 'o2').position).toBe(0);
    expect(columns[0]._dropdownOptions.find(opt => opt.id === 'o1').position).toBe(1);
    expect(updateDropdownOption).toHaveBeenCalledWith('o2', { position: 0 });
    expect(updateDropdownOption).toHaveBeenCalledWith('o1', { position: 1 });
    expect(onChange).toHaveBeenCalled();
  });

  it('ordnet noch nicht gespeicherte Optionen per Griff', async () => {
    const drawer = new EntityCustomColumnsDrawer({
      dataLoader: {},
      columns: [],
      order: []
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    drawer.mountIn(host, { columnId: null, onBack: vi.fn() });

    const select = host.querySelector('#entity-cc-new-type');
    select.value = 'dropdown';
    select.dispatchEvent(new Event('change'));
    const input = host.querySelector('#entity-cc-new-opt-input');
    input.value = 'Contacted';
    host.querySelector('#btn-entity-cc-new-opt-add').click();
    input.value = 'Interested';
    host.querySelector('#btn-entity-cc-new-opt-add').click();

    const list = host.querySelector('.cc-new-dd-list');
    expect(list.querySelector('[data-action="drag-option"] use, [data-action="drag-option"]')).not.toBeNull();
    expect(list.innerHTML).toContain('crm-icon-bars-3');
    const rows = [...list.querySelectorAll('.dd-opt-row')];
    zieh(rows[1].querySelector('[data-action="drag-option"]'), rows[1], rows[0]);
    await warten();

    expect(drawer._newColumnDropdownOptions).toEqual(['Interested', 'Contacted']);
  });

  it('zeigt im Kampagnen-Formular Ebene, Kunden-Schalter und den Griff', () => {
    const store = {
      customColumns: [{
        id: 'c1',
        name: 'Status',
        field_type: 'dropdown',
        entity_type: 'kooperation',
        visible_for_kunden: true,
        editable_by_kunden: false,
        _dropdownOptions: [{ id: 'o1', label: 'Contacted', position: 0 }]
      }]
    };
    const onBack = vi.fn();
    const drawer = new CustomColumnsDrawer('kampagne-a', store, vi.fn());
    const host = document.createElement('div');
    document.body.appendChild(host);
    drawer.mountIn(host, { columnId: 'custom:c1', onBack });

    expect(host.querySelector('#cc-new-entity').disabled).toBe(true);
    expect(host.textContent).toContain('Kunde darf ausfüllen');
    expect(host.querySelector('#cc-embedded-options').innerHTML).toContain('crm-icon-bars-3');
    expect(host.querySelector('.dropdown-opt-move-up')).toBeNull();

    host.querySelector('[data-action="spalten-pflege-zurueck"]').click();
    expect(onBack).toHaveBeenCalled();
  });
});
