// briefingCreateTestKit.js
// Gemeinsame Fakes für den Briefing-Generator: Instanz, gerendertes Formular, Supabase.

import { vi } from 'vitest';
import { BriefingCreate } from '../modules/briefing/create/BriefingCreateCore.js';
import { FLOW_STEPS } from '../modules/briefing/create/fieldConfig.js';
import { renderStep } from '../modules/briefing/create/FieldRenderer.js';
import '../modules/briefing/create/DataPersistence.js';
import '../modules/briefing/create/FormEvents.js';
import '../modules/briefing/create/ProduktListeEvents.js';

export function createInstance(bereich = 'influencer_marketing') {
  const instance = new BriefingCreate();
  instance.selectedBereich = bereich;
  return instance;
}

/** Alle drei Schritte als ein Formular, wie der Wizard sie rendert. */
export function renderFormular(formData = {}, context = {}) {
  document.body.innerHTML = `<form id="briefing-form">${FLOW_STEPS.map(s => renderStep(s, formData, context)).join('')}</form>`;
  return document.getElementById('briefing-form');
}

function looseChain(result = { data: [], error: null }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    not: vi.fn(() => query),
    is: vi.fn(() => query),
    neq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    upsert: vi.fn(() => query),
    delete: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    single: vi.fn(async () => ({ data: { id: 'row-1' }, error: null })),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  };
  return query;
}

/**
 * Supabase für campaign_briefings plus die Tabellen, die Speichern und Linie berühren.
 * @param {{ row?: object, produkte?: object[] }} opts - geladene Briefing-Zeile, verknüpfte Produkte
 */
export function mockSupabase({ row = null, produkte = [] } = {}) {
  const calls = { insert: [], update: [], junctionInsert: [] };
  const sb = {
    from: vi.fn((table) => {
      if (table === 'produktion') {
        const chain = looseChain();
        chain.maybeSingle = vi.fn(async () => ({ data: { id: 'pn1', name: 'Serum Sommer', kampagne_id: 'k1' }, error: null }));
        return chain;
      }
      if (table === 'campaign_briefing_produkt') {
        const chain = looseChain({ data: produkte.map(p => ({ produkt_id: p.id, produkt: p })), error: null });
        chain.insert = vi.fn(async (rows) => {
          calls.junctionInsert.push(rows);
          return { error: null };
        });
        return chain;
      }
      if (table !== 'campaign_briefings') return looseChain();
      return {
        insert: vi.fn((rows) => {
          calls.insert.push(rows[0]);
          return { select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 'briefing-1' }, error: null })) })) };
        }),
        update: vi.fn((data) => {
          calls.update.push(data);
          return { eq: vi.fn(async () => ({ error: null })) };
        }),
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: row, error: null })) })) }))
      };
    })
  };
  return { sb, calls };
}
