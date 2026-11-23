import { describe, it, expect, afterEach, vi } from 'vitest';
import { FormSearchableSelect } from '../core/form/logic/FormSearchableSelect.js';

const OPTIONEN = [
  { value: 'u1', label: 'Acme GmbH', selected: true },
  { value: 'u2', label: 'Beta AG' },
  { value: 'u3', label: 'Gamma KG' }
];

function mount(field = {}) {
  document.body.innerHTML = '<form><select id="field-unternehmen_id" name="unternehmen_id"></select></form>';
  const select = document.getElementById('field-unternehmen_id');
  new FormSearchableSelect({}).createSimpleSearchableSelect(select, OPTIONEN.map(o => ({ ...o })), field);
  const input = document.querySelector('.searchable-select-input');
  const labels = () => Array.from(document.querySelectorAll('.searchable-select-item:not(.create-new)'))
    .map(el => el.textContent);
  return { input, labels };
}

describe('Searchable-Select beim Fokus', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('zeigt trotz gewähltem Wert alle Optionen und markiert den Text', async () => {
    const { input, labels } = mount();
    expect(input.value).toBe('Acme GmbH');

    input.dispatchEvent(new Event('focus'));
    await Promise.resolve();

    expect(labels()).toEqual(['Acme GmbH', 'Beta AG', 'Gamma KG']);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('Acme GmbH'.length);
  });

  it('fragt die Serversuche beim Fokus ohne den gewählten Text ab', async () => {
    const serverSearch = vi.fn(async () => OPTIONEN);
    const { input, labels } = mount({ serverSearch });

    input.dispatchEvent(new Event('focus'));
    await vi.waitFor(() => expect(labels()).toHaveLength(3));

    expect(serverSearch).toHaveBeenCalledWith('');
  });
});
