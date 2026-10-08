// BriefingFieldRenderer.test.js
// Step/Section/FieldGroup-Markup und Wrap-Gruppen im Create-Renderer.

import { describe, it, expect } from 'vitest';
import { FLOW_STEPS } from '../modules/briefing/create/fieldConfig.js';
import { renderStep } from '../modules/briefing/create/FieldRenderer.js';
import { buildSpec } from '../modules/briefing/create/BriefingLikyPanel.js';

function parse(html) {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('Briefing FieldRenderer Hierarchie', () => {
  it('Step und Section bekommen stabile Klassen und data-Attribute', () => {
    const html = renderStep(FLOW_STEPS.find(s => s.id === 'grundlage'), {}, {});
    const root = parse(html);

    const step = root.querySelector('.bf-step');
    expect(step.classList.contains('bf-step--grundlage')).toBe(true);
    expect(step.dataset.step).toBe('grundlage');

    const zuordnung = root.querySelector('.step-section--zuordnung');
    expect(zuordnung).toBeTruthy();
    expect(zuordnung.dataset.section).toBe('zuordnung');
    expect(zuordnung.dataset.step).toBe('grundlage');

    const body = zuordnung.querySelector(':scope > .step-section__body');
    expect(zuordnung.querySelector(':scope > .step-section__header')).toBeTruthy();
    expect(body).toBeTruthy();
    expect([...body.querySelectorAll(':scope > .bf-field-group')].map(el => el.dataset.group)).toEqual([
      'zuordnung-entities',
      'zuordnung-titel'
    ]);
  });

  it('nutzung-flags ist eine Wrap-Gruppe mit den vier Checkboxen', () => {
    const html = renderStep(FLOW_STEPS.find(s => s.id === 'vertrag'), {}, {});
    const root = parse(html);
    const group = root.querySelector('[data-group="nutzung-flags"]');

    expect(group.classList.contains('bf-field-group--wrap')).toBe(true);
    expect(group.classList.contains('bf-field-group--nutzung-flags')).toBe(true);
    expect([...group.querySelectorAll('input[type="checkbox"]')].map(el => el.name)).toEqual([
      'nutzung_markenkanal',
      'nutzung_paid_media',
      'nutzung_creator_kanal',
      'nutzung_whitelisting'
    ]);
  });

  it('bf-channels enthält Meta-Block und TikTok-Block als Geschwister', () => {
    const html = renderStep(
      FLOW_STEPS.find(s => s.id === 'konzepte'),
      { bereich: 'paid_creator_ads' },
      {}
    );
    const root = parse(html);
    const channels = root.querySelector('.bf-channels');
    const blocks = [...channels.querySelectorAll(':scope > .bf-channel')];
    const titles = blocks.map(block => {
      const title = block.querySelector('.bf-channel__title');
      return title ? title.textContent.trim() : '';
    });

    expect(titles).toContain('Meta');
    expect(titles).toContain('TikTok');
    expect(titles.indexOf('Meta')).toBeLessThan(titles.indexOf('TikTok'));
    expect(blocks.find(b => b.textContent.includes('Meta')).querySelector('.checkbox-group')).toBeTruthy();

    const tiktok = blocks.find(b => b.querySelector('.bf-channel__title')?.textContent.trim() === 'TikTok');
    expect(tiktok.classList.contains('bf-channel--toggle')).toBe(true);
    expect(tiktok.querySelector('.bf-channel__title').tagName).toBe('DIV');
    expect(tiktok.querySelector('.bf-channel__title').classList.contains('checkbox-label')).toBe(false);
    expect(tiktok.querySelector('.checkbox-group .checkbox-label span').textContent.trim()).toBe('TikTok');

    const pinterest = blocks.find(b => b.querySelector('.bf-channel__title')?.textContent.trim() === 'Pinterest');
    const pinterestChip = pinterest.querySelector('.checkbox-label--icon');
    expect(pinterestChip.querySelector('.checkbox-label__icon use').getAttribute('href')).toBe('#crm-icon-pinterest');
    expect(pinterestChip.querySelector('input[type="checkbox"]')).toBeTruthy();
    expect(root.querySelector('.bf-channel--custom')).toBeTruthy();
  });

  it('legt Umsetzungsideen und Referenzen in eine Header-Zeile', () => {
    const html = renderStep(FLOW_STEPS.find(s => s.id === 'konzepte'), {}, {});
    const root = parse(html);
    const group = root.querySelector('[data-group="konzept-ideen-kopf"]');
    const header = group.querySelector(':scope > .bf-split-header');
    const ideenListe = group.querySelector('[data-repeatable="umsetzungsideen"]');
    const repeatable = group.querySelector('[data-repeatable="referenzen"]');
    const addIdee = header.querySelector('[data-repeatable-add="umsetzungsideen"]');
    const add = header.querySelector('[data-repeatable-add="referenzen"]');
    const labels = [...header.querySelectorAll('.bf-split-header__label')].map(el => el.textContent);

    expect(group.classList.contains('bf-field-group--split-header')).toBe(true);
    expect(labels).toEqual(['Vorhandene Umsetzungsideen', 'Referenzen und Beispiele']);
    expect(addIdee.textContent).toContain('Idee hinzufügen');
    expect(add.textContent).toContain('Beispiel hinzufügen');
    expect(ideenListe.closest('.form-field').querySelector('label')).toBeNull();
    expect(ideenListe.closest('.form-field').querySelector('[data-repeatable-add]')).toBeNull();
    expect(repeatable.closest('.form-field').querySelector('[data-repeatable-add]')).toBeNull();
    expect(header.compareDocumentPosition(ideenListe) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ideenListe.compareDocumentPosition(repeatable) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Ideen: eine leere Startzeile als Textarea, Referenzen bleiben leer
    expect(ideenListe.querySelectorAll('textarea[data-item]')).toHaveLength(1);
    expect(repeatable.childElementCount).toBe(0);

    const ideen = root.querySelector('[data-group="konzept-ideen"]');
    const groups = [...ideen.children].map(el => el.dataset.group || el.querySelector('textarea, input')?.name);
    expect(groups[0]).toBe('konzept-ideen-kopf');
    expect(ideen.querySelector('textarea#learnings_text')).toBeTruthy();
  });
});

describe('Briefing Liky-Spec nach fieldGroup', () => {
  it('enthält persistierte Felder aus den Groups, keine fieldGroups', () => {
    const spec = buildSpec('paid_creator_ads');
    const names = spec.map(f => f.name);
    expect(names).toEqual(expect.arrayContaining([
      'funnel_stufen', 'ad_channels', 'nutzung_markenkanal'
    ]));
    expect(spec.every(f => f.type !== 'fieldGroup')).toBe(true);
    expect(names).not.toContain('unternehmen_id');
    expect(names).not.toContain('marke_id');
  });
});
