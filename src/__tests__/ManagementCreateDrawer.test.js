// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildManagementRecord,
  injectManagementCreateButton,
  managementCreateDrawer,
  renderManagementFields,
  unmatchedManagementQuery
} from '../modules/creator/ManagementCreateDrawer.js';

function creatorForm(typed = '') {
  document.body.innerHTML = `
    <form id="creator-form">
      <div class="form-field">
        <select name="management_ids" id="field-management_ids"></select>
        <div class="tag-based-select" data-options='[{"value":"m1","label":"Talent Bestehend"}]'>
          <input class="searchable-select-input" value="${typed}" />
          <div class="tags-container tags-container--empty"></div>
        </div>
        <select id="field-management_ids_hidden" name="management_ids[]" multiple style="display: none"></select>
      </div>
    </form>
  `;
}

describe('Management-Drawer in v2', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    managementCreateDrawer.removeDrawer();
  });

  it('zeigt die Felder des Management-Formulars ohne Creator-Zuordnung', () => {
    const html = renderManagementFields('Talent Neu');
    expect(html).toContain('value="Talent Neu"');
    expect(html).toContain('Firmenname *');
    expect(html).toContain('name="ust_id"');
    expect(html).not.toContain('Creator zuordnen');
    expect(buildManagementRecord({ firmenname: 'Talent', webseite: 'talent.de' }).data.webseite).toBe('https://talent.de/');
  });

  it('hängt den Button unter Management und übernimmt einen unbekannten Namen', () => {
    creatorForm('Talent Neu');
    const field = document.querySelector('.form-field');
    expect(unmatchedManagementQuery(field)).toBe('Talent Neu');

    injectManagementCreateButton();
    document.querySelector('.btn-add-management-inline').click();

    expect(document.querySelector('.drawer-title').textContent).toBe('Neues Management anlegen');
    expect(document.getElementById('mgmt_firmenname').value).toBe('Talent Neu');
    expect(document.getElementById('management-ap-add')).toBeTruthy();
  });
});
