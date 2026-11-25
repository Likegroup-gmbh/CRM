// @vitest-environment jsdom
//
// Prefill der Firma auf /produkt/new?unternehmen=...: Marke und Briefing laden
// ihre Optionen ueber das change-Event auf unternehmen_id. Der Prefill muss
// deshalb den nativen Select setzen und change feuern.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProduktForm } from '../modules/produkt/ProduktForm.js';
import { ProduktService } from '../modules/produkt/ProduktService.js';

const FIRMEN = [
  { id: 'u1', firmenname: 'Acme' },
  { id: 'u2', firmenname: 'Beta' }
];

function baueForm(scopeUnternehmenId) {
  document.body.innerHTML = `
    <form id="produkt-form">
      <select id="field-unternehmen_id" name="unternehmen_id">
        <option value="">Unternehmen suchen und auswählen...</option>
      </select>
    </form>`;
  const form = new ProduktForm();
  form.createScope = scopeUnternehmenId ? { unternehmenId: scopeUnternehmenId } : null;
  return form;
}

describe('ProduktForm.applyUnternehmenScope', () => {
  beforeEach(() => {
    vi.spyOn(ProduktService, 'loadCreateUnternehmenOptions').mockResolvedValue(FIRMEN);
    // Wie der echte Searchable: Reinit verschiebt den Wert nur ins Label, kein change
    window.formSystem = { reinitializeSearchableSelect: vi.fn() };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete window.formSystem;
    document.body.innerHTML = '';
  });

  it('setzt select.value und feuert change, wenn ein Unternehmen vorgegeben ist', async () => {
    const form = baueForm('u1');
    const select = document.getElementById('field-unternehmen_id');
    const onChange = vi.fn();
    document.getElementById('produkt-form').addEventListener('change', onChange);

    await form.applyUnternehmenScope();

    expect(select.value).toBe('u1');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target).toBe(select);
    expect(select.dataset.fieldName).toBe('unternehmen_id');
  });

  it('feuert auch ohne Searchable-System change mit gesetztem Wert', async () => {
    delete window.formSystem;
    const form = baueForm('u2');
    const select = document.getElementById('field-unternehmen_id');
    let wertBeiChange = null;
    document.getElementById('produkt-form').addEventListener('change', (e) => {
      wertBeiChange = e.target.value;
    });

    await form.applyUnternehmenScope();

    expect(wertBeiChange).toBe('u2');
    expect(select.value).toBe('u2');
  });

  it('feuert kein change ohne vorgegebenes Unternehmen', async () => {
    const form = baueForm(null);
    const onChange = vi.fn();
    document.getElementById('produkt-form').addEventListener('change', onChange);

    await form.applyUnternehmenScope();

    expect(onChange).not.toHaveBeenCalled();
    expect(document.getElementById('field-unternehmen_id').value).toBe('');
  });

  it('ignoriert eine Firma, die der User nicht anlegen darf', async () => {
    const form = baueForm('fremd');
    const onChange = vi.fn();
    document.getElementById('produkt-form').addEventListener('change', onChange);

    await form.applyUnternehmenScope();

    expect(onChange).not.toHaveBeenCalled();
  });
});
