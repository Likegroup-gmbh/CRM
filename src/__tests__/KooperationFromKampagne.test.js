import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setKooperationPrefillCache,
  navigateToNewKooperationFromKampagne,
  resolveKampagneIdFromCreateContext,
  resolveKooperationCreateRedirect
} from '../modules/kooperation/kooperationFromKampagne.js';

describe('resolveKooperationCreateRedirect', () => {
  it('geht zur Kampagne wenn kampagne_id bekannt ist', () => {
    expect(resolveKooperationCreateRedirect({
      kampagneId: 'kamp-1',
      newKooperationId: 'koop-9'
    })).toBe('/kampagne/kamp-1');
  });

  it('geht zur neuen Kooperation ohne Kampagnen-Kontext', () => {
    expect(resolveKooperationCreateRedirect({
      kampagneId: null,
      newKooperationId: 'koop-9'
    })).toBe('/kooperation/koop-9');
  });
});

describe('resolveKampagneIdFromCreateContext', () => {
  it('nimmt kampagne_id aus den Submit-Daten', () => {
    expect(resolveKampagneIdFromCreateContext({
      submitData: { kampagne_id: 'from-submit' },
      search: '?kampagne_id=from-url'
    })).toBe('from-submit');
  });

  it('nimmt kampagne_id aus Prefill-JSON wenn Submit sie nicht hat', () => {
    const form = document.createElement('form');
    form.dataset.prefillFromKampagne = 'true';
    form.dataset.prefillData = JSON.stringify({ kampagne_id: 'from-prefill' });

    expect(resolveKampagneIdFromCreateContext({
      submitData: {},
      form,
      search: '?kampagne_id=from-url'
    })).toBe('from-prefill');
  });

  it('nimmt kampagne_id aus der URL als letzten Fallback', () => {
    expect(resolveKampagneIdFromCreateContext({
      submitData: {},
      search: '?kampagne_id=from-url'
    })).toBe('from-url');
  });
});

describe('navigateToNewKooperationFromKampagne', () => {
  beforeEach(() => {
    window.navigateTo = vi.fn();
    delete window.kooperationPrefillCache;
    delete window.kampagneDetail;
  });

  it('setzt Prefill-Cache und navigiert zur Create-Route', () => {
    navigateToNewKooperationFromKampagne('kamp-1', {
      kampagnenname: 'Sommer',
      unternehmen_id: 'u1',
      marke_id: 'm1',
      unternehmen: { firmenname: 'Acme' },
      marke: { markenname: 'Acme Brand' }
    });

    expect(window.kooperationPrefillCache.kampagne_id).toBe('kamp-1');
    expect(window.kooperationPrefillCache.kampagnenname).toBe('Sommer');
    expect(window.kooperationPrefillCache.unternehmen_id).toBe('u1');
    expect(window.navigateTo).toHaveBeenCalledWith('/kooperation/new?kampagne_id=kamp-1');
  });

  it('nutzt kampagneDetail wenn keine Daten übergeben wurden', () => {
    window.kampagneDetail = {
      kampagneData: { kampagnenname: 'Herbst', unternehmen_id: 'u2' }
    };
    navigateToNewKooperationFromKampagne('kamp-2');
    expect(window.kooperationPrefillCache.kampagnenname).toBe('Herbst');
  });
});

describe('setKooperationPrefillCache', () => {
  it('schreibt nichts ohne Kampagnen-Daten', () => {
    delete window.kooperationPrefillCache;
    setKooperationPrefillCache('kamp-1', null);
    expect(window.kooperationPrefillCache).toBeUndefined();
  });
});
