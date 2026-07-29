import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TableSelect, renderTableSelect } from '../core/components/TableSelect.js';

const OPTIONS = [
  { value: 'a', label: 'Alpha', color: 'var(--gray-300)' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma', disabled: true }
];

describe('TableSelect', () => {
  let select;

  beforeEach(() => {
    select = new TableSelect();
    select.init();
    document.body.innerHTML = `<div id="host">${renderTableSelect({
      field: 'status', itemId: 'x1', value: 'a', options: OPTIONS
    })}</div>`;
  });

  afterEach(() => {
    select.destroy();
    document.body.innerHTML = '';
  });

  const trigger = () => document.querySelector('.table-select__trigger');
  const portal = () => document.querySelector('.table-select__portal');

  it('haelt das Inline-Panel als Vorlage vor und oeffnet ein Portal an document.body', () => {
    expect(document.querySelector('.table-select__panel')).not.toBeNull();
    expect(portal()).toBeNull();

    trigger().click();

    expect(portal()).not.toBeNull();
    expect(portal().parentElement).toBe(document.body);
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
  });

  it('schliesst beim zweiten Klick auf den Trigger wieder', () => {
    trigger().click();
    trigger().click();

    expect(portal()).toBeNull();
    expect(document.querySelector('.table-select.open')).toBeNull();
  });

  it('feuert table-select-change mit Feld, Item und neuem Wert', () => {
    const spy = vi.fn();
    document.addEventListener('table-select-change', spy);

    trigger().click();
    portal().querySelector('[data-value="b"]').click();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].detail).toMatchObject({ field: 'status', itemId: 'x1', value: 'b' });
    expect(portal()).toBeNull();

    document.removeEventListener('table-select-change', spy);
  });

  it('feuert kein Event, wenn der bereits aktive Wert gewaehlt wird', () => {
    const spy = vi.fn();
    document.addEventListener('table-select-change', spy);

    trigger().click();
    portal().querySelector('[data-value="a"]').click();

    expect(spy).not.toHaveBeenCalled();
    document.removeEventListener('table-select-change', spy);
  });

  it('schliesst bei Escape und bei Klick ausserhalb', () => {
    trigger().click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(portal()).toBeNull();

    trigger().click();
    document.body.click();
    expect(portal()).toBeNull();
  });

  it('rendert einen deaktivierten Trigger ohne Panel', () => {
    document.body.innerHTML = renderTableSelect({
      field: 'status', itemId: 'x2', value: 'b', options: OPTIONS, disabled: true
    });

    expect(document.querySelector('button.table-select__trigger')).toBeNull();
    expect(document.querySelector('.table-select__panel')).toBeNull();

    document.querySelector('.table-select__trigger').click();
    expect(portal()).toBeNull();
  });

  it('faellt ohne passenden Wert auf den Platzhalter zurueck', () => {
    document.body.innerHTML = renderTableSelect({
      field: 'status', itemId: 'x3', value: null, options: OPTIONS, placeholder: 'Bitte wählen'
    });

    const el = document.querySelector('.table-select__trigger');
    expect(el.classList.contains('table-select__trigger--empty')).toBe(true);
    expect(el.querySelector('.table-select__label').textContent.trim()).toBe('Bitte wählen');
  });

  it('escaped Labels und Werte', () => {
    document.body.innerHTML = renderTableSelect({
      field: 'status',
      itemId: 'x4',
      value: 'x',
      options: [{ value: 'x', label: '<img src=x onerror=alert(1)>' }]
    });

    expect(document.querySelector('.table-select__label img')).toBeNull();
    expect(document.querySelector('.table-select__label').textContent).toContain('<img');
  });

  it('init ist idempotent und bindet die Listener nicht doppelt', () => {
    select.init();
    select.init();

    const spy = vi.fn();
    document.addEventListener('table-select-change', spy);

    trigger().click();
    portal().querySelector('[data-value="b"]').click();

    expect(spy).toHaveBeenCalledTimes(1);
    document.removeEventListener('table-select-change', spy);
  });
});
