import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CustomDatePicker } from '../core/components/CustomDatePicker.js';

const MAX = '2026-11-12';

function mount(options = {}) {
  const root = document.createElement('form');
  root.innerHTML = CustomDatePicker.render({
    inputId: 'geb',
    field: 'geburtsdatum',
    label: 'Geburtsdatum',
    variant: 'text',
    yearSelect: true,
    min: '1900-01-01',
    max: MAX,
    showToday: false,
    ...options
  });
  document.body.appendChild(root);
  const cleanup = CustomDatePicker.bind(root);
  return {
    root,
    cleanup,
    input: root.querySelector('#geb'),
    picker: root.querySelector('[data-custom-datepicker]'),
    popover: root.querySelector('.custom-date-picker__popover')
  };
}

function typeText(input, text) {
  for (const ch of text) {
    input.value += ch;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ch }));
  }
}

describe('CustomDatePicker.parseDisplayDate', () => {
  it.each([
    ['12.05.1990', '1990-05-12'],
    ['1.5.1990', '1990-05-01'],
    ['12051990', '1990-05-12'],
    ['1990-05-12', '1990-05-12'],
    [' 12.05.1990 ', '1990-05-12']
  ])('%s -> %s', (text, iso) => {
    expect(CustomDatePicker.parseDisplayDate(text)).toBe(iso);
  });

  it.each(['31.02.1990', '12.13.1990', '1.5.90', 'abc', ''])('lehnt %s ab', (text) => {
    expect(CustomDatePicker.parseDisplayDate(text)).toBe('');
  });

  it('beachtet min und max', () => {
    const range = { min: '1900-01-01', max: MAX };
    expect(CustomDatePicker.parseDisplayDate('13.11.2026', range)).toBe('');
    expect(CustomDatePicker.parseDisplayDate('31.12.1899', range)).toBe('');
    expect(CustomDatePicker.parseDisplayDate('12.11.2026', range)).toBe(MAX);
  });
});

describe('CustomDatePicker text variant', () => {
  let ctx;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 12, 0, 0));
    ctx = mount();
  });

  afterEach(() => {
    CustomDatePicker.closeActivePicker();
    ctx.cleanup();
    ctx.root.remove();
    vi.useRealTimers();
  });

  it('setzt beim Tippen die Punkte und liefert den ISO-Wert', () => {
    typeText(ctx.input, '12051990');
    expect(ctx.input.value).toBe('12.05.1990');
    expect(CustomDatePicker.getValue(ctx.input)).toBe('1990-05-12');
    expect(ctx.picker.classList.contains('has-value')).toBe(true);
  });

  it('formatiert gültige Eingaben beim Verlassen und markiert ungültige', () => {
    ctx.input.value = '1.5.1990';
    ctx.input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
    ctx.input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(ctx.input.value).toBe('01.05.1990');
    expect(ctx.input.classList.contains('is-invalid')).toBe(false);

    ctx.input.value = '31.02.1990';
    ctx.input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
    ctx.input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(CustomDatePicker.getValue(ctx.input)).toBe('');
    expect(ctx.input.classList.contains('is-invalid')).toBe(true);
  });

  it('öffnet ohne Wert im Jahresraster, bündig am Maximaljahr', () => {
    ctx.picker.querySelector('.custom-date-picker__trigger').click();

    expect(ctx.popover.hidden).toBe(false);
    expect(ctx.popover.dataset.view).toBe('years');
    const years = [...ctx.popover.querySelectorAll('.custom-date-picker__grid-item')].map(b => Number(b.dataset.year));
    expect(years[0]).toBe(2015);
    expect(years.at(-1)).toBe(2026);
    expect(ctx.popover.querySelector('.custom-date-picker__nav--next').disabled).toBe(true);
    expect(ctx.popover.querySelector('.custom-date-picker__days').hidden).toBe(true);
  });

  it('führt über Jahr und Monat zum Tag', () => {
    const onChange = vi.fn();
    ctx.root.addEventListener('change', onChange);
    ctx.picker.querySelector('.custom-date-picker__trigger').click();

    for (let i = 0; i < 3; i += 1) ctx.popover.querySelector('.custom-date-picker__nav--prev').click();
    ctx.popover.querySelector('[data-year="1990"]').click();
    expect(ctx.popover.dataset.view).toBe('months');
    expect(ctx.popover.querySelector('.custom-date-picker__month-label').textContent).toBe('1990');

    ctx.popover.querySelector('[data-month="4"]').click();
    expect(ctx.popover.dataset.view).toBe('days');
    ctx.popover.querySelector('[data-date="1990-05-12"]').click();

    expect(CustomDatePicker.getValue(ctx.input)).toBe('1990-05-12');
    expect(ctx.input.value).toBe('12.05.1990');
    expect(ctx.popover.hidden).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('sperrt Tage nach max und das Weiterblättern', () => {
    CustomDatePicker.setValue(ctx.input, '2026-11-01');
    ctx.picker.querySelector('.custom-date-picker__trigger').click();

    expect(ctx.popover.dataset.view).toBe('days');
    expect(ctx.popover.querySelector('[data-date="2026-11-12"]').disabled).toBe(false);
    expect(ctx.popover.querySelector('[data-date="2026-11-13"]').disabled).toBe(true);
    expect(ctx.popover.querySelector('.custom-date-picker__nav--next').disabled).toBe(true);
  });
});

describe('CustomDatePicker bestehende Varianten', () => {
  it('native ohne neue Optionen bleibt beim alten Markup', () => {
    const html = CustomDatePicker.render({ id: 'x', field: 'start', value: '2026-01-15', variant: 'native' });
    const host = document.createElement('div');
    host.innerHTML = html;

    const picker = host.querySelector('[data-custom-datepicker]');
    expect(picker.dataset.variant).toBe('native');
    expect(picker.dataset.min).toBeUndefined();
    expect(host.querySelector('input[type="date"]').value).toBe('2026-01-15');
    expect(host.querySelector('.custom-date-picker__grid')).toBeNull();
    expect(host.querySelector('[data-action="today"]')).not.toBeNull();
  });
});
