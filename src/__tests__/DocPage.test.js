import { describe, it, expect } from 'vitest';
import { renderDocPage, bindDocPage } from '../core/doc/DocPage.js';

const felder = [
  { name: 'name', label: 'Name', type: 'text', required: true, docRole: 'title', docLabel: 'Titel', section: 'basis' },
  { name: 'alter_von', label: 'Alter von', type: 'number', docRole: 'inline', row: 'alter', docGroup: 'demo', section: 'demo', sectionTitle: 'Demografie' },
  { name: 'alter_bis', label: 'Alter bis', type: 'number', docRole: 'inline', row: 'alter', docGroup: 'demo', section: 'demo' },
  { name: 'notizen', label: 'Notizen', type: 'textarea', docGroup: 'demo', section: 'demo' },
  { name: '_slot_rel', label: '', type: 'hidden', docRole: 'slot', slotId: 'test-panel', docGroup: 'relationen', section: 'demo' }
];

describe('DocPage', () => {
  it('rendert Titel, Gruppen und Slot in Config-Reihenfolge', () => {
    const html = renderDocPage({
      formId: 'test-form',
      entity: 'test',
      entityLabel: 'Test',
      fields: felder,
      side: '<div>Seite</div>'
    });

    const doc = document.createElement('div');
    doc.innerHTML = html;
    const form = doc.querySelector('form#test-form.doc');

    expect(form).not.toBeNull();
    expect(form.dataset.entity).toBe('test');
    expect(form.querySelector('.doc__title[name="name"]')).not.toBeNull();

    const gruppen = [...form.querySelectorAll('.doc__group')].map(g => g.dataset.docGroup);
    expect(gruppen).toEqual(['demo', 'relationen']);
    expect(form.querySelector('#test-panel')).not.toBeNull();
    expect(form.querySelector('.doc__side')).not.toBeNull();

    // Inline-Zeile buendelt beide Alter-Felder in einer Sektion
    const zeile = form.querySelector('[data-doc-row="alter"]');
    expect(zeile.querySelectorAll('.doc__inline-card').length).toBe(2);
    expect(zeile.querySelector('.doc__heading').textContent).toBe('Demografie');
  });

  it('rendert Hidden-Inputs und laesst die Seitenspalte ohne side weg', () => {
    const html = renderDocPage({
      formId: 'test-form',
      entity: 'test',
      fields: felder,
      hidden: { unternehmen_id: 'u1' }
    });

    const doc = document.createElement('div');
    doc.innerHTML = html;

    expect(doc.querySelector('input[type="hidden"][name="unternehmen_id"]').value).toBe('u1');
    expect(doc.querySelector('.doc__side')).toBeNull();
  });

  it('bindDocPage fuellt Werte per Property, nicht ins Markup', () => {
    const doc = document.createElement('div');
    doc.innerHTML = renderDocPage({ formId: 'test-form', entity: 'test', fields: felder });
    const form = doc.querySelector('form');

    bindDocPage(form, felder, { name: '<b>Sarah</b>', alter_von: 30, notizen: 'Text' });

    expect(form.querySelector('[name="name"]').value).toBe('<b>Sarah</b>');
    expect(form.querySelector('[name="alter_von"]').value).toBe('30');
    expect(form.querySelector('[name="notizen"]').value).toBe('Text');
    // kein HTML im Titel-Input interpretiert
    expect(form.querySelector('[name="name"]').outerHTML).not.toContain('<b>Sarah</b>');
  });
});
