import { describe, expect, it } from 'vitest';
import { FeedbackCard } from '../modules/projekt-erstellen/components/FeedbackCard.js';
import { ProjektErstellenWizard } from '../modules/projekt-erstellen/ProjektErstellenWizard.js';
import { ProjektErstellenValidator } from '../modules/projekt-erstellen/services/ProjektErstellenValidator.js';
import { StepKampagne } from '../modules/projekt-erstellen/steps/StepKampagne.js';
import {
  addKampagneSlot,
  distributeKampagnen,
  filterBlocksForKampagne,
  kampagnenSplitHint,
  parentTotals,
  reallocateFromEdited,
  removeKampagneSlot,
  resizeKampagnen
} from '../modules/projekt-erstellen/logic/kampagnenSplit.js';
import { splitCountEvenly, splitMoneyEvenly } from '../modules/projekt-erstellen/logic/splitEvenly.js';

describe('splitEvenly', () => {
  it('legt den Rest-Cent auf den letzten Slot', () => {
    expect(splitMoneyEvenly(100, 3)).toEqual([33.33, 33.33, 33.34]);
  });

  it('legt Rest-Videos auf den letzten Slot', () => {
    expect(splitCountEvenly(10, 3)).toEqual([3, 3, 4]);
  });
});

describe('kampagnenSplit', () => {
  it('verteilt nur das Volumen gleichmaessig, Arten bleiben am Slot', () => {
    const slots = distributeKampagnen(3, { volumen: 100000 }, [
      { campaign_blocks: [{ id: 'b1', campaign_type: 'ugc_paid', video_anzahl: 9, creator_anzahl: 3 }] }
    ]);
    expect(slots).toHaveLength(3);
    expect(slots.map(s => s.volumen)).toEqual([33333.33, 33333.33, 33333.34]);
    expect(slots[0].campaign_blocks).toHaveLength(1);
    expect(slots[0].videoanzahl).toBe(9);
    expect(slots[1].campaign_blocks).toEqual([]);
    expect(slots[1].videoanzahl).toBe(0);
    expect(slots.reduce((sum, s) => sum + s.volumen, 0)).toBeCloseTo(100000, 2);
  });

  it('behaelt bestehende Slots inkl. Arten beim Erhoehen und gibt den Rest-Volumen den neuen', () => {
    const existing = distributeKampagnen(1, { volumen: 90000 });
    existing[0].volumen = 20000;
    existing[0].campaign_blocks = [{ id: 'b1', campaign_type: 'ugc_paid', video_anzahl: 2, creator_anzahl: 1 }];

    const slots = resizeKampagnen(existing, 3, { volumen: 90000 });
    expect(slots).toHaveLength(3);
    expect(slots[0]).toMatchObject({ volumen: 20000, videoanzahl: 2, creatoranzahl: 1 });
    expect(slots[0].campaign_blocks[0].campaign_type).toBe('ugc_paid');
    expect(slots[1].campaign_blocks).toEqual([]);
    expect(slots[1].volumen + slots[2].volumen).toBeCloseTo(70000, 2);
  });

  it('schneidet hinten ab ohne Parent-Totals zu aendern', () => {
    const existing = distributeKampagnen(3, { volumen: 90000 });
    const slots = resizeKampagnen(existing, 1, { volumen: 90000 });
    expect(slots).toHaveLength(1);
    expect(slots[0].kampagnen_nummer).toBe(1);
  });

  it('laesst bei einer Kampagne den Resttopf stehen', () => {
    const slots = reallocateFromEdited(
      [{ kampagnen_nummer: 1, volumen: 100000, campaign_blocks: [] }],
      0,
      50000,
      { volumen: 100000 }
    );
    expect(slots).toHaveLength(1);
    expect(slots[0].volumen).toBe(50000);
  });

  it('gibt einer neuen Kampagne den Resttopf', () => {
    const slots = addKampagneSlot(
      [{ kampagnen_nummer: 1, volumen: 50000, campaign_blocks: [] }],
      { volumen: 100000 }
    );
    expect(slots).toHaveLength(2);
    expect(slots[0].volumen).toBe(50000);
    expect(slots[1].volumen).toBe(50000);
  });

  it('verteilt bei mehreren Kampagnen den Rest auf die anderen', () => {
    const existing = distributeKampagnen(3, { volumen: 100000 });
    const slots = reallocateFromEdited(existing, 0, 50000, { volumen: 100000 });
    expect(slots[0].volumen).toBe(50000);
    expect(slots[1].volumen + slots[2].volumen).toBeCloseTo(50000, 2);
  });

  it('entfernt einen Slot in der Mitte und behaelt die Volumina', () => {
    const existing = [
      { kampagnen_nummer: 1, volumen: 20000, campaign_blocks: [{ id: 'a' }] },
      { kampagnen_nummer: 2, volumen: 30000, campaign_blocks: [{ id: 'b' }] },
      { kampagnen_nummer: 3, volumen: 40000, campaign_blocks: [] }
    ];
    const slots = removeKampagneSlot(existing, 1);
    expect(slots).toHaveLength(2);
    expect(slots.map(s => s.volumen)).toEqual([20000, 40000]);
    expect(slots[0].kampagnen_nummer).toBe(1);
    expect(slots[1].kampagnen_nummer).toBe(2);
    expect(slots[0].campaign_blocks[0].id).toBe('a');
  });

  it('zeigt Info bei Resttopf und Warning bei Ueberfuellung', () => {
    const under = kampagnenSplitHint(
      [{ kampagnen_nummer: 1, volumen: 20000, campaign_blocks: [] }],
      { volumen: 50000 }
    );
    expect(under.kind).toBe('info');
    expect(under.message).toContain('nicht zugeordnet');
    expect(under.message).not.toContain('Videos');

    const over = kampagnenSplitHint(
      [{ kampagnen_nummer: 1, volumen: 60000, campaign_blocks: [] }],
      { volumen: 50000 }
    );
    expect(over.kind).toBe('warning');
    expect(over.message).toContain('Volumen');
  });

  it('filtert Bloecke nach kampagne_id und gibt Altbestand ohne ID nur der ersten Kampagne', () => {
    const blocks = [
      { id: 'a', kampagne_id: 'k2', campaign_type: 'influencer' },
      { id: 'b', kampagne_id: null, campaign_type: 'ugc_paid' }
    ];
    expect(filterBlocksForKampagne(blocks, 'k2', { kampagnenNummer: 2 }).map(b => b.id)).toEqual(['a']);
    expect(filterBlocksForKampagne(blocks, 'k1', { kampagnenNummer: 1 }).map(b => b.id)).toEqual(['b']);
    expect(filterBlocksForKampagne(blocks, 'k3', { kampagnenNummer: 3 })).toEqual([]);
  });
});

describe('StepKampagne Split-UX', () => {
  function createStep(overrides = {}) {
    const wizard = new ProjektErstellenWizard(document.createElement('div'));
    Object.assign(wizard.formData.auftrag, {
      nettobetrag: 90000,
      kampagnenanzahl: 1,
      ...overrides.auftrag
    });
    if (overrides.details) Object.assign(wizard.formData.details, overrides.details);
    if (overrides.kampagnen) wizard.formData.kampagnen = overrides.kampagnen;
    return new StepKampagne(wizard);
  }

  it('legt beim ersten Sync eine Kampagne an und uebernimmt Details-Bloecke', () => {
    const step = createStep({
      details: { campaign_blocks: [{ id: 'b1', campaign_type: 'ugc_paid', video_anzahl: 9, creator_anzahl: 3 }] }
    });
    step._syncFromParents();
    expect(step.wizard.formData.kampagnen).toHaveLength(1);
    expect(step.wizard.formData.kampagnen[0]).toMatchObject({
      volumen: 90000,
      videoanzahl: 9,
      creatoranzahl: 3
    });
    expect(step.wizard.formData.kampagnen[0].campaign_blocks[0].campaign_type).toBe('ugc_paid');
  });

  it('gibt einer neuen Kampagne den Rest und laesst Arten auf der bestehenden', () => {
    const step = createStep({
      details: { campaign_blocks: [{ id: 'b1', campaign_type: 'ugc_paid', video_anzahl: 9, creator_anzahl: 3 }] }
    });
    step._syncFromParents();
    step.wizard.formData.kampagnen[0].volumen = 20000;
    step._addSlot();
    const slots = step.wizard.formData.kampagnen;
    expect(slots).toHaveLength(2);
    expect(parentTotals(step.wizard.formData).volumen).toBe(90000);
    expect(slots[0].volumen).toBe(20000);
    expect(slots[1].volumen).toBe(70000);
    expect(slots[0].campaign_blocks).toHaveLength(1);
    expect(slots[1].campaign_blocks).toEqual([]);
  });

  it('behaelt manuelle Werte beim ersten Enter ohne Parent-Aenderung', () => {
    const step = createStep({
      kampagnen: [{ id: 'k1', kampagnen_nummer: 1, volumen: 20000, campaign_blocks: [] }]
    });
    step._syncFromParents();
    expect(step.wizard.formData.kampagnen[0].volumen).toBe(20000);
    step._syncFromParents();
    expect(step.wizard.formData.kampagnen[0].volumen).toBe(20000);
  });

  function renderThreeSlots() {
    const step = createStep({
      auftrag: { titel: 'Split' },
      kampagnen: distributeKampagnen(3, { volumen: 90000 })
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    step._syncFromParents();
    step.render(host);
    step.bindEvents();
    expect(host.querySelectorAll('.pe-kampagne-slot')).toHaveLength(3);
    expect(host.querySelectorAll('.pe-slot-arten')).toHaveLength(3);
    expect(host.querySelectorAll('.pe-kampagne-volumen')).toHaveLength(3);
    expect(host.querySelectorAll('.pe-kampagne-name')).toHaveLength(3);
    expect(host.querySelector('#pe-agency-host')).toBeTruthy();
    expect(host.querySelector('#field-pe-agency_services_enabled')).toBeTruthy();
    expect(host.querySelector('.pe-kampagne-videos')).toBeNull();
    expect(host.querySelector('#pe-kampagnen-host')).toBeNull();
    expect(host.querySelector('#field-pe-kampagnenanzahl')).toBeNull();
    const addBtn = host.querySelector('#pe-kampagne-add-btn');
    expect(addBtn).toBeTruthy();
    expect(addBtn.textContent).toBe('Weitere Kampagne hinzufügen');
    const removeBtns = host.querySelectorAll('[data-action="remove-kampagne"]');
    expect(removeBtns).toHaveLength(3);
    expect(removeBtns[0].querySelector('svg')).toBeTruthy();
    expect(removeBtns[0].textContent.trim()).not.toBe('Entfernen');
    expect(host.textContent).toContain('Kampagne 1 von 3');
    expect(host.textContent).toContain('Kampagne 2 von 3');
    expect(host.textContent).toContain('Kampagne 3 von 3');
    return { step, host };
  }

  it('rendert N Karten mit Volumen + Arten, Add/Remove und Agency einmal unten', () => {
    const { host } = renderThreeSlots();
    host.remove();
  });

  it('behaelt die Nested-UI nach onEnter', async () => {
    const { step, host } = renderThreeSlots();
    await step.onEnter();
    expect(host.querySelectorAll('.pe-kampagne-slot')).toHaveLength(3);
    expect(host.querySelectorAll('.pe-slot-arten')).toHaveLength(3);
    expect(host.querySelector('#field-pe-kampagnenanzahl')).toBeNull();
    host.remove();
  });

  it('blendet Entfernen beim letzten Slot aus', () => {
    const step = createStep({ auftrag: { titel: 'Single' } });
    const host = document.createElement('div');
    document.body.appendChild(host);
    step.render(host);
    step.bindEvents();
    expect(host.querySelectorAll('.pe-kampagne-slot')).toHaveLength(1);
    expect(host.textContent).toContain('Kampagne 1 von 1');
    expect(host.querySelector('[data-action="remove-kampagne"]')).toBeNull();
    const addBtn = host.querySelector('#pe-kampagne-add-btn');
    expect(addBtn).toBeTruthy();
    expect(addBtn.textContent).toBe('Weitere Kampagne hinzufügen');
    expect(host.querySelector('.pe-kampagne-name')).toBeTruthy();
    host.remove();
  });

  it('behaelt den Kampagnennamen beim Re-Render', () => {
    const step = createStep({
      auftrag: { titel: 'Named' },
      kampagnen: [
        { kampagnen_nummer: 1, volumen: 20000, eigener_name: 'Launch Q1', campaign_blocks: [] }
      ]
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    step.render(host);
    step.bindEvents();
    const nameInput = host.querySelector('.pe-kampagne-name');
    expect(nameInput.value).toBe('Launch Q1');
    nameInput.value = 'Relaunch Q2';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    host.querySelector('#pe-kampagne-add-btn').click();
    expect(step.wizard.formData.kampagnen[0].eigener_name).toBe('Relaunch Q2');
    expect(host.querySelector('.pe-kampagne-name[data-kampagne-index="0"]').value).toBe('Relaunch Q2');
    expect(host.querySelector('.pe-kampagne-name[data-kampagne-index="1"]').value).toBe('');
    host.remove();
  });
});

describe('FeedbackCard Kampagnen-Split', () => {
  it('zeigt Auftrag Netto, Gesamtbudget und Brutto in einer 3er-Zeile', () => {
    const card = new FeedbackCard(document.createElement('div'), { currentStep: 2, formData: {} });
    const html = card.buildStep2({
      auftrag: { nettobetrag: 100000, bruttobetrag: 119000 },
      details: {}
    });
    expect(html).toContain('projekt-erstellen-summary-metrics--3');
    expect(html).toContain('Auftrag Netto');
    expect(html).toContain('Gesamtbudget');
    expect(html).toContain('Brutto');
  });

  it('zeigt pro Kampagne Volumen und Arten in der Tabelle', () => {
    const card = new FeedbackCard(document.createElement('div'), { currentStep: 4, formData: {} });
    const html = card.buildKampagnenSplitSummary({
      kampagnen: [
        { kampagnen_nummer: 1, volumen: 20000, campaign_blocks: [{ campaign_type: 'ugc_paid' }] },
        { kampagnen_nummer: 2, volumen: 30000, campaign_blocks: [{ campaign_type: 'influencer' }] }
      ]
    });
    expect(html).toContain('pe-summary-table--compact');
    expect(html).toContain('UGC Paid');
    expect(html).toContain('Influencer Kampagne');
    expect(html).toContain('Videos');
    expect(html).toContain('Creator');
  });

  it('zeigt die Kampagnen-Tabelle statt K-n-von-N-Metriken', () => {
    const card = new FeedbackCard(document.createElement('div'), { currentStep: 4, formData: {} });
    const html = card.buildKampagneSummaryInline({
      kampagnen: [
        { kampagnen_nummer: 1, volumen: 20000, campaign_blocks: [{ campaign_type: 'ugc_paid' }] }
      ],
      details: {}
    });
    expect(html).toContain('projekt-erstellen-summary-kampagnen-table');
    expect(html).toContain('Kampagne 1');
    expect(html).not.toContain('K 1 von 1');
    expect(html).toContain('UGC Paid');
  });

  it('zeigt den eigenen Kampagnennamen in der Tabelle', () => {
    const card = new FeedbackCard(document.createElement('div'), { currentStep: 4, formData: {} });
    const html = card.buildKampagnenSplitSummary({
      kampagnen: [
        { kampagnen_nummer: 1, eigener_name: 'Launch Q1', volumen: 20000, campaign_blocks: [] }
      ]
    });
    expect(html).toContain('Launch Q1');
    expect(html).not.toContain('Kampagne 1');
  });

  it('zeigt den Resttopf wenn die Summe unter dem Auftrag liegt', () => {
    const card = new FeedbackCard(document.createElement('div'), { currentStep: 4, formData: {} });
    const html = card.buildKampagnenSplitSummary({
      auftrag: { nettobetrag: 100000 },
      kampagnen: [
        { kampagnen_nummer: 1, volumen: 50000, campaign_blocks: [] }
      ]
    });
    expect(html).toContain('Resttopf');
    expect(html).toContain('50.000,00');
  });
});

describe('Validator Kampagnenarten', () => {
  it('verlangt mindestens eine Art je Kampagne', () => {
    const validator = new ProjektErstellenValidator();
    const empty = validator.validateStepKampagne({
      auftrag: { titel: 'Split' },
      kampagnen: [
        { kampagnen_nummer: 1, volumen: 10, campaign_blocks: [] },
        { kampagnen_nummer: 2, volumen: 10, campaign_blocks: [] }
      ]
    });
    expect(empty.valid).toBe(false);
    expect(empty.errors[0]).toContain('Kampagne 1');

    const partial = validator.validateStepKampagne({
      auftrag: { titel: 'Split' },
      kampagnen: [
        { kampagnen_nummer: 1, volumen: 10, campaign_blocks: [] },
        { kampagnen_nummer: 2, volumen: 10, campaign_blocks: [{ id: 'b', campaign_type: 'ugc_paid' }] }
      ]
    });
    expect(partial.valid).toBe(false);
    expect(partial.errors[0]).toContain('Kampagne 1');

    const ok = validator.validateStepKampagne({
      auftrag: { titel: 'Split' },
      kampagnen: [
        { kampagnen_nummer: 1, volumen: 10, campaign_blocks: [{ id: 'a', campaign_type: 'influencer' }] },
        { kampagnen_nummer: 2, volumen: 10, campaign_blocks: [{ id: 'b', campaign_type: 'ugc_paid' }] }
      ]
    });
    expect(ok.valid).toBe(true);
  });
});
