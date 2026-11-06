import { describe, it, expect, beforeEach } from 'vitest';
import {
  accountLoginBackUrl,
  beginAccountLogin,
  finishSuccessfulLogin,
  isConcreteListPath,
  readAccountReturn,
  PACKAGE_NOTICE,
} from '../modules/share/accountReturn.js';

describe('accountReturn', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('erkennt eine konkrete Listen-Adresse und lässt die Skript-Sonderseiten aus', () => {
    expect(isConcreteListPath('/kampagne/abc')).toBe(true);
    expect(isConcreteListPath('/skripte/abc')).toBe(true);
    expect(isConcreteListPath('/skripte')).toBe(false);
    expect(isConcreteListPath('/skripte/dna')).toBe(false);
    expect(isConcreteListPath('/')).toBe(false);
  });

  it('behält die Gast-Sitzung bis zum Login und lädt danach die Liste neu', () => {
    localStorage.setItem('cj24.guestShares', JSON.stringify({ tok: { jwt: 'x' } }));
    beginAccountLogin({ back: '/share/tok', after: 'list' });
    expect(readAccountReturn().back).toBe('/share/tok');
    expect(localStorage.getItem('cj24.guestShares')).not.toBeNull();

    const next = finishSuccessfulLogin('/kampagne/abc');
    expect(next.reload).toBe('/kampagne/abc');
    expect(readAccountReturn()).toBeNull();
    expect(localStorage.getItem('cj24.guestShares')).toBeNull();
  });

  it('landet aus einem Skript-Paket auf der Startseite mit Hinweis', () => {
    beginAccountLogin({ back: '/share/tok', after: 'package' });
    const next = finishSuccessfulLogin('/');
    expect(next.notice).toBe(PACKAGE_NOTICE);
    expect(next.reload).toBeUndefined();
  });

  it('führt Abbrechen auf die Gast-Liste oder die Sperrseite zurück', () => {
    expect(accountLoginBackUrl({ back: '/share/tok' })).toBe('/share/tok');
    expect(accountLoginBackUrl({ back: 'lock' })).toBe('/');
  });
});