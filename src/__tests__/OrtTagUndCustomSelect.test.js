import { describe, it, expect, vi } from 'vitest';
import { renderOrtTag } from '../core/format/ortTag.js';
import { renderCustomCells } from '../core/customColumns/EntityCustomColumnRenderer.js';
import { handleCustomSelectChange } from '../core/customColumns/customColumnSelect.js';

const statusSpalte = {
  id: 'col-1',
  name: 'Status',
  field_type: 'dropdown',
  _dropdownOptions: [
    { id: 'o2', label: 'Angefragt', position: 1 },
    { id: 'o1', label: 'Offen', position: 0 }
  ]
};

describe('renderOrtTag', () => {
  it('rendert Stadt und Land im Tag-System wie Branche', () => {
    expect(renderOrtTag('Berlin', 'stadt'))
      .toBe('<div class="tags tags-compact"><span class="tag tag--stadt">Berlin</span></div>');
    expect(renderOrtTag('Deutschland', 'land'))
      .toContain('tag--land');
  });

  it('zeigt Strich bei leerem Wert und escaped Inhalt', () => {
    expect(renderOrtTag('', 'stadt')).toBe('-');
    expect(renderOrtTag('  ', 'land')).toBe('-');
    expect(renderOrtTag(null, 'land')).toBe('-');
    expect(renderOrtTag('<b>x</b>', 'stadt')).not.toContain('<b>');
  });
});

describe('Dropdown-Spalte als internes Dropdown', () => {
  const rendern = (opts) => renderCustomCells([statusSpalte], 'm1', () => 'Offen', [], false, true, opts);

  it('nutzt mit tableSelect das interne Dropdown statt <select>', () => {
    const html = rendern({ tableSelect: true });
    expect(html).toContain('data-table-select');
    expect(html).toContain('data-field="custom-col:col-1"');
    expect(html).not.toContain('<select');
    expect(html.indexOf('Offen')).toBeLessThan(html.lastIndexOf('Angefragt'));
  });

  it('bleibt ohne tableSelect beim nativen <select>', () => {
    expect(rendern({})).toContain('<select');
  });

  it('speichert die Auswahl und ignoriert fremde Felder', async () => {
    const upsertValue = vi.fn().mockResolvedValue();
    const werte = {};
    const manager = {
      columns: [statusSpalte],
      dataLoader: { upsertValue },
      getValue: (e, c) => werte[`${e}:${c}`] ?? '',
      setValue: (e, c, v) => { werte[`${e}:${c}`] = v; }
    };
    expect(await handleCustomSelectChange(manager, { field: 'skript_status', itemId: 'm1', value: 'x' })).toBe(false);
    expect(await handleCustomSelectChange(manager, { field: 'custom-col:col-1', itemId: 'm1', value: 'Angefragt' })).toBe(true);
    expect(upsertValue).toHaveBeenCalledWith('col-1', 'm1', 'Angefragt');
    expect(werte['m1:col-1']).toBe('Angefragt');
  });

  it('setzt den Wert bei Fehler zurück', async () => {
    const manager = {
      columns: [statusSpalte],
      dataLoader: { upsertValue: vi.fn().mockRejectedValue(new Error('x')) },
      getValue: () => 'Offen',
      setValue: vi.fn()
    };
    await expect(handleCustomSelectChange(manager, { field: 'custom-col:col-1', itemId: 'm1', value: 'Angefragt' })).rejects.toThrow();
    expect(manager.setValue).toHaveBeenLastCalledWith('m1', 'col-1', 'Offen');
  });
});
