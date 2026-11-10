// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { VertraegeCreate } from '../modules/vertrag/create/VertraegeCreateCore.js';
import '../modules/vertrag/create/AgenturSection.js';

function wizard() {
  const form = new VertraegeCreate();
  form.alleManagements = [{
    id: 'm1',
    firmenname: 'Talent X',
    strasse: 'Weg',
    hausnummer: '1',
    plz: '10115',
    stadt: 'Berlin',
    land: 'Deutschland'
  }];
  form.formData = { _management_id: 'm1' };
  form.vertretungPersonen = [
    { id: 'p1', vorname: 'Dana', nachname: 'Kurz', email: 'd@talent.de' },
    { id: 'p2', vorname: 'Lea', nachname: 'Berg', email: '' }
  ];
  form._bindSearchable = () => {};
  form.setSearchableSelectValue = () => {};
  return form;
}

function mount(form) {
  document.body.innerHTML = form.renderAgenturSection();
  form._bindAgenturEvents();
}

describe('Management-Vertretung Ansprechpersonen', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('zeigt Name und E-Mail als Zeile, ohne Dropdown über den Feldern', () => {
    const form = wizard();
    mount(form);

    const rows = [...document.querySelectorAll('.vertretung-person')];
    expect(rows.map((row) => row.textContent.replace(/\s+/g, ' ').trim())).toEqual([
      'Dana Kurz d@talent.de',
      'Lea Berg keine E-Mail'
    ]);
    expect(document.getElementById('vertretung_ansprechpartner')).toBeNull();
    expect(document.querySelector('.searchable-select-dropdown')).toBeNull();
    expect(rows[0].closest('.searchable-select-container')).toBeNull();
    expect(document.querySelector('.vertretung-person-names')).not.toBeNull();
  });

  it('behält den Vornamen, wenn der Nachname getippt wird', () => {
    const form = wizard();
    mount(form);

    const vorname = document.getElementById('vertretung_vorname');
    const nachname = document.getElementById('vertretung_nachname');
    vorname.value = 'Max';
    vorname.dispatchEvent(new Event('input', { bubbles: true }));
    nachname.focus();
    nachname.value = 'M';
    nachname.dispatchEvent(new Event('input', { bubbles: true }));

    expect(document.getElementById('vertretung_vorname').value).toBe('Max');
    expect(form.formData._vertretung_vorname).toBe('Max');
    expect(form.formData._vertretung_nachname).toBe('M');
    expect(form.formData._ansprechpartner_id).toBeFalsy();
  });

  it('leert den Entwurf nur, wenn eine bestehende Person gewählt wird', () => {
    const form = wizard();
    form.formData._vertretung_vorname = 'Max';
    mount(form);

    document.querySelector('[data-person-id="p1"]').click();

    expect(form.formData._ansprechpartner_id).toBe('p1');
    expect(document.getElementById('vertretung_vorname').value).toBe('');
    expect(document.querySelector('[data-person-id="p1"]').classList.contains('is-selected')).toBe(true);

    const vorname = document.getElementById('vertretung_vorname');
    vorname.value = 'Max';
    vorname.dispatchEvent(new Event('input', { bubbles: true }));

    expect(document.getElementById('vertretung_vorname').value).toBe('Max');
    expect(document.querySelector('[data-person-id="p1"]').classList.contains('is-selected')).toBe(false);
    expect(form.formData._ansprechpartner_id).toBeNull();
  });
});
