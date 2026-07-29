import { describe, it, expect } from 'vitest';
import { renderItemRow } from '../modules/creator-auswahl/CreatorAuswahlTemplates.js';
import { CREATOR_TYP_OPTIONS, CREATOR_TYP_SELECT_OPTIONS } from '../modules/creator-auswahl/creatorTypeOptions.js';

function renderCell(columnClass, item, ctx = {}) {
  const html = renderItemRow({ isKunde: false, hiddenColumns: [], ...ctx }, { id: 'i1', ...item }, 0);
  const doc = new DOMParser().parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
  return doc.querySelector(`td.${columnClass}`);
}

describe('Sourcing – Follower-Zellen', () => {
  it('haelt den Rohwert im Input und die Kurzform im Overlay', () => {
    const cell = renderCell('cp-col-follower-ig', { follower_instagram: 1391836 });

    expect(cell.querySelector('.cell-number__input').value).toBe('1391836');
    expect(cell.querySelector('.cell-number__display').textContent.trim()).toBe('1,39M');
  });

  it('zeigt den exakten Wert als Tooltip', () => {
    const cell = renderCell('cp-col-follower-tt', { follower_tiktok: 21569 });
    const display = cell.querySelector('.cell-number__display');

    expect(display.textContent.trim()).toBe('21,6K');
    expect(display.title).toBe('21.569');
  });

  it('kuerzt Tausender mit einer Nachkommastelle', () => {
    const cell = renderCell('cp-col-follower-ig', { follower_instagram: 5547 });

    expect(cell.querySelector('.cell-number__display').textContent.trim()).toBe('5,5K');
  });

  it('nutzt kein Textarea mehr, das die Spalte aufblaeht', () => {
    const cell = renderCell('cp-col-follower-ig', { follower_instagram: 5547 });

    expect(cell.querySelector('textarea')).toBeNull();
    expect(cell.querySelector('input[data-field="follower_instagram"]')).not.toBeNull();
  });

  it('zeigt bei leerem Wert einen Strich und einen leeren Input', () => {
    const cell = renderCell('cp-col-follower-ig', {});

    expect(cell.querySelector('.cell-number__input').value).toBe('');
    expect(cell.querySelector('.cell-number__display').textContent.trim()).toBe('–');
  });

  it('rendert fuer Kunden nur die formatierte Anzeige ohne Eingabefeld', () => {
    const cell = renderCell('cp-col-follower-ig', { follower_instagram: 1391836 }, { isKunde: true });

    expect(cell.querySelector('input')).toBeNull();
    expect(cell.querySelector('.cell-number__static').textContent.trim()).toBe('1,39M');
    expect(cell.querySelector('.cell-number__static').title).toBe('1.391.836');
  });
});

describe('Sourcing – Creator Art als TableSelect', () => {
  it('bietet alle Creator-Arten plus eine Leer-Option', () => {
    expect(CREATOR_TYP_SELECT_OPTIONS).toHaveLength(CREATOR_TYP_OPTIONS.length + 1);
    expect(CREATOR_TYP_SELECT_OPTIONS[0]).toEqual({ value: '', label: '–' });
  });

  it('rendert ein TableSelect statt eines nativen Selects', () => {
    const cell = renderCell('cp-col-typ', { typ: 'Influencer' });

    expect(cell.querySelector('select')).toBeNull();
    expect(cell.querySelector('.table-select').dataset.field).toBe('creator_typ');
  });

  it('markiert die aktuelle Creator Art', () => {
    const select = renderCell('cp-col-typ', { typ: 'Influencer' }).querySelector('.table-select');

    expect(select.dataset.value).toBe('Influencer');
    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('Influencer');
    expect(select.querySelector('.table-select__item.is-active').dataset.value).toBe('Influencer');
  });

  it('faellt ohne Wert auf die Leer-Option zurueck', () => {
    const select = renderCell('cp-col-typ', {}).querySelector('.table-select');

    expect(select.dataset.value).toBe('');
    expect(select.querySelector('.table-select__label').textContent.trim()).toBe('–');
  });

  it('sperrt das Select fuer Gaeste im Readonly-Modus', () => {
    const select = renderCell('cp-col-typ', { typ: 'Model' }, { gastReadonly: true }).querySelector('.table-select');

    expect(select.querySelector('button.table-select__trigger')).toBeNull();
    expect(select.querySelector('.table-select__trigger--disabled')).not.toBeNull();
  });

  it('zeigt Kunden nur den Text', () => {
    const cell = renderCell('cp-col-typ', { typ: 'Model' }, { isKunde: true });

    expect(cell.querySelector('.table-select')).toBeNull();
    expect(cell.querySelector('.cell-text-readonly').textContent.trim()).toBe('Model');
  });
});
