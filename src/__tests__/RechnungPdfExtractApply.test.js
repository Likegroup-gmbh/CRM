import { describe, it, expect, beforeEach } from 'vitest';
import { RechnungPdfExtract } from '../modules/rechnung/RechnungPdfExtract.js';

describe('RechnungPdfExtract.applyFields', () => {
  let extract;
  let form;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="rechnung-extract-drop"></div>
      <input id="rechnung-extract-input" hidden>
      <button type="button" id="rechnung-extract-btn">PDF</button>
      <form id="rechnung-form">
        <input name="nettobetrag" value="">
        <input name="zusatzkosten" value="">
        <input name="ust_aktiv" type="checkbox" checked>
      </form>
    `;
    form = document.getElementById('rechnung-form');
    extract = new RechnungPdfExtract();
    extract.form = form;
    extract.bind(document.body, form);
  });

  const fields = {
    nettobetrag: { value: 6000 },
    zusatzkosten: { value: 120 },
    ust_ausgewiesen: { value: false }
  };

  it('ueberschreibt beim erneuten Anwenden keine manuell korrigierten Felder', () => {
    extract.applyFields(fields);
    const netto = form.querySelector('[name="nettobetrag"]');
    netto.value = '5500';
    netto.dispatchEvent(new Event('input', { bubbles: true }));

    extract.applyFields(fields, { force: true, geschuetzt: extract._manuellGeaendert });

    expect(form.querySelector('[name="nettobetrag"]').value).toBe('5500');
    expect(form.querySelector('[name="zusatzkosten"]').value).toBe('120.00');
    expect(form.querySelector('[name="ust_aktiv"]').checked).toBe(false);
  });

  it('schreibt nicht angefasste Felder beim Koop-Prefill zurueck', () => {
    extract.applyFields(fields);
    form.querySelector('[name="nettobetrag"]').value = '4000';
    form.querySelector('[name="zusatzkosten"]').value = '0';

    extract.applyFields(fields, { force: true, geschuetzt: extract._manuellGeaendert });

    expect(form.querySelector('[name="nettobetrag"]').value).toBe('6000.00');
    expect(form.querySelector('[name="zusatzkosten"]').value).toBe('120.00');
  });
});
