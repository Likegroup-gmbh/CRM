// BriefingFieldRenderer.test.js
// Markup des Creator-Briefing-Formulars: Schritte, Zuordnung, Content-Verwendung,
// Videolänge, Produkt- und Ideenliste, Liky-Spec.

import { describe, it, expect } from 'vitest';
import { FLOW_STEPS } from '../modules/briefing/create/fieldConfig.js';
import { renderStep } from '../modules/briefing/create/FieldRenderer.js';
import { buildSpec } from '../modules/briefing/create/BriefingLikyPanel.js';

function parse(html) {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

const step = (id) => FLOW_STEPS.find(s => s.id === id);
const render = (id, formData = {}, context = {}) => parse(renderStep(step(id), formData, context));

describe('Briefing FieldRenderer Hierarchie', () => {
  it('Step und Section bekommen stabile Klassen und data-Attribute', () => {
    const root = render('rahmen');
    const el = root.querySelector('.bf-step');
    expect(el.classList.contains('bf-step--rahmen')).toBe(true);
    expect(el.dataset.step).toBe('rahmen');

    const zuordnung = root.querySelector('.step-section--zuordnung');
    expect(zuordnung.dataset.step).toBe('rahmen');
    expect(zuordnung.classList.contains('hidden')).toBe(false);
    expect([...zuordnung.querySelectorAll('.bf-field-group')].map(g => g.dataset.group)).toEqual(['zuordnung-entities']);
    expect(root.querySelector('.step-section--rahmen h3').textContent).toBe('Kampagnenübersicht & Rahmen');
  });

  it('blendet die Zuordnung aus, wenn alles aus der Produktion feststeht', () => {
    const formData = { unternehmen_id: 'u1', marke_id: 'm1', kampagne_id: 'k1', produktion_id: 'p1' };
    const gebunden = render('rahmen', formData, { linieGesperrt: true, produktionGebunden: true });
    expect(gebunden.querySelector('.step-section--zuordnung').classList.contains('hidden')).toBe(true);

    const ohneProduktion = render('rahmen', formData, { linieGesperrt: true });
    const zuordnung = ohneProduktion.querySelector('.step-section--zuordnung');
    expect(zuordnung.classList.contains('hidden')).toBe(false);
    expect(zuordnung.querySelectorAll('[data-bekannt="true"]')).toHaveLength(3);
    expect(zuordnung.querySelector('select[name="produktion_id"]').closest('.form-field').classList.contains('hidden')).toBe(false);
  });

  it('Content-Verwendung: drei Häkchen, das des Typs ist angehakt und gesperrt', () => {
    const root = render('rahmen', {}, { bereich: 'paid_creator_ads' });
    const group = root.querySelector('[data-group="content-verwendung"]');
    expect(group.classList.contains('bf-field-group--wrap')).toBe(true);
    expect(group.querySelector('.bf-field-group__label').textContent).toBe('Wie wird der Content verwendet?');
    const boxen = [...group.querySelectorAll('input[type="checkbox"]')];
    expect(boxen.map(b => b.name)).toEqual(['nutzung_markenkanal', 'nutzung_paid_media', 'nutzung_creator_kanal']);
    const paid = boxen.find(b => b.name === 'nutzung_paid_media');
    expect(paid.checked && paid.disabled).toBe(true);
    expect(boxen.filter(b => b.disabled)).toHaveLength(1);
  });

  it('Timings: Bis-Datum hat das Von-Datum als min', () => {
    const root = render('rahmen', { content_deadline: '2026-12-01' });
    const bis = root.querySelector('input[name="content_deadline_bis"]');
    expect(bis.dataset.nachDatum).toBe('content_deadline');
    expect(bis.closest('[data-custom-datepicker]').dataset.min).toBe('2026-12-01');
    expect(root.querySelector('input[name="go_live_bis"]').closest('[data-custom-datepicker]').dataset.min).toBeUndefined();
  });
});

describe('Videolänge: Mindestlänge oder von/bis', () => {
  const modus = (formData) => {
    const root = render('rahmen', formData);
    return {
      root,
      gewaehlt: root.querySelector('input[name="videolaenge__modus"]:checked').value,
      minimum: root.querySelector('[data-videolaenge-teil="minimum"]'),
      bereich: root.querySelector('[data-videolaenge-teil="bereich"]')
    };
  };

  it('Spanne zeigt den Regler', () => {
    const { gewaehlt, minimum, bereich } = modus({ videolaenge: { von: 15, bis: 20 } });
    expect(gewaehlt).toBe('bereich');
    expect(bereich.classList.contains('hidden')).toBe(false);
    expect(bereich.dataset.von).toBe('15');
    expect(minimum.classList.contains('hidden')).toBe(true);
  });

  it('bis = null ist eine Mindestlänge', () => {
    const { root, gewaehlt, bereich } = modus({ videolaenge: { von: 30, bis: null } });
    expect(gewaehlt).toBe('minimum');
    expect(root.querySelector('input[name="videolaenge__minimum"]').value).toBe('30');
    expect(bereich.classList.contains('hidden')).toBe(true);
  });

  it('ohne Wert keine Vorgabe, ein gemerkter Modus gewinnt', () => {
    expect(modus({}).gewaehlt).toBe('keine');
    expect(modus({ videolaenge_modus: 'minimum' }).gewaehlt).toBe('minimum');
  });
});

describe('Produktliste', () => {
  it('startet mit einer leeren Zeile mit allen PDF-Feldern und Upload', () => {
    const root = render('produkt');
    const rows = root.querySelectorAll('[data-produkt-row]');
    expect(rows).toHaveLength(1);
    expect([...rows[0].querySelectorAll('[data-produkt-feld]')].map(el => el.dataset.produktFeld))
      .toEqual(['name', 'url', 'kurzbeschreibung', 'usp', 'loesung']);
    expect(rows[0].querySelector('[data-produkt-pdf]')).toBeTruthy();
    expect(rows[0].querySelector('[data-produkt-status]').textContent).toBe('');
  });

  it('zeigt den Status je Produkt und lässt in der Einladung den Upload weg', () => {
    const root = render('produkt', {
      produkte: [{ produkt_id: 'p1', name: 'Serum' }, { url: 'https://shop.example/creme' }]
    }, { einladung: true });
    const rows = [...root.querySelectorAll('[data-produkt-row]')];
    expect(rows.map(r => r.dataset.produktId)).toEqual(['p1', '']);
    expect(rows.map(r => r.querySelector('[data-produkt-status]').textContent)).toEqual(['Am Briefing', 'Wird angelegt']);
    expect(root.querySelector('[data-produkt-pdf]')).toBeNull();
    expect(rows[1].querySelector('[data-produkt-feld="url"]').value).toBe('https://shop.example/creme');
  });
});

describe('Umsetzungsideen', () => {
  it('je Eintrag Text plus Schalter Inspiration/verbindlich', () => {
    const root = render('umsetzung', {
      umsetzungsideen_eintraege: [{ text: 'Unboxing', verbindlich: true }, 'Alter Freitext']
    });
    const rows = [...root.querySelectorAll('[data-idee-row]')];
    expect(rows.map(r => r.querySelector('[data-idee-text]').value)).toEqual(['Unboxing', 'Alter Freitext']);
    expect(rows.map(r => r.querySelector('[data-idee-verbindlich]').checked)).toEqual([true, false]);
    expect(rows.map(r => r.querySelector('[data-idee-art]').textContent)).toEqual(['Verbindlich', 'Inspiration']);
  });

  it('Dos & Don\'ts stehen als Zeile nebeneinander, Don\'ts zuerst', () => {
    const group = render('umsetzung').querySelector('[data-group="dos-donts"]');
    expect(group.classList.contains('bf-field-group--row')).toBe(true);
    expect([...group.querySelectorAll('textarea')].map(t => t.name)).toEqual(['vorgabe_donts', 'vorgabe_dos']);
  });
});

describe('Briefing Liky-Spec', () => {
  it('enthält die Inhaltsfelder ohne Zuordnung und ohne fieldGroups', () => {
    const spec = buildSpec('paid_creator_ads');
    const names = spec.map(f => f.name);
    expect(names).toEqual(expect.arrayContaining(['aktivierung_name', 'plattformen', 'produkte', 'vorgabe_pflicht']));
    expect(spec.every(f => f.type !== 'fieldGroup' && f.type !== 'entitySelect')).toBe(true);
    expect(names).not.toContain('unternehmen_id');
  });

  it('Produkte, Ideen und Videolänge sagen ihre Wertform an', () => {
    const spec = Object.fromEntries(buildSpec('owned_social').map(f => [f.name, f]));
    expect(spec.produkte.fields.map(f => f.name)).toEqual(['name', 'url', 'kurzbeschreibung', 'usp', 'loesung']);
    expect(spec.umsetzungsideen_eintraege.valueShape).toContain('verbindlich: boolean');
    expect(spec.videolaenge.valueShape).toContain('bis: null');
    expect(spec.plattformen.options.map(o => o.value)).toEqual(['instagram', 'facebook', 'tiktok', 'youtube']);
  });
});
