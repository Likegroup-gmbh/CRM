import { describe, it, expect, beforeEach } from 'vitest';
import { renderCustomCell, renderCustomHeader } from '../modules/kampagne/columns/CustomColumnRenderer.js';
import { renderCustomCells, renderCustomHeaders } from '../core/customColumns/EntityCustomColumnRenderer.js';

const koopCol = {
  id: 'cc-text',
  uuid: 'text-1',
  label: 'Notiz',
  dataCol: 'cc-text-1',
  fieldType: 'text',
  entityType: 'kooperation',
  visibleForKunden: true,
  editableByKunden: false
};

describe('Eigene Textspalte: Umbruch und Zeilenumbruch', () => {
  beforeEach(() => {
    window.permissionSystem = { canEdit: () => true };
  });

  it('rendert in der Kooperation eine Textarea, die Zeilenumbrüche behält', () => {
    const store = { getCustomColumnValue: () => 'Erste Zeile\nZweite Zeile' };
    const table = { hiddenColumns: [], isKundeRole: () => false };
    const html = renderCustomCell(koopCol, { id: 'k1' }, [], store, table);

    expect(html).toContain('<textarea');
    expect(html).not.toContain('<input');
    expect(html).toContain('custom-col-text');
    expect(html).toContain('auto-resize-textarea');
    expect(html).toContain('Erste Zeile\nZweite Zeile');
    expect(html).not.toContain('readonly');
    expect(renderCustomHeader(koopCol, [], false)).toContain('col-custom-text');
  });

  it('lässt Zahlen- und Linkspalten einzeilig', () => {
    const table = { hiddenColumns: [], isKundeRole: () => false };
    const store = { getCustomColumnValue: () => '12' };
    const numberHtml = renderCustomCell(
      { ...koopCol, fieldType: 'number', label: 'Menge' },
      { id: 'k1' }, [], store, table
    );
    expect(numberHtml).toContain('<input type="number"');
    expect(numberHtml).not.toContain('<textarea');
  });

  it('rendert Casting- und Konzept-Text mit Umbruchklasse und Zeilenumbruch', () => {
    const col = { id: 'aaa', name: 'Hinweis', field_type: 'text', visible_for_kunden: true };
    const html = renderCustomCells([col], 'e1', () => 'Oben\nUnten', [], false, true);
    expect(html).toContain('entity-custom-col--text');
    expect(html).toContain('<textarea');
    expect(html).toContain('Oben\nUnten');
    expect(renderCustomHeaders([col], [], false)).toContain('entity-custom-col--text');
  });

  it('zeigt gesetzte Zeilenumbrüche auch schreibgeschützt', () => {
    const col = { id: 'aaa', name: 'Hinweis', field_type: 'text', visible_for_kunden: true };
    const html = renderCustomCells([col], 'e1', () => 'Oben\nUnten', [], false, false);
    expect(html).toContain('cell-text-readonly');
    expect(html).toContain('Oben\nUnten');
    expect(html).not.toContain('<textarea');
  });
});
