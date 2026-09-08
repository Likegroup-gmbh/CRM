// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VertraegeCreate } from '../modules/vertrag/create/VertraegeCreateCore.js';
import '../modules/vertrag/create/FormEvents.js';
import { renderParagraphZusatz } from '../modules/vertrag/create/paragraphZusatz.js';

describe('bindMultistepEvents Extra Bestimmungen', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function setupWizardForm() {
    document.body.innerHTML = `
      <form id="vertrag-form">
        ${renderParagraphZusatz({}, 'p2', '§2 Leistungsumfang')}
        <select id="kunde_unternehmen_id"></select>
      </form>
    `;

    const form = new VertraegeCreate();
    form.getSubmitConfigId = () => 'ugc-contract-submit';
    return form;
  }

  it('blendet die Extra-Bestimmung-Textarea nach Klick ein', () => {
    const wizard = setupWizardForm();
    wizard.bindMultistepEvents();

    const button = document.querySelector('.btn-paragraph-zusatz');
    const field = document.querySelector('.paragraph-zusatz-field');
    expect(button.classList.contains('hidden')).toBe(false);
    expect(field.classList.contains('hidden')).toBe(true);

    button.click();

    expect(button.classList.contains('hidden')).toBe(true);
    expect(field.classList.contains('hidden')).toBe(false);
  });

  it('bindet dynamische Felder und Adressvorschau', () => {
    const wizard = setupWizardForm();
    const dynamicSpy = vi.spyOn(wizard, 'bindDynamicFieldEvents');
    const addressSpy = vi.spyOn(wizard, 'bindAddressPreviewEvents');

    wizard.bindMultistepEvents();

    expect(dynamicSpy).toHaveBeenCalled();
    expect(addressSpy).toHaveBeenCalled();
  });
});
