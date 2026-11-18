import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import { KI_SCHWELLE, PLATTFORMEN, PLATTFORM_FELDER } from '../modules/auswertung/auswertungKonfig.js';
import { POST_SELECT } from '../modules/auswertung/auswertungPostsDaten.js';

const require = createRequire(import.meta.url);
const kopie = require('../../netlify/functions/_shared/post-kennzahlen.js');
const { POST_SPALTEN } = require('../../netlify/functions/_shared/post-zugriff.js');

describe('Konfiguration der Auswertung: Frontend und Functions gleich', () => {
  it('Plattformen und ihre Felder', () => {
    expect(kopie.PLATTFORMEN).toEqual(Object.keys(PLATTFORMEN));
    expect(kopie.PLATTFORM_FELDER).toEqual(PLATTFORM_FELDER);
  });

  it('Schwelle für „bitte prüfen“', () => {
    expect(kopie.KI_SCHWELLE).toBe(KI_SCHWELLE);
  });

  it('Spalten eines Posts', () => {
    expect(POST_SPALTEN).toBe(POST_SELECT);
  });
});
