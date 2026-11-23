// SearchableSelectPlaceholder.test.js
// Die Option mit leerem Wert ist Platzhalter: sie steht als placeholder im
// Input und darf den Filter beim Öffnen nicht verfälschen.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FormSearchableSelect } from '../core/form/logic/FormSearchableSelect.js';
import { OptionsManager } from '../core/form/data/OptionsManager.js';

const MARKEN = [
  { value: 'm1', label: 'MagentaSport' },
  { value: 'm2', label: 'Telekom' }
];

function mount({ value = '' } = {}) {
  document.body.innerHTML = `
    <div class="form-field">
      <select id="marke" name="marke_id">
        <option value="">– Marke wählen –</option>
        ${MARKEN.map((m) => `<option value="${m.value}">${m.label}</option>`).join('')}
      </select>
    </div>`;
  const select = document.getElementById('marke');
  select.value = value;
  new FormSearchableSelect(new OptionsManager()).createSimpleSearchableSelect(select, [
    { value: '', label: '– Marke wählen –' },
    ...MARKEN.map((m) => ({ ...m, selected: m.value === value }))
  ], { placeholder: 'Marke suchen…' });

  const container = select.parentNode.querySelector('.searchable-select-container');
  return {
    select,
    input: container.querySelector('.searchable-select-input'),
    hidden: container.querySelector('input[type="hidden"]'),
    dropdown: container.querySelector('.searchable-select-dropdown')
  };
}

function items(dropdown) {
  return [...dropdown.querySelectorAll('.searchable-select-item')];
}

function labels(dropdown) {
  return items(dropdown).map((el) => el.textContent.trim());
}

describe('Searchable-Select Platzhalter', () => {
  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('zeigt das Leer-Label als placeholder, nicht als Wert', () => {
    const { input, hidden } = mount();
    expect(input.value).toBe('');
    expect(input.placeholder).toBe('– Marke wählen –');
    expect(hidden.value).toBe('');
  });

  it('Fokus ohne Wert listet direkt alle Optionen, ohne den Platzhalter', () => {
    const { input, dropdown } = mount();
    input.dispatchEvent(new Event('focus'));

    expect(labels(dropdown)).toEqual(['MagentaSport', 'Telekom']);
    expect(input.placeholder).toBe('Marke suchen…');
  });

  it('Blur stellt das Leer-Label wieder her', () => {
    const { input } = mount();
    input.dispatchEvent(new Event('focus'));
    input.dispatchEvent(new Event('blur'));
    vi.advanceTimersByTime(200);

    expect(input.placeholder).toBe('– Marke wählen –');
  });

  it('mit gewähltem Wert öffnet der Fokus alle Optionen plus Zurücksetzen', () => {
    const { input, dropdown } = mount({ value: 'm1' });
    expect(input.value).toBe('MagentaSport');

    input.dispatchEvent(new Event('focus'));

    expect(labels(dropdown)).toEqual(['– Marke wählen –', 'MagentaSport', 'Telekom']);
    expect(items(dropdown)[0].classList.contains('is-placeholder')).toBe(true);
  });

  it('Klick auf den Platzhalter leert das Feld', () => {
    const { select, input, hidden, dropdown } = mount({ value: 'm1' });
    const onChange = vi.fn();
    select.addEventListener('change', onChange);

    input.dispatchEvent(new Event('focus'));
    items(dropdown)[0].click();

    expect(select.value).toBe('');
    expect(hidden.value).toBe('');
    expect(input.value).toBe('');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('Tippen filtert, der Platzhalter fällt aus den Treffern', () => {
    const { input, dropdown } = mount({ value: 'm1' });
    input.dispatchEvent(new Event('focus'));
    input.value = 'Tele';
    input.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(150);

    expect(labels(dropdown)).toEqual(['Telekom']);
  });
});
