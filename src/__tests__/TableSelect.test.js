import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TableSelect, renderTableSelect, tableSelectDisabled } from '../core/components/TableSelect.js';

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
    expect(document.querySelector('.table-select.show')).toBeNull();
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

describe('TableSelect im Formular-Modus (input)', () => {
  const FORM_OPTIONS = [
    { value: '', label: 'Keine Vorgabe' },
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' }
  ];
  let select;

  beforeEach(() => {
    select = new TableSelect();
    select.init();
    document.body.innerHTML = `<form>${renderTableSelect({
      field: 'm__alter', itemId: 'g', value: '', options: FORM_OPTIONS, input: 'm__alter'
    })}</form>`;
  });

  afterEach(() => {
    select.destroy();
    document.body.innerHTML = '';
  });

  const input = () => document.querySelector('input[name="m__alter"]');
  const label = () => document.querySelector('.table-select__label').textContent.trim();
  const trigger = () => document.querySelector('.table-select__trigger');

  it('rendert ein hidden input und behandelt den leeren Wert als Platzhalter', () => {
    expect(input().type).toBe('hidden');
    expect(input().value).toBe('');
    expect(trigger().classList.contains('table-select__trigger--empty')).toBe(true);
  });

  it('zieht Input, Label, Platzhalter-Optik und Haken beim Wechsel nach', () => {
    const spy = vi.fn();
    document.addEventListener('table-select-change', spy);

    trigger().click();
    document.querySelector('.table-select__portal [data-value="b"]').click();

    expect(input().value).toBe('b');
    expect(label()).toBe('Beta');
    expect(trigger().classList.contains('table-select__trigger--empty')).toBe(false);
    expect(document.querySelector('.table-select[data-table-select]').dataset.value).toBe('b');
    expect(spy.mock.calls[0][0].detail).toMatchObject({ field: 'm__alter', value: 'b' });

    const aktiv = [...document.querySelectorAll('.table-select__panel .table-select__item.is-active')];
    expect(aktiv.map(el => el.dataset.value)).toEqual(['b']);
    expect(document.querySelectorAll('.table-select__panel .table-select__item svg')).toHaveLength(1);

    trigger().click();
    document.querySelector('.table-select__portal [data-value=""]').click();
    expect(input().value).toBe('');
    expect(label()).toBe('Keine Vorgabe');
    expect(trigger().classList.contains('table-select__trigger--empty')).toBe(true);

    document.removeEventListener('table-select-change', spy);
  });

  it('matchWidth: Optionsliste bekommt die Breite des Triggers, ohne Option bleibt sie unberuehrt', () => {
    const breite = { width: 321, left: 10, right: 331, top: 10, bottom: 40, height: 30 };
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(breite);

    document.body.innerHTML = renderTableSelect({
      field: 'm__alter', itemId: 'g', value: '', options: FORM_OPTIONS, input: 'm__alter', matchWidth: true
    });
    document.querySelector('.table-select__trigger').click();
    const mitBreite = document.querySelector('.table-select__portal');
    expect(mitBreite.style.width).toBe('321px');
    expect(mitBreite.style.minWidth).toBe('321px');
    expect(mitBreite.classList.contains('table-select__portal--match')).toBe(true);
    select.closeAll();

    document.body.innerHTML = renderTableSelect({
      field: 'status', itemId: 'x', value: 'a', options: FORM_OPTIONS
    });
    document.querySelector('.table-select__trigger').click();
    const ohne = document.querySelector('.table-select__portal');
    expect(ohne.style.width).toBe('');
    expect(ohne.classList.contains('table-select__portal--match')).toBe(false);

    spy.mockRestore();
  });

  it('Tabellen-Modus ohne input aendert den Wrapper nicht selbst', () => {
    document.body.innerHTML = renderTableSelect({
      field: 'status', itemId: 'x', value: 'a', options: FORM_OPTIONS
    });
    document.querySelector('.table-select__trigger').click();
    document.querySelector('.table-select__portal [data-value="b"]').click();

    expect(document.querySelector('[data-table-select]').dataset.value).toBe('a');
    expect(document.querySelector('.table-select__label').textContent.trim()).toBe('Alpha');
  });
});

describe('tableSelectDisabled', () => {
  it('sperrt immer fuer Gaeste im Readonly-Modus', () => {
    expect(tableSelectDisabled({ gastReadonly: true })).toBe(true);
    expect(tableSelectDisabled({ gastReadonly: true, isKunde: true, kundeDarfWaehlen: true })).toBe(true);
  });

  it('sperrt Kunden nur, wenn das Feld nicht freigegeben ist', () => {
    expect(tableSelectDisabled({ isKunde: true })).toBe(true);
    expect(tableSelectDisabled({ isKunde: true, kundeDarfWaehlen: true })).toBe(false);
  });

  it('laesst interne Nutzer immer waehlen', () => {
    expect(tableSelectDisabled({})).toBe(false);
    expect(tableSelectDisabled({ isKunde: false })).toBe(false);
  });
});
