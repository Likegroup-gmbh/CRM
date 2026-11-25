// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isRequiredFieldMissing,
  missingRequiredFields
} from '../modules/vertrag/create/vertragStepValidation.js';
import { VertraegeCreate } from '../modules/vertrag/create/VertraegeCreateCore.js';
import '../modules/vertrag/create/DataPersistence.js';
import '../modules/vertrag/create/KooperationLogic.js';

function field(html) {
  document.body.innerHTML = html;
  return document.querySelector('input, select, textarea');
}

describe('isRequiredFieldMissing', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('hidden Kooperation mit required zaehlt nicht als fehlend', () => {
    document.body.innerHTML = `
      <form id="vertrag-form">
        <select id="kunde_unternehmen_id" required>
          <option value="u1" selected>Kunde</option>
        </select>
        <div id="kooperation-field" style="display:none">
          <select id="kooperation_id" name="kooperation_id" required>
            <option value="">Kooperation auswählen...</option>
          </select>
        </div>
      </form>
    `;
    const koop = document.getElementById('kooperation_id');
    expect(isRequiredFieldMissing(koop)).toBe(false);
    expect(missingRequiredFields(document.getElementById('vertrag-form'))).toEqual([]);
  });

  it('sichtbare leere Kooperation zaehlt als fehlend', () => {
    document.body.innerHTML = `
      <form id="vertrag-form">
        <div id="kooperation-field">
          <select id="kooperation_id" name="kooperation_id" required>
            <option value="">Kooperation auswählen...</option>
            <option value="k1">Koop A</option>
            <option value="k2">Koop B</option>
          </select>
        </div>
      </form>
    `;
    const koop = document.getElementById('kooperation_id');
    expect(isRequiredFieldMissing(koop)).toBe(true);
    expect(missingRequiredFields(document.getElementById('vertrag-form'))).toEqual([koop]);
  });

  it('disabled required Select zaehlt nicht als fehlend', () => {
    const select = field(`
      <select id="kampagne_id" required disabled>
        <option value="">Bitte zuerst Kunde wählen...</option>
      </select>
    `);
    expect(isRequiredFieldMissing(select)).toBe(false);
  });

  it('Nur-Whitespace zaehlt als leer', () => {
    const input = field(`<input id="name" required value="   ">`);
    expect(isRequiredFieldMissing(input)).toBe(true);
  });

  it('Feld in .hidden zaehlt nicht als fehlend', () => {
    const input = field(`
      <div class="hidden">
        <input id="zusatz" required value="">
      </div>
    `);
    expect(isRequiredFieldMissing(input)).toBe(false);
  });
});

describe('validateCurrentStep', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('laesst Weiter durch wenn nur die hidden Kooperation leer ist', () => {
    window.toastSystem = { show: vi.fn() };
    document.body.innerHTML = `
      <form id="vertrag-form">
        <select id="kunde_unternehmen_id" required>
          <option value="u1" selected>Kunde</option>
        </select>
        <div id="kooperation-field" style="display:none">
          <select id="kooperation_id" name="kooperation_id" required>
            <option value="">Kooperation auswählen...</option>
          </select>
        </div>
      </form>
    `;

    const wizard = new VertraegeCreate();
    expect(wizard.validateCurrentStep()).toBe(true);
    expect(window.toastSystem.show).not.toHaveBeenCalled();
  });

  it('blockt Weiter bei sichtbarer leerer Kooperation', () => {
    window.toastSystem = { show: vi.fn() };
    document.body.innerHTML = `
      <form id="vertrag-form">
        <div id="kooperation-field">
          <select id="kooperation_id" name="kooperation_id" required>
            <option value="">Kooperation auswählen...</option>
            <option value="k1">Koop A</option>
          </select>
        </div>
      </form>
    `;

    const wizard = new VertraegeCreate();
    expect(wizard.validateCurrentStep()).toBe(false);
    expect(window.toastSystem.show).toHaveBeenCalledWith(
      'Bitte füllen Sie alle Pflichtfelder aus.',
      'warning'
    );
  });
});

describe('renderKooperationSelect required', () => {
  it('setzt required nur wenn Kooperationen zum Creator existieren', () => {
    const wizard = new VertraegeCreate();
    wizard.formData = {};
    wizard.filteredKooperationen = [];
    expect(wizard.renderKooperationSelect()).not.toMatch(/\srequired/);

    wizard.formData.creator_id = 'c1';
    wizard.filteredKooperationen = [{ id: 'k1', creator_id: 'c1', name: 'Koop' }];
    expect(wizard.renderKooperationSelect()).toMatch(/\srequired/);
  });
});

describe('updateKooperationField required', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('nimmt required weg wenn das Feld ausgeblendet wird', () => {
    document.body.innerHTML = `
      <div id="kooperation-field">
        <select id="kooperation_id" name="kooperation_id" required>
          <option value="k1">Koop</option>
        </select>
      </div>
    `;
    const wizard = new VertraegeCreate();
    wizard.formData = { creator_id: 'c-cast' };
    wizard.filteredKooperationen = [];
    wizard.updateKooperationField();

    const select = document.getElementById('kooperation_id');
    expect(select.required).toBe(false);
    expect(document.getElementById('kooperation-field').style.display).toBe('none');
  });

  it('setzt required wenn Kooperationen zum Creator da sind', () => {
    document.body.innerHTML = `
      <div id="kooperation-field" style="display:none">
        <select id="kooperation_id" name="kooperation_id">
          <option value="">Kooperation auswählen...</option>
        </select>
      </div>
    `;
    const wizard = new VertraegeCreate();
    wizard.formData = { creator_id: 'c1' };
    wizard.filteredKooperationen = [{ id: 'k1', creator_id: 'c1', name: 'Koop' }];
    wizard.applyKooperationVerguetung = () => {};
    wizard.updateKooperationField();

    expect(document.getElementById('kooperation_id').required).toBe(true);
    expect(document.getElementById('kooperation-field').style.display).toBe('');
  });
});
