// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { mountCreatorBetreuung, renderBetreuungGroups } from '../modules/ansprechpartner/betreuung.js';

const people = [
  { id: 'p1', vorname: 'Dana', nachname: 'Kurz', email: 'd@talent.de', management_id: 'm1' }
];

function supabase() {
  return {
    from() {
      return {
        select() { return this; },
        in() { return this; },
        eq() { return this; },
        order() { return Promise.resolve({ data: people, error: null }); }
      };
    }
  };
}

function formWithManagement() {
  document.body.innerHTML = `
    <form id="creator-form">
      <div class="form-field">
        <select name="management_ids" multiple>
          <option value="m1">Talent X</option>
        </select>
        <div class="tag-based-select">
          <div class="tag" data-value="m1"><span>Talent X</span><span class="tag-remove">×</span></div>
        </div>
      </div>
      <input name="notiz" id="notiz" />
    </form>
  `;
  return document.getElementById('creator-form');
}

describe('Creator-Betreuung beim Anlegen', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete window.supabase;
  });

  it('zeigt Name und E-Mail ohne die Checkbox auf volle Breite zu ziehen', () => {
    document.body.innerHTML = renderBetreuungGroups({
      managements: [{ id: 'm1', name: 'Talent X' }],
      people,
      checkedIds: new Set()
    });
    const row = document.querySelector('.betreuung-person');
    expect(row.textContent.replace(/\s+/g, ' ').trim()).toBe('Dana Kurz d@talent.de');
    expect(document.querySelector('.form-field--inline')).toBeNull();
  });

  it('behält den Vornamen, wenn der Nachname an der Reihe ist', async () => {
    window.supabase = supabase();
    const form = formWithManagement();
    await mountCreatorBetreuung(form);

    expect(document.querySelector('.form-label').textContent).toBe('Talent X');
    const vorname = document.querySelector('.betreuung-vorname');
    const nachname = document.querySelector('.betreuung-nachname');
    vorname.value = 'Max';
    vorname.dispatchEvent(new Event('change', { bubbles: true }));
    nachname.focus();
    nachname.value = 'M';
    nachname.dispatchEvent(new Event('input', { bubbles: true }));

    expect(document.querySelector('.betreuung-vorname').value).toBe('Max');
    expect(document.querySelector('.betreuung-nachname').value).toBe('M');
  });

  it('zeichnet nicht neu, wenn ein anderes Feld sich ändert und das Management gleich bleibt', async () => {
    window.supabase = supabase();
    const form = formWithManagement();
    await mountCreatorBetreuung(form);
    document.querySelector('.betreuung-vorname').value = 'Max';
    document.getElementById('notiz').dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
    expect(document.querySelector('.betreuung-vorname').value).toBe('Max');
  });
});
