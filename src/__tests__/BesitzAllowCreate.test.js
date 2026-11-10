// Besitz im Creator-Formular ist ein Tag-Multiselect mit allowCreate.
// Der Eintrag muss sich aus der Suche anlegen und als Tag haengen lassen.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OptionsManager } from '../core/form/data/OptionsManager.js';
import { DynamicDataLoader } from '../core/form/data/DynamicDataLoader.js';
import { creatorConfig } from '../core/form/config/CreatorFormConfig.js';

const besitzField = {
  name: 'besitz_ids',
  type: 'multiselect',
  tagBased: true,
  allowCreate: true,
  placeholder: 'Besitz suchen oder anlegen...',
  table: 'besitz',
  displayField: 'name',
  valueField: 'id'
};

function mount() {
  document.body.innerHTML = `
    <form id="creator-form">
      <select id="field-besitz_ids" name="besitz_ids" multiple></select>
    </form>
  `;
  return document.getElementById('field-besitz_ids');
}

async function typeBesitz(value) {
  const input = document.querySelector('.searchable-select-input');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 200));
  return input;
}

describe('Besitz im Creator-Formular anlegen', () => {
  beforeEach(() => {
    OptionsManager.cleanup();
  });

  afterEach(() => {
    OptionsManager.cleanup();
    document.body.innerHTML = '';
    delete window.formSystem;
  });

  it('bietet einen unbekannten Besitz zum Anlegen an und haengt ihn als Tag an', async () => {
    const select = mount();
    const createLookupEntry = vi.fn().mockResolvedValue({ id: 'b-neu', name: 'Wohnmobil' });
    window.formSystem = { createLookupEntry };

    new OptionsManager().createTagBasedSelect(select, [
      { value: 'b1', label: 'Kamera' }
    ], besitzField);

    await typeBesitz('Wohnmobil');

    const createItem = document.querySelector('.create-new');
    expect(createItem).not.toBeNull();
    expect(createItem.textContent).toContain('Wohnmobil');

    createItem.click();
    await vi.waitFor(() => {
      expect(document.querySelector('.tag')?.textContent).toContain('Wohnmobil');
    });

    expect(createLookupEntry).toHaveBeenCalledWith('besitz', 'name', 'Wohnmobil');
    const tag = document.querySelector('.tag');
    expect(tag?.textContent).toContain('Wohnmobil');
    const hidden = document.getElementById('field-besitz_ids_hidden');
    expect(Array.from(hidden.selectedOptions).map((option) => option.value)).toEqual(['b-neu']);
  });

  it('legt Besitz auch an, wenn die Liste noch leer ist', async () => {
    const select = mount();
    window.formSystem = { createLookupEntry: vi.fn() };

    new OptionsManager().createTagBasedSelect(select, [], besitzField);

    await typeBesitz('Drohne');

    expect(document.querySelector('.create-new')).not.toBeNull();
    expect(document.querySelector('.searchable-select-input').disabled).toBe(false);
  });

  it('legt keinen zweiten Besitz an, wenn der Name schon existiert', async () => {
    const select = mount();
    new OptionsManager().createTagBasedSelect(select, [
      { value: 'b1', label: 'Kamera' }
    ], besitzField);

    await typeBesitz('Kamera');

    expect(document.querySelector('.create-new')).toBeNull();
    expect(document.querySelector('.searchable-select-item')?.textContent).toContain('Kamera');
  });

  it('legt einen neuen Besitz mit Enter an', async () => {
    const select = mount();
    const createLookupEntry = vi.fn().mockResolvedValue({ id: 'b-van', name: 'Van' });
    window.formSystem = { createLookupEntry };

    new OptionsManager().createTagBasedSelect(select, [], besitzField);

    const input = document.querySelector('.searchable-select-input');
    input.value = 'Van';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    await vi.waitFor(() => {
      expect(document.querySelector('.tag')?.textContent).toContain('Van');
    });
    expect(createLookupEntry).toHaveBeenCalledWith('besitz', 'name', 'Van');
  });

  it('reicht allowCreate aus dem Creator-Formular an die Tag-Auswahl durch', async () => {
    document.body.innerHTML = `
      <form>
        <select id="field-besitz_ids" name="besitz_ids" multiple data-tag-based="true"></select>
      </form>
    `;
    const field = creatorConfig.fields.find((entry) => entry.name === 'besitz_ids');
    const createLookupEntry = vi.fn().mockResolvedValue({ id: 'b-neu', name: 'Wohnmobil' });
    window.formSystem = { optionsManager: new OptionsManager(), createLookupEntry };

    const loader = new DynamicDataLoader();
    loader.dataService = {};
    loader.loadDirectQueryOptions = async () => [{ value: 'b1', label: 'Kamera' }];
    await loader.loadFieldOptions('creator', field, document.querySelector('form'));

    await typeBesitz('Wohnmobil');
    expect(document.querySelector('.create-new')?.textContent).toContain('Wohnmobil');
  });
});
