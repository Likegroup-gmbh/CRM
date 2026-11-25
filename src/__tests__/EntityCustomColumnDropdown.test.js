import { describe, it, expect, afterEach } from 'vitest';
import { renderCustomCells } from '../core/customColumns/EntityCustomColumnRenderer.js';
import { TableSelect } from '../core/components/TableSelect.js';

const col = {
  id: 'col-1',
  name: 'Status',
  field_type: 'dropdown',
  visible_for_kunden: true,
  _dropdownOptions: [
    { id: 'o1', label: 'Offen', position: 1 },
    { id: 'o2', label: 'Zusage', position: 0 }
  ]
};

describe('Eigenes Dropdown in der Tabelle', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('nutzt das Tabellen-Dropdown statt des System-Selects', () => {
    const html = renderCustomCells([col], 'mem-1', () => 'Offen', [], false, true);
    expect(html).toContain('class="table-select"');
    expect(html).toContain('data-custom-column-id="col-1"');
    expect(html).toContain('data-entity-id="mem-1"');
    expect(html).toContain('Zusage');
    expect(html).not.toContain('<select');
    const values = [...html.matchAll(/role="option"[\s\S]*?data-value="([^"]*)"/g)].map(match => match[1]);
    expect(values).toEqual(['', 'Zusage', 'Offen']);
  });

  it('zeigt ohne Schreibrecht nur den gewählten Wert', () => {
    const html = renderCustomCells([col], 'mem-1', () => 'Offen', [], false, false);
    expect(html).toContain('table-select__trigger--disabled');
    expect(html).toContain('Offen');
    expect(html).not.toContain('<select');
    expect(html).not.toContain('custom-col-select');
  });

  it('meldet die Wahl als change am versteckten Feld', () => {
    const select = new TableSelect();
    select.init();
    document.body.innerHTML = renderCustomCells([col], 'mem-1', () => '', [], false, true);
    const seen = [];
    document.querySelector('input.custom-col-select').addEventListener('change', (event) => {
      seen.push(event.target.value);
    });

    document.querySelector('.table-select__trigger').click();
    document.querySelector('.table-select__portal [data-value="Zusage"]').click();

    expect(seen).toEqual(['Zusage']);
    expect(document.querySelector('.table-select__label').textContent.trim()).toBe('Zusage');
    select.destroy();
  });
});
