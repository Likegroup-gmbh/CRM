// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { FormRenderer } from '../core/form/FormRenderer.js';
import { FormConfig } from '../core/form/FormConfig.js';
import { markeConfig } from '../core/form/config/MarkeFormConfig.js';
import { unternehmenConfig } from '../core/form/config/UnternehmenFormConfig.js';
import { EntityRegistry } from '../core/data/entities/index.js';

function feldNamen(config) {
  return config.fields.map((f) => f.name);
}

// marke nutzt Objekt-Notation, unternehmen ein Array - beide Formen abdecken
function registryFeldNamen(entityType) {
  const fields = EntityRegistry[entityType].fields;
  return Array.isArray(fields) ? fields.map((f) => f.name) : Object.keys(fields);
}

describe('Kurzbeschreibung für Marke und Unternehmen', () => {
  let renderer;

  beforeAll(() => {
    renderer = new FormRenderer();
    // FormSystem injiziert getFormConfig normalerweise zur Laufzeit
    const config = new FormConfig();
    renderer.getFormConfig = config.getFormConfig.bind(config);
  });

  describe('Formular-Konfiguration', () => {
    it('Marke hat ein beschreibung-Textarea', () => {
      const feld = markeConfig.fields.find((f) => f.name === 'beschreibung');
      expect(feld).toBeDefined();
      expect(feld.type).toBe('textarea');
      expect(feld.required).toBe(false);
      expect(feld.placeholder).toBeTruthy();
    });

    it('Unternehmen hat ein beschreibung-Textarea in der Stammdaten-Section', () => {
      const feld = unternehmenConfig.fields.find((f) => f.name === 'beschreibung');
      expect(feld).toBeDefined();
      expect(feld.type).toBe('textarea');
      expect(feld.section).toBe('stammdaten');
      expect(feld.placeholder).toBeTruthy();
    });

    it('beschreibung ist kein editOnly-Feld, erscheint also auch beim Anlegen', () => {
      for (const config of [markeConfig, unternehmenConfig]) {
        const feld = config.fields.find((f) => f.name === 'beschreibung');
        expect(feld.editOnly).toBeUndefined();
      }
      expect(feldNamen(markeConfig)).toContain('beschreibung');
      expect(feldNamen(unternehmenConfig)).toContain('beschreibung');
    });
  });

  describe('Entity-Registry', () => {
    // Ohne Registry-Eintrag filtert DataPreparer das Feld vor dem Insert weg
    it('kennt beschreibung für marke und unternehmen', () => {
      expect(registryFeldNamen('marke')).toContain('beschreibung');
      expect(registryFeldNamen('unternehmen')).toContain('beschreibung');
    });
  });

  describe('Textarea-Rendering', () => {
    it('übernimmt rows und placeholder aus der Feld-Konfiguration', () => {
      const html = renderer.renderField({
        name: 'beschreibung',
        label: 'Kurzbeschreibung',
        type: 'textarea',
        rows: 4,
        placeholder: 'Was macht die Marke?'
      }, null);

      expect(html).toContain('rows="4"');
      expect(html).toContain('placeholder="Was macht die Marke?"');
      expect(html).toContain('name="beschreibung"');
    });

    it('fällt ohne rows auf 4 zurück und setzt dann kein placeholder-Attribut', () => {
      const html = renderer.renderField({ name: 'notiz', label: 'Notiz', type: 'textarea' }, null);
      expect(html).toContain('rows="4"');
      expect(html).not.toContain('placeholder=');
    });

    it('rendert den bestehenden Wert als Textarea-Inhalt', () => {
      const html = renderer.renderField({
        name: 'beschreibung',
        label: 'Kurzbeschreibung',
        type: 'textarea',
        rows: 4
      }, 'Nachhaltige Sportbekleidung aus Berlin.');

      expect(html).toContain('Nachhaltige Sportbekleidung aus Berlin.');
    });

    it('liefert einen .form-field-Wrapper, den die ExtractReviewLayer markieren kann', () => {
      const html = renderer.renderField({ name: 'beschreibung', label: 'Kurzbeschreibung', type: 'textarea' }, null);
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      const textarea = wrapper.querySelector('[name="beschreibung"]');
      expect(textarea).not.toBeNull();
      expect(textarea.closest('.form-field')).not.toBeNull();
    });
  });

  describe('Vollständiges Formular', () => {
    it('enthält das Beschreibungsfeld beim Anlegen einer Marke', () => {
      const html = renderer.renderFormOnly('marke', null);
      const doc = document.createElement('div');
      doc.innerHTML = html;
      expect(doc.querySelector('textarea[name="beschreibung"]')).not.toBeNull();
    });

    it('füllt das Beschreibungsfeld beim Bearbeiten einer Marke vor', () => {
      const html = renderer.renderFormOnly('marke', {
        _isEditMode: true,
        markenname: 'Beispielmarke',
        beschreibung: 'Bestehende Beschreibung.'
      });
      const doc = document.createElement('div');
      doc.innerHTML = html;
      expect(doc.querySelector('textarea[name="beschreibung"]').value).toBe('Bestehende Beschreibung.');
    });

    it('enthält das Beschreibungsfeld beim Anlegen eines Unternehmens', () => {
      const html = renderer.renderFormOnly('unternehmen', null);
      const doc = document.createElement('div');
      doc.innerHTML = html;
      expect(doc.querySelector('textarea[name="beschreibung"]')).not.toBeNull();
    });
  });
});
