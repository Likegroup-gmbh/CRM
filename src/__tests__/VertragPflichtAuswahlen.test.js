import { describe, expect, it, vi } from 'vitest';
import { VertraegeCreate } from '../modules/vertrag/create/VertraegeCreateCore.js';
import {
  isKorrekturschleife,
  missingUgcPflichtAuswahlen,
  normalizeKorrekturschleifen
} from '../modules/vertrag/create/pflichtAuswahlen.js';
import '../modules/vertrag/create/types/UgcContract.js';
import '../modules/vertrag/create/types/InfluencerContract.js';
import '../modules/vertrag/create/types/ContractingContract.js';
import '../modules/vertrag/create/types/VideografContract.js';
import '../modules/vertrag/create/DataPersistence.js';
import '../modules/vertrag/create/FormEvents.js';

describe('Korrekturschleife', () => {
  it('behandelt Zahl und Text als dieselbe Auswahl', () => {
    expect(isKorrekturschleife(1, 1)).toBe(true);
    expect(isKorrekturschleife('1', 1)).toBe(true);
    expect(isKorrekturschleife('2', 2)).toBe(true);
    expect(isKorrekturschleife('', 1)).toBe(false);
    expect(isKorrekturschleife(null, 2)).toBe(false);
    expect(normalizeKorrekturschleifen('2')).toBe(2);
    expect(normalizeKorrekturschleifen('')).toBe(null);
  });

  it('wählt die gespeicherte Schleife im UGC-Select wieder aus', () => {
    const wizard = new VertraegeCreate();
    wizard.formData = { korrekturschleifen: '2', zahlungsziel: '30_tage', verguetung_netto: 100 };
    const html = wizard.renderStep5();
    expect(html).toContain('value="2" selected');
    expect(html).not.toMatch(/id="korrekturschleifen"[^>]*class="is-invalid"/);
  });

  it('wählt die gespeicherte Schleife bei Influencer, Contracting und Videograf wieder aus', () => {
    const influencer = new VertraegeCreate();
    influencer.formData = { korrekturschleifen: '1', plattformen: [], veroeffentlichungsplan: {} };
    influencer.isDirektvertragKunde = () => false;
    expect(influencer.renderInfluencerStep3()).toContain('value="1" \n                     checked');

    const contracting = new VertraegeCreate();
    contracting.formData = { korrekturschleifen: 2 };
    expect(contracting.renderContractingStep4()).toContain('value="2"\n                       checked');

    const videograf = new VertraegeCreate();
    videograf.formData = { korrekturschleifen: '1' };
    expect(videograf.renderVideografStep4()).toContain('value="1" \n                     checked');
  });

  it('speichert die Formularauswahl als Zahl', () => {
    document.body.innerHTML = `
      <form id="vertrag-form">
        <select name="korrekturschleifen">
          <option value="">Bitte wählen...</option>
          <option value="1" selected>1</option>
          <option value="2">2</option>
        </select>
      </form>
    `;
    const wizard = new VertraegeCreate();
    wizard.formData = {};
    wizard.saveCurrentStepData();
    expect(wizard.formData.korrekturschleifen).toBe(1);
  });
});

describe('UGC Pflicht-Auswahlen', () => {
  it('meldet leere Bitte-wählen-Felder und lässt gesetzte Werte durch', () => {
    expect(missingUgcPflichtAuswahlen({}).map((item) => item.field)).toEqual([
      'nutzungsdauer',
      'zahlungsziel',
      'korrekturschleifen'
    ]);
    expect(missingUgcPflichtAuswahlen({
      nutzungsdauer: '12_monate',
      zahlungsziel: '30_tage',
      korrekturschleifen: '1'
    })).toEqual([]);
  });

  it('zeigt den Hinweis, solange Nutzungsdauer auf Bitte wählen steht', () => {
    const wizard = new VertraegeCreate();
    wizard.formData = {};
    const html = wizard.renderStep4();
    expect(html).toContain('Nutzungsdauer <span class="required">*</span>');
    expect(html).toContain('data-pflicht-auswahl class="is-invalid"');
    expect(html).toContain('Bitte eine Auswahl treffen.');
    expect(html).not.toContain('form-hint form-hint--error hidden');
  });

  it('blendet den Hinweis aus, sobald eine Auswahl steht', () => {
    const wizard = new VertraegeCreate();
    wizard.formData = { nutzungsdauer: 'unbegrenzt' };
    const html = wizard.renderStep4();
    expect(html).toContain('form-hint form-hint--error hidden');
    expect(html).not.toContain('data-pflicht-auswahl class="is-invalid"');
  });

  it('öffnet beim Finalisieren den Schritt der fehlenden Nutzungsdauer', () => {
    const wizard = new VertraegeCreate();
    wizard.selectedTyp = 'UGC';
    wizard.currentStep = 5;
    wizard.formData = { zahlungsziel: '30_tage', korrekturschleifen: 1 };
    wizard.goToStep = vi.fn();
    window.toastSystem = { show: vi.fn() };

    expect(wizard.ensureUgcPflichtAuswahlen()).toBe(false);
    expect(wizard.goToStep).toHaveBeenCalledWith(4);
    expect(wizard._pendingAuswahlFocus).toBe('nutzungsdauer');
  });

  it('lässt Finalisieren zu, wenn alle drei Auswahlen gesetzt sind', () => {
    const wizard = new VertraegeCreate();
    wizard.selectedTyp = 'UGC';
    wizard.currentStep = 5;
    wizard.formData = {
      nutzungsdauer: '6_monate',
      zahlungsziel: '60_tage',
      korrekturschleifen: '2'
    };
    wizard.goToStep = vi.fn();

    expect(wizard.ensureUgcPflichtAuswahlen()).toBe(true);
    expect(wizard.goToStep).not.toHaveBeenCalled();
  });

  it('versteckt den Hinweis, sobald im Feld eine Auswahl getroffen wird', () => {
    document.body.innerHTML = `
      <form id="vertrag-form">
        <div class="form-field">
          <select id="zahlungsziel" name="zahlungsziel" required data-pflicht-auswahl class="is-invalid">
            <option value="">Bitte wählen...</option>
            <option value="30_tage">30 Tage</option>
          </select>
          <p class="form-hint form-hint--error" data-auswahl-hinweis>Bitte eine Auswahl treffen.</p>
        </div>
      </form>
    `;
    const wizard = new VertraegeCreate();
    wizard.currentStep = 2;
    wizard.getSubmitConfigId = () => 'ugc-contract-submit';
    wizard.bindMultistepEvents();

    const select = document.getElementById('zahlungsziel');
    select.value = '30_tage';
    select.dispatchEvent(new Event('change'));

    expect(select.classList.contains('is-invalid')).toBe(false);
    expect(select.parentElement.querySelector('[data-auswahl-hinweis]').classList.contains('hidden')).toBe(true);
  });
});
