import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VertraegeCreate } from '../modules/vertrag/create/VertraegeCreateCore.js';
import '../modules/vertrag/create/DataPersistence.js';

function makeSubmitInstance({ generatePDF }) {
  const inst = new VertraegeCreate();
  inst.validateCurrentStep = () => true;
  inst.saveCurrentStepData = () => {};
  inst.prepareDataForDB = () => ({ typ: 'UGC', name: 'UGC Test' });
  inst.getSubmitConfigId = () => 'ugc-contract-submit';
  inst.getResolvedCreatorContractAddress = () => ({ strasse: 'x' });
  inst.formData = {};
  inst.creators = [];
  inst.generatePDF = generatePDF;
  return inst;
}

describe('handleSubmit PDF persist', () => {
  beforeEach(() => {
    window.toastSystem = { show: vi.fn() };
    window.navigateTo = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.toastSystem;
    delete window.navigateTo;
    delete window.supabase;
  });

  function mockInsert() {
    window.supabase = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: 'v1', typ: 'UGC', name: 'UGC Test' }, error: null })
          })
        })
      })
    };
  }

  it('navigiert nicht wenn generatePDF keine Datei-URL liefert', async () => {
    mockInsert();
    const inst = makeSubmitInstance({
      generatePDF: vi.fn(async () => undefined)
    });

    await inst.handleSubmit();
    vi.runAllTimers();

    expect(window.toastSystem.show).not.toHaveBeenCalledWith(
      'Vertrag erfolgreich erstellt!',
      'success'
    );
    expect(window.navigateTo).not.toHaveBeenCalled();
    expect(window.toastSystem.show).toHaveBeenCalledWith(
      'Fehler: PDF konnte nicht gespeichert werden',
      'error'
    );
  });

  it('navigiert nicht wenn generatePDF wirft', async () => {
    mockInsert();
    const inst = makeSubmitInstance({
      generatePDF: vi.fn(async () => { throw new Error('token expired'); })
    });

    await inst.handleSubmit();
    vi.runAllTimers();

    expect(window.navigateTo).not.toHaveBeenCalled();
    expect(window.toastSystem.show).toHaveBeenCalledWith('Fehler: token expired', 'error');
  });

  it('navigiert nach erfolgreichem PDF', async () => {
    mockInsert();
    const inst = makeSubmitInstance({
      generatePDF: vi.fn(async () => ({ fileUrl: 'https://dropbox.test/v.pdf' }))
    });

    await inst.handleSubmit();
    vi.runAllTimers();

    expect(window.toastSystem.show).toHaveBeenCalledWith(
      'Vertrag erfolgreich erstellt!',
      'success'
    );
    expect(window.navigateTo).toHaveBeenCalledWith('/vertraege');
  });
});
