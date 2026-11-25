import { describe, expect, it, afterEach } from 'vitest';
import {
  bindMoneyInput,
  editMoneyInput,
  formatMoneyInput
} from '../core/form/moneyInput.js';

describe('formatMoneyInput', () => {
  it('formatiert mit Tausenderpunkt, Komma und zwei Nachkommastellen', () => {
    expect(formatMoneyInput(12345.6)).toBe('12.345,60');
    expect(formatMoneyInput('1234.5')).toBe('1.234,50');
    expect(formatMoneyInput('1.234,5')).toBe('1.234,50');
  });

  it('lässt leer leer', () => {
    expect(formatMoneyInput('')).toBe('');
    expect(formatMoneyInput(null)).toBe('');
    expect(formatMoneyInput('abc')).toBe('');
  });
});

describe('editMoneyInput', () => {
  it('nimmt die Gruppierung raus und behält zwei Nachkommastellen', () => {
    expect(editMoneyInput(12345.6)).toBe('12345,60');
    expect(editMoneyInput('12.345,60')).toBe('12345,60');
  });
});

describe('bindMoneyInput', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('formatiert beim Verlassen und entgruppiert im Fokus', () => {
    const input = document.createElement('input');
    input.value = '12345.6';
    document.body.appendChild(input);
    bindMoneyInput(input);

    input.dispatchEvent(new Event('blur'));
    expect(input.value).toBe('12.345,60');

    input.dispatchEvent(new Event('focus'));
    expect(input.value).toBe('12345,60');
  });

  it('bindet readonly Felder nicht', () => {
    const input = document.createElement('input');
    input.readOnly = true;
    input.value = '10';
    bindMoneyInput(input);
    input.dispatchEvent(new Event('blur'));
    expect(input.value).toBe('10');
  });
});
